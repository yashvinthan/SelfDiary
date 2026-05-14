import React, { useState, useEffect } from "react";
import { X, Mic, Send, ArrowRight, Check, Loader2, Bell, Clock, Calendar as CalendarIcon, Tag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { parseLogInput, StructuredLog } from "../services/gemini";
import { format } from "date-fns";
import { LogEntry } from "../services/excelStorage";

interface AddLogModalProps {
  onClose: () => void;
  onSave: (log: StructuredLog) => void;
  initialData?: LogEntry | null;
}

const defaultStructured = (): StructuredLog => ({
  whom: "",
  place: "",
  mode: "Meeting",
  type: "Text",
  duration: "",
  emotions: "",
  description: "",
  remarks: "",
  eventDate: new Date().toISOString().split("T")[0],
  eventTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
  reminders: [],
});

export default function AddLogModal({ onClose, onSave, initialData }: AddLogModalProps) {
  const [mode, setMode] = useState<"smart" | "step">("smart");
  const [input, setInput] = useState("");
  const [step, setStep] = useState(1);
  const [isParsing, setIsParsing] = useState(false);
  const [structuredData, setStructuredData] = useState<StructuredLog>(() => {
    if (initialData) {
      return {
        whom: initialData.whom || "",
        place: initialData.place || "",
        mode: initialData.mode || "Meeting",
        type: initialData.type || "Text",
        duration: initialData.duration || "",
        emotions: initialData.emotions || "",
        description: initialData.description || "",
        remarks: initialData.remarks || "",
        eventDate: initialData.log_date || new Date().toISOString().split("T")[0],
        eventTime: initialData.log_time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
        reminders: initialData.reminder
          ? [{ title: initialData.reminder, dateTime: new Date().toISOString() }]
          : [],
      };
    }
    return defaultStructured();
  });

  const { isListening, transcript, error: speechError, startListening, setTranscript } = useSpeechRecognition();
  const [activeVoiceField, setActiveVoiceField] = useState<"smart" | "whom" | "place" | "description" | "remarks" | "reminder" | "duration" | "emotions">("smart");
  const [parseError, setParseError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (initialData) {
      setMode("step");
      setStep(6); // Go to review step
    }
  }, [initialData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (transcript) {
      if (activeVoiceField === "smart") {
        setInput(prev => `${prev} ${transcript}`.trim());
      } else if (activeVoiceField === "whom") {
        setStructuredData(prev => ({
          ...prev,
          whom: `${prev.whom || ""} ${transcript}`.trim(),
        }));
      } else if (activeVoiceField === "place") {
        setStructuredData(prev => ({
          ...prev,
          place: `${prev.place || ""} ${transcript}`.trim(),
        }));
      } else if (activeVoiceField === "description") {
        setStructuredData(prev => ({
          ...prev,
          description: `${prev.description} ${transcript}`.trim(),
        }));
      } else if (activeVoiceField === "remarks") {
        setStructuredData(prev => ({
          ...prev,
          remarks: `${prev.remarks || ""} ${transcript}`.trim(),
        }));
      } else if (activeVoiceField === "duration") {
        setStructuredData(prev => ({
          ...prev,
          duration: `${prev.duration || ""} ${transcript}`.trim(),
        }));
      } else if (activeVoiceField === "emotions") {
        setStructuredData(prev => ({
          ...prev,
          emotions: `${prev.emotions || ""} ${transcript}`.trim(),
        }));
      } else if (activeVoiceField === "reminder") {
        setStructuredData(prev => ({
          ...prev,
          reminders: prev.reminders.length > 0 
            ? [{ ...prev.reminders[0], title: `${prev.reminders[0].title} ${transcript}`.trim() }]
            : [{ title: transcript.trim(), dateTime: new Date().toISOString() }],
        }));
      }
      setTranscript("");
    }
  }, [transcript, activeVoiceField, setTranscript]);

  const handleModeSwitch = (newMode: "smart" | "step") => {
    if (mode === "smart" && newMode === "step" && input && !structuredData.description) {
      setStructuredData(prev => ({ ...prev, description: input }));
    }
    setMode(newMode);
    setActiveVoiceField(newMode === "smart" ? "smart" : "description");
    if (newMode === "step") setStep(1);
  };

  const handleSmartSubmit = async () => {
    if (!input.trim()) return;
    setParseError(null);
    setIsParsing(true);
    try {
      const result = await parseLogInput(input);
      setStructuredData(result);
      setMode("step");
      setStep(6); // Go to review
    } catch (err: any) {
      console.error(err);
      setParseError("Local analysis failed. Please try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = () => {
    onSave(structuredData);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 100, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 100, scale: 0.95 }}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 shrink-0">
          <div>
            <h2 className="text-xl font-black text-stone-900 tracking-tight">
              {initialData ? "Edit Log Entry" : "New Log Entry"}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <CalendarIcon size={16} className="text-emerald-600" />
                <p className="text-sm font-black text-emerald-600 uppercase tracking-widest">
                  {format(currentTime, "EEEE, MMMM d, yyyy")}
                </p>
              </div>
              <span className="w-2 h-2 bg-stone-300 rounded-full" />
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-stone-400" />
                <p className="text-xl font-mono font-black text-stone-700 tracking-tighter">
                  {format(currentTime, "HH:mm:ss")}
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-stone-200 rounded-full transition-colors">
            <X size={28} className="text-stone-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Mode toggle — only for new entries before review */}
          {step < 6 && (
            <div className="flex gap-2 mb-6 p-1.5 bg-stone-100 rounded-2xl w-fit">
              <button
                onClick={() => handleModeSwitch("smart")}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  mode === "smart" ? "bg-white text-emerald-600 shadow-md" : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Smart AI
              </button>
              <button
                onClick={() => handleModeSwitch("step")}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                  mode === "step" ? "bg-white text-emerald-600 shadow-md" : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Step-by-Step
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ── SMART MODE ──────────────────────────────────────────────── */}
            {mode === "smart" && step < 6 ? (
              <motion.div
                key="smart-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe your activity, meeting, or event in natural language…"
                    className="w-full h-40 p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none text-stone-800 placeholder:text-stone-400"
                  />
                  <button
                    onClick={() => {
                      setActiveVoiceField("smart");
                      startListening();
                    }}
                    title={isListening ? "Stop listening" : "Start voice input"}
                    className={`absolute bottom-4 right-4 p-3 rounded-full shadow-lg transition-all ${
                      isListening && activeVoiceField === "smart" ? "bg-red-500 text-white animate-pulse" : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    <Mic size={20} />
                  </button>
                </div>

                <button
                  onClick={handleSmartSubmit}
                  disabled={isParsing || !input.trim()}
                  className="w-full py-4 bg-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100"
                >
                  {isParsing ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                  {isParsing ? "Analyzing Locally…" : "Analyze & Structure"}
                </button>
                
                {(speechError || parseError) && (
                  <p className="text-sm text-red-600">
                    {speechError || parseError}
                  </p>
                )}
              </motion.div>

            /* ── STEP 1: Date ──────────────────────────────────────────── */
            ) : step === 1 ? (
              <motion.div key="step-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Step 1 of 5: Event Date</label>
                <input
                  type="date"
                  value={structuredData.eventDate}
                  onChange={(e) => setStructuredData(prev => ({ ...prev, eventDate: e.target.value }))}
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button onClick={() => setStep(2)} className="w-full py-3 bg-stone-900 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                  Next <ArrowRight size={18} />
                </button>
              </motion.div>

            /* ── STEP 2: Time ──────────────────────────────────────────── */
            ) : step === 2 ? (
              <motion.div key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Step 2 of 5: Event Time</label>
                <input
                  type="time"
                  value={structuredData.eventTime}
                  onChange={(e) => setStructuredData(prev => ({ ...prev, eventTime: e.target.value }))}
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-medium">Back</button>
                  <button onClick={() => setStep(3)} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                    Next <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>

            /* ── STEP 3: Whom, Place & Mode ──────────────────────────── */
            ) : step === 3 ? (
              <motion.div key="step-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Step 3 of 5: Event Details</label>
                
                {/* Whom */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Whom or Person</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={structuredData.whom || ""}
                      onChange={(e) => setStructuredData(prev => ({ ...prev, whom: e.target.value }))}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none pr-12"
                      placeholder="Who did you meet?"
                    />
                    <button
                      onClick={() => {
                        setActiveVoiceField("whom");
                        startListening();
                      }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg ${isListening && activeVoiceField === "whom" ? "text-red-500" : "text-stone-400"}`}
                    >
                      <Mic size={20} />
                    </button>
                  </div>
                </div>

                {/* Place */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Place of Event</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={structuredData.place || ""}
                      onChange={(e) => setStructuredData(prev => ({ ...prev, place: e.target.value }))}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none pr-12"
                      placeholder="Where did it happen?"
                    />
                    <button
                      onClick={() => {
                        setActiveVoiceField("place");
                        startListening();
                      }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg ${isListening && activeVoiceField === "place" ? "text-red-500" : "text-stone-400"}`}
                    >
                      <Mic size={20} />
                    </button>
                  </div>
                </div>

                {/* Mode */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Mode of Event</label>
                  <div className="flex flex-wrap gap-2">
                    {["Meeting", "Call", "Email", "WhatsApp", "SMS"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setStructuredData(prev => ({ ...prev, mode: m }))}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                          structuredData.mode === m 
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100" 
                            : "bg-white border-stone-100 text-stone-500 hover:border-stone-200"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Type of Data</label>
                  <div className="flex flex-wrap gap-2">
                    {["Text", "Image", "Audio", "Physical"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setStructuredData(prev => ({ ...prev, type: t }))}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                          structuredData.type === t 
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100" 
                            : "bg-white border-stone-100 text-stone-500 hover:border-stone-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Duration (Dwelling)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={structuredData.duration || ""}
                      onChange={(e) => setStructuredData(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none pr-12"
                      placeholder="e.g. 30 mins, 1 hr"
                    />
                    <button
                      onClick={() => {
                        setActiveVoiceField("duration");
                        startListening();
                      }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg ${isListening && activeVoiceField === "duration" ? "text-red-500" : "text-stone-400"}`}
                    >
                      <Mic size={20} />
                    </button>
                  </div>
                </div>

                {/* Emotions */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Emotions</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={structuredData.emotions || ""}
                      onChange={(e) => setStructuredData(prev => ({ ...prev, emotions: e.target.value }))}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none pr-12"
                      placeholder="e.g. Happy, Stressed"
                    />
                    <button
                      onClick={() => {
                        setActiveVoiceField("emotions");
                        startListening();
                      }}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg ${isListening && activeVoiceField === "emotions" ? "text-red-500" : "text-stone-400"}`}
                    >
                      <Mic size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button onClick={() => setStep(2)} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-medium">Back</button>
                  <button onClick={() => setStep(4)} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                    Next <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>

            /* ── STEP 4: Description + Remarks ────────────────────────── */
            ) : step === 4 ? (
              <motion.div key="step-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Step 4 of 5: Full Description </label>
                <div className="relative">
                  <textarea
                    value={structuredData.description}
                    onChange={(e) => setStructuredData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full h-32 p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Describe the event in detail…"
                  />
                  <button
                    onClick={() => {
                      setActiveVoiceField("description");
                      startListening();
                    }}
                    className={`absolute right-2 bottom-2 p-2 rounded-lg ${isListening && activeVoiceField === "description" ? "text-red-500" : "text-stone-400"}`}
                  >
                    <Mic size={20} />
                  </button>
                </div>
                
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Remarks</label>
                <div className="relative">
                  <textarea
                    value={structuredData.remarks || ""}
                    onChange={(e) => setStructuredData(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full h-24 p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Any additional remarks..."
                  />
                  <button
                    onClick={() => {
                      setActiveVoiceField("remarks");
                      startListening();
                    }}
                    className={`absolute right-2 bottom-2 p-2 rounded-lg ${isListening && activeVoiceField === "remarks" ? "text-red-500" : "text-stone-400"}`}
                  >
                    <Mic size={20} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(3)} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-medium">Back</button>
                  <button onClick={() => setStep(5)} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                    Next <ArrowRight size={18} />
                  </button>
                </div>
                {speechError && (
                  <p className="text-sm text-red-600">{speechError}</p>
                )}
              </motion.div>

            /* ── STEP 5: Reminder ────────────────────────────────────────── */
            ) : step === 5 ? (
              <motion.div key="step-5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Step 5 of 5: Reminder</label>
                <div className="relative">
                  <input
                    type="text"
                    value={structuredData.reminders[0]?.title || ""}
                    onChange={(e) => setStructuredData(prev => ({
                      ...prev,
                      reminders: e.target.value
                        ? [{ title: e.target.value, dateTime: new Date().toISOString() }]
                        : [],
                    }))}
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none pr-12"
                    placeholder="📌 Reminder (optional)"
                  />
                  <button
                    onClick={() => {
                      setActiveVoiceField("reminder");
                      startListening();
                    }}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg ${isListening && activeVoiceField === "reminder" ? "text-red-500" : "text-stone-400"}`}
                  >
                    <Mic size={20} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(4)} className="flex-1 py-3 bg-stone-100 text-stone-600 rounded-xl font-medium">Back</button>
                  <button onClick={() => setStep(6)} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                    Review <Check size={18} />
                  </button>
                </div>
                {speechError && (
                  <p className="text-sm text-red-600">{speechError}</p>
                )}
              </motion.div>

            /* ── STEP 6: Review ────────────────────────────────────────── */
            ) : (
              <motion.div
                key="review"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Event Date</span>
                      <p className="text-sm font-bold text-stone-800">{structuredData.eventDate}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Event Time</span>
                      <p className="text-sm font-bold text-stone-800">{structuredData.eventTime}</p>
                    </div>
                  </div>

                  {(structuredData.whom || structuredData.place || structuredData.mode) && (
                    <div className="grid grid-cols-3 gap-4">
                      {structuredData.whom && (
                        <div>
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Whom</span>
                          <p className="text-sm font-bold text-stone-800">{structuredData.whom}</p>
                        </div>
                      )}
                      {structuredData.place && (
                        <div>
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Place</span>
                          <p className="text-sm font-bold text-stone-800">{structuredData.place}</p>
                        </div>
                      )}
                      {structuredData.mode && (
                        <div>
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Mode</span>
                          <span className="inline-flex px-2 py-0.5 bg-stone-100 text-stone-600 rounded text-[10px] font-black uppercase">
                            {structuredData.mode}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {(structuredData.duration || structuredData.emotions || structuredData.type) && (
                    <div className="grid grid-cols-3 gap-4">
                      {structuredData.type && (
                        <div>
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Type</span>
                          <p className="text-sm font-bold text-stone-800">{structuredData.type}</p>
                        </div>
                      )}
                      {structuredData.duration && (
                        <div>
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Duration</span>
                          <p className="text-sm font-bold text-stone-800">{structuredData.duration}</p>
                        </div>
                      )}
                      {structuredData.emotions && (
                        <div>
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Emotions</span>
                          <p className="text-sm font-bold text-stone-800">{structuredData.emotions}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Description</span>
                    <p className="text-stone-600 leading-relaxed text-sm">{structuredData.description}</p>
                  </div>

                  {structuredData.remarks && (
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Remarks</span>
                      <p className="text-stone-600 leading-relaxed text-sm">{structuredData.remarks}</p>
                    </div>
                  )}

                  {structuredData.reminders.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-1">Reminders</span>
                      <div className="space-y-2">
                        {structuredData.reminders.map((r, i) => (
                          <div key={i} className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                            <Bell size={16} className="text-emerald-600 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-emerald-900">{r.title}</p>
                              <p className="text-[10px] text-emerald-600">
                                {!isNaN(new Date(r.dateTime).getTime()) ? format(new Date(r.dateTime), "PPP p") : r.dateTime}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleSave}
                    className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    <Check size={24} />
                    {initialData ? "Update Log" : "Confirm & Save Log"}
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="w-full py-3 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-colors"
                  >
                    Edit Details
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
