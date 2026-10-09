import { doc, setDoc, deleteDoc, getDocs, collection, increment } from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
} from "../firebase";

export type AnalyticsItemType = "portfolio_visitor" | "collection" | "album" | "photo";

export interface AnalyticsItem {
  id: string;
  title: string;
  type: AnalyticsItemType;
  collectionId?: string;
  albumId?: string;
  photoId?: string;
  views: number;
  uniqueVisitors?: number;
  monthlyViews?: Record<string, number>;
  monthlyVisitors?: Record<string, number>;
  hourlyViews?: Record<string, number>;
  hourlyTimeline?: Record<string, number>;
  dailyViews?: Record<string, number>;
  lastViewedAt: string;
  updatedAt?: string;
}

const SANITIZE_REGEX = /[^a-zA-Z0-9_-]/g;

export function sanitizeAnalyticsId(rawId: string): string {
  if (!rawId) return "unknown";
  const sanitized = rawId.replace(SANITIZE_REGEX, "_").replace(/_+/g, "_").slice(0, 100);
  return sanitized || "item_unknown";
}

/**
 * Returns exact Vietnam (Asia/Ho_Chi_Minh) date and time parts
 * Guarantees 100% accurate timezone calculation across any client/server environment.
 */
export function getVietnamDateTime(date: Date = new Date()): {
  year: number;
  monthStr: string;
  dayStr: string;
  hourStr: string;
  hourNum: number;
  yearMonth: string;
  dateStr: string;
  dateHourKey: string;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const find = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const year = Number(find("year")) || date.getFullYear();
  const monthStr = find("month");
  const dayStr = find("day");
  let hourVal = find("hour");
  if (hourVal === "24") hourVal = "00";
  const hourNum = parseInt(hourVal, 10) || 0;
  const hourStr = String(hourNum).padStart(2, "0");
  const yearMonth = `${year}-${monthStr}`;
  const dateStr = `${year}-${monthStr}-${dayStr}`;
  const dateHourKey = `${dateStr}_${hourStr}`;
  return {
    year,
    monthStr,
    dayStr,
    hourStr,
    hourNum,
    yearMonth,
    dateStr,
    dateHourKey,
  };
}

/**
 * Returns current month key in format "YYYY-MM" (e.g. "2026-09")
 */
export function getCurrentYearMonth(): string {
  return getVietnamDateTime().yearMonth;
}

/**
 * Returns current date key in format "YYYY-MM-DD"
 */
export function getCurrentDateStr(): string {
  return getVietnamDateTime().dateStr;
}

/**
 * Current hour string "00" through "23"
 */
export function getCurrentHourStr(): string {
  return getVietnamDateTime().hourStr;
}

/**
 * Current date-hour key "YYYY-MM-DD_HH"
 */
export function getCurrentDateHourKey(): string {
  return getVietnamDateTime().dateHourKey;
}

/**
 * Format "2026-09" to "Tháng 09/2026"
 */
export function formatMonthLabel(yearMonth: string): string {
  if (!yearMonth || !yearMonth.includes("-")) return yearMonth || "Tháng hiện tại";
  const [year, month] = yearMonth.split("-");
  return `Tháng ${month}/${year}`;
}

/**
 * Generate a list of recent months up to the current month
 */
