import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType, markFirestoreQuotaExceeded } from "../firebase";
import {
  AnalyticsItem,
  getCurrentYearMonth,
  getRecentMonths,
  formatViewCount,
  cleanupLegacySectionItems,
  resetAllAnalyticsFromScratch,
  deleteAnalyticsDoc,
  sanitizeAnalyticsId,
  get24HourBuckets,
  getLast24HoursTimeline,
  getCurrentHourStr,
} from "../services/analyticsService";

export interface HourlyDataPoint {
  hour: number;
  hourKey: string;
  label: string;
  views: number;
  percent: number;
  isCurrentHour: boolean;
  segmentName: string;
  segmentType: "night" | "morning" | "noon" | "afternoon" | "evening";
}

export interface HourlyTimelinePoint {
  hour: number;
  hourKey: string;
  dateStr: string;
  dateHourKey: string;
  label: string;
  views: number;
  isCurrent: boolean;
}

export interface TimeSegmentSummary {
  key: string;
  title: string;
  hoursRange: string;
  views: number;
  percent: number;
  iconType: "morning" | "afternoon" | "evening" | "night";
}

export interface HourlyStatsResult {
  hourlyBuckets: HourlyDataPoint[];
  timelineLast24h: HourlyTimelinePoint[];
  segmentsSummary: TimeSegmentSummary[];
  peakHour: HourlyDataPoint | null;
  total24hViews: number;
  totalRecordedViews: number;
  currentHourViews: number;
  smartAdvice: string;
}

// Clean initial state with 0 baseline - pure tracking starting from now
const DEFAULT_PORTFOLIO_SEEDS: Record<string, AnalyticsItem> = {
  portfolio_visitors: {
    id: "portfolio_visitors",
    title: "Khách Xem Portfolio",
    type: "portfolio_visitor",
    views: 0,
    uniqueVisitors: 0,
    monthlyViews: {},
    monthlyVisitors: {},
    hourlyViews: {},
    hourlyTimeline: {},
    dailyViews: {},
    lastViewedAt: new Date().toISOString(),
  },
  col_albums: {
    id: "col_albums",
    title: "Kỷ Yếu Học Đường (Lớp / THPT)",
    type: "collection",
    collectionId: "albums",
    views: 0,
    monthlyViews: {},
    hourlyViews: {},
    hourlyTimeline: {},
    dailyViews: {},
    lastViewedAt: new Date().toISOString(),
  },
  col_prom_albums: {
    id: "col_prom_albums",
    title: "Prom Night & Dạ Hội Học Đường",
    type: "collection",
    collectionId: "prom_albums",
    views: 0,
    monthlyViews: {},
    hourlyViews: {},
    hourlyTimeline: {},
    dailyViews: {},
    lastViewedAt: new Date().toISOString(),
  },
  col_freedom_albums: {
    id: "col_freedom_albums",
    title: "Concept Nghệ Thuật & Tự Do",
    type: "collection",
    collectionId: "freedom_albums",
    views: 0,
    monthlyViews: {},
    hourlyViews: {},
    hourlyTimeline: {},
    dailyViews: {},
    lastViewedAt: new Date().toISOString(),
  },
};

