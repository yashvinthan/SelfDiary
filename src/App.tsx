/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Diary Assistant – No login required.
 * All data persists in DiaryAssistant.xlsx via File System Access API.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Layout from "./components/Layout";
import AddLogModal from "./components/AddLogModal";
import { LogCard, ReminderCard } from "./components/Cards";
import LogTable from "./components/LogTable";
import { StructuredLog } from "./services/gemini";
import { AnimatePresence, motion } from "motion/react";
import {
  Search, Plus, Clock, Bell, Download, Upload, FileSpreadsheet,
  Wifi, WifiOff, Smartphone, Monitor, Github, FolderOpen,
  AlertTriangle, CheckCircle, RefreshCw, X, Key,
} from "lucide-react";
import { format } from "date-fns";
import {
  LogEntry, ReminderEntry,
  initStorage, saveLogs, setupStorageAndLoad, loadReminders, saveReminders,
  parseBackupFile, validateExcelSchema, mergeLogs, downloadExcel,
  isFileSystemSupported, getDeviceName, APP_VERSION, EXCEL_FILE_NAME,
  pickAndSaveDirectoryHandle, getElectronStorageInfo,
  selectElectronStorageFolder, getExcelFileName,
} from "./services/excelStorage";
import { Capacitor } from "@capacitor/core";

const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
const isNativeMobile = Capacitor.isNativePlatform();
const isNativeApp = isElectron || isNativeMobile;

