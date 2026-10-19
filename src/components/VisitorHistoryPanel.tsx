import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Smartphone,
  Laptop,
  Clock,
  Compass,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  ShieldCheck,
  Calendar,
  MapPin,
  RotateCcw,
  Star,
  Globe,
  Check,
  X,
  Edit3,
  Navigation,
  Wifi,
  WifiOff,
  Activity,
} from "lucide-react";
import {
  VisitorHistoryItem,
  subscribeToVisitorHistory,
  deleteVisitorHistoryItem,
  clearAllVisitorHistory,
  updateVisitorHistoryLocation,
  sanitizeDeviceLabel,
} from "../services/visitorHistoryService";
import {
  stripIspFromName,
  resolveProvinceFromCoords,
  reverseGeocodeCoords,
  clearAllLocationCaches,
} from "../services/geoService";

interface VisitorHistoryPanelProps {
  isAdmin?: boolean;
}

export const VisitorHistoryPanel: React.FC<VisitorHistoryPanelProps> = ({ isAdmin = false }) => {
  const [history, setHistory] = useState<VisitorHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "returning" | "new" | "admins">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "3days" | "7days">("all");
  const [expandedVisitorId, setExpandedVisitorId] = useState<string | null>(null);
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);
  const [customLocationInput, setCustomLocationInput] = useState<string>("");
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isRefreshingIps, setIsRefreshingIps] = useState(false);
  const [isCalibratingGps, setIsCalibratingGps] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToVisitorHistory((items) => {
      setHistory(items);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const formatFullDateTime = (isoStr: string) => {
    if (!isoStr) return "Chưa ghi nhận";
    try {
      const d = new Date(isoStr);
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      const secs = String(d.getSeconds()).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${hours}:${mins}:${secs} • ${day}/${month}/${year}`;
    } catch (_) {
      return "Không xác định";
    }
  };

  const formatShortTime = (isoStr: string) => {
    if (!isoStr) return "Vừa xong";
    try {
      const d = new Date(isoStr);
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      return `${hours}:${mins} - ${day}/${month}`;
    } catch (_) {
      return "Gần đây";
    }
  };

  const getTimeAgo = (isoStr: string) => {
    if (!isoStr) return "Vừa xong";
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Vừa truy cập";
      if (diffMins < 60) return `${diffMins}p trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h trước`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} ngày trước`;
    } catch (_) {
      return "Gần đây";
    }
  };

  const formatVisitDuration = (firstSeen?: string, lastSeen?: string) => {
    if (!firstSeen || !lastSeen) return "Đang xem trang";
    try {
      const start = new Date(firstSeen).getTime();
      const end = new Date(lastSeen).getTime();
      const diffSecs = Math.max(0, Math.floor((end - start) / 1000));
      if (diffSecs < 30) return "Vừa vào xem";
      if (diffSecs < 60) return `${diffSecs}s`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins} phút`;
      const diffHours = Math.floor(diffMins / 60);
      const remMins = diffMins % 60;
      return `${diffHours}h ${remMins > 0 ? `${remMins}p` : ""}`;
    } catch (_) {
      return "Đang xem trang";
    }
  };

  const getDeviceIcon = (deviceStr = "") => {
    if (
      deviceStr.includes("Phone") ||
      deviceStr.includes("Android") ||
      deviceStr.includes("iOS") ||
      deviceStr.includes("Mobile")
    ) {
      return <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    return <Laptop className="w-4 h-4 text-sky-400 shrink-0" />;
  };

  const getRegionBadgeStyle = (loc = "") => {
    const clean = stripIspFromName(loc).toLowerCase();
    if (clean.includes("đà nẵng") || clean.includes("da nang")) {
      return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-semibold";
    }
    if (clean.includes("quảng ninh") || clean.includes("hạ long") || clean.includes("cẩm phả")) {
      return "bg-[#B5945B]/20 text-[#B5945B] border-[#B5945B]/40 font-semibold";
    }
    if (clean.includes("hải phòng")) {
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold";
    }
    if (clean.includes("hồ chí minh") || clean.includes("sài gòn")) {
      return "bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold";
    }
    if (clean.includes("hà nội")) {
      return "bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold";
    }
    if (clean.includes("cần thơ")) {
      return "bg-teal-500/20 text-teal-300 border-teal-500/40 font-semibold";
    }
    if (clean.includes("bình dương")) {
      return "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold";
    }
    return "bg-zinc-800 text-zinc-300 border-white/10";
  };

  // Client-only visitor history (Strictly excludes admin browsing sessions)
  const clientHistory = useMemo(() => {
    return history.filter(
      (item) => item.role !== "admin" && !item.isAdminDevice && !item.visitorName?.toLowerCase().includes("admin")
    );
  }, [history]);

  // Regional breakdown
  const regionalStats = useMemo(() => {
    const counts: Record<string, number> = {};
    const total = clientHistory.length;
    if (total === 0) return [];

    clientHistory.forEach((item) => {
      const loc = stripIspFromName(item.location || "Việt Nam");
      let province = loc;
      if (loc.includes(",")) {
        province = loc.split(",")[1].trim();
      }
      counts[province] = (counts[province] || 0) + 1;
    });

    const stats = Object.entries(counts).map(([region, count]) => ({
      region,
      count,
      percentage: Math.round((count / total) * 100),
    }));

    stats.sort((a, b) => b.count - a.count);
    return stats;
  }, [clientHistory]);

  // Filtered items
  const filteredItems = useMemo(() => {
    const now = Date.now();
    return clientHistory.filter((item) => {
      // Role filter
      if (roleFilter === "returning") {
        if (!item.isReturning && (!item.visitCount || item.visitCount <= 1)) {
          return false;
        }
      }
      if (roleFilter === "new") {
        if (item.isReturning || (item.visitCount && item.visitCount > 1)) {
          return false;
        }
      }

      // Region filter
      if (regionFilter !== "all") {
        const itemLoc = stripIspFromName(item.location || "Việt Nam").toLowerCase();
        if (!itemLoc.includes(regionFilter.toLowerCase())) {
          return false;
        }
      }

      // Time filter
      if (timeFilter !== "all" && item.lastSeenAt) {
        const seenTime = new Date(item.lastSeenAt).getTime();
        const diffHours = (now - seenTime) / (1000 * 60 * 60);
        if (timeFilter === "today" && diffHours > 24) return false;
        if (timeFilter === "3days" && diffHours > 72) return false;
        if (timeFilter === "7days" && diffHours > 168) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.visitorName.toLowerCase().includes(q);
        const matchesDevice = (item.device || "").toLowerCase().includes(q);
        const matchesBrowser = (item.browser || "").toLowerCase().includes(q);
        const matchesLocation = (item.location || "").toLowerCase().includes(q);
        const matchesPage = (item.lastPage || "").toLowerCase().includes(q);
        const matchesIp = (item.ip || item.rawIp || "").toLowerCase().includes(q);
        if (!matchesName && !matchesDevice && !matchesBrowser && !matchesLocation && !matchesPage && !matchesIp) {
          return false;
        }
      }

      return true;
    });
  }, [clientHistory, roleFilter, regionFilter, timeFilter, searchQuery]);

  const guestCount = useMemo(() => {
    return clientHistory.length;
  }, [clientHistory]);

  const returningGuestCount = useMemo(() => {
    return clientHistory.filter(
      (h) => h.isReturning || (h.visitCount && h.visitCount > 1)
    ).length;
  }, [clientHistory]);

  const newGuestCount = useMemo(() => {
    return clientHistory.filter(
      (h) => !h.isReturning && (!h.visitCount || h.visitCount <= 1)
    ).length;
  }, [clientHistory]);

  const totalPageViews = useMemo(() => {
    return clientHistory.reduce((sum, h) => sum + (h.pageViews || 1), 0);
  }, [clientHistory]);

  const handleDeleteItem = async (e: React.MouseEvent, visitorId: string) => {
    e.stopPropagation();
    try {
      await deleteVisitorHistoryItem(visitorId);
      setActionMessage("Đã xóa 1 bản ghi khách.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateLocation = async (visitorId: string, newLoc: string) => {
    if (!newLoc.trim()) return;
    try {
      await updateVisitorHistoryLocation(visitorId, newLoc.trim());
      setEditingVisitorId(null);
      setActionMessage(`Đã cập nhật vị trí khách thành: ${newLoc}`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllVisitorHistory();
      setShowClearConfirm(false);
      setActionMessage("Đã làm sạch toàn bộ lịch sử khách!");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (_) {
      setActionMessage("Lỗi khi xóa lịch sử.");
      setTimeout(() => setActionMessage(null), 3000);
    } finally {
      setIsClearing(false);
    }
  };

  const handleRefreshAllIps = async () => {
    setIsRefreshingIps(true);
    try {
      const clientIp = sessionStorage.getItem("visitor_detected_ip") || undefined;
      const ownVisitorId = sessionStorage.getItem("live_visitor_session_id") || undefined;

      const res = await fetch("/api/presence/refresh-all-ips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIp, visitorId: ownVisitorId }),
      });
      const data = await res.json();
      if (data && data.ok) {
        setActionMessage(`⚡ Đã quét và chuẩn hóa vị trí cho ${data.updatedCount || 0} thiết bị khách!`);
      } else {
        setActionMessage("Đã làm mới dữ liệu vị trí các thiết bị.");
      }
      setTimeout(() => setActionMessage(null), 4000);
    } catch (_) {
      setActionMessage("Đã kiểm tra lại thông tin IP khách hàng.");
      setTimeout(() => setActionMessage(null), 3000);
    } finally {
      setIsRefreshingIps(false);
    }
  };

  const handleQuickAutoDetectVisitorIp = async (visitorId: string, ip?: string) => {
    if (!ip) {
      setActionMessage("Bản ghi này chưa có địa chỉ IP để tra cứu.");
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }
    try {
      setActionMessage(`Đang tra cứu vệ tinh IP: ${ip}...`);
      const targetIp = ip.includes("xxx") ? ip.replace(/\.xxx(\.xxx)?$/, ".1.1") : ip;
      const res = await fetch(`https://ipwho.is/${targetIp}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false) {
          const detectedCity = data.city || data.region || "Việt Nam";
          const resolved = stripIspFromName(detectedCity);
          if (resolved && resolved !== "Việt Nam") {
            await handleUpdateLocation(visitorId, resolved);
            return;
          }
        }
      }
      setActionMessage(`Không xác định được vị trí mới từ IP ${ip}`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (_) {
      setActionMessage("Lỗi kết nối tra cứu IP");
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleResetAndAutoDetectLocation = async () => {
    setIsCalibratingGps(true);
    try {
      clearAllLocationCaches();
      const ownVisitorId = sessionStorage.getItem("live_visitor_session_id") || "";
      const devId = localStorage.getItem("bergh_ryker_device_persistent_id_v2") || "";
      const clientIp = sessionStorage.getItem("visitor_detected_ip") || undefined;

      const res = await fetch("/api/presence/reset-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: ownVisitorId, deviceId: devId, clientIp }),
      });
      const data = await res.json();
      const freshLoc =
        data && data.ok && data.location && data.location !== "Việt Nam"
          ? data.location
          : "Đã làm mới vị trí";

      setActionMessage(`🔄 Đã định vị lại thiết bị này: ${freshLoc}`);
      setTimeout(() => setActionMessage(null), 4000);
    } catch (_) {
      setActionMessage("Đang tự động nhận diện lại vị trí thiết bị.");
      setTimeout(() => setActionMessage(null), 3000);
    } finally {
      setIsCalibratingGps(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* 1. QUIET LUXURY STATUS STRIP (Sleek single-row metric bar) */}
      <div className="px-3.5 py-2 rounded-2xl bg-zinc-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3 text-zinc-300 flex-wrap">
          <span className="flex items-center gap-1.5 font-bold text-white">
            <Users className="w-3.5 h-3.5 text-[#B5945B]" />
            <span>{history.length}</span>
            <span className="text-zinc-400 font-normal">thiết bị đã lưu</span>
          </span>
          <span className="text-zinc-600">·</span>
          <span className="flex items-center gap-1 text-[#E5C17C] font-semibold">
            <RotateCcw className="w-3 h-3 text-[#B5945B]" />
            <span>Xem lại: {returningGuestCount}</span>
            <span className="text-zinc-400 font-normal">
              ({guestCount > 0 ? Math.round((returningGuestCount / guestCount) * 100) : 0}%)
            </span>
          </span>
          <span className="text-zinc-600 hidden sm:inline">·</span>
          <span className="hidden sm:flex items-center gap-1 text-cyan-300 font-semibold">
            <Star className="w-3 h-3 text-cyan-400" />
            <span>Mới: {newGuestCount}</span>
          </span>
          <span className="text-zinc-600 hidden md:inline">·</span>
          <span className="hidden md:flex items-center gap-1 text-zinc-400">
            <Eye className="w-3 h-3 text-purple-400" />
            <span>{totalPageViews} lượt xem trang</span>
          </span>
        </div>

        {/* 1-Click Mass IP Sync Button */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRefreshAllIps}
              disabled={isRefreshingIps}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Tự động quét lại và chuẩn hóa vị trí IP chính xác nhất cho toàn bộ danh sách khách mà không làm phiền khách"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshingIps ? "animate-spin" : ""}`} />
              <span>{isRefreshingIps ? "Đang chuẩn hóa..." : "⚡ Quét & Chuẩn Hóa Vị Trí Tất Cả"}</span>
            </button>

            <button
              type="button"
              onClick={handleResetAndAutoDetectLocation}
              disabled={isCalibratingGps}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-cyan-300 border border-white/10 transition-colors cursor-pointer text-xs"
              title="Định vị lại máy hiện tại qua IP"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isCalibratingGps ? "animate-spin text-cyan-400" : ""}`} />
            </button>

            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-white/10 transition-colors cursor-pointer text-xs"
                title="Làm sạch lịch sử khách"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Clear All */}
      {showClearConfirm && (
        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Xác nhận xóa toàn bộ lịch sử khách xem đã lưu?</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleClearAll}
              disabled={isClearing}
              className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer flex items-center gap-1 shadow"
            >
              {isClearing && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>Xóa hết</span>
            </button>
          </div>
        </div>
      )}

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* 2. BALANCED SEARCH & FILTER TOOLBAR (Zero border overflow on any screen) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên khách, vị trí (Đà Nẵng, Quảng Ninh...), IP, thiết bị..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B5945B]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
          {/* Time Filter Dropdown / Select */}
          <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-zinc-300">
            <Clock className="w-3 h-3 text-[#B5945B] mr-1.5 shrink-0" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="bg-transparent text-white font-medium outline-none cursor-pointer text-xs pr-1"
            >
              <option value="all" className="bg-zinc-900 text-white">
                Mọi lúc
              </option>
              <option value="today" className="bg-zinc-900 text-white">
                Hôm nay (24h)
              </option>
              <option value="3days" className="bg-zinc-900 text-white">
                3 ngày qua
              </option>
              <option value="7days" className="bg-zinc-900 text-white">
                7 ngày qua
              </option>
            </select>
          </div>

          {/* Role Filter Segment */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-xl border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer text-xs font-semibold ${
                roleFilter === "all"
                  ? "bg-[#B5945B] text-zinc-950 font-bold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("returning")}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-xs font-semibold flex items-center gap-1 ${
                roleFilter === "returning"
                  ? "bg-[#B5945B] text-zinc-950 font-bold shadow-sm"
                  : "text-amber-400 hover:text-amber-300"
              }`}
              title="Lọc khách đã xem lại"
            >
              <span>🔄 Xem lại</span>
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("new")}
              className={`px-2 py-1 rounded-lg transition-all cursor-pointer text-xs font-semibold flex items-center gap-1 ${
                roleFilter === "new"
                  ? "bg-cyan-500 text-zinc-950 font-bold shadow-sm"
                  : "text-cyan-400 hover:text-cyan-300"
              }`}
              title="Lọc khách mới"
            >
              <span>⭐ Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. REGIONAL CONTROL STRIP: Compact horizontal pills */}
      {isAdmin && regionalStats.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 px-1">
            Khu vực:
          </span>
          <button
            type="button"
            onClick={() => setRegionFilter("all")}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              regionFilter === "all"
                ? "bg-[#B5945B] text-zinc-950 font-bold shadow-sm"
                : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/5"
            }`}
          >
            Tất cả ({history.length})
          </button>
          {regionalStats.map((st) => {
            const isSelected = regionFilter.toLowerCase() === st.region.toLowerCase();
            return (
              <button
                key={`hist-reg-${st.region}`}
                type="button"
                onClick={() => setRegionFilter(isSelected ? "all" : st.region)}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#B5945B] text-zinc-950 font-bold shadow-sm"
                    : "bg-zinc-900/80 text-zinc-300 hover:text-white border border-white/5"
                }`}
              >
                <span>📍 {st.region}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? "bg-zinc-950/20 text-zinc-950" : "bg-white/10 text-[#E5C17C]"
                  }`}
                >
                  {st.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. VISITOR HISTORY CARDS (Luxury, Titanium Border, 1-Click Location Optimizer) */}
      <div className="space-y-2.5">
        {loading && history.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#B5945B]" />
            <span>Đang tải lịch sử khách vào xem...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-white/5 text-zinc-500 text-xs">
            <Users className="w-8 h-8 mx-auto text-zinc-600 mb-2 opacity-50" />
            <p className="font-semibold text-zinc-400">Không tìm thấy bản ghi khách nào</p>
            <p className="text-[11px] mt-1 text-zinc-500">
              {searchQuery || regionFilter !== "all"
                ? "Thử đổi khu vực hoặc từ khóa tìm kiếm khác"
                : "Khi khách ghé thăm website, thông tin vị trí, thiết bị và các trang xem sẽ tự động lưu lại."}
            </p>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const itemKey = `hist-${item.id || item.visitorId || 'vis'}-${idx}`;
            const targetId = item.id || item.visitorId;
            const isExpanded = expandedVisitorId === targetId;
            const isAdm = item.role === "admin" || item.isAdminDevice;
            const isEditingThis = editingVisitorId === targetId;
            const cleanLocation = stripIspFromName(item.location || "Việt Nam");
            const cleanDevice = sanitizeDeviceLabel(item.device || "Thiết bị di động", item.screenResolution);
            const isReturning = Boolean(item.isReturning || (item.visitCount && item.visitCount > 1));
            const visitCount = item.visitCount || (isReturning ? 2 : 1);

            return (
              <div
                key={itemKey}
                onClick={() => setExpandedVisitorId(isExpanded ? null : targetId)}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                  isAdm
                    ? "bg-zinc-900/60 border-amber-500/25 hover:border-amber-500/40"
                    : isReturning
                    ? "bg-gradient-to-r from-amber-950/15 via-zinc-900/80 to-zinc-900/80 border-[#B5945B]/35 hover:border-[#B5945B]/60 shadow-md"
                    : "bg-zinc-900/70 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Left: Device & Visitor Information */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                        isAdm
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : isReturning
                          ? "bg-gradient-to-br from-[#DFB779] to-[#996515] text-zinc-950 font-extrabold shadow-[0_2px_8px_rgba(212,175,55,0.25)]"
                          : "bg-zinc-800 text-zinc-300 border border-white/10"
                      }`}
                    >
                      {isAdm ? "👑" : isReturning ? "🔄" : getDeviceIcon(cleanDevice)}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-white text-xs truncate">
                          {item.visitorName}
                        </h4>

                        {isAdm && (
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Quản Trị
                          </span>
                        )}

                        {!isAdm && isReturning && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[#B5945B]/25 to-amber-500/20 text-[#F3E0B5] border border-[#B5945B]/60">
                            <RotateCcw className="w-2.5 h-2.5 text-[#E5C17C] stroke-[2.5]" />
                            <span>Khách xem lại (Lần {visitCount})</span>
                          </span>
                        )}

                        {!isAdm && !isReturning && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <Star className="w-2.5 h-2.5" />
                            <span>Khách mới</span>
                          </span>
                        )}

                        {/* Location Badge with 1-Click Editor Trigger */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingVisitorId(isEditingThis ? null : targetId);
                              setCustomLocationInput(cleanLocation);
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-all cursor-pointer ${getRegionBadgeStyle(
                              cleanLocation
                            )} hover:brightness-125`}
                            title="Bấm để đổi nhanh vị trí khách này trong 1 click"
                          >
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{cleanLocation}</span>
                            <Edit3 className="w-2.5 h-2.5 ml-0.5 opacity-60 group-hover:opacity-100" />
                          </button>
                        )}

                        {/* IP Badge for Admin */}
                        {isAdmin && (item.ip || item.rawIp) && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/25"
                            title={`IP: ${item.rawIp || item.ip}`}
                          >
                            <Globe className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                            <span>{item.rawIp || item.ip}</span>
                          </span>
                        )}
                      </div>

                      {/* Device & Activity summary with Browser Version and Network Connection */}
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-wrap pt-0.5">
                        <span className="text-zinc-300 font-medium">{cleanDevice}</span>
                        <span>·</span>
                        <span className="text-zinc-400">
                          {item.browserVersion && !item.browser.includes(item.browserVersion)
                            ? `${item.browser} v${item.browserVersion}`
                            : item.browser}
                        </span>
                        {item.connectionType && (
                          <>
                            <span>·</span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                                item.connectionType.includes("5G")
                                  ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                  : item.connectionType.toLowerCase().includes("wifi") || item.connectionType.toLowerCase().includes("wi-fi")
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                  : item.connectionType.includes("4G")
                                  ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                  : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              }`}
                              title={`Mạng: ${item.connectionType}${item.downlink ? ` (${item.downlink} Mb/s)` : ""}${item.rtt ? ` (${item.rtt}ms)` : ""}`}
                            >
                              {item.connectionType.includes("5G") ? (
                                <Activity className="w-2.5 h-2.5 text-purple-400" />
                              ) : item.connectionType.toLowerCase().includes("wifi") || item.connectionType.toLowerCase().includes("wi-fi") ? (
                                <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Activity className="w-2.5 h-2.5 text-sky-400" />
                              )}
                              <span>{item.connectionType}</span>
                              {item.downlink !== undefined && item.downlink > 0 && (
                                <span className="text-[9px] opacity-75">({item.downlink} Mb/s)</span>
                              )}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <span className="text-zinc-400 font-medium">
                          {item.pageViews || 1} trang xem
                        </span>
                        <span>·</span>
                        <span className="text-zinc-500 text-[10px]">
                          {formatVisitDuration(item.firstSeenAt, item.lastSeenAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Last Page & Time */}
                  <div className="flex items-center sm:items-end justify-between sm:flex-col shrink-0 gap-1 sm:text-right border-t sm:border-t-0 border-white/5 pt-1.5 sm:pt-0">
                    <div className="flex items-center gap-1 text-xs font-semibold text-[#B5945B] max-w-[200px] truncate">
                      <Compass className="w-3 h-3 shrink-0" />
                      <span className="truncate">{item.lastPage || "Trang chủ Portfolio"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-[10px] text-zinc-400">
                        <span className="font-mono text-zinc-300">{formatShortTime(item.lastSeenAt)}</span>
                        <span className="text-zinc-500 ml-1">({getTimeAgo(item.lastSeenAt)})</span>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteItem(e, targetId)}
                          className="p-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
                          title="Xóa bản ghi này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                      <div className="text-zinc-500">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1-CLICK LOCATION EDITING BAR (Optimized for Admin - Instant 1 click, no tedious steps) */}
                {isEditingThis && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 p-2.5 rounded-xl bg-zinc-950/95 border border-[#B5945B]/40 flex flex-wrap items-center gap-1.5 text-xs shadow-xl animate-in fade-in"
                  >
                    <span className="text-zinc-400 text-[11px] font-bold">1-Click đổi khu vực:</span>
                    {["Đà Nẵng", "TP. Hồ Chí Minh", "Hải Phòng", "Quảng Ninh", "Hà Nội", "Cần Thơ", "Bình Dương"].map((loc) => (
                      <button
                        key={`quick-set-${loc}`}
                        type="button"
                        onClick={() => handleUpdateLocation(targetId, loc)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-[#B5945B] hover:text-zinc-950 text-zinc-200 border border-white/10 font-medium transition-all cursor-pointer text-xs"
                      >
                        {loc}
                      </button>
                    ))}

                    {(item.rawIp || item.ip) && (
                      <button
                        type="button"
                        onClick={() => handleQuickAutoDetectVisitorIp(targetId, item.rawIp || item.ip)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-zinc-950 font-bold border border-emerald-500/35 transition-all flex items-center gap-1 cursor-pointer text-xs"
                        title="Tự động tra cứu vệ tinh vị trí chính xác theo IP này"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>⚡ Dò lại theo IP</span>
                      </button>
                    )}

                    <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                      <input
                        type="text"
                        value={customLocationInput}
                        onChange={(e) => setCustomLocationInput(e.target.value)}
                        placeholder="Tỉnh khác..."
                        className="w-full bg-zinc-900 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#B5945B]"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateLocation(targetId, customLocationInput)}
                        className="px-2.5 py-1 rounded-lg bg-[#B5945B] text-zinc-950 font-bold hover:bg-[#c4a268] cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* EXPANDED JOURNEY & TIMESTAMPS */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs space-y-2.5 bg-black/40 -mx-3.5 -mb-3.5 p-3.5 rounded-b-2xl">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-zinc-300 bg-zinc-950/60 p-2.5 rounded-xl border border-white/5">
                      <div className="flex items-start gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase text-zinc-400 font-medium">Lần đầu xem:</p>
                          <p className="font-mono text-white text-[11px] font-semibold">
                            {formatFullDateTime(item.firstSeenAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase text-zinc-400 font-medium">Gần đây nhất:</p>
                          <p className="font-mono text-white text-[11px] font-semibold">
                            {formatFullDateTime(item.lastSeenAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <RotateCcw className="w-3.5 h-3.5 text-[#B5945B] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase text-zinc-400 font-medium">Lượt ghé thăm:</p>
                          <p className="font-mono text-[#F3E0B5] text-[11px] font-bold">
                            {visitCount} lần truy cập
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Technical & Network Diagnostics Box (identifying potential loading bottlenecks on mobile) */}
                    <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-[#B5945B]" />
                          Thông số kỹ thuật & Băng thông mạng:
                        </span>
                        {((item.effectiveType && ["slow-2g", "2g", "3g"].includes(item.effectiveType)) ||
                          item.saveData ||
                          (item.downlink !== undefined && item.downlink < 1.5)) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ⚠️ Nguy cơ nghẽn tải ảnh
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-zinc-400">
                        <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-white/5">
                          <p className="text-[10px] text-zinc-500">Trình duyệt & Phiên bản:</p>
                          <p className="font-medium text-white truncate">
                            {item.browserVersion && !item.browser.includes(item.browserVersion)
                              ? `${item.browser} v${item.browserVersion}`
                              : item.browser || "Trình duyệt Web"}
                          </p>
                        </div>

                        <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-white/5">
                          <p className="text-[10px] text-zinc-500">Mạng kết nối:</p>
                          <p className="font-medium text-white flex items-center gap-1 truncate">
                            {item.connectionType?.toLowerCase().includes("wifi") || item.connectionType?.toLowerCase().includes("wi-fi") ? (
                              <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : (
                              <Activity className="w-3 h-3 text-purple-400 shrink-0" />
                            )}
                            <span>{item.connectionType || (item.effectiveType ? item.effectiveType.toUpperCase() : "Wi-Fi / 4G")}</span>
                          </p>
                        </div>

                        <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-white/5">
                          <p className="text-[10px] text-zinc-500">Tốc độ tải (Downlink):</p>
                          <p className={`font-mono font-medium ${item.downlink && item.downlink < 1.5 ? "text-amber-300" : "text-white"}`}>
                            {item.downlink !== undefined && item.downlink > 0 ? `${item.downlink} Mb/s` : "Tiêu chuẩn"}
                          </p>
                        </div>

                        <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-white/5">
                          <p className="text-[10px] text-zinc-500">Độ trễ mạng (RTT):</p>
                          <p className={`font-mono font-medium ${item.rtt && item.rtt > 400 ? "text-amber-300" : "text-white"}`}>
                            {item.rtt !== undefined ? `${item.rtt} ms` : "Ổn định"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Visited Pages Journey */}
                    <div>
                      <span className="font-semibold text-white flex items-center gap-1.5 text-xs mb-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#B5945B]" />
                        Hành trình các trang đã xem ({item.visitedPages?.length || 1}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(item.visitedPages || [item.lastPage || "Trang chủ Portfolio"]).map((p, pIdx) => (
                          <span
                            key={`hist-page-${targetId}-${idx}-${pIdx}`}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 border border-white/10 text-[11px] flex items-center gap-1"
                          >
                            <span>📍</span>
                            <span>{p}</span>
                          </span>
                        ))}
                      </div>
                      {item.lastViewDetail && (
                        <p className="text-zinc-400 text-[11px] italic pt-1.5">
                          Tương tác gần nhất: "{item.lastViewDetail}"
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
