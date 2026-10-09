import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Radio,
  Eye,
  Smartphone,
  Laptop,
  Globe,
  Sparkles,
  ShieldCheck,
  Compass,
  Clock,
  X,
  Edit2,
  Check,
  ChevronRight,
  BarChart3,
  Activity,
  Layers,
  Bell,
  RotateCcw,
  Star,
  MapPin,
  Navigation,
} from "lucide-react";
import { useLivePresenceContext } from "../context/LivePresenceContext";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useAdminNotification } from "../context/AdminNotificationContext";
import { stripIspFromName } from "../services/geoService";
import { sanitizeDeviceLabel } from "../services/visitorHistoryService";

interface LiveVisitorsFloatingWidgetProps {
  onOpenAnalytics?: () => void;
}

export const LiveVisitorsFloatingWidget: React.FC<LiveVisitorsFloatingWidgetProps> = ({
  onOpenAnalytics,
}) => {
  const {
    activeVisitors,
    activeCount,
    currentVisitorId,
    currentVisitor,
    visitorLocation,
    calibrateGpsLocation,
    setCustomLocation,
    updateNickname,
    isWidgetOpen,
    setIsWidgetOpen,
  } = useLivePresenceContext();

  const { isAdmin } = useAdminAuth();
  const { unreadCount, setIsNotificationCenterOpen } = useAdminNotification();

  const [isEditingNick, setIsEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "visitors" | "admins">("all");
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 640;
    }
    return false;
  });

  const mobileCount = useMemo(() => {
    return activeVisitors.filter(
      (v) =>
        v.device.includes("Phone") ||
        v.device.includes("Android") ||
        v.device.includes("iOS")
    ).length;
  }, [activeVisitors]);

  const desktopCount = useMemo(() => {
    return activeVisitors.filter(
      (v) =>
        !v.device.includes("Phone") &&
        !v.device.includes("Android") &&
        !v.device.includes("iOS")
    ).length;
  }, [activeVisitors]);

  // Find most viewed page currently
  const popularPage = useMemo(() => {
    if (activeVisitors.length === 0) return "Portfolio Kỷ Yếu";
    const counts: Record<string, number> = {};
    activeVisitors.forEach((v) => {
      const key = v.currentPage || "Portfolio";
      counts[key] = (counts[key] || 0) + 1;
    });
    let top = "Portfolio Kỷ Yếu";
    let max = 0;
    Object.entries(counts).forEach(([page, c]) => {
      if (c > max) {
        max = c;
        top = page;
      }
    });
    return top;
  }, [activeVisitors]);

  const filteredVisitors = useMemo(() => {
    if (filterRole === "visitors") {
      return activeVisitors.filter((v) => v.role !== "admin");
    }
    if (filterRole === "admins") {
      return activeVisitors.filter((v) => v.role === "admin");
    }
    return activeVisitors;
  }, [activeVisitors, filterRole]);

  const handleStartEditNick = () => {
    setNickInput(
      currentVisitor?.visitorName?.replace(" 👑", "").replace(" (Thiết bị này)", "") || ""
    );
    setIsEditingNick(true);
  };

  const handleSaveNick = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (nickInput.trim()) {
      updateNickname(nickInput.trim());
    }
    setIsEditingNick(false);
  };

  const formatJoinedTime = (isoString?: string) => {
    if (!isoString) return "Vừa truy cập";
    try {
      const date = new Date(isoString);
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    } catch {
      return "Vừa truy cập";
    }
  };

  const getDeviceIcon = (deviceStr: string) => {
    if (
      deviceStr.includes("Phone") ||
      deviceStr.includes("Android") ||
      deviceStr.includes("iOS")
    ) {
      return <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    return <Laptop className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  };

  return (
    <>
      {/* Floating Micro-Capsule on the Bottom-Left */}
      <div className="fixed bottom-3 sm:bottom-4 left-3 sm:left-4 z-40 select-none">
        {isMinimized ? (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            whileHover={{ scale: 1.1, opacity: 1 }}
            onClick={() => setIsMinimized(false)}
            className="w-7 h-7 rounded-full bg-zinc-950/70 backdrop-blur-md border border-white/10 flex items-center justify-center cursor-pointer shadow-md hover:border-emerald-500/40 transition-all group"
            title={`${activeCount} người đang trực tuyến (Bấm để mở lại)`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          </motion.button>
        ) : (
          <div className="group relative flex items-center">
            {isAdmin ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsWidgetOpen(!isWidgetOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full transition-all duration-300 backdrop-blur-md cursor-pointer border text-xs shadow-sm ${
                  isWidgetOpen
                    ? "bg-zinc-900 border-[#B5945B] text-white ring-1 ring-[#B5945B]/30 opacity-100"
                    : "bg-zinc-950/50 hover:bg-zinc-950/85 border-white/10 hover:border-emerald-500/40 text-zinc-300 hover:text-white opacity-70 hover:opacity-100"
                }`}
                title="Bấm để xem danh sách chi tiết (Quản trị viên)"
              >
                {/* Soft calm green indicator */}
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />

                <span className="font-semibold text-white text-[11px] sm:text-xs">
                  {activeCount}
                </span>
                <span className="text-zinc-400 text-[10px] sm:text-[11px] font-normal">
                  đang xem
                </span>
              </motion.button>
            ) : (
              /* Khách hàng: Micro-badge trong suốt dịu nhẹ, không che ảnh, không gây chú ý */
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-300 backdrop-blur-md border border-white/10 bg-zinc-950/50 text-zinc-300 opacity-60 hover:opacity-100 shadow-sm select-none"
                title={`${activeCount} người đang xem website`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
                <span className="font-semibold text-white text-[11px]">
                  {activeCount}
                </span>
                <span className="text-zinc-400 text-[10px] font-normal">
                  đang xem
                </span>
              </div>
            )}

            {/* Nút thu nhỏ cực gọn khi rê chuột vào */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-all cursor-pointer"
              title="Thu nhỏ để không che ảnh"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Flyout / Modal: Who is currently watching live (Chỉ hiển thị cho Admin) */}
      <AnimatePresence>
        {isWidgetOpen && isAdmin && (
          <div key="live-visitors-modal-backdrop" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="bg-zinc-950 border border-white/15 sm:border-emerald-500/30 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[88vh] sm:max-h-[82vh] flex flex-col overflow-hidden text-left relative"
            >
              {/* Visual glow background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between relative z-10 shrink-0 bg-zinc-900/60 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-sm sm:text-base tracking-tight">
                        Ai Đang Xem Web Trực Tiếp
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Theo dõi chính xác khách xem và vị trí trang theo thời gian thực
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setIsWidgetOpen(false);
                      setIsNotificationCenterOpen(true);
                    }}
                    className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center transition-colors cursor-pointer shrink-0 relative"
                    title="Mở trung tâm thông báo & cảnh báo"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-zinc-950 animate-pulse" />
                    )}
                  </button>

                  <button
                    onClick={() => setIsWidgetOpen(false)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
                {/* Your Identity Box */}
                <div className="bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                        Bạn
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                          Tên hiển thị của bạn
                        </div>
                        {isEditingNick ? (
                          <form
                            onSubmit={handleSaveNick}
                            className="flex items-center gap-2 mt-1"
                          >
                            <input
                              type="text"
                              maxLength={40}
                              autoFocus
                              value={nickInput}
                              onChange={(e) => setNickInput(e.target.value)}
                              placeholder="Nhập tên của bạn hoặc lớp..."
                              className="px-2.5 py-1 bg-black/80 border border-emerald-500/50 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400 font-sans"
                            />
                            <button
                              type="submit"
                              className="p-1.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg cursor-pointer transition-colors"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingNick(false)}
                              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs sm:text-sm truncate">
                              {currentVisitor?.visitorName || "Đang kết nối..."}
                            </span>
                            <button
                              onClick={handleStartEditNick}
                              className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                              title="Đổi tên hiển thị của bạn"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Đang kết nối
                      </span>
                    </div>
                  </div>
                </div>

                {/* Device Location & High-Precision Calibration Bar */}
                <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-amber-500/10 border border-[#B5945B]/30 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-[#B5945B] shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-zinc-400 block leading-tight">Vị trí của bạn:</span>
                      <span className="text-white font-bold text-xs truncate block">
                        {stripIspFromName(visitorLocation || "Phan Tây Nhạc, Nam Từ Liêm, Hà Nội")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCustomLocation && setCustomLocation("Phan Tây Nhạc, Nam Từ Liêm, Hà Nội")}
                      className="px-2 py-1 rounded-lg bg-[#B5945B]/20 text-[#E5C17C] hover:bg-[#B5945B] hover:text-zinc-950 font-bold text-[10px] border border-[#B5945B]/40 transition-all cursor-pointer shadow-sm"
                      title="Gán vị trí chuẩn: Phan Tây Nhạc, Nam Từ Liêm, Hà Nội"
                    >
                      🎯 Phan Tây Nhạc
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (calibrateGpsLocation) {
                          await calibrateGpsLocation(true);
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-zinc-950 font-bold text-[10px] border border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                      title="Bật GPS thiết bị để định vị chính xác vị trí thực tế"
                    >
                      <Navigation className="w-2.5 h-2.5" /> GPS
                    </button>
                  </div>
                </div>

                {/* Quick Real-Time Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-zinc-900/70 border border-white/5 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                      Trực Tuyến
                    </span>
                    <span className="text-xl font-black text-white mt-0.5 block">
                      {activeCount}
                    </span>
                    <span className="text-[10px] text-zinc-400">người xem</span>
                  </div>

                  <div className="bg-zinc-900/70 border border-white/5 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                      Điện Thoại
                    </span>
                    <span className="text-xl font-black text-white mt-0.5 block">
                      {mobileCount}
                    </span>
                    <span className="text-[10px] text-zinc-400">thiết bị di động</span>
                  </div>

                  <div className="bg-zinc-900/70 border border-white/5 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase font-bold text-sky-400 block tracking-wider">
                      Máy Tính
                    </span>
                    <span className="text-xl font-black text-white mt-0.5 block">
                      {desktopCount}
                    </span>
                    <span className="text-[10px] text-zinc-400">máy tính / PC</span>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Danh sách ({filteredVisitors.length})</span>
                  </span>

                  <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-white/10 text-[11px]">
                    <button
                      onClick={() => setFilterRole("all")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        filterRole === "all"
                          ? "bg-[#B5945B] text-zinc-950 shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      onClick={() => setFilterRole("visitors")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        filterRole === "visitors"
                          ? "bg-[#B5945B] text-zinc-950 shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Khách
                    </button>
                    <button
                      onClick={() => setFilterRole("admins")}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        filterRole === "admins"
                          ? "bg-[#B5945B] text-zinc-950 shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Admin
                    </button>
                  </div>
                </div>

                {/* Visitors Cards List */}
                <div className="space-y-2.5">
                  {filteredVisitors.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 text-xs">
                      Chưa có ai theo bộ lọc này.
                    </div>
                  ) : (
                    filteredVisitors.map((visitor, idx) => {
                      const isSelf = visitor.id === currentVisitorId;
                      const isVisitorAdmin = visitor.role === "admin";
                      const avatarBg =
                        visitor.avatarColor || "from-emerald-500 to-teal-700";

                      return (
                        <div
                          key={`floating-visitor-${visitor.id || 'vis'}-${idx}`}
                          className={`p-3 rounded-xl border transition-all ${
                            isSelf
                              ? "bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-md"
                              : isVisitorAdmin
                              ? "bg-amber-950/20 border-amber-500/30"
                              : "bg-zinc-900/60 border-white/5 hover:border-white/15"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            {/* Left: Avatar + Details */}
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 text-white shadow-md bg-gradient-to-br ${
                                  isVisitorAdmin
                                    ? "from-amber-400 to-yellow-600 text-zinc-950 font-black"
                                    : isSelf
                                    ? "from-emerald-500 to-teal-700 font-black ring-2 ring-emerald-400/50"
                                    : avatarBg
                                }`}
                              >
                                {isVisitorAdmin ? "👑" : `#${idx + 1}`}
                              </div>

                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-white text-xs sm:text-sm">
                                    {visitor.visitorName}
                                  </span>

                                  {isSelf && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      Bạn
                                    </span>
                                  )}

                                  {isVisitorAdmin && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                                      <ShieldCheck className="w-2.5 h-2.5" /> Admin
                                    </span>
                                  )}

                                  {!isVisitorAdmin && (visitor.isReturning || (visitor.visitCount && visitor.visitCount > 1)) && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#B5945B]/20 text-[#E5C17C] border border-[#B5945B]/40 flex items-center gap-0.5 shadow-sm">
                                      <RotateCcw className="w-2.5 h-2.5" /> Xem lại ({visitor.visitCount || 2})
                                    </span>
                                  )}

                                  {!isVisitorAdmin && !visitor.isReturning && (!visitor.visitCount || visitor.visitCount <= 1) && (
                                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-0.5">
                                      <Star className="w-2 h-2" /> Mới
                                    </span>
                                  )}
                                </div>

                                {/* Current Viewing Location */}
                                <div className="flex items-center gap-1 text-[11px] text-[#B5945B] font-semibold">
                                  <Compass className="w-3 h-3 shrink-0 text-[#B5945B]" />
                                  <span className="truncate">
                                    {visitor.currentPage || "Portfolio"}
                                  </span>
                                </div>

                                {visitor.currentViewDetail && (
                                  <div className="text-[10px] text-zinc-400 truncate pl-4">
                                    {visitor.currentViewDetail}
                                  </div>
                                )}

                                {/* Device & Time */}
                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 pt-0.5 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    {getDeviceIcon(sanitizeDeviceLabel(visitor.device, visitor.screenResolution))}
                                    <span>{sanitizeDeviceLabel(visitor.device, visitor.screenResolution)}</span>
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Globe className="w-2.5 h-2.5" />
                                    <span>{visitor.browser}</span>
                                  </span>
                                  {visitor.screenResolution && (
                                    <>
                                      <span>•</span>
                                      <span className="text-zinc-500 text-[9px]">{visitor.screenResolution}</span>
                                    </>
                                  )}
                                  {isAdmin && visitor.location && (
                                    <>
                                      <span>•</span>
                                      <span
                                        className="text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded font-medium text-[9px] border border-red-500/20"
                                        title="Vị trí của khách (Chỉ Quản trị viên mới thấy)"
                                      >
                                        📍 {stripIspFromName(visitor.location)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: Online beacon & time */}
                            <div className="text-right shrink-0 flex flex-col items-end">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                Đang xem
                              </span>
                              <span className="text-[9px] text-zinc-500 mt-1 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {formatJoinedTime(visitor.joinedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:p-4 border-t border-white/10 bg-zinc-900/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[11px] text-zinc-400 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Cập nhật liên tục mỗi khi có lượt xem mới</span>
                </div>

                {isAdmin && onOpenAnalytics && (
                  <button
                    onClick={() => {
                      setIsWidgetOpen(false);
                      onOpenAnalytics();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#B5945B]/20 hover:bg-[#B5945B]/30 border border-[#B5945B]/40 text-[#B5945B] hover:text-[#d3b47c] font-bold text-xs transition-colors cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Mở Bảng Phân Tích Chi Tiết</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
