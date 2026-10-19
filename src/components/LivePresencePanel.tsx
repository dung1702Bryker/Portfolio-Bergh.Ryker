import React, { useState, useMemo } from "react";
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
  MapPin,
  CheckCircle2,
  RotateCcw,
  Star,
  ChevronRight,
  Filter,
  Navigation,
  Check,
  ChevronDown,
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle,
  Gauge,
} from "lucide-react";
import { ActiveVisitor } from "../types/presence";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useLivePresenceContext } from "../context/LivePresenceContext";
import { stripIspFromName } from "../services/geoService";
import { sanitizeDeviceLabel, updateVisitorHistoryLocation } from "../services/visitorHistoryService";

interface LivePresencePanelProps {
  activeVisitors: ActiveVisitor[];
  activeCount: number;
  currentVisitorId?: string;
}

export const LivePresencePanel: React.FC<LivePresencePanelProps> = ({
  activeVisitors,
  activeCount,
  currentVisitorId,
}) => {
  const { isAdmin } = useAdminAuth();
  const { visitorLocation, calibrateGpsLocation, setCustomLocation, resetToAutoLocation } = useLivePresenceContext();
  const [filterType, setFilterType] = useState<"all" | "returning" | "new">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [showLocationPopover, setShowLocationPopover] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);
  const [customLocInput, setCustomLocInput] = useState<string>("");

  const handleUpdateVisitorLocation = async (vId: string, newLoc: string) => {
    if (!newLoc) return;
    const clean = stripIspFromName(newLoc);
    try {
      await updateVisitorHistoryLocation(vId, clean);
      setFeedbackMsg(`Đã hiệu chỉnh vị trí: ${clean}`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      setEditingVisitorId(null);
    } catch (_) {
      setFeedbackMsg("Lỗi khi hiệu chỉnh vị trí.");
      setTimeout(() => setFeedbackMsg(null), 2500);
    }
  };

  const mobileCount = useMemo(() => {
    return activeVisitors.filter(
      (v) =>
        v.device.includes("Phone") ||
        v.device.includes("Android") ||
        v.device.includes("iOS") ||
        v.device.includes("Mobile")
    ).length;
  }, [activeVisitors]);

  const desktopCount = useMemo(() => {
    return Math.max(0, activeVisitors.length - mobileCount);
  }, [activeVisitors, mobileCount]);

  const returningCount = useMemo(() => {
    return activeVisitors.filter(
      (v) => v.role !== "admin" && (v.isReturning || (v.visitCount && v.visitCount > 1))
    ).length;
  }, [activeVisitors]);

  const newVisitorCount = useMemo(() => {
    return activeVisitors.filter(
      (v) => v.role !== "admin" && !v.isReturning && (!v.visitCount || v.visitCount <= 1)
    ).length;
  }, [activeVisitors]);

  // Network connectivity metrics breakdown
  const networkStats = useMemo(() => {
    let wifi = 0;
    let cellular5g = 0;
    let cellular4g = 0;
    let slowBottleneck = 0;

    activeVisitors.forEach((v) => {
      const conn = (v.connectionType || "").toLowerCase();
      const eff = (v.effectiveType || "").toLowerCase();
      const dl = v.downlink;
      const rtt = v.rtt;

      if (conn.includes("5g")) {
        cellular5g++;
      } else if (conn.includes("wifi") || conn.includes("wi-fi") || (!conn && !eff)) {
        wifi++;
      } else if (conn.includes("4g") || eff === "4g") {
        cellular4g++;
      }

      if (eff === "3g" || eff === "2g" || eff === "slow-2g" || (dl !== undefined && dl < 1.5) || (rtt !== undefined && rtt > 400) || v.saveData) {
        slowBottleneck++;
      }
    });

    return { wifi, cellular5g, cellular4g, slowBottleneck };
  }, [activeVisitors]);

  // Regional breakdown of live visitors
  const liveRegionalStats = useMemo(() => {
    const counts: Record<string, number> = {};
    activeVisitors.forEach((v) => {
      const loc = stripIspFromName(v.location || "Việt Nam");
      let province = loc;
      if (loc.includes(",")) {
        province = loc.split(",")[1].trim();
      }
      counts[province] = (counts[province] || 0) + 1;
    });

    const list = Object.entries(counts).map(([name, count]) => ({
      name,
      count,
    }));

    list.sort((a, b) => b.count - a.count);
    return list;
  }, [activeVisitors]);

  const filteredVisitors = useMemo(() => {
    return activeVisitors.filter((v) => {
      // Type filter
      if (filterType === "returning") {
        if (!v.isReturning && (!v.visitCount || v.visitCount <= 1)) {
          return false;
        }
      }
      if (filterType === "new") {
        if (v.isReturning || (v.visitCount && v.visitCount > 1)) {
          return false;
        }
      }

      // Region filter
      if (regionFilter !== "all") {
        const loc = stripIspFromName(v.location || "Việt Nam").toLowerCase();
        if (!loc.includes(regionFilter.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [activeVisitors, filterType, regionFilter]);

  const getDeviceIcon = (deviceStr: string) => {
    if (
      deviceStr.includes("Phone") ||
      deviceStr.includes("Android") ||
      deviceStr.includes("iOS") ||
      deviceStr.includes("Mobile")
    ) {
      return <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    return <Laptop className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  };

  const formatJoinedTime = (isoString: string) => {
    if (!isoString) return "Vừa truy cập";
    try {
      const date = new Date(isoString);
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    } catch {
      return "Vừa xong";
    }
  };

  const getLocationBadgeStyle = (loc = "") => {
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

  /**
   * Render network connection status badge & bottleneck indicator
   */
  const renderNetworkBadge = (visitor: ActiveVisitor) => {
    const connType = visitor.connectionType || (visitor.effectiveType ? visitor.effectiveType.toUpperCase() : "");
    const eff = visitor.effectiveType || "";
    const downlink = visitor.downlink;
    const rtt = visitor.rtt;
    const saveData = visitor.saveData;

    if (!connType && !eff && downlink === undefined) {
      return (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-white/5"
          title="Kết nối bình thường"
        >
          <Wifi className="w-2.5 h-2.5 text-emerald-400" />
          <span>Trực tuyến</span>
        </span>
      );
    }

    const isOffline = connType.toLowerCase().includes("offline") || connType.toLowerCase().includes("ngoại tuyến");
    const is5G = connType.includes("5G");
    const isWifi = connType.toLowerCase().includes("wi-fi") || connType.toLowerCase().includes("wifi");
    const is4G = connType.includes("4G") || eff === "4g";
    const isSlow = eff === "slow-2g" || eff === "2g" || eff === "3g" || (downlink !== undefined && downlink < 1.5) || (rtt !== undefined && rtt > 400);

    let colorClass = "bg-sky-500/15 text-sky-300 border-sky-500/30";
    let icon = <Wifi className="w-2.5 h-2.5 text-sky-400" />;

    if (isOffline) {
      colorClass = "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse";
      icon = <WifiOff className="w-2.5 h-2.5 text-rose-400" />;
    } else if (is5G) {
      colorClass = "bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/40 font-bold";
      icon = <Activity className="w-2.5 h-2.5 text-purple-400" />;
    } else if (isSlow || saveData) {
      colorClass = "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold";
      icon = <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />;
    } else if (isWifi) {
      colorClass = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      icon = <Wifi className="w-2.5 h-2.5 text-emerald-400" />;
    }

    const labelText = connType || (eff ? eff.toUpperCase() : "Wi-Fi");
    const speedText = downlink !== undefined && downlink > 0 ? `${downlink} Mb/s` : "";

    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${colorClass}`}
        title={`Loại mạng: ${labelText}${speedText ? ` • Tốc độ: ${speedText}` : ""}${rtt ? ` • Độ trễ: ${rtt}ms` : ""}${isSlow ? " • Cảnh báo: Tốc độ mạng thấp có thể làm chậm tải ảnh HD" : ""}`}
      >
        {icon}
        <span className="font-medium">{labelText}</span>
        {speedText && <span className="opacity-75 text-[9px]">({speedText})</span>}
        {isSlow && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping ml-0.5" title="Điểm nghẽn mạng" />
        )}
      </span>
    );
  };

  /**
   * Render granular browser badge with exact version
   */
  const renderBrowserBadge = (visitor: ActiveVisitor) => {
    const rawBrowser = visitor.browser || "Trình duyệt Web";
    const ver = visitor.browserVersion;
    let display = rawBrowser;

    if (ver && !rawBrowser.includes(ver)) {
      display = `${rawBrowser} v${ver}`;
    }

    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] text-zinc-300 font-normal"
        title={`Trình duyệt: ${display}`}
      >
        <span>{display}</span>
      </span>
    );
  };

  const handleQuickLocSelect = (locName: string) => {
    if (setCustomLocation) {
      setCustomLocation(locName);
      setFeedbackMsg(`Đã chọn vị trí: ${locName}`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      setShowLocationPopover(false);
    }
  };

  const handleAutoGpsDetect = async () => {
    setIsCalibrating(true);
    try {
      if (resetToAutoLocation) {
        await resetToAutoLocation();
      }
      setFeedbackMsg("Đã kích hoạt tự động quét IP & vị trí thiết bị!");
      setTimeout(() => setFeedbackMsg(null), 3500);
      setShowLocationPopover(false);
    } catch (_) {
      setFeedbackMsg("Lỗi khi định vị lại.");
      setTimeout(() => setFeedbackMsg(null), 2500);
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleSatelliteGps = async () => {
    setIsCalibrating(true);
    try {
      if (calibrateGpsLocation) {
        await calibrateGpsLocation(true);
      }
      setFeedbackMsg("Đã hoàn tất quét GPS vệ tinh!");
      setTimeout(() => setFeedbackMsg(null), 3500);
      setShowLocationPopover(false);
    } catch (_) {
      setFeedbackMsg("Thiết bị không hỗ trợ GPS hoặc quyền bị từ chối.");
      setTimeout(() => setFeedbackMsg(null), 3000);
    } finally {
      setIsCalibrating(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* 1. TOP CONTROL BAR: Balanced, No-Overflow, Luxury */}
      <div className="p-2.5 sm:p-3 rounded-2xl bg-zinc-900/80 border border-white/10 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Left: Visitor Type Segmented Control */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-white/10 text-xs shrink-0 overflow-x-auto scrollbar-none gap-1">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-semibold shrink-0 ${
              filterType === "all"
                ? "bg-[#B5945B] text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Tất cả ({activeVisitors.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("returning")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-semibold shrink-0 flex items-center gap-1 ${
              filterType === "returning"
                ? "bg-[#B5945B] text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <RotateCcw className="w-3 h-3 text-[#B5945B]" />
            <span>Xem lại ({returningCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("new")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer text-xs font-semibold shrink-0 flex items-center gap-1 ${
              filterType === "new"
                ? "bg-cyan-500 text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Star className="w-3 h-3 text-cyan-400" />
            <span>Mới ({newVisitorCount})</span>
          </button>
        </div>

        {/* Right: Device Breakdown + Location Popover Button */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
          {/* Device & Network counts pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-zinc-950/60 border border-white/5 text-[11px] text-zinc-400 shrink-0">
            <span className="flex items-center gap-1" title="Khách dùng điện thoại/tablet">
              <Smartphone className="w-3 h-3 text-amber-400" /> {mobileCount}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1" title="Khách dùng máy tính/laptop">
              <Laptop className="w-3 h-3 text-sky-400" /> {desktopCount}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium" title="Khách kết nối Wi-Fi">
              <Wifi className="w-3 h-3 text-emerald-400" /> {networkStats.wifi}
            </span>
            {(networkStats.cellular5g > 0 || networkStats.cellular4g > 0) && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-purple-300 font-medium" title="Khách dùng mạng di động 4G/5G">
                  <Activity className="w-3 h-3 text-purple-400" /> {networkStats.cellular5g + networkStats.cellular4g}
                </span>
              </>
            )}
            {networkStats.slowBottleneck > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded" title="Có khách hàng đang dùng mạng 2G/3G hoặc tốc độ chậm - nguy cơ nghẽn tải ảnh">
                  <AlertTriangle className="w-3 h-3 text-amber-400" /> {networkStats.slowBottleneck} nghẽn
                </span>
              </>
            )}
          </div>

          {/* Location Setting Dropdown Trigger */}
          {isAdmin && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLocationPopover(!showLocationPopover)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#B5945B]/15 to-amber-600/15 hover:from-[#B5945B]/25 hover:to-amber-600/25 text-[#E5C17C] hover:text-white border border-[#B5945B]/35 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm"
                title="Cài đặt và kiểm soát vị trí máy này"
              >
                <MapPin className="w-3.5 h-3.5 text-[#B5945B]" />
                <span className="max-w-[120px] sm:max-w-[150px] truncate font-bold">
                  {stripIspFromName(visitorLocation || "Vị trí máy này")}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {/* Popover Menu */}
              {showLocationPopover && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1.5 z-40 w-64 bg-zinc-950 border border-[#B5945B]/40 rounded-2xl p-3 shadow-2xl space-y-2 text-xs animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-[#B5945B]" />
                      Định vị thiết bị quản trị
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLocationPopover(false)}
                      className="text-zinc-500 hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-400">
                    Chọn nhanh vị trí để hiển thị chuẩn xác trên bản đồ và hệ thống:
                  </p>

                  <div className="grid grid-cols-2 gap-1.5">
                    {["Đà Nẵng", "TP. Hồ Chí Minh", "Hải Phòng", "Quảng Ninh", "Hà Nội", "Cần Thơ"].map((loc) => (
                      <button
                        key={`pop-loc-${loc}`}
                        type="button"
                        onClick={() => handleQuickLocSelect(loc)}
                        className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium transition-all cursor-pointer ${
                          visitorLocation.includes(loc)
                            ? "bg-[#B5945B] text-zinc-950 font-bold"
                            : "bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 border border-white/5"
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/10 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleAutoGpsDetect}
                      disabled={isCalibrating}
                      className="w-full py-1.5 px-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isCalibrating ? "animate-spin" : ""}`} />
                      <span>Tự động phát hiện theo IP</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSatelliteGps}
                      disabled={isCalibrating}
                      className="w-full py-1.5 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Compass className={`w-3.5 h-3.5 ${isCalibrating ? "animate-spin" : ""}`} />
                      <span>Quét GPS thiết bị thực tế</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Notification */}
      {feedbackMsg && (
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 2. REGIONAL CONTROL STRIP: Compact, scrollable horizontal pills */}
      {isAdmin && liveRegionalStats.length > 0 && (
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
            Tất cả ({activeVisitors.length})
          </button>
          {liveRegionalStats.map((r) => {
            const isSelected = regionFilter.toLowerCase() === r.name.toLowerCase();
            return (
              <button
                key={`live-reg-${r.name}`}
                type="button"
                onClick={() => setRegionFilter(isSelected ? "all" : r.name)}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium shrink-0 flex items-center gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#B5945B] text-zinc-950 font-bold shadow-sm"
                    : "bg-zinc-900/80 text-zinc-300 hover:text-white border border-white/5"
                }`}
              >
                <span>📍 {r.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? "bg-zinc-950/20 text-zinc-950" : "bg-white/10 text-[#E5C17C]"
                  }`}
                >
                  {r.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2.5 RADAR IP GEOLOCATION STATUS BANNER */}
      <div className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-950/25 via-zinc-900/80 to-emerald-950/25 border border-blue-500/25 flex flex-wrap items-center justify-between gap-2 text-xs shadow-sm">
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-bold text-white text-[11px] sm:text-xs">
            Radar IP Vệ Tinh: <span className="text-emerald-300">100% Hoạt động chuẩn xác</span>
          </span>
          <span className="text-zinc-600 hidden md:inline">|</span>
          <span className="text-zinc-400 text-[11px] hidden md:inline">
            Đa tầng GeoIP (Google Edge + ipwho + ip-api + ipinfo + freeipapi)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/25 font-mono text-[10px]">
            Độ chính xác: Tỉnh / Thành phố
          </span>
        </div>
      </div>

      {/* 3. VISITOR LIST: Sleek, luxury cards with zero border overflow */}
      <div className="space-y-2.5">
        {filteredVisitors.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-zinc-900/40 border border-white/5 text-zinc-500 text-xs space-y-2">
            <Radio className="w-8 h-8 text-emerald-500/40 mx-auto animate-pulse" />
            <p className="font-semibold text-zinc-300">Chưa có khách hàng nào đang lướt web</p>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
              Hệ thống radar đang trực tiếp lắng nghe. Thẻ khách hàng sẽ hiển thị ngay khi có người truy cập portfolio.
            </p>
          </div>
        ) : (
          filteredVisitors.map((visitor, idx) => {
            const cleanLoc = stripIspFromName(visitor.location || "Việt Nam");
            const isReturning = Boolean(visitor.isReturning || (visitor.visitCount && visitor.visitCount > 1));
            const visitCount = visitor.visitCount || (isReturning ? 2 : 1);
            const cleanDevice = sanitizeDeviceLabel(visitor.device, visitor.screenResolution);

            return (
              <div
                key={`live-item-${visitor.id || 'vis'}-${idx}`}
                className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
                  isReturning
                    ? "bg-gradient-to-r from-amber-950/20 via-zinc-900/80 to-zinc-900/80 border-[#B5945B]/35 shadow-sm"
                    : "bg-zinc-900/70 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Left: Device & Visitor Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                        isReturning
                          ? "bg-gradient-to-br from-[#DFB779] to-[#996515] text-zinc-950 font-extrabold shadow-[0_2px_8px_rgba(212,175,55,0.25)]"
                          : "bg-zinc-800 text-zinc-300 border border-white/10"
                      }`}
                    >
                      {isReturning ? "🔄" : `#${idx + 1}`}
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-xs truncate">
                          {visitor.visitorName}
                        </span>

                        {/* Returning visitor badge */}
                        {isReturning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[#B5945B]/25 to-amber-500/20 text-[#F3E0B5] border border-[#B5945B]/60">
                            <RotateCcw className="w-2.5 h-2.5 text-[#E5C17C] stroke-[2.5]" />
                            <span>Khách xem lại (Lần {visitCount})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <Star className="w-2.5 h-2.5" />
                            <span>Khách mới</span>
                          </span>
                        )}

                        {/* Accurate Location Badge with 1-Click Calibration */}
                        {isAdmin && visitor.location && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingVisitorId(editingVisitorId === visitor.id ? null : visitor.id);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border transition-all cursor-pointer hover:brightness-125 ${getLocationBadgeStyle(
                              cleanLoc
                            )}`}
                            title={`Nhấn để hiệu chỉnh vị trí khách hàng này (Hiện tại: ${cleanLoc})`}
                          >
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{cleanLoc}</span>
                            <span className="text-[9px] opacity-70">✎</span>
                          </button>
                        )}

                        {/* High-Precision IP Badge for Admins */}
                        {isAdmin && (visitor.rawIp || visitor.ip) && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/35 shadow-sm"
                            title={`IP Vệ Tinh Khách Hàng: ${visitor.rawIp || visitor.ip} (Định vị vệ tinh chuẩn xác)`}
                          >
                            <Globe className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                            <span>{visitor.rawIp || visitor.ip}</span>
                          </span>
                        )}
                      </div>

                      {/* 1-Click Quick Calibration Bar for this Live Visitor */}
                      {editingVisitorId === visitor.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1.5 p-2 rounded-xl bg-zinc-950 border border-[#B5945B]/40 flex flex-wrap items-center gap-1 text-xs shadow-lg animate-in fade-in"
                        >
                          <span className="text-zinc-400 text-[10px] font-bold">Đổi vị trí:</span>
                          {["Đà Nẵng", "TP. Hồ Chí Minh", "Hải Phòng", "Quảng Ninh", "Hà Nội", "Cần Thơ", "Bình Dương"].map((loc) => (
                            <button
                              key={`live-cal-${visitor.id}-${loc}`}
                              type="button"
                              onClick={() => handleUpdateVisitorLocation(visitor.id, loc)}
                              className="px-2 py-0.5 rounded-lg bg-zinc-900 hover:bg-[#B5945B] hover:text-zinc-950 text-zinc-200 border border-white/10 font-medium transition-all cursor-pointer text-[11px]"
                            >
                              {loc}
                            </button>
                          ))}
                          <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                            <input
                              type="text"
                              value={customLocInput}
                              onChange={(e) => setCustomLocInput(e.target.value)}
                              placeholder="Tỉnh khác..."
                              className="w-full bg-zinc-900 border border-white/15 rounded-lg px-2 py-0.5 text-[11px] text-white focus:outline-none focus:border-[#B5945B]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (customLocInput) {
                                  handleUpdateVisitorLocation(visitor.id, customLocInput);
                                  setCustomLocInput("");
                                }
                              }}
                              className="px-2 py-0.5 rounded-lg bg-[#B5945B] text-zinc-950 font-bold hover:bg-[#c4a268] cursor-pointer text-[11px]"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Device, Granular Browser & Network Connection info line */}
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 flex-wrap pt-0.5">
                        <span className="flex items-center gap-1 text-zinc-300 font-medium">
                          {getDeviceIcon(cleanDevice)}
                          <span>{cleanDevice}</span>
                        </span>
                        <span>·</span>
                        {renderBrowserBadge(visitor)}
                        {visitor.screenResolution && (
                          <>
                            <span className="text-zinc-600 hidden sm:inline">·</span>
                            <span className="text-zinc-500 text-[10px] hidden sm:inline">
                              {visitor.screenResolution}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        {renderNetworkBadge(visitor)}
                      </div>
                    </div>
                  </div>

                  {/* Right: Current Section & Joined Time */}
                  <div className="flex items-center sm:items-end justify-between sm:flex-col shrink-0 gap-1 sm:text-right border-t sm:border-t-0 border-white/5 pt-1.5 sm:pt-0">
                    <div className="flex items-center gap-1 text-xs font-semibold text-[#B5945B] max-w-[200px] truncate">
                      <Compass className="w-3 h-3 shrink-0" />
                      <span className="truncate">{visitor.currentPage || "Trang chủ Portfolio"}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Online
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatJoinedTime(visitor.joinedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Tự động định vị đa nguồn qua IP vệ tinh & nhận diện thiết bị xem lại</span>
        </span>
        <span className="text-[10px] text-zinc-600">Bergh Ryker Live</span>
      </div>
    </div>
  );
};
