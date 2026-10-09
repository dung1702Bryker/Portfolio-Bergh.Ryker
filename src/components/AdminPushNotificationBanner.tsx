import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Flame,
  FileText,
  X,
  ChevronRight,
  User,
  Eye,
  Radio,
  Smartphone,
} from "lucide-react";
import { useAdminNotification } from "../context/AdminNotificationContext";
import { useLivePresenceContext } from "../context/LivePresenceContext";

export const AdminPushNotificationBanner: React.FC = () => {
  const {
    activeBannerNotification,
    dismissBanner,
    markAsRead,
    scrollToBookingSection,
    setIsNotificationCenterOpen,
    isAdmin,
  } = useAdminNotification();

  const { setIsWidgetOpen } = useLivePresenceContext();

  if (!isAdmin || !activeBannerNotification) return null;

  const isBooking = activeBannerNotification.type === "new_booking";
  const isStranger = activeBannerNotification.type === "stranger_visitor";
  const meta = activeBannerNotification.metadata;

  const handleAction = () => {
    markAsRead(activeBannerNotification.id);
    dismissBanner();

    if (isBooking) {
      scrollToBookingSection();
    } else {
      setIsWidgetOpen(true);
    }
  };

  return (
    <AnimatePresence>
      <div key="admin-push-notif-banner" className="fixed top-5 right-4 sm:right-6 z-50 max-w-md w-[calc(100vw-32px)] sm:w-full pointer-events-none select-none">
        <motion.div
          initial={{ opacity: 0, y: -25, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`pointer-events-auto rounded-2xl p-4 sm:p-5 shadow-2xl border backdrop-blur-xl transition-all relative overflow-hidden ${
            isStranger
              ? "bg-zinc-950/95 border-red-500/40 shadow-red-950/20 ring-1 ring-red-500/30"
              : isBooking
              ? "bg-zinc-950/95 border-[#B5945B]/40 shadow-[#B5945B]/10 ring-1 ring-[#B5945B]/20"
              : "bg-zinc-950/95 border-amber-500/40 shadow-amber-500/10 ring-1 ring-amber-500/20"
          }`}
        >
          {/* Subtle Ambient Glow */}
          <div
            className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none ${
              isStranger
                ? "bg-red-500/15"
                : isBooking
                ? "bg-[#B5945B]/15"
                : "bg-orange-500/20"
            }`}
          />

          <div className="relative z-10">
            {/* Top Bar: Icon, Category & Close */}
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                    isStranger
                      ? "bg-red-500/20 text-red-400 border border-red-500/40"
                      : isBooking
                      ? "bg-[#B5945B]/20 text-[#B5945B] border border-[#B5945B]/40"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  }`}
                >
                  {isStranger ? (
                    <Radio className="w-4 h-4 animate-pulse text-red-400" />
                  ) : isBooking ? (
                    <FileText className="w-4 h-4" />
                  ) : (
                    <Flame className="w-4 h-4 animate-pulse" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      isStranger
                        ? "bg-red-500/20 text-red-300 border-red-500/30"
                        : isBooking
                        ? "bg-[#B5945B]/20 text-[#B5945B] border-[#B5945B]/30"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {isStranger ? "Khách lạ ghé thăm" : isBooking ? "Đơn mới" : "Cảnh báo lượt xem"}
                  </span>
                  <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    Vừa xong
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    markAsRead(activeBannerNotification.id);
                    setIsNotificationCenterOpen(true);
                    dismissBanner();
                  }}
                  className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors cursor-pointer"
                  title="Mở trung tâm thông báo"
                >
                  <Bell className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Title & Message */}
            <h4 className="text-white font-bold text-sm tracking-tight mb-1">
              {activeBannerNotification.title}
            </h4>
            <p className="text-zinc-300 text-xs leading-relaxed mb-3">
              {activeBannerNotification.message}
            </p>

            {/* Meta Tags */}
            {isStranger && meta && (
              <div className="bg-zinc-900/80 rounded-xl p-2.5 mb-3 border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-300">
                  <Smartphone className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{meta.device || "Điện thoại"}</span>
                </div>
                {meta.popularPage && (
                  <span className="text-zinc-400 truncate max-w-[180px]">
                    📍 {meta.popularPage}
                  </span>
                )}
              </div>
            )}

            {isBooking && meta && (
              <div className="bg-zinc-900/80 rounded-xl p-2.5 mb-3 border border-white/5 space-y-1 text-xs">
                {meta.schoolName && (
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    <User className="w-3 h-3 text-[#B5945B] shrink-0" />
                    <span className="font-semibold text-white">{meta.customerName || meta.schoolName}</span>
                    {meta.schoolName && meta.customerName && (
                      <span className="text-zinc-400">({meta.schoolName})</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isBooking && !isStranger && meta?.visitorCount && (
              <div className="bg-zinc-900/80 rounded-xl p-2.5 mb-3 border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Đang xem cùng lúc:</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  {meta.visitorCount} khách
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleAction}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                  isStranger
                    ? "bg-red-500 hover:bg-red-400 text-white"
                    : isBooking
                    ? "bg-[#B5945B] hover:bg-[#c4a46a] text-zinc-950 ring-1 ring-[#B5945B]/50"
                    : "bg-amber-500 hover:bg-amber-400 text-zinc-950 ring-1 ring-amber-400/50"
                }`}
              >
                <span>{isBooking ? "Xem Đơn Ngay" : isStranger ? "Xem Khách Đang Làm Gì" : "Kiểm Tra Ngay"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={dismissBanner}
                className="py-2 px-3 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>

          {/* Auto-dismiss animated bottom line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 8.5, ease: "linear" }}
              className={`h-full ${isStranger ? "bg-red-500" : isBooking ? "bg-[#B5945B]" : "bg-amber-500"}`}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
