import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  CalendarDays,
  Trash2,
  Check,
  X,
  RefreshCw,
  Sliders,
  SlidersHorizontal,
  Palette,
  ExternalLink,
  Sparkles,
  PlusCircle,
  FileSpreadsheet,
  MessageSquare,
  Clock,
  ArrowLeftRight,
  UserPlus,
  BarChart3,
  Settings,
  Plus,
} from "lucide-react";
import { motion } from "motion/react";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Booking } from "../types";
import { syncAllBookingsToSheet } from "../services/googleSheetsService";
import { AdminLiveChat } from "./AdminLiveChat";
import { SchoolScheduleSync } from "./admin/SchoolScheduleSync";
import { BookingSlotAvailabilityManager } from "./admin/BookingSlotAvailabilityManager";
import { AdminPhotoProgressModal } from "./AdminPhotoProgressModal";
import { BookingConfirmationQrSection } from "./admin/BookingConfirmationQrSection";
import { AdminCreateBookingModal } from "./admin/AdminCreateBookingModal";
import { AdminBatchImportModal } from "./admin/AdminBatchImportModal";

interface AdminDashboardProps {
  isAdminMode: boolean;
  isLoggedAdmin?: boolean;
  bookings: Booking[];
  myBookingIds: string[];
  googleToken: string | null;
  setGoogleToken: (token: string | null) => void;
  isCleaningUp: boolean;
  onOpenCalendar: () => void;
  onProceedWithBatchSync: (token: string) => Promise<void>;
  onPerformTwoWaySync: (token: string) => Promise<void>;
  onCleanupOldBookings: () => Promise<void>;
  onCancelBooking: (id: string) => Promise<void>;
  onUpdateBookingStatus: (id: string, newStatus: Booking["status"]) => Promise<void>;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  getAccessToken: () => Promise<string | null>;
  googleSignIn: () => Promise<any>;
  formatDateDMY: (dateStr?: string) => string;
  getConceptVietnameseName: (concept?: string) => string;
  TIME_SLOTS: Array<{ id: number; name: string; time: string }>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isAdminMode,
  isLoggedAdmin,
  bookings,
  myBookingIds,
  googleToken,
  setGoogleToken,
  isCleaningUp,
  onOpenCalendar,
  onProceedWithBatchSync,
  onPerformTwoWaySync,
  onCleanupOldBookings,
  onCancelBooking,
  onUpdateBookingStatus,
  triggerConfirm,
  showToast,
  getAccessToken,
  googleSignIn,
  formatDateDMY,
  getConceptVietnameseName,
  TIME_SLOTS,
}) => {
  const [adminActiveTab, setAdminActiveTab] = useState<
    "schedule" | "chat" | "school_sync" | "availability_config"
  >("schedule");
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState(false);

  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const handleSavePhotoProgress = async (bookingId: string, progressData: Partial<Booking>) => {
    try {
      const target = bookings.find((b) => b.id === bookingId);
      if (!target) return;
      await setDoc(doc(db, "bookings", bookingId), {
        ...target,
        ...progressData,
      }, { merge: true });
      showToast("Cập nhật tiến độ ảnh thành công!", "success");
    } catch (err: any) {
      console.error("Save photo progress error:", err);
      showToast("Lỗi cập nhật tiến độ ảnh", "error");
    }
  };

  const handleSyncAllToGoogleSheet = async () => {
    let targetBookings: Booking[] = [...bookings];
    try {
      // 1. Quét collection 'bookings'
      const snap = await getDocs(collection(db, "bookings"));
      snap.forEach((d) => {
        const data = d.data() as any;
        const exists = targetBookings.some((b) => b.id === d.id || (b.bookingCode && b.bookingCode === data.bookingCode));
        if (!exists) {
          targetBookings.push({ id: d.id, ...data });
        }
      });

      // 2. Quét collection 'availableDates' - CHỈ LẤY các ngày có tên khách hoặc SĐT thực tế
      const datesSnap = await getDocs(collection(db, "availableDates"));
      datesSnap.forEach((d) => {
        const data = d.data() as any;
        // Chỉ lấy nếu ngày có thông tin khách thực tế (tên khách hàng hoặc số điện thoại)
        const hasRealCustomer = Boolean(data.schoolName || data.phone || data.customerName);
        if (hasRealCustomer) {
          const exists = targetBookings.some((b) => b.date === d.id);
          if (!exists) {
            targetBookings.push({
              id: `DATE_${d.id}`,
              date: d.id,
              schoolName: data.schoolName || data.customerName || "Khách lịch trình",
              phone: data.phone || "",
              instagramOrZalo: data.phone || data.instagramOrZalo || "",
              conceptType: "THPT",
              classSize: 1,
              status: "confirmed",
              notes: data.notes || data.reason || "",
              createdAt: data.updatedAt || new Date().toISOString(),
            } as any);
          }
        }
      });
    } catch (e) {
      console.warn("Could not fetch extra bookings from Firestore:", e);
    }

    // Nếu hệ thống chưa có dữ liệu hoặc danh sách khách rỗng, mở modal nhập hàng loạt
    if (targetBookings.length === 0) {
      triggerConfirm(
        "Chưa có dữ liệu khách hàng",
        "Hệ thống nhận thấy bạn chưa có dữ liệu khách hàng cũ nào trong database. Bạn có muốn mở bảng 'Nhập Dữ Liệu Khách Hàng Cũ' để quét tự động từ Google Calendar hoặc dán từ Excel không?",
        () => {
          setIsBatchImportModalOpen(true);
        },
        undefined,
        "Quét / Nhập ngay",
        "Để sau"
      );
      return;
    }

    // Kiểm tra xem có bao nhiêu khách hàng đang thiếu số điện thoại
    const missingPhoneCount = targetBookings.filter((b) => {
      const p = (b.phone || b.instagramOrZalo || "").replace(/[^\d]/g, "");
      return p.length < 9;
    }).length;

    if (missingPhoneCount > 0) {
      triggerConfirm(
        "Phát hiện lịch trình thiếu Số điện thoại",
        `Hệ thống tìm thấy ${targetBookings.length} lịch trình, trong đó có ${missingPhoneCount} lịch trình chưa có Số điện thoại khách hàng (hoặc chỉ có tên sự kiện). Bạn có muốn mở bảng 'Nhập & Bổ Sung Khách Cũ' để quét toàn bộ từ Google Calendar hoặc điền nhanh SĐT trước không?`,
        () => {
          setIsBatchImportModalOpen(true);
        },
        () => {
          proceedSyncToSheet(targetBookings);
        },
        "Bổ sung SĐT ngay",
        "Vẫn đẩy ngay"
      );
      return;
    }

    proceedSyncToSheet(targetBookings);
  };

  const proceedSyncToSheet = (targetBookings: Booking[]) => {
    triggerConfirm(
      "Đẩy tất cả lịch trình lên Google Sheet",
      `Bạn có muốn đẩy toàn bộ ${targetBookings.length} lịch trình khách hàng lên tab KH_Data của Google Sheet? Báo cáo 12 tháng và Dashboard sẽ tự động cập nhật ngay lập tức.`,
      async () => {
        setIsSyncingSheets(true);
        showToast(`Đang bắt đầu đồng bộ ${targetBookings.length} khách hàng lên Google Sheet...`, "info");
        try {
          const result = await syncAllBookingsToSheet(targetBookings, (curr, total) => {
            if (curr === total || curr % 5 === 0) {
              showToast(`Đang đẩy ${curr}/${total} khách hàng lên Google Sheet...`, "info");
            }
          });

          if (result.success) {
            showToast(
              `🎉 Đã đẩy thành công ${result.synced}/${result.total} lịch trình khách hàng lên tab KH_Data!`,
              "success"
            );
          } else {
            showToast(
              result.error || "Không thể đồng bộ lên Google Sheet. Vui lòng kiểm tra lại webhook.",
              "error"
            );
          }
        } catch (err: any) {
          showToast(`Lỗi đồng bộ Google Sheet: ${err?.message || err}`, "error");
        } finally {
          setIsSyncingSheets(false);
        }
      },
      undefined,
      "Đẩy ngay",
      "Hủy"
    );
  };

  const handleBatchSyncCalendar = async () => {
    let activeToken = googleToken ?? (await getAccessToken());
    if (!activeToken) {
      triggerConfirm(
        "Yêu cầu cấp quyền Google Calendar",
        "Hệ thống Bergh.Ryker cần liên kết Google Calendar của bạn để tự động đẩy và đồng bộ lịch trình. Vui lòng chọn Xác nhận để liên kết với tài khoản Google admin của bạn.",
        async () => {
          try {
            const signinRes = await googleSignIn();
            if (signinRes && signinRes.accessToken) {
              setGoogleToken(signinRes.accessToken);
              await onProceedWithBatchSync(signinRes.accessToken);
            } else {
              showToast("Xác thực Google thất bại.", "error");
            }
          } catch (err: any) {
            showToast("Đăng nhập Google thất bại: " + err.message, "error");
          }
        },
        () => {
          showToast(
            "Bị từ chối đồng bộ Google Calendar do không được duyệt quyền.",
            "error",
          );
        },
        "Xác thực",
        "Hủy",
      );
    } else {
      await onProceedWithBatchSync(activeToken);
    }
  };

  const handleTwoWaySync = async () => {
    let activeToken = googleToken;
    if (!activeToken) {
      triggerConfirm(
        "Yêu cầu cấp quyền Google",
        "Hệ thống cần liên kết Google Calendar/Tasks của bạn để kiểm tra và tiến hành đồng bộ 2 chiều.",
        async () => {
          try {
            const signinRes = await googleSignIn();
            if (signinRes && signinRes.accessToken) {
              setGoogleToken(signinRes.accessToken);
              await onPerformTwoWaySync(signinRes.accessToken);
            } else {
              showToast("Xác thực Google thất bại.", "error");
            }
          } catch (err: any) {
            showToast(
              "Đăng nhập Google thất bại: " + err.message,
              "error",
            );
          }
        },
        undefined,
        "Xác thực",
        "Hủy",
      );
    } else {
      await onPerformTwoWaySync(activeToken);
    }
  };

  const handleOpenIntroEditor = () => {
    window.dispatchEvent(new CustomEvent("openIntroEditor"));
  };

  if (!isAdminMode) return null;

  return (
    <div className="lg:col-span-5 flex flex-col gap-4 h-full">
      {/* UNIFIED FLOATING DOCK */}
      <div className="w-full flex justify-center mb-3 sticky top-2 z-40 !overflow-visible">
        <div className="relative !overflow-visible inline-flex items-center gap-1.5 sm:gap-2.5 p-1.5 sm:p-2 rounded-full border border-white/20 bg-zinc-950/90 backdrop-blur-2xl shadow-[0_12px_36px_rgba(0,0,0,0.65)]">

          {/* 1. Quản lý Lịch / Booking */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setAdminActiveTab("schedule")}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                adminActiveTab === "schedule"
                  ? "bg-gradient-to-br from-[#DFB779] to-[#B5945B] text-zinc-950 font-bold shadow-md shadow-[#B5945B]/30 scale-105"
                  : "text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
              aria-label="Quản lý Lịch / Booking"
            >
              <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 flex flex-col items-center z-50">
              <div className="px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-zinc-900/95 border border-white/15 rounded-lg shadow-2xl whitespace-nowrap backdrop-blur-xl">
                Quản lý Lịch / Booking
              </div>
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900/95 -mt-px" />
            </div>
          </div>

          {/* 2. Tin nhắn / Chat */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setAdminActiveTab("chat")}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                adminActiveTab === "chat"
                  ? "bg-gradient-to-br from-[#DFB779] to-[#B5945B] text-zinc-950 font-bold shadow-md shadow-[#B5945B]/30 scale-105"
                  : "text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
              aria-label="Tin nhắn / Chat"
            >
              <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 flex flex-col items-center z-50">
              <div className="px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-zinc-900/95 border border-white/15 rounded-lg shadow-2xl whitespace-nowrap backdrop-blur-xl">
                Tin nhắn / Chat
              </div>
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900/95 -mt-px" />
            </div>
          </div>

          {/* 3. Cấu hình Slot / Thời gian */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setAdminActiveTab("availability_config")}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                adminActiveTab === "availability_config"
                  ? "bg-gradient-to-br from-[#DFB779] to-[#B5945B] text-zinc-950 font-bold shadow-md shadow-[#B5945B]/30 scale-105"
                  : "text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
              aria-label="Cấu hình Slot / Thời gian"
            >
              <Clock className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 flex flex-col items-center z-50">
              <div className="px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-zinc-900/95 border border-white/15 rounded-lg shadow-2xl whitespace-nowrap backdrop-blur-xl">
                Cấu hình Slot / Thời gian
              </div>
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900/95 -mt-px" />
            </div>
          </div>

          {/* 4. Thêm mới Booking */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#B5945B]/20 hover:bg-[#B5945B] text-[#E5C17C] hover:text-zinc-950 border border-[#B5945B]/40 transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
              aria-label="Thêm mới Booking"
            >
              <Plus className="w-4 h-4 sm:w-4.5 sm:h-4.5 font-bold" />
            </button>
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 flex flex-col items-center z-50">
              <div className="px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-zinc-900/95 border border-white/15 rounded-lg shadow-2xl whitespace-nowrap backdrop-blur-xl">
                Thêm mới Booking
              </div>
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900/95 -mt-px" />
            </div>
          </div>

          {/* 5. Đồng bộ hệ thống & 2 chiều */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                isSyncModalOpen || isSyncingSheets
                  ? "bg-blue-500/25 text-blue-300 border border-blue-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-blue-300 hover:bg-blue-500/10"
              }`}
              aria-label="Đồng bộ hệ thống & 2 chiều"
            >
              <RefreshCw className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isSyncingSheets ? "animate-spin text-blue-400" : ""}`} />
            </button>
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 flex flex-col items-center z-50">
              <div className="px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-zinc-900/95 border border-white/15 rounded-lg shadow-2xl whitespace-nowrap backdrop-blur-xl">
                Đồng bộ hệ thống & 2 chiều
              </div>
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900/95 -mt-px" />
            </div>
          </div>

          {/* 6. Thống kê */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setIsStatsModalOpen(true)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                isStatsModalOpen
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              }`}
              aria-label="Thống kê"
            >
              <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 flex flex-col items-center z-50">
              <div className="px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-zinc-900/95 border border-white/15 rounded-lg shadow-2xl whitespace-nowrap backdrop-blur-xl">
                Thống kê
              </div>
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900/95 -mt-px" />
            </div>
          </div>

          {/* 7. Cài đặt */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                isSettingsModalOpen
                  ? "bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10"
              }`}
              aria-label="Cài đặt"
            >
              <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 flex flex-col items-center z-50">
              <div className="px-2.5 py-1 text-[11px] font-sans font-medium text-white bg-zinc-900/95 border border-white/15 rounded-lg shadow-2xl whitespace-nowrap backdrop-blur-xl">
                Cài đặt & Tiện ích
              </div>
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900/95 -mt-px" />
            </div>
          </div>
        </div>
      </div>

      {/* TAB CONTENT: CHAT */}
      {adminActiveTab === "chat" &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex flex-col bg-black/90 backdrop-blur-md lg:p-6 lg:items-center lg:justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full h-full lg:w-[1000px] lg:h-[85vh] lg:max-h-[900px] bg-zinc-950 flex flex-col relative lg:border lg:border-white/10 lg:rounded-2xl lg:overflow-hidden lg:shadow-lg"
            >
              <AdminLiveChat
                isOpen={true}
                onClose={() => setAdminActiveTab("schedule")}
              />
            </motion.div>
          </div>,
          document.body,
        )}

      {/* TAB CONTENT: SCHOOL SCHEDULE SYNC */}
      {adminActiveTab === "school_sync" && <SchoolScheduleSync />}

      {/* TAB CONTENT: AVAILABILITY SLOT CONFIG */}
      {adminActiveTab === "availability_config" && <BookingSlotAvailabilityManager />}

      {/* TAB CONTENT: SCHEDULE */}
      {adminActiveTab === "schedule" &&
        (() => {
          const displayedBookings = bookings;

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 }}
              data-lenis-prevent="true"
              className="bg-zinc-950 border border-white/5 p-5 rounded-2xl relative min-h-[160px] flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span className="font-sans text-xs text-[#E5C17C] font-bold uppercase tracking-wider flex items-center gap-2">
                      Lịch trình
                    </span>
                    <span className="bg-white/10 text-zinc-300 font-semibold px-2.5 py-0.5 rounded-full text-xs border border-white/10">
                      {displayedBookings.length}
                    </span>
                  </div>
                </div>

                {/* STATS AND CHART SECTION */}
                {isAdminMode && bookings.length > 0 && (
                  <div className="mb-4 bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="text-center rounded bg-gray-100 p-2">
                        <p className="text-[11px] text-gray-500 font-medium uppercase">
                          Tổng
                        </p>
                        <p className="text-sm font-bold text-gray-900">
                          {bookings.length}
                        </p>
                      </div>
                      <div className="text-center rounded bg-emerald-50 p-2 border border-emerald-100">
                        <p className="text-[11px] text-emerald-600 font-medium uppercase">
                          Duyệt
                        </p>
                        <p className="text-sm font-bold text-emerald-700">
                          {
                            bookings.filter(
                              (b) => b.status === "Đã duyệt",
                            ).length
                          }
                        </p>
                      </div>
                      <div className="text-center rounded bg-amber-50 p-2 border border-amber-100">
                        <p className="text-[11px] text-amber-600 font-medium uppercase">
                          Chờ
                        </p>
                        <p className="text-sm font-bold text-amber-700">
                          {
                            bookings.filter(
                              (b) => b.status === "Chờ duyệt",
                            ).length
                          }
                        </p>
                      </div>
                      <div className="text-center rounded bg-rose-50 p-2 border border-rose-100">
                        <p className="text-[11px] text-rose-600 font-medium uppercase">
                          Từ chối
                        </p>
                        <p className="text-sm font-bold text-rose-700">
                          {
                            bookings.filter((b) => b.status === "Từ chối")
                              .length
                          }
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        {
                          label: "THPT",
                          count: bookings.filter(
                            (b) => b.conceptType === "THPT",
                          ).length,
                          color: "bg-blue-400",
                        },
                        {
                          label: "Đại học",
                          count: bookings.filter(
                            (b) => b.conceptType === "University",
                          ).length,
                          color: "bg-purple-400",
                        },
                        {
                          label: "Event & Prom Night",
                          count: bookings.filter(
                            (b) => b.conceptType === "Event",
                          ).length,
                          color: "bg-amber-400",
                        },
                        {
                          label: "Yêu cầu",
                          count: bookings.filter(
                            (b) => b.conceptType === "Custom",
                          ).length,
                          color: "bg-emerald-400",
                        },
                      ].map((stat, statIdx) => (
                        <div
                          key={`stat-${stat.label}-${statIdx}`}
                          className="flex items-center gap-2 text-[11px] font-sans font-bold"
                        >
                          <span className="w-14 text-white/70">
                            {stat.label}
                          </span>
                          <div className="flex-1 bg-white/10 h-2 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${bookings.length ? (stat.count / bookings.length) * 100 : 0}%`,
                              }}
                              className={`h-full ${stat.color}`}
                              transition={{
                                duration: 1,
                                ease: "easeOut",
                              }}
                            />
                          </div>
                          <span className="w-4 text-right text-white/90">
                            {stat.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {displayedBookings.length === 0 ? (
                  <div className="text-center py-6 text-gray-400 flex flex-col justify-center items-center gap-2">
                    <Calendar className="w-6 h-6 text-gray-300 animate-pulse" />
                    <p className="text-[11px] font-light max-w-xs text-gray-650">
                      Chưa có lịch trình đặt nào được ghi nhận.
                    </p>
                  </div>
                ) : (
                  <div
                    data-lenis-prevent="true"
                    tabIndex={0}
                    className="space-y-3.5 max-h-[460px] lg:max-h-[540px] overflow-y-auto overscroll-contain pr-1.5 custom-scrollbar focus:outline-none"
                  >
                    {displayedBookings.map((bk, bkIdx) => {
                      // Custom status aesthetics mapping
                      let statusClass =
                        "bg-amber-500 text-amber-50 border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse font-bold px-2 py-1 text-[12px]";
                      if (bk.status === "Đã duyệt") {
                        statusClass =
                          "bg-emerald-500 text-emerald-50 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)] font-bold px-2 py-1 text-[12px]";
                      } else if (bk.status === "Từ chối") {
                        statusClass =
                          "bg-rose-600 text-rose-50 border-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.6)] font-bold px-2 py-1 text-[12px]";
                      }

                      return (
                        <div
                          id={`booking-card-${bk.id || bkIdx}`}
                          key={`bk-${bk.id || 'booking'}-${bkIdx}`}
                          className="p-2.5 bg-zinc-900 border border-white/10 text-left rounded-sm flex flex-col gap-2.5"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-sans text-[11px] text-[#B5945B] bg-zinc-800 px-1.5 py-0.5 rounded border border-[#B5945B]/15 font-bold">
                                  {bk.id}
                                </span>
                                <span className="font-sans text-[12px] text-white font-bold tracking-wide truncate uppercase">
                                  {bk.schoolName}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#B5945B] mt-1 font-sans font-medium uppercase tracking-wide">
                                Gói:{" "}
                                {getConceptVietnameseName(bk.conceptType)}
                              </p>
                              <p className="text-[11px] text-gray-650 mt-0.5 font-sans font-bold">
                                {bk.conceptType !== "Event" &&
                                  `Số lượng: ${bk.classSize} người • `}
                                Ngày: {formatDateDMY(bk.date)} • Ca:{" "}
                                {(() => {
                                  if (!bk.timeSlot) return "Không rõ";
                                  const numId = parseInt(bk.timeSlot, 10);
                                  if (
                                    !isNaN(numId) &&
                                    numId >= 1 &&
                                    numId <= 6
                                  ) {
                                    return (
                                      TIME_SLOTS.find(
                                        (s) => s.id === numId,
                                      )?.name || bk.timeSlot
                                    );
                                  }
                                  return bk.timeSlot;
                                })()}
                              </p>
                              {bk.customRequest && (
                                <p className="text-[11px] text-amber-600 font-sans mt-0.5 truncate flex items-baseline gap-1 font-bold">
                                  <span className="text-amber-500">
                                    📝
                                  </span>
                                  {""}
                                  {bk.customRequest}
                                </p>
                              )}
                              {bk.address && (
                                <p className="text-[11px] text-gray-650 font-sans mt-0.5 truncate flex items-center gap-1 font-bold">
                                  <span className="text-[#B5945B]">
                                    📍
                                  </span>
                                  {""}
                                  {bk.address}
                                </p>
                              )}
                              {bk.instagramOrZalo && (
                                <p className="text-[11px] text-cyan-optic font-sans mt-0.5 truncate font-bold">
                                  Liên hệ:{""}
                                  {isLoggedAdmin ||
                                  myBookingIds.includes(bk.id)
                                    ? bk.instagramOrZalo
                                    : "*** (Bảo mật)"}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span
                                className={`font-sans uppercase tracking-wide rounded-xl border ${statusClass}`}
                              >
                                {bk.status}
                              </span>
                              {(isLoggedAdmin ||
                                myBookingIds.includes(bk.id)) && (
                                <button
                                  type="button"
                                  onClick={() => onCancelBooking(bk.id)}
                                  className="text-gray-450 hover:text-red-500 p-1 cursor-pointer transition-all duration-200"
                                  title="Hủy đặt lịch"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Administrative override buttons */}
                          {isAdminMode && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10 bg-zinc-900 p-2 rounded justify-between sm:justify-start">
                              <span className="font-sans text-[11px] text-gray-500 uppercase self-center mr-1 w-full sm:w-auto">
                                Xét duyệt:
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateBookingStatus(bk.id, "Đã duyệt")
                                }
                                className={`flex-1 py-1 px-1.5 text-[11px] uppercase tracking-wide font-bold rounded flex items-center justify-center gap-0.5 cursor-pointer transition-all ${
                                  bk.status === "Đã duyệt"
                                    ? "bg-emerald-600 text-white"
                                    : "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                                }`}
                              >
                                <Check className="w-2.5 h-2.5" />
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateBookingStatus(bk.id, "Từ chối")
                                }
                                className={`flex-1 py-1 px-1.5 text-[11px] uppercase tracking-wide font-bold rounded flex items-center justify-center gap-0.5 cursor-pointer transition-all ${
                                  bk.status === "Từ chối"
                                    ? "bg-rose-600 text-white"
                                    : "bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100"
                                }`}
                              >
                                <X className="w-2.5 h-2.5" />
                                Bác bỏ
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateBookingStatus(bk.id, "Chờ duyệt")
                                }
                                className={`py-1 px-1.5 text-[11px] uppercase tracking-wide rounded cursor-pointer transition-all font-bold ${
                                  bk.status === "Chờ duyệt"
                                    ? "bg-amber-100 text-amber-700 border border-amber-300"
                                    : "bg-zinc-800 text-zinc-400 hover:text-white border border-white/20"
                                }`}
                              >
                                Reset
                              </button>
                            </div>
                          )}

                          {/* Photo Editing Progress & Deliverables Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 bg-black/40 p-2 rounded text-[11px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Palette className="w-3.5 h-3.5 text-[#B5945B] shrink-0" />
                              <span className="text-zinc-400">Tiến độ ảnh:</span>
                              <span
                                className={`font-semibold font-sans px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                                  bk.editingStatus === "completed"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold"
                                    : bk.editingStatus === "reviewing"
                                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                      : bk.editingStatus === "editing"
                                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        : bk.editingStatus === "shooting_done"
                                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                          : "bg-zinc-800 text-zinc-400 border border-white/5"
                                }`}
                              >
                                {bk.editingStatus === "completed"
                                  ? "100% Hoàn thành"
                                  : bk.editingStatus === "reviewing"
                                    ? "Kiểm duyệt"
                                    : bk.editingStatus === "editing"
                                      ? `Retouch (${bk.editingProgress || 50}%)`
                                      : bk.editingStatus === "shooting_done"
                                        ? "Chọn ảnh"
                                        : "Chờ chụp"}
                              </span>

                              {bk.finalPhotosUrl && (
                                <a
                                  href={bk.finalPhotosUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 ml-1 underline font-medium"
                                  title="Mở link ảnh đã hoàn thiện"
                                >
                                  <span>Drive</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingBooking(bk);
                                setIsProgressModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-[#B5945B]/15 hover:bg-[#B5945B]/25 text-[#B5945B] border border-[#B5945B]/40 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <Sparkles className="w-3 h-3" />
                              Cập nhật ảnh
                            </button>
                          </div>

                          {/* Xác nhận & Mã QR (Giai đoạn 2) */}
                          <BookingConfirmationQrSection
                            booking={bk}
                            showToast={showToast}
                            onBookingUpdated={(updates) => {
                              if (updates.status && onUpdateBookingStatus) {
                                onUpdateBookingStatus(bk.id, updates.status as any);
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3.5 border-t border-gray-200 flex justify-between text-[#B5945B]/65 font-sans text-[11px] font-bold">
                <span>HỖ TRỢ KHU VỰC: HÀ NỘI / QUẢNG NINH</span>
              </div>
            </motion.div>
          );
        })()}

      {/* Admin Photo Progress Modal */}
      <AdminPhotoProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => {
          setIsProgressModalOpen(false);
          setEditingBooking(null);
        }}
        booking={editingBooking}
        onSaveProgress={handleSavePhotoProgress}
      />

      {/* Admin Create Booking (Messenger) Modal */}
      <AdminCreateBookingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        showToast={showToast}
      />

      {/* Admin Batch Import & Sync Old Customers Modal */}
      <AdminBatchImportModal
        isOpen={isBatchImportModalOpen}
        onClose={() => setIsBatchImportModalOpen(false)}
        showToast={showToast}
        googleToken={googleToken}
        googleSignIn={googleSignIn}
        existingBookings={bookings}
        onBookingsUpdated={() => {
          // bookings will update automatically via Firestore snapshot
        }}
      />

      {/* STATISTICS MODAL */}
      {isStatsModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-zinc-950 border border-white/15 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Thống Kê & Báo Cáo</h3>
                    <p className="text-xs text-zinc-400">Tổng quan chỉ số hiệu suất đặt lịch</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStatsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-4 gap-2.5 mb-5">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[11px] font-medium text-zinc-400 uppercase">Tổng</div>
                  <div className="text-lg font-bold text-white mt-0.5">{bookings.length}</div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-[11px] font-medium text-emerald-400 uppercase">Đã duyệt</div>
                  <div className="text-lg font-bold text-emerald-300 mt-0.5">
                    {bookings.filter((b) => b.status === "Đã duyệt").length}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-[11px] font-medium text-amber-400 uppercase">Chờ duyệt</div>
                  <div className="text-lg font-bold text-amber-300 mt-0.5">
                    {bookings.filter((b) => b.status === "Chờ duyệt").length}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <div className="text-[11px] font-medium text-rose-400 uppercase">Từ chối</div>
                  <div className="text-lg font-bold text-rose-300 mt-0.5">
                    {bookings.filter((b) => b.status === "Từ chối").length}
                  </div>
                </div>
              </div>

              {/* Concept breakdown */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
                  Phân bố Concept chụp
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: "Kỷ yếu THPT", count: bookings.filter((b) => b.conceptType === "THPT").length, color: "bg-blue-400" },
                    { label: "Kỷ yếu Đại học", count: bookings.filter((b) => b.conceptType === "University").length, color: "bg-purple-400" },
                    { label: "Event & Prom Night", count: bookings.filter((b) => b.conceptType === "Event").length, color: "bg-amber-400" },
                    { label: "Yêu cầu tùy chọn", count: bookings.filter((b) => b.conceptType === "Custom").length, color: "bg-emerald-400" },
                  ].map((item) => {
                    const pct = bookings.length > 0 ? Math.round((item.count / bookings.length) * 100) : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-300">{item.label}</span>
                          <span className="text-zinc-400 font-medium">{item.count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full ${item.color} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer action */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStatsModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* SYNC & 2-WAY SYNC MODAL */}
      {isSyncModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-zinc-950 border border-white/15 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <RefreshCw className={`w-5 h-5 ${isSyncingSheets ? "animate-spin" : ""}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Đồng Bộ Hệ Thống</h3>
                    <p className="text-xs text-zinc-400">Đồng bộ Google Calendar, 2 chiều & Google Sheet</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Cards */}
              <div className="space-y-3 mb-5">
                {/* 1. Kiểm tra 2 chiều Google */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSyncModalOpen(false);
                    handleTwoWaySync();
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 transition-all text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0 group-hover:scale-105 transition-transform">
                      <ArrowLeftRight className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-purple-200">
                        Kiểm tra & Đồng bộ 2 chiều
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Đối chiếu lịch hẹn từ Google Calendar/Tasks về hệ thống
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-purple-400 bg-purple-500/15 px-3 py-1.5 rounded-xl border border-purple-500/30 shrink-0">
                    Thực hiện
                  </span>
                </button>

                {/* 2. Đồng bộ Google Calendar */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSyncModalOpen(false);
                    handleBatchSyncCalendar();
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 transition-all text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 shrink-0 group-hover:scale-105 transition-transform">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-blue-200">
                        Đồng bộ lên Google Calendar
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Đẩy toàn bộ lịch hẹn vào ứng dụng Google Calendar
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-blue-400 bg-blue-500/15 px-3 py-1.5 rounded-xl border border-blue-500/30 shrink-0">
                    Đồng bộ
                  </span>
                </button>

                {/* 3. Đẩy lên Google Sheets */}
                <button
                  type="button"
                  disabled={isSyncingSheets}
                  onClick={() => {
                    setIsSyncModalOpen(false);
                    handleSyncAllToGoogleSheet();
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition-all text-left cursor-pointer group disabled:opacity-50 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0 group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className={`w-5 h-5 ${isSyncingSheets ? "animate-spin" : ""}`} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-emerald-200">
                        Đẩy lên Google Sheet
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Ghi danh sách và cập nhật bảng tính KH_Data báo cáo
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 px-3 py-1.5 rounded-xl border border-emerald-500/30 shrink-0">
                    {isSyncingSheets ? "Đang đẩy..." : "Xuất Sheet"}
                  </span>
                </button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* SETTINGS & UTILITIES MODAL */}
      {isSettingsModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-zinc-950 border border-white/15 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Cài Đặt & Tiện Ích</h3>
                    <p className="text-xs text-zinc-400">Tùy biến màn hình, nhập dữ liệu và bảo trì</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Cards */}
              <div className="space-y-3 mb-5">
                {/* 1. Sửa Intro mở đầu */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    handleOpenIntroEditor();
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-all text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0 group-hover:scale-105 transition-transform">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-amber-200">
                        Chỉnh sửa Intro mở đầu
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Tùy biến câu chào, chữ và hiệu ứng màn hình mở đầu
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-400 bg-amber-500/15 px-3 py-1.5 rounded-xl border border-amber-500/30 shrink-0">
                    Mở sửa
                  </span>
                </button>

                {/* 2. Nhập khách cũ & Quét Excel */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    setIsBatchImportModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 transition-all text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0 group-hover:scale-105 transition-transform">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-cyan-200">
                        Nhập khách cũ / Quét Excel
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Quét dữ liệu cũ từ Calendar hoặc dán từ file Excel
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/15 px-3 py-1.5 rounded-xl border border-cyan-500/30 shrink-0">
                    Nhập dữ liệu
                  </span>
                </button>

                {/* 3. Ca làm & Lịch học FAP */}
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    setAdminActiveTab("school_sync");
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 transition-all text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0 group-hover:scale-105 transition-transform">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-indigo-200">
                        Ca làm & Lịch học FAP
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Xem và đồng bộ lịch học/bận của studio
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/15 px-3 py-1.5 rounded-xl border border-indigo-500/30 shrink-0">
                    Xem lịch
                  </span>
                </button>

                {/* 4. Dọn dẹp lịch cũ */}
                <button
                  type="button"
                  disabled={isCleaningUp}
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    onCleanupOldBookings();
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-all text-left cursor-pointer group disabled:opacity-50 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 shrink-0 group-hover:scale-105 transition-transform">
                      <Trash2 className={`w-5 h-5 ${isCleaningUp ? "animate-pulse" : ""}`} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-rose-200">
                        Dọn dẹp lịch cũ quá hạn
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Giải phóng bộ nhớ và dọn dẹp các lịch đã qua
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-rose-400 bg-rose-500/15 px-3 py-1.5 rounded-xl border border-rose-500/30 shrink-0">
                    {isCleaningUp ? "Đang xóa..." : "Dọn dẹp"}
                  </span>
                </button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
    </div>
  );
};
