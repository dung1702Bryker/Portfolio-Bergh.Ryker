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
  Layers,
  ChevronRight,
  Filter,
  Navigation,
} from "lucide-react";
import { ActiveVisitor } from "../types/presence";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useLivePresenceContext } from "../context/LivePresenceContext";
import { stripIspFromName } from "../services/geoService";
import { sanitizeDeviceLabel } from "../services/visitorHistoryService";

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
  const { visitorLocation, calibrateGpsLocation, setCustomLocation } = useLivePresenceContext();
  const [filterType, setFilterType] = useState<"all" | "returning" | "new" | "admins">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");

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

    list.sort((a, b) => {
      if (a.name === "Quảng Ninh") return -1;
      if (b.name === "Quảng Ninh") return 1;
      if (a.name === "Hà Nội") return -1;
      if (b.name === "Hà Nội") return 1;
      return b.count - a.count;
    });

    return list;
  }, [activeVisitors]);

  // Find most viewed page currently
  const popularPage = useMemo(() => {
    if (activeVisitors.length === 0) return "Chưa có khách xem";
    const counts: Record<string, number> = {};
    activeVisitors.forEach((v) => {
      const key = v.currentPage || "Trang chủ";
      counts[key] = (counts[key] || 0) + 1;
    });
    let top = "";
    let max = -1;
    Object.entries(counts).forEach(([page, c]) => {
      if (c > max) {
        max = c;
        top = page;
      }
    });
    return `${top} (${max} người)`;
  }, [activeVisitors]);

  const filteredVisitors = useMemo(() => {
    return activeVisitors.filter((v) => {
      // Type filter
      if (filterType === "returning") {
        if (v.role === "admin" || (!v.isReturning && (!v.visitCount || v.visitCount <= 1))) {
          return false;
        }
      }
      if (filterType === "new") {
        if (v.role === "admin" || v.isReturning || (v.visitCount && v.visitCount > 1)) {
          return false;
        }
      }
      if (filterType === "admins") {
        if (v.role !== "admin") return false;
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
      const seconds = String(date.getSeconds()).padStart(2, "0");
      return `${hours}:${minutes}:${seconds}`;
    } catch {
      return "Vừa truy cập";
    }
  };

  const getLocationBadgeStyle = (loc = "") => {
    const clean = stripIspFromName(loc).toLowerCase();
    if (clean.includes("phan tây nhạc") || clean.includes("trịnh văn bô") || clean.includes("phương canh") || clean.includes("nam từ liêm")) {
      return "bg-emerald-500/25 text-emerald-300 border-emerald-500/60 font-bold shadow-sm ring-1 ring-emerald-400/40";
    }
    if (clean.includes("quảng ninh") || clean.includes("hạ long") || clean.includes("cẩm phả") || clean.includes("uông bí")) {
      return "bg-[#B5945B]/20 text-[#B5945B] border-[#B5945B]/50 font-bold shadow-sm";
    }
    if (clean.includes("hải phòng")) {
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 font-semibold";
    }
    if (clean.includes("hà nội")) {
      return "bg-sky-500/15 text-sky-300 border-sky-500/35 font-semibold";
    }
    if (clean.includes("hồ chí minh") || clean.includes("sài gòn")) {
      return "bg-orange-500/15 text-orange-300 border-orange-500/35 font-semibold";
    }
    return "bg-zinc-800 text-zinc-300 border-white/10";
  };

  return (
    <div className="space-y-3.5">
      {/* 1. Quick Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-zinc-900/60 border border-white/10">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {activeCount} đang online
          </span>

          {/* Returning Visitors Counter */}
          <span className="flex items-center gap-1 text-zinc-400">
            <RotateCcw className="w-3.5 h-3.5 text-[#B5945B]" />
            <span>Xem lại: <strong className="text-[#B5945B]">{returningCount}</strong></span>
          </span>

          <span className="text-zinc-600">•</span>

          {/* New Visitors Counter */}
          <span className="flex items-center gap-1 text-zinc-400">
            <Star className="w-3.5 h-3.5 text-cyan-400" />
            <span>Khách mới: <strong className="text-cyan-300">{newVisitorCount}</strong></span>
          </span>

          <span className="text-zinc-600 hidden sm:inline">•</span>

          <span className="flex items-center gap-1 text-zinc-400">
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span>Di động: <strong className="text-white">{mobileCount}</strong></span>
          </span>

          <span className="text-zinc-600 hidden sm:inline">•</span>

          <span className="flex items-center gap-1 text-zinc-400">
            <Laptop className="w-3.5 h-3.5 text-sky-400" />
            <span>Máy tính: <strong className="text-white">{desktopCount}</strong></span>
          </span>

          <span className="text-zinc-600 hidden md:inline">•</span>

          <span className="hidden md:flex items-center gap-1 text-zinc-400 truncate max-w-xs">
            <Compass className="w-3.5 h-3.5 text-[#B5945B]" />
            <span className="truncate">Điểm hot: <strong className="text-[#B5945B]">{popularPage}</strong></span>
          </span>
        </div>

        {/* Visitor Type Filter Segmented Control */}
        <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-white/10 text-xs shrink-0 flex-wrap gap-0.5">
          <button
            onClick={() => setFilterType("all")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer text-[11px] font-medium ${
              filterType === "all"
                ? "bg-[#B5945B] text-zinc-950 font-bold shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Tất cả ({activeVisitors.length})
          </button>
          <button
            onClick={() => setFilterType("returning")}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[11px] font-medium flex items-center gap-1 ${
              filterType === "returning"
                ? "bg-[#B5945B] text-zinc-950 font-bold shadow"
                : "text-amber-400/90 hover:text-amber-300"
            }`}
            title="Lọc thiết bị đã từng vào xem lại"
          >
            <span>🔄 Xem lại</span>
            <span className="px-1 py-0.2 rounded-full text-[9px] bg-black/30 font-bold">{returningCount}</span>
          </button>
          <button
            onClick={() => setFilterType("new")}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[11px] font-medium flex items-center gap-1 ${
              filterType === "new"
                ? "bg-cyan-500 text-zinc-950 font-bold shadow"
                : "text-cyan-400/90 hover:text-cyan-300"
            }`}
            title="Lọc khách truy cập lần đầu"
          >
            <span>⭐ Mới</span>
            <span className="px-1 py-0.2 rounded-full text-[9px] bg-black/30 font-bold">{newVisitorCount}</span>
          </button>
          <button
            onClick={() => setFilterType("admins")}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[11px] font-medium ${
              filterType === "admins"
                ? "bg-purple-500 text-white font-bold shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Admin ({activeVisitors.filter((v) => v.role === "admin").length})
          </button>
        </div>
      </div>

      {/* Admin Precision GPS Calibration Bar */}
      {isAdmin && (
        <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-zinc-950 to-amber-500/10 border border-[#B5945B]/30 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 font-bold text-[#E5C17C] text-[11px] uppercase tracking-wider">
              <Navigation className="w-3.5 h-3.5 text-[#B5945B]" />
              <span>Vị trí của bạn:</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 text-xs flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-400" />
              {stripIspFromName(visitorLocation || "Phan Tây Nhạc, Nam Từ Liêm, Hà Nội")}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-zinc-400">Hiệu chỉnh nhanh:</span>
            <button
              type="button"
              onClick={() => setCustomLocation && setCustomLocation("Phan Tây Nhạc, Nam Từ Liêm, Hà Nội")}
              className="px-2.5 py-1 rounded-lg bg-[#B5945B]/20 text-[#E5C17C] hover:bg-[#B5945B] hover:text-zinc-950 font-bold text-[11px] border border-[#B5945B]/40 transition-all cursor-pointer shadow-sm"
              title="Gán vị trí chuẩn: Phan Tây Nhạc, Nam Từ Liêm, Hà Nội"
            >
              🎯 Phan Tây Nhạc, Hà Nội
            </button>
            <button
              type="button"
              onClick={() => setCustomLocation && setCustomLocation("Hà Nội")}
              className="px-2 py-1 rounded-lg bg-sky-500/15 text-sky-300 hover:bg-sky-500 hover:text-white font-bold text-[11px] border border-sky-500/30 transition-all cursor-pointer"
            >
              Hà Nội
            </button>
            <button
              type="button"
              onClick={() => setCustomLocation && setCustomLocation("Hạ Long, Quảng Ninh")}
              className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500 hover:text-zinc-950 font-bold text-[11px] border border-amber-500/30 transition-all cursor-pointer"
            >
              Quảng Ninh
            </button>
            <button
              type="button"
              onClick={async () => {
                if (calibrateGpsLocation) {
                  await calibrateGpsLocation(true);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-zinc-950 font-bold text-[11px] border border-emerald-500/40 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
              title="Định vị bằng GPS vệ tinh độ chính xác cực cao"
            >
              <Navigation className="w-3 h-3" /> Quét GPS Thiết Bị
            </button>
          </div>
        </div>
      )}

      {/* 2. Kiểm Soát Khu Vực & Vị Trí Khách Hàng (Regional Control Bar) */}
      {isAdmin && liveRegionalStats.length > 0 && (
        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-[#B5945B]/25 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 font-bold text-[#E5C17C] text-[11px] uppercase tracking-wider">
              <MapPin className="w-3.5 h-3.5 text-[#B5945B]" />
              <span>Kiểm soát khu vực:</span>
            </span>

            {/* Quick Region Pills */}
            <button
              onClick={() => setRegionFilter("all")}
              className={`px-2 py-0.5 rounded-full text-[10px] transition-all cursor-pointer ${
                regionFilter === "all"
                  ? "bg-[#B5945B] text-black font-bold shadow-sm"
                  : "bg-white/5 text-zinc-400 hover:text-white border border-white/10"
              }`}
            >
              Toàn bộ ({activeVisitors.length})
            </button>

            {liveRegionalStats.map((r) => {
              const isSelected = regionFilter.toLowerCase() === r.name.toLowerCase();
              return (
                <button
                  key={`reg-filter-${r.name}`}
                  onClick={() => setRegionFilter(isSelected ? "all" : r.name)}
                  className={`px-2 py-0.5 rounded-full text-[10px] transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? "bg-[#B5945B] text-black font-bold shadow-sm"
                      : "bg-zinc-900 text-zinc-300 hover:text-white border border-white/10 hover:border-white/20"
                  }`}
                >
                  <span>{r.name}</span>
                  <span className={`px-1 py-0.1 rounded-full text-[9px] font-bold ${isSelected ? 'bg-black/20 text-black' : 'bg-white/10 text-[#E5C17C]'}`}>
                    {r.count}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="text-[10px] text-zinc-500 italic hidden sm:inline">
            Vị trí chuẩn xác cao theo GeoIP đa nguồn & tọa độ
          </span>
        </div>
      )}

      {/* 3. Visitors List */}
      <div className="space-y-2">
        {filteredVisitors.length === 0 ? (
          <div className="text-center py-10 rounded-xl bg-zinc-900/40 border border-white/5 text-zinc-500 text-xs space-y-1.5">
            <Users className="w-7 h-7 text-zinc-600 mx-auto" />
            <p className="font-semibold text-zinc-400">Không có người xem nào theo bộ lọc</p>
            <p className="text-[11px] text-zinc-500">
              Danh sách sẽ tự động hiện lên khi có khách truy cập website.
            </p>
          </div>
        ) : (
          filteredVisitors.map((visitor, idx) => {
            const isSelf = visitor.id === currentVisitorId;
            const isAdm = visitor.role === "admin";
            const cleanLoc = stripIspFromName(visitor.location || "Việt Nam");
            const isReturning = Boolean(visitor.isReturning || (visitor.visitCount && visitor.visitCount > 1));
            const visitCount = visitor.visitCount || (isReturning ? 2 : 1);

            return (
              <div
                key={`live-item-${visitor.id || 'vis'}-${idx}`}
                className={`p-3 rounded-xl border transition-all ${
                  isSelf
                    ? "bg-emerald-950/25 border-emerald-500/40 shadow-sm"
                    : isAdm
                    ? "bg-amber-950/20 border-amber-500/30"
                    : isReturning
                    ? "bg-gradient-to-r from-amber-950/25 via-zinc-900/70 to-zinc-900/70 border-[#B5945B]/35 shadow-sm"
                    : "bg-zinc-900/70 border-white/5 hover:border-white/15"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Left: Identity & Device */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow ${
                        isAdm
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : isReturning
                          ? "bg-gradient-to-br from-[#DFB779] to-[#996515] text-zinc-950 font-extrabold shadow-[0_2px_10px_rgba(212,175,55,0.3)]"
                          : isSelf
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800 text-zinc-300 border border-white/10"
                      }`}
                      title={isReturning ? `Thiết bị đã xem lại ${visitCount} lần` : undefined}
                    >
                      {isAdm ? "👑" : isReturning ? "🔄" : `#${idx + 1}`}
                    </div>

                    <div className="min-w-0 space-y-0.5 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white text-xs truncate">
                          {visitor.visitorName}
                        </span>

                        {isSelf && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Bạn
                          </span>
                        )}

                        {isAdm && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Quản Trị Viên
                          </span>
                        )}

                        {/* RETURNING VISITOR BADGE (Nhận biết thiết bị đã từng vào xem lại) */}
                        {!isAdm && isReturning && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-[#B5945B]/25 to-amber-500/20 text-[#F3E0B5] border border-[#B5945B]/60 shadow-[0_1px_8px_rgba(212,175,55,0.2)]">
                            <RotateCcw className="w-2.5 h-2.5 text-[#E5C17C] stroke-[2.5]" />
                            <span>Khách xem lại (Lần {visitCount})</span>
                          </span>
                        )}

                        {/* NEW VISITOR BADGE */}
                        {!isAdm && !isReturning && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <Star className="w-2.5 h-2.5" />
                            <span>Khách mới</span>
                          </span>
                        )}

                        {/* Exact Geographic Location Badge */}
                        {isAdmin && visitor.location && (
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${getLocationBadgeStyle(
                              cleanLoc
                            )}`}
                            title={`Vị trí địa lý: ${cleanLoc}`}
                          >
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{cleanLoc}</span>
                          </span>
                        )}
                      </div>

                      {/* Device & Browser & Screen Specs */}
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 flex-wrap">
                        <span className="flex items-center gap-1 text-zinc-300">
                          {getDeviceIcon(sanitizeDeviceLabel(visitor.device, visitor.screenResolution))}
                          <span>{sanitizeDeviceLabel(visitor.device, visitor.screenResolution)}</span>
                        </span>
                        <span>•</span>
                        <span className="text-zinc-400">{visitor.browser}</span>
                        {visitor.screenResolution && (
                          <>
                            <span className="text-zinc-600 hidden sm:inline">•</span>
                            <span className="text-zinc-500 text-[10px] hidden sm:inline">
                              {visitor.screenResolution}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Current Viewing Section */}
                  <div className="sm:border-l sm:border-white/10 sm:pl-3.5 space-y-0.5 min-w-[190px] max-w-xs">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
                      Đang xem trực tiếp
                    </span>
                    <div className="flex items-center gap-1 text-xs font-semibold text-[#B5945B] truncate">
                      <Compass className="w-3 h-3 shrink-0" />
                      <span className="truncate">{visitor.currentPage || "Trang chủ Portfolio"}</span>
                    </div>
                    {visitor.currentViewDetail && (
                      <p className="text-[10px] text-zinc-400 truncate">
                        {visitor.currentViewDetail}
                      </p>
                    )}
                  </div>

                  {/* Right: Active Status & Time */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 border-white/5 pt-1.5 sm:pt-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Trực tuyến
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {formatJoinedTime(visitor.joinedAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Real-time Indicator Footer */}
      <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between text-[11px] text-zinc-500 gap-2">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Tự động nhận diện thiết bị xem lại & định vị khu vực chuẩn xác tức thì</span>
        </div>
        <span className="text-[10px] text-zinc-600">Hệ thống Bergh Ryker Live Presence</span>
      </div>
    </div>
  );
};

