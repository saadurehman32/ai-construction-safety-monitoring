import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
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
  HardHat,
  Send,
  MessageSquare,
  Flame,
  Droplets,
  AlertTriangle,
  Skull
} from "lucide-react";

export default function App() {
  const [backendStatus, setBackendStatus] = useState("checking");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Chatbot states
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Safety compliance & hazard data states
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
    recommendation: "SITE COMPLIANCE STATUS: SECURE. All detected personnel are fully equipped with mandatory protective equipment (Hardhat, Safety Vest, Mask). Current operational conditions meet regulatory site standard parameters. Recommendation: Maintain routine continuous automated monitoring.",
    site_status: "LOW RISK",
    environmental_hazards: {
      fire: false,
      smoke: false,
      water_leak: false,
      chemical_hazard: false
    },
    ai_analysis: ""
  });

  // Auto-scroll chat history to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

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
    setChatHistory([]); // Clear chat logs on new upload
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
      setProcessedUrl(`http://localhost:8000${data.prediction_image_url}`);
    } catch (err) {
      console.error(err);
      setError("Failed to process image with the backend safety engine.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatHistory((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          vision_data: responseData,
          history: chatHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      const data = await response.json();
      setChatHistory((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      console.error(err);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Failed to receive response from Safety Officer. Please verify connection." },
      ]);
    } finally {
      setChatLoading(false);
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

  // Helper for site status styling
  const getSiteStatusStyles = (status) => {
    switch (status) {
      case "CRITICAL EMERGENCY":
        return "animate-pulse text-white font-black border border-rose-500 bg-rose-600/90 shadow-lg shadow-rose-500/50";
      case "HIGH RISK":
        return "animate-flash-red text-white font-bold border border-red-600 shadow-md";
      case "MEDIUM RISK":
        return "border border-amber-500 text-amber-400 bg-amber-950/40";
      case "LOW RISK":
        return "border border-emerald-500 text-emerald-400 bg-emerald-950/40";
      default:
        return "border border-slate-600 text-slate-400";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Blinking Critical Fire Threat Bar */}
      {responseData.environmental_hazards?.fire && (
        <div className="w-full bg-red-600 text-white font-black text-center py-3.5 text-sm md:text-base animate-flash-red tracking-widest border-b-2 border-red-800 shadow-xl flex items-center justify-center gap-2 z-50">
          <span>🚨 CRITICAL THREAT DETECTED: FIRE PROPAGATION ON SITE PERIMETER 🚨</span>
        </div>
      )}

      {/* Header Card & Control Strip */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
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
                Automated YOLOv8 PPE Compliance, Hazard Detection & Conversational Assistant
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

      {/* Main split-pane body layout (70% Left, 30% Right) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Pane (70% width) - Upload Controls, KPI Grid, Image Panel */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* 1. Media Control Upload Center */}
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
                  <p className="text-sm font-semibold text-slate-300">Processing Dual YOLOv8 Inference Engines...</p>
                  <p className="text-xs text-slate-500">Scanning safety gear (conf=0.35) and site hazards (conf=0.254)...</p>
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

          {/* 2. Executive Safety KPI Ribbon */}
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-500" />
              Executive Safety KPI Ribbon
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              
              {/* KPI 1: Active Workers */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Active Workers</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-extrabold text-white">
                    {responseData.detections.Person}
                  </span>
                  <Users className="h-4 w-4 text-sky-400" />
                </div>
                <span className="text-[9px] text-slate-500 mt-1">Detected personnel</span>
              </div>

              {/* KPI 2: Helmet Violations */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Helmet Breaches</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-2xl font-extrabold ${responseData.detections["NO-Hardhat"] > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {responseData.detections["NO-Hardhat"]}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-red-400 bg-red-950/40 px-1 rounded">No-Helmet</span>
                </div>
                <span className="text-[9px] text-slate-500 mt-1">Missing Hardhats</span>
              </div>

              {/* KPI 3: Vest Violations */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Vest Breaches</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-2xl font-extrabold ${responseData.detections["NO-Safety Vest"] > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {responseData.detections["NO-Safety Vest"]}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-red-400 bg-red-950/40 px-1 rounded">No-Vest</span>
                </div>
                <span className="text-[9px] text-slate-500 mt-1">Missing Vests</span>
              </div>

              {/* KPI 4: Mask Violations */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mask Breaches</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className={`text-2xl font-extrabold ${responseData.detections["NO-Mask"] > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {responseData.detections["NO-Mask"]}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-red-400 bg-red-950/40 px-1 rounded">No-Mask</span>
                </div>
                <span className="text-[9px] text-slate-500 mt-1">Missing Masks</span>
              </div>

              {/* KPI 5: PPE Compliance Risk */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">PPE Compliance</span>
                <div className={`mt-2 py-1 rounded text-center font-black text-xs transition-all ${getRiskBadgeStyles(responseData.risk_level)}`}>
                  {responseData.risk_level}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 text-center">
                  {responseData.total_violations_count} breaches
                </span>
              </div>

              {/* NEW KPI 6: Live Site Status */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between col-span-2 md:col-span-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Site Status</span>
                <div className={`mt-2 py-1 rounded text-center font-black text-xs transition-all tracking-tighter ${getSiteStatusStyles(responseData.site_status)}`}>
                  {responseData.site_status}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 text-center font-medium">
                  Priority logic evaluate
                </span>
              </div>

            </div>

            {/* Environmental Threat Indicators Matrix */}
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                responseData.environmental_hazards?.fire 
                  ? "bg-red-950/60 border-red-500 text-red-400 animate-pulse" 
                  : "bg-slate-950/40 border-slate-800 text-slate-500"
              }`}>
                <Flame className="h-4 w-4 shrink-0" />
                <span>Fire: {responseData.environmental_hazards?.fire ? "ACTIVE" : "CLEAR"}</span>
              </div>
              
              <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                responseData.environmental_hazards?.smoke 
                  ? "bg-amber-950/60 border-amber-500 text-amber-400 animate-pulse" 
                  : "bg-slate-950/40 border-slate-800 text-slate-500"
              }`}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Smoke: {responseData.environmental_hazards?.smoke ? "ACTIVE" : "CLEAR"}</span>
              </div>

              <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                responseData.environmental_hazards?.water_leak 
                  ? "bg-blue-950/60 border-blue-500 text-blue-400 animate-pulse" 
                  : "bg-slate-950/40 border-slate-800 text-slate-500"
              }`}>
                <Droplets className="h-4 w-4 shrink-0" />
                <span>Water Leak: {responseData.environmental_hazards?.water_leak ? "ACTIVE" : "CLEAR"}</span>
              </div>

              <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition-all ${
                responseData.environmental_hazards?.chemical_hazard 
                  ? "bg-purple-950/60 border-purple-500 text-purple-400 animate-pulse" 
                  : "bg-slate-950/40 border-slate-800 text-slate-500"
              }`}>
                <Skull className="h-4 w-4 shrink-0" />
                <span>Chemical: {responseData.environmental_hazards?.chemical_hazard ? "ACTIVE" : "CLEAR"}</span>
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
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Right Pane: Processed Frame</span>
                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Dual Inference</span>
                </div>
                <div className="flex-1 min-h-[300px] flex items-center justify-center p-4 relative">
                  {loading ? (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Reconstructing Tensor Overlays...</span>
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

        {/* Right Pane (30% width) - Conversational Assistant Chat Window */}
        <div className="lg:col-span-3">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl h-full flex flex-col min-h-[500px] lg:h-[calc(100vh-140px)] lg:sticky lg:top-[90px]">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2 border-b border-slate-800 pb-3 shrink-0">
              <MessageSquare className="h-5 w-5 text-amber-500" />
              Safety Officer Chat Console
            </h2>

            {/* Conversation/Analysis Display Thread */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 text-xs font-sans scrollbar-thin scrollbar-thumb-slate-800">
              
              {/* Box showing the initial instance analysis report */}
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 shadow-inner">
                <div className="flex items-center gap-1.5 mb-2.5 pb-1 border-b border-slate-800 text-[10px] uppercase font-bold text-amber-500 tracking-wider">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Automatic Safety Assessment Report</span>
                </div>
                
                {responseData.ai_analysis ? (
                  <ReactMarkdown 
                    components={{
                      h3: ({node, ...props}) => <h3 className="text-xs font-black text-amber-400 mt-4 mb-2 border-b border-slate-800 pb-1" {...props} />,
                      p: ({node, ...props}) => <p className="text-slate-300 leading-relaxed my-1.5 text-[11px]" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 my-2 text-slate-300 text-[11px]" {...props} />,
                      li: ({node, ...props}) => <li className="ml-1" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-amber-500 pl-3 my-3 italic bg-slate-950/70 py-2 pr-2 rounded text-slate-300 text-[10px] break-words" {...props} />
                    }}
                  >
                    {responseData.ai_analysis}
                  </ReactMarkdown>
                ) : (
                  <p className="text-slate-500 italic text-center py-6">
                    Upload an image to trigger the YOLOv8 and Groq AI Safety Assessment.
                  </p>
                )}
              </div>

              {/* Chat history messages */}
              {chatHistory.map((msg, index) => (
                <div 
                  key={index}
                  className={`flex flex-col max-w-[90%] p-3.5 rounded-2xl border ${
                    msg.role === "user"
                      ? "ml-auto bg-slate-800 border-slate-700 text-white rounded-tr-none"
                      : "mr-auto bg-slate-950/80 border-slate-800 text-slate-200 rounded-tl-none"
                  }`}
                >
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wide mb-1 select-none">
                    {msg.role === "user" ? "Supervisor" : "AI Construction Safety Officer"}
                  </span>
                  
                  {msg.role === "assistant" ? (
                    <ReactMarkdown
                      components={{
                        h3: ({node, ...props}) => <h3 className="text-xs font-bold text-amber-400 mt-3 mb-1" {...props} />,
                        p: ({node, ...props}) => <p className="text-[11px] leading-relaxed" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-0.5 my-1" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-amber-500 pl-2 my-2 italic bg-slate-950 py-1 pr-1 rounded text-[10px] break-words" {...props} />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              ))}

              {/* Chat loading spinner indicator */}
              {chatLoading && (
                <div className="flex items-center gap-2 text-slate-500 italic pl-1 py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                  <span className="text-[10px]">Officer is analyzing follow-up query...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Submission Console Form */}
            <form onSubmit={handleSendMessage} className="mt-auto border-t border-slate-800 pt-3 shrink-0">
              <div className="flex gap-2 relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={responseData.ai_analysis ? "Ask follow-up questions..." : "Inference required to start chat..."}
                  disabled={!responseData.ai_analysis || chatLoading}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed pr-10 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-amber-500 hover:text-amber-400 disabled:text-slate-700 disabled:cursor-not-allowed transition-colors"
                  title="Send Message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </section>
        </div>

      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-4 mt-8 text-center text-xs text-slate-500 shrink-0">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 AI-Powered Construction Site Safety Monitoring Platform. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
