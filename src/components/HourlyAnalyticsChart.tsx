import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Flame,
  TrendingUp,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  BarChart3,
  Activity,
  Layers,
  Info,
  Calendar,
  Eye,
  CheckCircle2,
  ChevronRight,
  Filter,
  Trophy,
} from "lucide-react";
import {
  HourlyStatsResult,
  HourlyDataPoint,
  HourlyTimelinePoint,
} from "../hooks/useSectionAnalytics";
import { formatViewCount } from "../services/analyticsService";

interface HourlyAnalyticsChartProps {
  stats: HourlyStatsResult;
  selectedSource: string;
  onSourceChange: (sourceId: string) => void;
  availableSources: { id: string; title: string; type: string }[];
}

type ChartViewMode = "bars24" | "timeline" | "ranking" | "segments";
type TimeFilter = "all24" | "daytime" | "golden";

export const HourlyAnalyticsChart: React.FC<HourlyAnalyticsChartProps> = ({
  stats,
  selectedSource,
  onSourceChange,
  availableSources,
}) => {
  const [viewMode, setChartViewMode] = useState<ChartViewMode>("bars24");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all24");

  const {
    hourlyBuckets,
    timelineLast24h,
    segmentsSummary,
    peakHour,
    total24hViews,
    totalRecordedViews,
    currentHourViews,
    smartAdvice,
  } = stats;

  // Selected hour for interactive detail inspector card (defaults to Peak Hour or Current Hour)
  const defaultSelectedHour = useMemo(() => {
    return peakHour || hourlyBuckets.find((b) => b.isCurrentHour) || hourlyBuckets[19] || hourlyBuckets[0];
  }, [peakHour, hourlyBuckets]);

  const [selectedBucket, setSelectedBucket] = useState<HourlyDataPoint>(defaultSelectedHour);

  // Filter hourly buckets based on time filter
  const displayedBuckets = useMemo(() => {
    if (timeFilter === "daytime") {
      // 06:00 - 23:00 (18 hours)
      return hourlyBuckets.filter((b) => b.hour >= 6);
    }
    if (timeFilter === "golden") {
      // 17:00 - 23:00 (Evening prime)
      return hourlyBuckets.filter((b) => b.hour >= 17 && b.hour <= 23);
    }
    return hourlyBuckets;
  }, [hourlyBuckets, timeFilter]);

  const maxBucketViews = useMemo(() => {
    return Math.max(...displayedBuckets.map((b) => b.views), 1);
  }, [displayedBuckets]);

  const maxTimelineViews = useMemo(() => {
    return Math.max(...timelineLast24h.map((p) => p.views), 1);
  }, [timelineLast24h]);

  // Top 6 ranked hours
  const rankedHours = useMemo(() => {
    return [...hourlyBuckets]
      .sort((a, b) => b.views - a.views)
      .slice(0, 6);
  }, [hourlyBuckets]);

  // Y-axis grid increments
  const yAxisTicks = useMemo(() => {
    const max = maxBucketViews;
    return [
      { percent: 100, label: formatViewCount(max) },
      { percent: 75, label: formatViewCount(Math.round(max * 0.75)) },
      { percent: 50, label: formatViewCount(Math.round(max * 0.5)) },
      { percent: 25, label: formatViewCount(Math.round(max * 0.25)) },
      { percent: 0, label: "0" },
    ];
  }, [maxBucketViews]);

  // Generate SVG points for the timeline area/line chart
  const svgChartData = useMemo(() => {
    const width = 840;
    const height = 240;
    const padding = { top: 25, right: 30, bottom: 40, left: 55 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (timelineLast24h.length === 0) return null;

    const points = timelineLast24h.map((pt, i) => {
      const x = padding.left + (i / (timelineLast24h.length - 1)) * chartW;
      const y = padding.top + chartH - (pt.views / maxTimelineViews) * chartH;
      return { x, y, ...pt };
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0.x + p1.x) / 2;
      pathD += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    const baselineY = padding.top + chartH;
    const areaD = `${pathD} L ${lastPt.x} ${baselineY} L ${firstPt.x} ${baselineY} Z`;

    return {
      width,
      height,
      padding,
      points,
      pathD,
      areaD,
      baselineY,
      chartW,
      chartH,
    };
  }, [timelineLast24h, maxTimelineViews]);

  // Helper for bucket styling
  const getSegmentIcon = (type: string) => {
    switch (type) {
      case "morning":
        return <Sun className="w-4 h-4 text-amber-400" />;
      case "noon":
      case "afternoon":
        return <Sun className="w-4 h-4 text-orange-400" />;
      case "evening":
        return <Sunset className="w-4 h-4 text-[#B5945B]" />;
      default:
        return <Moon className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="bg-gradient-to-br from-zinc-900/95 via-zinc-950 to-black border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6 relative overflow-hidden">
      {/* Subtle Luxury Glow Effects */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#B5945B]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-72 h-72 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10 border-b border-white/10 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#B5945B]/30 to-amber-600/20 border border-[#B5945B]/40 flex items-center justify-center text-[#B5945B] shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Lượt Xem Theo Giờ & Khung Giờ Vàng</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live 24h
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#B5945B]/15 border border-[#B5945B]/30 text-[#B5945B] text-[10px] font-bold">
                  Thực tế 100%
                </span>
              </h4>
              <p className="text-xs text-zinc-400">
                Số liệu thực tế chính xác 100% từ Firestore • Tự động ghi nhận theo thời gian thực
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Source Selector */}
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-white/15 rounded-xl px-3 py-2 text-xs text-zinc-300 shadow-inner">
            <Layers className="w-3.5 h-3.5 text-[#B5945B] shrink-0" />
            <span className="text-zinc-400 hidden sm:inline text-[11px] font-medium">Lọc mục:</span>
            <select
              value={selectedSource}
              onChange={(e) => {
                onSourceChange(e.target.value);
              }}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer pr-2 max-w-[170px] truncate"
            >
              <option value="all" className="bg-zinc-900 text-white">
                Toàn Bộ Portfolio (Tổng Hợp)
              </option>
              {availableSources.map((s, sIdx) => (
                <option key={`source-${s.id || sIdx}-${sIdx}`} value={s.id} className="bg-zinc-900 text-white">
                  {s.type === "portfolio_visitor" ? "Khách xem chung" : s.title}
                </option>
              ))}
            </select>
          </div>

          {/* View Modes */}
          <div className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-white/15">
            <button
              onClick={() => setChartViewMode("bars24")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "bars24"
                  ? "bg-[#B5945B] text-zinc-950 shadow-md ring-1 ring-amber-300"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Biểu đồ cột 24 giờ"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Cột 24h</span>
            </button>

            <button
              onClick={() => setChartViewMode("timeline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "timeline"
                  ? "bg-[#B5945B] text-zinc-950 shadow-md ring-1 ring-amber-300"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Biểu đồ sóng liên tục 24h gần nhất"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Đường Sóng</span>
            </button>

            <button
              onClick={() => setChartViewMode("ranking")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "ranking"
                  ? "bg-[#B5945B] text-zinc-950 shadow-md ring-1 ring-amber-300"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Xếp hạng các giờ có nhiều lượt xem nhất"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Xếp Hạng</span>
            </button>

            <button
              onClick={() => setChartViewMode("segments")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "segments"
                  ? "bg-[#B5945B] text-zinc-950 shadow-md ring-1 ring-amber-300"
                  : "text-zinc-400 hover:text-white"
              }`}
              title="Tổng hợp 4 buổi trong ngày"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>4 Buổi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mini KPI Highlights Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
        {/* 1. Peak Hour */}
        <div
          onClick={() => peakHour && setSelectedBucket(peakHour)}
          className="bg-gradient-to-br from-orange-950/30 via-zinc-900/70 to-zinc-900/40 border border-orange-500/20 hover:border-orange-500/40 p-3.5 rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-orange-400 uppercase font-bold tracking-wider">
                Giờ Đỉnh Điểm
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {peakHour && peakHour.views > 0 ? "Chạm để xem" : ""}
              </span>
            </div>
            <span className="text-base font-extrabold text-white block truncate">
              {peakHour && peakHour.views > 0
                ? `${peakHour.label} (${formatViewCount(peakHour.views)} lượt)`
                : "Chưa ghi nhận"}
            </span>
          </div>
        </div>

        {/* 2. Current Hour */}
        <div
          onClick={() => {
            const cur = hourlyBuckets.find((b) => b.isCurrentHour);
            if (cur) setSelectedBucket(cur);
          }}
          className="bg-gradient-to-br from-emerald-950/30 via-zinc-900/70 to-zinc-900/40 border border-emerald-500/20 hover:border-emerald-500/40 p-3.5 rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">
                Khung Giờ Này
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <span className="text-base font-extrabold text-white block truncate">
              {formatViewCount(currentHourViews)} lượt xem
            </span>
          </div>
        </div>

        {/* 3. Golden Evening Share */}
        <div className="bg-gradient-to-br from-amber-950/30 via-zinc-900/70 to-zinc-900/40 border border-[#B5945B]/20 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#B5945B]/15 border border-[#B5945B]/30 flex items-center justify-center text-[#B5945B] shrink-0">
            <Sunset className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-[#B5945B] uppercase font-bold tracking-wider block">
              Giờ Vàng (18h - 23h)
            </span>
            <span className="text-base font-extrabold text-white block truncate">
              {total24hViews > 0
                ? `${segmentsSummary.find((s) => s.key === "evening")?.percent || 0}% lượng khách`
                : "Chờ dữ liệu"}
            </span>
          </div>
        </div>

        {/* 4. Total 24h Activity */}
        <div className="bg-zinc-900/60 border border-white/10 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
              Tổng Xem 24 Giờ
            </span>
            <span className="text-base font-extrabold text-purple-300 block truncate">
              {formatViewCount(total24hViews)} lượt xem
            </span>
          </div>
        </div>
      </div>

      {/* ACTIVE HOUR INSPECTOR CARD - Cực kỳ dễ nhìn cho cả Desktop & Điện thoại */}
      {selectedBucket && (
        <div className="relative z-10 bg-gradient-to-r from-zinc-900 via-black to-zinc-900 border-2 border-[#B5945B]/50 rounded-2xl p-4 sm:p-5 shadow-xl shadow-[#B5945B]/10 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#B5945B]/30 via-zinc-800 to-black border border-[#B5945B]/60 flex items-center justify-center shadow-lg shrink-0">
                {getSegmentIcon(selectedBucket.segmentType)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#B5945B] uppercase tracking-wider">
                    {selectedBucket.segmentName}
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-sm sm:text-base font-extrabold text-white">
                    Khung giờ: {selectedBucket.label} – {String((selectedBucket.hour + 1) % 24).padStart(2, "0")}:00
                  </span>
                  {selectedBucket.isCurrentHour && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                      Hiện tại
                    </span>
                  )}
                  {peakHour?.hour === selectedBucket.hour && selectedBucket.views > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-bold flex items-center gap-1">
                      <Flame className="w-3 h-3" /> Cao nhất ngày
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {selectedBucket.hour >= 18 && selectedBucket.hour <= 22
                    ? "Đây là Khung Giờ Vàng! Học sinh & lớp trưởng tập trung online nhiều nhất."
                    : selectedBucket.hour >= 6 && selectedBucket.hour <= 11
                    ? "Khung giờ buổi sáng: Học sinh rảnh giờ ra chơi hoặc chuẩn bị lên lớp."
                    : selectedBucket.hour >= 12 && selectedBucket.hour <= 17
                    ? "Khung giờ buổi chiều: Lượng xem duy trì ổn định."
                    : "Khung giờ đêm muộn: Lượng xem thường giảm để chuẩn bị cho ngày mới."}
                </p>
              </div>
            </div>

            {/* Metrics side of inspector */}
            <div className="flex items-center gap-6 sm:border-l sm:border-white/10 sm:pl-6 shrink-0">
              <div>
                <span className="text-[11px] text-zinc-400 font-medium block">Số lượt xem</span>
                <span className="text-2xl sm:text-3xl font-black text-[#B5945B] tracking-tight">
                  {formatViewCount(selectedBucket.views)}
                  <span className="text-xs font-normal text-zinc-400 ml-1">lượt</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-400 font-medium block">Tỷ trọng trong ngày</span>
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {selectedBucket.percent}
                  <span className="text-xs font-normal text-zinc-400 ml-0.5">%</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 1: 24-HOUR BAR CHART (Cực kỳ trực quan, có thước đo Y và nhãn số trên đỉnh) */}
      {viewMode === "bars24" && (
        <div className="space-y-4 relative z-10">
          {/* Secondary Filter & Legend Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-300">
            {/* Quick Scope Filter */}
            <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/10 w-fit">
              <span className="text-[11px] text-zinc-400 px-2 font-medium flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#B5945B]" />
                Phạm vi:
              </span>
              <button
                onClick={() => setTimeFilter("all24")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  timeFilter === "all24"
                    ? "bg-zinc-800 text-white font-bold border border-white/20"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Cả Ngày (24 Giờ)
              </button>
              <button
                onClick={() => setTimeFilter("daytime")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  timeFilter === "daytime"
                    ? "bg-amber-900/40 text-[#B5945B] font-bold border border-[#B5945B]/40"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Bỏ qua khung giờ đêm muộn để xem to rõ ban ngày"
              >
                Giờ Hoạt Động (06h - 23h)
              </button>
              <button
                onClick={() => setTimeFilter("golden")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  timeFilter === "golden"
                    ? "bg-[#B5945B] text-zinc-950 font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
                title="Xem cận cảnh khung giờ cao điểm nhất"
              >
                Giờ Vàng (17h - 23h)
              </button>
            </div>

            {/* Visual Legend */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-orange-600 to-[#B5945B]" />
                Giờ Đỉnh Điểm (Peak)
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-3 h-3 rounded-sm bg-gradient-to-t from-emerald-600 to-teal-400" />
                Giờ hiện tại
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-3 h-3 rounded-sm bg-[#B5945B]/80" />
                Lượt xem
              </span>
            </div>
          </div>

          {/* MAIN BAR CHART CONTAINER */}
          <div className="relative bg-zinc-950/80 border border-white/10 rounded-2xl p-4 sm:p-6 overflow-x-auto shadow-inner">
            {/* Background Time Periods Indicators (Sáng, Chiều, Tối, Đêm) */}
            {timeFilter === "all24" && (
              <div className="absolute top-2 left-16 right-4 flex items-center justify-between text-[10px] text-zinc-500 uppercase font-bold tracking-wider pointer-events-none pb-2 border-b border-white/5">
                <span className="flex items-center gap-1 text-indigo-400/80">
                  <Moon className="w-3 h-3" /> Đêm (00h - 06h)
                </span>
                <span className="flex items-center gap-1 text-amber-400/80">
                  <Sun className="w-3 h-3" /> Sáng (06h - 12h)
                </span>
                <span className="flex items-center gap-1 text-orange-400/80">
                  <Sun className="w-3 h-3" /> Chiều (12h - 18h)
                </span>
                <span className="flex items-center gap-1 text-[#B5945B] font-extrabold">
                  <Sunset className="w-3 h-3" /> Giờ Vàng (18h - 23h)
                </span>
              </div>
            )}

            <div className="flex items-stretch min-w-[620px] sm:min-w-0 pt-6">
              {/* Y-Axis Scale with Exact Numbers */}
              <div className="w-12 sm:w-14 flex flex-col justify-between text-right pr-2.5 pb-8 text-[11px] font-mono font-medium text-zinc-400 select-none shrink-0">
                {yAxisTicks.map((tick, tIdx) => (
                  <span key={`tick-${tick.percent}-${tIdx}`} className="leading-none">
                    {tick.label}
                  </span>
                ))}
              </div>

              {/* Chart Plot Area */}
              <div className="flex-1 relative h-64 sm:h-72 border-l border-b border-white/15 pl-1.5 sm:pl-3 pb-8">
                {/* Horizontal Dashed Reference Grid Lines */}
                <div className="absolute inset-0 pb-8 flex flex-col justify-between pointer-events-none">
                  <div className="border-b border-dashed border-white/10 w-full" />
                  <div className="border-b border-dashed border-white/10 w-full" />
                  <div className="border-b border-dashed border-white/10 w-full" />
                  <div className="border-b border-dashed border-white/10 w-full" />
                  <div className="border-b border-white/15 w-full" />
                </div>

                {/* Bars Area */}
                <div className="relative h-full flex items-end justify-between gap-1 sm:gap-2">
                  {displayedBuckets.map((bucket, bIdx) => {
                    const heightPercent =
                      maxBucketViews > 0
                        ? Math.max((bucket.views / maxBucketViews) * 100, 4)
                        : 4;
                    const isPeak = peakHour?.hour === bucket.hour && bucket.views > 0;
                    const isSelected = selectedBucket?.hour === bucket.hour;
                    const isCurrent = bucket.isCurrentHour;
                    const isGoldenTime = bucket.hour >= 18 && bucket.hour <= 22;

                    return (
                      <div
                        key={`chart-bar-${bucket.hourKey || bIdx}-${bIdx}`}
                        onClick={() => setSelectedBucket(bucket)}
                        className={`flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative transition-all ${
                          isSelected ? "z-20" : "z-10"
                        }`}
                      >
                        {/* Number Display directly on top of Bar (Always visible for Peak, Selected, or High values) */}
                        <div className="mb-1 text-center w-full flex flex-col items-center pointer-events-none">
                          {isPeak && (
                            <span className="text-orange-400 text-[10px] font-extrabold animate-bounce flex items-center justify-center">
                              <Flame className="w-3.5 h-3.5 text-orange-400" />
                            </span>
                          )}

                          <span
                            className={`text-[10px] font-bold font-mono transition-all leading-tight ${
                              isSelected
                                ? "text-[#B5945B] scale-110"
                                : isPeak
                                ? "text-orange-400"
                                : isCurrent
                                ? "text-emerald-400"
                                : bucket.views > 0
                                ? "text-zinc-400 group-hover:text-white"
                                : "text-transparent"
                            }`}
                          >
                            {bucket.views > 0 ? bucket.views : ""}
                          </span>
                        </div>

                        {/* Bar Pillar */}
                        <div
                          className={`w-full max-w-[28px] sm:max-w-[34px] rounded-t-lg relative flex items-end h-full transition-all ${
                            isSelected
                              ? "bg-zinc-800/90 ring-2 ring-[#B5945B] ring-offset-2 ring-offset-zinc-950 scale-105"
                              : "bg-zinc-900/60 group-hover:bg-zinc-800/80"
                          }`}
                        >
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${heightPercent}%` }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className={`w-full rounded-t-lg transition-all ${
                              isPeak
                                ? "bg-gradient-to-t from-orange-600 via-amber-500 to-[#B5945B] shadow-lg shadow-orange-500/20"
                                : isCurrent
                                ? "bg-gradient-to-t from-emerald-600 to-teal-400 shadow-lg shadow-emerald-500/20"
                                : isGoldenTime
                                ? "bg-gradient-to-t from-amber-700 via-amber-600 to-[#B5945B] group-hover:from-amber-600 group-hover:to-yellow-300"
                                : isSelected
                                ? "bg-gradient-to-t from-amber-600 to-[#B5945B]"
                                : "bg-gradient-to-t from-zinc-700 via-zinc-600 to-zinc-400 group-hover:from-[#B5945B]/60 group-hover:to-[#B5945B]"
                            }`}
                          />
                        </div>

                        {/* X-Axis Hour Label at Bottom */}
                        <div className="absolute -bottom-7 inset-x-0 flex flex-col items-center">
                          <span
                            className={`text-[11px] font-sans transition-colors ${
                              isSelected
                                ? "text-[#B5945B] font-black scale-110"
                                : isPeak
                                ? "text-orange-400 font-bold"
                                : isCurrent
                                ? "text-emerald-400 font-bold"
                                : "text-zinc-400 group-hover:text-zinc-200"
                            }`}
                          >
                            {/* In 24h mode, show every 2 hours, or in daytime mode show every hour */}
                            {timeFilter === "daytime" || timeFilter === "golden"
                              ? `${bucket.hourKey}h`
                              : bucket.hour % 2 === 0
                              ? `${bucket.hourKey}h`
                              : ""}
                          </span>

                          {/* Green indicator dot for current hour */}
                          {isCurrent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-0.5 animate-pulse" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Helper text under chart */}
            <div className="mt-8 pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#B5945B]" />
                <span>Nhấn hoặc chạm vào từng cột bất kỳ để xem số liệu chi tiết phía trên</span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400 font-mono">
                {totalRecordedViews > total24hViews && (
                  <span>
                    Tổng tích lũy DB: <strong className="text-[#B5945B]">{formatViewCount(totalRecordedViews)}</strong> lượt
                  </span>
                )}
                <span>
                  Lượt xem theo giờ (24h): <strong className="text-white">{formatViewCount(total24hViews)}</strong> lượt
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: CONTINUOUS TIMELINE LINE/AREA CHART */}
      {viewMode === "timeline" && svgChartData && (
        <div className="space-y-4 relative z-10">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Activity className="w-4 h-4 text-[#B5945B]" />
              Biến thiên lưu lượng truy cập mượt mà qua 24 mốc giờ liên tục
            </span>
            <span className="text-zinc-400 font-mono text-[11px]">
              Chạm vào từng điểm tròn để xem mốc giờ
            </span>
          </div>

          <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-4 sm:p-6 overflow-x-auto shadow-inner">
            <svg
              viewBox={`0 0 ${svgChartData.width} ${svgChartData.height}`}
              className="w-full h-56 min-w-[620px] overflow-visible"
            >
              <defs>
                <linearGradient id="areaGradientV2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B5945B" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#B5945B" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#B5945B" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="lineGradientV2" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#E5A93C" />
                  <stop offset="50%" stopColor="#B5945B" />
                  <stop offset="100%" stopColor="#34D399" />
                </linearGradient>
              </defs>

              {/* Horizontal Reference Lines with Labels */}
              {[1, 0.75, 0.5, 0.25, 0].map((ratio, rIdx) => {
                const y =
                  svgChartData.padding.top +
                  svgChartData.chartH -
                  ratio * svgChartData.chartH;
                const value = Math.round(maxTimelineViews * ratio);

                return (
                  <g key={`ratio-${ratio}-${rIdx}`}>
                    <line
                      x1={svgChartData.padding.left}
                      y1={y}
                      x2={svgChartData.width - svgChartData.padding.right}
                      y2={y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray={ratio > 0 && ratio < 1 ? "4 4" : undefined}
                    />
                    <text
                      x={svgChartData.padding.left - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      className="fill-zinc-400 font-mono font-medium"
                    >
                      {formatViewCount(value)}
                    </text>
                  </g>
                );
              })}

              {/* Area Wave */}
              <motion.path
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                d={svgChartData.areaD}
                fill="url(#areaGradientV2)"
              />

              {/* Spline Stroke */}
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                d={svgChartData.pathD}
                fill="none"
                stroke="url(#lineGradientV2)"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Data points */}
              {svgChartData.points.map((pt, idx) => {
                const isCurrent = pt.isCurrent;
                const isSelected = selectedBucket?.hour === pt.hour;

                return (
                  <g
                    key={`svg-pt-${pt.hour}-${idx}`}
                    className="cursor-pointer"
                    onClick={() => {
                      const matched = hourlyBuckets.find((b) => b.hour === pt.hour);
                      if (matched) setSelectedBucket(matched);
                    }}
                  >
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6.5 : isCurrent ? 5 : 3.5}
                      className={
                        isSelected
                          ? "fill-white stroke-[#B5945B] stroke-[3px]"
                          : isCurrent
                          ? "fill-emerald-400 stroke-zinc-950 stroke-2 animate-pulse"
                          : "fill-[#B5945B] hover:fill-white hover:scale-125 transition-all"
                      }
                    />

                    {/* Timeline X-Labels */}
                    {idx % 2 === 0 && (
                      <text
                        x={pt.x}
                        y={svgChartData.baselineY + 20}
                        textAnchor="middle"
                        fontSize="10"
                        className={
                          isSelected
                            ? "fill-[#B5945B] font-bold"
                            : isCurrent
                            ? "fill-emerald-400 font-bold"
                            : "fill-zinc-400"
                        }
                      >
                        {pt.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: TOP PEAK HOURS RANKING (Dạng xếp hạng cực kỳ dễ đọc) */}
      {viewMode === "ranking" && (
        <div className="space-y-4 relative z-10">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
              <Trophy className="w-4 h-4 text-[#B5945B]" />
              Xếp hạng 6 Khung Giờ Có Lượt Xem Cao Nhất Trong Ngày
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rankedHours.map((bucket, index) => {
              const isFirst = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;
              const isSelected = selectedBucket?.hour === bucket.hour;

              return (
                <div
                  key={`ranked-hour-${bucket.hourKey || index}-${index}`}
                  onClick={() => setSelectedBucket(bucket)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-zinc-900 border-[#B5945B] ring-1 ring-[#B5945B] shadow-lg shadow-[#B5945B]/20"
                      : isFirst
                      ? "bg-gradient-to-br from-amber-950/40 via-zinc-900 to-black border-amber-500/40 hover:border-amber-500/70"
                      : "bg-zinc-900/60 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                          isFirst
                            ? "bg-gradient-to-br from-amber-400 to-yellow-600 text-zinc-950"
                            : isSecond
                            ? "bg-zinc-300 text-zinc-950"
                            : isThird
                            ? "bg-amber-700 text-white"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        #{index + 1}
                      </div>
                      <span className="text-sm font-bold text-white">
                        {bucket.label} - {String((bucket.hour + 1) % 24).padStart(2, "0")}:00
                      </span>
                    </div>

                    <span className="text-xs font-bold text-[#B5945B] px-2 py-0.5 rounded-full bg-[#B5945B]/10 border border-[#B5945B]/30">
                      {bucket.segmentName}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mt-3">
                    <span className="text-2xl font-extrabold text-white">
                      {formatViewCount(bucket.views)}{" "}
                      <span className="text-xs font-normal text-zinc-400">lượt</span>
                    </span>
                    <span className="text-xs font-bold text-[#B5945B]">
                      {bucket.percent}% tổng ngày
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full ${
                        isFirst
                          ? "bg-gradient-to-r from-orange-500 to-amber-300"
                          : "bg-gradient-to-r from-[#B5945B] to-amber-500"
                      }`}
                      style={{
                        width: `${Math.max(
                          (bucket.views / (rankedHours[0]?.views || 1)) * 100,
                          8
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 4: 4 TIME SEGMENTS CARDS (Sáng, Chiều, Tối, Đêm) */}
      {viewMode === "segments" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {segmentsSummary.map((seg, sIdx) => {
            const isGolden = seg.key === "evening";

            return (
              <div
                key={`segment-${seg.key || sIdx}-${sIdx}`}
                className={`p-4 rounded-xl border transition-all ${
                  isGolden
                    ? "bg-gradient-to-br from-amber-950/40 via-zinc-900 to-black border-[#B5945B]/60 shadow-lg shadow-amber-950/30 ring-1 ring-[#B5945B]/30"
                    : "bg-zinc-900/60 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      seg.iconType === "morning"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : seg.iconType === "afternoon"
                        ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                        : seg.iconType === "evening"
                        ? "bg-[#B5945B]/20 text-[#B5945B] border border-[#B5945B]/40"
                        : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"
                    }`}
                  >
                    {seg.iconType === "morning" && <Sun className="w-5 h-5" />}
                    {seg.iconType === "afternoon" && <Sun className="w-5 h-5" />}
                    {seg.iconType === "evening" && <Sunset className="w-5 h-5" />}
                    {seg.iconType === "night" && <Moon className="w-5 h-5" />}
                  </div>

                  {isGolden && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Khung Giờ Vàng
                    </span>
                  )}
                </div>

                <h5 className="font-bold text-white text-base">{seg.title}</h5>
                <span className="text-xs text-zinc-400 block mt-0.5">{seg.hoursRange}</span>

                <div className="flex items-baseline justify-between mt-4">
                  <span className="text-2xl font-extrabold text-white">
                    {formatViewCount(seg.views)}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      isGolden ? "text-[#B5945B]" : "text-zinc-400"
                    }`}
                  >
                    {seg.percent}% trong ngày
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mt-3">
                  <div
                    className={`h-full rounded-full ${
                      isGolden
                        ? "bg-gradient-to-r from-[#B5945B] to-amber-400"
                        : "bg-zinc-600"
                    }`}
                    style={{ width: `${Math.max(seg.percent, 5)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Strategic Golden Window Insight Banner */}
      <div className="relative z-10 bg-gradient-to-r from-[#B5945B]/15 via-amber-900/10 to-transparent border border-[#B5945B]/35 rounded-2xl p-4 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-[#B5945B]/20 text-[#B5945B] shrink-0 mt-0.5">
          <Info className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-1">
          <span className="font-bold text-[#B5945B] block uppercase tracking-wider text-xs">
            Gợi Ý Chiến Lược Đăng Album & Tư Vấn Chốt Lịch
          </span>
          <p className="text-zinc-300 leading-relaxed text-xs sm:text-[13px]">{smartAdvice}</p>
        </div>
      </div>
    </div>
  );
};
