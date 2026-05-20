import os
import uuid
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ultralytics import YOLO

# 1. Ensure predictions directory exists at startup
os.makedirs("static/predictions", exist_ok=True)

# 2. Load the YOLOv8 model weights using CPU mapping settings
try:
    model = YOLO("best.pt")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

# Create the FastAPI app
app = FastAPI(
    title="AI-Powered Construction Site Safety Monitoring Backend",
    description="High-velocity FastAPI backend processor for construction site compliance detection.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Mount static directory for serving prediction images
app.mount("/static", StaticFiles(directory="static"), name="static")

# Class mapping in the explicit array sequence
CLASS_NAMES = [
    "Hardhat",          # 0
    "Mask",             # 1
    "NO-Hardhat",        # 2
    "NO-Mask",           # 3
    "NO-Safety Vest",    # 4
    "Person",           # 5
    "Safety Cone",      # 6
    "Safety Vest",      # 7
    "machinery",        # 8
    "vehicle"           # 9
]

# Pydantic response schema
class PredictionResponse(BaseModel):
    detections: dict[str, int] = Field(
        ..., 
        description="Dictionary mapping each class name to its detected count"
    )
    total_violations_count: int = Field(
        ..., 
        description="Sum of NO-Hardhat, NO-Mask, and NO-Safety Vest detections"
    )
    has_violations: bool = Field(
        ..., 
        description="Boolean indicating whether any safety violations were detected"
    )
    risk_level: str = Field(
        ..., 
        description="Risk level evaluation: LOW (0), MEDIUM (1-2), HIGH (>2)"
    )
    prediction_image_url: str = Field(
        ..., 
        description="The accessible relative path URL to the annotated prediction image"
    )
    recommendation: str = Field(
        ..., 
        description="Dynamic safety recommendation text report"
    )

@app.post("/api/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")

    try:
        # Read image bytes
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode the uploaded image.")
        
        if model is None:
            raise HTTPException(status_code=500, detail="YOLO model is not loaded correctly.")

        # Run inference using YOLOv8 with confidence threshold of 0.40 on CPU
        results = model(img, conf=0.40, device="cpu")
        
        # Draw annotated bounding boxes on the frame using results[0].plot()
        annotated_frame = results[0].plot()
        
        # Save output image under static/predictions using a unique filename
        unique_filename = f"pred_{uuid.uuid4().hex}.jpg"
        output_path = os.path.join("static", "predictions", unique_filename)
        cv2.imwrite(output_path, annotated_frame)
        
        # Build image URL path
        prediction_image_url = f"/static/predictions/{unique_filename}"
        
        # Initialize raw counts and lists for grouping
        raw_counts = {name: 0 for name in CLASS_NAMES}
        persons = []
        violations = {
            "NO-Hardhat": [],
            "NO-Mask": [],
            "NO-Safety Vest": []
        }
        
        # Parse detections and extract xyxy coordinates
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                if 0 <= cls_id < len(CLASS_NAMES):
                    class_name = CLASS_NAMES[cls_id]
                    raw_counts[class_name] += 1
                    
                    xyxy = box.xyxy[0].cpu().tolist()  # [xmin, ymin, xmax, ymax]
                    
                    if class_name == "Person":
                        persons.append({
                            "box": xyxy,
                            "violations": {
                                "NO-Hardhat": None,
                                "NO-Mask": None,
                                "NO-Safety Vest": None
                            }
                        })
                    elif class_name in ["NO-Hardhat", "NO-Mask", "NO-Safety Vest"]:
                        xmin, ymin, xmax, ymax = xyxy
                        cx = (xmin + xmax) / 2.0
                        cy = (ymin + ymax) / 2.0
                        violations[class_name].append({
                            "center": (cx, cy),
                            "box": xyxy,
                            "assigned": False
                        })
        
        # Spatial intersection matching: Map violations to Person boundaries
        for violation_type in ["NO-Hardhat", "NO-Mask", "NO-Safety Vest"]:
            for person in persons:
                px_min, py_min, px_max, py_max = person["box"]
                for v_box in violations[violation_type]:
                    if v_box["assigned"]:
                        continue
                    cx, cy = v_box["center"]
                    # If violation midpoint center falls inside the person's perimeter
                    if px_min <= cx <= px_max and py_min <= cy <= py_max:
                        person["violations"][violation_type] = v_box
                        v_box["assigned"] = True
                        break  # Match max 1 violation of this type per person
        
        # Aggregate unique anchored counts
        no_hardhat = sum(1 for p in persons if p["violations"]["NO-Hardhat"] is not None)
        no_mask = sum(1 for p in persons if p["violations"]["NO-Mask"] is not None)
        no_safety_vest = sum(1 for p in persons if p["violations"]["NO-Safety Vest"] is not None)
        
        counts = {name: 0 for name in CLASS_NAMES}
        for name in CLASS_NAMES:
            if name not in ["NO-Hardhat", "NO-Mask", "NO-Safety Vest"]:
                counts[name] = raw_counts[name]
                
        counts["NO-Hardhat"] = no_hardhat
        counts["NO-Mask"] = no_mask
        counts["NO-Safety Vest"] = no_safety_vest
        
        total_violations_count = no_hardhat + no_mask + no_safety_vest
        has_violations = total_violations_count > 0
        
        # Define risk level
        if total_violations_count == 0:
            risk_level = "LOW"
        elif 1 <= total_violations_count <= 2:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"
            
        # Build dynamic violation details string
        violation_parts = []
        if no_hardhat > 0:
            violation_parts.append(f"{no_hardhat} worker{'s' if no_hardhat > 1 else ''} missing a Hardhat")
        if no_mask > 0:
            violation_parts.append(f"{no_mask} worker{'s' if no_mask > 1 else ''} missing a Mask")
        if no_safety_vest > 0:
            violation_parts.append(f"{no_safety_vest} worker{'s' if no_safety_vest > 1 else ''} missing a Safety Vest")

        if len(violation_parts) == 0:
            item_summary = ""
        elif len(violation_parts) == 1:
            item_summary = violation_parts[0]
        elif len(violation_parts) == 2:
            item_summary = f"{violation_parts[0]} and {violation_parts[1]}"
        else:
            item_summary = f"{', '.join(violation_parts[:-1])}, and {violation_parts[-1]}"

        # Compute recommendation using user specified templates
        if risk_level == "LOW":
            recommendation = (
                "SITE COMPLIANCE STATUS: SECURE. All detected personnel are fully equipped with mandatory protective equipment "
                "(Hardhat, Safety Vest, Mask). Current operational conditions meet regulatory site standard parameters. "
                "Recommendation: Maintain routine continuous automated monitoring."
            )
        elif risk_level == "MEDIUM":
            recommendation = (
                f"SAFETY WARNING: MINOR NON-COMPLIANCE DETECTED. The automated vision engine has flagged {item_summary}. "
                f"Risk level is evaluated as MEDIUM. Recommendation: Dispatch immediate notification to field supervisor to "
                f"issue on-site compliance corrections. Operations may proceed under observation."
            )
        else:  # HIGH
            recommendation = (
                f"CRITICAL COMPLIANCE ALERT: MULTIPLE SAFETY VIOLATIONS IDENTIFIED. Total of {total_violations_count} serious "
                f"PPE breaches detected across active zones, including {item_summary}. Risk level is evaluated as HIGH. "
                f"Recommendation: Immediate site-wide safety intervention required. Halt high-risk zone operations until "
                f"all active personnel are manually verified and equipped with mandatory safety assets."
            )

        return PredictionResponse(
            detections=counts,
            total_violations_count=total_violations_count,
            has_violations=has_violations,
            risk_level=risk_level,
            prediction_image_url=prediction_image_url,
            recommendation=recommendation
        )

    except Exception as e:
        # Catch unexpected errors to ensure robustness
        raise HTTPException(status_code=500, detail=f"Internal inference error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Start server locally
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
