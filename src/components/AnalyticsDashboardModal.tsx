import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Image as ImageIcon,
  FolderHeart,
  Users,
  Eye,
  RefreshCw,
  Sparkles,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Flame,
  RotateCcw,
  AlertTriangle,
  Clock,
  Radio,
  Search,
  ChevronRight,
  MapPin,
  Trophy,
  ArrowUp,
} from "lucide-react";
import { useSectionAnalytics } from "../hooks/useSectionAnalytics";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useLivePresence } from "../hooks/useLivePresence";
import { formatMonthLabel } from "../services/analyticsService";
import { HourlyAnalyticsChart } from "./HourlyAnalyticsChart";
import { LivePresencePanel } from "./LivePresencePanel";
import { VisitorHistoryPanel } from "./VisitorHistoryPanel";

interface AnalyticsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsDashboardModal: React.FC<AnalyticsDashboardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isAdmin } = useAdminAuth();
  const { activeVisitors, activeCount, currentVisitorId } = useLivePresence("Bảng Quản Trị", "Xem Thống Kê Lượt Xem");
  const {
    loading,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    portfolioVisitorsCount,
    collectionsList,
    albumsList,
    photosList,
    totalPortfolioViews,
    topCollection,
    topAlbum,
    purgeLegacySections,
    resetAll,
    formatViewCount,
    getHourlyStats,
  } = useSectionAnalytics();

  // 4 Core Streamlined Tabs
  const [activeTab, setActiveTab] = useState<"visitors" | "hourly" | "content" | "photos">("visitors");
  const [visitorSubTab, setVisitorSubTab] = useState<"live" | "history">("live");
  const [contentSubTab, setContentSubTab] = useState<"collections" | "albums">("collections");
  const [contentSearch, setContentSearch] = useState<string>("");

  const [hourlySource, setHourlySource] = useState<string>("all");
  const [isCleaning, setIsCleaning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);

  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > 240);
  };

  const scrollToTop = () => {
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hourlyStats = useMemo(() => {
    return getHourlyStats(hourlySource);
  }, [getHourlyStats, hourlySource]);

  const availableSources = useMemo(() => {
    const list: { id: string; title: string; type: string }[] = [];
    list.push({ id: "portfolio_visitors", title: "Khách Xem Portfolio", type: "portfolio_visitor" });
    collectionsList.forEach((c) => {
      list.push({ id: c.id, title: c.title, type: "collection" });
    });
    albumsList.forEach((a) => {
      list.push({ id: a.id, title: a.title, type: "album" });
    });
    return list;
  }, [collectionsList, albumsList]);

  // Filtered collections
  const filteredCollections = useMemo(() => {
    if (!contentSearch.trim()) return collectionsList;
    const q = contentSearch.toLowerCase();
    return collectionsList.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.collectionId || c.id || "").toLowerCase().includes(q)
    );
  }, [collectionsList, contentSearch]);

  // Filtered albums
  const filteredAlbums = useMemo(() => {
    if (!contentSearch.trim()) return albumsList;
    const q = contentSearch.toLowerCase();
    return albumsList.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.collectionId || "").toLowerCase().includes(q) ||
        (a.albumId || a.id || "").toLowerCase().includes(q)
    );
  }, [albumsList, contentSearch]);

  if (!isOpen) return null;

  // STRICT REQUIREMENT: Only admin can view analytics
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="bg-zinc-950 border border-red-500/30 rounded-2xl p-6 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center mb-4">
            <X className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Quyền Truy Cập Bị Giới Hạn</h3>
          <p className="text-zinc-400 text-sm mb-6">
            Bảng thống kê số người xem và phân tích bộ sưu tập chỉ dành riêng cho Quản trị viên (Admin).
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const handleCleanLegacy = async () => {
    setIsCleaning(true);
    try {
      const removedCount = await purgeLegacySections();
      setCleanMessage(`Đã dọn dẹp ${removedCount} mục ngoài Portfolio!`);
      setTimeout(() => setCleanMessage(null), 4000);
    } catch {
      setCleanMessage("Dọn dẹp hoàn tất.");
      setTimeout(() => setCleanMessage(null), 3000);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      await resetAll();
      setShowResetConfirm(false);
      setCleanMessage("Đã reset toàn bộ lượt xem về 0 thành công! Số liệu sẽ được tính mới từ bây giờ.");
      setTimeout(() => setCleanMessage(null), 5000);
    } catch {
      setCleanMessage("Lỗi khi reset số liệu. Vui lòng thử lại.");
      setTimeout(() => setCleanMessage(null), 4000);
    } finally {
      setIsResetting(false);
    }
  };

  const currentMonthLabel =
    selectedMonth === "all" ? "Tất Cả Thời Gian" : formatMonthLabel(selectedMonth);

  return (
    <AnimatePresence>
      <div key="analytics-dashboard-modal" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-xl"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          transition={{ duration: 0.22 }}
          className="relative w-full max-w-5xl bg-[#0c0d11] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[94vh] sm:h-[90vh] max-h-[94vh] z-10"
        >
          {/* HEADER: Clean, Focused & Elegant */}
          <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-zinc-950/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B5945B]/15 border border-[#B5945B]/30 flex items-center justify-center text-[#B5945B] shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Thống Kê Lượt Xem Portfolio
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <ShieldCheck className="w-3 h-3" />
                    Admin
                  </span>
                </div>
                <p className="text-zinc-400 text-xs">
                  Khách truy cập, vị trí khu vực và hiệu suất các album kỷ yếu
                </p>
              </div>
            </div>

            {/* Right Tools: Month Filter + Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Month Selector */}
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-[#B5945B]" />
                <span className="text-zinc-400 font-medium hidden sm:inline">Kỳ:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-white font-semibold outline-none cursor-pointer pr-1 text-xs"
                >
                  <option value="all" className="bg-zinc-900 text-white">
                    Tất cả thời gian
                  </option>
                  {availableMonths.map((m, mIdx) => (
                    <option key={`month-${m}-${mIdx}`} value={m} className="bg-zinc-900 text-white">
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset to 0 Button */}
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={isResetting}
                title="Reset toàn bộ số lượt xem về 0"
                className="px-2.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/25 transition-colors cursor-pointer text-xs flex items-center gap-1"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Reset về 0</span>
              </button>

              {/* Clean legacy sections */}
              <button
                onClick={handleCleanLegacy}
                disabled={isCleaning}
                title="Dọn dẹp mục rác không thuộc Portfolio"
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Reset Confirmation Overlay */}
          {showResetConfirm && (
            <div className="bg-red-500/10 border-b border-red-500/30 p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-300">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <p className="font-semibold text-xs text-white">Xác nhận reset toàn bộ lượt xem về 0?</p>
                  <p className="text-[11px] text-red-300/80">Lượt xem sẽ bắt đầu đếm số thực tế mới từ thời điểm này.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleResetAll}
                  disabled={isResetting}
                  className="px-3.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow"
                >
                  {isResetting && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>Chắc chắn Reset</span>
                </button>
              </div>
            </div>
          )}

          {/* Notification Message */}
          {cleanMessage && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-5 py-2 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{cleanMessage}</span>
            </div>
          )}

          {/* SCROLLABLE BODY CONTENT - Unified smooth scrolling across all features */}
          <div
            ref={scrollBodyRef}
            onScroll={handleScroll}
            className="p-4 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1 scroll-smooth touch-pan-y [webkit-overflow-scrolling:touch] scrollbar-thin scrollbar-thumb-zinc-700/60 hover:scrollbar-thumb-zinc-600 relative"
          >
            {/* 4 SLEEK KPI SUMMARY METRICS (Compact 1 Row Grid) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              {/* Metric 1: Live Online */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("visitors");
                  setVisitorSubTab("live");
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  activeTab === "visitors" && visitorSubTab === "live"
                    ? "bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-md"
                    : "bg-zinc-900/70 border-white/10 hover:border-emerald-500/40 hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                    Đang Online
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {activeCount}
                  </span>
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Trực tiếp
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 truncate">
                  Chạm để xem chi tiết khách online
                </p>
              </button>

              {/* Metric 2: Total Unique Visitors */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("visitors");
                  setVisitorSubTab("history");
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  activeTab === "visitors" && visitorSubTab === "history"
                    ? "bg-[#B5945B]/15 border-[#B5945B]/60 ring-1 ring-[#B5945B]/30 shadow-md"
                    : "bg-zinc-900/70 border-white/10 hover:border-[#B5945B]/40 hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#B5945B]">
                    Khách Ghé Thăm
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-[#B5945B]/15 text-[#B5945B] flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {formatViewCount(portfolioVisitorsCount)}
                  </span>
                  <span className="text-[11px] text-zinc-400">người</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 truncate">
                  Kỳ: <strong className="text-zinc-300 font-medium">{currentMonthLabel}</strong>
                </p>
              </button>

              {/* Metric 3: Total Portfolio Views */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("content");
                  setContentSubTab("collections");
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  activeTab === "content"
                    ? "bg-amber-950/20 border-amber-500/50 ring-1 ring-amber-500/30 shadow-md"
                    : "bg-zinc-900/70 border-white/10 hover:border-amber-500/30 hover:bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                    Tổng Lượt Xem Ảnh
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {formatViewCount(totalPortfolioViews)}
                  </span>
                  <span className="text-[11px] text-zinc-400">lượt</span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 truncate">
                  {collectionsList.length} BST • {albumsList.length} album
                </p>
              </button>

              {/* Metric 4: Top Content Highlight */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab("content");
                  setContentSubTab("collections");
                }}
                className="p-3.5 rounded-2xl border border-white/10 bg-zinc-900/70 hover:border-[#B5945B]/40 hover:bg-zinc-900 text-left transition-all cursor-pointer relative overflow-hidden group"
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    Hot Nhất #1
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5" />
                  </div>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white truncate" title={topCollection?.title}>
                  {topCollection ? topCollection.title : "Chưa có"}
                </h4>
                <p className="text-[10px] text-[#B5945B] font-bold mt-1">
                  {formatViewCount(topCollection?.currentViews || 0)} lượt xem
                </p>
              </button>
            </div>

            {/* UNIFIED 4 MAIN TABS (Sticky header inside scroll body so tabs are always accessible) */}
            <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#0c0d11]/95 py-2.5 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto scrollbar-none transition-all shadow-sm">
              {/* Tab 1: Visitors & Geography */}
              <button
                type="button"
                onClick={() => setActiveTab("visitors")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === "visitors"
                    ? "bg-[#B5945B] text-zinc-950 shadow-md font-extrabold"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Khách Xem & Vị Trí</span>
                {activeCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      activeTab === "visitors"
                        ? "bg-zinc-950/30 text-zinc-950"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {activeCount} online
                  </span>
                )}
              </button>

              {/* Tab 2: Hourly Chart */}
              <button
                type="button"
                onClick={() => setActiveTab("hourly")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === "hourly"
                    ? "bg-[#B5945B] text-zinc-950 shadow-md font-extrabold"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Khung Giờ Vàng (24h)</span>
              </button>

              {/* Tab 3: Collections & Albums */}
              <button
                type="button"
                onClick={() => setActiveTab("content")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === "content"
                    ? "bg-[#B5945B] text-zinc-950 shadow-md font-extrabold"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bộ Sưu Tập & Album</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === "content" ? "bg-zinc-950/20 text-zinc-950" : "bg-white/10 text-zinc-400"
                  }`}
                >
                  {collectionsList.length + albumsList.length}
                </span>
              </button>

              {/* Tab 4: Photos */}
              <button
                type="button"
                onClick={() => setActiveTab("photos")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  activeTab === "photos"
                    ? "bg-[#B5945B] text-zinc-950 shadow-md font-extrabold"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Ảnh Được Xem ({photosList.length})</span>
              </button>
            </div>

            {/* TAB 1 CONTENT: VISITORS & GEOLOCATION */}
            {activeTab === "visitors" && (
              <div className="space-y-3.5">
                {/* Clean Sub-Navigation for Visitors */}
                <div className="flex items-center justify-between gap-3 p-1.5 rounded-xl bg-zinc-950 border border-white/10">
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setVisitorSubTab("live")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold flex items-center gap-1.5 text-xs ${
                        visitorSubTab === "live"
                          ? "bg-emerald-600 text-white shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-300" />
                      <span>Đang Xem Trực Tiếp ({activeCount})</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisitorSubTab("history")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold flex items-center gap-1.5 text-xs ${
                        visitorSubTab === "history"
                          ? "bg-[#B5945B] text-zinc-950 shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Toàn Bộ Lịch Sử & Kiểm Soát Khu Vực</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-zinc-500 hidden sm:inline px-2">
                    {visitorSubTab === "live"
                      ? "Khách đang mở trang ngay thời điểm này"
                      : "Theo dõi lượng khách từ Quảng Ninh, Hà Nội..."}
                  </span>
                </div>

                {/* Sub Tab View 1: Live Presence */}
                {visitorSubTab === "live" && (
                  <LivePresencePanel
                    activeVisitors={activeVisitors}
                    activeCount={activeCount}
                    currentVisitorId={currentVisitorId}
                  />
                )}

                {/* Sub Tab View 2: Visitor History & Regional Analytics */}
                {visitorSubTab === "history" && (
                  <VisitorHistoryPanel isAdmin={isAdmin} />
                )}
              </div>
            )}

            {/* TAB 2 CONTENT: HOURLY CHART */}
            {activeTab === "hourly" && (
              <div className="space-y-4">
                <HourlyAnalyticsChart
                  stats={hourlyStats}
                  selectedSource={hourlySource}
                  onSourceChange={setHourlySource}
                  availableSources={availableSources}
                />
              </div>
            )}

            {/* TAB 3 CONTENT: COLLECTIONS & ALBUMS (Unified) */}
            {activeTab === "content" && (
              <div className="space-y-3.5">
                {/* Sub-Switch & Search Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setContentSubTab("collections")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                        contentSubTab === "collections"
                          ? "bg-[#B5945B] text-zinc-950 shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Bộ Sưu Tập ({collectionsList.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setContentSubTab("albums")}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
                        contentSubTab === "albums"
                          ? "bg-[#B5945B] text-zinc-950 shadow"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      <FolderHeart className="w-3.5 h-3.5" />
                      <span>Từng Album ({albumsList.length})</span>
                    </button>
                  </div>

                  {/* Search box */}
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={contentSearch}
                      onChange={(e) => setContentSearch(e.target.value)}
                      placeholder={
                        contentSubTab === "collections"
                          ? "Tìm bộ sưu tập..."
                          : "Tìm tên album..."
                      }
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B5945B]"
                    />
                  </div>
                </div>

                {/* View 1: Collections Ranking */}
                {contentSubTab === "collections" && (
                  <div className="space-y-2.5">
                    {filteredCollections.length === 0 ? (
                      <div className="p-8 text-center bg-zinc-900/40 rounded-xl border border-white/5 text-xs text-zinc-500">
                        Không tìm thấy bộ sưu tập nào khớp với từ khóa.
                      </div>
                    ) : (
                      filteredCollections.map((col, idx) => {
                        const maxColViews = collectionsList[0]?.currentViews || 1;
                        const percent = Math.round(((col.currentViews || 0) / maxColViews) * 100);

                        return (
                          <div
                            key={`analytics-col-${col.id || 'col'}-${idx}`}
                            className="bg-zinc-900/60 border border-white/5 hover:border-[#B5945B]/30 p-3.5 rounded-xl transition-all"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                                    idx === 0
                                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                      : idx === 1
                                      ? "bg-zinc-700/50 text-zinc-300 border border-zinc-600"
                                      : "bg-white/5 text-zinc-500"
                                  }`}
                                >
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <h5 className="font-semibold text-white text-xs sm:text-sm truncate">
                                    {col.title}
                                  </h5>
                                  <span className="text-[10px] text-zinc-500 block truncate">
                                    Mã: {col.collectionId || col.id}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-extrabold text-[#B5945B] text-sm sm:text-base">
                                  {formatViewCount(col.currentViews)}
                                </span>
                                <span className="text-[11px] text-zinc-400 ml-1">lượt</span>
                                {selectedMonth !== "all" && (
                                  <div className="text-[10px] text-zinc-500">
                                    Tổng: {formatViewCount(col.views)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden mt-2">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  idx === 0
                                    ? "bg-gradient-to-r from-[#B5945B] to-amber-500"
                                    : "bg-gradient-to-r from-zinc-600 to-zinc-400"
                                }`}
                                style={{ width: `${Math.max(percent, 4)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* View 2: Albums Grid */}
                {contentSubTab === "albums" && (
                  <div className="space-y-2.5">
                    {filteredAlbums.length === 0 ? (
                      <div className="p-8 text-center bg-zinc-900/40 rounded-xl border border-white/5 text-xs text-zinc-500">
                        Chưa có dữ liệu album nào hoặc không khớp với tìm kiếm.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {filteredAlbums.map((album, idx) => (
                          <div
                            key={`analytics-album-${album.id || 'album'}-${idx}`}
                            className="bg-zinc-900/60 border border-white/5 hover:border-[#B5945B]/30 p-3 rounded-xl flex items-center justify-between transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-bold text-zinc-400 shrink-0">
                                #{idx + 1}
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-semibold text-white text-xs truncate" title={album.title}>
                                  {album.title}
                                </h5>
                                <span className="text-[10px] text-zinc-500 block truncate">
                                  {album.collectionId || "Kỷ yếu"}
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-bold text-[#B5945B] text-xs sm:text-sm">
                                {formatViewCount(album.currentViews)}
                              </div>
                              <span className="text-[9px] text-zinc-500 uppercase">lượt xem</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4 CONTENT: PHOTOS */}
            {activeTab === "photos" && (
              <div className="space-y-3.5">
                {photosList.length === 0 ? (
                  <div className="p-8 text-center bg-zinc-900/40 rounded-xl border border-white/5 text-xs text-zinc-500">
                    Chưa có lượt click phóng to xem ảnh chi tiết nào. Số liệu sẽ tăng khi khách hàng mở xem ảnh lightbox.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {photosList.map((photo, idx) => (
                      <div
                        key={`analytics-photo-${photo.id || photo.photoId || 'photo'}-${idx}`}
                        className="bg-zinc-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-[#B5945B]/10 text-[#B5945B] shrink-0">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-medium text-white text-xs truncate" title={photo.title}>
                              {photo.title || `Ảnh #${idx + 1}`}
                            </h5>
                            <span className="text-[9px] text-zinc-500 block truncate">
                              ID: {photo.photoId || photo.id}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-white text-xs">
                            {formatViewCount(photo.currentViews)}
                          </span>
                          <span className="text-[9px] text-zinc-500 block">lượt</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* BOTTOM STRATEGIC TIP: Sleek, Unobtrusive Banner */}
            <div className="bg-gradient-to-r from-[#B5945B]/10 via-zinc-900 to-transparent border border-[#B5945B]/20 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4 h-4 text-[#B5945B] shrink-0" />
                <p className="text-zinc-300 text-xs truncate">
                  {topCollection ? (
                    <span>
                      Concept <strong className="text-white">"{topCollection.title}"</strong> đang dẫn đầu với{" "}
                      <strong className="text-[#B5945B]">{formatViewCount(topCollection.currentViews)}</strong> lượt xem.
                    </span>
                  ) : (
                    "Hệ thống đang tự động theo dõi lượt xem và phân tích số liệu."
                  )}
                </p>
              </div>

              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-[#B5945B] hover:bg-amber-500 text-zinc-950 font-bold text-xs rounded-lg transition-colors shrink-0 cursor-pointer self-end sm:self-auto shadow"
              >
                Đóng
              </button>
            </div>
          </div>

          {/* Floating Quick Scroll to Top Button */}
          <AnimatePresence>
            {showScrollTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                type="button"
                onClick={scrollToTop}
                title="Cuộn mượt mà lên đầu trang"
                className="absolute bottom-5 right-5 z-40 p-3 rounded-full bg-[#B5945B] hover:bg-[#d4af37] text-zinc-950 font-bold shadow-xl flex items-center gap-1.5 text-xs transition-transform active:scale-90 cursor-pointer select-none"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                <span className="hidden sm:inline font-bold">Lên đầu</span>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
