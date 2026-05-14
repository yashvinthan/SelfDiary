import React from "react";
import { Plus, Calendar, Bell, FileSpreadsheet, RefreshCw, Smartphone, Download, FolderOpen, Key } from "lucide-react";
import { motion } from "motion/react";

interface LayoutProps {
  children: React.ReactNode;
  onAddClick: () => void;
  onExportClick: () => void;
  onSyncClick: () => void;
  onReLinkFolder: () => void;
  hasFolder: boolean;
  isNativeApp?: boolean;
  activeTab: "home" | "logs" | "reminders" | "settings";
  setActiveTab: (tab: "home" | "logs" | "reminders" | "settings") => void;
}

export default function Layout({
  children,
  onAddClick,
  onExportClick,
  onSyncClick,
  onReLinkFolder,
  hasFolder,
  isNativeApp,
  activeTab,
  setActiveTab,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-stone-200 z-30 px-4 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
            <Calendar size={24} />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-base font-bold tracking-tight leading-tight">Diary Assistant</h1>
            <p className="text-[10px] text-stone-400 font-medium uppercase tracking-widest">v3.2 · Local Excel</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Export Excel (Download) */}
          <button
            id="export-excel-btn"
            onClick={onExportClick}
            className="p-2 hover:bg-stone-100 rounded-lg text-stone-600 transition-colors flex items-center gap-1.5"
            title="Export Excel"
          >
            <Download size={20} />
            <span className="text-sm font-medium hidden md:block">Download</span>
          </button>

          {/* Import / Sync */}
          <button
            id="sync-import-btn"
            onClick={onSyncClick}
            className="p-2 hover:bg-stone-100 rounded-lg text-stone-600 transition-colors flex items-center gap-1.5"
            title="Import & Merge Excel"
          >
            <RefreshCw size={20} />
            <span className="text-sm font-medium hidden md:block">Import & Merge</span>
          </button>

          {/* Folder link indicator (hidden on native) */}
          {!isNativeApp && (
            <button
              id="link-folder-btn"
              onClick={onReLinkFolder}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                hasFolder
                  ? "text-emerald-600 hover:bg-emerald-50"
                  : "text-amber-600 hover:bg-amber-50 animate-pulse"
              }`}
              title={hasFolder ? "Storage folder linked — click to change" : "Link save folder"}
            >
              <FolderOpen size={20} />
              <span className="text-sm font-medium hidden md:block">
                {hasFolder ? "Folder" : "Link Folder"}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4 max-w-3xl mx-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-30 px-4 h-16 flex items-center justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <button
          id="nav-home"
          onClick={() => setActiveTab("home")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === "home" ? "text-emerald-600" : "text-stone-400"
          }`}
        >
          <Calendar size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Home</span>
        </button>

        <button
          id="nav-add"
          onClick={onAddClick}
          className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-200 -translate-y-6 active:scale-95 transition-transform"
          title="Add New Log"
        >
          <Plus size={32} />
        </button>

        <button
          id="nav-logs"
          onClick={() => setActiveTab("logs")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === "logs" ? "text-emerald-600" : "text-stone-400"
          }`}
        >
          <FileSpreadsheet size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Logs</span>
        </button>

        <button
          id="nav-reminders"
          onClick={() => setActiveTab("reminders")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === "reminders" ? "text-emerald-600" : "text-stone-400"
          }`}
        >
          <Bell size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Reminders</span>
        </button>

        <button
          id="nav-settings"
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === "settings" ? "text-emerald-600" : "text-stone-400"
          }`}
        >
          <Key size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Settings</span>
        </button>
      </nav>
    </div>
  );
}
