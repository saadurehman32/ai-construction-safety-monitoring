import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  UploadCloud, 
  CheckCircle, 
  Server, 
  Users, 
  Activity, 
  FileText, 
  Image as ImageIcon,
  Loader2,
  HardHat
} from "lucide-react";

export default function App() {
  const [backendStatus, setBackendStatus] = useState("checking");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Safety compliance data states
  const [responseData, setResponseData] = useState({
    detections: {
      "Hardhat": 0,
      "Mask": 0,
      "NO-Hardhat": 0,
      "NO-Mask": 0,
      "NO-Safety Vest": 0,
      "Person": 0,
      "Safety Cone": 0,
      "Safety Vest": 0,
      "machinery": 0,
      "vehicle": 0
    },
    total_violations_count: 0,
    has_violations: false,
    risk_level: "LOW",
    prediction_image_url: "",
    recommendation: "SITE COMPLIANCE STATUS: SECURE. All detected personnel are fully equipped with mandatory protective equipment (Hardhat, Safety Vest, Mask). Current operational conditions meet regulatory site standard parameters. Recommendation: Maintain routine continuous automated monitoring."
  });

  // Check connection status of backend
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch("http://localhost:8000/docs", { method: "HEAD" });
        if (res.status === 200 || res.ok) {
          setBackendStatus("connected");
        } else {
          setBackendStatus("disconnected");
        }
      } catch (err) {
        setBackendStatus("disconnected");
      }
    };
    checkConnection();
    const timer = setInterval(checkConnection, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  };

  const handleImageFile = (file) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (.png, .jpg, .jpeg).");
      return;
    }
    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    uploadAndProcess(file);
  };

  const uploadAndProcess = async (file) => {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/api/predict", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResponseData(data);
      // Prefix relative static URL path with FastAPI server URL
      setProcessedUrl(`http://localhost:8000${data.prediction_image_url}`);
    } catch (err) {
      console.error(err);
      setError("Failed to process image with the backend compliance engine.");
    } finally {
      setLoading(false);
    }
  };

  // Helper for risk status styling
  const getRiskBadgeStyles = (level) => {
    switch (level) {
      case "LOW":
        return "border border-emerald-500 text-emerald-400 bg-emerald-950/40";
      case "MEDIUM":
        return "border border-amber-500 text-amber-400 bg-amber-950/40";
      case "HIGH":
        return "animate-flash-red text-white font-bold border border-red-600 shadow-lg shadow-red-500/20";
      default:
        return "border border-slate-600 text-slate-400";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* 1. Header Card & Control Strip */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-lg shadow-amber-500/10">
              <HardHat className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                AI-Powered Construction Site Safety Monitoring Platform
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Automated YOLOv8 PPE Compliance & Risk Engine
              </p>
            </div>
          </div>
          
          {/* Connection status tracker */}
          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
            <Server className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400">Backend Status:</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${
                backendStatus === "connected" ? "bg-emerald-500 animate-pulse" :
                backendStatus === "disconnected" ? "bg-red-500" : "bg-amber-500"
              }`} />
              <span className={`text-xs uppercase tracking-wide font-bold ${
                backendStatus === "connected" ? "text-emerald-400" :
                backendStatus === "disconnected" ? "text-red-400" : "text-amber-400"
              }`}>
                {backendStatus === "checking" ? "Checking..." : backendStatus}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col lg:grid lg:grid-cols-4 gap-6">
        
        {/* Left 3 Columns: Upload, Preview Matrix, and KPI Ribbon */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* 2. Media Control Upload Center */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-amber-500" />
              Media Control Center
            </h2>
            
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${
                dragActive ? "border-amber-500 bg-amber-500/5" : "border-slate-700 hover:border-slate-500 bg-slate-950/50"
              }`}
              onClick={() => document.getElementById("file-input").click()}
            >
              <input 
                id="file-input"
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleFileInput}
              />
              
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
                  <p className="text-sm font-semibold text-slate-300">Processing YOLOv8 Inference & Compliance Engine...</p>
                  <p className="text-xs text-slate-500">Scanning safety gear (Hardhat, Mask, Vest)...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center gap-2">
                  <UploadCloud className="h-12 w-12 text-slate-500 hover:text-amber-500 transition-colors" />
                  <p className="text-sm font-semibold text-slate-300">
                    Drag and drop your construction site photo here, or <span className="text-amber-400 hover:underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-500">Supports JPG, PNG, JPEG formats</p>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 p-3 bg-red-950/50 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </section>

          {/* 4. Executive Safety KPI Badge Ribbon */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-500" />
              Executive Safety KPI Ribbon
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              
              {/* KPI 1: Active Workers */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Workers</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-white">
                    {responseData.detections.Person}
                  </span>
                  <Users className="h-4 w-4 text-sky-400" />
                </div>
                <span className="text-[10px] text-slate-500 mt-1">Detected in site frame</span>
              </div>

              {/* KPI 2: Missing Helmet */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Helmet Violations</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-3xl font-extrabold ${responseData.detections["NO-Hardhat"] > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {responseData.detections["NO-Hardhat"]}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-red-400/80 bg-red-950/40 px-1.5 rounded">NO-Helmet</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1">Missing Hardhat</span>
              </div>

              {/* KPI 3: Missing Vest */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vest Violations</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-3xl font-extrabold ${responseData.detections["NO-Safety Vest"] > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {responseData.detections["NO-Safety Vest"]}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-red-400/80 bg-red-950/40 px-1.5 rounded">NO-Vest</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1">Missing Safety Vest</span>
              </div>

              {/* KPI 4: Missing Mask */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mask Violations</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-3xl font-extrabold ${responseData.detections["NO-Mask"] > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {responseData.detections["NO-Mask"]}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-red-400/80 bg-red-950/40 px-1.5 rounded">NO-Mask</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1">Missing Protection Mask</span>
              </div>

              {/* KPI 5: Site Risk Badge */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between col-span-2 md:col-span-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Risk Assessment</span>
                <div className={`mt-2 py-1.5 px-2.5 rounded-lg text-center font-black text-sm transition-all ${getRiskBadgeStyles(responseData.risk_level)}`}>
                  {responseData.risk_level}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 text-center font-medium">
                  {responseData.total_violations_count} total breaches
                </span>
              </div>

            </div>
          </section>

          {/* 3. Live Image Preview Matrix (Dual-View Grid) */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-amber-500" />
              Live Image Preview Matrix
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Pane: Original Image */}
              <div className="flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Left Pane: Raw Upload</span>
                  <span className="text-[10px] text-slate-500">Unprocessed</span>
                </div>
                <div className="flex-1 min-h-[300px] flex items-center justify-center p-4 relative">
                  {previewUrl ? (
                    <img 
                      src={previewUrl} 
                      alt="Raw upload preview" 
                      className="max-h-[380px] w-auto object-contain rounded-lg shadow"
                    />
                  ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-2">
                      <ImageIcon className="h-10 w-10 text-slate-700" />
                      <p className="text-xs font-semibold uppercase tracking-wider">No input media available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Processed Output */}
              <div className="flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Right Pane: Processed YOLOv8 Frame</span>
                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Inference 0.35</span>
                </div>
                <div className="flex-1 min-h-[300px] flex items-center justify-center p-4 relative">
                  {loading ? (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Reconstructing Tensor Overlay...</span>
                    </div>
                  ) : null}
                  
                  {processedUrl ? (
                    <img 
                      src={processedUrl} 
                      alt="Annotated detection output" 
                      className="max-h-[380px] w-auto object-contain rounded-lg shadow"
                    />
                  ) : (
                    <div className="text-slate-600 flex flex-col items-center gap-2">
                      <ImageIcon className="h-10 w-10 text-slate-700" />
                      <p className="text-xs font-semibold uppercase tracking-wider">Waiting for inference process</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </section>

        </div>

        {/* Right 1 Column: 5. Formatted Safety Officer Inspection Report Panel */}
        <div className="lg:col-span-1">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl h-full flex flex-col">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
              <FileText className="h-5 w-5 text-amber-500" />
              Inspection Office
            </h2>
            
            {/* Clipboard background layout */}
            <div className="flex-1 clipboard-bg rounded-xl p-5 shadow-inner flex flex-col relative overflow-hidden border border-amber-200/50">
              
              {/* Clipboard metal clip illustration */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-700 rounded-b-lg border-x border-b border-slate-600 shadow flex items-center justify-center">
                <div className="w-12 h-1.5 bg-slate-500 rounded-full" />
              </div>
              
              {/* Report contents */}
              <div className="mt-4 flex-1 flex flex-col font-serif">
                <div className="flex justify-between items-center border-b border-slate-300 pb-2 mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-sans font-bold text-slate-500 tracking-wider uppercase">Inspection Code</span>
                    <span className="text-xs font-sans font-extrabold text-slate-800 uppercase tracking-tight">OSHA-PPE-MONITOR</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-sans font-bold text-slate-500 tracking-wider uppercase">Date / Timestamp</span>
                    <span className="text-[10px] font-sans font-bold text-slate-700">
                      {new Date().toISOString().slice(0, 19).replace('T', ' ')}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle className={`h-4 w-4 ${responseData.has_violations ? 'text-red-600' : 'text-emerald-600'}`} />
                  Compliance Report
                </h3>

                {/* Main dynamic report template verbatim output */}
                <p className="text-xs leading-relaxed text-slate-800 bg-white/60 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap flex-1 shadow-inner">
                  {responseData.recommendation}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-300/80 flex items-center justify-between font-sans">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Verification Sign-off</span>
                    <span className="text-[10px] font-bold text-slate-800">AUTOMATED SIGNATURE</span>
                  </div>
                  <div className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                    responseData.risk_level === "LOW" ? "border-emerald-600 text-emerald-800 bg-emerald-50" :
                    responseData.risk_level === "MEDIUM" ? "border-amber-600 text-amber-800 bg-amber-50" :
                    "border-red-600 text-red-800 bg-red-50 animate-pulse"
                  }`}>
                    {responseData.risk_level} RISK
                  </div>
                </div>
              </div>
              
            </div>

            <div className="mt-4 p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              <p className="font-semibold text-slate-300 mb-1">Inference Config</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Confidence: <span className="font-semibold text-amber-500">0.35</span></li>
                <li>Device Map: <span className="font-semibold text-slate-300">CPU Execution</span></li>
                <li>Weights: <span className="font-semibold text-slate-300">best.pt</span></li>
              </ul>
            </div>
          </section>
        </div>

      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 AI-Powered Construction Site Safety Monitoring Platform. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