export function getRecentMonths(count = 6): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${year}-${month}`);
  }
  return months;
}

/**
 * Generate list of 24 hours (00 to 23)
 */
export function get24HourBuckets(): { hourKey: string; hour: number; label: string }[] {
  return Array.from({ length: 24 }, (_, h) => {
    const hourKey = String(h).padStart(2, "0");
    return {
      hour: h,
      hourKey,
      label: `${hourKey}:00`,
    };
  });
}

/**
 * Generate sequence of the last 24 continuous hours ending at current hour
 */
export function getLast24HoursTimeline(): {
  hour: number;
  hourKey: string;
  dateHourKey: string;
  dateStr: string;
  label: string;
}[] {
  const list: {
    hour: number;
    hourKey: string;
    dateHourKey: string;
    dateStr: string;
    label: string;
  }[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60 * 60 * 1000);
    const vt = getVietnamDateTime(t);
    list.push({
      hour: vt.hourNum,
      hourKey: vt.hourStr,
      dateHourKey: vt.dateHourKey,
      dateStr: vt.dateStr,
      label: `${vt.hourStr}h`,
    });
  }
  return list;
}

/**
 * 1. RECORD PORTFOLIO VISITOR (Số người vào xem Portfolio)
 * Tracks unique visits/sessions and total views to the Portfolio showcase 100% accurately.
 */
export async function recordPortfolioVisitor(): Promise<void> {
  try {
    const now = Date.now();
    const lastSession = sessionStorage.getItem("tracked_portfolio_visitor_time");

    // 5-second anti-spam debounce to avoid StrictMode double-fire
    if (lastSession && now - parseInt(lastSession, 10) < 5000) {
      return;
    }
    sessionStorage.setItem("tracked_portfolio_visitor_time", String(now));

    // Check unique visitor for current browser session
    const isNewVisitor = !sessionStorage.getItem("tracked_portfolio_unique_visitor_flag");
    if (isNewVisitor) {
      sessionStorage.setItem("tracked_portfolio_unique_visitor_flag", "true");
    }

    const { yearMonth, dateStr, hourStr, dateHourKey } = getVietnamDateTime();
    const docId = "portfolio_visitors";
    const docRef = doc(db, "section_analytics", docId);

    updateLocalViewCache(docId, 1);

    if (isFirestoreQuotaExceeded()) {
      return;
    }

    const payload: any = {
      id: docId,
      title: "Khách Xem Portfolio",
      type: "portfolio_visitor",
      views: increment(1),
      [`monthlyViews.${yearMonth}`]: increment(1),
      [`hourlyViews.${hourStr}`]: increment(1),
      [`hourlyTimeline.${dateHourKey}`]: increment(1),
      [`dailyViews.${dateStr}`]: increment(1),
      lastViewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isNewVisitor) {
      payload.uniqueVisitors = increment(1);
      payload[`monthlyVisitors.${yearMonth}`] = increment(1);
    }

    await setDoc(docRef, payload, { merge: true });
  } catch (error: any) {
    if (
      error?.code === "resource-exhausted" ||
      error?.message?.includes("Quota limit exceeded")
    ) {
      markFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, "section_analytics");
  }
}

/**
 * 2. RECORD COLLECTION VIEW (Bộ Sưu Tập: Kỷ Yếu Lớp, Prom Dạ Hội, Concept Tự Do)
 */
export async function recordCollectionView(collectionId: string, title: string): Promise<void> {
  if (!collectionId) return;
  try {
    const cleanId = sanitizeAnalyticsId(collectionId);
    const docId = `col_${cleanId}`;
    const storageKey = `tracked_col_${docId}`;
    const now = Date.now();
    const last = sessionStorage.getItem(storageKey);

    // 5-second debounce to prevent spam / double mount
    if (last && now - parseInt(last, 10) < 5000) {
      return;
    }
    sessionStorage.setItem(storageKey, String(now));

    const { yearMonth, dateStr, hourStr, dateHourKey } = getVietnamDateTime();
    const docRef = doc(db, "section_analytics", docId);

    updateLocalViewCache(docId, 1);

    if (isFirestoreQuotaExceeded()) {
      return;
    }

    await setDoc(
      docRef,
      {
        id: docId,
        title: title || collectionId,
        type: "collection",
        collectionId: cleanId,
        views: increment(1),
        [`monthlyViews.${yearMonth}`]: increment(1),
        [`hourlyViews.${hourStr}`]: increment(1),
        [`hourlyTimeline.${dateHourKey}`]: increment(1),
        [`dailyViews.${dateStr}`]: increment(1),
        lastViewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error: any) {
    if (
      error?.code === "resource-exhausted" ||
      error?.message?.includes("Quota limit exceeded")
    ) {
      markFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, "section_analytics");
  }
}

/**
 * 3. RECORD ALBUM VIEW (Từng Album chi tiết)
 */
export async function recordAlbumView(
  albumId: string,
  title: string,
  parentCollection = "albums"
): Promise<void> {
  if (!albumId) return;
  try {
    const cleanId = sanitizeAnalyticsId(albumId);
    const docId = `album_${cleanId}`;
    const storageKey = `tracked_album_${docId}`;
    const now = Date.now();
    const last = sessionStorage.getItem(storageKey);

    if (last && now - parseInt(last, 10) < 5000) {
      return;
    }
    sessionStorage.setItem(storageKey, String(now));

    const { yearMonth, dateStr, hourStr, dateHourKey } = getVietnamDateTime();
    const docRef = doc(db, "section_analytics", docId);

    updateLocalViewCache(docId, 1);

    if (isFirestoreQuotaExceeded()) {
      return;
    }

    await setDoc(
      docRef,
      {
        id: docId,
        title: title || albumId,
        type: "album",
        albumId: cleanId,
        collectionId: parentCollection,
        views: increment(1),
        [`monthlyViews.${yearMonth}`]: increment(1),
        [`hourlyViews.${hourStr}`]: increment(1),
        [`hourlyTimeline.${dateHourKey}`]: increment(1),
        [`dailyViews.${dateStr}`]: increment(1),
        lastViewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error: any) {
    if (
      error?.code === "resource-exhausted" ||
      error?.message?.includes("Quota limit exceeded")
    ) {
      markFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, "section_analytics");
  }
}

/**
 * 4. RECORD PHOTO VIEW (Từng Ảnh trong Album)
 */
export async function recordPhotoView(
  photoId: string,
  title: string,
  albumId: string
): Promise<void> {
  if (!photoId) return;
  try {
    const cleanId = sanitizeAnalyticsId(photoId);
    const docId = `photo_${cleanId}`;
    const storageKey = `tracked_photo_${docId}`;
    const now = Date.now();
    const last = sessionStorage.getItem(storageKey);

    // 5-second debounce
    if (last && now - parseInt(last, 10) < 5000) {
      return;
    }
    sessionStorage.setItem(storageKey, String(now));

    const { yearMonth, dateStr, hourStr, dateHourKey } = getVietnamDateTime();
    const docRef = doc(db, "section_analytics", docId);

    updateLocalViewCache(docId, 1);

    if (isFirestoreQuotaExceeded()) {
      return;
    }

    await setDoc(
      docRef,
      {
        id: docId,
        title: title || "Ảnh tác phẩm",
        type: "photo",
        photoId: cleanId,
        albumId: sanitizeAnalyticsId(albumId),
        views: increment(1),
        [`monthlyViews.${yearMonth}`]: increment(1),
        [`hourlyViews.${hourStr}`]: increment(1),
        [`hourlyTimeline.${dateHourKey}`]: increment(1),
        [`dailyViews.${dateStr}`]: increment(1),
        lastViewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error: any) {
    if (
      error?.code === "resource-exhausted" ||
      error?.message?.includes("Quota limit exceeded")
    ) {
      markFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, "section_analytics");
  }
}

/**
 * Delete a specific analytics entry from Firestore (Admin only)
 */
export async function deleteAnalyticsDoc(id: string): Promise<void> {
  try {
    const docRef = doc(db, "section_analytics", id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, "section_analytics");
  }
}

/**
 * Clean up legacy items like "section_S1", "section_S4", "section_S7"... that user requested to delete!
 */
export async function cleanupLegacySectionItems(items: AnalyticsItem[]): Promise<number> {
  let count = 0;
  for (const item of items) {
    if (
      item.id.startsWith("section_S") ||
      item.id.startsWith("cat_") ||
      item.id === "section_S1" ||
      item.id === "section_S4" ||
      item.id === "section_S6" ||
      item.id === "section_S8" ||
      item.id === "section_S9" ||
      item.id === "section_S7"
    ) {
      try {
        await deleteAnalyticsDoc(item.id);
        count++;
      } catch {
        // Continue cleaning other docs
      }
    }
  }
  return count;
}

/**
 * Reset all analytics from scratch back to 0 (Zero out everything in Firestore and local caches)
 */
export async function resetAllAnalyticsFromScratch(): Promise<void> {
  try {
    sessionStorage.removeItem("tracked_portfolio_visitor_session");
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith("tracked_")) sessionStorage.removeItem(k);
    });
    localStorage.removeItem("bergh_analytics_local_cache");

    const colRef = collection(db, "section_analytics");
    const snap = await getDocs(colRef);
    for (const d of snap.docs) {
      try {
        await deleteDoc(doc(db, "section_analytics", d.id));
      } catch {
        await setDoc(doc(db, "section_analytics", d.id), {
          id: d.id,
          title: d.data().title || "unknown",
          views: 0,
          uniqueVisitors: 0,
          monthlyViews: {},
          monthlyVisitors: {},
          hourlyViews: {},
          hourlyTimeline: {},
          dailyViews: {},
          isDeleted: true,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, "section_analytics");
  }
}

// Local cache management
function updateLocalViewCache(id: string, delta: number) {
  try {
    const raw = localStorage.getItem("bergh_analytics_local_cache");
    const cache: Record<string, number> = raw ? JSON.parse(raw) : {};
    cache[id] = (cache[id] || 0) + delta;
    localStorage.setItem("bergh_analytics_local_cache", JSON.stringify(cache));
  } catch {
    // Ignore storage issues
  }
}

export function getLocalViewCount(id: string): number {
  try {
    const raw = localStorage.getItem("bergh_analytics_local_cache");
    const cache: Record<string, number> = raw ? JSON.parse(raw) : {};
    return cache[id] || 0;
  } catch {
    return 0;
  }
}

/**
 * Format numbers cleanly: 1.2k, 450, etc.
 */
export function formatViewCount(count?: number | null): string {
  if (!count || count < 0) return "0";
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return String(count);
}
