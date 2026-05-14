/**
 * Excel Storage Service
 * A unified robust storage manager handling Native Windows (Electron), Native Mobile (Capacitor),
 * and standard Web environments for Diary Assistant.
 */

import { utils, write, read } from "xlsx";
import { format } from "date-fns";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// ─── Constants ───────────────────────────────────────────────────────────────
export const APP_NAME = "DiaryAssistant";
export const APP_VERSION = "3.2.0";
export const SHEET_NAME = "Logs";

export function getExcelFileName() {
  const nick = typeof window !== "undefined" ? (localStorage.getItem("DEVICE_NICKNAME") || "User") : "User";
  const now = new Date();
  const dateStr = format(now, "yyyy-MM-dd");
  const timeStr = format(now, "HH-mm");
  return `${nick}_DiaryAssistant_${dateStr}_${timeStr}.xlsx`;
}

export const EXCEL_FILE_NAME = "DiaryAssistant.xlsx"; // Base name helper

const IDB_DB_NAME = "DiaryAssistant_Storage";
const IDB_STORE_NAME = "fs_handles";
const IDB_DIR_HANDLE_KEY = "dir_handle";
const IDB_LOGS_KEY = "cached_logs";
const IDB_REMINDERS_KEY = "cached_reminders";

// ─── Platform Detection ──────────────────────────────────────────────────────
const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
const isNativeMobile = Capacitor.isNativePlatform();

// ─── Schema ──────────────────────────────────────────────────────────────────
export interface LogEntry {
  log_id: number;
  log_date: string;
  log_time: string;
  whom: string;
  place: string;
  mode: string;
  type: string;
  duration: string;
  emotions: string;
  description: string;
  remarks: string;
  reminder: string;
  device_name: string;
  app_version: string;
}

export interface ReminderEntry {
  title: string;
  dateTime: string;
}

// ─── IndexedDB Helpers ────────────────────────────────────────────────────────
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 2);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const req = tx.objectStore(IDB_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const req = tx.objectStore(IDB_STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Device Name ─────────────────────────────────────────────────────────────
export function getDeviceName(): string {
  const customNickname = localStorage.getItem("DEVICE_NICKNAME");
  if (customNickname) return customNickname;

  if (isElectron) return "Windows (Local)";
  if (isNativeMobile) return Capacitor.getPlatform() === "ios" ? "iOS (Local)" : "Android (Local)";
  
  if (typeof window === "undefined") return "Node Server";
  const ua = window.navigator.userAgent;
  if (/android/i.test(ua)) return "Android Device";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS (Web)";
  if (/win/i.test(ua)) return "Windows (Web)";
  if (/mac/i.test(ua)) return "Mac (Web)";
  return "Unknown Device";
}

// ─── Excel Parsing Helpers ──────────────────────────────────────────────────────
function logsToExcelRows(logs: LogEntry[]) {
  return logs.map(log => ({
    "Log Number": log.log_id,
    "Date of Event": log.log_date,
    "Time of Event": log.log_time,
    "Whom/Person": log.whom,
    "Place of Event": log.place,
    "Mode of Event": log.mode,
    "Type": log.type,
    "Duration": log.duration,
    "Emotions": log.emotions,
    "Full Description Input": log.description,
    "Remarks": log.remarks,
    "Reminder": log.reminder,
    "Device_Name": log.device_name,
    "App_Version": log.app_version,
  }));
}

function rowsToLogs(rows: Record<string, unknown>[]): LogEntry[] {
  return rows
    .filter(row => row["Log Number"] !== undefined || row["Log_ID"] !== undefined || row["Description"] || row["Full Description Input"])
    .map((row, idx) => ({
      log_id: Number(row["Log Number"] || row["Log_ID"]) || idx + 1,
      log_date: String(row["Date of Event"] || row["Log Date"] || ""),
      log_time: String(row["Time of Event"] || row["Log Time"] || ""),
      whom: String(row["Whom/Person"] || ""),
      place: String(row["Place of Event"] || ""),
      mode: String(row["Mode of Event"] || row["Category"] || ""),
      type: String(row["Type"] || ""),
      duration: String(row["Duration"] || row["Time - Dwelling"] || ""),
      emotions: String(row["Emotions"] || ""),
      description: String(row["Full Description Input"] || row["Description"] || ""),
      remarks: String(row["Remarks"] || row["Remarks/Reminder"] || ""),
      reminder: String(row["Reminder"] || ""),
      device_name: String(row["Device_Name"] || getDeviceName()),
      app_version: String(row["App_Version"] || APP_VERSION),
    }));
}

function buildWorkbook(logs: LogEntry[]): ArrayBuffer {
  const ws = utils.json_to_sheet(logsToExcelRows(logs), {
    header: ["Log Number", "Date of Event", "Time of Event", "Whom/Person", "Place of Event", "Mode of Event", "Type", "Duration", "Emotions", "Full Description Input", "Remarks", "Reminder", "Device_Name", "App_Version"]
  });

  ws["!cols"] = [
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 20 },
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 50 }, { wch: 30 }, 
    { wch: 30 }, { wch: 14 }, { wch: 12 }
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, SHEET_NAME);
  return write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function parseWorkbook(buffer: ArrayBuffer | Uint8Array): LogEntry[] {
  try {
    const wb = read(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), { type: "array" });
    const sheetName = wb.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = utils.sheet_to_json(ws) as Record<string, unknown>[];
    return rowsToLogs(rows);
  } catch {
    return [];
  }
}

