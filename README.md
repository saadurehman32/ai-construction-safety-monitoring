# AI-Powered Construction Site Safety Monitoring Platform

An advanced, real-time safety monitoring and compliance engine that uses a fine-tuned **YOLOv8** computer vision model to detect Personal Protective Equipment (PPE) compliance and automatically generate safety officer inspection reports.

## Key Features
- **YOLOv8 PPE Detection Engine**: Runs locally on CPU using custom weights (`best.pt`) targeting 10 classes (Hardhat, Mask, Safety Vest, Person, Vehicle, Machinery, etc.).
- **Spatial Intersection Compliance Check**: Eliminates double-counting and false alarms by checking if detected safety violations lie within the bounding box of a specific worker (`Person`).
- **Logic Caps & Per-Person Rules**: Limits workers to a maximum of one safety violation per category (missing Helmet, missing Vest, missing Mask).
- **FastAPI Backend Processor**: High-performance API using FastAPI, returning real-time compliance results, safety recommendations, and annotated images.
- **Tailwind CSS React Dashboard**: Dual-view preview matrix rendering raw uploads and annotated tensor outputs side-by-side with dynamic KPI badges and an interactive clipboard safety report panel.

---

## Tech Stack
- **Backend**: Python, FastAPI, Uvicorn, Ultralytics (YOLOv8), OpenCV, Pydantic.
- **Frontend**: React, Vite, Tailwind CSS v4, PostCSS, Lucide React.

---

## Directory Structure
```text
Construction Safety Hazard Detection/
├── main.py                  # Central FastAPI backend application
├── test_api.py              # Mock image integration test script
├── requirements.txt         # CPU-optimized Python dependencies list
├── best.pt                  # Fine-tuned YOLOv8 model weights
├── static/
│   └── predictions/         # Internal storage for annotated output frames
├── frontend/
│   ├── package.json         # Frontend dependencies and Vite scripts
│   ├── vite.config.js       # Vite configuration (runs on port 3000)
│   ├── postcss.config.js    # PostCSS plugins configuration
│   ├── src/
│   │   ├── main.jsx         # React mounting entrypoint
│   │   ├── App.jsx          # Dashboard layout component
│   │   └── index.css        # Global CSS, keyframes, and Tailwind imports
```

---

## Getting Started

### 1. Backend Setup & Installation
Activate the virtual environment and install the CPU-optimized torch wheels:

```bash
# Activate Virtual Environment
.\venv\Scripts\activate

# Install dependencies (configured for lightweight CPU compilation)
pip install -r requirements.txt

# Run the FastAPI server in background reload mode
uvicorn main:app --port 8000 --host 127.0.0.1 --reload
```

The backend API documentation is available at `http://localhost:8000/docs`.

### 2. Frontend Dashboard Setup
In a separate terminal, navigate to the `frontend/` folder and run the developer dev server:

```bash
cd frontend
npm install
npm run dev
```

The React dashboard runs on `http://localhost:3000`.

### 3. Verification Testing
You can verify the backend endpoints and schema validation integrity by executing the automated test suite:

```bash
.\venv\Scripts\python test_api.py
```
