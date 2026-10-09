import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sliders,
  Trash2,
  Edit3,
  Info,
  Check,
  Search,
  Sparkles,
  Sun,
  Moon,
  CalendarDays,
  ShieldCheck,
  RotateCcw,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  collection,
  onSnapshot,
  query,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { useToast } from "../../hooks/useToast";
import { ToastContainer } from "../ToastContainer";
import { ConfirmDialog } from "../ConfirmDialog";
import { DetailedSchedule } from "./SchoolScheduleSync";

export const FAP_GRID_SLOTS = [
  { name: "Slot 1 (7:15 - 9:15)", time: "07:15", period: "morning", shortLabel: "Slot 1" },
  { name: "Slot 2 (9:25 - 11:25)", time: "09:25", period: "morning", shortLabel: "Slot 2" },
  { name: "Slot 3 (12:00 - 14:00)", time: "12:00", period: "afternoon", shortLabel: "Slot 3" },
  { name: "Slot 4 (14:10 - 16:10)", time: "14:10", period: "afternoon", shortLabel: "Slot 4" },
  { name: "Slot 5 (16:20 - 18:20)", time: "16:20", period: "evening", shortLabel: "Slot 5" },
  { name: "Slot 6 (18:30 - 20:30)", time: "18:30", period: "evening", shortLabel: "Slot 6" },
  { name: "Slot 7 (20:30 - 22:30)", time: "20:30", period: "evening", shortLabel: "Slot 7" },
];

interface AvailableDateDoc {
  id: string; // YYYY-MM-DD
  date: string;
  status: "available" | "unavailable" | "booked";
  reason?: string | null;
  blockedSlots?: string[];
  detailedSchedule?: Record<string, DetailedSchedule[]>;
  updatedAt?: any;
}

interface SelectedSlotModal {
  dateStr: string;
  slotTime: string;
  slotName: string;
  currentStatus: "available" | "blocked" | "fap" | "booked";
  existingReason?: string;
  detailedItems?: DetailedSchedule[];
}

