<img width="1423" height="887" alt="ai 2" src="https://github.com/user-attachments/assets/cfd2fcf0-9245-4be3-998a-42cbc4b34c5b" />
# AI-Powered Construction Site Safety Monitoring Platform

An advanced, real-time safety monitoring and compliance engine that uses dual fine-tuned **YOLOv8** computer vision models to detect Personal Protective Equipment (PPE) compliance and environmental hazards, generating automated inspections and offering a conversational safety advisor console powered by **Groq Cloud LLM**.

## Key Features

- **Dual-Model Inference Engine**:
  - **`PPE Compliance.pt`**: Runs at `conf=0.35` on CPU, using a spatial intersection compliance check. It automatically verifies if missing PPE items (helmet, safety vest, mask) lie within the worker's bounding box to prevent false alerts, enforcing a logic cap of one violation per category per person.
  - **`Hazard Detection.pt`**: Runs concurrently at `conf=0.254` on CPU, flagging environmental dangers: Fire, Smoke, Water Leaks, and Chemical Hazards.
- **Priority Status Logic**: Automatically maps threat severity to a site status:
  - `CRITICAL EMERGENCY`: Fire or Chemical Hazard active (triggers a blinking red alert banner on the frontend dashboard).
  - `HIGH RISK`: Water Leak active or $>2$ PPE violations.
  - `MEDIUM RISK`: $1$ or $2$ PPE violations.
  - `LOW RISK`: Fully compliant site with no environmental hazards.
- **Groq Cloud AI Safety Officer**:
  - Connects to Groq (`llama3-8b-8192` with active model fallbacks) to transform vision logs into a structured 4-section safety assessment report covering current threat status, OSHA-compliant risk assessments, immediate field directives, and SMS emergency broadcast templates.
  - Handles real-time follow-up conversations using a conversational safety supervisor role.
- **Modern Split-Pane Dashboard**:
  - **70% Left Pane**: Image upload control center, KPI status metrics, environmental threat indicators, and annotated side-by-side image overlays.
  - **30% Right Pane**: Interactive safety chat sidebar rendered with `react-markdown`.

---

## Tech Stack

- **Backend**: Python, FastAPI, Uvicorn, Ultralytics (YOLOv8), OpenCV, Groq Python SDK, Pydantic, python-dotenv.
- **Frontend**: React, Vite, Tailwind CSS v4, PostCSS, Lucide React, react-markdown.

---

## Directory Structure

```text
Construction Safety Hazard Detection/
├── main.py                  # FastAPI application with dual model pipelines & Groq integration
├── test_api.py              # Automated API and LLM chat integration verification script
├── requirements.txt         # CPU-optimized Python dependencies list
├── PPE Compliance.pt        # Fine-tuned YOLOv8 PPE detection weights
├── Hazard Detection.pt      # Fine-tuned YOLOv8 environmental hazard weights
├── static/
│   └── predictions/         # Temporary storage for dual-annotated inference frames
├── frontend/
│   ├── package.json         # Frontend package configuration and scripts
│   ├── vite.config.js       # Vite configuration running on port 3000
│   ├── src/
│   │   ├── main.jsx         # React mounting entrypoint
│   │   ├── App.jsx          # Split-pane dashboard & chat console layout
│   │   └── index.css        # Global styles and Tailwind imports
```

---

## Getting Started

### 1. Backend Setup & Configuration

1. Create a `.env` file at the root of the project with your Groq API Key:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```
2. Activate your virtual environment and install the backend dependencies:
   ```bash
   # Activate virtual environment
   .\venv\Scripts\activate

   # Install requirements
   pip install -r requirements.txt

   # Start the FastAPI backend
   python main.py
   ```
   The backend API docs are available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Development Setup

1. In a separate terminal, navigate to the `frontend/` directory and install packages:
   ```bash
   cd frontend
   npm install
   ```
2. Run the hot-reloading development server:
   ```bash
   npm run dev
   ```
   The application dashboard will run locally at `http://localhost:3000`.

### 3. Run Automated Integration Verification

Validate the integrity of predictions, schemas, and chat follow-up flows using the test suite:
```bash
.\venv\Scripts\python test_api.py
```
