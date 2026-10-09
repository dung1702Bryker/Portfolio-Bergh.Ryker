import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  Trash2,
  Check,
  X,
  RefreshCw,
  Sliders,
  Palette,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Booking } from "../types";
import { AdminLiveChat } from "./AdminLiveChat";
import { SchoolScheduleSync } from "./admin/SchoolScheduleSync";
import { BookingSlotAvailabilityManager } from "./admin/BookingSlotAvailabilityManager";
import { EmailNotificationConfig } from "./admin/EmailNotificationConfig";
import { AdminPhotoProgressModal } from "./AdminPhotoProgressModal";

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
    "schedule" | "chat" | "school_sync" | "availability_config" | "email_config"
  >("schedule");
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);

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

  if (!isAdminMode) return null;

  return (
    <div className="lg:col-span-5 flex flex-col gap-5 h-full">
      {/* ADMIN CONSOLE TABS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 bg-zinc-900/60 rounded-xl p-1 border border-white/5 shadow-inner relative w-full mb-2 z-10 shrink-0 gap-1">
        <button
          onClick={() => setAdminActiveTab("schedule")}
          className={`min-h-[36px] rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide transition-all ${
            adminActiveTab === "schedule"
              ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/20 font-bold"
              : "text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
          }`}
        >
          LỊCH TRÌNH
        </button>
        <button
          onClick={() => setAdminActiveTab("chat")}
          className={`min-h-[36px] rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide transition-all ${
            adminActiveTab === "chat"
              ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/20 font-bold"
              : "text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
          }`}
        >
          TIN NHẮN
        </button>
        <button
          onClick={() => setAdminActiveTab("school_sync")}
          className={`min-h-[36px] rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide transition-all ${
            adminActiveTab === "school_sync"
              ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/20 font-bold"
              : "text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
          }`}
        >
          CA LÀM
        </button>
        <button
          onClick={() => setAdminActiveTab("availability_config")}
          className={`min-h-[36px] rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide transition-all ${
            adminActiveTab === "availability_config"
              ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/20 font-bold"
              : "text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
          }`}
        >
          SLOT
        </button>
        <button
          onClick={() => setAdminActiveTab("email_config")}
          className={`min-h-[36px] rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide transition-all ${
            adminActiveTab === "email_config"
              ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/20 font-bold"
              : "text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
          }`}
        >
          GMAIL
        </button>
      </div>

      {/* TAB CONTENT: EMAIL CONFIG */}
      {adminActiveTab === "email_config" && <EmailNotificationConfig />}

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
              className="bg-zinc-950 border border-white/5 p-5 rounded-2xl relative min-h-[160px] flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 pb-3 border-b border-white/5 gap-3">
                  <div className="flex flex-col">
                    <span className="font-sans text-[11px] text-[#B5945B] font-medium uppercase tracking-wide flex items-center gap-2">
                      Lịch trình{" "}
                      <span className="bg-white/10 px-1.5 py-0.5 rounded text-[11px]">
                        {displayedBookings.length}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdminMode && (
                      <button
                        type="button"
                        onClick={onOpenCalendar}
                        className="text-[12px] uppercase tracking-wide px-2 py-1 rounded bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Calendar className="w-3 h-3" />
                        Lịch
                      </button>
                    )}
                    {isAdminMode && (
                      <button
                        type="button"
                        onClick={() => setAdminActiveTab("availability_config")}
                        className="text-[12px] uppercase tracking-wide px-2 py-1 rounded bg-zinc-900 border border-[#B5945B]/30 text-[#B5945B] hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Cấu hình trạng thái khả dụng cho từng slot"
                      >
                        <Sliders className="w-3 h-3" />
                        Cấu hình Slot
                      </button>
                    )}
                    {/* Sync Button */}
                    {isAdminMode && (
                      <button
                        type="button"
                        onClick={async () => {
                          let activeToken =
                            googleToken ?? (await getAccessToken());
                          if (!activeToken) {
                            triggerConfirm(
                              "Yêu cầu cấp quyền Google Calendar",
                              "Hệ thống Bergh.Ryker cần liên kết Google Calendar của bạn để tự động đẩy và đồng bộ lịch trình. Vui lòng chọn Xác nhận để liên kết với tài khoản Google admin của bạn.",
                              async () => {
                                try {
                                  const signinRes = await googleSignIn();
                                  if (
                                    signinRes &&
                                    signinRes.accessToken
                                  ) {
                                    setGoogleToken(signinRes.accessToken);
                                    await onProceedWithBatchSync(
                                      signinRes.accessToken,
                                    );
                                  } else {
                                    showToast(
                                      "Xác thực Google thất bại.",
                                      "error",
                                    );
                                  }
                                } catch (err: any) {
                                  showToast(
                                    "Đăng nhập Google thất bại:" +
                                      err.message,
                                    "error",
                                  );
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
                        }}
                        className="text-[12px] uppercase tracking-wide px-2 py-1 rounded bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Đồng bộ Google Calendar"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Đồng bộ
                      </button>
                    )}
                    {isAdminMode && (
                      <button
                        type="button"
                        onClick={async () => {
                          let activeToken = googleToken;
                          if (!activeToken) {
                            triggerConfirm(
                              "Yêu cầu cấp quyền Google",
                              "Hệ thống cần liên kết Google Calendar/Tasks của bạn để kiểm tra và tiến hành đồng bộ 2 chiều.",
                              async () => {
                                try {
                                  const signinRes = await googleSignIn();
                                  if (
                                    signinRes &&
                                    signinRes.accessToken
                                  ) {
                                    setGoogleToken(signinRes.accessToken);
                                    await onPerformTwoWaySync(
                                      signinRes.accessToken,
                                    );
                                  } else {
                                    showToast(
                                      "Xác thực Google thất bại.",
                                      "error",
                                    );
                                  }
                                } catch (err: any) {
                                  showToast(
                                    "Đăng nhập Google thất bại: " +
                                      err.message,
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
                        }}
                        className="text-[12px] uppercase tracking-wide px-2 py-1 rounded bg-[#B5945B]/10 border border-[#B5945B]/30 text-[#B5945B] hover:bg-[#B5945B]/20 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        title="Kiểm tra 2 chiều từ Google"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Kiểm tra 2 chiều
                      </button>
                    )}
                    {/* Dọn Lịch Cũ Button */}
                    {isAdminMode && (
                      <button
                        type="button"
                        disabled={isCleaningUp}
                        onClick={onCleanupOldBookings}
                        className="text-[12px] uppercase tracking-wide px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        {isCleaningUp ? "..." : "Dọn dẹp"}
                      </button>
                    )}
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
                  <div className="space-y-3.5 max-h-[180px] overflow-y-auto pr-1">
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
    </div>
  );
};