export const BookingSlotAvailabilityManager: React.FC = () => {
  const { toasts, showToast } = useToast();

  // Real-time store of availableDates collection
  const [datesMap, setDatesMap] = useState<Record<string, AvailableDateDoc>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Week navigation state (Monday of selected week)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Modals & inspectors
  const [isExpanded, setIsExpanded] = useState(false);
  const [slotModal, setSlotModal] = useState<SelectedSlotModal | null>(null);
  const [modalStatus, setModalStatus] = useState<"available" | "blocked" | "booked">("available");
  const [modalReason, setModalReason] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Batch management state
  const [batchDate, setBatchDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [batchAction, setBatchAction] = useState<"block_all" | "unblock_all" | "block_selected" | "mark_booked">("block_selected");
  const [batchSelectedSlots, setBatchSelectedSlots] = useState<string[]>(["07:15", "09:25"]);
  const [batchReason, setBatchReason] = useState("");

  // Search filter for configured dates list
  const [listSearch, setListSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unavailable" | "booked" | "available">("all");

  // Subscribe to Firestore availableDates
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "availableDates"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const mapped: Record<string, AvailableDateDoc> = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const dVal = data.date || docSnap.id;
          if (dVal) {
            mapped[dVal] = {
              id: docSnap.id,
              date: dVal,
              status: (data.status as any) || "available",
              reason: data.reason || null,
              blockedSlots: data.blockedSlots || [],
              detailedSchedule: data.detailedSchedule || {},
              updatedAt: data.updatedAt,
            };
          }
        });
        setDatesMap(mapped);
        setIsLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "availableDates");
        showToast("Lỗi đồng bộ dữ liệu Firestore", "error");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // Generate 7 days for current week (Mon -> Sun)
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  const formatDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const formatShortDisplay = (d: Date) => {
    const day = String(d.getDate()).padStart(2, "0");
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${m}`;
  };

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const weekDayLabels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

  // Navigation handlers
  const handlePrevWeek = () => {
    const p = new Date(currentWeekStart);
    p.setDate(p.getDate() - 7);
    setCurrentWeekStart(p);
  };

  const handleNextWeek = () => {
    const n = new Date(currentWeekStart);
    n.setDate(n.getDate() + 7);
    setCurrentWeekStart(n);
  };

  const handleTodayWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  const handleJumpToDate = (targetDateStr: string) => {
    if (!targetDateStr) return;
    const parts = targetDateStr.split("-").map(Number);
    if (parts.length !== 3) return;
    const target = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = target.getDay();
    const diff = target.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(target);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  // Helper to determine exact slot status
  const getSlotStatus = (dateStr: string, slotTime: string) => {
    const dayDoc = datesMap[dateStr];
    if (!dayDoc) return { status: "available" as const, reason: "", fapDetails: [] };

    const detailedList = dayDoc.detailedSchedule?.[slotTime] || [];
    const hasFap = detailedList.length > 0;
    const isDayBooked = dayDoc.status === "booked";
    const isFullDayBlocked =
      dayDoc.status === "unavailable" &&
      (!dayDoc.blockedSlots || dayDoc.blockedSlots.length === 0 || dayDoc.blockedSlots.includes("FULL"));
    const isSlotInBlocked = (dayDoc.blockedSlots || []).includes(slotTime);

    if (isDayBooked) {
      return { status: "booked" as const, reason: dayDoc.reason || "Đã đặt cả ngày", fapDetails: detailedList };
    }
    if (isFullDayBlocked) {
      return { status: "blocked" as const, reason: dayDoc.reason || "Khoá cả ngày", fapDetails: detailedList };
    }
    if (isSlotInBlocked) {
      return { status: "blocked" as const, reason: dayDoc.reason || "Khoá ca này", fapDetails: detailedList };
    }
    if (hasFap) {
      return { status: "fap" as const, reason: detailedList[0]?.subject || "Lịch FAP", fapDetails: detailedList };
    }

    return { status: "available" as const, reason: "", fapDetails: [] };
  };

  // Week statistics
  const weekStats = useMemo(() => {
    let availableCount = 0;
    let blockedCount = 0;
    let fapCount = 0;
    let bookedCount = 0;

    weekDays.forEach((d) => {
      const dateStr = formatDateStr(d);
      FAP_GRID_SLOTS.forEach((slot) => {
        const { status } = getSlotStatus(dateStr, slot.time);
        if (status === "available") availableCount++;
        else if (status === "blocked") blockedCount++;
        else if (status === "fap") fapCount++;
        else if (status === "booked") bookedCount++;
      });
    });

    return { availableCount, blockedCount, fapCount, bookedCount, total: 7 * 7 };
  }, [weekDays, datesMap]);

  // Quick 1-click toggle for cell
  const handleQuickToggleSlot = async (e: React.MouseEvent, dateStr: string, slotTime: string) => {
    e.stopPropagation();
    try {
      const { status } = getSlotStatus(dateStr, slotTime);
      const existingDoc = datesMap[dateStr] || {
        id: dateStr,
        date: dateStr,
        status: "available",
        blockedSlots: [],
        detailedSchedule: {},
      };

      let newBlockedSlots = [...(existingDoc.blockedSlots || [])];
      let newDetailedSchedule = { ...(existingDoc.detailedSchedule || {}) };
      let newStatus: "available" | "unavailable" | "booked" = existingDoc.status;

      if (status === "available") {
        // Switch to blocked
        if (!newBlockedSlots.includes(slotTime)) {
          newBlockedSlots.push(slotTime);
        }
        newStatus = "unavailable";
        showToast(`Đã khoá ${slotTime} ngày ${dateStr.split("-").reverse().join("/")}`, "success");
      } else {
        // Unblock: remove from blockedSlots and clear detailedSchedule for this slot if requested
        newBlockedSlots = newBlockedSlots.filter((s) => s !== slotTime && s !== "FULL");
        if (newDetailedSchedule[slotTime]) {
          delete newDetailedSchedule[slotTime];
        }
        if (newBlockedSlots.length === 0 && Object.keys(newDetailedSchedule).length === 0) {
          newStatus = "available";
        }
        showToast(`Đã mở ${slotTime} ngày ${dateStr.split("-").reverse().join("/")}`, "success");
      }

      await setDoc(doc(db, "availableDates", dateStr), {
        date: dateStr,
        status: newStatus,
        reason: existingDoc.reason || null,
        blockedSlots: newBlockedSlots,
        detailedSchedule: newDetailedSchedule,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `availableDates/${dateStr}`);
      showToast("Lỗi khi cập nhật slot!", "error");
    }
  };

  // Open slot modal
  const handleOpenSlotModal = (dateStr: string, slotTime: string) => {
    const slotDef = FAP_GRID_SLOTS.find((s) => s.time === slotTime);
    const { status, reason, fapDetails } = getSlotStatus(dateStr, slotTime);
    const existingDoc = datesMap[dateStr];

    setSlotModal({
      dateStr,
      slotTime,
      slotName: slotDef?.name || `Slot (${slotTime})`,
      currentStatus: status,
      existingReason: reason || existingDoc?.reason || "",
      detailedItems: fapDetails,
    });

    if (status === "booked") setModalStatus("booked");
    else if (status === "blocked" || status === "fap") setModalStatus("blocked");
    else setModalStatus("available");

    setModalReason(reason || existingDoc?.reason || "");
  };

  // Save changes from slot modal
  const handleSaveSlotModal = async () => {
    if (!slotModal) return;
    setIsSaving(true);
    const { dateStr, slotTime } = slotModal;

    try {
      const existingDoc = datesMap[dateStr] || {
        id: dateStr,
        date: dateStr,
        status: "available",
        blockedSlots: [],
        detailedSchedule: {},
      };

      let newBlockedSlots = [...(existingDoc.blockedSlots || [])];
      let newDetailedSchedule = { ...(existingDoc.detailedSchedule || {}) };
      let newStatus: "available" | "unavailable" | "booked" = existingDoc.status;

      if (modalStatus === "available") {
        newBlockedSlots = newBlockedSlots.filter((s) => s !== slotTime && s !== "FULL");
        if (newDetailedSchedule[slotTime]) {
          delete newDetailedSchedule[slotTime];
        }
        if (newBlockedSlots.length === 0 && Object.keys(newDetailedSchedule).length === 0) {
          newStatus = "available";
        }
      } else if (modalStatus === "blocked") {
        if (!newBlockedSlots.includes(slotTime)) {
          newBlockedSlots.push(slotTime);
        }
        newStatus = "unavailable";
      } else if (modalStatus === "booked") {
        if (!newBlockedSlots.includes(slotTime)) {
          newBlockedSlots.push(slotTime);
        }
        newStatus = "booked";
      }

      await setDoc(doc(db, "availableDates", dateStr), {
        date: dateStr,
        status: newStatus,
        reason: modalReason.trim() || null,
        blockedSlots: newBlockedSlots,
        detailedSchedule: newDetailedSchedule,
        updatedAt: serverTimestamp(),
      });

      showToast(`Đã cập nhật trạng thái ${slotModal.slotName}`, "success");
      setSlotModal(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `availableDates/${dateStr}`);
      showToast("Lỗi khi lưu cấu hình slot!", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Date-level quick actions
  const handleDayQuickAction = async (
    dateStr: string,
    action: "unblock_all" | "block_full" | "mark_booked" | "block_morning" | "block_afternoon" | "block_evening"
  ) => {
    try {
      const existingDoc = datesMap[dateStr] || {
        id: dateStr,
        date: dateStr,
        status: "available",
        blockedSlots: [],
        detailedSchedule: {},
      };

      let newStatus: "available" | "unavailable" | "booked" = "available";
      let newBlockedSlots: string[] = [];
      let newReason = existingDoc.reason || null;
      let newDetailedSchedule = { ...(existingDoc.detailedSchedule || {}) };

      if (action === "unblock_all") {
        newStatus = "available";
        newBlockedSlots = [];
        newDetailedSchedule = {};
        newReason = null;
        showToast(`Đã mở toàn bộ ngày ${dateStr.split("-").reverse().join("/")}`, "success");
      } else if (action === "block_full") {
        newStatus = "unavailable";
        newBlockedSlots = ["FULL", ...FAP_GRID_SLOTS.map((s) => s.time)];
        newReason = "Khoá cả ngày bởi Admin";
        showToast(`Đã khoá cả ngày ${dateStr.split("-").reverse().join("/")}`, "success");
      } else if (action === "mark_booked") {
        newStatus = "booked";
        newBlockedSlots = ["FULL", ...FAP_GRID_SLOTS.map((s) => s.time)];
        newReason = "Đã có lịch đặt cả ngày";
        showToast(`Đã đánh dấu ĐÃ ĐẶT ngày ${dateStr.split("-").reverse().join("/")}`, "success");
      } else if (action === "block_morning") {
        newStatus = "unavailable";
        const morningSlots = ["07:15", "09:25"];
        newBlockedSlots = Array.from(new Set([...(existingDoc.blockedSlots || []).filter((s) => s !== "FULL"), ...morningSlots]));
        showToast(`Đã khoá ca sáng ngày ${dateStr.split("-").reverse().join("/")}`, "success");
      } else if (action === "block_afternoon") {
        newStatus = "unavailable";
        const afternoonSlots = ["12:00", "14:10"];
        newBlockedSlots = Array.from(new Set([...(existingDoc.blockedSlots || []).filter((s) => s !== "FULL"), ...afternoonSlots]));
        showToast(`Đã khoá ca chiều ngày ${dateStr.split("-").reverse().join("/")}`, "success");
      } else if (action === "block_evening") {
        newStatus = "unavailable";
        const eveningSlots = ["16:20", "18:30", "20:30"];
        newBlockedSlots = Array.from(new Set([...(existingDoc.blockedSlots || []).filter((s) => s !== "FULL"), ...eveningSlots]));
        showToast(`Đã khoá ca tối ngày ${dateStr.split("-").reverse().join("/")}`, "success");
      }

      await setDoc(doc(db, "availableDates", dateStr), {
        date: dateStr,
        status: newStatus,
        reason: newReason,
        blockedSlots: newBlockedSlots,
        detailedSchedule: newDetailedSchedule,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `availableDates/${dateStr}`);
      showToast("Lỗi khi cập nhật ngày!", "error");
    }
  };

  // Batch action submit
  const handleApplyBatch = async () => {
    if (!batchDate) {
      showToast("Vui lòng chọn ngày cần cấu hình!", "error");
      return;
    }
    setIsSaving(true);
    try {
      const existingDoc = datesMap[batchDate] || {
        id: batchDate,
        date: batchDate,
        status: "available",
        blockedSlots: [],
        detailedSchedule: {},
      };

      let newStatus: "available" | "unavailable" | "booked" = "available";
      let newBlockedSlots: string[] = [];
      let newDetailedSchedule = { ...(existingDoc.detailedSchedule || {}) };

      if (batchAction === "unblock_all") {
        newStatus = "available";
        newBlockedSlots = [];
        newDetailedSchedule = {};
      } else if (batchAction === "block_all") {
        newStatus = "unavailable";
        newBlockedSlots = ["FULL", ...FAP_GRID_SLOTS.map((s) => s.time)];
      } else if (batchAction === "mark_booked") {
        newStatus = "booked";
        newBlockedSlots = ["FULL", ...FAP_GRID_SLOTS.map((s) => s.time)];
      } else if (batchAction === "block_selected") {
        newStatus = "unavailable";
        newBlockedSlots = Array.from(new Set([...(existingDoc.blockedSlots || []).filter((s) => s !== "FULL"), ...batchSelectedSlots]));
      }

      await setDoc(doc(db, "availableDates", batchDate), {
        date: batchDate,
        status: newStatus,
        reason: batchReason.trim() || null,
        blockedSlots: newBlockedSlots,
        detailedSchedule: newDetailedSchedule,
        updatedAt: serverTimestamp(),
      });

      showToast(`Đã áp dụng cấu hình cho ngày ${batchDate.split("-").reverse().join("/")}`, "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `availableDates/${batchDate}`);
      showToast("Lỗi khi áp dụng cấu hình hàng loạt!", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Clear single date document
  const handleClearDateDoc = (dateId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Khôi phục trạng thái trống",
      message: `Bạn có chắc chắn muốn xoá toàn bộ cấu hình khoá và mở lại ngày ${dateId.split("-").reverse().join("/")} không?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "availableDates", dateId));
          showToast(`Đã mở lại ngày ${dateId.split("-").reverse().join("/")}`, "success");
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `availableDates/${dateId}`);
          showToast("Lỗi khi xoá cấu hình!", "error");
        }
      },
    });
  };

  // Filtered configured dates list
  const configuredDatesList = useMemo(() => {
    return (Object.values(datesMap) as AvailableDateDoc[])
      .filter((d) => {
        if (listSearch) {
          const formatted = d.date.split("-").reverse().join("/");
          const matchDate = d.date.includes(listSearch) || formatted.includes(listSearch);
          const matchReason = (d.reason || "").toLowerCase().includes(listSearch.toLowerCase());
          if (!matchDate && !matchReason) return false;
        }
        if (statusFilter !== "all" && d.status !== statusFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [datesMap, listSearch, statusFilter]);

  return (
    <div className={`flex flex-col gap-6 text-zinc-100 font-sans w-full max-w-7xl mx-auto pb-12 ${isExpanded ? "fixed inset-0 z-[99999] bg-black/95 p-4 md:p-8 overflow-y-auto max-w-none" : ""}`}>
      <ToastContainer toasts={toasts} />

      {/* HEADER & CONTROLS */}
      <div className="bg-zinc-950/90 border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#B5945B]/15 text-[#B5945B] rounded-xl border border-[#B5945B]/30 shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Quản lý khả dụng & Slot Booking
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Real-time
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cấu hình trực tiếp trạng thái Trống, Khoá ca hoặc Kín lịch cho từng ngày và từng slot trong bảng đặt lịch.
              </p>
            </div>
          </div>

          {/* Jump to Date & Fullscreen toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title={isExpanded ? "Thu nhỏ về giao diện tab" : "Mở rộng toàn màn hình"}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-[#B5945B]" />
                  <span>Thu nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-[#B5945B]" />
                  <span>Toàn màn hình</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-300">
              <CalendarDays className="w-4 h-4 text-[#B5945B]" />
              <span>Đến ngày:</span>
              <input
                type="date"
                onChange={(e) => handleJumpToDate(e.target.value)}
                className="bg-transparent border-none text-white font-mono text-xs focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* WEEK NAVIGATION & STATS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleTodayWeek}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-semibold text-[#B5945B] hover:text-[#d4b075] transition-colors cursor-pointer"
            >
              Hôm nay
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-xs sm:text-sm font-bold text-white font-mono ml-2">
              Tuần: {formatShortDisplay(weekDays[0])} — {formatShortDisplay(weekDays[6])}/{weekDays[6].getFullYear()}
            </span>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Trống: <strong>{weekStats.availableCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>Đã khoá: <strong>{weekStats.blockedCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Kín FAP: <strong>{weekStats.fapCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <span>Đã đặt: <strong>{weekStats.bookedCount}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* INTERACTIVE BOOKING GRID (7 DAYS X 7 SLOTS) */}
      <div className="bg-[#12131a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-[#B5945B]" />
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar">
          <div className="min-w-[880px] grid grid-cols-8 border-b border-white/10">
            {/* Top-Left Cell: Time Column Header */}
            <div className="p-3 bg-zinc-950/80 border-r border-white/10 flex flex-col justify-center items-center text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#B5945B]" />
                Ca / Giờ
              </span>
              <span className="text-[9px] text-zinc-500 mt-0.5">7 Slot FAP</span>
            </div>

            {/* 7 Days Column Headers */}
            {weekDays.map((dateObj, idx) => {
              const dateStr = formatDateStr(dateObj);
              const isCurrDay = isToday(dateObj);
              const dayDoc = datesMap[dateStr];
              const isFullBlocked =
                dayDoc?.status === "unavailable" &&
                (!dayDoc?.blockedSlots || dayDoc.blockedSlots.includes("FULL"));
              const isBooked = dayDoc?.status === "booked";

              return (
                <div
                  key={`mgr-date-${dateStr}-${idx}`}
                  className={`p-2.5 border-r border-white/10 flex flex-col items-center justify-between transition-colors relative ${
                    isCurrDay
                      ? "bg-[#B5945B]/15 border-b-2 border-b-[#B5945B]"
                      : "bg-zinc-950/60"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className={`text-xs font-bold uppercase ${isCurrDay ? "text-[#B5945B]" : "text-zinc-300"}`}>
                      {weekDayLabels[idx]}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 mt-0.5">
                      {formatShortDisplay(dateObj)}
                    </span>
                    {isCurrDay && (
                      <span className="text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.2 rounded bg-[#B5945B] text-black mt-0.5">
                        Hôm nay
                      </span>
                    )}
                  </div>

                  {/* Day Status Pill & Action Menu */}
                  <div className="mt-2 w-full flex flex-col items-center gap-1">
                    {isBooked ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold truncate max-w-full">
                        Đã đặt ngày
                      </span>
                    ) : isFullBlocked ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold truncate max-w-full">
                        Khoá cả ngày
                      </span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold truncate max-w-full">
                        Khả dụng
                      </span>
                    )}

                    {/* Quick day buttons */}
                    <div className="flex items-center gap-1 mt-1">
                      <button
                        onClick={() => handleDayQuickAction(dateStr, isFullBlocked ? "unblock_all" : "block_full")}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-white/5 cursor-pointer"
                        title={isFullBlocked ? "Mở toàn bộ ngày" : "Khoá cả ngày"}
                      >
                        {isFullBlocked ? "Mở ngày" : "Khoá ngày"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 7 SLOTS ROWS */}
          {FAP_GRID_SLOTS.map((slot, slotIdx) => {
            return (
              <div
                key={`grid-slot-${slot.time}-${slotIdx}`}
                className="min-w-[880px] grid grid-cols-8 border-b border-white/5 hover:bg-white/[0.01] transition-colors"
              >
                {/* Slot Info Left Column */}
                <div className="p-3 bg-zinc-950/70 border-r border-white/10 flex flex-col justify-center">
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    {slot.shortLabel}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    {slot.time}
                  </span>
                  <span className="text-[9px] text-zinc-500 mt-0.5 uppercase tracking-wider">
                    {slot.period === "morning" ? "Sáng" : slot.period === "afternoon" ? "Chiều" : "Tối"}
                  </span>
                </div>

                {/* 7 Days for this Slot */}
                {weekDays.map((dateObj, colIndex) => {
                  const dateStr = formatDateStr(dateObj);
                  const { status, reason, fapDetails } = getSlotStatus(dateStr, slot.time);

                  let cellClasses = "border-r border-white/5 p-2 min-h-[92px] flex flex-col justify-between transition-all duration-150 cursor-pointer relative group ";
                  let badge = null;

                  if (status === "available") {
                    cellClasses += "bg-emerald-950/15 hover:bg-emerald-900/30 border-dashed border-emerald-500/20";
                    badge = (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Trống
                        </span>
                        <button
                          onClick={(e) => handleQuickToggleSlot(e, dateStr, slot.time)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded bg-zinc-800/80 hover:bg-rose-500/30 text-zinc-400 hover:text-rose-300 transition-all cursor-pointer"
                          title="Khoá ca này nhanh"
                        >
                          <Lock className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  } else if (status === "fap") {
                    cellClasses += "bg-amber-950/30 hover:bg-amber-900/40 border border-amber-500/30";
                    const item = fapDetails[0];
                    badge = (
                      <div className="flex flex-col gap-1 w-full overflow-hidden">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1 truncate">
                            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                            Kín FAP
                          </span>
                          <button
                            onClick={(e) => handleQuickToggleSlot(e, dateStr, slot.time)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded bg-zinc-800/80 hover:bg-emerald-500/30 text-zinc-400 hover:text-emerald-300 transition-all cursor-pointer"
                            title="Mở slot (Ghi đè FAP)"
                          >
                            <Unlock className="w-3 h-3" />
                          </button>
                        </div>
                        {item && (
                          <div className="flex flex-col text-[10px] leading-tight text-amber-200/90 truncate">
                            <strong className="font-mono text-white truncate">{item.courseCode}</strong>
                            {item.room && <span className="text-zinc-400 text-[9px] font-mono">P: {item.room}</span>}
                          </div>
                        )}
                      </div>
                    );
                  } else if (status === "booked") {
                    cellClasses += "bg-purple-950/35 hover:bg-purple-900/50 border border-purple-500/30";
                    badge = (
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wide flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-purple-400" />
                            Đã đặt
                          </span>
                          <button
                            onClick={(e) => handleQuickToggleSlot(e, dateStr, slot.time)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded bg-zinc-800/80 hover:bg-emerald-500/30 text-zinc-400 hover:text-emerald-300 transition-all cursor-pointer"
                            title="Mở slot"
                          >
                            <Unlock className="w-3 h-3" />
                          </button>
                        </div>
                        {reason && (
                          <span className="text-[9px] text-zinc-300 truncate font-mono">{reason}</span>
                        )}
                      </div>
                    );
                  } else {
                    // Blocked
                    cellClasses += "bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30";
                    badge = (
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wide flex items-center gap-1">
                            <Lock className="w-3 h-3 text-rose-400" />
                            Đã khoá
                          </span>
                          <button
                            onClick={(e) => handleQuickToggleSlot(e, dateStr, slot.time)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded bg-zinc-800/80 hover:bg-emerald-500/30 text-zinc-400 hover:text-emerald-300 transition-all cursor-pointer"
                            title="Mở slot"
                          >
                            <Unlock className="w-3 h-3" />
                          </button>
                        </div>
                        {reason && (
                          <span className="text-[9px] text-zinc-300 truncate font-mono">{reason}</span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`mgr-cell-${dateStr}-${slot.time}-${colIndex}`}
                      onClick={() => handleOpenSlotModal(dateStr, slot.time)}
                      className={cellClasses}
                    >
                      {badge}

                      {/* Bottom action hint */}
                      <div className="flex items-center justify-between text-[9px] text-zinc-500 pt-1 border-t border-white/5 mt-1">
                        <span>Nhấp chỉnh</span>
                        <span className="opacity-0 group-hover:opacity-100 text-zinc-400 font-mono">
                          {slot.time}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Legend Footer */}
        <div className="p-3.5 bg-zinc-950 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500/40"></div>
              <span className="text-zinc-300">Trống (Khách có thể đặt)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-rose-500/20 border border-rose-500/40"></div>
              <span className="text-zinc-300">Đã khoá (Admin chặn)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-amber-500/20 border border-amber-500/40"></div>
              <span className="text-zinc-300">Kín FAP (Lịch trường/ca học)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded bg-purple-500/20 border border-purple-500/40"></div>
              <span className="text-zinc-300">Đã đặt (Booked)</span>
            </div>
          </div>
          <span className="text-[11px] text-zinc-400 italic">
            * Nhấp chuột vào từng ô để đổi trạng thái chi tiết hoặc nhấp biểu tượng khoá để chuyển nhanh.
          </span>
        </div>
      </div>

      {/* LOWER SECTION: 2 COLUMNS (BATCH ACTION & LIST OF CONFIGURED DATES) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMN 1: BATCH ACTION CONFIGURATOR */}
        <div className="lg:col-span-5 bg-zinc-950/90 border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <div className="p-2 bg-[#B5945B]/15 text-[#B5945B] rounded-lg border border-[#B5945B]/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Cấu hình hàng loạt ngày / ca
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Khoá hoặc mở nhanh nhiều slot cho một ngày nhất định.
              </p>
            </div>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-zinc-300 font-semibold mb-1">
                1. Chọn ngày thực hiện:
              </label>
              <input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-[#B5945B]"
              />
            </div>

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">
                2. Thao tác muốn áp dụng:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBatchAction("block_selected")}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                    batchAction === "block_selected"
                      ? "bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold"
                      : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="font-semibold text-xs">Khoá các slot chọn</span>
                  <span className="text-[10px] opacity-75">Tự chọn slot cụ thể</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchAction("block_all")}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                    batchAction === "block_all"
                      ? "bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold"
                      : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="font-semibold text-xs">Khoá cả ngày (FULL)</span>
                  <span className="text-[10px] opacity-75">Chặn toàn bộ 7 ca</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchAction("unblock_all")}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                    batchAction === "unblock_all"
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold"
                      : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="font-semibold text-xs">Mở toàn bộ ngày</span>
                  <span className="text-[10px] opacity-75">Trống cho khách đặt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBatchAction("mark_booked")}
                  className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                    batchAction === "mark_booked"
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-300 font-bold"
                      : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="font-semibold text-xs">Đã có khách đặt</span>
                  <span className="text-[10px] opacity-75">Đánh dấu Booked</span>
                </button>
              </div>
            </div>

            {batchAction === "block_selected" && (
              <div>
                <label className="block text-zinc-300 font-semibold mb-1.5">
                  Chọn các Slot cần khoá:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {FAP_GRID_SLOTS.map((s, sIdx) => {
                    const isChecked = batchSelectedSlots.includes(s.time);
                    return (
                      <button
                        type="button"
                        key={`batch-slot-${s.time}-${sIdx}`}
                        onClick={() => {
                          setBatchSelectedSlots((prev) =>
                            isChecked ? prev.filter((x) => x !== s.time) : [...prev, s.time]
                          );
                        }}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer ${
                          isChecked
                            ? "bg-rose-500/20 border-rose-500/40 text-rose-300 font-bold"
                            : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span>{s.shortLabel}</span>
                        <span className="text-[10px] font-mono opacity-80">{s.time}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-zinc-300 font-semibold mb-1">
                3. Lý do / Ghi chú (Tuỳ chọn):
              </label>
              <input
                type="text"
                value={batchReason}
                onChange={(e) => setBatchReason(e.target.value)}
                placeholder="Ví dụ: Bận chụp ngoại cảnh THPT, Nghỉ lễ, Sự kiện riêng..."
                className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#B5945B]"
              />
            </div>

            <button
              type="button"
              onClick={handleApplyBatch}
              disabled={isSaving}
              className="w-full py-2.5 bg-[#B5945B] hover:bg-[#d4b075] text-black font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Áp dụng cấu hình ngay
            </button>
          </div>
        </div>

        {/* COLUMN 2: LIST OF ALL OVERRIDDEN / CONFIGURED DATES */}
        <div className="lg:col-span-7 bg-zinc-950/90 border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-zinc-800 text-zinc-300 rounded-lg">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  Danh sách ngày đã cấu hình
                  <span className="bg-white/10 px-2 py-0.5 rounded-full text-[11px] font-mono">
                    {configuredDatesList.length}
                  </span>
                </h3>
              </div>
            </div>

            {/* Filter & Search */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Tìm ngày, ghi chú..."
                  className="pl-8 pr-3 py-1 bg-zinc-900 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-[#B5945B] w-36 sm:w-44"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2 py-1 bg-zinc-900 border border-white/10 rounded-lg text-xs text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="all">Tất cả</option>
                <option value="unavailable">Khoá</option>
                <option value="booked">Đã đặt</option>
                <option value="available">Trống</option>
              </select>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {configuredDatesList.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs italic">
                Chưa có ngày nào được tuỳ chỉnh cấu hình. Bảng lịch đang sử dụng trạng thái mặc định.
              </div>
            ) : (
              configuredDatesList.map((item, itemIdx) => {
                const isFull =
                  item.status === "unavailable" &&
                  (!item.blockedSlots || item.blockedSlots.includes("FULL"));
                const hasDetailedFap = item.detailedSchedule && Object.keys(item.detailedSchedule).length > 0;

                return (
                  <div
                    key={`configured-item-${item.id || item.date || itemIdx}-${itemIdx}`}
                    className="p-3 bg-zinc-900/60 hover:bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-white">
                          {item.date.split("-").reverse().join("/")}
                        </span>

                        {item.status === "booked" ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                            Đã đặt
                          </span>
                        ) : isFull ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                            Khoá cả ngày
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 font-semibold border border-rose-500/20">
                            Khoá {item.blockedSlots?.length || 0} slot
                          </span>
                        )}

                        {hasDetailedFap && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                            FAP ({Object.keys(item.detailedSchedule || {}).length} ca)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 flex-wrap">
                        {item.blockedSlots && item.blockedSlots.length > 0 && !isFull && (
                          <span className="text-zinc-400 font-mono">
                            Slot: {item.blockedSlots.join(", ")}
                          </span>
                        )}
                        {item.reason && (
                          <span className="text-zinc-300 italic truncate">
                            • {item.reason}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleJumpToDate(item.date)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                        title="Xem tuần này trên lưới"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleClearDateDoc(item.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                        title="Khôi phục trạng thái trống"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SLOT DETAIL & ACTION MODAL */}
      <AnimatePresence>
        {slotModal && (
          <div key="slot-availability-modal" className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#14151f] border border-white/15 rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-zinc-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between pb-4 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#B5945B]/20 text-[#B5945B] border border-[#B5945B]/30">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      Cấu hình Slot: {slotModal.slotName}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      Ngày {slotModal.dateStr.split("-").reverse().join("/")} ({slotModal.slotTime})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSlotModal(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Selector */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-2">
                    Trạng thái khả dụng của Slot:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalStatus("available")}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        modalStatus === "available"
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-md shadow-emerald-500/10"
                          : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Trống</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalStatus("blocked")}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        modalStatus === "blocked"
                          ? "bg-rose-500/20 border-rose-500 text-rose-300 font-bold shadow-md shadow-rose-500/10"
                          : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Lock className="w-4 h-4 text-rose-400" />
                      <span>Khoá ca</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalStatus("booked")}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        modalStatus === "booked"
                          ? "bg-purple-500/20 border-purple-500 text-purple-300 font-bold shadow-md shadow-purple-500/10"
                          : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span>Đã đặt</span>
                    </button>
                  </div>
                </div>

                {/* Reason input */}
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Ghi chú / Lý do:
                  </label>
                  <input
                    type="text"
                    value={modalReason}
                    onChange={(e) => setModalReason(e.target.value)}
                    placeholder="Ví dụ: Bận chụp ngoại cảnh, Khách đặt offline, Nghỉ ca..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#B5945B]"
                  />
                </div>

                {/* Existing FAP info if present */}
                {slotModal.detailedItems && slotModal.detailedItems.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-center gap-2 text-amber-300 font-bold mb-1.5">
                      <Info className="w-3.5 h-3.5" />
                      <span>Chi tiết từ FAP / Đồng bộ:</span>
                    </div>
                    {slotModal.detailedItems.map((item, idx) => (
                      <div key={`fap-modal-item-${item.courseCode || idx}-${idx}`} className="text-[11px] text-zinc-300 space-y-0.5">
                        <div className="text-white font-semibold">{item.courseCode} - {item.subject}</div>
                        {item.room && <div>Phòng: <span className="font-mono text-amber-300">{item.room}</span> {item.teacher ? `| GV: ${item.teacher}` : ""}</div>}
                      </div>
                    ))}
                    <p className="text-[10px] text-amber-200/80 mt-2 italic">
                      * Nếu bạn chọn &quot;Trống&quot;, slot này sẽ được mở cho khách đặt bất chấp lịch học FAP.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 mt-5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSlotModal(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={handleSaveSlotModal}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-[#B5945B] hover:bg-[#d4b075] text-black text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Lưu thay đổi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
