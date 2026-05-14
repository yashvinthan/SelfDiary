import React from "react";
import { format } from "date-fns";
import { Pencil, Trash2, User, MapPin, MessageSquare, Info, Bell } from "lucide-react";
import { LogEntry } from "../services/excelStorage";

interface LogTableProps {
  logs: LogEntry[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function LogTable({ logs, onEdit, onDelete }: LogTableProps) {
  return (
    <div className="w-full overflow-x-auto bg-white rounded-3xl border border-stone-200 shadow-sm">
      <table className="w-full text-left border-collapse min-w-[1200px]">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 uppercase">
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest text-center w-16">Log Number</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest">Date of Event</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest">Time of Event</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest">Whom/Person</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest">Place of Event</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest text-center">Mode of Event</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest text-center">Type</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest">Duration</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest">Emotions</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest w-64">Full Description Input</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest">Remarks</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest">Reminder</th>
            <th className="p-4 text-[10px] font-black text-stone-400 tracking-widest text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {[...logs].reverse().map((log) => {
            const isValidDate = log.log_date && !isNaN(new Date(log.log_date).getTime());
            const formattedDate = isValidDate ? format(new Date(log.log_date), "MMM d, yyyy") : log.log_date || "---";

            return (
              <tr key={log.log_id} className="hover:bg-stone-50/50 transition-colors group">
                <td className="p-4 text-center">
                  <span className="text-xs font-bold text-stone-400">#{log.log_id}</span>
                </td>
                <td className="p-4">
                  <span className="text-xs font-bold text-stone-700">{formattedDate}</span>
                </td>
                <td className="p-4 whitespace-nowrap">
                  <span className="text-xs font-medium text-stone-600">{log.log_time || "---"}</span>
                </td>
                <td className="p-4">
                  <span className="text-xs font-bold text-stone-800">{log.whom || "---"}</span>
                </td>
                <td className="p-4">
                  <span className="text-xs text-stone-500">{log.place || "---"}</span>
                </td>
                <td className="p-4 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase border ${getModeClass(log.mode)}`}>
                    {log.mode || "Meeting"}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <span className="text-xs text-stone-500 font-bold">{log.type || "Text"}</span>
                </td>
                <td className="p-4">
                  <span className="text-xs text-stone-500">{log.duration || "---"}</span>
                </td>
                <td className="p-4">
                  <span className="text-xs text-stone-500">{log.emotions || "---"}</span>
                </td>
                <td className="p-4">
                  <p className="text-xs text-stone-600 font-medium leading-relaxed line-clamp-2 w-64">
                    {log.description}
                  </p>
                </td>
                <td className="p-4">
                  <span className="text-xs text-stone-500 italic">{log.remarks || "---"}</span>
                </td>
                <td className="p-4">
                  {log.reminder ? (
                    <div className="flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 max-w-[150px]">
                      <Bell size={10} className="text-emerald-500 shrink-0" />
                      <span className="text-[10px] font-bold text-emerald-700 truncate">{log.reminder}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-stone-300">---</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(log.log_id)}
                      className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                      title="Edit Entry"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(log.log_id)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete Entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getModeClass(mode: string) {
  const MODE_COLORS: Record<string, string> = {
    "Meeting":      "bg-blue-50 text-blue-700 border-blue-100",
    "Call":         "bg-emerald-50 text-emerald-700 border-emerald-100",
    "Email":        "bg-stone-100 text-stone-600 border-stone-200",
    "WhatsApp":     "bg-green-50 text-green-700 border-green-100",
    "SMS":          "bg-amber-50 text-amber-700 border-amber-100",
  };
  return MODE_COLORS[mode] || "bg-stone-50 text-stone-500 border-stone-100";
}
