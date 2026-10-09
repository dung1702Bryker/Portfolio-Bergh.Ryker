import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  PhoneCall,
  Check,
  AlertCircle,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  collection,
  onSnapshot,
  query,
  doc,
  setDoc,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
  markFirestoreQuotaExceeded,
} from "../firebase";
import { toast } from "../hooks/useToast";

interface AvailabilityCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  selectedDate?: string;
  isAdminMode?: boolean;
}

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  isOpen,
  onClose,
  onSelectDate,
  selectedDate,
  isAdminMode = false,
}) => {
  // Collection of available dates from Firestore
  const [availableDates, setAvailableDates] = useState<
    Record<string, { status: "available" | "booked" | "unavailable"; reason?: string | null }>
  >({});
  const [currentDate, setCurrentDate] = useState(() => {
    if (selectedDate) {
      const parts = selectedDate.split("-");
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      }
    }
    return new Date();
  });
  const [tempSelectedDate, setTempSelectedDate] = useState<string>(selectedDate || "");
  const [isLoading, setIsLoading] = useState(true);

  // Sync tempSelectedDate when selectedDate changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTempSelectedDate((prev) => (prev !== (selectedDate || "") ? (selectedDate || "") : prev));
      if (selectedDate) {
        const parts = selectedDate.split("-");
        if (parts.length === 3) {
          const targetY = parseInt(parts[0], 10);
          const targetM = parseInt(parts[1], 10) - 1;
          setCurrentDate((prev) => {
            if (prev.getFullYear() === targetY && prev.getMonth() === targetM) {
              return prev;
            }
            return new Date(targetY, targetM, 1);
          });
        }
      }
    }
  }, [isOpen, selectedDate]);

  useEffect(() => {
    if (!isOpen) return;

    // Real-time listener for availableDates collection
    const q = query(collection(db, "availableDates"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const datesMap: Record<
          string,
          { status: "available" | "booked" | "unavailable"; reason?: string | null }
        > = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const dVal = data.date || docSnap.id;
          if (dVal && data.status) {
            datesMap[dVal] = { status: data.status, reason: data.reason };
          }
        });
        setAvailableDates(datesMap);
        setIsLoading(false);
      },
      (error: any) => {
        if (
          error?.code === "resource-exhausted" ||
          error?.message?.includes("Quota limit exceeded")
        ) {
          markFirestoreQuotaExceeded();
          setIsLoading(false);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, "availableDates");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Calendar Math
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday=0, Monday=1...

  // Monday-based indexing: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  const startPadding = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const gridSlots: (Date | null)[] = [];
  for (let i = 0; i < startPadding; i++) {
    gridSlots.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    gridSlots.push(new Date(year, month, day));
  }

  // Format date to local midnight string format yyyy-mm-dd
  const formatDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const isPastDate = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  };

  const isTodayDate = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Count available days in month
  const availableCountInMonth = useMemo(() => {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (!isPastDate(d)) {
        const dStr = formatDateStr(d);
        const status = availableDates[dStr]?.status;
        if (status === "available" || status === undefined) {
          count++;
        }
      }
    }
    return count;
  }, [year, month, daysInMonth, availableDates]);

  const hasAnyAvailableInMonth = availableCountInMonth > 0;

  // Month names in Vietnamese
  const vietnameseMonths = [
    "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
    "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
  ];

  const handleDateClick = async (dateStr: string, currentStatus?: string) => {
    if (isAdminMode) {
      try {
        let newStatus = "available";
        if (currentStatus === "available") newStatus = "booked";
        else if (currentStatus === "booked") newStatus = "unavailable";
        else newStatus = "available";

        await setDoc(doc(db, "availableDates", dateStr), {
          date: dateStr,
          status: newStatus,
        });
        const statusLabel =
          newStatus === "available"
            ? "Khả dụng"
            : newStatus === "booked"
              ? "Đã kín lịch"
              : "Tạm khóa";
        toast.success(`Đã cập nhật ngày ${dateStr} sang: ${statusLabel}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `availableDates/${dateStr}`);
        toast.error("Lỗi khi cập nhật trạng thái lịch: " + (error instanceof Error ? error.message : ""));
      }
    } else {
      setTempSelectedDate(dateStr);
    }
  };

  const handleConfirmDate = () => {
    if (!tempSelectedDate) return;
    onSelectDate(tempSelectedDate);
    onClose();
  };

  const formattedSelectedDateDisplay = useMemo(() => {
    if (!tempSelectedDate) return null;
    const parts = tempSelectedDate.split("-");
    if (parts.length !== 3) return tempSelectedDate;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    return `${dayNames[d.getDay()]}, ${parts[2]}/${parts[1]}/${parts[0]}`;
  }, [tempSelectedDate]);

  return (
    <AnimatePresence>
      <div
        key="availability-calendar-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
      >
        {/* Backdrop click to close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-pointer"
        />

        {/* Modal Window: Compact, tightly wrapped card on all devices (Zero empty void!) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-[360px] sm:max-w-[390px] h-auto my-auto bg-zinc-950 border border-[#B5945B]/40 rounded-2xl shadow-2xl z-10 overflow-hidden text-white flex flex-col p-4 sm:p-4.5 space-y-3"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#B5945B] to-transparent" />

          {/* HEADER */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-[#B5945B]/15 rounded-lg border border-[#B5945B]/30 text-[#B5945B]">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base sm:text-lg text-white uppercase tracking-wide">
                    Lịch Chụp
                  </h3>
                  {availableCountInMonth > 0 && !isAdminMode && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                      {availableCountInMonth} ngày trống
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-300 font-medium">
                  {isAdminMode
                    ? "Click ngày để đổi trạng thái"
                    : "Chạm vào ngày màu xanh để chọn ngày"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* MONTH NAVIGATION BAR */}
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.07] rounded-xl px-2.5 py-1.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-white/10 rounded-lg text-zinc-300 hover:text-[#B5945B] transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm sm:text-base text-white uppercase tracking-wider">
                {vietnameseMonths[month]}
              </span>
              <span className="font-mono font-bold text-sm sm:text-base text-[#B5945B]">
                {year}
              </span>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-white/10 rounded-lg text-zinc-300 hover:text-[#B5945B] transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* DAY COLUMN HEADERS: T2 - CN */}
          <div className="grid grid-cols-7 text-center">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((dayName, dIdx) => (
              <span
                key={`day-hdr-${dayName}-${dIdx}`}
                className={`text-xs sm:text-sm font-bold uppercase tracking-wider py-1 ${
                  dayName === "CN" || dayName === "T7"
                    ? "text-[#B5945B]"
                    : "text-zinc-400"
                }`}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* DAYS GRID */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-2">
              <div className="w-6 h-6 border-2 border-t-[#B5945B] border-white/10 rounded-full animate-spin" />
              <span className="text-xs text-zinc-300 font-medium">Đang tải lịch...</span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {gridSlots.map((slot, idx) => {
                if (!slot) {
                  return (
                    <div
                      key={`empty-${year}-${month}-${idx}`}
                      className="h-8 sm:h-9 rounded-lg"
                    />
                  );
                }

                const dateStr = formatDateStr(slot);
                const rawStatus = availableDates[dateStr]?.status;
                const status = rawStatus === undefined ? "available" : rawStatus;
                const isPast = isPastDate(slot);
                const isToday = isTodayDate(slot);
                const isSelected = tempSelectedDate === dateStr;

                let buttonClass = "";
                let isDisabled = true;
                let statusBadge = null;

                if (isPast) {
                  if (isAdminMode) {
                    isDisabled = false;
                    buttonClass =
                      "bg-zinc-900/40 text-zinc-500 border border-white/5 hover:border-white/20";
                  } else {
                    isDisabled = true;
                    buttonClass =
                      "bg-black/25 text-zinc-600 border border-transparent cursor-not-allowed opacity-30";
                  }
                } else if (status === "available") {
                  isDisabled = false;
                  if (isSelected) {
                    buttonClass =
                      "bg-[#B5945B] text-black font-extrabold shadow-md shadow-amber-500/30 border border-[#B5945B] scale-105 z-10";
                    statusBadge = (
                      <span className="w-1.5 h-1.5 rounded-full bg-black mt-0.5" />
                    );
                  } else {
                    buttonClass =
                      "bg-emerald-950/35 hover:bg-emerald-900/50 border border-emerald-500/40 hover:border-emerald-400 text-emerald-200 cursor-pointer shadow-sm";
                    statusBadge = (
                      <span className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
                    );
                  }
                } else {
                  // Booked or unavailable
                  if (isAdminMode) {
                    isDisabled = false;
                    buttonClass =
                      "bg-red-950/40 border border-red-500/40 text-red-300 hover:bg-red-900/50 cursor-pointer";
                  } else {
                    isDisabled = true;
                    buttonClass =
                      "bg-zinc-900/40 border border-white/5 text-zinc-500 cursor-not-allowed opacity-50";
                  }
                  statusBadge = (
                    <Lock className="w-2.5 h-2.5 text-zinc-500 mt-0.5" />
                  );
                }

                return (
                  <button
                    key={`avail-cell-${dateStr}`}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleDateClick(dateStr, rawStatus)}
                    className={`h-9 sm:h-10 rounded-lg flex flex-col items-center justify-center transition-all relative select-none cursor-pointer ${buttonClass}`}
                  >
                    <span
                      className={`text-sm sm:text-base font-bold leading-none ${
                        status !== "available" && !isPast ? "line-through opacity-70" : ""
                      }`}
                    >
                      {slot.getDate()}
                    </span>
                    {statusBadge}
                    {isToday && !isSelected && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#B5945B]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* COMPACT LEGEND BAR */}
          <div className="flex items-center justify-center gap-4 pt-2 pb-1 border-t border-white/[0.06] text-xs text-zinc-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/30" />
              <span>Trống lịch</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
              <span>Đã kín</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-800 opacity-60" />
              <span>Đã qua</span>
            </span>
          </div>

          {/* Alert if no dates available in month */}
          {!isLoading && !hasAnyAvailableInMonth && !isAdminMode && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center gap-2 text-xs sm:text-sm text-amber-200">
              <AlertCircle className="w-4 h-4 text-[#B5945B] shrink-0" />
              <span>Tháng này đã kín hết ngày. Vui lòng chuyển sang tháng sau.</span>
            </div>
          )}

          {/* BOTTOM CONFIRM ACTION */}
          {!isAdminMode ? (
            <div className="pt-1.5 border-t border-white/[0.08] space-y-2">
              {tempSelectedDate ? (
                <>
                  <div className="flex items-center justify-between text-xs sm:text-sm text-zinc-200 px-0.5">
                    <span>Đã chọn:</span>
                    <strong className="text-[#B5945B] font-bold text-sm sm:text-base">
                      {formattedSelectedDateDisplay}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmDate}
                    className="w-full py-3 bg-[#B5945B] hover:bg-[#c4a46b] text-black font-extrabold text-sm uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>XÁC NHẬN CHỌN NGÀY NÀY</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                    <PhoneCall className="w-4 h-4 text-[#B5945B] shrink-0" />
                    <span>Hotline: <strong className="text-white font-mono text-xs sm:text-sm">0365266204</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-200 font-semibold text-xs sm:text-sm rounded-lg transition-all cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full flex items-center justify-between text-xs text-[#B5945B] font-bold uppercase tracking-wide pt-1 border-t border-white/[0.08]">
              <span>Admin: Click ngày để đổi trạng thái</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
