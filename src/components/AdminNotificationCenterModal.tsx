import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  BellRing,
  Flame,
  FileText,
  X,
  Volume2,
  VolumeX,
  Globe,
  CheckCheck,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Play,
  Smartphone,
  Radio,
  CheckCircle2,
  AlertCircle,
  Timer,
} from "lucide-react";
import { useAdminNotification } from "../context/AdminNotificationContext";
import { useLivePresenceContext } from "../context/LivePresenceContext";
import { AdminPushNotification } from "../types/notification";
import { PWAInstallModal } from "./PWAInstallModal";
import { stripIspFromName } from "../services/geoService";

export const AdminNotificationCenterModal: React.FC = () => {
  const {
    notifications,
    unreadCount,
    settings,
    isNotificationCenterOpen,
    setIsNotificationCenterOpen,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    updateSettings,
    enableBrowserPush,
    backgroundPushStatus,
    enableBackgroundPush,
    disableBackgroundPush,
    triggerLockscreenTest,
    triggerTestNotification,
    scrollToBookingSection,
    isAdmin,
  } = useAdminNotification();

  const { setIsWidgetOpen } = useLivePresenceContext();

  const [activeTab, setActiveTab] = useState<"all" | "bookings" | "strangers" | "spikes">("all");
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const [isPWAInstallOpen, setIsPWAInstallOpen] = useState(false);
  const [pushActionMsg, setPushActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Lockscreen test countdown state
  const [testCountdown, setTestCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (testCountdown === null) return;
    if (testCountdown <= 0) {
      setTestCountdown(null);
      return;
    }
    const timer = setTimeout(() => {
      setTestCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [testCountdown]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === "bookings") {
      return notifications.filter((n) => n.type === "new_booking");
    }
    if (activeTab === "strangers") {
      return notifications.filter((n) => n.type === "stranger_visitor");
    }
    if (activeTab === "spikes") {
      return notifications.filter((n) => n.type === "traffic_spike");
    }
    return notifications;
  }, [notifications, activeTab]);

  const bookingCount = useMemo(
    () => notifications.filter((n) => n.type === "new_booking").length,
    [notifications]
  );
  const strangerCount = useMemo(
    () => notifications.filter((n) => n.type === "stranger_visitor").length,
    [notifications]
  );
  const spikeCount = useMemo(
    () => notifications.filter((n) => n.type === "traffic_spike").length,
    [notifications]
  );

  const handleToggleBackgroundPush = async () => {
    setIsRequestingPush(true);
    setPushActionMsg(null);

    if (backgroundPushStatus.isSubscribed) {
      await disableBackgroundPush();
      setPushActionMsg({ type: "success", text: "Đã hủy đăng ký nhận thông báo đẩy ngầm." });
    } else {
      const res = await enableBackgroundPush();
      if (res.success) {
        setPushActionMsg({
          type: "success",
          text: "✅ Đã kích hoạt thành công! Thiết bị sẽ nhận chuông & rung thông báo kể cả khi bạn thoát app hoặc tắt màn hình.",
        });
      } else {
        setPushActionMsg({
          type: "error",
          text: res.error || "Không thể kích hoạt thông báo đẩy. Vui lòng kiểm tra quyền trình duyệt.",
        });
      }
    }
    setIsRequestingPush(false);
  };

  const handleTriggerLockscreenTest = async () => {
    setTestCountdown(4);
    setPushActionMsg({
      type: "success",
      text: "⏳ Đang đếm ngược 4 giây... Hãy bấm nút nguồn khóa màn hình hoặc thoát app ngay để kiểm tra!",
    });
    await triggerLockscreenTest(4);
  };

  const handleNotificationClick = (notif: AdminPushNotification) => {
    markAsRead(notif.id);
    setIsNotificationCenterOpen(false);

    if (notif.type === "new_booking") {
      scrollToBookingSection();
    } else {
      setIsWidgetOpen(true);
    }
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      const now = Date.now();
      const time = new Date(isoString).getTime();
      const diffSec = Math.floor((now - time) / 1000);

      if (diffSec < 45) return "Vừa xong";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
      return `${Math.floor(diffSec / 86400)} ngày trước`;
    } catch {
      return "Gần đây";
    }
  };

  if (!isAdmin || !isNotificationCenterOpen) return null;

  return (
    <AnimatePresence>
      <div key="admin-notif-center-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="bg-zinc-950 border border-[#B5945B]/30 rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden text-left relative"
        >
          {/* Ambient Lighting */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#B5945B]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between relative z-10 shrink-0 bg-zinc-900/70 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B5945B]/20 border border-[#B5945B]/40 text-[#B5945B] flex items-center justify-center shrink-0 shadow-inner">
                <BellRing className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base sm:text-lg tracking-tight">
                    Trung Tâm Cảnh Báo & Web Push
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold">
                      {unreadCount} mới
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  Thông báo đẩy nền khi tắt màn hình điện thoại & cảnh báo khách lạ trực tuyến
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsNotificationCenterOpen(false)}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Background Push Activation Banner (Crucial for closed app & locked phone) */}
          <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border-b border-white/10 shrink-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  backgroundPushStatus.isSubscribed
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs">
                      Thông Báo Đẩy Điện Thoại (Thoát App / Khóa Máy):
                    </span>
                    {backgroundPushStatus.isSubscribed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" /> ĐÃ KÍCH HOẠT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                        <AlertCircle className="w-3 h-3" /> CHƯA BẬT
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {backgroundPushStatus.isSubscribed
                      ? "Thiết bị này đã được lưu vào danh sách nhận Web Push máy chủ."
                      : "Cần cấp quyền để máy chủ gửi chuông & rung khi có khách hoặc đơn mới."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleToggleBackgroundPush}
                  disabled={isRequestingPush}
                  className={`w-full sm:w-auto px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 ${
                    backgroundPushStatus.isSubscribed
                      ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10"
                      : "bg-[#B5945B] hover:bg-[#c9a76d] text-zinc-950 font-extrabold"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    {isRequestingPush
                      ? "Đang xử lý..."
                      : backgroundPushStatus.isSubscribed
                      ? "Tắt thông báo đẩy"
                      : "Bật Thông Báo Nền Ngay"}
                  </span>
                </button>

                {backgroundPushStatus.isSubscribed && (
                  <button
                    type="button"
                    onClick={handleTriggerLockscreenTest}
                    disabled={testCountdown !== null}
                    className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 font-bold text-xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    title="Bắn thử nghiệm thông báo ra màn hình khóa"
                  >
                    {testCountdown !== null ? (
                      <>
                        <Timer className="w-3.5 h-3.5 animate-spin text-sky-400" />
                        <span>Đếm ngược {testCountdown}s</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-sky-400" />
                        <span>Test màn hình khóa</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {pushActionMsg && (
              <div className={`mt-2 p-2 rounded-xl text-xs flex items-center gap-1.5 ${
                pushActionMsg.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border border-red-500/20 text-red-300"
              }`}>
                {pushActionMsg.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                <span>{pushActionMsg.text}</span>
              </div>
            )}

            {backgroundPushStatus.isIOSWithoutPWA && !backgroundPushStatus.isSubscribed && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Dành cho iPhone/iPad:</strong> Bấm nút <strong>Chia sẻ (Share)</strong> trên Safari &gt; <strong>"Thêm vào MH chính"</strong> để nhận thông báo đẩy ra màn hình khóa khi tắt app.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPWAInstallOpen(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg shrink-0 text-[11px] cursor-pointer"
                >
                  Xem hướng dẫn
                </button>
              </div>
            )}
          </div>

          {/* Quick Settings & Push Permissions Bar */}
          <div className="px-4 sm:px-5 py-3 border-b border-white/10 bg-zinc-900/40 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                settings.soundEnabled
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                  : "bg-zinc-800/80 border-white/10 text-zinc-400"
              }`}
              title="Bật/Tắt âm thanh chuông báo khi có thông báo mới"
            >
              {settings.soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Chuông: Bật</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Chuông: Tắt</span>
                </>
              )}
            </button>

            {/* Stranger Alert Toggle (Khách lạ không phải Admin) */}
            <button
              type="button"
              onClick={() => updateSettings({ strangerAlertEnabled: !settings.strangerAlertEnabled })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                settings.strangerAlertEnabled
                  ? "bg-red-500/15 border-red-500/30 text-red-300 font-bold"
                  : "bg-zinc-800/80 border-white/10 text-zinc-400"
              }`}
              title="Tự động báo động khi phát hiện thiết bị lạ không phải của Admin ghé thăm website"
            >
              <Radio className={`w-3.5 h-3.5 ${settings.strangerAlertEnabled ? "text-red-400 animate-pulse" : "text-zinc-500"}`} />
              <span>Báo khách lạ: {settings.strangerAlertEnabled ? "Bật" : "Tắt"}</span>
            </button>

            {/* Spike Threshold Config (Lượt khách thật cùng lúc, loại trừ Admin) */}
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Báo khách khi ≥</span>
              <select
                value={settings.spikeThreshold}
                onChange={(e) =>
                  updateSettings({ spikeThreshold: Number(e.target.value) })
                }
                className="bg-zinc-900 border border-white/15 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-400 cursor-pointer font-bold"
                title="Hệ thống tự động loại trừ Quản trị viên (Admin) xem web, chỉ tính khách thật"
              >
                <option value={1}>≥ 1 khách xem (Báo ngay từ 1 khách)</option>
                <option value={2}>≥ 2 khách xem cùng lúc</option>
                <option value={3}>≥ 3 khách xem</option>
                <option value={5}>≥ 5 khách xem</option>
                <option value={10}>≥ 10 khách xem</option>
              </select>
            </div>

            {/* PWA Mobile Setup Button */}
            <button
              type="button"
              onClick={() => setIsPWAInstallOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#B5945B]/40 bg-[#B5945B]/15 hover:bg-[#B5945B]/25 text-[#B5945B] font-bold transition-all cursor-pointer shadow-sm ml-auto"
              title="Hướng dẫn cài đặt App lên điện thoại nhận thông báo kể cả khi tắt màn hình"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Cài App PWA</span>
            </button>
          </div>

          {/* Test Buttons Toolbar */}
          <div className="px-4 sm:px-5 py-2.5 bg-black/30 border-b border-white/5 flex items-center justify-between gap-2 flex-wrap shrink-0">
            <span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">
              Thử nghiệm chuông trực tiếp:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerTestNotification("stranger_visitor")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Radio className="w-3 h-3 text-red-400" />
                <span>Thử khách lạ</span>
              </button>
              <button
                type="button"
                onClick={() => triggerTestNotification("new_booking")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#B5945B]/15 hover:bg-[#B5945B]/25 border border-[#B5945B]/30 text-[#B5945B] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>Thử đơn mới</span>
              </button>
              <button
                type="button"
                onClick={() => triggerTestNotification("traffic_spike")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>Thử xem đông</span>
              </button>
            </div>
          </div>

          {/* Tab Filter and Bulk Actions */}
          <div className="px-4 sm:px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5 text-xs overflow-x-auto">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "all"
                    ? "bg-[#B5945B] text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Tất cả ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab("strangers")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "strangers"
                    ? "bg-red-500 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Khách lạ ({strangerCount})
              </button>
              <button
                onClick={() => setActiveTab("bookings")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "bookings"
                    ? "bg-[#B5945B] text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Đơn mới ({bookingCount})
              </button>
              <button
                onClick={() => setActiveTab("spikes")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === "spikes"
                    ? "bg-[#B5945B] text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Lượt xem ({spikeCount})
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-zinc-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đọc hết</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer ml-1"
                  title="Xoá toàn bộ lịch sử"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xoá</span>
                </button>
              )}
            </div>
          </div>

          {/* Notifications Scrollable List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto text-zinc-600">
                  <Bell className="w-7 h-7" />
                </div>
                <p className="text-zinc-400 font-medium text-sm">
                  Chưa có thông báo nào trong mục này.
                </p>
                <p className="text-zinc-600 text-xs max-w-xs mx-auto">
                  Khi có khách lạ ghé thăm, người xem trực tuyến hoặc có đơn đăng ký mới, hệ thống sẽ đẩy thông báo ngay lập tức.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isBooking = notif.type === "new_booking";
                const isStranger = notif.type === "stranger_visitor";
                return (
                  <div
                    key={`notif-${notif.id}`}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                      !notif.read
                        ? isStranger
                          ? "bg-zinc-900/90 border-red-500/40 shadow-lg shadow-red-950/20 ring-1 ring-red-500/20"
                          : "bg-zinc-900/90 border-[#B5945B]/40 shadow-lg shadow-black/40 ring-1 ring-[#B5945B]/15"
                        : "bg-zinc-950/60 border-white/5 hover:border-white/15 opacity-75 hover:opacity-100"
                    }`}
                  >
                    {!notif.read && (
                      <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ring-2 ring-zinc-900 animate-pulse ${
                        isStranger ? "bg-red-500" : "bg-amber-400"
                      }`} />
                    )}

                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-md ${
                          isStranger
                            ? "bg-red-500/20 text-red-400 border border-red-500/35"
                            : isBooking
                            ? "bg-[#B5945B]/20 text-[#B5945B] border border-[#B5945B]/35"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/35"
                        }`}
                      >
                        {isStranger ? (
                          <Radio className="w-4 h-4 animate-pulse" />
                        ) : isBooking ? (
                          <FileText className="w-4 h-4" />
                        ) : (
                          <Flame className="w-4 h-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-bold text-white text-sm tracking-tight truncate">
                            {notif.title}
                          </h4>
                          <span className="text-[11px] text-zinc-500 shrink-0">
                            {formatTimeAgo(notif.timestamp)}
                          </span>
                        </div>

                        <p className="text-zinc-300 text-xs leading-relaxed mb-2">
                          {notif.message}
                        </p>

                        {/* Extra metadata pills */}
                        {isStranger && notif.metadata && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            {notif.metadata.location && (
                              <span className="bg-emerald-500/10 text-emerald-300 font-medium px-2 py-0.5 rounded-md border border-emerald-500/25">
                                🌏 {stripIspFromName(notif.metadata.location)}
                              </span>
                            )}
                            {notif.metadata.device && (
                              <span className="bg-zinc-800/90 text-zinc-300 px-2 py-0.5 rounded-md border border-white/10">
                                📱 {notif.metadata.device}
                              </span>
                            )}
                            {notif.metadata.popularPage && (
                              <span className="bg-red-500/10 text-red-300 px-2 py-0.5 rounded-md border border-red-500/20">
                                📍 {notif.metadata.popularPage}
                              </span>
                            )}
                          </div>
                        )}

                        {isBooking && notif.metadata && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                            {notif.metadata.schoolName && (
                              <span className="bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/5">
                                🏫 {notif.metadata.schoolName}
                              </span>
                            )}
                            {notif.metadata.date && (
                              <span className="bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/5">
                                📅 {notif.metadata.date}
                              </span>
                            )}
                            {notif.metadata.phone && (
                              <span className="bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/5 text-[#B5945B]">
                                📞 {notif.metadata.phone}
                              </span>
                            )}
                          </div>
                        )}

                        {!isBooking && !isStranger && notif.metadata?.visitorCount && (
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-semibold">
                              🟢 {notif.metadata.visitorCount} khách trực tuyến
                            </span>
                            {notif.metadata.popularPage && (
                              <span className="text-zinc-400">
                                Đang xem: {notif.metadata.popularPage}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-1 mt-2 text-[11px] font-bold text-[#B5945B] group-hover:text-amber-300 transition-colors">
                          <span>{isBooking ? "Xem chi tiết đơn" : "Xem ai đang xem"}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400 shrink-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#B5945B]" />
              <span>Chế độ cảnh báo bảo mật dành riêng cho Quản Trị Viên</span>
            </div>

            <button
              type="button"
              onClick={() => setIsNotificationCenterOpen(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </motion.div>
      </div>

      <PWAInstallModal
        isOpen={isPWAInstallOpen}
        onClose={() => setIsPWAInstallOpen(false)}
      />
    </AnimatePresence>
  );
};
