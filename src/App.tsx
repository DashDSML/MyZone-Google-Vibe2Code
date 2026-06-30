import React, { useState, useEffect } from "react";
import {
  Building2,
  LayoutDashboard,
  MessageSquare,
  Camera,
  MapPin,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Speaker,
  Volume2,
  Trash2,
  RefreshCw,
  Award,
  Bell,
  HelpCircle,
  Wrench,
  Shield,
  FileText,
  Smartphone,
  Check,
  ChevronRight,
  Info,
  Paperclip,
  Image,
  Mic
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Report, Broadcast, User as UserType, Department } from "./types";

export default function App() {
  // Navigation & Views
  const [activeTab, setActiveTab] = useState<"resident" | "admin" | "whatsapp">("resident");
  
  // Resident App navigation sub-screens
  const [resScreen, setResScreen] = useState<"report" | "tickets" | "advisories" | "profile">("report");
  
  // State from server
  const [reports, setReports] = useState<Report[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  
  // New Report Form inputs
  const [reportPhoto, setReportPhoto] = useState<string>("");
  const [reportText, setReportText] = useState<string>("");
  const [reportLocation, setReportLocation] = useState({
    lat: 12.9715,
    lng: 77.5944,
    accuracy_meters: 8,
    address_text: "",
    source: "gps" as "gps" | "manual_pin" | "address_typed",
  });
  
  // Triage Choice State (For duplicate detection handling)
  const [duplicateModal, setDuplicateModal] = useState<{
    candidate: Report;
    triage: any;
  } | null>(null);

  // Broadcast Composer inputs
  const [broadcastText, setBroadcastText] = useState<string>("");
  const [broadcastCategory, setBroadcastCategory] = useState<"utility" | "safety" | "general">("utility");
  const [broadcastTargets, setBroadcastTargets] = useState<string[]>(["All"]);

  // Admin Manual Category 6 Triage inputs
  const [triageCategory, setTriageCategory] = useState<string>("1");
  const [triageSeverity, setTriageSeverity] = useState<"low" | "moderate" | "high">("moderate");

  // WhatsApp Sandbox simulator state
  const [whatsappPhone, setWhatsappPhone] = useState<string>("+919811111111");
  const [whatsappInput, setWhatsappInput] = useState<string>("");
  const [whatsappHistory, setWhatsappHistory] = useState<any[]>([]);
  const [whatsappStep, setWhatsappStep] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState<boolean>(false);

  // Speech Recognition States
  const [isListeningResident, setIsListeningResident] = useState<boolean>(false);
  const [isListeningWhatsApp, setIsListeningWhatsApp] = useState<boolean>(false);
  const [isListeningWhatsAppVoiceNote, setIsListeningWhatsAppVoiceNote] = useState<boolean>(false);
  const [residentSrInstance, setResidentSrInstance] = useState<any>(null);
  const [whatsAppSrInstance, setWhatsAppSrInstance] = useState<any>(null);

  // Notification Toast
  const [toast, setToast] = useState<{ text: string; icon: string } | null>(null);

  // Simulation parameters
  const [simOffsetHours, setSimOffsetHours] = useState<number>(0);

  // Load state on mount
  useEffect(() => {
    fetchState();
  }, []);

  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      setReports(data.reports);
      setBroadcasts(data.broadcasts);
      setUsers(data.users);
      setDepartments(data.departments);
      
      // Auto-update selected report if open in detail panel
      if (selectedReport) {
        const updated = data.reports.find((r: Report) => r.report_id === selectedReport.report_id);
        if (updated) setSelectedReport(updated);
      }
    } catch (err) {
      console.error("Error fetching application state", err);
    }
  };

  const showToast = (text: string, icon: string) => {
    setToast({ text, icon });
    setTimeout(() => setToast(null), 3000);
  };

  // Preset report photos for easy simulation testing
  const presetPhotos = [
    { name: "Deep Pothole", url: "/placeholder_pothole.jpg" },
    { name: "Basement Pipe Leak", url: "/placeholder_leak.jpg" },
    { name: "Flickering Light", url: "/placeholder_streetlight.jpg" },
    { name: "Garbage Overflow", url: "/placeholder_ambiguous.jpg" },
  ];

  const handlePresetPhotoSelect = (url: string) => {
    setReportPhoto(url);
    showToast("Simulated photo attached", "camera");
  };

  const handleGPSCapture = () => {
    setReportLocation({
      lat: parseFloat((12.9710 + Math.random() * 0.002).toFixed(5)),
      lng: parseFloat((77.5940 + Math.random() * 0.002).toFixed(5)),
      accuracy_meters: Math.floor(4 + Math.random() * 6),
      address_text: "Block C Pathway, Green Meadows",
      source: "gps",
    });
    showToast("GPS Coordinates captured!", "map-pin");
  };

  // Submit standard report flow
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportPhoto && !reportText) {
      showToast("Please provide either a photo or description.", "alert-triangle");
      return;
    }

    try {
      const res = await fetch("/api/reports/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "u_priya", // प्रिया simulates the active resident
          text: reportText,
          photo: reportPhoto,
          location: reportLocation,
          channel: "app",
        }),
      });
      const data = await res.json();

      if (data.rejected) {
        showToast("Validity Reject: " + data.message, "alert-triangle");
        return;
      }

      if (data.duplicateFound) {
        // Trigger Duplicate Resolution Modal
        setDuplicateModal({
          candidate: data.candidate,
          triage: data.triage,
        });
        showToast("Potential duplicate issue detected!", "info");
      } else {
        showToast(`Report submitted! Ticket #${data.report.report_id}`, "check-circle");
        resetReportForm();
        fetchState();
        setResScreen("tickets");
      }
    } catch (err) {
      console.error(err);
      showToast("Submission failed", "alert-triangle");
    }
  };

  // Solve Duplicate choice (merge vs standalone)
  const resolveDuplicate = async (choice: "merge" | "standalone") => {
    if (!duplicateModal) return;
    try {
      const res = await fetch("/api/reports/confirm-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: choice,
          text: reportText,
          photo: reportPhoto,
          location: reportLocation,
          user_id: "u_priya",
          candidate_id: duplicateModal.candidate.report_id,
          triage: duplicateModal.triage,
        }),
      });
      const data = await res.json();
      if (data.merged) {
        showToast(`Co-signed existing ticket #${duplicateModal.candidate.report_id}`, "check-circle");
      } else {
        showToast(`Submitted standalone ticket #${data.report.report_id}`, "check-circle");
      }
      setDuplicateModal(null);
      resetReportForm();
      fetchState();
      setResScreen("tickets");
    } catch (err) {
      console.error(err);
    }
  };

  const resetReportForm = () => {
    setReportText("");
    setReportPhoto("");
    setReportLocation({
      lat: 12.9715,
      lng: 77.5944,
      accuracy_meters: 8,
      address_text: "",
      source: "gps",
    });
  };

  // Admin action handler (resolved, in_progress, reopen, triage Category 6)
  const handleAdminAction = async (reportId: string, action: string, cat?: string, sev?: string) => {
    try {
      const res = await fetch("/api/reports/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          action,
          category: cat,
          severity: sev,
          admin_id: "u_admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Ticket state updated!`, "check-circle");
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Resident Confirmation handler
  const handleResolutionConfirmation = async (reportId: string, confirmed: boolean) => {
    try {
      const res = await fetch("/api/reports/confirm-resolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          user_id: "u_priya",
          confirmed,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(confirmed ? "Closed! Thanks for confirming." : "Flagged as disputed", confirmed ? "check-circle" : "alert-triangle");
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Worsening Persistence handler
  const handleWorseningFlag = async (reportId: string) => {
    try {
      const res = await fetch("/api/reports/persistence-flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          user_id: "u_priya",
          text: "STILL BROKEN: Report verified as getting worse by user.",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Signalled worsening state to administration", "alert-triangle");
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Reset database state completely
  const handleDatabaseReset = async () => {
    if (confirm("Are you sure you want to reset Green Meadows DB to defaults?")) {
      try {
        const res = await fetch("/api/state/reset", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          setReports(data.state.reports);
          setBroadcasts(data.state.broadcasts);
          setUsers(data.state.users);
          setDepartments(data.state.departments);
          setSelectedReport(null);
          setSimOffsetHours(0);
          showToast("Database restored to seed defaults", "refresh-cw");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Broadcast Sender
  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    try {
      const res = await fetch("/api/broadcasts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sent_by: "u_admin",
          category: broadcastCategory,
          target_wards: broadcastTargets,
          message_text: broadcastText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Civic Broadcast sent to targeted wards!", "speaker");
        setBroadcastText("");
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate advancing time
  const handleAdvanceTime = async (hours: number) => {
    try {
      const res = await fetch("/api/simulate/advance-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      const data = await res.json();
      if (data.success) {
        setSimOffsetHours(prev => prev + hours);
        showToast(`Simulated time advanced +${hours} hours!`, "clock");
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // WhatsApp Sandbox bot interactive messaging
  const sendWhatsAppMessage = async (
    text: string, 
    isMedia: boolean = false, 
    isVoice: boolean = false, 
    customMediaUrl?: string,
    isLocation: boolean = false,
    locationCoords?: { lat: number; lng: number }
  ) => {
    setIsTyping(true);
    try {
      // Simulate user input directly in chat
      const userMsg = {
        sender: "user" as const,
        text: isLocation ? "📍 Location (Simulated GPS)" : (isVoice ? "🎙️ Voice Note (Simulated)" : text),
        timestamp: new Date().toISOString(),
        isVoice,
        isLocation,
        mediaUrl: customMediaUrl || (isMedia ? "/placeholder_leak.jpg" : undefined),
      };
      setWhatsappHistory(prev => [...prev, userMsg]);

      const res = await fetch("/api/whatsapp/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: whatsappPhone,
          message_text: isVoice ? "Simulate speech input: There is an exposed wire near the generator in Block B" : text,
          media_url: customMediaUrl || (isMedia ? "/placeholder_leak.jpg" : undefined),
          is_location: isLocation,
          location_coords: locationCoords,
        }),
      });
      const data = await res.json();
      
      // Simulate typing delay for a natural feel
      setTimeout(() => {
        setIsTyping(false);
        setWhatsappHistory(data.session.history);
        setWhatsappStep(data.session.step);
        fetchState();
      }, 1000);
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };

  const handleResidentVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Web Speech API not supported in this browser.", "info");
      return;
    }

    if (isListeningResident) {
      if (residentSrInstance) {
        try { residentSrInstance.stop(); } catch (e) {}
      }
      setIsListeningResident(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListeningResident(true);
        showToast("Recording speech. Talk now...", "mic");
      };

      recognition.onerror = (event: any) => {
        console.error(event);
        setIsListeningResident(false);
        showToast("Mic blocked in iframe! Please use the 'Iframe Mic Sandbox Fallback' buttons below.", "info");
      };

      recognition.onend = () => {
        setIsListeningResident(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setReportText((prev) => (prev ? prev + " " + transcript : transcript));
        showToast("Resident speech dictated!", "check");
      };

      recognition.start();
      setResidentSrInstance(recognition);
    } catch (err) {
      console.error(err);
      setIsListeningResident(false);
    }
  };

  const handleWhatsAppVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Web Speech API not supported in this browser.", "info");
      return;
    }

    if (isListeningWhatsApp) {
      if (whatsAppSrInstance) {
        try { whatsAppSrInstance.stop(); } catch (e) {}
      }
      setIsListeningWhatsApp(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListeningWhatsApp(true);
        showToast("Dictating message...", "mic");
      };

      recognition.onerror = (event: any) => {
        console.error(event);
        setIsListeningWhatsApp(false);
        showToast("Mic blocked in iframe! Please use the 'Iframe Mic Sandbox Fallback' buttons below.", "info");
      };

      recognition.onend = () => {
        setIsListeningWhatsApp(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setWhatsappInput((prev) => (prev ? prev + " " + transcript : transcript));
        showToast("Speech added to input!", "check");
      };

      recognition.start();
      setWhatsAppSrInstance(recognition);
    } catch (err) {
      console.error(err);
      setIsListeningWhatsApp(false);
    }
  };

  const handleWhatsAppVoiceNoteInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast("Web Speech API not supported in this browser.", "info");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListeningWhatsAppVoiceNote(true);
        showToast("Recording Voice Note. Speak now...", "mic");
      };

      recognition.onerror = (event: any) => {
        console.error(event);
        setIsListeningWhatsAppVoiceNote(false);
        showToast("Mic blocked in iframe! Please use the 'Simulate Voice Note' option in the left panel.", "info");
      };

      recognition.onend = () => {
        setIsListeningWhatsAppVoiceNote(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        sendWhatsAppMessage(transcript, false, true);
        showToast("Voice note sent!", "check");
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListeningWhatsAppVoiceNote(false);
    }
  };

  const handleWhatsAppInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappInput.trim()) return;
    sendWhatsAppMessage(whatsappInput);
    setWhatsappInput("");
  };

  const handleWhatsAppCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      sendWhatsAppMessage("Simulated Custom Photo Evidence", true, false, base64data);
      showToast("Uploaded custom image to WhatsApp sandbox!", "camera");
    };
    reader.readAsDataURL(file);
    setShowAttachmentMenu(false);
  };

  // Initialize WhatsApp session history
  useEffect(() => {
    if (activeTab === "whatsapp" && whatsappHistory.length === 0) {
      setWhatsappHistory([
        {
          sender: "bot",
          text: "Welcome to Green Meadows Civic Reporting Bot.\nTo report a problem (pothole, water leak, broken streetlight, etc.), please send one photo of the issue.",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [activeTab]);

  // SLA Calculation helper
  const getSLAStatus = (report: Report) => {
    if (report.status === "closed" || report.status === "resolved") return { breached: false, label: "Met" };
    
    // SLA formula: submitted_at + (base SLA days * severity multiplier)
    let baseDays = 7;
    switch (report.category) {
      case "1": baseDays = 7; break;
      case "2": baseDays = 2; break;
      case "3": baseDays = 3; break;
      case "4": baseDays = 3; break;
      case "5": baseDays = 14; break;
      default: baseDays = 7; break;
    }

    let multiplier = 1.0;
    if (report.severity === "moderate") multiplier = 1.5;
    if (report.severity === "low") multiplier = 2.0;

    const limitDays = baseDays * multiplier;
    const submittedTime = new Date(report.submitted_at).getTime();
    const deadlineTime = submittedTime + limitDays * 24 * 60 * 60 * 1000;
    const nowTime = Date.now();

    const diffMs = deadlineTime - nowTime;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      return { breached: true, label: `${Math.abs(diffDays)}d over` };
    }
    return { breached: false, label: `${diffDays}d left` };
  };

  const categoryLabels: Record<string, string> = {
    "1": "Roads & Public Infra",
    "2": "Water, Drainage & Sanitation",
    "3": "Electricity & Power",
    "4": "Public Safety & Health",
    "5": "Encroachments & Violations",
    "6": "Category 6 (Admin Review)",
  };

  const statusLabels: Record<string, string> = {
    submitted: "Submitted",
    triaged: "Under review",
    in_progress: "In progress",
    resolved: "Marked resolved",
    closed: "Closed",
    reopened: "Reopened",
  };

  // Compute stats for Community Impact Dashboard
  const reportedCount = reports.length;
  const resolvedCount = reports.filter(r => r.status === "closed").length;
  const openCount = reports.filter(r => r.status !== "closed").length;

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      
      {/* GLOBAL BANNER & METRICS */}
      <div className="bg-ink text-white py-2 px-4 flex justify-between items-center text-xs border-b border-hairline relative z-50">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-teal-brand animate-pulse" />
          <span className="font-mono text-slate-light tracking-wide font-semibold uppercase">Green Meadows Society Node (Active)</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-terracotta" />
            <span className="font-mono font-medium">Simulated Offset: +{simOffsetHours}h</span>
          </div>
          <button 
            onClick={handleDatabaseReset}
            className="flex items-center gap-1.5 bg-red-accent hover:bg-opacity-80 text-white font-semibold px-2.5 py-1 rounded transition"
          >
            <RefreshCw className="w-3 h-3" /> Reset DB
          </button>
        </div>
      </div>

      {/* STICKY HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-hairline px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-ink flex items-center justify-center text-white font-serif font-bold text-xl shrink-0">
            <span>M</span>
          </div>
          <div>
            <h1 style={{ fontFamily: "Georgia, serif" }} className="text-xl font-bold tracking-tight text-ink">MyZone Portal</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-blue mt-0.5">Hyperlocal Civic Triager & Tracker</p>
          </div>
        </div>

        {/* 3-WAY VIEW TOGGLE */}
        <div className="flex bg-white border border-hairline p-1 gap-1">
          <button
            onClick={() => setActiveTab("resident")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "resident" 
                ? "bg-teal-brand text-white" 
                : "text-slate-blue hover:bg-hairline"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Resident App
          </button>
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "admin" 
                ? "bg-teal-brand text-white" 
                : "text-slate-blue hover:bg-hairline"
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Admin Dashboard
          </button>
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "whatsapp" 
                ? "bg-teal-brand text-white" 
                : "text-slate-blue hover:bg-hairline"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Sandbox
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* VIEW 1: RESIDENT MOBILE APP VIEW */}
        {activeTab === "resident" && (
          <div className="flex justify-center items-center py-6">
            <div className="relative w-full max-w-[400px] bg-white rounded-[40px] border-8 border-ink overflow-hidden shadow-2xl flex flex-col min-h-[780px]">
              {/* Speaker & Sensor */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-ink rounded-b-xl z-20 flex justify-center items-center">
                <div className="w-12 h-1 bg-slate-light rounded-full" />
              </div>

              {/* Simulated Phone Content */}
              <div className="flex-1 flex flex-col pt-6 bg-paper overflow-y-auto max-h-[720px] relative">
                
                {/* SUB-SCREEN: REPORT CREATION */}
                {resScreen === "report" && (
                  <div className="flex-1 flex flex-col p-5">
                    <div className="mb-6 pt-2">
                      <p className="text-[10px] font-bold text-slate-blue uppercase tracking-[0.2em]">Block C · Priya Sharma</p>
                      <h2 style={{ fontFamily: "Georgia, serif" }} className="text-2xl font-black text-ink mt-0.5">Report local issue</h2>
                    </div>

                    <form onSubmit={handleReportSubmit} className="flex-1 flex flex-col gap-4">
                      {/* Step Pill */}
                      <div className="self-start flex items-center gap-1.5 border-l-2 border-teal-brand bg-teal-light/50 text-teal-dark font-bold text-[10px] px-2 py-0.5 uppercase tracking-wider">
                        <Camera className="w-3.5 h-3.5" /> Step 1 of 3 — Evidence
                      </div>

                      {/* Photo Capture Simulation */}
                      <label htmlFor="resident-photo-upload" className="border border-line-strong rounded-none p-6 text-center hover:border-teal-brand transition cursor-pointer bg-white relative overflow-hidden group block">
                        <input
                          id="resident-photo-upload"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setReportPhoto(reader.result as string);
                                showToast("Custom photo uploaded successfully!", "camera");
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                        {reportPhoto ? (
                          <div className="relative w-full h-40 rounded-none overflow-hidden bg-black/5">
                            <img src={reportPhoto} alt="Report Attached" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white text-xs font-bold flex items-center gap-1 uppercase tracking-wider">
                                <Camera className="w-4 h-4" /> Change Photo
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Camera className="w-10 h-10 text-slate-blue mb-2 group-hover:scale-105 transition-transform" />
                            <p className="text-xs font-bold uppercase tracking-wider text-ink">Upload Custom Photo</p>
                            <p className="text-[10px] text-muted-grey mt-1">Or select one of the quick presets below</p>
                          </div>
                        )}
                      </label>

                      {/* Presets Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {presetPhotos.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handlePresetPhotoSelect(preset.url)}
                            className={`p-2 rounded-none border text-left text-[11px] font-bold uppercase tracking-wide transition ${
                              reportPhoto === preset.url 
                                ? "bg-teal-light border-teal-brand text-teal-dark" 
                                : "bg-white border-hairline text-ink hover:bg-slate-light"
                            }`}
                          >
                            📸 {preset.name}
                          </button>
                        ))}
                      </div>

                      {/* Step Pill */}
                      <div className="self-start flex items-center gap-1.5 border-l-2 border-teal-brand bg-teal-light/50 text-teal-dark font-bold text-[10px] px-2 py-0.5 uppercase tracking-wider">
                        <FileText className="w-3.5 h-3.5" /> Step 2 of 3 — Description
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-blue uppercase tracking-wider">Explain what's wrong</label>
                          <button
                            type="button"
                            onClick={handleResidentVoiceInput}
                            className={`flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider border transition ${
                              isListeningResident 
                                ? "bg-rose-100 border-rose-500 text-rose-700 animate-pulse" 
                                : "bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100"
                            }`}
                          >
                            <Mic className={`w-3 h-3 ${isListeningResident ? "text-rose-600" : "text-teal-600"}`} />
                            <span>{isListeningResident ? "Listening..." : "Speak Description"}</span>
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={reportText}
                          onChange={(e) => setReportText(e.target.value)}
                          placeholder="Provide details about the issue location, size, and duration..."
                          className="w-full bg-white border border-line-strong rounded-none p-3 text-xs text-ink focus:outline-teal-brand"
                        />

                        {/* Speech Simulation Fallback */}
                        <div className="flex flex-col gap-1.5 p-2 bg-slate-light/60 border border-hairline">
                          <span className="text-[9px] font-bold text-slate-blue uppercase tracking-wider block">🎙️ Iframe Mic Fallback (Tap to simulate spoken issue)</span>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setReportText("The main streetlight in Block C has been flickering constantly and is completely dark at night.");
                                showToast("Simulated speech dictated!", "check");
                              }}
                              className="bg-white border border-hairline hover:bg-teal-light hover:border-teal-brand text-ink text-[9px] font-bold px-2 py-1 rounded-none uppercase tracking-wide transition shadow-sm"
                            >
                              💡 Flicker Light
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReportText("There is heavy water leakage from the overhead pipes in the Block B basement parking space.");
                                showToast("Simulated speech dictated!", "check");
                              }}
                              className="bg-white border border-hairline hover:bg-teal-light hover:border-teal-brand text-ink text-[9px] font-bold px-2 py-1 rounded-none uppercase tracking-wide transition shadow-sm"
                            >
                              💧 Pipe Leak
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReportText("Large pile of loose garbage has accumulated outside Gate 1, attracting stray dogs and flies.");
                                showToast("Simulated speech dictated!", "check");
                              }}
                              className="bg-white border border-hairline hover:bg-teal-light hover:border-teal-brand text-ink text-[9px] font-bold px-2 py-1 rounded-none uppercase tracking-wide transition shadow-sm"
                            >
                              🗑️ Garbage Pile
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Step Pill */}
                      <div className="self-start flex items-center gap-1.5 border-l-2 border-teal-brand bg-teal-light/50 text-teal-dark font-bold text-[10px] px-2 py-0.5 uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5" /> Step 3 of 3 — Locality
                      </div>

                      <div 
                        onClick={handleGPSCapture}
                        className={`flex items-center gap-3 border p-3 rounded-none cursor-pointer transition ${
                          reportLocation.address_text 
                            ? "bg-teal-light border-teal-brand text-teal-dark" 
                            : "bg-white border-line-strong text-ink hover:bg-slate-light"
                        }`}
                      >
                        <MapPin className="w-5 h-5 text-teal-brand flex-shrink-0" />
                        <div className="text-left">
                           <p className="text-xs font-bold">{reportLocation.address_text || "Share current GPS location"}</p>
                           <p className="text-[10px] text-muted-grey mt-0.5">
                            {reportLocation.address_text ? "Source: GPS (Accuracy: 8m)" : "Tap to simulate GPS lock"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 bg-teal-brand hover:bg-teal-dark text-white rounded-none font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition"
                      >
                        <Send className="w-4 h-4" /> Submit Complaint
                      </button>
                    </form>
                  </div>
                )}

                {/* SUB-SCREEN: TICKETS */}
                {resScreen === "tickets" && (
                  <div className="flex-1 flex flex-col p-5">
                    <div className="mb-6 pt-2">
                      <p className="text-[10px] font-bold text-slate-blue uppercase tracking-[0.2em]">Live Tracker</p>
                      <h2 style={{ fontFamily: "Georgia, serif" }} className="text-2xl font-black text-ink mt-0.5">My society dockets</h2>
                    </div>

                    <div className="flex flex-col gap-4">
                      {reports.filter(r => r.user_id === "u_priya").length === 0 ? (
                        <div className="text-center py-12 text-muted-grey border border-dashed border-line-strong rounded-none">
                          <Smartphone className="w-12 h-12 mx-auto stroke-[1.5] mb-2 text-slate-blue" />
                          <p className="text-xs font-bold uppercase tracking-wider text-ink">You haven't filed any complaints yet</p>
                        </div>
                      ) : (
                        reports
                          .filter(r => r.user_id === "u_priya")
                          .map((ticket) => (
                            /* Signature Stamped Ticket Card layout */
                            <div 
                              key={ticket.report_id}
                              className="relative bg-white border border-hairline rounded-none p-5 shadow-sm overflow-hidden"
                            >
                              {/* Left & Right punch holes representing perforated ticket card */}
                              <div className="absolute top-1/2 -left-2 w-4 h-8 bg-paper rounded-full border border-hairline transform -translate-y-1/2" />
                              <div className="absolute top-1/2 -right-2 w-4 h-8 bg-paper rounded-full border border-hairline transform -translate-y-1/2" />
                              
                              <div className="flex justify-between items-start gap-4 mb-3">
                                <div>
                                  <span className="font-mono text-[9px] font-bold text-slate-blue uppercase tracking-widest block">DOCKET #{ticket.report_id}</span>
                                  <h3 style={{ fontFamily: "Georgia, serif" }} className="text-sm font-bold text-ink mt-1 leading-tight">{categoryLabels[ticket.category]}</h3>
                                </div>
                                {/* Rubber Stamp Status Badge */}
                                <div className={`font-serif text-[9px] font-black uppercase border-2 px-2 py-0.5 transform -rotate-6 select-none flex-shrink-0 rounded-none ${
                                  ticket.status === "closed" ? "border-muted-grey text-muted-grey" :
                                  ticket.status === "resolved" ? "border-teal-brand text-teal-brand" :
                                  ticket.status === "in_progress" ? "border-ink text-ink" :
                                  "border-terracotta text-terracotta"
                                }`}>
                                  {statusLabels[ticket.status]}
                                </div>
                              </div>

                              <p className="text-xs text-ink-soft line-clamp-2 mb-3 pr-2 font-medium">
                                "{ticket.text}"
                              </p>

                              {/* Perforated separator line */}
                              <div className="border-t border-dashed border-hairline my-3" />

                              <div className="flex justify-between items-center text-[9px] text-slate-blue font-bold uppercase tracking-wider">
                                <span>{new Date(ticket.submitted_at).toLocaleDateString()}</span>
                                <span className="truncate max-w-[150px]">{ticket.location.address_text}</span>
                              </div>

                              {/* RESOLUTION PROOF FLOW: YES/NO CONFIRMATION IF STATUS IS RESOLVED */}
                              {ticket.status === "resolved" && (
                                <div className="mt-4 bg-terracotta-light/40 border border-terracotta/25 rounded-none p-3 text-center">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-terracotta-dark mb-2">Can you confirm this issue is resolved?</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleResolutionConfirmation(ticket.report_id, true)}
                                      className="flex-1 py-1.5 bg-teal-brand hover:bg-teal-dark text-white rounded-none font-bold uppercase tracking-widest text-[10px] transition"
                                    >
                                      Yes, fixed
                                    </button>
                                    <button
                                      onClick={() => handleResolutionConfirmation(ticket.report_id, false)}
                                      className="flex-1 py-1.5 bg-white border border-red-accent hover:bg-red-light text-red-accent rounded-none font-bold uppercase tracking-widest text-[10px] transition"
                                    >
                                      Still persists
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* PERSISTENCE TRIGGER FOR OPEN REPORTS */}
                              {["submitted", "triaged", "in_progress", "reopened"].includes(ticket.status) && (
                                <div className="mt-3 flex justify-between items-center border-t border-hairline pt-3">
                                  <span className="text-[9px] font-mono font-bold text-slate-blue uppercase tracking-wider">Reports: {ticket.report_count}</span>
                                  <button
                                    onClick={() => handleWorseningFlag(ticket.report_id)}
                                    className="text-[9px] font-bold uppercase tracking-wider text-terracotta-dark bg-terracotta-light/60 hover:bg-opacity-80 px-2.5 py-1 rounded-none border border-[#EBC591] transition flex items-center gap-1"
                                  >
                                    <AlertTriangle className="w-3 h-3" /> Still persists
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-SCREEN: ADVISORIES */}
                {resScreen === "advisories" && (
                  <div className="flex-1 flex flex-col p-5">
                    <div className="mb-6 pt-2">
                      <p className="text-[10px] font-bold text-slate-blue uppercase tracking-[0.2em]">Society Notices</p>
                      <h2 style={{ fontFamily: "Georgia, serif" }} className="text-2xl font-black text-ink mt-0.5">Active Advisories</h2>
                    </div>

                    <div className="flex flex-col gap-3">
                      {broadcasts.length === 0 ? (
                        <p className="text-center text-xs text-muted-grey py-8 border border-dashed border-line-strong rounded-none">No current notices posted</p>
                      ) : (
                        broadcasts.map((b) => (
                          <div 
                            key={b.broadcast_id}
                            className={`border-l-4 rounded-none p-3.5 shadow-sm border ${
                              b.category === "safety" ? "border-red-accent border-l-red-accent bg-red-light/30" :
                              b.category === "utility" ? "border-terracotta border-l-terracotta bg-terracotta-light/30" :
                              "border-slate-blue border-l-slate-blue bg-slate-light/40"
                            }`}
                          >
                            <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-blue">
                              {b.category} • Wards: {b.target_wards.join(", ")}
                            </span>
                            <p className="text-xs font-bold text-ink mt-1.5">{b.message_text}</p>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-grey mt-2">{new Date(b.sent_at).toLocaleTimeString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-SCREEN: GAMIFICATION & PROFILE */}
                {resScreen === "profile" && (
                  <div className="flex-1 flex flex-col p-5">
                    <div className="mb-6 pt-2">
                      <p className="text-[10px] font-bold text-slate-blue uppercase tracking-[0.2em]">My Profile</p>
                      <h2 style={{ fontFamily: "Georgia, serif" }} className="text-2xl font-black text-ink mt-0.5">Priya Sharma</h2>
                    </div>

                    <div className="flex flex-col gap-5">
                      {/* Badge Achievements */}
                      <div>
                        <h3 className="text-[10px] font-bold text-slate-blue uppercase tracking-widest mb-3">Unlocked Badges</h3>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-none bg-white border-2 border-teal-brand text-teal-brand flex items-center justify-center mb-1 transform rotate-[-3deg] shadow-sm">
                              <Award className="w-6 h-6" />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink leading-tight mt-1">First Report</span>
                          </div>
                          
                          <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-none bg-white border-2 border-teal-brand text-teal-brand flex items-center justify-center mb-1 transform rotate-[5deg] shadow-sm">
                              <Award className="w-6 h-6" />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink leading-tight mt-1">5 Reports</span>
                          </div>

                          <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-none bg-white border-2 border-teal-brand text-teal-brand flex items-center justify-center mb-1 transform rotate-[-6deg] shadow-sm">
                              <Award className="w-6 h-6" />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-ink leading-tight mt-1">Verified Resolver</span>
                          </div>

                          <div className="flex flex-col items-center text-center">
                            {/* Locked Badge */}
                            <div className="w-12 h-12 rounded-none bg-white border border-dashed border-line-strong text-muted-grey flex items-center justify-center mb-1 opacity-60">
                              <Award className="w-6 h-6" />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-grey leading-tight mt-1">Locked</span>
                          </div>
                        </div>
                      </div>

                      {/* Community Impact Dashboard (Citizen view - Feature 9, Part B) */}
                      <div className="bg-white border border-hairline rounded-none p-4 shadow-sm">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-blue mb-3 uppercase tracking-widest">
                          <Building2 className="w-4 h-4 text-slate-blue" /> Ward Block C Stat (This Month)
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 bg-slate-light/40 border border-hairline rounded-none">
                            <div style={{ fontFamily: "Georgia, serif" }} className="text-xl font-black text-slate-blue">22</div>
                            <div className="text-[9px] text-muted-grey font-bold uppercase mt-0.5">Reported</div>
                          </div>
                          <div className="text-center p-2 bg-teal-light/40 border border-hairline rounded-none">
                            <div style={{ fontFamily: "Georgia, serif" }} className="text-xl font-black text-teal-brand">17</div>
                            <div className="text-[9px] text-muted-grey font-bold uppercase mt-0.5">Resolved</div>
                          </div>
                          <div className="text-center p-2 bg-terracotta-light/40 border border-hairline rounded-none">
                            <div style={{ fontFamily: "Georgia, serif" }} className="text-xl font-black text-terracotta-dark">5</div>
                            <div className="text-[9px] text-muted-grey font-bold uppercase mt-0.5">Open</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Simulated Phone Tabs Bar */}
              <div className="h-16 border-t border-hairline bg-white flex justify-around items-center px-2 z-10">
                <button
                  onClick={() => setResScreen("report")}
                  className={`flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-all ${
                    resScreen === "report" ? "text-teal-brand" : "text-muted-grey hover:text-ink"
                  }`}
                >
                  <Camera className="w-5 h-5" /> Report
                </button>
                <button
                  onClick={() => setResScreen("tickets")}
                  className={`flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-all ${
                    resScreen === "tickets" ? "text-teal-brand" : "text-muted-grey hover:text-ink"
                  }`}
                >
                  <FileText className="w-5 h-5" /> Tracker
                </button>
                <button
                  onClick={() => setResScreen("advisories")}
                  className={`flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-all ${
                    resScreen === "advisories" ? "text-teal-brand" : "text-muted-grey hover:text-ink"
                  }`}
                >
                  <Bell className="w-5 h-5" /> Notice
                </button>
                <button
                  onClick={() => setResScreen("profile")}
                  className={`flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-all ${
                    resScreen === "profile" ? "text-teal-brand" : "text-muted-grey hover:text-ink"
                  }`}
                >
                  <User className="w-5 h-5" /> Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: ADMIN PORTAL AND QUEUE VIEW */}
        {activeTab === "admin" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT / CENTER QUEUE & DEPARTMENTS PANEL */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* METRICS ROW */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-hairline rounded-none p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-blue uppercase tracking-widest block">Active Queue</span>
                  <span style={{ fontFamily: "Georgia, serif" }} className="text-3xl font-black text-ink mt-1 block">{reports.filter(r => r.status !== "closed").length}</span>
                </div>
                <div className="bg-white border border-hairline rounded-none p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-blue uppercase tracking-widest block">SLA Breaches</span>
                  <span style={{ fontFamily: "Georgia, serif" }} className="text-3xl font-black text-red-accent mt-1 block">
                    {reports.filter(r => getSLAStatus(r).breached).length}
                  </span>
                </div>
                <div className="bg-white border border-hairline rounded-none p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-blue uppercase tracking-widest block">Closed (Month)</span>
                  <span style={{ fontFamily: "Georgia, serif" }} className="text-3xl font-black text-teal-brand mt-1 block">
                    {reports.filter(r => r.status === "closed").length}
                  </span>
                </div>
                <div className="bg-white border border-hairline rounded-none p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-blue uppercase tracking-widest block">Avg Resolution</span>
                  <span style={{ fontFamily: "Georgia, serif" }} className="text-3xl font-black text-ink mt-1 block">
                    3.2<span className="text-xs font-bold text-slate-blue">d</span>
                  </span>
                </div>
              </div>

              {/* PRIMARY TICKET QUEUE */}
              <div className="bg-white border border-hairline rounded-none shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-hairline flex justify-between items-center bg-slate-light/10">
                  <h3 style={{ fontFamily: "Georgia, serif" }} className="text-lg font-black text-ink uppercase tracking-wider">Ticket Triager Queue</h3>
                  <div className="flex gap-1.5">
                    <button className="bg-ink text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-none">All</button>
                    <button className="bg-white text-slate-blue border border-hairline px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-none hover:bg-hairline transition">Red Flag</button>
                    <button className="bg-white text-slate-blue border border-hairline px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-none hover:bg-hairline transition">Category 6</button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-paper border-b border-hairline text-[10px] font-bold text-slate-blue uppercase tracking-wider">
                        <th className="py-3 px-4">Ticket ID</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Severity</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">SLA Deadline</th>
                        <th className="py-3 px-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {reports.map((report) => {
                        const sla = getSLAStatus(report);
                        return (
                          <tr 
                            key={report.report_id}
                            className={`hover:bg-paper/40 transition-colors cursor-pointer ${
                              selectedReport?.report_id === report.report_id ? "bg-slate-light/30" : ""
                            }`}
                            onClick={() => setSelectedReport(report)}
                          >
                            <td className="py-3 px-4">
                              <span style={{ fontFamily: "Georgia, serif" }} className="font-black text-sm block text-ink">#{report.report_id}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-blue block mt-0.5">{report.channel === "whatsapp" ? "💬 WhatsApp" : "📱 App"}</span>
                            </td>
                            <td className="py-3 px-4 text-xs font-bold text-ink">
                              {report.category === "6" ? (
                                <span className="bg-[#EFE7F4] text-[#6B3F8C] border border-[#D5C2E2] px-2 py-0.5 rounded-none text-[9px] font-black uppercase tracking-wider">Category 6</span>
                              ) : (
                                categoryLabels[report.category] || "Unknown"
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {report.severity ? (
                                <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-none border ${
                                  report.severity === "high" ? "bg-red-light border-red-accent text-red-accent" :
                                  report.severity === "moderate" ? "bg-terracotta-light border-terracotta text-terracotta-dark" :
                                  "bg-slate-light border-slate-blue text-slate-blue"
                                }`}>
                                  {report.severity}
                                </span>
                              ) : (
                                <span className="text-muted-grey font-bold">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                                <span className={`w-2 h-2 rounded-full ${
                                  report.status === "closed" ? "bg-muted-grey" :
                                  report.status === "resolved" ? "bg-teal-brand animate-pulse" :
                                  report.status === "in_progress" ? "bg-slate-blue" :
                                  "bg-terracotta"
                                }`} />
                                {statusLabels[report.status]}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-ink-soft">
                              {report.location.address_text}
                            </td>
                            <td className="py-3 px-4">
                              {sla.breached ? (
                                <span className="text-red-accent font-bold text-xs flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" /> {sla.label}
                                </span>
                              ) : (
                                <span className="text-slate-blue text-xs font-bold">{sla.label}</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <ChevronRight className="w-4 h-4 text-slate-blue" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ACTIVE DEPARTMENTS SECTION */}
              <div className="bg-white border border-hairline rounded-none p-5 shadow-sm">
                <h3 style={{ fontFamily: "Georgia, serif" }} className="text-base font-black text-ink uppercase tracking-wider mb-4">Wards Department Assignment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <div key={dept.department_id} className="border border-hairline rounded-none p-4 bg-paper/30">
                      <div className="flex items-center gap-2 mb-2">
                        {dept.department_id === "maint_facilities" ? <Wrench className="w-4 h-4 text-teal-brand" /> :
                         dept.department_id === "security" ? <Shield className="w-4 h-4 text-slate-blue" /> :
                         <Building2 className="w-4 h-4 text-terracotta" />}
                        <h4 className="text-[10px] font-bold text-ink uppercase tracking-widest">{dept.name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-blue font-bold uppercase tracking-wider">
                        Categories: {dept.categories_handled.join(", ")}
                      </p>
                      <div className="flex gap-1.5 mt-3">
                        {dept.members.map((m) => (
                          <div 
                            key={m.user_id}
                            title={m.name}
                            className="w-6 h-6 rounded-none bg-white border border-slate-blue flex items-center justify-center text-[9px] font-black text-slate-blue shadow-sm"
                          >
                            {m.name.split(" ").map(n => n[0]).join("")}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: DETAILS, BROADCAST & SIMULATOR */}
            <div className="flex flex-col gap-6">
              
              {/* DETAILS SIDEBAR COMPONENT */}
              {selectedReport ? (
                <div className="bg-white border border-hairline rounded-none p-5 shadow-sm relative overflow-hidden">
                  {/* Left & Right punch holes for perforated stamp ticket theme */}
                  <div className="absolute top-[180px] -left-2 w-4 h-8 bg-paper rounded-full border border-hairline" />
                  <div className="absolute top-[180px] -right-2 w-4 h-8 bg-paper rounded-full border border-hairline" />

                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[9px] font-mono text-slate-blue font-bold uppercase tracking-widest">TICKET NO #{selectedReport.report_id}</span>
                      <h3 style={{ fontFamily: "Georgia, serif" }} className="text-base font-black text-ink mt-0.5">{categoryLabels[selectedReport.category]}</h3>
                    </div>
                    <button 
                      onClick={() => setSelectedReport(null)}
                      className="text-slate-blue hover:text-ink text-[10px] font-black uppercase tracking-widest"
                    >
                      [ Close ]
                    </button>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Image Preview */}
                    {selectedReport.photos && selectedReport.photos[0] ? (
                      <div className="w-full h-36 rounded-none overflow-hidden bg-black/5 border border-hairline">
                        <img 
                          referrerPolicy="no-referrer"
                          src={selectedReport.photos[0]} 
                          alt="Ticket attached" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    ) : (
                      <div className="w-full h-20 border border-hairline bg-paper flex items-center justify-center rounded-none text-[10px] font-bold text-slate-blue uppercase tracking-wider">
                        No photo attached
                      </div>
                    )}

                    {/* Metadata block */}
                    <div className="bg-white p-3.5 rounded-none text-[11px] flex flex-col gap-2 border border-hairline">
                      <div className="flex justify-between border-b border-hairline pb-1.5">
                        <span className="text-slate-blue font-bold uppercase tracking-wider">Original Reporter:</span>
                        <span className="font-bold text-ink">{selectedReport.user_name}</span>
                      </div>
                      <div className="flex justify-between border-b border-hairline pb-1.5">
                        <span className="text-slate-blue font-bold uppercase tracking-wider">Channel:</span>
                        <span className="font-bold text-ink uppercase">{selectedReport.channel}</span>
                      </div>
                      <div className="flex justify-between border-b border-hairline pb-1.5">
                        <span className="text-slate-blue font-bold uppercase tracking-wider">Input State:</span>
                        <span className="font-bold text-ink">{selectedReport.input_state}</span>
                      </div>
                      <div className="flex justify-between border-b border-hairline pb-1.5">
                        <span className="text-slate-blue font-bold uppercase tracking-wider">Validity Score:</span>
                        <span className="font-mono font-bold text-teal-brand">{(selectedReport.validity_score * 100).toFixed()}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-blue font-bold uppercase tracking-wider">Resolution Source:</span>
                        <span className="font-bold text-ink">{selectedReport.closed_via || "Pending"}</span>
                      </div>
                    </div>

                    {/* Perforated dashed line */}
                    <div className="border-t border-dashed border-hairline my-1" />

                    <p className="text-xs text-ink-soft leading-relaxed font-semibold">
                      "{selectedReport.text}"
                    </p>

                    {/* Gemini Audit Notes */}
                    <div className="bg-[#EFE7F4]/40 border border-[#D5C2E2] rounded-none p-3 text-xs">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-[#6B3F8C] uppercase tracking-wider mb-1">
                        <Info className="w-4 h-4" /> AI Triage Dispatch Audit
                      </div>
                      <p className="text-[11px] text-ink-soft leading-relaxed font-medium">{selectedReport.agent_notes || "AI completed triage dispatch securely."}</p>
                    </div>

                    {/* ADMIN ACTION CONTROLS */}
                    <div className="flex flex-col gap-2 pt-3 border-t border-hairline">
                      <p className="text-[10px] font-bold text-slate-blue uppercase tracking-widest">Resolve Actions</p>
                      
                      {selectedReport.category === "6" ? (
                        /* Manual Triage for Category 6 */
                        <div className="bg-slate-light/40 p-3 rounded-none border border-hairline flex flex-col gap-2">
                          <p className="text-[10px] font-bold text-slate-blue uppercase tracking-wider">Manual Category 6 Dispatch</p>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-muted-grey">Dispatch Target</label>
                            <select 
                              value={triageCategory} 
                              onChange={(e) => setTriageCategory(e.target.value)}
                              className="w-full text-xs p-1.5 rounded-none bg-white border border-hairline font-bold"
                            >
                              <option value="1">Roads & Infra</option>
                              <option value="2">Water & Sanitation</option>
                              <option value="3">Electricity & Power</option>
                              <option value="4">Public Safety & Health</option>
                              <option value="5">Encroachments & Violations</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-muted-grey">Severity Level</label>
                            <div className="flex gap-2">
                              {["low", "moderate", "high"].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setTriageSeverity(s as any)}
                                  className={`flex-1 py-1 rounded-none text-[9px] font-black uppercase tracking-wider border transition ${
                                    triageSeverity === s 
                                      ? "bg-ink border-ink text-white" 
                                      : "bg-white border-hairline text-ink hover:bg-hairline"
                                  }`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAdminAction(selectedReport.report_id, "triage_cat6", triageCategory, triageSeverity)}
                            className="w-full py-2 bg-teal-brand hover:bg-teal-dark text-white rounded-none text-[10px] font-black uppercase tracking-widest transition"
                          >
                            Dispatch Docket
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {selectedReport.status === "triaged" && (
                            <button
                              onClick={() => handleAdminAction(selectedReport.report_id, "in_progress")}
                              className="flex-1 py-2 bg-ink hover:bg-opacity-95 text-white rounded-none font-black text-[10px] uppercase tracking-widest transition"
                            >
                              Mark In Progress
                            </button>
                          )}
                          {["triaged", "in_progress", "reopened"].includes(selectedReport.status) && (
                            <button
                              onClick={() => handleAdminAction(selectedReport.report_id, "resolve")}
                              className="flex-1 py-2 bg-teal-brand hover:bg-teal-dark text-white rounded-none font-black text-[10px] uppercase tracking-widest transition"
                            >
                              Resolve Issue
                            </button>
                          )}
                          {selectedReport.status === "resolved" && selectedReport.resolution_flag === "disputed" && (
                            <button
                              onClick={() => handleAdminAction(selectedReport.report_id, "reopen")}
                              className="w-full py-2 bg-red-accent hover:bg-opacity-95 text-white rounded-none font-black text-[10px] uppercase tracking-widest transition"
                            >
                              Reopen Docket (Disputed!)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-hairline rounded-none p-6 text-center text-muted-grey shadow-sm">
                  <FileText className="w-10 h-10 mx-auto stroke-[1.5] mb-2 text-slate-blue" />
                  <p className="text-xs font-bold uppercase tracking-wider text-ink">Select a ticket</p>
                  <p className="text-[11px] text-slate-blue font-semibold mt-1">Choose an active docket from the left table queue to manage, view audit trails, or resolve.</p>
                </div>
              )}

              {/* SIMULATION TIME MACHINE CONTROLS */}
              <div className="bg-white border border-hairline rounded-none p-5 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-ink mb-3 uppercase tracking-widest">
                  <Clock className="w-4 h-4 text-terracotta" /> SLA Simulation Controls
                </div>
                <p className="text-xs text-muted-grey mb-4 font-semibold">
                  Instantly trigger and test the 48-hour resolution confirmation fallback escalations, notifications, and auto-timeouts.
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleAdvanceTime(24)}
                    className="w-full py-2 bg-white hover:bg-hairline text-ink border border-line-strong rounded-none text-[10px] font-black uppercase tracking-widest transition"
                  >
                    Advance +24 Hours (1 Day)
                  </button>
                  <button
                    onClick={() => handleAdvanceTime(48)}
                    className="w-full py-2 bg-white hover:bg-hairline text-ink border border-line-strong rounded-none text-[10px] font-black uppercase tracking-widest transition"
                  >
                    Advance +48 Hours (Reporter Fallback)
                  </button>
                  <button
                    onClick={() => handleAdvanceTime(96)}
                    className="w-full py-2 bg-white hover:bg-hairline text-ink border border-line-strong rounded-none text-[10px] font-black uppercase tracking-widest transition"
                  >
                    Advance +96 Hours (Reminder)
                  </button>
                  <button
                    onClick={() => handleAdvanceTime(144)}
                    className="w-full py-2 bg-terracotta-light text-terracotta-dark hover:bg-opacity-80 border border-[#EBC591] rounded-none text-[10px] font-black uppercase tracking-widest transition"
                  >
                    Advance +144 Hours (SLA Auto-close)
                  </button>
                </div>
              </div>

              {/* CIVIC BROADCAST COMPOSER */}
              <form onSubmit={handleBroadcastSubmit} className="bg-white border border-hairline rounded-none p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-ink uppercase tracking-widest">
                  <Speaker className="w-4 h-4 text-teal-brand" /> society Broadcast Composer
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-slate-blue uppercase tracking-widest">Advisory Notice Message</label>
                  <textarea
                    rows={2}
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    placeholder="e.g. Utility water shutdown on Wednesday..."
                    className="w-full bg-white border border-line-strong rounded-none p-2.5 text-xs text-ink focus:outline-teal-brand font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-blue uppercase tracking-widest">Category</label>
                    <select
                      value={broadcastCategory}
                      onChange={(e) => setBroadcastCategory(e.target.value as any)}
                      className="text-xs p-2 rounded-none bg-white border border-line-strong focus:outline-teal-brand font-bold"
                    >
                      <option value="utility">Utility</option>
                      <option value="safety">Safety</option>
                      <option value="general">General</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-slate-blue uppercase tracking-widest">Target Wards</label>
                    <select
                      multiple
                      value={broadcastTargets}
                      onChange={(e) => {
                        const options = Array.from((e.target as any).selectedOptions, (o: any) => o.value);
                        setBroadcastTargets(options);
                      }}
                      className="text-xs p-1.5 rounded-none bg-white border border-line-strong focus:outline-teal-brand font-bold h-20"
                    >
                      <option value="All">All Blocks</option>
                      <option value="Block A">Block A</option>
                      <option value="Block B">Block B</option>
                      <option value="Block C">Block C</option>
                      <option value="Block D">Block D</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="py-2.5 bg-ink hover:bg-opacity-95 text-white rounded-none font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition"
                >
                  <Send className="w-4 h-4" /> Dispatch Broadcast
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 3: WHATSAPP SIMULATED ROBOT CHANNEL */}
        {activeTab === "whatsapp" && (
          <div className="flex justify-center items-center py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 max-w-[900px] w-full gap-8">
              
              {/* INTERACTIVE PLAYGROUND GUIDE */}
              <div className="bg-white border border-hairline rounded-none p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 style={{ fontFamily: "Georgia, serif" }} className="text-lg font-black text-ink uppercase tracking-wider mb-3">WhatsApp Triage Sandbox</h3>
                  <p className="text-xs text-muted-grey mb-5 font-semibold leading-relaxed">
                    Test the complete automated WhatsApp bot interface (Feature 11). Simulate user behaviors, photo uploads, speech inputs, and the off-script support commands.
                  </p>

                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-slate-blue uppercase tracking-widest mb-1">Interactive Scenarios</p>
                    <button
                      onClick={() => sendWhatsAppMessage("START")}
                      className="py-2.5 text-left bg-white hover:bg-hairline px-3 border border-hairline rounded-none text-xs font-black uppercase tracking-wider text-ink transition shadow-sm"
                    >
                      1. Reset Bot Chat ("START")
                    </button>
                    <button
                      onClick={() => sendWhatsAppMessage("pothole_leak.jpg", true)}
                      className="py-2.5 text-left bg-white hover:bg-hairline px-3 border border-hairline rounded-none text-xs font-black uppercase tracking-wider text-ink transition shadow-sm"
                    >
                      2. Submit Photo evidence
                    </button>
                    <button
                      onClick={() => sendWhatsAppMessage("Simulation: There is significant water leakage in Block B parking basement", false, true)}
                      className="py-2.5 text-left bg-white hover:bg-hairline px-3 border border-hairline rounded-none text-xs font-black uppercase tracking-wider text-ink transition shadow-sm"
                    >
                      3. Simulate Voice Note
                    </button>
                    <button
                      onClick={() => sendWhatsAppMessage("Block B Basement Parking")}
                      className="py-2.5 text-left bg-white hover:bg-hairline px-3 border border-hairline rounded-none text-xs font-black uppercase tracking-wider text-ink transition shadow-sm"
                    >
                      4. Type Location Block
                    </button>
                    <button
                      onClick={() => {
                        sendWhatsAppMessage("Location shared via WhatsApp", false, false, undefined, true, { lat: 12.9715, lng: 77.5944 });
                        showToast("Shared GPS coordinates via WhatsApp!", "map-pin");
                      }}
                      className="py-2.5 text-left bg-teal-light/40 hover:bg-teal-light/60 px-3 border border-dashed border-teal-brand rounded-none text-xs font-black uppercase tracking-wider text-teal-dark transition shadow-sm flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-teal-brand" />
                        5. Send GPS Location
                      </span>
                    </button>
                    <label
                      className="py-2.5 text-left bg-teal-light/40 hover:bg-teal-light/60 px-3 border border-dashed border-teal-brand rounded-none text-xs font-black uppercase tracking-wider text-teal-dark transition shadow-sm cursor-pointer flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-teal-brand" />
                        6. Upload Custom Photo
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleWhatsAppCustomImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-6 border-t border-hairline pt-4 flex flex-col gap-3">
                  <p className="text-[10px] font-bold text-slate-blue uppercase tracking-widest">Special Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => sendWhatsAppMessage("STATUS #4126")} className="bg-slate-light border border-hairline hover:bg-slate-blue/10 text-slate-blue font-mono text-[10px] font-bold px-2.5 py-1 rounded-none uppercase tracking-wider">
                      STATUS #4126
                    </button>
                    <button onClick={() => sendWhatsAppMessage("HELP")} className="bg-slate-light border border-hairline hover:bg-slate-blue/10 text-slate-blue font-mono text-[10px] font-bold px-2.5 py-1 rounded-none uppercase tracking-wider">
                      HELP
                    </button>
                  </div>
                </div>
              </div>

              {/* SIMULATED PHONE CHAT */}
              <div className="md:col-span-2 w-full max-w-[480px] bg-white border-4 border-ink overflow-hidden shadow-2xl flex flex-col h-[640px] rounded-none">
                {/* Chat header */}
                <div className="bg-[#075E54] text-white p-4 pt-5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-none bg-white border border-white text-[#075E54] flex items-center justify-center font-black text-xs transform -rotate-3 shadow-sm">
                    GM
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">Green Meadows Helpbot</h4>
                    <span className="text-[10px] opacity-80 font-bold uppercase tracking-wide">Online (AI Auto-routing)</span>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 bg-[#E5DDD5] p-4 overflow-y-auto flex flex-col gap-3">
                  {whatsappHistory.map((m, idx) => (
                    <div 
                      key={idx}
                      className={`max-w-[85%] rounded-none p-2.5 text-xs border ${
                        m.sender === "bot" 
                          ? "bg-white border-[#E4ECE9] self-start text-ink shadow-sm" 
                          : "bg-[#DCF8C6] border-[#C3E8A6] self-end text-ink shadow-sm"
                      }`}
                    >
                      {m.isVoice && (
                        <div className="flex items-center gap-2 text-ink-soft mb-1 border-b border-[#075E54]/10 pb-1">
                          <Volume2 className="w-4 h-4 text-[#075E54]" />
                          <span className="italic font-bold text-[9px] uppercase tracking-wider">Voice note received</span>
                        </div>
                      )}
                      {m.mediaUrl && (
                        <div className="mb-2 border border-hairline overflow-hidden max-w-[200px] bg-black/5">
                          <img src={m.mediaUrl} alt="Evidence" className="w-full h-auto object-cover max-h-40" />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap font-semibold leading-relaxed">{m.text}</p>
                      <span className="text-[9px] text-muted-grey text-right block mt-1 font-bold">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="bg-white border border-[#E4ECE9] rounded-none p-2.5 self-start text-xs text-muted-grey shadow-sm italic flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px]">
                      <span className="w-1.5 h-1.5 bg-slate-blue rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-slate-blue rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-slate-blue rounded-full animate-bounce [animation-delay:0.4s]" />
                      Triage in progress...
                    </div>
                  )}
                </div>

                {/* Send action footer */}
                <div className="relative">
                  {showAttachmentMenu && (
                    <div className="absolute bottom-full left-3 bg-white border border-ink p-2 shadow-xl flex flex-col gap-1 z-30 w-52 mb-2">
                      <p className="text-[9px] font-bold text-slate-blue uppercase tracking-widest px-2 py-1 border-b border-hairline">Attach Media</p>
                      
                      <label className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-slate-light cursor-pointer border-b border-hairline pb-1.5">
                        <Camera className="w-3.5 h-3.5 text-teal-brand" />
                        <span>Upload Custom Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleWhatsAppCustomImageUpload}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          sendWhatsAppMessage("Location shared via WhatsApp", false, false, undefined, true, { lat: 12.9715, lng: 77.5944 });
                          setShowAttachmentMenu(false);
                          showToast("Shared GPS coordinates via WhatsApp!", "map-pin");
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-slate-light text-left w-full border-b border-hairline pb-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5 text-teal-brand" />
                        <span>Share GPS Location</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleWhatsAppVoiceNoteInput();
                          setShowAttachmentMenu(false);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-slate-light text-left w-full border-b border-hairline pb-1.5"
                      >
                        <Mic className="w-3.5 h-3.5 text-teal-brand" />
                        <span>Record & Send Voice Note</span>
                      </button>

                      {presetPhotos.map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => {
                            sendWhatsAppMessage(`${preset.name} (Preset Photo)`, true, false, preset.url);
                            setShowAttachmentMenu(false);
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-slate-light text-left w-full"
                        >
                          <Image className="w-3.5 h-3.5 text-slate-blue" />
                          <span>Preset: {preset.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleWhatsAppInputSubmit} className="bg-[#F0F0F0] p-3 flex gap-2 border-t border-hairline items-center">
                    <button
                      type="button"
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      className={`w-10 h-10 rounded-none bg-white hover:bg-hairline text-[#075E54] flex items-center justify-center transition border border-line-strong shadow-sm shrink-0 ${
                        showAttachmentMenu ? "ring-2 ring-[#075E54]" : ""
                      }`}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    
                    <input
                      type="text"
                      value={whatsappInput}
                      onChange={(e) => setWhatsappInput(e.target.value)}
                      placeholder="Type message..."
                      className="flex-1 bg-white border border-line-strong rounded-none px-4 py-2 text-xs text-ink focus:outline-[#075E54] font-semibold h-10"
                    />

                    <button
                      type="button"
                      onClick={handleWhatsAppVoiceInput}
                      className={`w-10 h-10 rounded-none border shadow-sm shrink-0 flex items-center justify-center transition ${
                        isListeningWhatsApp 
                          ? "bg-rose-100 border-rose-500 text-rose-700 animate-pulse" 
                          : "bg-white hover:bg-hairline text-[#075E54] border-line-strong"
                      }`}
                      title="Speech-to-Text Dictation"
                    >
                      <Mic className={`w-4 h-4 ${isListeningWhatsApp ? "text-rose-600" : "text-[#075E54]"}`} />
                    </button>

                    <button 
                      type="submit" 
                      className="w-10 h-10 rounded-none bg-[#075E54] hover:bg-[#128C7E] text-white flex items-center justify-center transition border border-[#075E54] shadow-sm shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>

                  {/* WhatsApp Speech Sandbox Fallback */}
                  <div className="bg-[#DFD3C3] p-2.5 flex flex-col gap-1 border-t border-hairline">
                    <span className="text-[9px] font-bold text-[#075E54] uppercase tracking-wider block">🎙️ WhatsApp Speech Fallback (Tap to dictate)</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsappInput("I want to report a broken streetlight near Block A main road.");
                          showToast("Simulated WhatsApp Speech Dictated", "check-circle");
                        }}
                        className="bg-white hover:bg-teal-light border border-hairline text-ink text-[9px] font-bold px-2 py-0.5 rounded-none uppercase tracking-wide transition shadow-sm"
                      >
                        💡 Streetlight
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsappInput("The water pressure is very low and water is brown in Block D.");
                          showToast("Simulated WhatsApp Speech Dictated", "check-circle");
                        }}
                        className="bg-white hover:bg-teal-light border border-hairline text-ink text-[9px] font-bold px-2 py-0.5 rounded-none uppercase tracking-wide transition shadow-sm"
                      >
                        💧 Brown Water
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsappInput("There is dog poop all over the Block B garden entrance.");
                          showToast("Simulated WhatsApp Speech Dictated", "check-circle");
                        }}
                        className="bg-white hover:bg-teal-light border border-hairline text-ink text-[9px] font-bold px-2 py-0.5 rounded-none uppercase tracking-wide transition shadow-sm"
                      >
                        🐕 Dog Waste
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* DUPLICATE MODAL CHANNELS */}
      <AnimatePresence>
        {duplicateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-none border border-hairline max-w-lg w-full p-6 shadow-2xl relative"
            >
              <h3 style={{ fontFamily: "Georgia, serif" }} className="text-lg font-black text-ink uppercase tracking-wider mb-2">Duplicate Incident Alert</h3>
              <p className="text-xs text-muted-grey mb-4 font-semibold">
                Our AI Triage system has mapped your new description to an active incident ticket nearby. Please let us know if this is the same issue.
              </p>

              {/* Pre-existing candidate ticket details */}
              <div className="bg-white p-4 rounded-none border border-hairline mb-5 relative overflow-hidden">
                <div className="absolute top-1/2 -left-2 w-4 h-8 bg-paper rounded-full border border-hairline transform -translate-y-1/2" />
                <div className="absolute top-1/2 -right-2 w-4 h-8 bg-paper rounded-full border border-hairline transform -translate-y-1/2" />

                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-blue uppercase tracking-widest">EXISTING DISPATCH #{duplicateModal.candidate.report_id}</span>
                    <h4 style={{ fontFamily: "Georgia, serif" }} className="text-sm font-black text-ink mt-1 leading-tight">{categoryLabels[duplicateModal.candidate.category]}</h4>
                  </div>
                  <span className="text-[9px] font-serif font-black uppercase border-2 px-2 py-0.5 transform -rotate-3 select-none rounded-none border-terracotta text-terracotta bg-white">
                    {statusLabels[duplicateModal.candidate.status]}
                  </span>
                </div>
                <p className="text-xs text-ink-soft italic font-medium">"{duplicateModal.candidate.text}"</p>
                <div className="mt-3 text-[9px] text-slate-blue font-bold uppercase tracking-wider flex justify-between border-t border-hairline pt-3">
                  <span>Loc: {duplicateModal.candidate.location.address_text}</span>
                  <span>Co-signers: {duplicateModal.candidate.report_count}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => resolveDuplicate("merge")}
                  className="flex-1 py-3 bg-teal-brand hover:bg-teal-dark text-white rounded-none font-black text-xs uppercase tracking-widest transition"
                >
                  Yes, Same Issue (Co-sign)
                </button>
                <button
                  onClick={() => resolveDuplicate("standalone")}
                  className="flex-1 py-3 bg-white border border-line-strong hover:bg-hairline text-ink rounded-none font-black text-xs uppercase tracking-widest transition"
                >
                  No, Standalone Ticket
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GLOBAL NOTIFICATION TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-ink text-white px-5 py-3 rounded-none text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-2xl z-50 border border-hairline"
          >
            {toast.icon === "check-circle" && <CheckCircle2 className="w-4 h-4 text-teal-light" />}
            {toast.icon === "alert-triangle" && <AlertTriangle className="w-4 h-4 text-terracotta" />}
            {toast.icon === "camera" && <Camera className="w-4 h-4 text-slate-light" />}
            {toast.icon === "map-pin" && <MapPin className="w-4 h-4 text-slate-light" />}
            {toast.icon === "clock" && <Clock className="w-4 h-4 text-terracotta" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
