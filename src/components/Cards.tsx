import React from "react";
import { Calendar, Clock, Tag, FileText, Bell, Pencil, Trash2, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { motion } from "motion/react";

interface LogCardProps {
  log_id: number;
  log_date: string;
  log_time: string;
  whom: string;
  place: string;
  mode: string;
  description: string;
  remarks: string;
  reminder: string;
  device_name: string;
  app_version: string;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
}

const MODE_COLORS: Record<string, string> = {
  "Meeting":      "bg-blue-50 text-blue-700 border-blue-100",
  "Call":         "bg-emerald-50 text-emerald-700 border-emerald-100",
  "Email":        "bg-stone-100 text-stone-600 border-stone-200",
  "WhatsApp":     "bg-green-50 text-green-700 border-green-100",
  "SMS":          "bg-amber-50 text-amber-700 border-amber-100",
};

function getModeClass(mode: string) {
  return MODE_COLORS[mode] ?? "bg-stone-50 text-stone-500 border-stone-100";
}

export function LogCard({
  log_id, log_date, log_time, whom, place, mode, description, remarks, reminder,
  device_name, app_version, onEdit, onDelete,
}: LogCardProps) {
  const isValidDate = log_date && !isNaN(new Date(log_date).getTime());
  const formattedDate = isValidDate ? format(new Date(log_date), "MMM d, yyyy") : log_date || "Unknown Date";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-5 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow space-y-4"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-2.5 py-1 rounded-xl uppercase tracking-widest border border-stone-200/50">
            #{log_id}
          </span>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-widest border ${getModeClass(mode)}`}>
            {mode}
          </span>
          <div className="flex items-center gap-1.5 text-stone-500 text-xs font-bold">
            <Calendar size={14} className="text-stone-400" />
            <span>{formattedDate}</span>
            {log_time && (
              <>
                <span className="mx-0.5 opacity-30">•</span>
                <Clock size={14} className="text-stone-400" />
                <span>{log_time}</span>
              </>
            )}
          </div>
        </div>

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-1.5 shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(log_id)}
                className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Edit Log"
              >
                <Pencil size={16} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(log_id)}
                className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Log"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Whom & Place */}
      {(whom || place) && (
        <div className="flex flex-wrap gap-4 px-1">
          {whom && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-stone-400 uppercase tracking-tighter">Whom:</span>
              <p className="text-xs font-bold text-stone-900">{whom}</p>
            </div>
          )}
          {place && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-stone-400 uppercase tracking-tighter">Place:</span>
              <p className="text-xs font-bold text-stone-900">{place}</p>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      <div className="flex items-start gap-4 bg-stone-50/50 p-4 rounded-2xl border border-stone-100">
        <div className="p-2.5 bg-white text-stone-400 rounded-xl shadow-sm border border-stone-100 shrink-0">
          <FileText size={20} />
        </div>
        <p className="text-stone-700 text-sm font-medium leading-relaxed">{description}</p>
      </div>

      {/* Footer Info (Remarks & Reminders) */}
      {(remarks || reminder) && (
        <div className="space-y-2 pt-1">
          {remarks && (
            <div className="flex items-start gap-2.5 px-1">
              <span className="text-[9px] font-black text-stone-400 uppercase tracking-tighter mt-0.5">Remarks:</span>
              <p className="text-xs text-stone-500 font-medium leading-relaxed">{remarks}</p>
            </div>
          )}
          {reminder && (
            <div className="flex items-center gap-2.5 bg-emerald-50/50 border border-emerald-100/50 p-3 rounded-2xl">
              <Bell size={16} className="text-emerald-500 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Reminder:</span>
                <p className="text-xs font-bold text-emerald-800">{reminder}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="pt-2 flex items-center gap-3 text-[9px] font-black text-stone-300 uppercase tracking-widest px-1">
        <div className="flex items-center gap-1.5">
          <Smartphone size={12} className="opacity-50" />
          <span>{device_name}</span>
        </div>
        <span className="opacity-30">•</span>
        <span>Version {app_version}</span>
      </div>
    </motion.div>
  );
}

interface ReminderCardProps {
  title: string;
  dateTime: string;
  onConfirm: (offset: number) => void;
  compact?: boolean;
}

export function ReminderCard({ index, title, dateTime, onConfirm, compact }: ReminderCardProps & { index?: number }) {
  const date = new Date(dateTime);
  const isValidDate = !isNaN(date.getTime());
  const isPast = isValidDate ? date < new Date() : false;

  const [activeAlert, setActiveAlert] = React.useState<number | null>(() => {
    const saved = localStorage.getItem(`alert_${title}_${dateTime}`);
    return saved ? parseInt(saved) : null;
  });

  const handleToggle = (mins: number) => {
    const newVal = activeAlert === mins ? null : mins;
    setActiveAlert(newVal);
    if (newVal !== null) {
      localStorage.setItem(`alert_${title}_${dateTime}`, mins.toString());
      onConfirm(mins);
    } else {
      localStorage.removeItem(`alert_${title}_${dateTime}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`${compact ? 'p-3' : 'p-5'} rounded-3xl border transition-all ${
        isPast
          ? "bg-stone-50 border-stone-200 grayscale opacity-60"
          : activeAlert 
            ? "bg-emerald-50/30 border-emerald-300 shadow-lg shadow-emerald-100/50 scale-[1.01]" 
            : "bg-white border-emerald-100 shadow-sm shadow-emerald-50"
      }`}
    >
      <div className={`flex items-start justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className={`rounded-2xl transition-colors ${compact ? 'p-2' : 'p-3'} ${
              isPast 
                ? "bg-stone-200 text-stone-500" 
                : activeAlert 
                  ? "bg-stone-900 text-white shadow-lg" 
                  : "bg-emerald-600 text-white shadow-lg shadow-emerald-100"
            }`}>
              <Bell size={compact ? 16 : 20} className={activeAlert ? "animate-bounce" : ""} />
            </div>
            {index !== undefined && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-stone-900 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                {index + 1}
              </span>
            )}
          </div>
          <div>
            <h3 className={`font-bold text-stone-800 ${compact ? 'text-sm' : 'text-lg'} leading-tight`}>{title}</h3>
            <p className={`text-stone-500 ${compact ? 'text-[11px]' : 'text-sm'} font-medium mt-1`}>
              {isValidDate
                ? `${format(date, "EEEE, MMM d")} at ${format(date, "h:mm a")}`
                : dateTime || "Unknown Time"}
            </p>
          </div>
        </div>
        {(isPast || activeAlert) && (
          <div className="flex flex-col items-end gap-1">
             {isPast && <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-2 py-1 rounded-full uppercase">Past</span>}
             {activeAlert && !isPast && <span className={`font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 uppercase animate-pulse ${compact ? 'text-[8px]' : 'text-[9px]'}`}>Alert Active</span>}
          </div>
        )}
      </div>

      {!isPast && (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Set Alert Before</p>
            {activeAlert && (
              <p className={`font-bold text-emerald-600 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>Selected: {activeAlert} mins</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[15, 30, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => handleToggle(mins)}
                className={`${compact ? 'py-1.5 text-[10px]' : 'py-2.5 text-xs'} rounded-xl font-bold transition-all border ${
                  activeAlert === mins
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md scale-95"
                    : "bg-stone-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border-stone-200 text-stone-600"
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
