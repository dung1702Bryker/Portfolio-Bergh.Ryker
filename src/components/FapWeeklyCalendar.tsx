import React, { useState, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Check,
  Info,
  MapPin,
  User,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { collection, onSnapshot, query, doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

const DEBUG_SYNC = true;

const debugLog = (label: string, payload?: unknown) => {
  if (!DEBUG_SYNC) return;
  console.log(`[FapWeeklyCalendar] ${label}`, payload);
};

const debugWarn = (label: string, payload?: unknown) => {
  if (!DEBUG_SYNC) return;
  console.warn(`[FapWeeklyCalendar] ${label}`, payload);
};

const debugError = (label: string, error: unknown, extra?: unknown) => {
  const normalized = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    : { raw: error };

  console.error(`[FapWeeklyCalendar] ${label}`, normalized, extra);
};

const getReadableErrorMessage = (error: unknown) => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Lỗi không xác định';
  }
};

interface DetailedSchedule {
  courseCode: string;
  subject: string;
  mode?: string;
  room?: string;
  teacher?: string;
  detailUrl?: string;
  meetingUrl?: string;
  note?: string;
  rawText?: string;
  source?: 'html-table' | 'html-mixed' | 'plain-text';
}

interface FapWeeklyCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSlot: (dateStr: string, slotTime: string) => void;
  selectedDate?: string;
  selectedTime?: string;
  isAdminMode?: boolean;
}

const FAP_SLOTS = [
  { name: "Slot 1 (7:15-9:15)", time: "07:15" },
  { name: "Slot 2 (9:25-11:25)", time: "09:25" },
  { name: "Slot 3 (12:00-14:00)", time: "12:00" },
  { name: "Slot 4 (14:10-16:10)", time: "14:10" },
  { name: "Slot 5 (16:20-18:20)", time: "16:20" },
  { name: "Slot 6 (18:30-20:30)", time: "18:30" },
  { name: "Slot 7 (20:30-22:30)", time: "20:30" },
];

