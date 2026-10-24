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
  ExternalLink,
} from "lucide-react";
import {
  VisitorHistoryItem,
  subscribeToVisitorHistory,
  deleteVisitorHistoryItem,
  clearAllVisitorHistory,
  updateVisitorHistoryLocation,
  sanitizeDeviceLabel,
  getSocialSourceLabel,
} from "../services/visitorHistoryService";
import {
  stripIspFromName,
  getBrowserGpsDetailed,
  clearAllLocationCaches,
} from "../services/geoService";
import {
  autoHealVisitorLocations,
  initAutomatedGeolocationWatcher,
  resolveFailProofHybridLocation,
  canonicalizeProvince,
  canonicalizeDistrict,
  getDisplayVisitorLocation,
  GeolocationPrecision,
} from "../services/geolocationEngine";

interface VisitorHistoryPanelProps {
  isAdmin?: boolean;
}

export const VisitorHistoryPanel: React.FC<VisitorHistoryPanelProps> = ({ isAdmin = false }) => {
  const [history, setHistory] = useState<VisitorHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "returning" | "new" | "admins">("all");
  const [provinceFilter, setProvinceFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "3days" | "7days">("all");
  const [expandedVisitorId, setExpandedVisitorId] = useState<string | null>(null);
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);
  const [customLocationInput, setCustomLocationInput] = useState<string>("");
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isHealing, setIsHealing] = useState(false);

  // Subscribe to visitor history from Firestore
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

  // Background Auto-Healing for legacy false "Hà Nội" records + passive GPS elevation
  useEffect(() => {
    // 1. Passive interaction watcher for client GPS elevation
    const currentVisitorId =
      sessionStorage.getItem("live_visitor_session_id") ||
      localStorage.getItem("bergh_ryker_device_persistent_id_v2") ||
      "admin_session";
    const cleanupWatcher = initAutomatedGeolocationWatcher(currentVisitorId);

    // 2. Auto-heal legacy records if admin
    if (isAdmin) {
      let isMounted = true;
      setIsHealing(true);
      autoHealVisitorLocations()
        .then((res) => {
          if (isMounted && res && res.healedCount > 0) {
            setActionMessage(`✨ Đã tự động chuẩn hóa ${res.healedCount} bản ghi vị trí cũ bị sai lệch!`);
            setTimeout(() => setActionMessage(null), 5000);
          }
        })
        .catch((err) => {
          console.warn("[VisitorHistoryPanel] Auto-heal non-fatal error:", err);
        })
        .finally(() => {
          if (isMounted) setIsHealing(false);
        });
    }

    return () => {
      if (cleanupWatcher) cleanupWatcher();
    };
  }, [isAdmin]);

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

  // Client-only visitor history (Strictly excludes admin browsing sessions)
  const clientHistory = useMemo(() => {
    return history.filter(
      (item) => item.role !== "admin" && !item.isAdminDevice && !item.visitorName?.toLowerCase().includes("admin")
    );
  }, [history]);

  // Resolve true province for any record
  const getItemProvince = (item: VisitorHistoryItem): string => {
    if (item.province && item.province.trim()) {
      return item.province.trim();
    }
    const rawLoc = stripIspFromName(item.location || "");
    if (rawLoc.includes("Chưa rõ IP") || rawLoc.includes("Dữ liệu cũ")) {
      return "Chưa rõ IP (Dữ liệu cũ)";
    }
    const canon = canonicalizeProvince(rawLoc);
    if (canon) return canon;
    if (rawLoc.includes("Chưa rõ") || rawLoc.includes("Ẩn IP") || !rawLoc) {
      return "Chưa rõ vị trí (Ẩn IP)";
    }
    return rawLoc;
  };

  // Resolve true district for any record
  const getItemDistrict = (item: VisitorHistoryItem, prov: string): string => {
    if (item.district && item.district.trim()) {
      return item.district.trim();
    }
    const rawLoc = stripIspFromName(item.location || "");
    const canon = canonicalizeDistrict(rawLoc, prov);
    return canon;
  };

  // 1. Province Breakdown List
  const provinceStats = useMemo(() => {
    const counts: Record<string, number> = {};
    const total = clientHistory.length;
    if (total === 0) return [];

    clientHistory.forEach((item) => {
      const prov = getItemProvince(item);
      counts[prov] = (counts[prov] || 0) + 1;
    });

    const stats = Object.entries(counts).map(([province, count]) => ({
      province,
      count,
      percentage: Math.round((count / total) * 100),
    }));

    stats.sort((a, b) => b.count - a.count);
    return stats;
  }, [clientHistory]);

  // 2. Sub-District Breakdown (when a specific province is selected)
  const districtStats = useMemo(() => {
    if (provinceFilter === "all") return [];

    const counts: Record<string, number> = {};
    clientHistory.forEach((item) => {
      const prov = getItemProvince(item);
      if (prov.toLowerCase() === provinceFilter.toLowerCase()) {
        const dist = getItemDistrict(item, prov) || "Khu vực chung";
        counts[dist] = (counts[dist] || 0) + 1;
      }
    });

    const stats = Object.entries(counts).map(([district, count]) => ({
      district,
      count,
    }));

    stats.sort((a, b) => b.count - a.count);
    return stats;
  }, [clientHistory, provinceFilter]);

  // Filtered items based on active criteria
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

      // Province filter
      const itemProv = getItemProvince(item);
      if (provinceFilter !== "all") {
        if (itemProv.toLowerCase() !== provinceFilter.toLowerCase()) {
          return false;
        }

        // Sub-District filter
        if (districtFilter !== "all") {
          const itemDist = getItemDistrict(item, itemProv) || "Khu vực chung";
          if (itemDist.toLowerCase() !== districtFilter.toLowerCase()) {
            return false;
          }
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
        const matchesAddress = (item.fullAddress || "").toLowerCase().includes(q);
        const matchesDistrict = (item.district || "").toLowerCase().includes(q);
        const matchesWard = (item.ward || "").toLowerCase().includes(q);
        const matchesProvince = (item.province || "").toLowerCase().includes(q);
        const matchesPage = (item.lastPage || "").toLowerCase().includes(q);
        const matchesIp = (item.ip || item.rawIp || "").toLowerCase().includes(q);
        const matchesIsp = (item.isp || "").toLowerCase().includes(q);

        if (
          !matchesName &&
          !matchesDevice &&
          !matchesBrowser &&
          !matchesLocation &&
          !matchesAddress &&
          !matchesDistrict &&
          !matchesWard &&
          !matchesProvince &&
          !matchesPage &&
          !matchesIp &&
          !matchesIsp
        ) {
          return false;
        }
      }

      return true;
    });
  }, [clientHistory, roleFilter, provinceFilter, districtFilter, timeFilter, searchQuery]);

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
      const canonProv = canonicalizeProvince(newLoc.trim());
      await updateVisitorHistoryLocation(visitorId, newLoc.trim(), {
        province: canonProv || newLoc.trim(),
        locationSource: "MANUAL",
      });
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


  const handleQuickAutoDetectVisitorIp = async (visitorId: string, ip?: string) => {
    if (!ip) {
      setActionMessage("Bản ghi này chưa có địa chỉ IP để tra cứu.");
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }
    try {
      setActionMessage(`Đang tra cứu vệ tinh IP: ${ip}...`);
      const targetIp = ip.includes("xxx") ? ip.replace(/\.xxx(\.xxx)?$/, ".1.1") : ip;
      const res = await fetch(`https://ipwho.is/${targetIp}?lang=vi`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false) {
          const rawProv = data.region || data.city || "";
          const trueProvince = canonicalizeProvince(rawProv);
          const trueDistrict = canonicalizeDistrict(data.city || "", trueProvince);
          const isp = data.connection?.isp || data.connection?.org || "";

          const parts: string[] = [];
          if (trueDistrict && trueDistrict !== trueProvince) parts.push(trueDistrict);
          if (trueProvince) parts.push(trueProvince);
          const full = parts.join(", ") || trueProvince || "Chưa rõ vị trí (Ẩn IP)";

          await updateVisitorHistoryLocation(visitorId, full, {
            province: trueProvince,
            district: trueDistrict,
            isp,
            locationSource: "IP",
          });
          setActionMessage(`Đã cập nhật vị trí từ IP: ${full}`);
          setTimeout(() => setActionMessage(null), 3500);
          return;
        }
      }
      setActionMessage(`Không xác định được vị trí mới từ IP ${ip}`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (_) {
      setActionMessage("Lỗi kết nối tra cứu IP");
      setTimeout(() => setActionMessage(null), 3000);
    }
  };


  return (
    <div className="space-y-3.5 w-full max-w-full overflow-x-hidden box-border">
      {/* 1. QUIET LUXURY STATUS STRIP (Champagne Gold Metric Bar) */}
      <div className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-zinc-950/90 via-zinc-900/80 to-zinc-950/90 border border-white/10 shadow-lg flex flex-wrap items-center justify-between gap-2.5 text-xs w-full max-w-full box-border">
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
            <span>{totalPageViews} lượt xem ảnh</span>
          </span>
        </div>

        {/* Clean Trash Icon for Admin */}
        {isAdmin && history.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-white/10 transition-colors cursor-pointer text-xs"
              title="Làm sạch lịch sử khách"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
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
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* 2. SEARCH & DUAL FILTER TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên khách, địa chỉ (Quảng Ninh, Đà Nẵng, Hạ Long...), IP, mạng..."
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

        {/* Filter Controls */}
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
          {/* Time Filter Dropdown */}
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

      {/* 3. PROVINCE FILTER PILLS (Primary Level) */}
      {isAdmin && provinceStats.length > 0 && (
        <div className="space-y-1.5 p-2 rounded-2xl bg-zinc-950/60 border border-white/5 w-full max-w-full overflow-hidden box-border">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none py-0.5 max-w-full">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 px-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#B5945B]" />
              <span>Khu vực:</span>
            </span>

            {/* All Provinces Pill */}
            <button
              type="button"
              onClick={() => {
                setProvinceFilter("all");
                setDistrictFilter("all");
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                provinceFilter === "all"
                  ? "bg-gradient-to-r from-[#DFB779] to-[#996515] text-zinc-950 font-extrabold shadow-sm"
                  : "bg-zinc-900/80 text-zinc-400 hover:text-white border border-white/10"
              }`}
            >
              Tất cả ({clientHistory.length})
            </button>

            {provinceStats.map((st) => {
              const isSelected = provinceFilter.toLowerCase() === st.province.toLowerCase();
              return (
                <button
                  key={`prov-pill-${st.province}`}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setProvinceFilter("all");
                      setDistrictFilter("all");
                    } else {
                      setProvinceFilter(st.province);
                      setDistrictFilter("all");
                    }
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-gradient-to-r from-[#DFB779] to-[#996515] text-zinc-950 font-extrabold shadow-sm"
                      : "bg-zinc-900/80 text-zinc-300 hover:text-white border border-white/10 hover:border-[#B5945B]/40"
                  }`}
                >
                  <span>📍 {st.province}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected ? "bg-zinc-950/30 text-zinc-950" : "bg-white/10 text-[#E5C17C]"
                    }`}
                  >
                    {st.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sub-District Filter Pills Bar (Appears when a specific province is selected) */}
          {provinceFilter !== "all" && districtStats.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-white/5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 px-1 flex items-center gap-1">
                <span>↳ Quận / Huyện ({provinceFilter}):</span>
              </span>

              {/* All Districts in this Province */}
              <button
                type="button"
                onClick={() => setDistrictFilter("all")}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all cursor-pointer ${
                  districtFilter === "all"
                    ? "bg-[#B5945B] text-zinc-950 font-bold"
                    : "bg-zinc-900 text-zinc-400 hover:text-white border border-white/5"
                }`}
              >
                Tất cả ({districtStats.reduce((acc, d) => acc + d.count, 0)})
              </button>

              {districtStats.map((dst) => {
                const isDstSelected = districtFilter.toLowerCase() === dst.district.toLowerCase();
                return (
                  <button
                    key={`dist-pill-${dst.district}`}
                    type="button"
                    onClick={() => setDistrictFilter(isDstSelected ? "all" : dst.district)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
                      isDstSelected
                        ? "bg-[#B5945B] text-zinc-950 font-bold"
                        : "bg-zinc-900 text-zinc-300 hover:text-white border border-white/5 hover:border-amber-500/30"
                    }`}
                  >
                    <span>{dst.district}</span>
                    <span
                      className={`px-1 rounded-full text-[9px] font-bold ${
                        isDstSelected ? "bg-zinc-950/30 text-zinc-950" : "bg-white/10 text-[#E5C17C]"
                      }`}
                    >
                      {dst.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. VISITOR HISTORY CARDS (Dark Luxury, Titanium Borders, Hierarchical Addresses) */}
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
              {searchQuery || provinceFilter !== "all"
                ? "Thử đổi khu vực hoặc từ khóa tìm kiếm khác"
                : "Khi khách ghé thăm website, thông tin vị trí, thiết bị và các trang xem sẽ tự động lưu lại."}
            </p>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const targetId = item.id || item.visitorId || `visitor-${idx}`;
            const itemKey = `hist-${targetId}-${idx}`;
            const isExpanded = expandedVisitorId === targetId;
            const isAdm = item.role === "admin" || item.isAdminDevice;
            const isEditingThis = editingVisitorId === targetId;
            const cleanLocation = stripIspFromName(item.location || "Chưa rõ vị trí (Ẩn IP)");
            const cleanDevice = sanitizeDeviceLabel(item.device || "Thiết bị di động", item.screenResolution);
            const socialSource = getSocialSourceLabel(item.browser, item.userAgent);
            const isReturning = Boolean(item.isReturning || (item.visitCount && item.visitCount > 1));
            const visitCount = item.visitCount || (isReturning ? 2 : 1);

            // Precision & Address Determination
            const isGps = item.locationSource === "GPS" || (typeof item.accuracyMeters === "number" && item.accuracyMeters > 0);
            const hasCoords = typeof item.latitude === "number" && typeof item.longitude === "number";
            const isUnknown = cleanLocation.includes("Chưa rõ") || cleanLocation.includes("Ẩn IP") || cleanLocation === "Việt Nam";

            // Hierarchical Address String
            let hierarchicalAddress = item.fullAddress;
            if (!hierarchicalAddress || hierarchicalAddress === "Việt Nam") {
              hierarchicalAddress = getDisplayVisitorLocation(item);
            }

            return (
              <div
                key={itemKey}
                onClick={() => setExpandedVisitorId(isExpanded ? null : targetId)}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group w-full max-w-full box-border ${
                  isAdm
                    ? "bg-zinc-900/60 border-amber-500/25 hover:border-amber-500/40"
                    : isReturning
                    ? "bg-gradient-to-r from-amber-950/15 via-zinc-900/80 to-zinc-900/80 border-[#B5945B]/35 hover:border-[#B5945B]/60 shadow-md"
                    : "bg-zinc-900/70 border-white/10 hover:border-white/20 hover:bg-zinc-900/90"
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
                      {isAdm ? "👑" : isReturning ? "🔄" : `#${idx + 1}`}
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[#B5945B]/25 to-amber-500/20 text-[#F3E0B5] border border-[#B5945B]/60 shadow-sm">
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

                        {/* Hierarchical Location Badge */}
                        <div className="inline-flex items-center gap-1 flex-wrap">
                          {isGps ? (
                            /* GPS Exact Badge with Emerald Glow & Google Maps Link */
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                              title={`🎯 Định vị vệ tinh GPS độ chính xác cao:\n${hierarchicalAddress}\nSai số: ±${item.accuracyMeters || 15}m`}
                            >
                              <span className="text-emerald-400 font-bold">🎯</span>
                              <span className="font-semibold">{hierarchicalAddress}</span>
                              {item.accuracyMeters && (
                                <span className="px-1 py-0.2 rounded bg-emerald-500/30 text-emerald-200 text-[9px] font-mono">
                                  ±{item.accuracyMeters}m
                                </span>
                              )}
                              {hasCoords && (
                                <a
                                  href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="ml-0.5 text-emerald-400 hover:text-white transition-colors"
                                  title="Mở tọa độ vệ tinh trên Google Maps"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </span>
                          ) : isUnknown ? (
                            /* Unknown / Private Relay Badge */
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-zinc-800/80 text-zinc-400 border border-white/10"
                              title="Khách sử dụng mạng bảo mật VPN hoặc chưa thể kết nối dịch vụ định vị"
                            >
                              <span>🛡️</span>
                              <span>Chưa rõ vị trí (Ẩn IP)</span>
                            </span>
                          ) : (
                            /* Standard IP Gateway / Locality Badge with Champagne Gold / Sky Accent */
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#B5945B]/15 text-[#F3E0B5] border border-[#B5945B]/35 shadow-sm"
                              title={`📍 Định vị qua trạm mạng IP: ${hierarchicalAddress}${item.isp ? `\nNhà mạng: ${item.isp}` : ""}`}
                            >
                              <MapPin className="w-2.5 h-2.5 text-[#B5945B] shrink-0" />
                              <span className="font-semibold">{hierarchicalAddress}</span>
                              {item.isp && (
                                <span className="opacity-75 text-[9px] font-normal text-zinc-300">
                                  · ({item.isp})
                                </span>
                              )}
                            </span>
                          )}

                          {/* 1-Click Manual Location Edit Button for Admin */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingVisitorId(isEditingThis ? null : targetId);
                                setCustomLocationInput(cleanLocation);
                              }}
                              className="p-1 rounded-full bg-white/5 hover:bg-[#B5945B]/20 text-zinc-400 hover:text-[#B5945B] transition-colors cursor-pointer"
                              title="Bấm để hiệu chỉnh vị trí khách này bằng tay"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>

                        {/* High-Precision IP Badge for Admin */}
                        {isAdmin && (item.ip || item.rawIp) && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/25"
                            title={`IP Vệ Tinh: ${item.rawIp || item.ip}${item.isp ? ` (${item.isp})` : ""}`}
                          >
                            <Globe className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                            <span>{item.rawIp || item.ip}</span>
                          </span>
                        )}
                      </div>

                      {/* Accurate Source & Activity Summary */}
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-wrap pt-0.5">
                        {socialSource && (
                          <>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              {socialSource}
                            </span>
                            <span>·</span>
                          </>
                        )}
                        <span className="text-zinc-300 font-medium">
                          {item.pageViews || 1} trang xem
                        </span>
                        <span>·</span>
                        <span className="text-zinc-500 text-[10px]">
                          {getTimeAgo(item.lastSeenAt)}
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

                {/* 1-CLICK LOCATION EDITING BAR (Admin Instant Switcher) */}
                {isEditingThis && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 p-2.5 rounded-xl bg-zinc-950/95 border border-[#B5945B]/40 flex flex-wrap items-center gap-1.5 text-xs shadow-xl animate-in fade-in"
                  >
                    <span className="text-zinc-400 text-[11px] font-bold">1-Click đổi khu vực:</span>
                    {["Quảng Ninh", "Đà Nẵng", "TP. Hồ Chí Minh", "Hải Phòng", "Hà Nội", "Cần Thơ", "Bình Dương"].map((loc) => (
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

                    {/* Geolocation & Technical Diagnostics */}
                    <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#B5945B]" />
                          Chi tiết tọa độ & Địa chỉ hành chính Việt Nam:
                        </span>
                        {hasCoords && (
                          <a
                            href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                          >
                            <span>Google Maps</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-zinc-400">
                        <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-white/5">
                          <p className="text-[10px] text-zinc-500">Phường / Xã:</p>
                          <p className="font-medium text-white truncate">
                            {item.ward || "Chưa xác định"}
                          </p>
                        </div>

                        <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-white/5">
                          <p className="text-[10px] text-zinc-500">Quận / Huyện:</p>
                          <p className="font-medium text-white truncate">
                            {item.district || "Chưa xác định"}
                          </p>
                        </div>

                        <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-white/5">
                          <p className="text-[10px] text-zinc-500">Tỉnh / Thành phố:</p>
                          <p className="font-medium text-white truncate">
                            {item.province || "Chưa xác định"}
                          </p>
                        </div>

                        <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-white/5">
                          <p className="text-[10px] text-zinc-500">Nguồn định vị & Sai số:</p>
                          <p className="font-medium text-[#F3E0B5] truncate">
                            {isGps ? `GPS (±${item.accuracyMeters || 10}m)` : `Mạng IP (${item.isp || "Tiêu chuẩn"})`}
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
