import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar,
  Users,
  Instagram,
  Send,
  CheckCircle2,
  Trash2,
  MapPin,
  Sparkles,
  Check,
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  LogOut,
  KeyRound,
  RefreshCw,
  Coins,
  Download,
  Mail,
  Palette,
  Search,
  ExternalLink,
  Clock,
  AlertTriangle,
  User,
  Phone,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SlideData, Booking } from "../types";
import { SubtleConfetti } from "./SubtleConfetti";
import { EventScheduleModal } from "./EventScheduleModal";
import {
  getBookedIntervalsForDate,
  timeToMinutes,
  minutesToTime,
  isMinuteBooked,
  isRangeOverlapping,
  ALL_TIME_OPTIONS,
} from "../utils/eventScheduleHelper";
import { onAuthStateChanged } from "firebase/auth";
import {
  db,
  handleFirestoreError,
  OperationType,
  auth,
  googleSignIn,
  getAccessToken,
  initAuth,
  markFirestoreQuotaExceeded,
  isFirestoreQuotaExceeded,
} from "../firebase";
import { resolveImage } from "../utils/imageMapper";
import { useToast } from "../hooks/useToast";
import { ToastContainer } from "./ToastContainer";

const AvailabilityCalendar = React.lazy(() =>
  import("./AvailabilityCalendar").then((m) => ({ default: m.AvailabilityCalendar }))
);
const FapWeeklyCalendar = React.lazy(() =>
  import("./FapWeeklyCalendar").then((m) => ({ default: m.FapWeeklyCalendar }))
);

const AdminDashboard = React.lazy(() =>
  import("./AdminDashboard").then((m) => ({ default: m.AdminDashboard }))
);
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

const TWENTY_FOUR_HOUR_SLOTS = [
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
];

const getActivePrice = (size: number, isFull: boolean) => {
  if (size === 1) return isFull ? 1500000 : 900000;
  if (size === 2) return isFull ? 800000 : 700000;
  if (size === 3) return isFull ? 700000 : 600000;
  if (size <= 5) return isFull ? 600000 : 500000;
  return isFull ? 600000 : 500000;
};

const formatDateDMY = (dateStr?: string) => {
  if (!dateStr) return "Chưa có";
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts[0].length <= 2 && parts[2]?.length === 4) {
      return dateStr;
    }
  }
  const separator = dateStr.includes("-") ? "-" : "/";
  const parts = dateStr.split(separator);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [y, m, d] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    } else if (parts[2].length === 4) {
      const [d, m, y] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
  }
  return dateStr;
};

const getConceptVietnameseName = (concept?: string) => {
  if (concept === "THPT") return "Kỷ yếu THPT";
  if (concept === "University") return "Gói PRE-GRADUATION";
  if (concept === "Event") return "Event & Prom Night";
  if (concept === "Custom") return "Theo yêu cầu";
  return concept || "";
};

interface BookingContactFormProps {
  slide: SlideData;
  isAdminGlobal?: boolean;
  isLoggedAdmin?: boolean;
}

export const BookingContactForm: React.FC<BookingContactFormProps> = ({
  slide,
  isAdminGlobal,
  isLoggedAdmin,
}) => {
  const { toasts, showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [successMsg, setSuccessMsg] = useState(false);
  const [submittedData, setSubmittedData] = useState<{ id: string; concept: string; deposit: number; hasConfirmedPayment: boolean; customerEmail?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    if (isAdminGlobal !== undefined) {
      setIsAdminMode((prev) => (prev !== isAdminGlobal ? isAdminGlobal : prev));
    }
  }, [isAdminGlobal]);

  const [adminNotification, setAdminNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // Custom visual state-based confirmation modal to bypass iframe window.confirm blocks
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void,
    confirmText = "Xác nhận",
    cancelText = "Hủy",
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      onCancel,
      confirmText,
      cancelText,
    });
  };

  useEffect(() => {
    const fetchToken = async () => {
      const t = await getAccessToken();
      if (t) setGoogleToken(t);
    };
    const unsubscribe = initAuth(
      (user, t) => {
        setGoogleToken(t);
      },
      () => {
        setGoogleToken(null);
      },
    );
    fetchToken();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const syncingIdsRef = useRef<Set<string>>(new Set());

  // Auto-sync missing calendar events for bookings that were auto-approved (e.g. by SePay check)
  useEffect(() => {
    if (isAdminMode && googleToken && bookings.length > 0) {
      const unsyncedApproved = bookings.filter(
        (b) => b.status === "Đã duyệt" && (!b.googleEventId || !b.googleTaskId) && !syncingIdsRef.current.has(b.id)
      );
      if (unsyncedApproved.length > 0) {
        unsyncedApproved.forEach((b) => syncingIdsRef.current.add(b.id));
        const syncQuietly = async () => {
          let count = 0;
          for (const b of unsyncedApproved) {
            let updatedEventId = b.googleEventId || "";
            let updatedTaskId = b.googleTaskId || "";
            try {
              if (!b.googleEventId) {
                const eventData = await syncToGoogleCalendar(b, googleToken);
                updatedEventId = eventData.id;
              }
              if (!b.googleTaskId) {
                const taskData = await syncToGoogleTasks(b, googleToken);
                updatedTaskId = taskData.id;
              }
              await setDoc(doc(db, "bookings", b.id), {
                ...b,
                googleEventId: updatedEventId,
                googleTaskId: updatedTaskId,
              }, { merge: true });
              if (b.date) {
                await setDoc(doc(db, "availableDates", b.date), { date: b.date, status: "booked" }, { merge: true });
              }
              count++;
            } catch (err: any) {
              const errMsg = err?.message || String(err);
              console.warn("Auto-sync error for booking", b.id, errMsg);
            }
          }
          if (count > 0) {
             showToast(`Đã tự động đồng bộ ${count} đơn thanh toán tự động lên Calendar/Tasks!`, "success");
          }
        };
        syncQuietly();
      }
    }
  }, [isAdminMode, googleToken, bookings.length]);

  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Form fields
  const [schoolName, setSchoolName] = useState("");
  const [classSize, setClassSize] = useState<number>(3);
  const [date, setDate] = useState("");
  const [conceptType, setConceptType] = useState<
    "THPT" | "University" | "Event" | "Custom"
  >("THPT");
  const [timeSlots, setTimeSlots] = useState<number[]>([]);
  const [thptShift, setThptShift] = useState("Nửa ngày sáng (7h00 - 11h00)");
  const [gradTime, setGradTime] = useState("08:00");
  const [eventTime, setEventTime] = useState("14:00");
  const [eventStartTime, setEventStartTime] = useState("17:00");
  const [eventEndTime, setEventEndTime] = useState("22:00");
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [availableDatesMap, setAvailableDatesMap] = useState<Record<string, any>>({});
  const [contactHandle, setContactHandle] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [customRequest, setCustomRequest] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isFapCalendarOpen, setIsFapCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Subscribe to availableDates in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "availableDates"), (snap) => {
      const m: Record<string, any> = {};
      snap.forEach((d) => {
        m[d.id] = d.data();
      });
      setAvailableDatesMap(m);
    });
    return () => unsub();
  }, []);

  const eventBookedIntervals = useMemo(() => {
    if (conceptType !== "Event" || !date) return [];
    return getBookedIntervalsForDate(date, bookings, availableDatesMap);
  }, [conceptType, date, bookings, availableDatesMap]);
  const [estimateShift, setEstimateShift] = useState<"half" | "full">("half");
  const [showPriceTable, setShowPriceTable] = useState(true);
  const [showFullPriceModal, setShowFullPriceModal] = useState(false);
  const [bookingSource, setBookingSource] = useState<"website" | "chatbot">(
    "website",
  );

  const TIME_SLOTS = [
    { id: 1, name: "Slot 1", time: "07:15 - 09:15" },
    { id: 2, name: "Slot 2", time: "09:25 - 11:25" },
    { id: 3, name: "Slot 3", time: "12:00 - 14:00" },
    { id: 4, name: "Slot 4", time: "14:10 - 16:10" },
    { id: 5, name: "Slot 5", time: "16:20 - 18:20" },
    { id: 6, name: "Slot 6", time: "18:30 - 20:30" },
  ];

  const getMonday = (d: Date) => {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(dt.setDate(diff));
  };

  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [showTimetable, setShowTimetable] = useState(false);

  const daysOfWeek = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const nextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const prevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  // Update default expected quantity dynamically when conceptType changes
  useEffect(() => {
    if (conceptType === "Event") {
      setClassSize((prev) => (prev === 100 ? prev : 100));
    } else {
      setClassSize((prev) => (prev <= 15 ? prev : 3));
    }
  }, [conceptType]);

  const handleEstimateShiftChange = (shift: "half" | "full") => {
    setEstimateShift(shift);
    if (conceptType === "THPT") {
      setThptShift(shift === "full" ? "Cả ngày (7h00 - 17h00)" : "Nửa ngày sáng (7h00 - 11h00)");
    }
  };

  const handleThptShiftChange = (shift: string) => {
    setThptShift(shift);
    setEstimateShift(shift.includes("Cả ngày") ? "full" : "half");
  };

  // Safe tracking for user's own bookings using localStorage
  const [myBookingIds, setMyBookingIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("my_booking_ids");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isFormCollapsedOnMobile, setIsFormCollapsedOnMobile] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      setIsFormCollapsedOnMobile(false);
      if (e.detail?.source) setBookingSource(e.detail.source);
      if (e.detail?.prefill) {
        const pf = e.detail.prefill;
        if (pf.date) setDate(pf.date);
        if (pf.conceptType) setConceptType(pf.conceptType);
        if (pf.schoolName) setSchoolName(pf.schoolName);
        if (pf.phone) setContactHandle(pf.phone);
        if (pf.customRequest) setCustomRequest(pf.customRequest);
        if (pf.notes) setNotes(pf.notes);
      }
    };
    window.addEventListener("openBookingForm", handler);
    return () => window.removeEventListener("openBookingForm", handler);
  }, []);

  // Handle deep-linked booking from URL
  useEffect(() => {
    if (bookings.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const bookingId = urlParams.get("bookingId");
      if (bookingId) {
        const element = document.getElementById("booking-card-" + bookingId);
        if (element && !element.hasAttribute("data-scrolled")) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.setAttribute("data-scrolled", "true");
            element.style.outline = "2px solid #B5945B";
            element.style.outlineOffset = "4px";
          }, 100);
        }
      }
    }
  }, [bookings]);

  // Load and listen to bookings from Firestore in real-time
  useEffect(() => {
    const bookingsCollection = collection(db, "bookings");
    const q = query(bookingsCollection);

    // Subscribe to real-time changes
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedBookings: Booking[] = [];
        snapshot.forEach((doc) => {
          fetchedBookings.push(doc.data() as Booking);
        });

        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const nowTime = now.getTime();

        fetchedBookings.sort((a, b) => {
          const parseDate = (dateVal: any) => {
            if (dateVal && dateVal.toMillis) return dateVal.toMillis();
            const dateStr =
              typeof dateVal === "string" ? dateVal : String(dateVal);
            if (!dateStr) return 0;
            // Handle YYYY-MM-DD or ISO strings
            if (
              dateStr.includes("T") ||
              (dateStr.includes("-") && dateStr.split("-")[0].length === 4)
            ) {
              const dt = new Date(dateStr);
              if (!isNaN(dt.getTime())) return dt.getTime();
            }
            // Handle DD/MM/YYYY
            const parts = dateStr.split("/");
            if (parts.length === 3) {
              return new Date(
                Number(parts[2]),
                Number(parts[1]) - 1,
                Number(parts[0]),
              ).getTime();
            }
            return 0;
          };

          const timeA = parseDate(a.date);
          const timeB = parseDate(b.date);
          const createdA = parseDate(a.createdAt);
          const createdB = parseDate(b.createdAt);

          const isPastA = timeA < nowTime;
          const isPastB = timeB < nowTime;

          if (isPastA && !isPastB) return 1;
          if (!isPastA && isPastB) return -1;

          if (!isPastA && !isPastB) {
            // Both are future: sort ascending (nearest first)
            if (timeA !== timeB) return timeA - timeB;
          } else {
            // Both are past: sort descending (most recent past first)
            if (timeA !== timeB) return timeB - timeA;
          }

          return createdB - createdA;
        });

        setBookings(fetchedBookings);
      },
      (error: any) => {
        if (
          error?.code === "resource-exhausted" ||
          error?.message?.includes("Quota limit exceeded")
        ) {
          markFirestoreQuotaExceeded();
          return;
        }
        handleFirestoreError(error, OperationType.LIST, "bookings");
      },
    );

    return () => unsubscribe();
  }, []);

  // Sync a booking to Google Calendar using Google API
  const syncToGoogleCalendar = async (booking: Booking, token: string) => {
    let slot = booking.timeSlot || "";
    const numId = parseInt(slot, 10);
    if (!isNaN(numId) && numId >= 1 && numId <= 6) {
      const found = TIME_SLOTS.find((s) => s.id === numId);
      if (found) {
        slot = `${found.name} (${found.time})`;
      }
    }

    // Determine start/end times based on booking date and timeSlot
    let startDateTime = `${booking.date}T08:00:00`;
    let endDateTime = `${booking.date}T11:00:00`;

    // Try to match"HH:MM - HH:MM"or"HHhMM - HHhMM"in slot
    const colonMatch = slot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    const hMatch = slot.match(/(\d+)h(\d*)\s*-\s*(\d+)h(\d*)/);

    if (colonMatch) {
      const startH = colonMatch[1].padStart(2, "0");
      const startM = colonMatch[2];
      const endH = colonMatch[3].padStart(2, "0");
      const endM = colonMatch[4];
      startDateTime = `${booking.date}T${startH}:${startM}:00`;
      endDateTime = `${booking.date}T${endH}:${endM}:00`;
    } else if (hMatch) {
      const startH = hMatch[1].padStart(2, "0");
      const startM = (hMatch[2] || "00").padEnd(2, "0");
      const endH = hMatch[3].padStart(2, "0");
      const endM = (hMatch[4] || "00").padEnd(2, "0");
      startDateTime = `${booking.date}T${startH}:${startM}:00`;
      endDateTime = `${booking.date}T${endH}:${endM}:00`;
    } else if (slot.toLowerCase().includes("cả ngày")) {
      startDateTime = `${booking.date}T07:00:00`;
      endDateTime = `${booking.date}T17:00:00`;
    } else if (slot.toLowerCase().includes("nửa ngày chiều")) {
      startDateTime = `${booking.date}T13:00:00`;
      endDateTime = `${booking.date}T17:00:00`;
    } else {
      const timeMatch = slot.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const h = timeMatch[1].padStart(2, "0");
        const m = timeMatch[2];
        startDateTime = `${booking.date}T${h}:${m}:00`;
        const endHour = (parseInt(h) + 4).toString().padStart(2, "0");
        endDateTime = `${booking.date}T${endHour}:${m}:00`;
      }
    }

    const packageLabel = getConceptVietnameseName(booking.conceptType);
    const eventTitle = `[BERGH.RYKER] [${packageLabel}] [Ca: ${slot}] - ${booking.schoolName}`;
    const pricingUnit =
      booking.conceptType === "THPT" || booking.conceptType === "University"
        ? getActivePrice(
            booking.classSize,
            booking.timeSlot?.toLowerCase().includes("cả ngày") || false,
          )
        : 0;
    const pricingText =
      pricingUnit > 0
        ? `• Tổng tạm tính (${booking.classSize} người): ${(booking.classSize * pricingUnit).toLocaleString("vi-VN")} đ (Đơn giá: ${(pricingUnit / 1000).toLocaleString("vi-VN")}k/người)`
        : `• Gói chụp: ${packageLabel}. Chi phí cụ thể sẽ được tư vấn trực tiếp`;

    const eventDescription = `=== THÔNG TIN ĐẶT LỊCH ===
• Khách hàng: ${booking.schoolName}
• Quy mô nhóm: ${booking.classSize} người
• Gói chụp / Concept: ${packageLabel}
• Thời gian chụp: ${slot}
• Ngày chụp: ${formatDateDMY(booking.date)}
• Địa chỉ: ${booking.address || "Chưa có"}
• Liên hệ (Zalo/Insta): ${booking.instagramOrZalo}
• Số điện thoại: ${booking.phone || "Chưa có"}
• Lưu ý / Ghi chú: ${booking.notes || "Không có"}
• Yêu cầu concept riêng: ${booking.customRequest || "Không có"}
${pricingText}

Đã duyệt từ Website hệ thống Bergh.Ryker.
Mã Booking: ${booking.id}
Tạo lúc: ${new Date(booking.createdAt?.toMillis ? booking.createdAt.toMillis() : booking.createdAt).toLocaleString("vi-VN")}`;

    const eventBody = {
      summary: eventTitle,
      location: booking.address || "Địa điểm thoả thuận",
      description: eventDescription,
      start: {
        dateTime: startDateTime,
        timeZone: "Asia/Ho_Chi_Minh",
      },
      end: {
        dateTime: endDateTime,
        timeZone: "Asia/Ho_Chi_Minh",
      },
      status: "confirmed",
      reminders: {
        useDefault: true,
      },
    };

    const method = booking.googleEventId ? "PUT" : "POST";
    const endpoint = booking.googleEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.googleEventId}`
      : "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    const res = await fetch(endpoint, {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    });

    if (!res.ok) {
      const errRes = await res.json().catch(() => ({}));
      const msg = errRes.error?.message || "Lỗi API Google Calendar";
      if (res.status === 401) {
        throw new Error(`[401] Unauthorized: ${msg}`);
      }
      throw new Error(msg);
    }

    return await res.json();
  };

  // Sync a booking to Google Tasks using Google REST API
  const syncToGoogleTasks = async (booking: Booking, token: string) => {
    let slot = booking.timeSlot || "";
    const numId = parseInt(slot, 10);
    if (!isNaN(numId) && numId >= 1 && numId <= 6) {
      const found = TIME_SLOTS.find((s) => s.id === numId);
      if (found) {
        slot = `${found.name} (${found.time})`;
      }
    }

    const packageLabel = getConceptVietnameseName(booking.conceptType);
    const taskTitle = `Chụp ảnh: ${booking.schoolName} - [${packageLabel}] [Ca: ${slot}]`;
    const pricingUnit =
      booking.conceptType === "THPT" || booking.conceptType === "University"
        ? getActivePrice(
            booking.classSize,
            booking.timeSlot?.toLowerCase().includes("cả ngày") || false,
          )
        : 0;
    const pricingText =
      pricingUnit > 0
        ? `• Tổng tạm tính (${booking.classSize} người): ${(booking.classSize * pricingUnit).toLocaleString("vi-VN")} đ`
        : `• Gói chụp: ${packageLabel}`;

    const taskNotes = `=== NHIỆM VỤ CHỤP ẢNH ===