export function useSectionAnalytics() {
  const [items, setItems] = useState<Record<string, AnalyticsItem>>(() => ({
    ...DEFAULT_PORTFOLIO_SEEDS,
  }));
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  useEffect(() => {
    const colRef = collection(db, "section_analytics");

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const newMap: Record<string, AnalyticsItem> = { ...DEFAULT_PORTFOLIO_SEEDS };

        snapshot.forEach((docSnap) => {
          const rawData = (docSnap.data() || {}) as any;
          if (rawData && rawData.id) {
            // Ignore legacy section_S*, cat_*, or soft-deleted items
            if (
              rawData.id.startsWith("section_S") ||
              rawData.id.startsWith("cat_") ||
              rawData.isDeleted
            ) {
              return;
            }

            const hourlyViews: Record<string, number> = {
              ...(typeof rawData.hourlyViews === "object" ? rawData.hourlyViews : {}),
            };
            const monthlyViews: Record<string, number> = {
              ...(typeof rawData.monthlyViews === "object" ? rawData.monthlyViews : {}),
            };
            const monthlyVisitors: Record<string, number> = {
              ...(typeof rawData.monthlyVisitors === "object" ? rawData.monthlyVisitors : {}),
            };
            const dailyViews: Record<string, number> = {
              ...(typeof rawData.dailyViews === "object" ? rawData.dailyViews : {}),
            };
            const hourlyTimeline: Record<string, number> = {
              ...(typeof rawData.hourlyTimeline === "object" ? rawData.hourlyTimeline : {}),
            };

            Object.entries(rawData).forEach(([k, v]) => {
              if (k.startsWith("hourlyViews.")) {
                hourlyViews[k.slice(12)] = Number(v) || 0;
              } else if (k.startsWith("monthlyViews.")) {
                monthlyViews[k.slice(13)] = Number(v) || 0;
              } else if (k.startsWith("monthlyVisitors.")) {
                monthlyVisitors[k.slice(16)] = Number(v) || 0;
              } else if (k.startsWith("dailyViews.")) {
                dailyViews[k.slice(11)] = Number(v) || 0;
              } else if (k.startsWith("hourlyTimeline.")) {
                hourlyTimeline[k.slice(15)] = Number(v) || 0;
              }
            });

            newMap[rawData.id] = {
              ...rawData,
              views: Number(rawData.views) || 0,
              uniqueVisitors: Number(rawData.uniqueVisitors) || 0,
              monthlyViews,
              monthlyVisitors,
              hourlyViews,
              hourlyTimeline,
              dailyViews,
            };
          }
        });

        setItems(newMap);
        setLoading(false);
      },
      (error: any) => {
        if (
          error?.code === "resource-exhausted" ||
          error?.message?.includes("Quota limit exceeded")
        ) {
          markFirestoreQuotaExceeded();
          setLoading(false);
          return;
        }
        handleFirestoreError(error, OperationType.GET, "section_analytics");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute available months
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>(getRecentMonths(6));
    const allItems: AnalyticsItem[] = Object.values(items);
    allItems.forEach((item) => {
      if (item.monthlyViews) {
        Object.keys(item.monthlyViews).forEach((m) => monthSet.add(m));
      }
    });
    return Array.from(monthSet).sort().reverse();
  }, [items]);

  // Helper to get view count of an item according to selectedMonth
  const getItemViews = useCallback(
    (id: string, targetMonth = selectedMonth): number => {
      const item = items[id];
      if (!item) return 0;
      if (targetMonth === "all") {
        return item.views || 0;
      }
      return item.monthlyViews?.[targetMonth] || 0;
    },
    [items, selectedMonth]
  );

  // Hourly statistics calculation - 100% REAL DATA, NO SIMULATION
  const getHourlyStats = useCallback(
    (targetItemId = "all"): HourlyStatsResult => {
      const currentHour = new Date().getHours();

      // Aggregate hourly maps
      const aggregatedHourly: Record<string, number> = {};
      const aggregatedTimeline: Record<string, number> = {};

      const itemsToConsider: AnalyticsItem[] =
        targetItemId === "all"
          ? Object.values(items)
          : items[targetItemId]
          ? [items[targetItemId]]
          : [];

      itemsToConsider.forEach((item) => {
        if (item.hourlyViews) {
          Object.entries(item.hourlyViews).forEach(([hKey, count]) => {
            aggregatedHourly[hKey] = (aggregatedHourly[hKey] || 0) + (Number(count) || 0);
          });
        }
        if (item.hourlyTimeline) {
          Object.entries(item.hourlyTimeline).forEach(([dtKey, count]) => {
            aggregatedTimeline[dtKey] = (aggregatedTimeline[dtKey] || 0) + (Number(count) || 0);
          });
        }
      });

      // Total all-time views strictly from Firestore database
      const totalRecordedViews = itemsToConsider.reduce((sum, it) => sum + (it.views || 0), 0);

      // Total hourly views strictly from real recorded hourly buckets
      const totalHourlyViews = Object.values(aggregatedHourly).reduce((s, v) => s + v, 0);

      // 24 Hour Buckets (00:00 to 23:00) - 100% real numbers
      const rawBuckets = get24HourBuckets();

      const hourlyBuckets: HourlyDataPoint[] = rawBuckets.map(({ hour, hourKey, label }) => {
        const views = aggregatedHourly[hourKey] || 0;
        const percent = totalHourlyViews > 0 ? Math.round((views / totalHourlyViews) * 100) : 0;
        const isCurrentHour = hour === currentHour;

        let segmentName = "Đêm muộn";
        let segmentType: HourlyDataPoint["segmentType"] = "night";
        if (hour >= 6 && hour < 12) {
          segmentName = "Buổi sáng";
          segmentType = "morning";
        } else if (hour >= 12 && hour < 14) {
          segmentName = "Nghỉ trưa";
          segmentType = "noon";
        } else if (hour >= 14 && hour < 18) {
          segmentName = "Buổi chiều";
          segmentType = "afternoon";
        } else if (hour >= 18 && hour < 23) {
          segmentName = "Buổi tối";
          segmentType = "evening";
        }

        return {
          hour,
          hourKey,
          label,
          views,
          percent,
          isCurrentHour,
          segmentName,
          segmentType,
        };
      });

      // Find peak hour ONLY if views > 0
      let peakHour: HourlyDataPoint | null = null;
      let maxViews = 0;
      hourlyBuckets.forEach((b) => {
        if (b.views > maxViews) {
          maxViews = b.views;
          peakHour = b;
        }
      });

      // 24 Hour continuous timeline - 100% real counts
      const rawTimeline = getLast24HoursTimeline();
      const timelineLast24h: HourlyTimelinePoint[] = rawTimeline.map(
        ({ hour, hourKey, dateStr, dateHourKey, label }) => {
          const views = aggregatedTimeline[dateHourKey] || 0;
          return {
            hour,
            hourKey,
            dateStr,
            dateHourKey,
            label,
            views,
            isCurrent: hour === currentHour,
          };
        }
      );

      // 4 Time Segments Summary
      const segMorningViews = hourlyBuckets
        .filter((b) => b.hour >= 6 && b.hour < 12)
        .reduce((s, b) => s + b.views, 0);
      const segAfternoonViews = hourlyBuckets
        .filter((b) => b.hour >= 12 && b.hour < 18)
        .reduce((s, b) => s + b.views, 0);
      const segEveningViews = hourlyBuckets
        .filter((b) => b.hour >= 18 && b.hour < 23)
        .reduce((s, b) => s + b.views, 0);
      const segNightViews = hourlyBuckets
        .filter((b) => b.hour >= 23 || b.hour < 6)
        .reduce((s, b) => s + b.views, 0);

      const sumSeg = segMorningViews + segAfternoonViews + segEveningViews + segNightViews || 1;

      const segmentsSummary: TimeSegmentSummary[] = [
        {
          key: "morning",
          title: "Buổi Sáng",
          hoursRange: "06:00 - 11:59",
          views: segMorningViews,
          percent: totalHourlyViews > 0 ? Math.round((segMorningViews / sumSeg) * 100) : 0,
          iconType: "morning",
        },
        {
          key: "afternoon",
          title: "Buổi Chiều",
          hoursRange: "12:00 - 17:59",
          views: segAfternoonViews,
          percent: totalHourlyViews > 0 ? Math.round((segAfternoonViews / sumSeg) * 100) : 0,
          iconType: "afternoon",
        },
        {
          key: "evening",
          title: "Buổi Tối (Giờ Vàng)",
          hoursRange: "18:00 - 22:59",
          views: segEveningViews,
          percent: totalHourlyViews > 0 ? Math.round((segEveningViews / sumSeg) * 100) : 0,
          iconType: "evening",
        },
        {
          key: "night",
          title: "Đêm Khuya",
          hoursRange: "23:00 - 05:59",
          views: segNightViews,
          percent: totalHourlyViews > 0 ? Math.round((segNightViews / sumSeg) * 100) : 0,
          iconType: "night",
        },
      ];

      const currentHourBucket = hourlyBuckets.find((b) => b.isCurrentHour);
      const currentHourViews = currentHourBucket ? currentHourBucket.views : 0;

      // Generate strategic advice from real peak data
      let smartAdvice =
        "Dữ liệu đang được đồng bộ thời gian thực 100% từ Firestore. Khi có thêm lượt truy cập trong ngày, hệ thống sẽ tự động cập nhật phân tích khung giờ vàng.";
      if (peakHour && (peakHour as HourlyDataPoint).views > 0) {
        const nextHour = ((peakHour as HourlyDataPoint).hour + 1) % 24;
        const nextHourStr = String(nextHour).padStart(2, "0") + ":00";
        smartAdvice = `Lượng truy cập thực tế đạt đỉnh điểm vào lúc ${(peakHour as HourlyDataPoint).label} - ${nextHourStr} (${(peakHour as HourlyDataPoint).views} lượt xem). Bạn nên đăng tải bộ sưu tập mới hoặc phản hồi tư vấn trước khung giờ này 30 phút để tối ưu tỷ lệ chốt lịch!`;
      } else if (totalRecordedViews > 0) {
        smartAdvice = `Hệ thống ghi nhận tổng cộng ${totalRecordedViews} lượt xem thực tế trong cơ sở dữ liệu. Mọi lượt xem mới phát sinh sẽ được ghi nhận tức thì theo từng mốc giờ.`;
      }

      return {
        hourlyBuckets,
        timelineLast24h,
        segmentsSummary,
        peakHour,
        total24hViews: totalHourlyViews,
        totalRecordedViews,
        currentHourViews,
        smartAdvice,
      };
    },
    [items]
  );

  // Portfolio visitor item
  const portfolioVisitorItem = useMemo(() => {
    return items["portfolio_visitors"] || DEFAULT_PORTFOLIO_SEEDS["portfolio_visitors"];
  }, [items]);

  const portfolioVisitorsCount = useMemo(() => {
    if (selectedMonth === "all") {
      return portfolioVisitorItem?.uniqueVisitors || portfolioVisitorItem?.views || 0;
    }
    return (
      portfolioVisitorItem?.monthlyVisitors?.[selectedMonth] ||
      portfolioVisitorItem?.monthlyViews?.[selectedMonth] ||
      0
    );
  }, [portfolioVisitorItem, selectedMonth]);

  // Collections list (sorted by selected month's views)
  const collectionsList = useMemo(() => {
    const allItems: AnalyticsItem[] = Object.values(items);
    return allItems
      .filter((item) => item.type === "collection")
      .map((item) => ({
        ...item,
        currentViews: selectedMonth === "all" ? item.views : item.monthlyViews?.[selectedMonth] || 0,
      }))
      .sort((a, b) => b.currentViews - a.currentViews);
  }, [items, selectedMonth]);

  // Albums list (sorted by selected month's views)
  const albumsList = useMemo(() => {
    const allItems: AnalyticsItem[] = Object.values(items);
    return allItems
      .filter((item) => item.type === "album")
      .map((item) => ({
        ...item,
        currentViews: selectedMonth === "all" ? item.views : item.monthlyViews?.[selectedMonth] || 0,
      }))
      .sort((a, b) => b.currentViews - a.currentViews);
  }, [items, selectedMonth]);

  // Photos list
  const photosList = useMemo(() => {
    const allItems: AnalyticsItem[] = Object.values(items);
    return allItems
      .filter((item) => item.type === "photo")
      .map((item) => ({
        ...item,
        currentViews: selectedMonth === "all" ? item.views : item.monthlyViews?.[selectedMonth] || 0,
      }))
      .sort((a, b) => b.currentViews - a.currentViews);
  }, [items, selectedMonth]);

  // Total views across portfolio collections & albums for selected month
  const totalPortfolioViews = useMemo(() => {
    const list = [...collectionsList, ...albumsList];
    return list.reduce((sum, item) => sum + (item.currentViews || 0), 0);
  }, [collectionsList, albumsList]);

  // Top item
  const topCollection = collectionsList[0] || null;
  const topAlbum = albumsList[0] || null;

  // Cleanup helper
  const purgeLegacySections = useCallback(async () => {
    return await cleanupLegacySectionItems(Object.values(items));
  }, [items]);

  // Reset all analytics back to 0
  const resetAll = useCallback(async () => {
    await resetAllAnalyticsFromScratch();
    setItems({ ...DEFAULT_PORTFOLIO_SEEDS });
  }, []);

  return {
    items,
    loading,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    portfolioVisitorItem,
    portfolioVisitorsCount,
    collectionsList,
    albumsList,
    photosList,
    totalPortfolioViews,
    topCollection,
    topAlbum,
    getItemViews,
    purgeLegacySections,
    resetAll,
    deleteAnalyticsDoc,
    formatViewCount,
    getHourlyStats,
  };
}