// ─── Native Conversion Helpers ───────────────────────────────────────────────
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

// ─── Web Fallback API ─────────────────────────────────────────────────────────
export function isFileSystemSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function pickAndSaveDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (isNativeMobile || isElectron) return null; // Native tools bypass this.

  try {
    const dirHandle = await (window as any).showDirectoryPicker({
      id: APP_NAME,
      mode: "readwrite",
      startIn: "documents",
    }) as FileSystemDirectoryHandle;
    await idbSet(IDB_DIR_HANDLE_KEY, dirHandle);
    return dirHandle;
  } catch {
    return null;
  }
}

async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (isNativeMobile || isElectron) return null;
  try {
    const handle = await idbGet<FileSystemDirectoryHandle>(IDB_DIR_HANDLE_KEY);
    if (!handle) return null;
    const perm = await (handle as any).queryPermission({ mode: "readwrite" });
    if (perm === "granted") return handle;
    const req = await (handle as any).requestPermission({ mode: "readwrite" });
    return req === "granted" ? handle : null;
  } catch {
    return null;
  }
}

// ─── Core Storage Engine ─────────────────────────────────────────────────────

async function writeExcelFile(dirHandle: FileSystemDirectoryHandle | null, logs: LogEntry[]): Promise<void> {
  const buffer = buildWorkbook(logs);

  if (isElectron) {
    await (window as any).electronAPI.writeExcel(buffer);
    return;
  }

  if (isNativeMobile) {
    const base64 = arrayBufferToBase64(buffer);
    await Filesystem.writeFile({
      path: `DiaryAssistant/${EXCEL_FILE_NAME}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true
    });
    return;
  }

  // Web Fallback
  if (dirHandle) {
    const fileName = getExcelFileName();
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(buffer);
    await writable.close();
  }
}

async function findLatestDiaryFile(dirHandle: FileSystemDirectoryHandle): Promise<FileSystemFileHandle | null> {
  let latestHandle: FileSystemFileHandle | null = null;
  let latestTime = 0;
  
  // Scans for files matching Nickname_DiaryAssistant_... pattern
  for await (const entry of (dirHandle as any).values()) {
    if (entry.kind === 'file' && entry.name.includes('_DiaryAssistant_')) {
      const file = await entry.getFile();
      if (file.lastModified > latestTime) {
        latestTime = file.lastModified;
        latestHandle = entry;
      }
    }
  }
  
  // Fallback to stable Master name if no timestamped version exists
  if (!latestHandle) {
     try { return await dirHandle.getFileHandle(EXCEL_FILE_NAME); } catch { return null; }
  }
  
  return latestHandle;
}

async function readExcelFile(dirHandle: FileSystemDirectoryHandle | null): Promise<LogEntry[]> {
  if (isElectron) {
    try {
       const u8Array: Uint8Array | null = await (window as any).electronAPI.readExcel();
       if (u8Array) return parseWorkbook(u8Array);
       return [];
    } catch { return []; }
  }

  if (isNativeMobile) {
    try {
      const res = await Filesystem.readFile({
        path: `DiaryAssistant/${EXCEL_FILE_NAME}`,
        directory: Directory.Documents
      });
      return parseWorkbook(base64ToUint8Array(res.data as string));
    } catch { return []; }
  }

  // Web Fallback (Scans for most recent snapshot)
  if (!dirHandle) return [];
  try {
    const fileHandle = await findLatestDiaryFile(dirHandle);
    if (!fileHandle) return [];
    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();
    return parseWorkbook(buffer);
  } catch {
    return [];
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function initStorage(): Promise<{
  logs: LogEntry[];
  dirHandle: FileSystemDirectoryHandle | null;
  needsSetup: boolean;
}> {
  // If native platform, we completely bypass setup prompts
  if (isElectron || isNativeMobile) {
    const logs = await readExcelFile(null);
    await idbSet(IDB_LOGS_KEY, logs);
    return { logs, dirHandle: null, needsSetup: false };
  }

  // Pure Web
  if (!isFileSystemSupported()) {
    const cached = await idbGet<LogEntry[]>(IDB_LOGS_KEY);
    return { logs: cached ?? [], dirHandle: null, needsSetup: false };
  }

  const dirHandle = await getSavedDirectoryHandle();
  if (!dirHandle) {
    const cached = await idbGet<LogEntry[]>(IDB_LOGS_KEY);
    return { logs: cached ?? [], dirHandle: null, needsSetup: true };
  }

  const logs = await readExcelFile(dirHandle);
  await idbSet(IDB_LOGS_KEY, logs);
  return { logs, dirHandle, needsSetup: false };
}

export async function saveLogs(logs: LogEntry[], dirHandle: FileSystemDirectoryHandle | null): Promise<void> {
  await idbSet(IDB_LOGS_KEY, logs);
  if (isElectron || isNativeMobile || dirHandle) {
    await writeExcelFile(dirHandle, logs);
  }
}

export async function setupStorageAndLoad(currentLogs: LogEntry[]): Promise<{dirHandle: FileSystemDirectoryHandle | null, logs: LogEntry[]}> {
  if (isElectron || isNativeMobile) {
    await writeExcelFile(null, currentLogs);
    return { dirHandle: null, logs: currentLogs };
  }

  const dirHandle = await pickAndSaveDirectoryHandle();
  if (dirHandle) {
    const loadedLogs = await readExcelFile(dirHandle);
    if (loadedLogs.length > 0) {
      return { dirHandle, logs: loadedLogs };
    } else {
      await writeExcelFile(dirHandle, currentLogs);
      return { dirHandle, logs: currentLogs };
    }
  }

  return { dirHandle: null, logs: currentLogs };
}

export async function loadReminders(): Promise<ReminderEntry[]> {
  const cached = await idbGet<ReminderEntry[]>(IDB_REMINDERS_KEY);
  return cached ?? [];
}

export async function saveReminders(reminders: ReminderEntry[]): Promise<void> {
  await idbSet(IDB_REMINDERS_KEY, reminders);
}

// ─── Import / Diagnostics ────────────────────────────────────────────────────
export function validateExcelSchema(buffer: ArrayBuffer): { valid: boolean; reason?: string } {
  try {
    const wb = read(new Uint8Array(buffer), { type: "array" });
    const sheetName = wb.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : wb.SheetNames[0];
    if (!sheetName) return { valid: false, reason: "Excel file has no sheets." };
    const ws = wb.Sheets[sheetName];
    const rows = utils.sheet_to_json(ws) as Record<string, unknown>[];
    if (rows.length === 0) return { valid: true };
    const firstRow = rows[0];
    const requiredCols = ["Log Date", "Description"];
    for (const col of requiredCols) {
      if (!(col in firstRow)) {
        if (col === "Log Date" && !("Date of event" in firstRow)) {
          return { valid: false, reason: `Missing required column: "${col}"` };
        }
      }
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "File appears to be corrupted or is not a valid Excel file." };
  }
}

export async function parseBackupFile(file: File): Promise<LogEntry[]> {
  const buffer = await file.arrayBuffer();
  const wb = read(new Uint8Array(buffer), { type: "array" });
  const sheetName = wb.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = utils.sheet_to_json(ws) as Record<string, unknown>[];

  return rows.map((row, idx) => {
    const isLegacy = "Date of event" in row || "Whom I met" in row;
    if (isLegacy) {
      return {
        log_id: Number(row["Sno"]) || idx + 1,
        log_date: String(row["Date of event"] || ""),
        log_time: String(row["Time of Event"] || ""),
        whom: String(row["Whom I met"] || ""),
        place: String(row["Place"] || ""),
        mode: "Meeting",
        type: "Text",
        duration: "",
        emotions: "",
        description: String(row["Full Description"] || ""),
        remarks: String(row["Remarks/Reminder"] || ""),
        reminder: "",
        device_name: getDeviceName(),
        app_version: APP_VERSION,
      };
    }
    return {
      log_id: Number(row["Log Number"] || row["Log_ID"]) || idx + 1,
      log_date: String(row["Date of Event"] || row["Log Date"] || ""),
      log_time: String(row["Time of Event"] || row["Log Time"] || ""),
      whom: String(row["Whom/Person"] || ""),
      place: String(row["Place of Event"] || ""),
      mode: String(row["Mode of Event"] || row["Category"] || ""),
      type: String(row["Type"] || ""),
      duration: String(row["Duration"] || ""),
      emotions: String(row["Emotions"] || ""),
      description: String(row["Full Description Input"] || row["Description"] || ""),
      remarks: String(row["Remarks"] || row["Remarks/Reminder"] || ""),
      reminder: String(row["Reminder"] || ""),
      device_name: String(row["Device_Name"] || getDeviceName()),
      app_version: String(row["App_Version"] || APP_VERSION),
    };
  });
}

export function mergeLogs(existing: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  const existingIds = new Set(existing.map(l => l.log_id));
  const existingKeys = new Set(existing.map(l => `${l.log_date}|${l.log_time}|${l.description.substring(0, 40).toLowerCase().trim()}`));

  const onlyNew = incoming.filter(l => {
    if (existingIds.has(l.log_id)) return false;
    const key = `${l.log_date}|${l.log_time}|${l.description.substring(0, 40).toLowerCase().trim()}`;
    return !existingKeys.has(key);
  });

  const combined = [...existing, ...onlyNew];
  combined.sort((a, b) => {
    const da = new Date(`${a.log_date}T${a.log_time || "00:00"}`).getTime();
    const db = new Date(`${b.log_date}T${b.log_time || "00:00"}`).getTime();
    return da - db;
  });

  return combined.map((l, i) => ({ ...l, log_id: i + 1 }));
}

// ─── Native / Web Share & Download ───────────────────────────────────────────
export async function downloadExcel(logs: LogEntry[], suggestedName?: string): Promise<void> {
  const buffer = buildWorkbook(logs);
  const finalName = suggestedName || `DiaryAssistant_${format(new Date(), "yyyy-MM-dd_HH-mm")}.xlsx`;

  // Electron Export natively
  if (isElectron) {
    await (window as any).electronAPI.exportExcel(buffer, finalName);
    return;
  }

  // Capacitor Native Share
  if (isNativeMobile) {
    try {
      const base64 = arrayBufferToBase64(buffer);
      const writeReq = await Filesystem.writeFile({
        path: finalName,
        data: base64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Diary Assistant Export',
        text: 'Backup of your logs from Diary Assistant',
        url: writeReq.uri,
        dialogTitle: 'Export Diary'
      });
    } catch (e) { console.error("Native Share failed", e); }
    return;
  }

  // Web Fallback
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function getElectronStorageInfo(): Promise<{ folder: string, file: string, filename: string } | null> {
  if (isElectron) {
    return await (window as any).electronAPI.getStorageInfo();
  }
  return null;
}

export async function selectElectronStorageFolder(): Promise<{ folder: string, file: string, filename: string } | null> {
  if (isElectron) {
    return await (window as any).electronAPI.selectStorageFolder();
  }
  return null;
}