• Khách hàng: ${booking.schoolName}
• Quy mô: ${booking.classSize} người
• Gói chụp / Concept: ${packageLabel}
• Ca chụp: ${slot}
• Ngày chụp: ${formatDateDMY(booking.date)}
• Địa chỉ: ${booking.address || "Chưa có"}
• SĐT: ${booking.phone || "Chưa có"}
• Liên hệ (Zalo/Insta): ${booking.instagramOrZalo}
• Ghi chú: ${booking.notes || "Không có"}
${pricingText}

Đã duyệt từ Website hệ thống Bergh.Ryker.
Mã Booking: ${booking.id}`;

    // Google Tasks supports due dates in YYYY-MM-DDTHH:MM:SS.SSSZ format (UTC)
    let dueString: string | undefined = undefined;
    if (booking.date) {
      dueString = `${booking.date}T12:00:00.000Z`;
    }

    const taskBody = {
      ...(booking.googleTaskId ? { id: booking.googleTaskId } : {}),
      title: taskTitle,
      notes: taskNotes,
      ...(dueString ? { due: dueString } : {}),
    };

    const method = booking.googleTaskId ? "PUT" : "POST";
    const endpoint = booking.googleTaskId
      ? `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${booking.googleTaskId}`
      : "https://www.googleapis.com/tasks/v1/lists/@default/tasks";

    const res = await fetch(endpoint, {
      method: method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(taskBody),
    });

    if (!res.ok) {
      const errRes = await res.json().catch(() => ({}));
      const msg = errRes?.error?.message || "Lỗi API Google Tasks";
      console.warn("Lỗi API Google Tasks:", msg);
      if (res.status === 401) {
        throw new Error(`[401] Unauthorized: ${msg}`);
      }
      throw new Error(msg);
    }

    return await res.json();
  };

  // Finalizer helper to update Firestore booking and dates
  const finalizeBookingStatus = async (
    id: string,
    target: Booking,
    newStatus: Booking["status"],
    updatedGoogleEventId: string,
    updatedGoogleTaskId?: string,
  ) => {
    try {
      if (newStatus === "Đã duyệt" && !(target as any).emailSent) {
         let estCostText = (target as any).estimatedCost;
         if (!estCostText) {
           if (target.conceptType === "THPT" || target.conceptType === "University") {
             const isFull = target.timeSlot?.toLowerCase().includes("cả ngày") || false;
             const uPrice = getActivePrice(target.classSize || 1, isFull);
             const tPrice = (target.classSize || 1) * uPrice;
             estCostText = `${tPrice.toLocaleString("vi-VN")}đ (Đơn giá: ${(uPrice / 1000).toLocaleString("vi-VN")}k/người cho nhóm ${target.classSize || 1} người)`;
           } else if (target.conceptType === "Event") {
             estCostText = "Sẽ tư vấn & báo giá chi tiết dựa trên quy mô sự kiện";
           } else {
             estCostText = "Sẽ tư vấn & báo giá chi tiết dựa trên yêu cầu concept riêng";
           }
         }

         const mailPayload: Record<string, any> = {
           _captcha: "false",
           _subject: `✅ ĐÃ DUYỆT & KHOÁ LỊCH - ĐƠN ĐẶT LỊCH TỪ: ${target.schoolName || id}`,
           _template: "box",
           id: id,
           bookingId: id,
           email: target.email || undefined,
           customerEmail: target.email || undefined,
           _isPaymentApproved: true,
           "✨ Trạng thái": "HỆ THỐNG ĐÃ DUYỆT VÀ TẠO LỊCH",
           "🎟️ Mã Booking": id,
           "💰 5b. TẠM TÍNH CHI PHÍ": estCostText,
           "✨ 1. TÊN KHÁCH HÀNG / TỔ CHỨC": target.schoolName || "(Chưa rõ)",
           "🎯 2. CONCEPT MONG MUỐN": target.conceptType || "(Chưa rõ)",
           "🔥 3. SỐ LƯỢNG NGƯỜI": target.conceptType === "Event" ? "(Không áp dụng)" : `${target.classSize || 0} người`,
           "📅 4. NGÀY CHỤP (Dự kiến)": target.date ? `${target.date.split("-").reverse().join("/")}` : "(Chưa chọn ngày)",
           "⏰ 5. CA CHỤP / THỜI GIAN": target.timeSlot || "Cả ngày",
           "📱 6. INFO LIÊN HỆ (Zalo / Instagram)": target.instagramOrZalo || "(Không có)",
           "📍 6b. ĐỊA CHỈ LIÊN HỆ": target.address || "(Không có)",
           "💌 7. LỊCH TRÌNH / LỜI NHẮN": target.notes?.trim() ? target.notes : "(Trống)",
         };
         fetch("/api/send-email", {
           method: "POST",
           headers: { "Content-Type": "application/json", Accept: "application/json" },
           body: JSON.stringify(mailPayload),
         }).catch(err => console.warn("[Email Notification] Could not dispatch email via proxy:", err));
      }

      await setDoc(doc(db, "bookings", id), {
        ...target,
        status: newStatus,
        googleEventId: updatedGoogleEventId,
        ...(updatedGoogleTaskId !== undefined
          ? { googleTaskId: updatedGoogleTaskId }
          : {}),
        ...(newStatus === "Đã duyệt" ? { emailSent: true } : {})
      });

      if (
        (newStatus === "Đã duyệt" || newStatus === "Chờ duyệt") &&
        target.date
      ) {
        await setDoc(
          doc(db, "availableDates", target.date),
          {
            date: target.date,
            status: "booked",
          },
          { merge: true },
        );
      } else if (newStatus === "Từ chối" && target.date) {
        const otherActive = bookings.filter(
          (b) =>
            b.id !== id && b.date === target.date && b.status !== "Từ chối",
        );
        if (otherActive.length === 0) {
          await setDoc(
            doc(db, "availableDates", target.date),
            {
              date: target.date,
              status: "available",
            },
            { merge: true },
          );
        }
      }
      showToast(
        `Đã chuyển trạng thái đặt lịch sang"${newStatus}"thành công!`,
        "success",
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${id}`);
    }
  };

  // Modern state-driven status updater that completely avoids window.confirm blockers
  const updateBookingStatus = async (
    id: string,
    newStatus: Booking["status"],
  ) => {
    if (!isLoggedAdmin) {
      showToast("Chỉ quản trị viên mới có quyền duyệt lịch trình!", "error");
      return;
    }
    const target = bookings.find((b) => b.id === id);
    if (!target) return;

    if (newStatus === "Đã duyệt") {
      let activeToken = googleToken ?? (await getAccessToken());
      if (!activeToken) {
        triggerConfirm(
          "Yêu cầu cấp quyền Google Calendar & Tasks",
          "Hệ thống Bergh.Ryker cần liên kết Google Calendar của bạn để tự động đẩy và đồng bộ lịch trình cùng Việc cần làm (Google Tasks). Vui lòng chọn Xác nhận để liên kết với tài khoản Google admin của bạn.",
          async () => {
            try {
              const signinRes = await googleSignIn();
              if (signinRes && signinRes.accessToken) {
                setGoogleToken(signinRes.accessToken);
                proceedWithApproval(id, target, signinRes.accessToken);
              } else {
                showToast("Xác thực Google thất bại.", "error");
              }
            } catch (err: any) {
              showToast("Đăng nhập Google thất bại:" + err.message, "error");
            }
          },
          () => {
            showToast(
              "Bị từ chối đồng bộ Google Calendar & Tasks do không được duyệt quyền.",
              "error",
            );
          },
          "Xác thực",
          "Hủy",
        );
      } else {
        proceedWithApproval(id, target, activeToken);
      }
    } else if (newStatus === "Từ chối") {
      if (target.googleEventId || target.googleTaskId) {
        let activeToken = googleToken ?? (await getAccessToken());

        const showDeleteConfirm = (token: string) => {
          triggerConfirm(
            "Xóa Sự Kiện & Việc Cần Làm Khỏi Google",
            "Đơn đặt lịch này đã từng đồng bộ lên Google trước đó. Bạn có muốn XÓA sự kiện này khỏi lịch Google và danh sách Việc cần làm không?",
            async () => {
              // Deleting Calendar
              if (target.googleEventId) {
                try {
                  showToast("Đang xóa sự kiện khỏi Google Calendar...", "info");
                  await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${target.googleEventId}`,
                    {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );
                  showToast("Đã xóa sự kiện thành công!", "success");
                } catch (e: any) {
                  console.error("Gặp lỗi khi xóa sự kiện Calendar:", e);
                  showToast(
                    "Không thể tự động xóa sự kiện khỏi Lịch:" + e.message,
                    "error",
                  );
                }
              }
              // Deleting Tasks
              if (target.googleTaskId) {
                try {
                  showToast(
                    "Đang xóa việc cần làm khỏi Google Tasks...",
                    "info",
                  );
                  await fetch(
                    `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${target.googleTaskId}`,
                    {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    },
                  );
                  showToast(
                    "Đã xóa việc cần làm khỏi Google Tasks thành công!",
                    "success",
                  );
                } catch (e: any) {
                  console.error("Gặp lỗi khi xóa Google Task:", e);
                  showToast(
                    "Không thể tự động xóa việc cần làm:" + e.message,
                    "error",
                  );
                }
              }
              await finalizeBookingStatus(id, target, "Từ chối", "", "");
            },
            async () => {
              await finalizeBookingStatus(
                id,
                target,
                "Từ chối",
                target.googleEventId || "",
                target.googleTaskId || "",
              );
            },
            "Xóa",
            "Giữ lại",
          );
        };

        if (activeToken) {
          showDeleteConfirm(activeToken);
        } else {
          triggerConfirm(
            "Yêu cầu cấp quyền Google Calendar & Tasks",
            "Đơn đặt lịch này ĐÃ ĐƯỢC ĐỒNG BỘ lên Google. Để XÓA nó khỏi nền tảng Google, hệ thống cần quyền truy cập. Nếu bạn không cấp quyền, đơn sẽ chỉ bị đổi trạng thái cục bộ.",
            async () => {
              try {
                const signinRes = await googleSignIn();
                if (signinRes && signinRes.accessToken) {
                  setGoogleToken(signinRes.accessToken);
                  showDeleteConfirm(signinRes.accessToken);
                } else {
                   showToast("Xác thực Google thất bại.", "error");
                   await finalizeBookingStatus(
                     id,
                     target,
                     "Từ chối",
                     target.googleEventId || "",
                     target.googleTaskId || "",
                   );
                }
              } catch (err: any) {
                showToast("Đăng nhập Google thất bại:" + err.message, "error");
                await finalizeBookingStatus(
                  id,
                  target,
                  "Từ chối",
                  target.googleEventId || "",
                  target.googleTaskId || "",
                );
              }
            },
            async () => {
              await finalizeBookingStatus(
                id,
                target,
                "Từ chối",
                target.googleEventId || "",
                target.googleTaskId || "",
              );
            },
            "Cấp quyền",
            "Chỉ từ chối cục bộ"
          );
        }
      } else {
        await finalizeBookingStatus(id, target, "Từ chối", "", "");
      }
    } else {
      // For"Chờ duyệt"or default
      await finalizeBookingStatus(
        id,
        target,
        newStatus,
        target.googleEventId || "",
        target.googleTaskId || "",
      );
    }
  };

  const proceedWithApproval = (
    id: string,
    target: Booking,
    activeToken: string,
  ) => {
    triggerConfirm(
      "Duyệt & Đồng bộ Google Calendar + Việc cần làm",
      `Bạn có chắc chắn muốn DUYỆT và ĐỒNG BỘ lịch trình này? Hệ thống sẽ tạo sự kiện Lịch và thêm Việc cần làm (Google Tasks) cho bạn.\n\n` +
        `- Khách hàng: ${target.schoolName}\n` +
        `- Ngày: ${formatDateDMY(target.date)}\n` +
        `- Thời gian: ${target.timeSlot || "Cả ngày"}`,
      async () => {
        showToast("Đang đồng bộ Google Calendar...", "info");
        let updatedGoogleEventId = target.googleEventId || "";
        let updatedGoogleTaskId = target.googleTaskId || "";
        let hadAuthError = false;
        try {
          const eventData = await syncToGoogleCalendar(target, activeToken);
          updatedGoogleEventId = eventData.id;
          showToast("Đã đồng bộ lên Google Calendar thành công!", "success");
        } catch (err: any) {
          showToast("Lỗi đồng bộ Lịch:" + err.message, "error");
          if (err.message?.includes("[401]")) hadAuthError = true;
        }

        try {
          showToast("Đang tạo Việc cần làm (Google Tasks)...", "info");
          const taskData = await syncToGoogleTasks(target, activeToken);
          updatedGoogleTaskId = taskData.id;
          showToast(
            "Đã tạo Việc cần làm trên Google Tasks thành công!",
            "success",
          );
        } catch (err: any) {
          showToast("Lỗi tạo Việc cần làm:" + err.message, "error");
          if (err.message?.includes("[401]")) hadAuthError = true;
        }

        if (hadAuthError) {
          try {
            const { deleteDoc } = await import("firebase/firestore");
            await deleteDoc(doc(db, "configs", "googleToken"));
          } catch(e) {}
          setGoogleToken(null);
        }

        await finalizeBookingStatus(
          id,
          target,
          "Đã duyệt",
          updatedGoogleEventId,
          updatedGoogleTaskId,
        );
      },
    );
  };

  const performTwoWaySync = async (activeToken: string, quiet: boolean = false) => {
    try {
      const syncedBookings = activeBookingsRef.current.filter(
        (b) => b.status === "Đã duyệt" && (b.googleEventId || b.googleTaskId),
      );
      if (syncedBookings.length === 0) {
        if (!quiet) showToast(
          "Không có lịch trình nào đang đồng bộ Google để kiểm tra.",
          "info",
        );
        return;
      }

      if (!quiet) showToast(
        `Đang kiểm tra 2 chiều cho ${syncedBookings.length} lịch trình...`,
        "info",
      );
      let changedCount = 0;
      let completedCount = 0;

      for (const b of syncedBookings) {
        let isRemovedExternally = false;
        let isCompletedExternally = false;

        if (b.googleTaskId) {
          try {
            const tRes = await fetch(
              `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${b.googleTaskId}`,
              {
                headers: { Authorization: `Bearer ${activeToken}` },
              },
            );
            if (tRes.status === 401) {
              throw new Error("[401] Unauthorized Token in Tasks Check");
            }
            if (tRes.status === 404) {
              isRemovedExternally = true;
            } else if (tRes.ok) {
              const tData = await tRes.json();
              if (tData.deleted) {
                isRemovedExternally = true;
              } else if (tData.status === "completed") {
                isCompletedExternally = true;
              } else if (tData.due) {
                const taskDate = tData.due.split('T')[0];
                if (taskDate && taskDate !== b.date) {
                  await setDoc(doc(db, "bookings", b.id), { date: taskDate }, { merge: true });
                  if (b.date) {
                    await setDoc(doc(db, "availableDates", b.date), { date: b.date, status: "available" }, { merge: true });
                  }
                  await setDoc(doc(db, "availableDates", taskDate), { date: taskDate, status: "booked" }, { merge: true });
                  
                  // Update calendar date as well
                  if (b.googleEventId) {
                    try {
                      const eventRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${b.googleEventId}`, {
                         headers: { Authorization: `Bearer ${activeToken}` }
                      });
                      if (eventRes.status === 401) {
                        throw new Error("[401] Unauthorized Token in TwoWay Calendar Check");
                      }
                      if (eventRes.ok) {
                         const evData = await eventRes.json();
                         let startDtStr = evData.start?.dateTime;
                         let endDtStr = evData.end?.dateTime;
                         if (startDtStr) {
                           const timePortion = startDtStr.split('T')[1];
                           startDtStr = `${taskDate}T${timePortion}`;
                         } else { startDtStr = `${taskDate}T08:00:00+07:00`; }
                         if (endDtStr) {
                           const timePortion = endDtStr.split('T')[1];
                           endDtStr = `${taskDate}T${timePortion}`;
                         } else { endDtStr = `${taskDate}T11:00:00+07:00`; }
                         
                         await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${b.googleEventId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeToken}` },
                            body: JSON.stringify({
                              start: { dateTime: startDtStr, timeZone: "Asia/Ho_Chi_Minh" },
                              end: { dateTime: endDtStr, timeZone: "Asia/Ho_Chi_Minh" }
                            })
                         });
                      }
                    } catch(e: any) {
                      if (e.message?.includes("[401]")) throw e;
                    }
                  }
                }
              }
            }
          } catch (e: any) {
            if (e.message?.includes("[401]")) throw e;
          }
        }

        if (!isRemovedExternally && b.googleEventId) {
          try {
            const eRes = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${b.googleEventId}`,
              {
                headers: { Authorization: `Bearer ${activeToken}` },
              },
            );
            if (eRes.status === 401) {
              throw new Error("[401] Unauthorized Token in Calendar Check");
            }
            if (eRes.status === 404) {
              isRemovedExternally = true;
            } else if (eRes.ok) {
              const eData = await eRes.json();
              if (eData.status === "cancelled") {
                isRemovedExternally = true;
              } else if (eData.start) {
                const startStr = eData.start.dateTime || eData.start.date;
                if (startStr) {
                  const googleDate = startStr.split('T')[0];
                  if (googleDate && googleDate !== b.date) {
                    await setDoc(doc(db, "bookings", b.id), { date: googleDate }, { merge: true });
                    if (b.googleTaskId) {
                      try {
                        const rfc3339 = new Date(googleDate).toISOString();
                        await fetch(`https://www.googleapis.com/tasks/v1/lists/@default/tasks/${b.googleTaskId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeToken}` },
                          body: JSON.stringify({ due: rfc3339 })
                        });
                      } catch(e) {}
                    }
                    if (b.date) {
                      await setDoc(doc(db, "availableDates", b.date), { date: b.date, status: "available" }, { merge: true });
                    }
                    await setDoc(doc(db, "availableDates", googleDate), { date: googleDate, status: "booked" }, { merge: true });
                  }
                }
              }
            }
          } catch (e: any) {
            if (e.message?.includes("[401]")) throw e;
          }
        }

        if (isRemovedExternally) {
          try {
            if (b.googleEventId && activeToken) {
              await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${b.googleEventId}`, { method: "DELETE", headers: { Authorization: `Bearer ${activeToken}` } });
            }
            if (b.googleTaskId && activeToken) {
              await fetch(`https://www.googleapis.com/tasks/v1/lists/@default/tasks/${b.googleTaskId}`, { method: "DELETE", headers: { Authorization: `Bearer ${activeToken}` } });
            }
          } catch (e) {}
          await deleteDoc(doc(db, "bookings", b.id));
          if (b.date) {
            const otherBookings = bookings.filter(
              (ob) =>
                ob.id !== b.id && ob.date === b.date && ob.status !== "Từ chối",
            );
            if (otherBookings.length === 0) {
              await setDoc(
                doc(db, "availableDates", b.date),
                {
                  date: b.date,
                  status: "available",
                },
                { merge: true },
              );
            }
          }
          changedCount++;
        } else if (isCompletedExternally) {
          await setDoc(doc(db, "bookings", b.id), { status: "Đã khoá lịch" }, { merge: true });
          completedCount++;
        }
      }

      if (!quiet) {
         if (changedCount > 0 || completedCount > 0) {
           showToast(
             `Cập nhật thành công! Đã xóa ${changedCount} & Đóng ${completedCount} lịch trình từ Lịch/Việc cần làm.`,
             "success",
           );
         } else {
           showToast("Tất cả lịch trình đang đồng bộ tốt.", "success");
         }
      }
    } catch (err: any) {
      if (err.message?.includes("[401]") || err.message?.includes("Unauthorized")) {
        console.warn("Lỗi 2-way sync (hết hạn Token Google):", err.message);
        try {
          const { deleteDoc } = await import("firebase/firestore");
          await deleteDoc(doc(db, "configs", "googleToken"));
        } catch (e) {}
        setGoogleToken(null);
        if (!quiet) {
          showToast("Phiên kết nối Google đã hết hạn. Vui lòng kết nối lại Google để tiếp tục đồng bộ.", "warning");
        }
      } else {
        console.warn("Lỗi 2-way sync:", err);
      }
    }
  };

  const proceedWithBatchSync = async (activeToken: string) => {
    try {
      const approvedBookings = bookings.filter((b) => b.status === "Đã duyệt");
      if (approvedBookings.length === 0) {
        showToast("Không có lịch trình nào đã duyệt để đồng bộ!", "info");
        return;
      }

      showToast(
        `Đang đồng bộ ${approvedBookings.length} lịch trình lên Google Calendar & Tasks...`,
        "info",
      );
      let countCal = 0;
      let countTask = 0;
      let hadAuthError = false;

      for (const b of approvedBookings) {
        let updatedEventId = b.googleEventId || "";
        let updatedTaskId = b.googleTaskId || "";
        try {
          const eventData = await syncToGoogleCalendar(b, activeToken);
          updatedEventId = eventData.id;
          countCal++;
        } catch (bookingErr: any) {
          const errMsg = bookingErr?.message || String(bookingErr);
          if (errMsg.includes("[401]")) {
            hadAuthError = true;
          } else {
            console.error(`Lỗi đồng bộ Calendar booking ${b.id}:`, bookingErr);
          }
        }

        try {
          const taskData = await syncToGoogleTasks(b, activeToken);
          updatedTaskId = taskData.id;
          countTask++;
        } catch (taskErr: any) {
          const errMsg = taskErr?.message || String(taskErr);
          if (errMsg.includes("[401]")) {
            hadAuthError = true;
          } else {
            console.error(`Lỗi đồng bộ Task booking ${b.id}:`, taskErr);
          }
        }

        if (hadAuthError) {
          break;
        }

        await setDoc(doc(db, "bookings", b.id), {
          ...b,
          googleEventId: updatedEventId,
          googleTaskId: updatedTaskId,
        });

        if (b.date) {
          await setDoc(
            doc(db, "availableDates", b.date),
            { date: b.date, status: "booked" },
            { merge: true },
          );
        }
      }

      if (hadAuthError) {
        try {
          const { deleteDoc } = await import("firebase/firestore");
          await deleteDoc(doc(db, "configs", "googleToken"));
        } catch (e) {}
        setGoogleToken(null);
        showToast("Phiên kết nối Google đã hết hạn. Vui lòng kết nối lại Google để đồng bộ.", "error");
      } else {
        showToast(
          `Đồng bộ thành công! Lịch: ${countCal}/${approvedBookings.length}, Việc cần làm: ${countTask}/${approvedBookings.length}`,
          "success",
        );
      }
    } catch (e: any) {
      showToast("Lỗi đồng bộ:" + e.message, "error");
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!date) {
      setErrorMsg("Vui lòng bấm chọn ngày chụp trên lịch!");
      return;
    }
    if (!schoolName.trim()) {
      setErrorMsg("Vui lòng nhập Họ tên hoặc Tên Lớp / Trường!");
      return;
    }
    if (!contactHandle.trim()) {
      setErrorMsg("Vui lòng nhập Số điện thoại hoặc Zalo để Studio liên hệ!");
      return;
    }
    if (!address.trim()) {
      setErrorMsg("Vui lòng nhập Địa chỉ hoặc Điểm hẹn chụp dự kiến!");
      return;
    }

    setIsSubmitting(true);
    let finalTimeSlot = "";
    if (conceptType === "Custom") {
      finalTimeSlot = "Cả ngày (Không hẹn giờ cụ thể)";
    } else if (conceptType === "THPT") {
      if (!thptShift) {
        setErrorMsg("Vui lòng chọn ca chụp cho gói Kỷ yếu THPT!");
        setIsSubmitting(false);
        return;
      }
      finalTimeSlot = thptShift;
    } else if (conceptType === "University") {
      if (!gradTime) {
        setErrorMsg("Vui lòng nhập thời gian chụp cho gói PRE-GRADUATION!");
        setIsSubmitting(false);
        return;
      }
      finalTimeSlot = gradTime;
    } else if (conceptType === "Event") {
      const sM = timeToMinutes(eventStartTime);
      const eM = timeToMinutes(eventEndTime);
      if (eM <= sM) {
        setErrorMsg("Giờ kết thúc sự kiện phải sau giờ bắt đầu!");
        setIsSubmitting(false);
        return;
      }
      // Check for overlap with already-booked hours on that date
      const bookedOnDay = getBookedIntervalsForDate(date, bookings, availableDatesMap);
      const conflict = isRangeOverlapping(sM, eM, bookedOnDay);
      if (conflict) {
        setErrorMsg(`Khung giờ bạn chọn (${eventStartTime} - ${eventEndTime}) bị trùng với lịch đã kín (${conflict.startTime} - ${conflict.endTime})! Vui lòng chọn khung giờ khác.`);
        setIsSubmitting(false);
        return;
      }
      const dur = ((eM - sM) / 60).toFixed(1).replace(".0", "");
      finalTimeSlot = `Từ ${eventStartTime} đến ${eventEndTime} (${dur} tiếng)`;
    } else {
      finalTimeSlot = eventTime || "Cả ngày";
    }

    if (conceptType === "Custom" && !customRequest.trim()) {
      setErrorMsg("Vui lòng ghi rõ yêu cầu chi tiết mục Theo Yêu Cầu!");
      setIsSubmitting(false);
      return;
    }

    const bookingId = "BRBK_" + Date.now().toString().slice(-6);

    // Calculate temporary cost estimation
    let estCostText = "Báo giá cụ thể sau khi tư vấn";
    if (conceptType === "THPT" || conceptType === "University") {
      const uPrice = getActivePrice(classSize, estimateShift === "full");
      const tPrice = classSize * uPrice;
      estCostText = `${tPrice.toLocaleString("vi-VN")}đ (Đơn giá: ${(uPrice / 1000).toLocaleString("vi-VN")}k/người cho nhóm ${classSize} người)`;
    } else if (conceptType === "Event") {
      estCostText = "Sẽ tư vấn & báo giá chi tiết dựa trên quy mô sự kiện";
    } else if (conceptType === "Custom") {
      estCostText =
        "Sẽ tư vấn & báo giá chi tiết dựa trên yêu cầu concept riêng";
    }

    const newBooking: Booking = {
      id: bookingId,
      schoolName,
      classSize,
      date,
      timeSlot: finalTimeSlot,
      conceptType,
      instagramOrZalo: contactHandle,
      address,
      notes: notes.trim() ? notes : "Đăng ký trực tiếp qua website.",
      customRequest: conceptType === "Custom" ? customRequest.trim() : "",
      status: "Chờ duyệt",
      source: bookingSource,
      createdAt: serverTimestamp(),
      emailSent: false,
      estimatedCost: estCostText,
      ...(conceptType === "Event" ? { eventStartTime, eventEndTime } : {}),
      ...(customerEmail.trim() ? { email: customerEmail.trim() } : {}),
    };

    try {
      await setDoc(doc(db, "bookings", bookingId), newBooking);

      // Trigger server-side background web push to admin devices (lock screen alert)
      try {
        fetch("/api/booking/alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: schoolName,
            schoolName,
            conceptType,
            date,
            phone: contactHandle,
            classSize,
          }),
        }).catch(() => {});
      } catch (_) {}

      try {
        // Auto-reserve the date or event slot
        if (date) {
          if (conceptType === "Event") {
            const curDateDoc = availableDatesMap[date];
            const curSlots = Array.isArray(curDateDoc?.blockedSlots) ? curDateDoc.blockedSlots : [];
            const newSlotStr = `Sự kiện: ${eventStartTime} - ${eventEndTime}`;
            await setDoc(
              doc(db, "availableDates", date),
              {
                date: date,
                status: "available",
                blockedSlots: [...curSlots, newSlotStr],
              },
              { merge: true },
            );
          } else {
            await setDoc(
              doc(db, "availableDates", date),
              {
                date: date,
                status: "booked",
              },
              { merge: true },
            );
          }
        }
      } catch (err) {
        console.warn("Could not auto-reserve date:", err);
      }

      // Save to owned booking IDs
      const updatedIds = [...myBookingIds, bookingId];
      setMyBookingIds(updatedIds);
      localStorage.setItem("my_booking_ids", JSON.stringify(updatedIds));

      // Auto-send email notification to admin via backend proxy
      // Gói THPT và Cử nhân/ĐH chỉ gửi mail xác nhận cho khách khi chuyển khoản thành công hoặc admin duyệt
      const isDepositPackage = conceptType === "THPT" || conceptType === "University";
      const mailPayload: Record<string, any> = {
        _captcha: "false",
        _subject: `📸 YAYYY! BẠN CÓ 1 ĐƠN ĐẶT LỊCH TỪ: ${schoolName?.toUpperCase() || ""}`,
        _template: "box",
        email: customerEmail.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        skipCustomerConfirmation: isDepositPackage,
        "✨ 1. TÊN KHÁCH HÀNG / TỔ CHỨC": schoolName || "(Chưa rõ)",
        "📧 EMAIL LIÊN HỆ": customerEmail.trim() || "(Không cung cấp)",
        "🎯 2. CONCEPT MONG MUỐN":
          conceptType === "Custom"
            ? `Làm Theo Yêu Cầu: ${customRequest || "(Chưa ghi cụ thể)"}`
            : conceptType === "University"
              ? "Gói PRE-GRADUATION"
              : conceptType === "THPT"
                ? "Gói KỶ YẾU THPT"
                : "Event & Prom Night",
        "🔥 3. SỐ LƯỢNG NGƯỜI":
          conceptType === "Event" ? "(Không áp dụng)" : `${classSize} người`,
        "📅 4. NGÀY CHỤP (Dự kiến)": date
          ? `${date.split("-").reverse().join("/")}`
          : "(Chưa chọn ngày)",
      };

      if (conceptType === "THPT") {
        mailPayload["⏰ 5. CA CHỤP"] = thptShift;
      } else if (conceptType === "University") {
        mailPayload["⏰ 5. THỜI GIAN CHỤP"] = gradTime;
      } else if (conceptType === "Custom") {
        mailPayload["⏰ 5. THỜI GIAN"] = "Cả ngày (Không hẹn giờ cụ thể)";
      } else {
        mailPayload["⏰ 5. THỜI GIAN/CA CHỤP"] = finalTimeSlot;
      }

      mailPayload["💰 5b. TẠM TÍNH CHI PHÍ"] = estCostText;

      mailPayload["📱 6. INFO LIÊN HỆ (Zalo / Instagram)"] =
        contactHandle || "(Không có thông tin)";
      mailPayload["📍 6b. ĐỊA CHỈ LIÊN HỆ"] = address;
      mailPayload["💌 7. LỊCH TRÌNH / LỜI NHẮN"] = notes.trim()
        ? notes
        : "(Trống - Khách không dặn dò gì thêm)";
      mailPayload["🎟️ 8. MÃ SỐ TICKET"] = bookingId;
      mailPayload["id"] = bookingId;
      mailPayload["bookingId"] = bookingId;

      // Always dispatch email notification to admin & confirmation to customer
      try {
        await fetch("/api/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(mailPayload),
        });
      } catch (err: any) {
        console.warn("[Email Notification] Could not send email notification via proxy:", err?.message || err);
      }

      // Reset Form fields
      let finalDeposit = 0;
      if (conceptType === "THPT" || conceptType === "University") {
        const uPrice = getActivePrice(classSize, estimateShift === "full");
        // Minimum deposit logic
        finalDeposit = 400000; 
      }
      setSubmittedData({
        id: bookingId,
        concept: conceptType,
        deposit: finalDeposit,
        hasConfirmedPayment: false,
        customerEmail: customerEmail.trim() || undefined,
      });

      setSchoolName("");
      setContactHandle("");
      setCustomerEmail("");
      setAddress("");
      setNotes("");
      setCustomRequest("");
      setTimeSlots([]);
      setDate("");
      setIsSubmitting(false);
      setSuccessMsg(true);
      showToast(
        "Đặt lịch chụp thành công! Mã Ticket ID của bạn đã được khởi tạo.",
        "success",
      );

      // Removed auto-close timeout to ensure customers have enough time to scan the QR code.
      // The user must manually dismiss the success message.
    } catch (error: any) {
      console.error(error);
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi không xác định. Vui lòng thử lại!",
      );
      setIsSubmitting(false);
    }
  };

  // Delete/Cancel booking (admin or booking owner only)
  const cancelBooking = async (id: string) => {
    const isOwner = myBookingIds.includes(id);
    if (!isLoggedAdmin && !isOwner) {
      showToast("Bạn không có quyền xoá lịch trình này!", "error");
      return;
    }

    const target = bookings.find((b) => b.id === id);
    if (!target) return;

    const performDeletion = async (activeToken?: string | null) => {
      try {
        const targetDate = target?.date;

        // Clean up external syncs if exists
        try {
          if (target.googleEventId && activeToken) {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${target.googleEventId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${activeToken}` },
              },
            );
          }
          if (target.googleTaskId && activeToken) {
            await fetch(
              `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${target.googleTaskId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${activeToken}` },
              },
            );
          }
        } catch (syncErr) {
          console.warn("Could not delete from Google:", syncErr);
        }

        await deleteDoc(doc(db, "bookings", id));

        if (targetDate) {
          // Check if there are any other bookings on this date
          const otherBookings = bookings.filter(
            (b) =>
              b.id !== id && b.date === targetDate && b.status !== "Từ chối",
          );
          if (otherBookings.length === 0) {
            // Free up the date if no other valid bookings exist
            try {
              await setDoc(
                doc(db, "availableDates", targetDate),
                {
                  date: targetDate,
                  status: "available",
                },
                { merge: true },
              );
            } catch (e) {
              console.warn("Could not free up date:", e);
            }
          }
        }

        // Clean up local storage list if the owner deleted it
        if (isOwner) {
          const remaining = myBookingIds.filter((bid) => bid !== id);
          setMyBookingIds(remaining);
          localStorage.setItem("my_booking_ids", JSON.stringify(remaining));
        }
        showToast("Đã hủy đơn đặt lịch thành công!", "success");
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `bookings/${id}`);
      }
    };

    if (target.googleEventId || target.googleTaskId) {
      triggerConfirm(
        "Xóa Đơn Đặt Lịch (Kèm Sự Kiện & Việc Cần Làm)",
        "Đơn đặt lịch này ĐÃ ĐƯỢC ĐỒNG BỘ lên Google. Hành động xóa sẽ đồng thời xóa sự kiện và việc cần làm khỏi Google. Quá trình này không thể hoàn tác.",
        async () => {
          let activeToken = googleToken ?? (await getAccessToken());
          if (activeToken) {
            showToast("Đang xóa từ hệ thống và Google...", "info");
            await performDeletion(activeToken);
          } else {
            triggerConfirm(
              "Yêu cầu cấp quyền Google",
              "Hệ thống cần quyền truy cập Google Calendar / Tasks của bạn để tiến hành xóa sự kiện đã đồng bộ. Tiếp tục?",
              async () => {
                try {
                  const signinRes = await googleSignIn();
                  if (signinRes && signinRes.accessToken) {
                    setGoogleToken(signinRes.accessToken);
                    showToast("Đang xóa từ hệ thống và Google...", "info");
                    await performDeletion(signinRes.accessToken);
                  } else {
                    showToast("Xác thực Google thất bại.", "error");
                  }
                } catch (err: any) {
                  showToast("Đăng nhập Google thất bại: " + err.message, "error");
                }
              },
              undefined,
              "Xác thực"
            );
          }
        },
      );
    } else {
      triggerConfirm(
        "Xác nhận Hủy Đơn Đặt Lịch",
        "Bạn có chắc chắn muốn hủy đơn đặt lịch này? Hành động này không thể hoàn tác.",
        async () => {
          await performDeletion(null);
        },
      );
    }
  };

  // Helper to get timestamp of booking date (Vietnamese DD/MM/YYYY or standard ISO)
  const getBookingDateTimestamp = (b: Booking): number => {
    const dateVal = b.date || b.createdAt;
    if (dateVal && dateVal.toMillis) return dateVal.toMillis();
    const dateStr = typeof dateVal === "string" ? dateVal : String(dateVal);
    if (!dateStr) return 0;
    if (
      dateStr.includes("T") ||
      (dateStr.includes("-") && dateStr.split("-")[0].length === 4)
    ) {
      const dt = new Date(dateStr);
      if (!isNaN(dt.getTime())) return dt.getTime();
    }
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      return new Date(
        Number(parts[2]),
        Number(parts[1]) - 1,
        Number(parts[0]),
      ).getTime();
    }
    return 0;
  };

  // Automated/Admin-Triggered 3-month retention cleanup operation
  const handleCleanupOldBookings = async () => {
    if (!isLoggedAdmin) {
      showToast("Bạn không có quyền thực hiện hành động này!", "error");
      return;
    }

    const retentionDays = 90;
    const now = new Date();
    // 3 months ago cutoff (90 days)
    const cutoffTimestamp = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
    const cutoffDateStr = new Date(cutoffTimestamp).toLocaleDateString(
      "vi-VN",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    );

    // Filter list of expired bookings
    const expiredBookings = bookings.filter((b) => {
      const ts = getBookingDateTimestamp(b);
      // Ensure we keep future bookings, processing ones, and only delete bookings genuinely older than 3 months
      return ts > 0 && ts < cutoffTimestamp;
    });

    if (expiredBookings.length === 0) {
      showToast(
        "Không tìm thấy lịch trình cũ nào cần dọn dẹp (Lưu giữ tối đa 3 tháng lịch gần nhất).",
        "info",
      );
      return;
    }

    triggerConfirm(
      "Xác nhận Dọn Lịch Cũ (> 3 Tháng)",
      `Phát hiện có ${expiredBookings.length} lịch trình cũ trong lịch sử (từ trước ngày ${cutoffDateStr}). Bạn có chắc chắn muốn dọn dẹp vĩnh viễn các dữ liệu này để giải phóng bộ nhớ và giữ hệ thống ổn định?`,
      async () => {
        setIsCleaningUp(true);
        let successCount = 0;
        let errorCount = 0;

        // Perform deletions in parallel/serial safely to satisfy Firestore limits and avoid errors
        let activeToken: string | undefined | null = googleToken;
        if (!activeToken) {
          activeToken = await getAccessToken().catch(() => null);
        }

        for (const booking of expiredBookings) {
          try {
            // Check & delete Google Calendar & Tasks syncs
            if (activeToken) {
              if (booking.googleEventId) {
                await fetch(
                  `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.googleEventId}`,
                  {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${activeToken}` },
                  },
                ).catch(() => {});
              }
              if (booking.googleTaskId) {
                await fetch(
                  `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${booking.googleTaskId}`,
                  {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${activeToken}` },
                  },
                ).catch(() => {});
              }
            }
            await deleteDoc(doc(db, "bookings", booking.id));
            successCount++;
          } catch (error) {
            console.error(
              `Error deleting expired booking ${booking.id}:`,
              error,
            );
            errorCount++;
          }
        }

        setIsCleaningUp(false);
        if (successCount > 0) {
          showToast(
            `Đã dọn dẹp thành công ${successCount} lịch trình cũ!${errorCount > 0 ? ` (Lỗi ${errorCount} lịch)` : ""}`,
            "success",
          );
        } else {
          showToast("Xảy ra lỗi trong quá trình dọn dẹp lịch cũ.", "error");
        }
      },
      () => {},
      "Xóa vĩnh viễn",
      "Hủy",
    );
  };

  // Poll for SePay verification
  useEffect(() => {
    let interval: any;
    if (submittedData && submittedData.deposit > 0 && !submittedData.hasConfirmedPayment) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/sepay/check/${submittedData.id}`);
          const data = await res.json();
          if (data.success) {
            setSubmittedData(prev => prev ? { ...prev, hasConfirmedPayment: true } : null);
            showToast("Đã xác nhận thanh toán thành công tự động từ SePay!", "success");
            
            let updatedEventId = "";
            let updatedTaskId = "";
            let bookingData: Booking | null = null;

            // Auto-sync Google if token exists in configs (safely wrapped)
            try {
              const bookingSnap = await getDoc(doc(db, "bookings", submittedData.id));
              if (bookingSnap.exists()) {
                bookingData = bookingSnap.data() as Booking;
                
                // Safely read configs to avoid permission denials on visitor side
                try {
                  const tokenSnap = await getDoc(doc(db, "configs", "googleToken"));
                  if (tokenSnap.exists()) {
                     const tokenData = tokenSnap.data();
                     const ageMs = tokenData?.updatedAt ? (Date.now() - tokenData.updatedAt) : 0;
                     const isExpired = tokenData?.updatedAt && (ageMs > 3540 * 1000);
                     if (tokenData && tokenData.accessToken && !isExpired) {
                        const activeToken = tokenData.accessToken;
                        try {
                           const eventData = await syncToGoogleCalendar(bookingData, activeToken);
                           updatedEventId = eventData.id;
                        } catch(err) { console.warn("Auto sync Calendar info:", err?.message || err); }
                        
                        try {
                           const taskData = await syncToGoogleTasks(bookingData, activeToken);
                           updatedTaskId = taskData.id;
                        } catch(err) { console.warn("Auto sync Task info:", err?.message || err); }
                     }
                  }
                } catch(tokenErr) {
                  console.log("Safe ignore: Google token fetch failed (not Admin or unauthenticated).");
                }
              }
            } catch(e) {
              console.warn("Google calendar lookup warning:", e);
            }

            // Always proceed to approve booking status and lock date in database!
            try {
              if (!(bookingData as any)?.emailSent) {
                const targetCustomerEmail = bookingData?.email || (submittedData as any)?.customerEmail;
                let estCostText = (bookingData as any)?.estimatedCost;
                if (!estCostText) {
                  const bConcept = bookingData?.conceptType || submittedData?.concept;
                  const bSize = bookingData?.classSize || 1;
                  const isFull = bookingData?.timeSlot?.toLowerCase().includes("cả ngày") || false;
                  if (bConcept === "THPT" || bConcept === "University") {
                    const uPrice = getActivePrice(bSize, isFull);
                    const tPrice = bSize * uPrice;
                    estCostText = `${tPrice.toLocaleString("vi-VN")}đ (Đơn giá: ${(uPrice / 1000).toLocaleString("vi-VN")}k/người cho nhóm ${bSize} người)`;
                  } else if (bConcept === "Event") {
                    estCostText = "Sẽ tư vấn & báo giá chi tiết dựa trên quy mô sự kiện";
                  } else {
                    estCostText = "Sẽ tư vấn & báo giá chi tiết dựa trên yêu cầu concept riêng";
                  }
                }
                const mailPayload: Record<string, any> = {
                  _captcha: "false",
                  _subject: `✅ ĐÃ THANH TOÁN CỌC - ĐƠN ĐẶT LỊCH TỪ: ${bookingData?.schoolName || submittedData.id}`,
                  _template: "box",
                  id: submittedData.id,
                  bookingId: submittedData.id,
                  email: targetCustomerEmail || undefined,
                  customerEmail: targetCustomerEmail || undefined,
                  _isPaymentApproved: true,
                  "✨ Trạng thái": "HỆ THỐNG ĐÃ TỰ ĐỘNG CHẤP NHẬN & ĐỒNG BỘ",
                  "🎟️ Mã Booking": submittedData.id,
                  "💰 Số tiền cọc đã nhận từ SePay": `${data.amount?.toLocaleString('vi-VN') || data.amount} VNĐ`,
                  "💰 5b. TẠM TÍNH CHI PHÍ": estCostText,
                  "✨ 1. TÊN KHÁCH HÀNG / TỔ CHỨC": bookingData?.schoolName || "(Chưa rõ)",
                  "🎯 2. CONCEPT MONG MUỐN": bookingData?.conceptType || "(Chưa rõ)",
                  "🔥 3. SỐ LƯỢNG NGƯỜI": bookingData?.conceptType === "Event" ? "(Không áp dụng)" : `${bookingData?.classSize || 0} người`,
                  "📅 4. NGÀY CHỤP (Dự kiến)": bookingData?.date ? `${bookingData.date.split("-").reverse().join("/")}` : "(Chưa chọn ngày)",
                  "⏰ 5. CA CHỤP / THỜI GIAN": bookingData?.timeSlot || "Cả ngày",
                  "📱 6. INFO LIÊN HỆ (Zalo / Instagram)": bookingData?.instagramOrZalo || "(Không có)",
                  "📍 6b. ĐỊA CHỈ LIÊN HỆ": bookingData?.address || "(Không có)",
                  "💌 7. LỊCH TRÌNH / LỜI NHẮN": bookingData?.notes?.trim() ? bookingData.notes : "(Trống)",
                };
                fetch("/api/send-email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Accept: "application/json" },
                  body: JSON.stringify(mailPayload),
                }).catch(err => console.warn("[Email Notification] Auto approval mail handled:", err?.message || err));
              }

              await setDoc(doc(db, "bookings", submittedData.id), {
                 hasConfirmedPayment: true,
                 amountPaid: data.amount,
                 status: "Đã duyệt",
                 emailSent: true,
                 ...(updatedEventId ? { googleEventId: updatedEventId } : {}),
                 ...(updatedTaskId ? { googleTaskId: updatedTaskId } : {})
              }, { merge: true });

              const targetDate = bookingData?.date || (submittedData as any).date;
              if (targetDate) {
                 await setDoc(doc(db, "availableDates", targetDate), { date: targetDate, status: "booked" }, { merge: true });
              }
            } catch(dbErr) {
              console.error("Could not update approval status in Firestore", dbErr);
            }
          }
        } catch (e) {
          console.log("Error checking payment", e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [submittedData?.id, submittedData?.hasConfirmedPayment]);

  // Ref to hold bookings without triggering interval reset
  const activeBookingsRef = useRef<Booking[]>([]);
  useEffect(() => {
    activeBookingsRef.current = bookings;
  }, [bookings]);

  // Distributed continuous background polling (runs for Admin and any active visitor to ensure auto-approval & 2-way sync)
  useEffect(() => {
    let interval: any;
    
    // Add a slight jitter for starting the interval so multiple tabs don't fire exactly at same ms
    const delay = Math.floor(Math.random() * 5000);
    
    setTimeout(() => {
      interval = setInterval(async () => {
        let activeToken = googleToken;
        if (!activeToken) {
           try {
             const tokenSnap = await getDoc(doc(db, "configs", "googleToken"));
             if (tokenSnap.exists()) {
                const tData = tokenSnap.data();
                const ageMs = tData?.updatedAt ? (Date.now() - tData.updatedAt) : 0;
                const isExpired = tData?.updatedAt && (ageMs > 3540 * 1000);
                if (tData && tData.accessToken && !isExpired) {
                   activeToken = tData.accessToken;
                } else {
                   activeToken = null;
                }
             }
           } catch(e) {}
        }

        if (activeToken) {
          // 1. TwoWay Sync Update Task Actions back to system
          await performTwoWaySync(activeToken, true);
        }

        // 2. Poll SePay for pending bookings and auto-approve
        const pendingBookings = activeBookingsRef.current.filter((b) => b.status === "Chờ duyệt");
        for (const b of pendingBookings) {
          try {
            const res = await fetch(`/api/sepay/check/${b.id}`);
            const data = await res.json();
            if (data.success) {
               let updatedEventId = "";
               let updatedTaskId = "";
               if (activeToken) {
                 try {
                    const eventData = await syncToGoogleCalendar(b, activeToken);
                    updatedEventId = eventData.id;
                 } catch(e) {}
                 try {
                    const taskData = await syncToGoogleTasks(b, activeToken);
                    updatedTaskId = taskData.id;
                 } catch(e) {}
               }
               
               if (!(b as any).emailSent) {
                   let estCostText = (b as any).estimatedCost;
                   if (!estCostText) {
                     const isFull = b.timeSlot?.toLowerCase().includes("cả ngày") || false;
                     const sizeNum = b.classSize || 1;
                     if (b.conceptType === "THPT" || b.conceptType === "University") {
                       const uPrice = getActivePrice(sizeNum, isFull);
                       const tPrice = sizeNum * uPrice;
                       estCostText = `${tPrice.toLocaleString("vi-VN")}đ (Đơn giá: ${(uPrice / 1000).toLocaleString("vi-VN")}k/người cho nhóm ${sizeNum} người)`;
                     } else if (b.conceptType === "Event") {
                       estCostText = "Sẽ tư vấn & báo giá chi tiết dựa trên quy mô sự kiện";
                     } else {
                       estCostText = "Sẽ tư vấn & báo giá chi tiết dựa trên yêu cầu concept riêng";
                     }
                   }

                   const mailPayload: Record<string, any> = {
                     _captcha: "false",
                     _subject: `✅ ĐÃ THANH TOÁN CỌC - ĐƠN ĐẶT LỊCH TỪ: ${b.schoolName || b.id}`,
                     _template: "box",
                     id: b.id,
                     bookingId: b.id,
                     email: b.email || undefined,
                     customerEmail: b.email || undefined,
                     _isPaymentApproved: true,
                     "✨ Trạng thái": "HỆ THỐNG ĐÃ TỰ ĐỘNG CHẤP NHẬN & ĐỒNG BỘ",
                     "🎟️ Mã Booking": b.id,
                     "💰 Số tiền cọc đã nhận từ SePay": `${data.amount?.toLocaleString('vi-VN') || data.amount} VNĐ`,
                     "💰 5b. TẠM TÍNH CHI PHÍ": estCostText,
                     "✨ 1. TÊN KHÁCH HÀNG / TỔ CHỨC": b.schoolName || "(Chưa rõ)",
                     "🎯 2. CONCEPT MONG MUỐN": b.conceptType || "(Chưa rõ)",
                     "🔥 3. SỐ LƯỢNG NGƯỜI": b.conceptType === "Event" ? "(Không áp dụng)" : `${b.classSize || 0} người`,
                     "📅 4. NGÀY CHỤP (Dự kiến)": b.date ? `${b.date.split("-").reverse().join("/")}` : "(Chưa chọn ngày)",
                     "⏰ 5. CA CHỤP / THỜI GIAN": b.timeSlot || "Cả ngày",
                     "📱 6. INFO LIÊN HỆ (Zalo / Instagram)": b.instagramOrZalo || "(Không có)",
                     "📍 6b. ĐỊA CHỈ LIÊN HỆ": b.address || "(Không có)",
                     "💌 7. LỊCH TRÌNH / LỜI NHẮN": b.notes?.trim() ? b.notes : "(Trống)",
                   };
                   fetch("/api/send-email", {
                     method: "POST",
                     headers: { "Content-Type": "application/json", Accept: "application/json" },
                     body: JSON.stringify(mailPayload),
                   }).catch(err => console.warn("[Email Notification] Auto approval mail handled in filter block:", err));
               }

               await setDoc(doc(db, "bookings", b.id), {
                  status: "Đã duyệt",
                  hasConfirmedPayment: true,
                  amountPaid: data.amount,
                  emailSent: true,
                  ...(updatedEventId ? { googleEventId: updatedEventId } : {}),
                  ...(updatedTaskId ? { googleTaskId: updatedTaskId } : {})
               }, { merge: true });
               
               if (b.date) {
                  await setDoc(doc(db, "availableDates", b.date), { date: b.date, status: "booked" }, { merge: true });
               }
            }
          } catch(e) {}
        }
      }, 30000); // 30 seconds interval helps limit API consumption and SePay limits
    }, delay);

    return () => clearInterval(interval);
  }, [googleToken]);

  const handleDownloadQR = async () => {
    if (!submittedData) return;
    try {
      showToast("Đang tải mã QR...", "info");
      const url = `https://img.vietqr.io/image/mbbank-9999917022004-compact2.png?amount=${submittedData.deposit}&addInfo=COC%20${submittedData.id}&accountName=NGUYEN%20DUC%20DUNG`;
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `VietQR_${submittedData.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      showToast("Tải mã QR thành công!", "success");
    } catch (error) {
      console.error(error);
      showToast("Lỗi tải ảnh, vui lòng chụp lại màn hình", "error");
    }
  };

  return (
    <div id="booking-contact-section" className="w-full space-y-6 font-manrope">
      {/* Admin Quick Notification Toast */}
      {adminNotification && (
        <div
          id="admin-notify"
          className={`p-4 rounded border flex items-start gap-3.5 animate-fade-in-quick ${
            adminNotification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {adminNotification.type === "success" ? (
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5 animate-bounce" />
          ) : (
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <span className="font-bold text-gray-950 uppercase block mb-1 tracking-wide font-sans text-[12px]">
              Cổng Đồng Bộ Quản Trị Viên (Email Phê Duyệt)
            </span>
            <p className="leading-relaxed text-gray-750">
              {adminNotification.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdminNotification(null)}
            className="text-gray-404 hover:text-gray-950 font-sans text-[12px] px-1.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      <div
        className={`grid grid-cols-1 ${isAdminMode ? "lg:grid-cols-12 gap-8 max-w-7xl" : "max-w-3xl"} mx-auto w-full`}
      >
        {/* Interactive Scheduling Form Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className={`${isAdminMode ? "lg:col-span-7" : "col-span-1"} liquid-glass p-4 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl relative z-10 w-full`}
        >
          {/* Studio Reservation Header - Clean Apple-style title, centered on mobile */}
          <div className="mb-6 border-b border-white/10 pb-5 text-center sm:text-left flex flex-col items-center sm:items-start">
            <span className="text-xs sm:text-sm uppercase tracking-wider text-[#E5C17C] font-bold flex items-center gap-1.5 mb-1">
              ✦ BERGH RYKER STUDIO ✦
            </span>
            <h2 className="font-extrabold text-2xl sm:text-3xl md:text-4xl text-white tracking-tight">
              Đặt Lịch Chụp Ảnh
            </h2>
            <p className="text-xs sm:text-base text-zinc-200 mt-1.5 leading-relaxed">
              3 bước đơn giản · Xác nhận lịch hẹn tức thì qua Zalo trong 15 phút
            </p>
          </div>

          {/* Simple, Professional, High-End Booking Form */}
          <form onSubmit={handleSubmit} className="space-y-6 font-sans w-full">
            {/* BƯỚC 1: GÓI CONCEPT & QUY MÔ */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#B5945B]/20 text-[#B5945B] font-extrabold text-sm flex items-center justify-center border border-[#B5945B]/40">
                  1
                </span>
                <label className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">
                  Chọn gói chụp của bạn <span className="text-[#B5945B]">*</span>
                </label>
              </div>

              {/* 4 Concept Options - Apple Liquid Glass Style */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                {[
                  { id: "THPT", title: "Kỷ Yếu Học Sinh", desc: "Cấp 2, Cấp 3, Lớp 9 - 12" },
                  { id: "University", title: "Cử Nhân / Tốt Nghiệp", desc: "Đại học, Cao đẳng" },
                  { id: "Custom", title: "Cá Nhân / Nghệ Thuật", desc: "Chân dung, Lookbook" },
                  { id: "Event", title: "Sự Kiện / Tiệc", desc: "Prom, Gala, Khai trương" },
                ].map((item) => {
                  const isSelected = conceptType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setConceptType(item.id as any)}
                      className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl text-left cursor-pointer transition-all duration-300 select-none active:scale-[0.98] flex flex-col justify-between min-h-[76px] sm:min-h-[88px] ${
                        isSelected
                          ? "liquid-glass-btn border-[#B5945B]/80 text-white ring-1 ring-[#B5945B]/60"
                          : "liquid-glass-card border-white/10 text-zinc-200 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs sm:text-base font-bold ${isSelected ? "text-[#B5945B]" : "text-white"}`}>
                          {item.title}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B5945B] shrink-0" />}
                      </div>
                      <span className="text-[11px] sm:text-sm text-zinc-300 mt-1 line-clamp-1">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Concept Input */}
              {conceptType === "Custom" && (
                <div className="pt-1">
                  <input
                    type="text"
                    placeholder="Mô tả ý tưởng hoặc phong cách chụp bạn mong muốn (Ví dụ: Chụp ảnh cá nhân đường phố Y2K...)"
                    value={customRequest}
                    onChange={(e) => setCustomRequest(e.target.value)}
                    required
                    className="w-full liquid-glass-input rounded-2xl px-4 py-3.5 text-sm sm:text-base placeholder:text-zinc-400 focus:outline-none"
                  />
                </div>
              )}

              {/* Số lượng người chụp & Buổi chụp & Tạm tính (Dành cho Kỷ Yếu & Cử Nhân) */}
              {conceptType !== "Event" && (
                <div className="pt-2 space-y-3.5">
                  {/* Mục 1: Số lượng người chụp */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm text-zinc-200 font-medium">
                        Số lượng người chụp:
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#B5945B]">
                        {classSize > 5 ? `${classSize} người (Nhóm đông)` : `${classSize} người`}
                      </span>
                    </div>

                    {/* 5 Nút chọn trực quan - Liquid Glass Pills */}
                    <div className="grid grid-cols-5 gap-1 sm:gap-2">
                      {[
                        { num: 1, label: "1 người", short: "1 bạn" },
                        { num: 2, label: "2 người", short: "2 bạn" },
                        { num: 3, label: "3 người", short: "3 bạn" },
                        { num: 4, label: "4 - 5 người", short: "4-5 bạn" },
                        { num: 6, label: "Lớp đông (>5)", short: ">5 bạn" },
                      ].map((item) => {
                        const isSelected = item.num === 6 ? classSize > 5 : classSize === item.num;
                        return (
                          <button
                            key={item.num}
                            type="button"
                            onClick={() => setClassSize(item.num)}
                            className={`py-2 sm:py-3 px-0.5 sm:px-1 rounded-xl text-center cursor-pointer transition-all duration-200 text-[11px] sm:text-sm font-semibold select-none active:scale-95 whitespace-nowrap overflow-hidden text-ellipsis ${
                              isSelected
                                ? "liquid-glass-gold-btn font-extrabold"
                                : "liquid-glass-card border-white/10 text-zinc-200 hover:text-white"
                            }`}
                          >
                            <span className="hidden sm:inline">{item.label}</span>
                            <span className="sm:hidden">{item.short}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Nhập số lượng cụ thể nếu là Lớp đông */}
                    {classSize > 5 && (
                      <div className="flex items-center gap-3 liquid-glass-card rounded-2xl p-3.5 mt-2">
                        <span className="text-xs sm:text-sm text-zinc-200">
                          Số lượng bạn trong lớp:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setClassSize((prev) => Math.max(6, prev - 1))}
                            className="w-8 h-8 rounded-lg liquid-glass-btn text-white font-bold flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                          >
                            -
                          </button>
                          <span className="text-sm font-bold text-[#B5945B] min-w-[32px] text-center">
                            {classSize}
                          </span>
                          <button
                            type="button"
                            onClick={() => setClassSize((prev) => prev + 1)}
                            className="w-8 h-8 rounded-lg liquid-glass-btn text-white font-bold flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                          >
                            +
                          </button>
                          <span className="text-xs sm:text-sm text-zinc-300">bạn</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mục 2: Chọn buổi chụp trong ngày (Nằm ngay dưới Số lượng người chụp) */}
                  {(conceptType === "THPT" || conceptType === "University" || conceptType === "Custom") && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm text-zinc-200 font-medium">
                          Chọn buổi chụp trong ngày:
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-[#B5945B]">
                          {estimateShift === "full" ? "Gói Cả ngày" : "Gói Nửa ngày"}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          {
                            label: "Ca Sáng",
                            time: "07:00 – 11:00",
                            desc: "Nắng sớm dịu, mát mẻ, ảnh trong",
                            val: "Nửa ngày sáng (7h00 - 11h00)",
                          },
                          {
                            label: "Ca Chiều",
                            time: "13:00 – 17:00",
                            desc: "Nắng chiều ấm, đón hoàng hôn",
                            val: "Nửa ngày chiều (13h00 - 17h00)",
                          },
                          {
                            label: "Cả Ngày",
                            time: "07:00 – 17:00",
                            desc: "Trọn vẹn thời gian cả ngày",
                            val: "Cả ngày (7h00 - 17h00)",
                          },
                        ].map((s) => {
                          const isSelected = thptShift === s.val;
                          return (
                            <button
                              key={s.val}
                              type="button"
                              onClick={() => handleThptShiftChange(s.val)}
                              className={`p-3.5 rounded-2xl text-left cursor-pointer transition-all duration-300 select-none active:scale-95 flex flex-col justify-between ${
                                isSelected
                                  ? "liquid-glass-btn border-[#B5945B] font-semibold ring-1 ring-[#B5945B]/60"
                                  : "liquid-glass-card border-white/10 text-zinc-200 hover:text-white"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-sm sm:text-base font-bold ${isSelected ? "text-[#B5945B]" : "text-white"}`}>
                                  {s.label}
                                </span>
                                {isSelected && <Check className="w-4 h-4 text-[#B5945B] stroke-[2.5]" />}
                              </div>
                              <span className={`text-xs sm:text-sm mt-0.5 font-mono ${isSelected ? "text-[#f0d5a3]" : "text-[#B5945B]"}`}>
                                {s.time}
                              </span>
                              <span className={`text-xs sm:text-sm mt-1 line-clamp-1 ${isSelected ? "text-zinc-100" : "text-zinc-300"}`}>
                                {s.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Khung giờ nhận bằng cụ thể (Dành riêng khi chọn Cử Nhân) */}
                      {conceptType === "University" && (
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 liquid-glass-card p-3.5 rounded-2xl">
                          <span className="text-xs sm:text-sm text-zinc-200">
                            Khung giờ bạn nhận bằng tại hội trường (nếu biết trước):
                          </span>
                          <div className="relative">
                            <select
                              value={gradTime}
                              onChange={(e) => setGradTime(e.target.value)}
                              className="liquid-glass-input rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none appearance-none cursor-pointer pr-8"
                            >
                              {TWENTY_FOUR_HOUR_SLOTS.map((t, i) => (
                                <option key={i} value={t} className="bg-zinc-900 text-white">
                                  {t}
                                </option>
                              ))}
                            </select>
                            <Clock className="absolute right-2.5 top-2.5 w-4 h-4 text-zinc-400 pointer-events-none" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mục 3: Tạm tính chi phí - Apple Liquid Glass frosted highlight */}
                  {(conceptType === "THPT" || conceptType === "University" || conceptType === "Custom") && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 liquid-glass border border-[#B5945B]/40 rounded-2xl p-4 sm:p-5 mt-2">
                      <div>
                        <span className="text-zinc-300 text-xs sm:text-sm block mb-1 font-medium">
                          Tạm tính chi phí dự kiến:
                        </span>
                        <div className="flex items-baseline flex-wrap gap-2">
                          <strong className="text-[#B5945B] text-xl sm:text-2xl font-bold font-mono tracking-tight">
                            {(classSize * getActivePrice(classSize, estimateShift === "full")).toLocaleString("vi-VN")}đ
                          </strong>
                          <span className="text-zinc-200 text-xs sm:text-sm">
                            ({(getActivePrice(classSize, estimateShift === "full") / 1000).toLocaleString("vi-VN")}k / bạn · Nhóm {classSize} người · {estimateShift === "full" ? "Cả ngày" : "Nửa ngày"})
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowFullPriceModal(true)}
                        className="inline-flex items-center justify-center gap-1.5 text-xs sm:text-sm text-[#B5945B] hover:text-white font-bold py-2.5 px-4 rounded-xl liquid-glass-btn border-[#B5945B]/40 hover:border-[#B5945B] transition-all cursor-pointer shrink-0 whitespace-nowrap self-start sm:self-auto active:scale-95"
                      >
                        <Coins className="w-3.5 h-3.5 text-[#B5945B]" />
                        <span>Xem chi tiết bảng giá ↗</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* BƯỚC 2: CHỌN NGÀY CHỤP */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#B5945B]/20 text-[#B5945B] font-extrabold text-sm flex items-center justify-center border border-[#B5945B]/40">
                  2
                </span>
                <label className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">
                  Chọn ngày chụp trên lịch <span className="text-[#B5945B]">*</span>
                </label>
              </div>

              {conceptType === "Event" ? (
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(true)}
                  className="w-full flex items-center justify-between bg-zinc-900/80 hover:bg-zinc-800 border border-white/15 focus:border-[#B5945B] rounded-xl px-4 py-3.5 text-left cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-[#B5945B]" />
                    <div>
                      <span className="text-xs sm:text-sm text-zinc-300 block font-medium">Lịch sự kiện dự kiến:</span>
                      <span className="text-sm sm:text-base font-semibold text-white">
                        {date ? `${date.split("-").reverse().join("/")} (Từ ${eventStartTime} đến ${eventEndTime})` : "Chạm để chọn ngày & giờ sự kiện"}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-[#B5945B] bg-[#B5945B]/10 px-3.5 py-1.5 rounded-lg border border-[#B5945B]/30">
                    {date ? "Đổi lịch" : "Chọn lịch →"}
                  </span>
                </button>
              ) : (
                <div>
                  {/* Nút bấm chọn ngày to rõ ràng - Apple Liquid Glass */}
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(true)}
                    className={`w-full flex items-center justify-between rounded-2xl p-4 sm:p-5 text-left cursor-pointer transition-all duration-300 border ${
                      date
                        ? "liquid-glass-btn border-[#B5945B] text-white ring-1 ring-[#B5945B]/50"
                        : "liquid-glass-card border-white/10 text-zinc-200 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 truncate">
                      <div className="w-10 h-10 rounded-xl liquid-glass-btn flex items-center justify-center shrink-0">
                        <Calendar className={`w-5 h-5 ${date ? "text-[#B5945B]" : "text-zinc-300"}`} />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm text-zinc-300 block uppercase tracking-wider font-semibold">
                          Ngày chụp dự kiến:
                        </span>
                        <span className="text-base sm:text-lg font-bold text-white truncate block">
                          {date ? date.split("-").reverse().join("/") : "Chạm vào đây để chọn ngày chụp trên lịch"}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-[#B5945B] liquid-glass-btn border-[#B5945B]/30 px-3.5 py-2 rounded-xl shrink-0 ml-2">
                      {date ? "Đổi ngày" : "Mở lịch →"}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* BƯỚC 3: THÔNG TIN LIÊN HỆ */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#B5945B]/20 text-[#B5945B] font-extrabold text-sm flex items-center justify-center border border-[#B5945B]/40">
                  3
                </span>
                <label className="text-sm sm:text-base font-bold text-white uppercase tracking-wide">
                  Thông tin người đặt <span className="text-[#B5945B]">*</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Họ tên */}
                <div>
                  <label className="text-xs sm:text-sm text-zinc-100 font-semibold mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#E5C17C] shrink-0" />
                    <span>Họ tên bạn / Tên Lớp & Trường <span className="text-[#B5945B]">*</span></span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ví dụ: Nguyễn Linh Chi - Lớp 12A1"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      required
                      className="w-full liquid-glass-input rounded-2xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-white placeholder:text-zinc-400 focus:outline-none transition-all"
                    />
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B5945B]" />
                  </div>
                </div>

                {/* 2. Số điện thoại / Zalo */}
                <div>
                  <label className="text-xs sm:text-sm text-zinc-100 font-semibold mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#E5C17C] shrink-0" />
                    <span>Số điện thoại / Zalo <span className="text-[#B5945B]">*</span></span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      placeholder="Số điện thoại nhận ảnh và tư vấn Zalo"
                      value={contactHandle}
                      onChange={(e) => setContactHandle(e.target.value)}
                      required
                      className="w-full liquid-glass-input rounded-2xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-white placeholder:text-zinc-400 focus:outline-none transition-all"
                    />
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B5945B]" />
                  </div>
                </div>

                {/* 3. Địa chỉ / Điểm hẹn */}
                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm text-zinc-100 font-semibold mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#E5C17C] shrink-0" />
                    <span>Địa chỉ / Điểm hẹn chụp dự kiến <span className="text-[#B5945B]">*</span></span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ví dụ: Tại Studio Bergh Ryker, hoặc Sân trường Chu Văn An..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                      className="w-full liquid-glass-input rounded-2xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-white placeholder:text-zinc-400 focus:outline-none transition-all"
                    />
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B5945B]" />
                  </div>
                </div>

                {/* 4. Email */}
                <div>
                  <label className="text-xs sm:text-sm text-zinc-100 font-semibold mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#E5C17C] shrink-0" />
                    <span>Email nhận bản sao hợp đồng (Tùy chọn)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full liquid-glass-input rounded-2xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-white placeholder:text-zinc-400 focus:outline-none transition-all"
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B5945B]" />
                  </div>
                </div>

                {/* 5. Ghi chú thêm */}
                <div>
                  <label className="text-xs sm:text-sm text-zinc-100 font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#E5C17C] shrink-0" />
                    <span>Ghi chú thêm (Tùy chọn)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Thuê vest, trang phục, đạo cụ (nếu có)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full liquid-glass-input rounded-2xl pl-11 pr-4 py-3.5 text-sm sm:text-base text-white placeholder:text-zinc-400 focus:outline-none transition-all"
                    />
                    <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B5945B]" />
                  </div>
                </div>
              </div>
            </div>

            {/* NÚT ĐẶT LỊCH CHUYÊN NGHIỆP - Apple Liquid Glass Gold CTA */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 liquid-glass-gold-btn active:scale-[0.99] font-extrabold text-sm sm:text-base tracking-wider rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 uppercase disabled:opacity-50 disabled:cursor-not-allowed border border-[#B5945B]/60"
              >
                <Send className="w-4 h-4 stroke-[2.5]" />
                <span>{isSubmitting ? "Đang gửi đơn..." : "XÁC NHẬN ĐẶT LỊCH NGAY"}</span>
              </button>

              {/* Cam kết uy tín */}
              <div className="flex flex-wrap items-center justify-around gap-2 text-[11px] sm:text-xs text-zinc-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#B5945B]" />
                  <span>Xác nhận qua Zalo trong 15p</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#B5945B]" />
                  <span>Hỗ trợ dời ngày miễn phí</span>
                </span>
              </div>
            </div>
          </form>

          {isCalendarOpen && (
            <React.Suspense fallback={null}>
              <AvailabilityCalendar
                isOpen={isCalendarOpen}
                onClose={() => setIsCalendarOpen(false)}
                selectedDate={date}
                onSelectDate={(selectedDateStr) => {
                  setDate(selectedDateStr);
                  setIsCalendarOpen(false);
                }}
                isAdminMode={isAdminMode}
              />
            </React.Suspense>
          )}

          {isFapCalendarOpen && (
            <React.Suspense fallback={null}>
              <FapWeeklyCalendar
                isOpen={isFapCalendarOpen}
                onClose={() => setIsFapCalendarOpen(false)}
                selectedDate={date}
                selectedTime={eventTime}
                onSelectSlot={(selectedDateStr, selectedTimeStr) => {
                  setDate(selectedDateStr);
                  setEventTime(selectedTimeStr);
                  setIsFapCalendarOpen(false);
                }}
                isAdminMode={isAdminMode}
              />
            </React.Suspense>
          )}

          {isEventModalOpen && (
            <EventScheduleModal
              isOpen={isEventModalOpen}
              onClose={() => setIsEventModalOpen(false)}
              selectedDate={date}
              selectedStartTime={eventStartTime}
              selectedEndTime={eventEndTime}
              bookings={bookings}
              onSelectEventSchedule={(selectedDateStr, startT, endT, summaryLabel) => {
                setDate(selectedDateStr);
                setEventStartTime(startT);
                setEventEndTime(endT);
                setEventTime(summaryLabel);
                setIsEventModalOpen(false);
              }}
            />
          )}

          {/* Feedback messages */}
          <AnimatePresence>
            {successMsg && (
              <motion.div
                key="success-msg"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden w-full max-w-full"
              >
                <div className="p-4 sm:p-5 bg-zinc-950 border border-emerald-500/30 rounded-xl text-emerald-50 relative flex flex-col gap-3.5 sm:gap-4 w-full min-w-0 box-border">
                  {/* Subtle success confetti animation */}
                  <SubtleConfetti />

                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm sm:text-base text-white truncate">
                          {submittedData && submittedData.deposit > 0 && !submittedData.hasConfirmedPayment
                            ? "Đang chờ thanh toán"
                            : "Đặt lịch thành công!"}
                        </h3>
                        <p className="text-emerald-400/80 text-[11px] sm:text-xs font-mono mt-0.5 uppercase tracking-wide">
                          Ticket: {myBookingIds[myBookingIds.length - 1]}
                        </p>
                      </div>
                    </div>
                  </div>

                  {submittedData?.customerEmail && (
                    <div className="flex items-start gap-2.5 text-xs sm:text-[13px] leading-relaxed text-emerald-300 bg-emerald-950/60 border border-emerald-500/25 p-3 sm:px-3.5 sm:py-3 rounded-xl w-full min-w-0 box-border">
                      <Mail className="w-4 h-4 text-[#B5945B] shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                        {submittedData.concept === "THPT" || submittedData.concept === "University" ? (
                          submittedData.hasConfirmedPayment ? (
                            <>
                              Đã xác nhận cọc &amp; gửi Gmail duyệt đơn thành công tới:{" "}
                              <strong className="text-white underline font-mono font-medium break-all [overflow-wrap:anywhere] underline-offset-2 decoration-emerald-500/60">
                                {submittedData.customerEmail}
                              </strong>
                            </>
                          ) : (
                            <>
                              Sau khi chuyển khoản cọc thành công hoặc Studio duyệt đơn, hệ thống sẽ tự động gửi Gmail xác nhận đặt đơn tới:{" "}
                              <strong className="text-white underline font-mono font-medium break-all [overflow-wrap:anywhere] underline-offset-2 decoration-emerald-500/60">
                                {submittedData.customerEmail}
                              </strong>
                            </>
                          )
                        ) : (
                          <>
                            Đã tự động gửi Gmail xác nhận đặt lịch &amp; mã vé tới:{" "}
                            <strong className="text-white underline font-mono font-medium break-all [overflow-wrap:anywhere] underline-offset-2 decoration-emerald-500/60">
                              {submittedData.customerEmail}
                            </strong>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Photo Progress Direct Tracking Button */}
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = submittedData?.id || myBookingIds[myBookingIds.length - 1];
                        window.dispatchEvent(
                          new CustomEvent("openPhotoProgressLookup", {
                            detail: { bookingId: targetId },
                          })
                        );
                      }}
                      className="w-full py-2.5 px-3 bg-zinc-900/90 hover:bg-zinc-800 text-[#B5945B] hover:text-[#d4af37] border border-[#B5945B]/30 hover:border-[#B5945B]/60 rounded-xl text-xs font-bold font-sans uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <Palette className="w-4 h-4 text-[#B5945B]" />
                      <span>Xem Tiến Độ Chỉnh Sửa &amp; Nhận File Đơn Này</span>
                    </button>
                  </div>

                  {submittedData &&
                    (submittedData.concept === "THPT" || submittedData.concept === "University") &&
                    submittedData.deposit > 0 &&
                    !submittedData.hasConfirmedPayment && (
                      <div className="flex flex-col gap-4 bg-emerald-900/10 p-5 rounded-2xl border border-emerald-500/20 items-center text-center mt-2">
                        <p className="text-emerald-300 font-semibold text-[15px]">
                            Thông tin chuyển khoản giữ lịch
                        </p>
                        
                        <div className="bg-white p-3 rounded-2xl shadow-xl w-60 h-60 sm:w-72 sm:h-72">
                          <img
                            src={`https://img.vietqr.io/image/mbbank-9999917022004-compact2.png?amount=${submittedData.deposit}&addInfo=COC%20${submittedData.id}&accountName=NGUYEN%20DUC%20DUNG`}
                            alt="VietQR Tiền cọc"
                            className="w-full h-full object-contain rounded-xl"
                          />
                        </div>
                        
                        <button
                          type="button"
                          onClick={handleDownloadQR}
                          className="bg-emerald-600 outline-none focus:ring-2 focus:ring-emerald-400 focus:outline-none hover:bg-emerald-500 text-emerald-50 text-xs font-bold py-2.5 px-6 rounded-full flex items-center justify-center gap-2 transition-colors uppercase tracking-widest mt-1 shadow-lg shadow-emerald-900/30 w-auto"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Tải Ảnh QR
                        </button>
                        
                        <div className="flex flex-col gap-2 text-sm text-emerald-100 w-full max-w-sm mt-3">
                          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                            <span className="text-emerald-400/80">Số tiền:</span>
                            <span className="font-mono text-white font-bold text-[15px]">{submittedData.deposit.toLocaleString("vi-VN")}đ</span>
                          </div>
                          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 gap-3">
                            <span className="text-emerald-400/80 whitespace-nowrap">Nội dung (BẮT BUỘC):</span>
                            <span className="font-mono text-white text-[15px] font-bold bg-black/50 px-2 py-1 rounded select-all flex-1 text-right truncate">COC {submittedData.id}</span>
                          </div>
                          
                          <p className="text-xs text-amber-300 mt-3 font-medium flex items-center justify-center gap-1.5 animate-pulse bg-amber-900/20 py-2 px-3 rounded-lg border border-amber-500/20">
                            ⏳ Hệ thống đang chờ tự động xác nhận trong vài giây...
                          </p>
                        </div>
                      </div>
                    )}

                  <p className="text-emerald-100/60 text-[11px] leading-relaxed text-center sm:text-left">
                    {submittedData && submittedData.deposit > 0 && submittedData.hasConfirmedPayment
                      ? "Cảm ơn bạn đã thanh toán! Lịch trống đã được chốt và tự động đồng bộ trên hệ thống."
                      : "Bergh.Ryker sẽ liên hệ Zalo/Insta trong 12h. Lịch tự động huỷ nếu chưa nhận cọc sau 24h."}
                  </p>

                  <div className="pt-2 border-t border-emerald-500/20 text-center sm:text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setSuccessMsg(false);
                        setSubmittedData(null);
                      }}
                      className="text-[12px] font-medium tracking-wide text-emerald-400 hover:text-emerald-300 transition-colors uppercase"
                    >
                      Đóng thông báo
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {errorMsg && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-100 text-sm flex flex-col gap-1.5 animate-fadeIn">
              <div className="flex items-center gap-2">
                <X className="w-5 h-5 flex-shrink-0 text-red-400" />
                <span className="font-bold tracking-wide">Lỗi gửi yêu cầu</span>
              </div>
              <p className="text-red-200 text-xs mt-1">{errorMsg}</p>
            </div>
          )}
        </motion.div>

        {/* 45% Right Side - Admin Dashboard (Lazy loaded for optimal initial bundle & performance) */}
        {isAdminMode && (
          <React.Suspense
            fallback={
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-8 bg-zinc-950/60 rounded-2xl border border-white/5 min-h-[300px]">
                <div className="w-8 h-8 rounded-full border-2 border-[#B5945B]/20 border-t-[#B5945B] animate-spin mb-3" />
                <span className="text-xs font-sans text-zinc-400">Đang tải bảng quản trị...</span>
              </div>
            }
          >
            <AdminDashboard
              isAdminMode={isAdminMode}
              isLoggedAdmin={isLoggedAdmin}
              bookings={bookings}
              myBookingIds={myBookingIds}
              googleToken={googleToken}
              setGoogleToken={setGoogleToken}
              isCleaningUp={isCleaningUp}
              onOpenCalendar={() => setIsCalendarOpen(true)}
              onProceedWithBatchSync={proceedWithBatchSync}
              onPerformTwoWaySync={performTwoWaySync}
              onCleanupOldBookings={handleCleanupOldBookings}
              onCancelBooking={cancelBooking}
              onUpdateBookingStatus={updateBookingStatus}
              triggerConfirm={triggerConfirm}
              showToast={showToast}
              getAccessToken={getAccessToken}
              googleSignIn={googleSignIn}
              formatDateDMY={formatDateDMY}
              getConceptVietnameseName={getConceptVietnameseName}
              TIME_SLOTS={TIME_SLOTS}
            />
          </React.Suspense>
        )}
      </div>

      {/* Admin Login Modal Overlay */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in-quick animate-duration-200">
          <div className="w-full max-w-sm bg-zinc-950 border-2 border-[#B5945B]/30 p-6 rounded-2xl shadow-lg relative text-left overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <button
              type="button"
              onClick={() => {
                setShowAdminLogin(false);
                setLoginError("");
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-amber-400/10 rounded-xl border border-amber-400/20 text-[#B5945B]">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <span className="font-sans text-[11px] text-[#B5945B] tracking-wide uppercase font-medium block">
                  Secure Portal
                </span>
                <h3 className="font-sans font-bold text-sm uppercase text-white tracking-wide">
                  Xác Minh Quản Trị Viên
                </h3>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 mb-6 leading-relaxed font-sans">
              Hệ thống yêu cầu bạn đăng nhập thông qua tài khoản Google Admin
              được ủy quyền.
            </p>

            <button
              type="button"
              onClick={async () => {
                setLoginError("");
                try {
                  const res = await googleSignIn();
                  if (res && res.user) {
                    // Since App.tsx has an onAuthStateChanged listener,
                    // a successful Google Login will instantly propagate to
                    // the isLoggedAdmin prop via useAdminAuth hook.
                    setIsAdminMode(true);
                    sessionStorage.setItem("admin_logged_in", "true");
                    setShowAdminLogin(false);
                    setLoginError("");
                  } else {
                    setLoginError(
                      "Tài khoản Google này không có quyền quản trị viên.",
                    );
                  }
                } catch (err: any) {
                  setLoginError(
                    "Đăng nhập Google thất bại! Lỗi:" + err.message,
                  );
                }
              }}
              className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-zinc-200 text-black text-xs font-bold py-2.5 rounded-full focus:outline-none transition-all shadow-md cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>ĐĂNG NHẬP VỚI GOOGLE ADMIN</span>
            </button>

            {loginError && (
              <div className="mt-4 text-[12px] text-rose-400 font-sans italic animate-pulse flex items-center gap-1 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                ⚠️ {loginError}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Full Price Table Modal */}
      {showFullPriceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in-quick">
          <div className="w-full max-w-2xl bg-zinc-950 border border-[#B5945B]/30 rounded-2xl shadow-2xl relative text-left overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#B5945B]/15 text-[#B5945B]">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] text-[#B5945B] uppercase font-bold tracking-widest block">
                    ✦ BERGH RYKER STUDIO
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Bảng Giá Dịch Vụ Niêm Yết
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFullPriceModal(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-sm text-zinc-300 font-sans">
              {/* 1. Gói Kỷ Yếu Học Sinh */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h4 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#B5945B]" />
                    1. Gói Kỷ Yếu Học Sinh (Cấp 2 - Cấp 3 / Lớp 9 - 12)
                  </h4>
                  <span className="text-[11px] text-[#B5945B] font-semibold bg-[#B5945B]/10 px-2 py-0.5 rounded">
                    Phổ biến nhất
                  </span>
                </div>
                <div className="bg-zinc-900/80 rounded-xl p-3 border border-white/5 space-y-2">
                  <div className="grid grid-cols-12 text-xs font-semibold text-zinc-400 pb-1.5 border-b border-white/5">
                    <span className="col-span-5">Quy mô</span>
                    <span className="col-span-3 text-center">Nửa ngày</span>
                    <span className="col-span-4 text-right">Cả ngày</span>
                  </div>
                  {[
                    { size: "1 người (Cá nhân)", half: "900.000đ", full: "1.500.000đ", num: 1 },
                    { size: "2 người (Đôi bạn)", half: "700.000đ / bạn", full: "800.000đ / bạn", num: 2 },
                    { size: "3 người (Nhóm 3 bạn)", half: "600.000đ / bạn", full: "700.000đ / bạn", num: 3 },
                    { size: "4 - 5 người", half: "500.000đ / bạn", full: "600.000đ / bạn", num: 4 },
                    { size: "Tập thể (>5 bạn)", half: "500.000đ / bạn", full: "600.000đ / bạn", num: 10 },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setClassSize(item.num);
                        setShowFullPriceModal(false);
                      }}
                      className="grid grid-cols-12 text-xs py-1.5 px-2 rounded-lg hover:bg-zinc-800/80 cursor-pointer transition-colors"
                    >
                      <span className="col-span-5 text-white font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#B5945B]" />
                        <span>{item.size}</span>
                      </span>
                      <span className="col-span-3 text-center text-[#B5945B] font-mono font-medium">{item.half}</span>
                      <span className="col-span-4 text-right text-emerald-400 font-mono font-medium">{item.full}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed flex items-center justify-between">
                  <span>* Bấm vào dòng bất kỳ để tự động chọn quy mô nhóm.</span>
                  <span className="text-[#B5945B]">Chạm để chọn ↗</span>
                </p>
              </div>

              {/* 2. Gói Cử Nhân / Tốt Nghiệp */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h4 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#B5945B]" />
                    2. Gói Tốt Nghiệp / Cử Nhân (Đại Học, Cao Đẳng)
                  </h4>
                  <span className="text-[11px] text-zinc-400 font-medium">Lễ trao bằng</span>
                </div>
                <div className="bg-zinc-900/80 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>Nhóm từ 1 - 2 bạn tốt nghiệp:</span>
                    <span className="text-[#B5945B] font-bold font-mono">700k - 900k / bạn</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>Nhóm từ 3 - 5 bạn trở lên:</span>
                    <span className="text-[#B5945B] font-bold font-mono">500k - 600k / bạn</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Thời gian chụp linh hoạt:</span>
                    <span className="text-zinc-300">Khung 2 tiếng - 4 tiếng theo giờ nhận bằng</span>
                  </div>
                </div>
              </div>

              {/* 3. Gói Cá Nhân / Nghệ Thuật & Sự Kiện */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-zinc-900/80 rounded-xl p-3.5 border border-white/5 space-y-1">
                  <h5 className="font-bold text-white text-xs uppercase text-[#B5945B]">
                    3. Cá Nhân / Nghệ Thuật
                  </h5>
                  <p className="text-xs text-zinc-300">Chân dung, Profile, Street style, Lookbook</p>
                  <p className="text-xs font-mono font-bold text-white pt-1">Từ 900.000đ / concept</p>
                  <p className="text-[11px] text-zinc-400">Trả toàn bộ file gốc + 15 file photoshop kỹ càng.</p>
                </div>

                <div className="bg-zinc-900/80 rounded-xl p-3.5 border border-white/5 space-y-1">
                  <h5 className="font-bold text-white text-xs uppercase text-[#B5945B]">
                    4. Sự Kiện / Tiệc Prom
                  </h5>
                  <p className="text-xs text-zinc-300">Tiệc gala, Prom night, Sinh nhật, Hội nghị</p>
                  <p className="text-xs font-mono font-bold text-white pt-1">Báo giá theo giờ sự kiện</p>
                  <p className="text-[11px] text-zinc-400">Máy ảnh cinema cao cấp + Đèn flash công suất lớn.</p>
                </div>
              </div>

              {/* 4. Quyền lợi cam kết */}
              <div className="bg-[#B5945B]/10 border border-[#B5945B]/20 rounded-xl p-3.5 space-y-1.5 text-xs">
                <span className="font-bold text-[#B5945B] block uppercase tracking-wide">
                  ✦ Cam kết chất lượng dịch vụ
                </span>
                <ul className="space-y-1 text-zinc-300 text-[11px]">
                  <li>✓ <strong>100% File gốc:</strong> Bàn giao toàn bộ ngay sau buổi chụp qua Google Drive tốc độ cao.</li>
                  <li>✓ <strong>Tạo dáng chuyên nghiệp:</strong> Nhiếp ảnh gia hướng dẫn chi tiết từng cử chỉ, biểu cảm.</li>
                  <li>✓ <strong>Đổi ngày miễn phí:</strong> Báo trước 48h được hỗ trợ đổi sang ngày khác không mất phí.</li>
                  <li>✓ <strong>Bảo hành thời tiết:</strong> Hoàn cọc 100% nếu có mưa bão hoặc yếu tố khách quan không thể chụp.</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-zinc-900/80 flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-400">
                Cọc 30% giữ chỗ ngày chụp
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowFullPriceModal(false);
                  const el = document.getElementById("booking-contact-section");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-5 py-2.5 bg-[#B5945B] hover:bg-[#c9a76d] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
              >
                Đặt Lịch Ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ToastContainer for booking alerts */}
      <ToastContainer toasts={toasts} />

      {/* Modern state-driven custom modal overlay to completely bypass browser iframe restrictions */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={() => setConfirmModal(null)}
          />
          <div className="relative bg-[#0d0d0e] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-lg text-left animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wide font-sans flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {confirmModal.title}
            </h3>
            <p className="text-xs text-gray-400 mb-6 whitespace-pre-line leading-relaxed font-sans">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-3 font-sans">
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal(null);
                }}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[11px] font-medium uppercase tracking-wide transition-all cursor-pointer"
              >
                {confirmModal.cancelText || "Hủy"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cb = confirmModal.onConfirm;
                  setConfirmModal(null);
                  await cb();
                }}
                className="px-4 py-1.5 bg-[#B5945B] hover:bg-[#9d7d45] text-white rounded-lg text-[11px] font-medium uppercase tracking-wide transition-all shadow-md cursor-pointer"
              >
                {confirmModal.confirmText || "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
