/**
 * helpers.ts — Legacy compatibility shim.
 * All primary storage logic is now in src/services/excelStorage.ts
 * This file re-exports from the new service for any legacy references.
 */

export type { LogEntry } from "../services/excelStorage";
export { downloadExcel as exportToExcel, parseBackupFile as importFromExcel } from "../services/excelStorage";
export { format } from "date-fns";

export function formatDateTime(date: Date) {
  return {
    date: date.toISOString().split("T")[0],
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}
