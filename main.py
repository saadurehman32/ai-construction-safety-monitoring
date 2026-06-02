import os
import uuid
import cv2
import json
import asyncio
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ultralytics import YOLO
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()

# Initialize predictions directory
os.makedirs("static/predictions", exist_ok=True)

# Initialize Groq client
groq_api_key = os.environ.get("GROQ_API_KEY")
if not groq_api_key:
    raise ValueError("GROQ_API_KEY environment variable is not set. Please configure it in a .env file at the project root.")
groq_client = Groq(api_key=groq_api_key)

# Load both models concurrently
try:
    ppe_model = YOLO("PPE Compliance.pt")
except Exception as e:
    print(f"Error loading PPE Compliance model: {e}")
    ppe_model = None

try:
    hazard_model = YOLO("Hazard Detection.pt")
except Exception as e:
    print(f"Error loading Hazard Detection model: {e}")
    hazard_model = None

# Create FastAPI app
app = FastAPI(
    title="AI-Powered Construction Site Safety Monitoring Backend",
    description="Refactored FastAPI backend featuring dual-model inference and Groq conversational safety report.",
    version="2.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory for serving prediction images
app.mount("/static", StaticFiles(directory="static"), name="static")

# Class mapping for PPE Compliance
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

# Hazard Classes Mapping
HAZARD_CLASSES = {
    0: "chemical_hazard",
    1: "fire",
    2: "smoke",
    3: "water_leak"
}

# Pydantic schemas
class PredictionResponse(BaseModel):
    detections: dict[str, int] = Field(..., description="Dictionary mapping each PPE class name to its count")
    total_violations_count: int = Field(..., description="Total count of PPE violations")
    has_violations: bool = Field(..., description="Boolean indicating if any safety violations were detected")
    risk_level: str = Field(..., description="Risk level evaluation: LOW, MEDIUM, HIGH")
    prediction_image_url: str = Field(..., description="Accessible relative path URL to the annotated image")
    recommendation: str = Field(..., description="Dynamic safety recommendation text report")
    site_status: str = Field(..., description="Priority logic status string")
    environmental_hazards: dict[str, bool] = Field(..., description="Boolean flags for parsed environmental hazards")
    ai_analysis: str = Field(..., description="Groq Cloud API generated markdown safety report")

class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's follow-up question")
    vision_data: dict = Field(..., description="The context object representing the current scan results")
    history: list[dict] = Field(default=[], description="Message history list")

# Helper function to call Groq with decommissioned fallback
def call_groq_with_fallback(messages, temperature=0.3):
    # Try the requested decommissioned model first, then fall back to active models
    models = ["llama3-8b-8192", "llama-3.1-8b-instant", "llama-3.3-70b-specdec", "llama-3.3-70b-versatile", "mixtral-8x7b-32768"]
    last_err = None
    for model_name in models:
        try:
            print(f"Attempting Groq completion using model: {model_name}")
            completion = groq_client.chat.completions.create(
                messages=messages,
                model=model_name,
                temperature=temperature
            )
            print(f"Successfully completed using model: {model_name}")
            return completion.choices[0].message.content
        except Exception as e:
            print(f"Failed using model {model_name}: {e}. Retrying with next fallback...")
            last_err = e
    raise last_err

def enhance_image(img):
    # 1. Contrast Stretching (Min-Max Normalization)
    stretched = cv2.normalize(img, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    
    # 2. CLAHE (Local Contrast Equalization in LAB color space)
    lab = cv2.cvtColor(stretched, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l_channel)
    lab_enhanced = cv2.merge((cl, a_channel, b_channel))
    equalized = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
    
    # 3. Median Filtering (Noise reduction)
    filtered = cv2.medianBlur(equalized, 5)
    
    # 4. Gamma Correction (Illumination normalization)
    gamma = 1.2
    invGamma = 1.0 / gamma
    table = np.array([((i / 255.0) ** invGamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
    corrected = cv2.LUT(filtered, table)
    
    # 5. Unsharp Masking (Image sharpening)
    gaussian = cv2.GaussianBlur(corrected, (0, 0), 2.0)
    sharpened = cv2.addWeighted(corrected, 1.5, gaussian, -0.5, 0)
    
    return sharpened

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
        
        if ppe_model is None:
            raise HTTPException(status_code=500, detail="PPE Compliance model is not loaded correctly.")
            
        if hazard_model is None:
            raise HTTPException(status_code=500, detail="Hazard Detection model is not loaded correctly.")

        # Apply image enhancement pipeline
        enhanced_img = enhance_image(img)

        # 1. Run inference using PPE Compliance model with conf=0.35 on CPU
        results = ppe_model(enhanced_img, conf=0.35, device="cpu")
        annotated_frame = results[0].plot()
        
        # 2. Run inference using Hazard Detection model with conf=0.254 on CPU
        hazard_results = hazard_model(enhanced_img, conf=0.254, device="cpu")
        # Draw hazard boxes on top of the PPE annotated frame
        annotated_frame = hazard_results[0].plot(img=annotated_frame)
        
        # Setup output paths (saving is deferred until watermark details are computed)
        unique_filename = f"pred_{uuid.uuid4().hex}.jpg"
        output_path = os.path.join("static", "predictions", unique_filename)
        prediction_image_url = f"/static/predictions/{unique_filename}"
        
        # Initialize counts and groupings for PPE spatial checks
        raw_counts = {name: 0 for name in CLASS_NAMES}
        persons = []
        violations = {
            "NO-Hardhat": [],
            "NO-Mask": [],
            "NO-Safety Vest": []
        }
        
        # Parse PPE detections
        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                if 0 <= cls_id < len(CLASS_NAMES):
                    class_name = CLASS_NAMES[cls_id]
                    raw_counts[class_name] += 1
                    
                    xyxy = box.xyxy[0].cpu().tolist()
                    
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
        
        # Spatial intersection matching (Module A logic)
        for violation_type in ["NO-Hardhat", "NO-Mask", "NO-Safety Vest"]:
            for person in persons:
                px_min, py_min, px_max, py_max = person["box"]
                for v_box in violations[violation_type]:
                    if v_box["assigned"]:
                        continue
                    cx, cy = v_box["center"]
                    if px_min <= cx <= px_max and py_min <= cy <= py_max:
                        person["violations"][violation_type] = v_box
                        v_box["assigned"] = True
                        break

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
        
        # Original risk level mapping
        if total_violations_count == 0:
            risk_level = "LOW"
        elif 1 <= total_violations_count <= 2:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        # Parse environmental hazards
        environmental_hazards = {
            "chemical_hazard": False,
            "fire": False,
            "smoke": False,
            "water_leak": False
        }
        
        if len(hazard_results) > 0 and hazard_results[0].boxes is not None:
            for box in hazard_results[0].boxes:
                cls_id = int(box.cls[0].item())
                if cls_id in HAZARD_CLASSES:
                    environmental_hazards[HAZARD_CLASSES[cls_id]] = True

        # Priority status logic:
        # If 'fire' or 'chemical_hazard' is True -> "CRITICAL EMERGENCY"
        # If 'water_leak' is True or PPE violations > 2 -> "HIGH RISK"
        if environmental_hazards["fire"] or environmental_hazards["chemical_hazard"]:
            site_status = "CRITICAL EMERGENCY"
        elif environmental_hazards["water_leak"] or total_violations_count > 2:
            site_status = "HIGH RISK"
        elif 1 <= total_violations_count <= 2:
            site_status = "MEDIUM RISK"
        else:
            site_status = "LOW RISK"

        # Formatting dynamic PPE warning string
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
        else:
            recommendation = (
                f"CRITICAL COMPLIANCE ALERT: MULTIPLE SAFETY VIOLATIONS IDENTIFIED. Total of {total_violations_count} serious "
                f"PPE breaches detected across active zones, including {item_summary}. Risk level is evaluated as HIGH. "
                f"Recommendation: Immediate site-wide safety intervention required. Halt high-risk zone operations until "
                f"all active personnel are manually verified and equipped with mandatory safety assets."
            )

        # Vision data to send to Groq API
        vision_dict = {
            "detections": counts,
            "environmental_hazards": environmental_hazards,
            "total_violations_count": total_violations_count,
            "site_status": site_status,
            "risk_level": risk_level,
            "recommendation": recommendation
        }
        vision_str = json.dumps(vision_dict, indent=2)

        # Call Groq API in a background thread to generate markdown report
        system_prompt = (
            "You are the AI Construction Safety Officer. Analyze the incoming JSON matrix and output a direct safety report in Markdown format with 4 distinct sections: \n"
            "### 🚨 CURRENT THREAT STATUS\n"
            "### 📋 EXECUTIVE RISK ASSESSMENT (cite OSHA guidelines)\n"
            "### ⚡ IMMEDIATE FIELD DIRECTIVES (prioritize immediate evacuation/containment if fire/chemical leaks are active)\n"
            "### 🔔 AUTOMATED NOTIFICATION PROTOCOL (provide an emergency SMS broadcast text box template inside a blockquote)"
        )

        try:
            ai_analysis = await asyncio.to_thread(
                call_groq_with_fallback,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Analyze the following JSON matrix:\n{vision_str}"}
                ],
                temperature=0.3
            )
        except Exception as e:
            print(f"Error calling Groq API: {e}")
            ai_analysis = (
                "### 🚨 CURRENT THREAT STATUS\n"
                f"Error contacting safety intelligence agent: {str(e)}\n\n"
                "### 📋 EXECUTIVE RISK ASSESSMENT (cite OSHA guidelines)\n"
                "Not available.\n\n"
                "### ⚡ IMMEDIATE FIELD DIRECTIVES (prioritize immediate evacuation/containment if fire/chemical leaks are active)\n"
                "Please verify active threats manually.\n\n"
                "### 🔔 AUTOMATED NOTIFICATION PROTOCOL (provide an emergency SMS broadcast text box template inside a blockquote)\n"
                "> EMERGENCY BREACH DETECTED. PLEASE RESOLVE IMMEDIATELY."
            )

        # Draw watermark card at the top-left of the final annotated frame
        overlay = annotated_frame.copy()
        cv2.rectangle(overlay, (10, 10), (320, 75), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, annotated_frame, 0.4, 0, annotated_frame)
        
        # Draw text contents
        import datetime
        timestamp_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(annotated_frame, f"TIME: {timestamp_str}", (20, 35), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        
        # Color coding for site status: Green for low, Orange for medium, Red for high/critical
        status_color = (0, 255, 0)
        if site_status in ["CRITICAL EMERGENCY", "HIGH RISK"]:
            status_color = (0, 0, 255)
        elif site_status == "MEDIUM RISK":
            status_color = (0, 165, 255)
            
        cv2.putText(annotated_frame, f"STATUS: {site_status}", (20, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, status_color, 1, cv2.LINE_AA)

        # Write output image to disk
        cv2.imwrite(output_path, annotated_frame)

        return PredictionResponse(
            detections=counts,
            total_violations_count=total_violations_count,
            has_violations=has_violations,
            risk_level=risk_level,
            prediction_image_url=prediction_image_url,
            recommendation=recommendation,
            site_status=site_status,
            environmental_hazards=environmental_hazards,
            ai_analysis=ai_analysis
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal inference error: {str(e)}")

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        system_prompt = (
            "You are the AI Construction Safety Officer. Answer follow-up questions about the safety report for this site instance log. "
            f"The site data is: {json.dumps(request.vision_data, indent=2)}."
        )
        
        messages = [{"role": "system", "content": system_prompt}]
        for msg in request.history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": request.message})

        try:
            reply = await asyncio.to_thread(
                call_groq_with_fallback,
                messages=messages,
                temperature=0.7
            )
            return {"reply": reply}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
