import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  Check,
} from "lucide-react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../firebase";
import { Booking } from "../types";
import {
  getBookedIntervalsForDate,
  timeToMinutes,
  minutesToTime,
  isMinuteBooked,
  isRangeOverlapping,
  BookedInterval,
  ALL_TIME_OPTIONS,
} from "../utils/eventScheduleHelper";

interface EventScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEventSchedule: (
    dateStr: string,
    startTime: string,
    endTime: string,
    summaryLabel: string
  ) => void;
  selectedDate?: string;
  selectedStartTime?: string;
  selectedEndTime?: string;
  bookings: Booking[];
}

// 4 common event presets for 1-click convenience
const POPULAR_PRESETS = [
  { id: "morning", label: "Ca Sáng", time: "08:00 - 12:00", start: "08:00", end: "12:00", icon: Sun, desc: "Lễ tổng kết / Khai giảng" },
  { id: "afternoon", label: "Ca Chiều", time: "13:30 - 17:30", start: "13:30", end: "17:30", icon: Sunset, desc: "Hội khoá / Hoạt động chiều" },
  { id: "evening", label: "Prom / Tiệc Tối", time: "18:00 - 22:00", start: "18:00", end: "22:00", icon: Moon, desc: "Dạ tiệc Prom Night / Tri ân" },
  { id: "night", label: "Gala Muộn", time: "19:00 - 23:00", start: "19:00", end: "23:00", icon: Sparkles, desc: "Tiệc đêm / After party" },
];