export const FapWeeklyCalendar: React.FC<FapWeeklyCalendarProps> = ({
  isOpen,
  onClose,
  onSelectSlot,
  selectedDate,
  selectedTime,
  isAdminMode = false,
}) => {
  const [localDate, setLocalDate] = useState(selectedDate || "");
  const [localTimeSlots, setLocalTimeSlots] = useState<string[]>(
    selectedTime
      ? selectedTime
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
  );
  const [detailModalData, setDetailModalData] = useState<{
    dateStr: string;
    slotTime: string;
    slotName: string;
    items: DetailedSchedule[];
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalDate(selectedDate || "");
      setLocalTimeSlots(
        selectedTime
          ? selectedTime
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      );
    }
  }, [isOpen, selectedDate, selectedTime]);

  const areSlotsContiguous = (slots: string[]) => {
    if (slots.length <= 1) return true;
    const indices = slots
      .map((t) => FAP_SLOTS.findIndex((s) => s.time === t))
      .filter((idx) => idx !== -1)
      .sort((a, b) => a - b);
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] !== indices[i - 1] + 1) return false;
    }
    return true;
  };

  const handleSlotClick = (dateStr: string, slotTime: string) => {
    if (localDate !== dateStr) {
      setLocalDate(dateStr);
      setLocalTimeSlots([slotTime]);
      return;
    }

    let newSlots = [...localTimeSlots];
    if (newSlots.includes(slotTime)) {
      newSlots = newSlots.filter((t) => t !== slotTime);
      if (!areSlotsContiguous(newSlots)) {
        newSlots = [slotTime];
      }
    } else {
      newSlots.push(slotTime);
      newSlots.sort((a, b) => {
        const idxA = FAP_SLOTS.findIndex((s) => s.time === a);
        const idxB = FAP_SLOTS.findIndex((s) => s.time === b);
        return idxA - idxB;
      });
      if (!areSlotsContiguous(newSlots)) {
        newSlots = [slotTime];
      }
    }

    if (newSlots.length === 0) {
      setLocalDate("");
    }
    setLocalTimeSlots(newSlots);
  };

  const [availableDates, setAvailableDates] = useState<
    Record<
      string,
      { status: string; reason?: string | null; blockedSlots?: string[]; detailedSchedule?: Record<string, DetailedSchedule[]> }
    >
  >({});
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // get Monday
    return new Date(today.setDate(diff));
  });

  useEffect(() => {
    if (!isOpen) return;

    debugLog('firestore:subscribe:start', { currentWeekStart: currentWeekStart.toISOString() });
    const q = query(collection(db, "availableDates"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const datesMap: Record<
          string,
          { status: string; reason?: string | null; blockedSlots?: string[]; detailedSchedule?: Record<string, DetailedSchedule[]> }
        > = {};
        
        let blockedSlotsCount = 0;
        let detailedScheduleKeysCount = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const dVal = data.date || doc.id;
          if (dVal && data.status) {
            datesMap[dVal] = {
              status: data.status,
              reason: data.reason,
              blockedSlots: data.blockedSlots || [],
              detailedSchedule: data.detailedSchedule || {},
            };
            
            if (data.blockedSlots) blockedSlotsCount += data.blockedSlots.length;
            if (data.detailedSchedule) detailedScheduleKeysCount += Object.keys(data.detailedSchedule).length;
          }
        });
        
        debugLog('firestore:subscribe:data', { 
          datesCount: Object.keys(datesMap).length,
          blockedSlotsCount,
          detailedScheduleKeysCount
        });
        setAvailableDates(datesMap);
      },
      (error: unknown) => {
        debugError('firestore:subscribe:failed', error);
        handleFirestoreError(error as any, OperationType.LIST, "availableDates");
      },
    );

    return () => unsubscribe();
  }, [isOpen]);

  const getDaysOfWeek = (startDate: Date) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const daysOfWeek = getDaysOfWeek(currentWeekStart);

  useEffect(() => {
    if (!isOpen) return;
    const rangeStart = formatShortDate(daysOfWeek[0]);
    const rangeEnd = formatShortDate(daysOfWeek[6]);
    debugLog('render:week_range', { start: rangeStart, end: rangeEnd });
    
    let totalBlockedSlots = 0;
    let totalDetailedKeys = 0;
    
    for (const date of daysOfWeek) {
      const dateStr = formatDateStr(date);
      const dayStatusInfo = availableDates[dateStr];
      if (dayStatusInfo) {
         const bSlots = dayStatusInfo.blockedSlots || [];
         const dSched = dayStatusInfo.detailedSchedule || {};
         totalBlockedSlots += bSlots.length;
         totalDetailedKeys += Object.keys(dSched).length;
         
         FAP_SLOTS.forEach(slot => {
            const hasDetail = dSched[slot.time] && dSched[slot.time].length > 0;
            const hasBlocked = bSlots.includes(slot.time) || bSlots.includes("FULL") || (dayStatusInfo.status === 'unavailable' && !dayStatusInfo.hasOwnProperty('blockedSlots')) || dayStatusInfo.status === 'booked';
            
            if (hasDetail || hasBlocked) {
               debugLog(`render:cell_data`, {
                  cellKey: `${dateStr}__${slot.time}`,
                  source: hasDetail ? "detailedSchedule" : (hasBlocked ? "blockedOnly" : "empty")
               });
            }
         });
      }
    }
    debugLog('render:stats', { totalBlockedSlots, totalDetailedKeys });
  }, [isOpen, currentWeekStart, availableDates]);

  if (!isOpen) return null;

  const prevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    debugLog('week:prev', { weekStart: prev.toISOString() });
    setCurrentWeekStart(prev);
  };

  const nextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    debugLog('week:next', { weekStart: next.toISOString() });
    setCurrentWeekStart(next);
  };

  const formatDateStr = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatShortDate = (date: Date) => {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${d}/${m}`;
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const mapDayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <AnimatePresence>
      <div key="fap-weekly-calendar-modal" className="fixed inset-0 z-[100] flex justify-center items-center p-2 lg:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-[1400px] bg-[#1a1b26] border border-white/10 shadow-2xl rounded-2xl flex flex-col z-10 overflow-hidden"
          style={{ maxHeight: "90vh" }}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] bg-[#16161e] flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-[#B5945B]/10 rounded-xl border border-[#B5945B]/20">
                <CalendarIcon className="w-6 h-6 text-[#B5945B]" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-lg text-white uppercase tracking-wide">
                  Lịch Chụp Sự Kiện / Prom
                </h3>
                <p className="text-[12px] text-zinc-400 font-sans tracking-tight mt-0.5">
                  Hiển thị lịch tuần theo ca chi tiết
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center p-1 bg-white/[0.03] border border-white/[0.05] rounded-lg">
                <button
                  onClick={prevWeek}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="px-3 text-xs font-bold text-white uppercase whitespace-nowrap min-w-[120px] text-center">
                  {formatShortDate(daysOfWeek[0])} -{" "}
                  {formatShortDate(daysOfWeek[6])}
                </div>
                <button
                  onClick={nextWeek}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-zinc-400 hover:text-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 transition-all border border-transparent hover:border-red-500/30"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 bg-[#1a1b26] custom-scrollbar">
            <div className="min-w-[1000px]">
              {/* Table Header */}
              <div className="grid grid-cols-[160px_repeat(7,1fr)] bg-[#24283b] border-t border-l border-white/10 rounded-t-xl overflow-hidden">
                <div className="flex items-center justify-center border-r border-b border-white/10 p-3 bg-[#1f2335]">
                  <span className="text-xs font-bold text-zinc-400">
                    Time / Date
                  </span>
                </div>
                {daysOfWeek.map((date, dateIdx) => (
                  <div
                    key={`cal-day-${date.toISOString()}-${dateIdx}`}
                    className={`flex flex-col items-center justify-center border-r border-b border-white/10 p-3 
                        ${formatDateStr(date) === formatDateStr(new Date()) ? "bg-[#B5945B]/10" : "bg-[#1f2335]"}`}
                  >
                    <span className="font-sans font-bold text-white uppercase text-sm">
                      {mapDayName[date.getDay()]}
                    </span>
                    <span className="text-xs font-mono text-zinc-400 mt-1">
                      {formatShortDate(date)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Table Grid */}
              <div className="grid grid-cols-[160px_repeat(7,1fr)] bg-[#1a1b26] border-l border-white/10 rounded-b-xl overflow-hidden">
                {FAP_SLOTS.map((slot, rowIndex) => (
                  <React.Fragment key={`slot-row-${slot.name || rowIndex}-${rowIndex}`}>
                    {/* Slot Column Row Header */}
                    <div className="flex items-center justify-center border-r border-b border-white/10 p-3 bg-[#1f2335]">
                      <span className="text-xs font-sans font-medium text-zinc-300 text-center">
                        {slot.name}
                      </span>
                    </div>

                    {/* Slot Cells for Each Day */}
                    {daysOfWeek.map((date, colIndex) => {
                      const dateStr = formatDateStr(date);
                      const isPast = isPastDate(date);
                      const dayStatusInfo = availableDates[dateStr];
                      const dayStatus = dayStatusInfo?.status || "available";
                      const blockedSlots = dayStatusInfo?.blockedSlots || [];
                      const detailedScheduleList = dayStatusInfo?.detailedSchedule?.[slot.time];

                      let isSlotBlocked = false;
                      if (dayStatus === "booked") isSlotBlocked = true;
                      if (
                        blockedSlots.includes("FULL") ||
                        (dayStatus === "unavailable" && (!dayStatusInfo.hasOwnProperty("blockedSlots") || blockedSlots.length === 0))
                      ) {
                        isSlotBlocked = true;
                      } else if (blockedSlots.includes(slot.time)) {
                        isSlotBlocked = true;
                      }
                      if (detailedScheduleList && detailedScheduleList.length > 0) {
                        isSlotBlocked = true;
                      }

                      const isSelected =
                        localDate === dateStr &&
                        localTimeSlots.includes(slot.time);

                      let isClickable = true;
                      let cellBg = "hover:bg-white/5 cursor-pointer";
                      let content = null;

                      if (isPast) {
                        isClickable = false;
                        cellBg =
                          "bg-zinc-900/40 text-zinc-600 opacity-50 cursor-not-allowed";
                      } else if (isSlotBlocked) {
                        isClickable = false;
                        cellBg =
                          "bg-zinc-900/60 border-zinc-800/60 cursor-not-allowed";
                        
                        if (detailedScheduleList && detailedScheduleList.length > 0) {
                          const openDetailModal = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            const slotName = FAP_SLOTS.find((s) => s.time === slot.time)?.name || `Slot (${slot.time})`;
                            setDetailModalData({
                              dateStr,
                              slotTime: slot.time,
                              slotName,
                              items: detailedScheduleList,
                            });
                          };

                          content = (
                            <div
                              onDoubleClick={openDetailModal}
                              onClick={openDetailModal}
                              className="flex flex-col gap-0.5 w-full h-full justify-center items-center p-1.5 border border-amber-500/30 rounded bg-amber-500/15 shadow-sm text-amber-400 overflow-hidden cursor-pointer hover:bg-amber-500/25 transition-all select-none"
                              title="Đã kín lịch - Nhấp đúp để xem chi tiết"
                            >
                              <span className="font-bold text-[11px] leading-tight truncate max-w-full text-amber-300 uppercase">
                                Đã kín lịch
                              </span>
                              <span className="text-[9px] leading-tight text-amber-400/80 font-medium truncate max-w-full">
                                (Nhấp đúp xem chi tiết)
                              </span>
                            </div>
                          );
                        } else {
                          content = (
                            <div className="flex flex-col items-center justify-center opacity-60">
                              <span className="text-[10px] sm:text-xs font-medium tracking-wide text-zinc-500 text-center uppercase">
                                Đã kín lịch
                              </span>
                            </div>
                          );
                        }
                      } else {
                        if (isSelected) {
                          cellBg =
                            "bg-[#B5945B] hover:bg-[#B5945B]/90 shadow-md transform scale-[1.02] z-10 rounded-md m-[1px] border border-amber-300/50";
                          content = (
                            <div className="flex flex-col items-center justify-center">
                              <Check className="w-5 h-5 text-black" />
                              <span className="text-[10px] mt-0.5 font-bold tracking-wide text-black text-center leading-tight">
                                ĐÃ CHỌN
                              </span>
                            </div>
                          );
                        } else {
                          cellBg += " active:bg-white/10";
                        }
                      }

                      return (
                        <div
                          key={`cell-${dateStr}-${slot.time}-${rowIndex}-${colIndex}`}
                          onClick={() => {
                            if (isClickable) {
                              handleSlotClick(dateStr, slot.time);
                            }
                          }}
                          className={`border-r border-b border-white/10 p-2 min-h-[80px] flex items-stretch justify-center transition-all duration-200 relative ${cellBg}`}
                        >
                          {content}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-white/[0.06] bg-[#16161e] flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#1a1b26] border border-white/10"></div>
                <span className="text-xs text-zinc-400">Trống</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-zinc-900/60 border border-zinc-700"></div>
                <span className="text-xs text-zinc-400">Kín / Khoá</span>
              </div>
            </div>
            {localDate && localTimeSlots.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold rounded-lg font-sans">
                  Đã chọn: {localDate.split("-").reverse().join("/")} - Lịch:{" "}
                  {localTimeSlots.join(", ")}
                </div>
                <button
                  onClick={() =>
                    onSelectSlot(localDate, localTimeSlots.join(", "))
                  }
                  className="px-4 py-2 bg-[#B5945B] hover:bg-[#a08253] text-black font-bold rounded-lg transition-colors border border-[#B5945B]/50 shadow-md"
                >
                  Xác nhận
                </button>
              </div>
            )}
          </div>

          {/* Modal Xem Chi Tiết Lịch Bận */}
          <AnimatePresence>
            {detailModalData && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setDetailModalData(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-[#1a1b26] border border-amber-500/40 rounded-xl p-5 max-w-md w-full shadow-2xl overflow-hidden relative text-zinc-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <CalendarIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-amber-300">Chi tiết ca học</h3>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">
                          {detailModalData.dateStr.split("-").reverse().join("/")} • {detailModalData.slotName}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDetailModalData(null)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Items List */}
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {detailModalData.items.map((item, idx) => (
                      <div
                        key={`fap-detail-${item.courseCode || 'item'}-${idx}`}
                        className="p-3.5 bg-zinc-900/90 border border-amber-500/25 rounded-lg flex flex-col gap-2 shadow-inner"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="font-bold text-amber-300 text-sm tracking-wide">
                              {item.courseCode || "Chi tiết ca học"}
                            </span>
                            {item.subject && (
                              <span className="text-xs text-zinc-300 font-medium mt-0.5">
                                {item.subject}
                              </span>
                            )}
                          </div>
                          {item.mode && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 shrink-0">
                              {item.mode}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 text-xs text-zinc-300 pt-2 border-t border-white/5">
                          {item.room && (
                            <div className="flex items-center gap-2 text-amber-200/90 font-mono">
                              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Phòng: <strong className="text-white font-semibold">{item.room}</strong></span>
                            </div>
                          )}
                          {item.teacher && (
                            <div className="flex items-center gap-2 text-zinc-300">
                              <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Giảng viên: <strong className="text-white font-semibold">{item.teacher}</strong></span>
                            </div>
                          )}
                          {item.note && (
                            <div className="flex items-center gap-2 text-zinc-400 text-[11px] mt-0.5">
                              <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                              <span>Ghi chú: <span className="text-amber-300">{item.note}</span></span>
                            </div>
                          )}
                        </div>

                        {(item.detailUrl || item.meetingUrl) && (
                          <div className="flex items-center gap-2 pt-2 mt-1 border-t border-white/5">
                            {item.detailUrl && (
                              <a
                                href={item.detailUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Chi tiết
                              </a>
                            )}
                            {item.meetingUrl && (
                              <a
                                href={item.meetingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Phòng học Meet
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Modal Footer */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
                    <button
                      onClick={() => setDetailModalData(null)}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors border border-white/10"
                    >
                      Đóng
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
