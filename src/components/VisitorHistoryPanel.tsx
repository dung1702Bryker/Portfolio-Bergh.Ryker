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
  TrendingUp,
  SlidersHorizontal,
  Edit3,
  Check,
  X,
  RotateCcw,
  Star,
  HardDrive,
} from "lucide-react";
import {
  VisitorHistoryItem,
  subscribeToVisitorHistory,
  deleteVisitorHistoryItem,
  clearAllVisitorHistory,
  updateVisitorHistoryLocation,
  sanitizeDeviceLabel,
} from "../services/visitorHistoryService";
import { stripIspFromName, resolveProvinceFromCoords, reverseGeocodeCoords } from "../services/geoService";

interface VisitorHistoryPanelProps {
  isAdmin?: boolean;
}

export const VisitorHistoryPanel: React.FC<VisitorHistoryPanelProps> = ({ isAdmin = false }) => {
  const [history, setHistory] = useState<VisitorHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "returning" | "new" | "visitors" | "admins">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "3days" | "7days">("all");
  const [expandedVisitorId, setExpandedVisitorId] = useState<string | null>(null);
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);
  const [customLocationInput, setCustomLocationInput] = useState<string>("");
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  // Format full clear date & time: "14:35:10 • Thứ Hai, 29/09/2026"
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

      const daysOfWeek = ["CN", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
      const dayName = daysOfWeek[d.getDay()];

      return `${hours}:${mins}:${secs} • ${dayName}, ${day}/${month}/${year}`;
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
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
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
      if (diffSecs < 60) return `${diffSecs} giây`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins} phút`;
      const diffHours = Math.floor(diffMins / 60);
      const remMins = diffMins % 60;
      return `${diffHours} giờ ${remMins > 0 ? `${remMins} phút` : ""}`;
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
      return <Smartphone className="w-4 h-4 text-amber-400" />;
    }
    return <Laptop className="w-4 h-4 text-sky-400" />;
  };

  const getRegionBadgeStyle = (loc = "") => {
    const clean = stripIspFromName(loc).toLowerCase();
    if (clean.includes("quảng ninh") || clean.includes("hạ long") || clean.includes("cẩm phả") || clean.includes("uông bí")) {
      return "bg-[#B5945B]/20 text-[#B5945B] border-[#B5945B]/40 font-bold";
    }
    if (clean.includes("hà nội")) {
      return "bg-sky-500/15 text-sky-300 border-sky-500/30 font-semibold";
    }
    if (clean.includes("hải phòng")) {
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold";
    }
    if (clean.includes("hồ chí minh") || clean.includes("sài gòn")) {
      return "bg-orange-500/15 text-orange-300 border-orange-500/30 font-semibold";
    }
    return "bg-zinc-800 text-zinc-300 border-white/10";
  };

  // Regional breakdown calculation for Admin
  const regionalStats = useMemo(() => {
    const guests = history.filter((h) => h.role !== "admin" && !h.isAdminDevice);
    const total = guests.length;
    if (total === 0) return [];

    const map = new Map<string, number>();
    for (const g of guests) {
      const rawLoc = stripIspFromName(g.location || "Chưa rõ");
      let locName = rawLoc;
      if (locName.toLowerCase().includes("quảng ninh") || locName.toLowerCase().includes("hạ long")) {
        locName = "Quảng Ninh";
      } else if (locName.toLowerCase().includes("hà nội")) {
        locName = "Hà Nội";
      } else if (locName.toLowerCase().includes("hải phòng")) {
        locName = "Hải Phòng";
      } else if (locName.toLowerCase().includes("hồ chí minh") || locName.toLowerCase().includes("sài gòn")) {
        locName = "TP. Hồ Chí Minh";
      }
      map.set(locName, (map.get(locName) || 0) + 1);
    }

    const list: Array<{ region: string; count: number; percentage: number }> = [];
    map.forEach((count, region) => {
      list.push({
        region,
        count,
        percentage: Math.round((count / total) * 100),
      });
    });

    // Prioritize Studio's key regions: Quảng Ninh & Hà Nội first, then highest counts
    list.sort((a, b) => {
      if (a.region === "Quảng Ninh") return -1;
      if (b.region === "Quảng Ninh") return 1;
      if (a.region === "Hà Nội") return -1;
      if (b.region === "Hà Nội") return 1;
      return b.count - a.count;
    });

    return list;
  }, [history]);

  // Filtered items
  const filteredItems = useMemo(() => {
    const now = Date.now();

    return history.filter((item) => {
      // Role & Returning filter
      if (roleFilter === "returning") {
        if (item.role === "admin" || item.isAdminDevice || (!item.isReturning && (!item.visitCount || item.visitCount <= 1))) {
          return false;
        }
      }
      if (roleFilter === "new") {
        if (item.role === "admin" || item.isAdminDevice || item.isReturning || (item.visitCount && item.visitCount > 1)) {
          return false;
        }
      }
      if (roleFilter === "visitors" && (item.role === "admin" || item.isAdminDevice)) {
        return false;
      }
      if (roleFilter === "admins" && item.role !== "admin" && !item.isAdminDevice) {
        return false;
      }

      // Region filter
      if (regionFilter !== "all") {
        const itemLoc = stripIspFromName(item.location || "").toLowerCase();
        const target = regionFilter.toLowerCase();
        if (!itemLoc.includes(target)) {
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
        const matchesDevice = item.device.toLowerCase().includes(q);
        const matchesBrowser = item.browser.toLowerCase().includes(q);
        const matchesLocation = (item.location || "").toLowerCase().includes(q);
        const matchesPage = (item.lastPage || "").toLowerCase().includes(q);
        const matchesEntry = (item.entryPage || "").toLowerCase().includes(q);
        const matchesVisited = (item.visitedPages || []).some((p) => p.toLowerCase().includes(q));
        if (
          !matchesName &&
          !matchesDevice &&
          !matchesBrowser &&
          !matchesLocation &&
          !matchesPage &&
          !matchesEntry &&
          !matchesVisited
        ) {
          return false;
        }
      }

      return true;
    });
  }, [history, roleFilter, regionFilter, timeFilter, searchQuery]);

  const guestCount = useMemo(() => {
    return history.filter((h) => h.role !== "admin" && !h.isAdminDevice).length;
  }, [history]);

  const adminCount = useMemo(() => {
    return history.filter((h) => h.role === "admin" || h.isAdminDevice).length;
  }, [history]);

  const returningGuestCount = useMemo(() => {
    return history.filter(
      (h) => h.role !== "admin" && !h.isAdminDevice && (h.isReturning || (h.visitCount && h.visitCount > 1))
    ).length;
  }, [history]);

  const newGuestCount = useMemo(() => {
    return history.filter(
      (h) => h.role !== "admin" && !h.isAdminDevice && !h.isReturning && (!h.visitCount || h.visitCount <= 1)
    ).length;
  }, [history]);

  const totalPageViews = useMemo(() => {
    return history.reduce((sum, h) => sum + (h.pageViews || 1), 0);
  }, [history]);

  const handleDeleteItem = async (e: React.MouseEvent, visitorId: string) => {
    e.stopPropagation();
    try {
      await deleteVisitorHistoryItem(visitorId);
      setActionMessage("Đã xóa 1 bản ghi lịch sử khách.");
      setTimeout(() => setActionMessage(null), 3500);
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
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err) {
      console.error(err);
    }
  };

  const [isCalibratingGps, setIsCalibratingGps] = useState(false);

  const handleVipCalibratePhanTayNhac = async () => {
    const targetLoc = "Phan Tây Nhạc, Nam Từ Liêm, Hà Nội";
    const targetDevice = "iPhone 15 Pro Max";

    try {
      sessionStorage.setItem("visitor_location", targetLoc);
      sessionStorage.setItem("visitor_calibrated_location", targetLoc);
      localStorage.setItem("visitor_calibrated_location", targetLoc);
      sessionStorage.setItem("visitor_detailed_location_v7", targetLoc);
    } catch (_) {}

    // Find own record in history to calibrate
    const ownVisitorId = sessionStorage.getItem("live_visitor_session_id") || "";
    const devId = localStorage.getItem("bergh_ryker_device_persistent_id_v2") || "";
    const target = history.find(
      (h) =>
        h.visitorId === ownVisitorId ||
        (devId && h.deviceId === devId) ||
        h.role === "admin" ||
        h.location?.includes("Long Biên") ||
        h.device?.includes("16")
    );
    if (target) {
      await updateVisitorHistoryLocation(target.id, targetLoc);
    }

    try {
      await fetch("/api/presence/calibrate-vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: ownVisitorId,
          deviceId: devId,
        }),
      });
    } catch (_) {}

    setActionMessage(`🎯 Đã chuẩn hoá vị trí & thiết bị: ${targetLoc} • ${targetDevice}`);
    setTimeout(() => setActionMessage(null), 4500);
  };

  const handleGpsCalibrateCurrentDevice = async () => {
    if (typeof window === "undefined" || !navigator?.geolocation) {
      setActionMessage("Trình duyệt hoặc thiết bị này không hỗ trợ Geolocation.");
      setTimeout(() => setActionMessage(null), 3500);
      return;
    }

    setIsCalibratingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let prov = await reverseGeocodeCoords(lat, lon);
        if (!prov || prov === "Việt Nam") {
          prov = resolveProvinceFromCoords(lat, lon) || "Hà Nội";
        }

        try {
          sessionStorage.setItem("visitor_location", prov);
          sessionStorage.setItem("visitor_calibrated_location", prov);
          sessionStorage.setItem("visitor_detailed_location_v7", prov);
        } catch (_) {}

        // Find own record in history to calibrate
        const ownVisitorId = sessionStorage.getItem("live_visitor_session_id") || "";
        const devId = localStorage.getItem("bergh_ryker_device_persistent_id_v2") || "";
        const target = history.find((h) => h.visitorId === ownVisitorId || (devId && h.deviceId === devId) || h.role === "admin");
        if (target) {
          await updateVisitorHistoryLocation(target.id, prov);
        }

        try {
          await fetch("/api/presence/calibrate-vip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              visitorId: ownVisitorId,
              deviceId: devId,
              newLocation: prov,
            }),
          });
        } catch (_) {}

        setIsCalibratingGps(false);
        setActionMessage(`🎯 Định vị GPS thời gian thực: ${prov}`);
        setTimeout(() => setActionMessage(null), 4000);
      },
      (err) => {
        setIsCalibratingGps(false);
        setActionMessage(`Không thể lấy GPS: ${err.message || "Vui lòng cho phép quyền vị trí"}`);
        setTimeout(() => setActionMessage(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllVisitorHistory();
      setShowClearConfirm(false);
      setActionMessage("Đã làm sạch toàn bộ lịch sử khách xem.");
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-md flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#B5945B]/15 text-[#B5945B] border border-[#B5945B]/30 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-medium uppercase tracking-wide truncate">
              Tổng Khách Đã Xem
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-white">
              {guestCount} <span className="text-xs text-zinc-400 font-normal">khách</span>
            </p>
          </div>
        </div>

        {/* RETURNING VISITORS KPI CARD */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/30 via-zinc-900/90 to-zinc-900/80 border border-[#B5945B]/35 shadow-md flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-[#E5C17C] border border-[#B5945B]/40 flex items-center justify-center shrink-0">
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] text-amber-300/80 font-medium uppercase tracking-wide truncate">
              Thiết Bị Xem Lại
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-[#F3E0B5]">
              {returningGuestCount}{" "}
              <span className="text-[11px] text-amber-400/80 font-normal">
                ({guestCount > 0 ? Math.round((returningGuestCount / guestCount) * 100) : 0}%)
              </span>
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-md flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-medium uppercase tracking-wide truncate">
              Tổng Lượt Xem Trang
            </p>
            <p className="text-lg sm:text-xl font-extrabold text-white">
              {totalPageViews} <span className="text-xs text-zinc-400 font-normal">lượt</span>
            </p>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-md flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] text-zinc-400 font-medium uppercase tracking-wide truncate">
              Gần Đây Nhất
            </p>
            <p className="text-xs sm:text-sm font-bold text-emerald-400 truncate">
              {history.length > 0 ? getTimeAgo(history[0].lastSeenAt) : "Chưa có"}
            </p>
          </div>
        </div>
      </div>

      {/* REGIONAL ANALYTICS BREAKDOWN: Kiểm soát lượng khách theo khu vực */}
      {isAdmin && regionalStats.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 border border-white/10 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#B5945B]/20 text-[#B5945B] border border-[#B5945B]/30 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Kiểm Soát Lượng Khách Hàng Theo Khu Vực
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Phân bố khách xem portfolio theo từng tỉnh thành (Hà Nội, Quảng Ninh...)
                </p>
              </div>
            </div>

            {regionFilter !== "all" && (
              <button
                onClick={() => setRegionFilter("all")}
                className="text-[11px] text-[#B5945B] hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <X className="w-3 h-3" />
                Bỏ lọc khu vực ({regionFilter})
              </button>
            )}
          </div>

          {/* Region Badges Grid with Counts & Percentages */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            {regionalStats.map((st) => {
              const isSelected = regionFilter.toLowerCase() === st.region.toLowerCase();
              const isQN = st.region.toLowerCase().includes("quảng ninh");
              const isHN = st.region.toLowerCase().includes("hà nội");

              return (
                <button
                  key={`reg-${st.region}`}
                  type="button"
                  onClick={() => setRegionFilter(isSelected ? "all" : st.region)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? "bg-[#B5945B] text-zinc-950 border-[#B5945B] font-bold shadow-md scale-[1.02]"
                      : isQN
                      ? "bg-[#B5945B]/10 hover:bg-[#B5945B]/20 border-[#B5945B]/30 text-white"
                      : isHN
                      ? "bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-white"
                      : "bg-zinc-800/60 hover:bg-zinc-800 border-white/10 text-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="truncate flex items-center gap-1">
                      <span>📍</span>
                      <span>{st.region}</span>
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected ? "bg-zinc-950/30 text-zinc-950 font-extrabold" : "bg-white/10 text-zinc-300"
                      }`}
                    >
                      {st.percentage}%
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className={isSelected ? "text-zinc-950 font-semibold" : "text-zinc-400"}>
                      {st.count} khách xem
                    </span>
                    {isSelected && (
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-zinc-950">
                        Đang lọc
                      </span>
                    )}
                  </div>

                  {/* Tiny progress bar */}
                  <div className="w-full h-1 bg-black/20 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        isSelected ? "bg-zinc-950" : isQN ? "bg-[#B5945B]" : isHN ? "bg-sky-400" : "bg-zinc-400"
                      }`}
                      style={{ width: `${Math.max(8, st.percentage)}%` }}
                    />
                  </div>
                </button>
              );
            })}
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

      {/* Confirmation Dialog for Clear All */}
      {showClearConfirm && (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Xác nhận xóa toàn bộ lịch sử khách xem đã lưu?</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
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

      {/* Search and Filters Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên khách, khu vực (Quảng Ninh, Hà Nội), thiết bị..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B5945B]"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
            {/* Time Filter */}
            <div className="flex items-center rounded-xl bg-zinc-900 p-1 border border-white/10 text-xs">
              <button
                onClick={() => setTimeFilter("all")}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] ${
                  timeFilter === "all" ? "bg-white/15 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                Mọi lúc
              </button>
              <button
                onClick={() => setTimeFilter("today")}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] ${
                  timeFilter === "today" ? "bg-white/15 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                Hôm nay
              </button>
              <button
                onClick={() => setTimeFilter("3days")}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] ${
                  timeFilter === "3days" ? "bg-white/15 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                3 ngày
              </button>
              <button
                onClick={() => setTimeFilter("7days")}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] ${
                  timeFilter === "7days" ? "bg-white/15 text-white font-bold" : "text-zinc-400 hover:text-white"
                }`}
              >
                7 ngày
              </button>
            </div>

            {/* Role & Returning Filter Tabs */}
            <div className="flex items-center rounded-xl bg-zinc-900 p-1 border border-white/10 text-xs flex-wrap gap-0.5">
              <button
                onClick={() => setRoleFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] ${
                  roleFilter === "all"
                    ? "bg-[#B5945B] text-zinc-950 font-bold shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Tất cả ({history.length})
              </button>
              <button
                onClick={() => setRoleFilter("returning")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] flex items-center gap-1 ${
                  roleFilter === "returning"
                    ? "bg-[#B5945B] text-zinc-950 font-bold shadow"
                    : "text-amber-400 hover:text-amber-300"
                }`}
                title="Lọc thiết bị đã từng vào xem lại"
              >
                <span>🔄 Xem lại</span>
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-black/30 font-bold">{returningGuestCount}</span>
              </button>
              <button
                onClick={() => setRoleFilter("new")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] flex items-center gap-1 ${
                  roleFilter === "new"
                    ? "bg-cyan-500 text-zinc-950 font-bold shadow"
                    : "text-cyan-400 hover:text-cyan-300"
                }`}
                title="Lọc khách truy cập lần đầu"
              >
                <span>⭐ Mới</span>
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-black/30 font-bold">{newGuestCount}</span>
              </button>
              <button
                onClick={() => setRoleFilter("admins")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium text-[11px] ${
                  roleFilter === "admins"
                    ? "bg-purple-600 text-white font-bold shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Admin 👑 ({adminCount})
              </button>
            </div>

            {/* GPS Calibration & Clear History Buttons for Admin */}
            {isAdmin && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleVipCalibratePhanTayNhac}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-[#F3E0B5] hover:text-white border border-[#B5945B]/50 transition-all cursor-pointer text-[11px] font-bold flex items-center gap-1.5 shadow-sm"
                  title="Khoá chuẩn xác vị trí Phan Tây Nhạc, Nam Từ Liêm, Hà Nội và thiết bị iPhone 15 Pro Max"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#E5C17C]" />
                  <span>🎯 Phan Tây Nhạc (15 Pro Max)</span>
                </button>

                <button
                  type="button"
                  onClick={handleGpsCalibrateCurrentDevice}
                  disabled={isCalibratingGps}
                  className="px-2.5 py-1.5 rounded-xl bg-[#B5945B]/15 hover:bg-[#B5945B]/30 text-[#E5C17C] hover:text-white border border-[#B5945B]/40 transition-all cursor-pointer text-[11px] font-semibold flex items-center gap-1.5"
                  title="Lấy toạ độ GPS độ chính xác cao của thiết bị hiện tại để đối chiếu & hiệu chỉnh"
                >
                  <Compass className={`w-3.5 h-3.5 ${isCalibratingGps ? "animate-spin text-[#B5945B]" : ""}`} />
                  <span className="hidden sm:inline">{isCalibratingGps ? "Đang dò GPS..." : "GPS máy này"}</span>
                </button>

                {history.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-white/10 hover:border-red-500/30 transition-all cursor-pointer text-xs"
                    title="Dọn dẹp làm sạch toàn bộ lịch sử khách xem"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Items List - Flows naturally in the parent dashboard scroll container */}
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
                : "Khi có khách ghé thăm website, thông tin khu vực, thiết bị và các trang họ xem sẽ tự động lưu lại tại đây."}
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

            return (
              <div
                key={itemKey}
                onClick={() => setExpandedVisitorId(isExpanded ? null : targetId)}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                  isAdm
                    ? "bg-zinc-900/60 border-amber-500/25 hover:border-amber-500/40"
                    : "bg-zinc-900/90 border-white/10 hover:border-[#B5945B]/40 hover:bg-zinc-900 shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Device Icon Avatar */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-md ${
                        isAdm
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-zinc-800 text-zinc-300 border border-white/10 group-hover:border-[#B5945B]/40"
                      }`}
                    >
                      {getDeviceIcon(cleanDevice)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h4 className="font-bold text-white text-sm tracking-tight truncate">
                          {item.visitorName}
                        </h4>

                        {isAdm ? (
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Quản Trị Viên
                          </span>
                        ) : item.isReturning || (item.visitCount && item.visitCount > 1) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[#B5945B]/25 to-amber-500/20 text-[#F3E0B5] border border-[#B5945B]/60 shadow-[0_1px_8px_rgba(212,175,55,0.2)]">
                            <RotateCcw className="w-2.5 h-2.5 text-[#E5C17C] stroke-[2.5]" />
                            <span>Thiết bị xem lại (Lần {item.visitCount || 2})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <Star className="w-2.5 h-2.5" />
                            <span>Khách mới</span>
                          </span>
                        )}

                        {/* Location Badge (High-visibility for Admin) */}
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <span
                              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border ${getRegionBadgeStyle(
                                cleanLocation
                              )}`}
                              title="Khu vực khách hàng xem"
                            >
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>{cleanLocation}</span>
                            </span>

                            {/* Quick Location Calibrate Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingVisitorId(isEditingThis ? null : targetId);
                                setCustomLocationInput(cleanLocation);
                              }}
                              className="p-1 rounded-md bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white text-[10px] border border-white/5 cursor-pointer"
                              title="Hiệu chỉnh/gán khu vực cho khách này"
                            >
                              <Edit3 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}

                        <span className="text-[11px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                          {item.pageViews || 1} trang đã xem
                        </span>
                      </div>

                      {/* Quick Location Calibration Editor */}
                      {isEditingThis && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mb-2 p-2 rounded-xl bg-zinc-950 border border-[#B5945B]/40 flex flex-wrap items-center gap-2 text-xs"
                        >
                          <span className="text-zinc-400 text-[11px]">Đổi vị trí:</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateLocation(targetId, "Phan Tây Nhạc, Nam Từ Liêm, Hà Nội")}
                            className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-zinc-950 font-bold transition-all"
                            title="Gán vị trí: Phan Tây Nhạc, Nam Từ Liêm, Hà Nội"
                          >
                            🎯 Phan Tây Nhạc
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLocation(targetId, "Hà Nội")}
                            className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500 hover:text-white font-bold transition-all"
                          >
                            Hà Nội
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLocation(targetId, "Quảng Ninh")}
                            className="px-2 py-0.5 rounded bg-[#B5945B]/20 text-[#B5945B] border border-[#B5945B]/40 hover:bg-[#B5945B] hover:text-zinc-950 font-bold transition-all"
                          >
                            Quảng Ninh
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLocation(targetId, "Hải Phòng")}
                            className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-white font-bold transition-all"
                          >
                            Hải Phòng
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLocation(targetId, "TP. Hồ Chí Minh")}
                            className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500 hover:text-white font-bold transition-all"
                          >
                            TP. HCM
                          </button>
                          <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                            <input
                              type="text"
                              value={customLocationInput}
                              onChange={(e) => setCustomLocationInput(e.target.value)}
                              placeholder="Tỉnh/thành khác..."
                              className="w-full bg-zinc-900 border border-white/15 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateLocation(targetId, customLocationInput)}
                              className="p-1 rounded bg-[#B5945B] text-zinc-950 font-bold"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Device & Browser Specs */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mb-2">
                        <span className="flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/5 text-zinc-300 font-medium">
                          📱 {cleanDevice}
                        </span>
                        <span className="flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/5">
                          🌐 {item.browser}
                        </span>
                        {item.screenResolution && (
                          <span className="flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/5 text-zinc-400 text-[11px]">
                            🖥️ {item.screenResolution}
                          </span>
                        )}
                        {item.deviceId && (
                          <span
                            className="flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded-md border border-white/10 text-amber-300/80 text-[10px] font-mono"
                            title={`Mã phần cứng thiết bị: ${item.deviceId}`}
                          >
                            🆔 {item.deviceId.length > 20 ? `${item.deviceId.substring(0, 18)}...` : item.deviceId}
                          </span>
                        )}
                        <span className="flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/5 text-[11px]">
                          ⏱️ Thời gian xem:{" "}
                          <strong className="text-zinc-200">
                            {formatVisitDuration(item.firstSeenAt, item.lastSeenAt)}
                          </strong>
                        </span>
                      </div>

                      {/* Last viewed page & detail */}
                      <div className="text-xs text-zinc-300 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                        <div className="flex items-center gap-1 truncate">
                          <Compass className="w-3.5 h-3.5 text-[#B5945B] shrink-0" />
                          <span className="text-zinc-400">Vừa xem:</span>
                          <strong className="text-white truncate">
                            {item.lastPage || "Trang chủ Portfolio"}
                          </strong>
                        </div>

                        {item.entryPage && item.entryPage !== item.lastPage && (
                          <div className="flex items-center gap-1 text-zinc-400 truncate text-[11px]">
                            <span>(Vào từ: {item.entryPage})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Detailed Timestamps & Action */}
                  <div className="flex flex-col items-end justify-between shrink-0 gap-1.5 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-white font-mono">
                        {formatShortTime(item.lastSeenAt)}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {getTimeAgo(item.lastSeenAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-1">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteItem(e, targetId)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 border border-white/5 hover:border-red-500/30 transition-all cursor-pointer"
                          title="Xóa bản ghi này"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      <div className="p-1 rounded-lg text-zinc-500 group-hover:text-zinc-300">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Accurate Timestamps & History Log */}
                {isExpanded && (
                  <div className="mt-3.5 pt-3 border-t border-white/10 text-xs space-y-3 bg-black/30 -mx-3.5 sm:-mx-4 -mb-3.5 sm:-mb-4 p-3.5 sm:p-4 rounded-b-2xl">
                    {/* Timestamp & Device Identity Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-zinc-300 bg-zinc-950/60 p-2.5 rounded-xl border border-white/5">
                      <div className="flex items-start gap-2">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase text-zinc-400 font-medium">
                            Lần Đầu Ghé Thăm:
                          </p>
                          <p className="font-mono text-white text-[11px] font-semibold">
                            {formatFullDateTime(item.firstSeenAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase text-zinc-400 font-medium">
                            Hoạt Động Gần Nhất:
                          </p>
                          <p className="font-mono text-white text-[11px] font-semibold">
                            {formatFullDateTime(item.lastSeenAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <RotateCcw className="w-3.5 h-3.5 text-[#B5945B] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase text-zinc-400 font-medium">
                            Số Lần Truy Cập:
                          </p>
                          <p className="font-mono text-[#F3E0B5] text-[11px] font-bold">
                            {item.visitCount || (item.isReturning ? 2 : 1)} lần ghé thăm
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Visited Pages Breakdown */}
                    <div>
                      <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                        <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                          <Layers className="w-3.5 h-3.5 text-[#B5945B]" />
                          Hành trình các trang đã lướt xem ({item.visitedPages?.length || 1}):
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {(item.visitedPages || [item.lastPage || "Trang chủ Portfolio"]).map((p, pIdx) => (
                          <span
                            key={`page-${targetId}-${idx}-${pIdx}`}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-200 border border-white/10 text-[11px] flex items-center gap-1"
                          >
                            <span>📍</span>
                            <span>{p}</span>
                          </span>
                        ))}
                      </div>

                      {item.lastViewDetail && (
                        <p className="text-zinc-400 text-[11px] italic pt-2">
                          Chi tiết tương tác gần nhất: "{item.lastViewDetail}"
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
