import os
import cv2
import numpy as np
import requests

def test_prediction_endpoint():
    url = "http://localhost:8000/api/predict"
    chat_url = "http://localhost:8000/api/chat"
    test_img_path = "temp_test.jpg"
    
    # 1. Create a dummy test image (640x640 blue square)
    print("Generating dummy test image...")
    dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
    dummy_image[:] = [255, 0, 0] # BGR Blue
    cv2.imwrite(test_img_path, dummy_image)
    
    try:
        # 2. Upload the dummy image to /api/predict
        print(f"Sending POST request to {url}...")
        with open(test_img_path, "rb") as f:
            files = {"file": ("temp_test.jpg", f, "image/jpeg")}
            response = requests.post(url, files=files)
            
        # 3. Print status code and response payload
        print(f"Response Status Code: {response.status_code}")
        print("Response JSON Payload:")
        import json
        print(json.dumps(response.json(), indent=2))
        
        # Assertions
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify structure
        assert "detections" in data, "Missing 'detections' field"
        assert isinstance(data["detections"], dict), "'detections' should be a dictionary"
        
        assert "total_violations_count" in data, "Missing 'total_violations_count' field"
        assert isinstance(data["total_violations_count"], int), "'total_violations_count' should be an integer"
        
        assert "has_violations" in data, "Missing 'has_violations' field"
        assert isinstance(data["has_violations"], bool), "'has_violations' should be a boolean"
        
        assert "risk_level" in data, "Missing 'risk_level' field"
        assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH"], f"Invalid risk_level: {data['risk_level']}"
        
        assert "prediction_image_url" in data, "Missing 'prediction_image_url' field"
        assert isinstance(data["prediction_image_url"], str), "'prediction_image_url' should be a string"
        assert data["prediction_image_url"].startswith("/static/predictions/"), "Invalid image URL path"
        
        assert "recommendation" in data, "Missing 'recommendation' field"
        assert isinstance(data["recommendation"], str), "'recommendation' should be a string"

        # Verify new fields
        assert "site_status" in data, "Missing 'site_status' field"
        assert isinstance(data["site_status"], str), "'site_status' should be a string"
        assert data["site_status"] in ["LOW RISK", "MEDIUM RISK", "HIGH RISK", "CRITICAL EMERGENCY"]

        assert "environmental_hazards" in data, "Missing 'environmental_hazards' field"
        assert isinstance(data["environmental_hazards"], dict), "'environmental_hazards' should be a dictionary"
        for flag in ["fire", "smoke", "water_leak", "chemical_hazard"]:
            assert flag in data["environmental_hazards"], f"Missing hazard flag: {flag}"
            assert isinstance(data["environmental_hazards"][flag], bool), f"Hazard flag '{flag}' must be a boolean"

        assert "ai_analysis" in data, "Missing 'ai_analysis' field"
        assert isinstance(data["ai_analysis"], str), "'ai_analysis' should be a string"
        assert "CURRENT THREAT STATUS" in data["ai_analysis"] or "Error" in data["ai_analysis"], "AI Analysis lacks expected sections"
        
        print("API predict assertions PASSED successfully!")

        # 4. Test the chat endpoint
        print(f"Sending POST request to {chat_url}...")
        chat_payload = {
            "message": "What is the immediate action recommended for chemical hazard?",
            "vision_data": data,
            "history": []
        }
        chat_response = requests.post(chat_url, json=chat_payload)
        print(f"Chat Response Status Code: {chat_response.status_code}")
        print("Chat Response JSON Payload:")
        print(json.dumps(chat_response.json(), indent=2))
        
        assert chat_response.status_code == 200, f"Expected 200, got {chat_response.status_code}"
        chat_data = chat_response.json()
        assert "reply" in chat_data, "Missing 'reply' field in chat response"
        assert isinstance(chat_data["reply"], str), "'reply' should be a string"
        
        print("API chat assertions PASSED successfully!")
        print("All API & Chat verification tests PASSED!")
        
    except Exception as e:
        print(f"Test failed with error: {e}")
        if 'response' in locals() and hasattr(response, 'text'):
            print(f"Server response detail: {response.text}")
        raise e
    finally:
        # Clean up temporary test image
        if os.path.exists(test_img_path):
            os.remove(test_img_path)
            print("Cleaned up temporary test image.")

if __name__ == "__main__":
    test_prediction_endpoint()