export const EventScheduleModal: React.FC<EventScheduleModalProps> = ({
  isOpen,
  onClose,
  onSelectEventSchedule,
  selectedDate = "",
  selectedStartTime = "18:00",
  selectedEndTime = "22:00",
  bookings = [],
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate) {
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      }
    }
    return new Date();
  });

  const [date, setDate] = useState<string>(selectedDate || "");
  const [startTime, setStartTime] = useState<string>(selectedStartTime || "18:00");
  const [endTime, setEndTime] = useState<string>(selectedEndTime || "22:00");
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [availableDates, setAvailableDates] = useState<Record<string, any>>({});

  // Sync props when opening
  useEffect(() => {
    if (isOpen) {
      if (selectedDate) {
        setDate((prev) => (prev !== selectedDate ? selectedDate : prev));
        const parts = selectedDate.split("-");
        if (parts.length === 3) {
          const targetY = parseInt(parts[0], 10);
          const targetM = parseInt(parts[1], 10) - 1;
          setCurrentMonth((prev) => {
            if (prev.getFullYear() === targetY && prev.getMonth() === targetM) {
              return prev;
            }
            return new Date(targetY, targetM, 1);
          });
        }
      }
      if (selectedStartTime) setStartTime((prev) => (prev !== selectedStartTime ? selectedStartTime : prev));
      if (selectedEndTime) setEndTime((prev) => (prev !== selectedEndTime ? selectedEndTime : prev));
    }
  }, [isOpen, selectedDate, selectedStartTime, selectedEndTime]);

  // Subscribe to availableDates in Firestore
  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, "availableDates"));
    const unsub = onSnapshot(q, (snapshot) => {
      const map: Record<string, any> = {};
      snapshot.forEach((docSnap) => {
        map[docSnap.id] = docSnap.data();
      });
      setAvailableDates(map);
    });
    return () => unsub();
  }, [isOpen]);

  // Calculate booked intervals on the selected date
  const bookedIntervals = useMemo<BookedInterval[]>(() => {
    if (!date) return [];
    return getBookedIntervalsForDate(date, bookings, availableDates);
  }, [date, bookings, availableDates]);

  // Check overlap for current selection
  const startMins = timeToMinutes(startTime);
  const endMins = timeToMinutes(endTime);
  const isDurationValid = endMins > startMins;
  const durationHours = isDurationValid ? ((endMins - startMins) / 60).toFixed(1).replace(".0", "") : "0";

  const overlapConflict = useMemo(() => {
    if (!isDurationValid || !date) return null;
    return isRangeOverlapping(startMins, endMins, bookedIntervals);
  }, [startMins, endMins, isDurationValid, date, bookedIntervals]);

  // Month navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const handleConfirm = () => {
    if (!date) return;
    if (!isDurationValid || overlapConflict) return;

    const summaryLabel = `Từ ${startTime} đến ${endTime} (${durationHours} tiếng)`;
    onSelectEventSchedule(date, startTime, endTime, summaryLabel);
    onClose();
  };

  const formattedDateVietnamese = useMemo(() => {
    if (!date) return "";
    const parts = date.split("-");
    if (parts.length !== 3) return date;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    return `${dayNames[d.getDay()]}, ${parts[2]}/${parts[1]}/${parts[0]}`;
  }, [date]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-zinc-950 border border-[#B5945B]/40 rounded-2xl shadow-2xl p-4 sm:p-6 text-white my-auto overflow-hidden text-left"
        >
          {/* Ambient blur glow */}
          <div className="absolute top-0 right-10 w-64 h-64 bg-[#B5945B]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors z-20 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-4 pr-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="p-1.5 bg-[#B5945B]/20 text-[#B5945B] border border-[#B5945B]/30 rounded-lg">
                <Clock className="w-4 h-4" />
              </span>
              <span>Lịch Sự Kiện &amp; Prom Night</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1">
              Chọn ngày và khung giờ tổ chức. Các giờ đã có sự kiện sẽ được khoá lại rõ ràng để tránh trùng lịch.
            </p>
          </div>

          <div className="space-y-4">
            {/* BƯỚC 1: CHỌN NGÀY */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#B5945B]" />
                  1. Chọn ngày tổ chức
                </span>

                {/* Month navigation */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-[#B5945B] mr-1">
                    Tháng {month + 1}/{year}
                  </span>
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1 hover:bg-white/10 rounded border border-white/10 text-zinc-300 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1 hover:bg-white/10 rounded border border-white/10 text-zinc-300 hover:text-white cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-400 mb-1">
                <span>CN</span>
                <span>T2</span>
                <span>T3</span>
                <span>T4</span>
                <span>T5</span>
                <span>T6</span>
                <span>T7</span>
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const isSelected = date === dateStr;
                  const isPast = dateStr < todayStr;

                  const dayIntervals = getBookedIntervalsForDate(dateStr, bookings, availableDates);
                  const isFullDayBooked = dayIntervals.some(
                    (intv) => intv.startMinutes <= 7 * 60 && intv.endMinutes >= 21 * 60
                  );
                  const hasPartialBookings = dayIntervals.length > 0 && !isFullDayBooked;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={isPast || isFullDayBooked}
                      onClick={() => setDate(dateStr)}
                      className={`h-8 sm:h-9 rounded-lg text-xs transition-all relative flex flex-col items-center justify-center cursor-pointer ${
                        isSelected
                          ? "bg-[#B5945B] text-black font-extrabold shadow-md shadow-amber-500/20 scale-105 z-10"
                          : isPast
                            ? "text-zinc-600 bg-black/20 cursor-not-allowed opacity-35"
                            : isFullDayBooked
                              ? "bg-red-950/40 text-red-400 border border-red-500/20 cursor-not-allowed"
                              : hasPartialBookings
                                ? "bg-amber-950/30 text-amber-200 border border-amber-500/30 hover:border-[#B5945B]"
                                : "bg-black/30 hover:bg-white/10 text-zinc-200 border border-white/5"
                      }`}
                    >
                      <span>{dayNum}</span>
                      {!isSelected && !isPast && (
                        <span
                          className={`w-1 h-1 rounded-full absolute bottom-1 ${
                            isFullDayBooked
                              ? "bg-red-500"
                              : hasPartialBookings
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Status legend */}
              <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-2 pt-2 border-t border-white/5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Trống cả ngày</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Có giờ bận (vẫn chọn được)</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Kín lịch</span>
                </span>
              </div>
            </div>

            {/* BƯỚC 2: CHỌN GIỜ TRONG NGÀY */}
            {date ? (
              <div className="bg-zinc-900/80 border border-white/10 rounded-xl p-3.5 sm:p-4 space-y-3.5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    2. Chọn giờ ngày: <strong className="text-[#B5945B]">{formattedDateVietnamese}</strong>
                  </span>
                </div>

                {/* CA PHỔ BIẾN - 1 chạm là chọn ngay */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Gợi ý các ca phổ biến (Bấm để chọn nhanh):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {POPULAR_PRESETS.map((preset) => {
                      const Icon = preset.icon;
                      const pStartM = timeToMinutes(preset.start);
                      const pEndM = timeToMinutes(preset.end);
                      const isConflict = Boolean(isRangeOverlapping(pStartM, pEndM, bookedIntervals));
                      const isSelected = !isCustomTime && startTime === preset.start && endTime === preset.end;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          disabled={isConflict}
                          onClick={() => {
                            setStartTime(preset.start);
                            setEndTime(preset.end);
                            setIsCustomTime(false);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                            isSelected
                              ? "bg-[#B5945B] text-black border-[#B5945B] font-bold shadow-md shadow-amber-500/20"
                              : isConflict
                                ? "bg-black/30 border-white/5 text-zinc-600 cursor-not-allowed opacity-50"
                                : "bg-white/5 border-white/10 hover:border-[#B5945B]/60 text-zinc-200 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-black" : "text-[#B5945B]"}`} />
                              {preset.label}
                            </span>
                            {isConflict && (
                              <span className="text-[10px] font-mono text-red-400 flex items-center gap-0.5">
                                <Lock className="w-3 h-3" /> Đã kín
                              </span>
                            )}
                            {isSelected && (
                              <Check className="w-4 h-4 text-black stroke-[3]" />
                            )}
                          </div>
                          <span className={`text-[11px] font-mono block ${isSelected ? "text-black/90" : "text-zinc-400"}`}>
                            {preset.time}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* TỰ CHỌN GIỜ LINH HOẠT */}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Hoặc tự chọn giờ cụ thể:
                    </label>
                    <span className="text-[11px] text-zinc-500">Bước nhảy 30 phút</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-zinc-400 text-[11px] mb-1">Từ mấy giờ:</span>
                      <select
                        value={startTime}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setStartTime(newStart);
                          setIsCustomTime(true);
                          const nStartM = timeToMinutes(newStart);
                          const curEndM = timeToMinutes(endTime);
                          if (curEndM <= nStartM) {
                            setEndTime(minutesToTime(Math.min(23 * 60 + 30, nStartM + 4 * 60)));
                          }
                        }}
                        className="w-full bg-zinc-950 border border-white/15 focus:border-[#B5945B] rounded-xl px-3 py-2 text-xs font-mono text-white cursor-pointer"
                      >
                        {ALL_TIME_OPTIONS.slice(0, -1).map((opt) => {
                          const optMin = timeToMinutes(opt);
                          const isBooked = isMinuteBooked(optMin, bookedIntervals);
                          return (
                            <option
                              key={opt}
                              value={opt}
                              disabled={isBooked}
                              className={isBooked ? "bg-zinc-900 text-zinc-500" : "bg-zinc-900 text-white"}
                            >
                              {opt} {isBooked ? "— (🔒 Đã kín)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <span className="block text-zinc-400 text-[11px] mb-1">Đến mấy giờ:</span>
                      <select
                        value={endTime}
                        onChange={(e) => {
                          setEndTime(e.target.value);
                          setIsCustomTime(true);
                        }}
                        className="w-full bg-zinc-950 border border-white/15 focus:border-[#B5945B] rounded-xl px-3 py-2 text-xs font-mono text-white cursor-pointer"
                      >
                        {ALL_TIME_OPTIONS.filter((opt) => timeToMinutes(opt) > startMins).map((opt) => {
                          const optMin = timeToMinutes(opt);
                          const isConflict = Boolean(isRangeOverlapping(startMins, optMin, bookedIntervals));
                          return (
                            <option
                              key={opt}
                              value={opt}
                              disabled={isConflict}
                              className={isConflict ? "bg-zinc-900 text-zinc-500" : "bg-zinc-900 text-white"}
                            >
                              {opt} {isConflict ? "— (🔒 Trùng lịch)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Overlap error alert */}
                  {overlapConflict && (
                    <div className="mt-2 p-2.5 bg-red-950/50 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>
                        Khung giờ bạn chọn bị trùng với lịch đã kín ({overlapConflict.startTime} - {overlapConflict.endTime}). Vui lòng chọn giờ khác.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-900/50 border border-white/5 rounded-xl text-center text-xs text-zinc-400">
                👆 Vui lòng chọn ngày tổ chức ở lịch phía trên để xem các khung giờ trống.
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Đóng
              </button>

              <button
                type="button"
                disabled={!date || !isDurationValid || Boolean(overlapConflict)}
                onClick={handleConfirm}
                className="px-6 py-2.5 bg-[#B5945B] hover:bg-[#c6a365] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {date
                    ? `Xác Nhận Lịch: ${startTime} - ${endTime}`
                    : "Chọn Ngày & Giờ"}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