// ─── Type for toast notifications ───────────────────────────────────────────
interface Toast {
  id: number;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

let toastCounter = 0;

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  // Storage
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reminders, setReminders] = useState<ReminderEntry[]>([]);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // UI
  const [activeTab, setActiveTab] = useState<"home" | "logs" | "reminders" | "settings">("home");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nickname, setNickname] = useState(localStorage.getItem("DEVICE_NICKNAME") || "");
  const [tempNickname, setTempNickname] = useState(localStorage.getItem("DEVICE_NICKNAME") || "");
  const [profilePic, setProfilePic] = useState(localStorage.getItem("USER_PROFILE_PIC") || "");
  const [apiKey, setApiKey] = useState(localStorage.getItem("GEMINI_API_KEY") || "");
  const [ePath, setEPath] = useState<{folder: string, file: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Toast helpers ───────────────────────────────────────────────────────
  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // ─── Initialize storage on mount ─────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { logs: savedLogs, dirHandle: dh, needsSetup: ns } = await initStorage();
        setLogs(savedLogs);
        setDirHandle(dh);
        setNeedsSetup(ns && isFileSystemSupported());

        const savedReminders = await loadReminders();
        setReminders(savedReminders);

        if (isElectron) {
          const info = await getElectronStorageInfo();
          if (info) setEPath({ folder: info.folder, file: info.file });
        }

        setStorageReady(true);

        if (dh || isNativeApp) {
          showToast("success", `Loaded ${savedLogs.length} log(s) from local native storage`);
        }
      } catch (err) {
        console.error("Storage init failed:", err);
        setStorageError("Failed to initialize storage. Your data may not persist.");
        setStorageReady(true);
      }
    };
    init();
  }, []);

  // ─── Persist logs whenever they change ───────────────────────────────────
  useEffect(() => {
    if (!storageReady) return;
    const persist = async () => {
      try {
        await saveLogs(logs, dirHandle);
      } catch (err: any) {
        if (err?.name === "NoModificationAllowedError") {
          showToast("error", "Excel file is locked by another program. Close it and try again.");
        } else if (err?.name === "NotAllowedError") {
          showToast("warning", "File permission denied. Please grant folder access again.");
          setNeedsSetup(true);
        }
      }
    };
    persist();
  }, [logs, dirHandle, storageReady]);

  // ─── Persist reminders whenever they change ───────────────────────────────
  useEffect(() => {
    if (!storageReady) return;
    saveReminders(reminders).catch(console.error);
  }, [reminders, storageReady]);

  // ─── Live clock & Alarms ──────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      // Check for alarms
      reminders.forEach(reminder => {
        const reminderTime = new Date(reminder.dateTime);
        const diff = reminderTime.getTime() - now.getTime();
        
        // Trigger if within 30 seconds and hasn't been notified (simplified)
        if (diff > 0 && diff < 30000) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Diary Reminder", {
              body: reminder.title,
              icon: "/favicon.ico"
            });
          }
        }
      });
    }, 1000); // Check every second for live clock
    return () => clearInterval(timer);
  }, [reminders]);

  // Request Notification Permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ─── Handle excel export ──────────────────────────────────────────────────
  const handleExcelExport = async () => {
    try {
      const dynamicName = getExcelFileName();
      await downloadExcel(logs, dynamicName);
      showToast("success", `File exported as ${dynamicName}`);
    } catch {
      showToast("error", "Export failed.");
    }
  };

  // ─── Handle folder setup ─────────────────────────────────────────────────
  const handleSetupStorage = async () => {
    try {
      const { dirHandle: dh, logs: loadedLogs } = await setupStorageAndLoad(logs);
      if (dh) {
        setDirHandle(dh);
        setLogs(loadedLogs);
        setNeedsSetup(false);
        showToast("success", `Storage folder linked! ${loadedLogs.length > 0 ? "Existing logs loaded." : "New file created."}`);
      } else {
        showToast("info", "No folder selected. Data is saved in browser storage as fallback.");
        setNeedsSetup(false);
      }
    } catch {
      showToast("error", "Could not link folder. Please try again.");
    }
  };

  // ─── Utility: Sort and Re-index ──────────────────────────────────────────
  const sortAndReindexLogs = useCallback((logsToProcess: LogEntry[]): LogEntry[] => {
    return [...logsToProcess]
      .sort((a, b) => {
        const dateCompare = a.log_date.localeCompare(b.log_date);
        if (dateCompare !== 0) return dateCompare;
        return a.log_time.localeCompare(b.log_time);
      })
      .map((log, index) => ({
        ...log,
        log_id: index + 1
      }));
  }, []);

  // ─── Handle re-link folder ────────────────────────────────────────────────
  const handleReLinkFolder = async () => {
    try {
      if (isElectron) {
        const info = await selectElectronStorageFolder();
        if (info) {
          setEPath({ folder: info.folder, file: info.file });
          showToast("success", "Storage location updated!");
          const loadedLogs = await initStorage(); // Re-init to load from new path
          setLogs(loadedLogs.logs);
        }
        return;
      }

      const { dirHandle: dh, logs: loadedLogs } = await setupStorageAndLoad(logs);
      if (dh) {
        setDirHandle(dh);
        setLogs(loadedLogs);
        setNeedsSetup(false);
        showToast("success", "Folder re-linked and data loaded.");
      }
    } catch {
      showToast("error", "Could not link folder.");
    }
  };

  // ─── Save a new log ───────────────────────────────────────────────────────
  const handleSaveLog = useCallback((data: StructuredLog) => {
    setIsSaving(true);
    const newLog: LogEntry = {
      log_id: 0, // Will be re-indexed
      log_date: data.eventDate,
      log_time: data.eventTime,
      whom: data.whom || "",
      place: data.place || "",
      mode: data.mode || "Meeting",
      type: data.type || "Text",
      duration: data.duration || "",
      emotions: data.emotions || "",
      description: data.description,
      remarks: data.remarks || "",
      reminder: data.reminders[0]?.title || "",
      device_name: getDeviceName(),
      app_version: APP_VERSION,
    };

    setLogs(prev => sortAndReindexLogs([newLog, ...prev]));

    if (data.reminders.length > 0) {
      setReminders(prev => [...data.reminders, ...prev]);
    }

    showToast("success", "Log saved successfully!");
    setTimeout(() => setIsSaving(false), 1000);
  }, [logs, showToast, sortAndReindexLogs]);

  // ─── Import / Backup ─────────────────────────────────────────────────────
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);

    try {
      // Validate schema
      const buffer = await file.arrayBuffer();
      const { valid, reason } = validateExcelSchema(buffer);
      if (!valid) {
        showToast("error", `Invalid file: ${reason}`);
        setIsImporting(false);
        return;
      }

      const importedLogs = await parseBackupFile(file);
      if (importedLogs.length === 0) {
        showToast("warning", "No valid log entries found in the selected file.");
        setIsImporting(false);
        return;
      }

      const merged = mergeLogs(logs, importedLogs);
      const newCount = merged.length - logs.length;

      if (newCount === 0) {
        showToast("info", "All entries in this file already exist in your diary.");
        setIsImporting(false);
        return;
      }

      if (window.confirm(
        `Found ${newCount} new unique log(s) out of ${importedLogs.length} total entries.\n\nMerge them into your diary?`
      )) {
        setLogs(sortAndReindexLogs(merged));
        showToast("success", `Successfully merged ${newCount} new log(s)!`);
      }
    } catch (err) {
      console.error("Import error:", err);
      showToast("error", "Failed to import file. It may be corrupted or in an unsupported format.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Computed values ──────────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return logs.filter(log =>
      log.description.toLowerCase().includes(q) ||
      log.whom?.toLowerCase().includes(q) ||
      log.place?.toLowerCase().includes(q) ||
      log.mode?.toLowerCase().includes(q) ||
      log.type?.toLowerCase().includes(q) ||
      log.emotions?.toLowerCase().includes(q) ||
      log.duration?.toLowerCase().includes(q) ||
      log.remarks.toLowerCase().includes(q) ||
      log.log_date.includes(q)
    );
  }, [logs, searchQuery]);

  const sortedReminders = useMemo(() =>
    [...reminders].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()),
    [reminders]
  );

  const activeReminders = sortedReminders.filter(r => new Date(r.dateTime) > new Date());

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onAddClick={() => setIsAddModalOpen(true)}
      onExportClick={() => {
        const name = getExcelFileName();
        downloadExcel(logs, name);
        showToast("success", `Exporting: ${name}`);
      }}
      onSyncClick={() => fileInputRef.current?.click()}
      onReLinkFolder={handleReLinkFolder}
      hasFolder={!!dirHandle || isNativeApp}
      isNativeApp={isNativeApp}
    >
      {/* ── Toast Notifications ───────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-xs w-full">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={`flex items-center gap-3 p-3 rounded-xl shadow-lg border text-sm font-medium ${
                toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
                toast.type === "error"   ? "bg-red-50 border-red-200 text-red-800" :
                toast.type === "warning" ? "bg-amber-50 border-amber-200 text-amber-800" :
                "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              {toast.type === "success" && <CheckCircle size={16} className="shrink-0" />}
              {toast.type === "error"   && <AlertTriangle size={16} className="shrink-0" />}
              {toast.type === "warning" && <AlertTriangle size={16} className="shrink-0" />}
              {toast.type === "info"    && <RefreshCw size={16} className="shrink-0" />}
              <span className="flex-1">{toast.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Storage Setup Banner ──────────────────────────────────────────── */}
      {storageReady && needsSetup && !isNativeApp && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-3"
        >
          <div className="flex items-center gap-3 text-amber-800">
            <FolderOpen size={20} className="shrink-0" />
            <div>
              <p className="font-bold text-sm">Link a folder to save your diary to Excel</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Select a folder (e.g. Documents/DiaryAssistant) where your data will be saved as <strong>{EXCEL_FILE_NAME}</strong>. This persists even after reinstalling the app.
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSetupStorage}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors"
            >
              <FolderOpen size={16} /> Choose Save Folder
            </button>
            <button
              onClick={() => setNeedsSetup(false)}
              className="px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-50 transition-colors"
            >
              Skip (browser storage only)
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Storage Error Banner ──────────────────────────────────────────── */}
      {storageError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-sm">
          <AlertTriangle size={18} className="shrink-0" />
          {storageError}
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx, .xls"
        onChange={handleExcelImport}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {/* ── HOME TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "home" && (
          <motion.div
            key="home-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Dashboard Header */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative group">
                    {profilePic ? (
                      <img 
                        src={profilePic} 
                        alt="Profile" 
                        className="w-20 h-20 rounded-3xl object-cover border-4 border-emerald-500/10 shadow-lg"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-stone-900 rounded-3xl flex items-center justify-center text-white shrink-0 shadow-lg">
                        <Smartphone size={32} />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Signed in as</p>
                    <p className="text-3xl font-black text-blue-600 tracking-tight">{nickname || getDeviceName()}</p>
                    <p className="text-[10px] text-stone-400 font-bold">DEVICE ID: {getDeviceName()} • App v{APP_VERSION}</p>
                  </div>
                </div>
                <div className="sm:text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-stone-100">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center sm:justify-end gap-1">
                    <Clock size={12} /> Local Machine Time
                  </p>
                  <p className="font-mono text-4xl font-black text-emerald-600 tracking-tighter">{format(currentTime, "HH:mm:ss")}</p>
                  <p className="text-xl text-stone-800 font-medium mt-1 uppercase tracking-tight">
                    <span className="text-blue-600 font-black">{format(currentTime, "EEEE")}</span>, {format(currentTime, "MMMM d, yyyy")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 relative group overflow-hidden">
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Total Logs Recorded</p>
                    <div className="flex items-baseline gap-2">
                       <p className="text-3xl font-bold text-stone-900">{logs.length}</p>
                       <span className="text-[10px] font-black text-stone-400 bg-stone-200 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                         / {logs.filter(l => l.log_date === format(currentTime, "yyyy-MM-dd")).length} Today
                       </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 relative group overflow-hidden">
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Active Reminders</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold text-emerald-700">{activeReminders.length}</p>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-200/50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                        / {activeReminders.filter(r => r.dateTime.startsWith(format(currentTime, "yyyy-MM-dd"))).length} Today
                      </span>
                    </div>
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-200/20 rounded-full blur-2xl"></div>
                </div>

                <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-stone-200 flex items-center justify-center">
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full h-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 active:scale-95"
                  >
                    <Plus size={16} /> Add Task
                  </button>
                </div>
              </div>
            </div>

            {/* TWO COLUMN TODAY VIEW - HIGH DENSITY TABLE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
              {/* Column 1: Today's Events */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Events
                  </h2>
                  <span className="text-[10px] font-bold text-stone-400 uppercase">{format(currentTime, "MMM d")}</span>
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="max-h-[275px] overflow-y-auto custom-scrollbar">
                    {logs.filter(l => l.log_date === format(currentTime, "yyyy-MM-dd")).length > 0 ? (
                      <table className="w-full text-left border-collapse">
                        <tbody className="divide-y divide-stone-100">
                          {logs.filter(l => l.log_date === format(currentTime, "yyyy-MM-dd")).map((log, index) => (
                            <tr key={log.log_id} className="hover:bg-stone-50/50 transition-colors group">
                              <td className="py-2.5 pl-3 pr-1 w-6 align-top">
                                <span className="text-xs font-black text-stone-700 opacity-60 group-hover:opacity-100 transition-opacity">{index + 1}</span>
                              </td>
                              <td className="py-2.5 px-2 w-16 align-top">
                                <span className="text-[10px] font-mono font-bold text-stone-400">{log.log_time}</span>
                              </td>
                              <td className="py-2.5 px-1 align-top">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1 rounded uppercase">{log.mode}</span>
                                    <p className="text-xs font-bold text-stone-800 line-clamp-1">{log.description}</p>
                                  </div>
                                  <p className="text-[9px] text-stone-400">With {log.whom || 'Self'}</p>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-10 border-2 border-dashed border-stone-100 m-4 rounded-3xl flex flex-col items-center justify-center text-center opacity-50">
                         <FileSpreadsheet className="text-stone-300 mb-2" size={32} />
                         <p className="text-[10px] font-bold text-stone-400 uppercase">Empty</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Column 2: Today's Reminders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Reminders
                  </h2>
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="max-h-[275px] overflow-y-auto custom-scrollbar">
                    {activeReminders.filter(r => r.dateTime.startsWith(format(currentTime, "yyyy-MM-dd"))).length > 0 ? (
                      <table className="w-full text-left border-collapse">
                        <tbody className="divide-y divide-stone-100">
                          {activeReminders.filter(r => r.dateTime.startsWith(format(currentTime, "yyyy-MM-dd"))).map((reminder, i) => (
                            <tr key={i} className="hover:bg-emerald-50/20 transition-colors group">
                              <td className="py-2.5 pl-3 pr-1 w-6 align-top">
                                <span className="text-xs font-black text-stone-700 opacity-60 group-hover:opacity-100 transition-opacity">{i + 1}</span>
                              </td>
                              <td className="py-2.5 px-2 w-20 align-top">
                                <span className="text-[10px] font-mono font-bold text-emerald-600">
                                  {format(new Date(reminder.dateTime), "h:mm a")}
                                </span>
                              </td>
                              <td className="py-2.5 px-1 align-top">
                                <p className="text-xs font-bold text-stone-800 line-clamp-1">{reminder.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                   <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">Alert Set</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-10 border-2 border-dashed border-stone-100 m-4 rounded-3xl flex flex-col items-center justify-center text-center opacity-50">
                         <Bell className="text-stone-300 mb-2" size={32} />
                         <p className="text-[10px] font-bold text-stone-400 uppercase">Empty</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── LOGS TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "logs" && (
          <motion.div
            key="logs-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="relative group">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-emerald-600 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by description, category, date…"
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Master Log List</h2>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {filteredLogs.length} Entries
                </span>
              </div>

              {filteredLogs.length > 0 ? (
                <LogTable 
                  logs={filteredLogs} 
                  onEdit={(id) => setEditingLog(logs.find(l => l.log_id === id) || null)}
                  onDelete={(id) => {
                    if (window.confirm("Are you sure you want to delete this log?")) {
                      setLogs(prev => sortAndReindexLogs(prev.filter(l => l.log_id !== id)));
                      showToast("success", "Log deleted and re-indexed.");
                    }
                  }}
                />
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-300">
                    <Search size={32} />
                  </div>
                  <p className="text-stone-400 font-medium font-sans uppercase tracking-widest text-xs">No logs found.</p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
                  >
                    <Plus size={16} /> Add Your First Log
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── REMINDERS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "reminders" && (
          <motion.div
            key="reminders-tab"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest">All Reminders</h2>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                {activeReminders.length} Active
              </span>
            </div>

            <div className="grid gap-4">
              {sortedReminders.length > 0 ? (
                sortedReminders.map((reminder, i) => (
                  <ReminderCard
                    key={i}
                    index={i}
                    {...reminder}
                    onConfirm={(offset) => showToast("success", `Reminder alert set for ${offset} minutes before!`)}
                  />
                ))
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-300">
                    <Bell size={32} />
                  </div>
                  <p className="text-stone-400 font-medium">No reminders set yet.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(isAddModalOpen || editingLog) && (
          <AddLogModal
            initialData={editingLog}
            onClose={() => {
              setIsAddModalOpen(false);
              setEditingLog(null);
            }}
            onSave={(data) => {
              if (editingLog) {
                setLogs(prev => sortAndReindexLogs(prev.map(l => l.log_id === editingLog.log_id ? {
                  ...l,
                  log_date: data.eventDate,
                  log_time: data.eventTime,
                  whom: data.whom || l.whom,
                  place: data.place || l.place,
                  mode: data.mode || l.mode,
                  type: data.type || l.type,
                  duration: data.duration || l.duration,
                  emotions: data.emotions || l.emotions,
                  description: data.description,
                  remarks: data.remarks || l.remarks,
                  reminder: data.reminders[0]?.title || l.reminder,
                } : l)));
                showToast("success", "Log updated and re-sorted!");
              } else {
                handleSaveLog(data);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTab === "settings" && (
          <motion.div
            key="settings-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 pt-4"
          >
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm space-y-6">
              <h2 className="text-xl font-black text-stone-900 tracking-tight">Application Settings</h2>
              
              <div className="space-y-6">
                {/* Profile Image Section */}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Profile Photo (Personal Logo)</label>
                  <div className="flex items-center gap-6 p-4 bg-stone-50 rounded-3xl border border-stone-200">
                    <div className="relative group">
                      {profilePic ? (
                        <img 
                          src={profilePic} 
                          alt="Profile" 
                          className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/20"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-stone-200 rounded-2xl flex items-center justify-center text-stone-400">
                          <Smartphone size={32} />
                        </div>
                      )}
                      <label className="absolute -bottom-2 -right-2 p-1.5 bg-stone-900 text-white rounded-lg cursor-pointer hover:bg-emerald-600 shadow-lg transition-colors">
                        <Upload size={14} />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                const base64 = reader.result as string;
                                setProfilePic(base64);
                                localStorage.setItem("USER_PROFILE_PIC", base64);
                                showToast("success", "Profile picture updated!");
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-stone-800">Your Identity</p>
                      <p className="text-[10px] text-stone-500 leading-tight">This photo appears on your dashboard next to your device nickname.</p>
                      {profilePic && (
                        <button 
                          onClick={() => {
                            setProfilePic("");
                            localStorage.removeItem("USER_PROFILE_PIC");
                            showToast("info", "Profile picture removed.");
                          }}
                          className="text-[10px] font-bold text-red-500 mt-2 hover:underline"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nickname Section */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Device Nickname</label>
                    <input
                      type="text"
                      value={tempNickname}
                      onChange={(e) => setTempNickname(e.target.value)}
                      placeholder="E.g., Krishna, Office..."
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm font-medium"
                    />
                  </div>
                  
                  <button
                    onClick={() => {
                      setNickname(tempNickname);
                      localStorage.setItem("DEVICE_NICKNAME", tempNickname);
                      showToast("success", "Settings confirmed and nickname saved!");
                    }}
                    disabled={tempNickname === nickname}
                    className={`w-full py-3.5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                      tempNickname !== nickname 
                        ? "bg-stone-900 text-white shadow-xl shadow-stone-200 active:scale-95" 
                        : "bg-stone-100 text-stone-300 cursor-not-allowed"
                    }`}
                  >
                    Confirm Nickname Change
                  </button>
                </div>

                {/* Gemini AI Key Section */}
                <div className="space-y-3 pt-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Gemini AI Configuration</label>
                  <div className="p-5 bg-blue-50 border border-blue-100 rounded-3xl space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-600 text-white rounded-xl">
                        <Key size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-blue-900">AI Features Key</h4>
                        <p className="text-[10px] text-blue-600 font-medium">Enable smart log categorization and insights.</p>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setApiKey(val);
                          localStorage.setItem("GEMINI_API_KEY", val);
                        }}
                        placeholder="Enter your Gemini API Key..."
                        className="w-full pl-4 pr-10 py-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-mono"
                      />
                      {apiKey && (
                        <button 
                          onClick={() => {
                            setApiKey("");
                            localStorage.removeItem("GEMINI_API_KEY");
                            showToast("info", "API Key removed.");
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {apiKey ? (
                      <p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle size={10} /> AI Key is configured and active.
                      </p>
                    ) : (
                      <p className="text-[9px] text-stone-400 italic">No key provided. AI features will stay disabled.</p>
                    )}
                  </div>
                </div>

                {/* Storage Info Section */}
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Storage Information</label>
                  <div className="p-4 bg-stone-900 text-stone-100 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-400">File Storage Status:</span>
                      <span className={`text-xs font-bold ${dirHandle || isNativeApp ? "text-emerald-400" : "text-amber-400"}`}>
                        {dirHandle || isNativeApp ? "● Connected" : "● Not Linked"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-400">Main Export Filename:</span>
                      <span className="text-xs font-bold text-stone-800">{getExcelFileName()}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Master Excel Storage Path</span>
                      <div className="bg-stone-900 p-4 rounded-2xl border border-stone-800 shadow-inner group">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Storage Location</span>
                           {isElectron && <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black rounded border border-emerald-500/20">VERIFIED EXE LOCATION</span>}
                        </div>
                        <p className="text-[10px] font-mono text-stone-100 break-all leading-loose bg-stone-950/50 p-3 rounded-xl border border-stone-800">
                          {isElectron ? `${ePath?.folder || "C:\\"} / ${getExcelFileName()}` : `${dirHandle?.name || "Documents"} / ${getExcelFileName()}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={handleReLinkFolder}
                      className="w-full py-4 bg-stone-100 text-stone-800 border border-stone-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 text-sm shadow-sm transition-all active:scale-95"
                    >
                      <FolderOpen size={18} /> {isElectron ? "Select Storage Folder" : "Change Folder"}
                    </button>
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 bg-stone-100 text-stone-800 border border-stone-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-200 text-sm shadow-sm transition-all active:scale-95"
                    >
                      <Download size={18} className="rotate-180" /> Manual File Browse
                    </button>
                  </div>

                  {!isElectron && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl mt-4">
                      <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                        <strong>Browser Security:</strong> In Chrome/Edge, only the folder name is visible. For full system path access (C:\Users\...), please use the **Windows EXE** version of the app.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
