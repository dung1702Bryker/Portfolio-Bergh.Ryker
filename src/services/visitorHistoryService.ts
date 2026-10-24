import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  arrayUnion,
  increment,
} from "firebase/firestore";
import {
  db,
  cleanFirestoreData,
  handleFirestoreError,
  OperationType,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
} from "../firebase";
import { stripIspFromName } from "./geoService";
import { getDetailedDeviceLabel } from "./deviceFingerprintService";

/**
 * Detect social in-app browsers (Zalo, Facebook, Instagram)
 * Returns label or null for regular browsers.
 */
export function getSocialSourceLabel(browser = "", userAgent = ""): string | null {
  const norm = `${browser} ${userAgent}`.toLowerCase();
  if (norm.includes("zalo")) return "Mở từ Zalo";
  if (norm.includes("facebook") || norm.includes("fbav") || norm.includes("fban")) return "Mở từ Facebook";
  if (norm.includes("instagram")) return "Mở từ Instagram";
  return null;
}

/**
 * Clean device classification (Zero false screen-size guessing)
 */
export function sanitizeDeviceLabel(rawDevice = "", _screenResolution = ""): string {
  if (!rawDevice) return "Thiết bị di động";
  const trimmed = rawDevice.trim();
  if (trimmed.includes("iPhone")) return "Điện thoại";
  if (trimmed.includes("iPad")) return "Máy tính bảng";
  if (trimmed.includes("Mac") || trimmed.includes("Macintosh")) return "Máy tính";
  if (trimmed.includes("Windows") || trimmed.includes("PC")) return "Máy tính";
  if (trimmed.includes("Android")) return "Điện thoại Android";
  return "Thiết bị di động";
}

export interface VisitorHistoryItem {
  id: string;
  visitorId: string;
  deviceId?: string;
  visitorName: string;
  role: "visitor" | "admin";
  isAdminDevice?: boolean;
  isReturning?: boolean;
  visitCount?: number;
  device: string;
  browser: string;
  screenResolution?: string;
  ip?: string;
  rawIp?: string;
  location?: string;
  fullLocation?: string;
  ward?: string;
  district?: string;
  province?: string;
  fullAddress?: string;
  accuracyMeters?: number;
  locationSource?: "GPS" | "IP" | "MANUAL";
  isp?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  entryPage: string;
  lastPage: string;
  lastViewDetail?: string;
  visitedPages: string[];
  pageViews: number;
  browserVersion?: string;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

const LOCAL_STORAGE_KEY = "bergh_ryker_visitor_history_cache_v2";
const MAX_LOCAL_RECORDS = 80;

/**
 * Read local fallback cache with deduplication
 */
function getCachedVisitorHistory(): VisitorHistoryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const deduplicated = new Map<string, VisitorHistoryItem>();
        for (const item of parsed) {
          const key = item.deviceId || item.visitorId || item.id;
          if (deduplicated.has(key)) {
            const existing = deduplicated.get(key)!;
            const isNewer = new Date(item.lastSeenAt || 0).getTime() > new Date(existing.lastSeenAt || 0).getTime();
            const rawLoc = item.location || existing.location || "";
            const cleanLoc = stripIspFromName(rawLoc);

            deduplicated.set(key, {
              ...existing,
              ...(isNewer ? item : {}),
              device: sanitizeDeviceLabel(item.device || existing.device, item.screenResolution || existing.screenResolution),
              location: cleanLoc,
              visitCount: Math.max(existing.visitCount || 1, item.visitCount || 1),
            });
          } else {
            const rawLoc = item.location || "";
            const cleanLoc = stripIspFromName(rawLoc);

            deduplicated.set(key, {
              ...item,
              device: sanitizeDeviceLabel(item.device, item.screenResolution),
              location: cleanLoc,
            });
          }
        }
        return Array.from(deduplicated.values());
      }
    }
  } catch (_) {}
  return [];
}

/**
 * Save to local cache
 */
function setCachedVisitorHistory(items: VisitorHistoryItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_LOCAL_RECORDS)));
  } catch (_) {}
}

/**
 * Record or update visitor history entry with persistent device fingerprinting
 */
export async function logVisitorHistory(visitor: {
  visitorId: string;
  deviceId?: string;
  visitorName: string;
  role: "visitor" | "admin";
  isAdminDevice?: boolean;
  device: string;
  browser: string;
  browserVersion?: string;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  screenResolution?: string;
  location?: string;
  ward?: string;
  district?: string;
  province?: string;
  fullAddress?: string;
  accuracyMeters?: number;
  locationSource?: "GPS" | "IP" | "MANUAL";
  isp?: string;
  latitude?: number;
  longitude?: number;
  ip?: string;
  rawIp?: string;
  page: string;
  detail?: string;
  isReturning?: boolean;
  visitCount?: number;
  firstSeenAt?: string;
}): Promise<void> {
  const {
    visitorId,
    deviceId,
    visitorName,
    role,
    isAdminDevice,
    device,
    browser,
    browserVersion,
    connectionType,
    effectiveType,
    downlink,
    rtt,
    saveData,
    screenResolution,
    location,
    ward,
    district,
    province,
    fullAddress,
    accuracyMeters,
    locationSource,
    isp,
    latitude,
    longitude,
    ip,
    rawIp,
    page,
    detail,
    isReturning,
    visitCount,
    firstSeenAt: initialFirstSeen,
  } = visitor;

  const effectiveId = deviceId || visitorId;
  if (!effectiveId) return;

  const nowIso = new Date().toISOString();
  const cleanLoc = stripIspFromName(location || "Chưa rõ vị trí (Ẩn IP)");

  // 1. Update local cache immediately
  try {
    const cached = getCachedVisitorHistory();
    // Search either by deviceId or visitorId
    const existingIdx = cached.findIndex(
      (item) => (deviceId && item.deviceId === deviceId) || item.visitorId === visitorId || item.id === effectiveId
    );
    let updatedList: VisitorHistoryItem[];

    if (existingIdx !== -1) {
      const existing = cached[existingIdx];
      const pagesSet = new Set(existing.visitedPages || []);
      if (page) pagesSet.add(page);

      const effectiveVisitCount = Math.max(existing.visitCount || 1, visitCount || 1);
      const effectiveReturning = effectiveVisitCount > 1 || Boolean(isReturning || existing.isReturning);

      const cleanDevice = sanitizeDeviceLabel(device || existing.device || "Thiết bị di động");
      const updatedItem: VisitorHistoryItem = {
        ...existing,
        id: effectiveId,
        visitorId: visitorId || existing.visitorId,
        deviceId: deviceId || existing.deviceId || effectiveId,
        visitorName: visitorName || existing.visitorName,
        role: role || existing.role,
        isAdminDevice: Boolean(isAdminDevice ?? existing.isAdminDevice),
        isReturning: effectiveReturning,
        visitCount: effectiveVisitCount,
        device: cleanDevice,
        browser: browser || existing.browser,
        browserVersion: browserVersion || existing.browserVersion,
        connectionType: connectionType || existing.connectionType,
        effectiveType: effectiveType || existing.effectiveType,
        downlink: downlink !== undefined ? downlink : existing.downlink,
        rtt: rtt !== undefined ? rtt : existing.rtt,
        saveData: saveData !== undefined ? saveData : existing.saveData,
        screenResolution: screenResolution || existing.screenResolution,
        location: cleanLoc !== "Chưa rõ vị trí (Ẩn IP)" && cleanLoc !== "Việt Nam" ? cleanLoc : (existing.location || cleanLoc),
        ward: ward || existing.ward,
        district: district || existing.district,
        province: province || existing.province,
        fullAddress: fullAddress || existing.fullAddress,
        accuracyMeters: accuracyMeters !== undefined ? accuracyMeters : existing.accuracyMeters,
        locationSource: locationSource || existing.locationSource,
        isp: isp || existing.isp,
        latitude: latitude !== undefined ? latitude : existing.latitude,
        longitude: longitude !== undefined ? longitude : existing.longitude,
        ip: ip || existing.ip,
        rawIp: rawIp || existing.rawIp,
        lastPage: page || existing.lastPage,
        lastViewDetail: detail || existing.lastViewDetail,
        lastSeenAt: nowIso,
        visitedPages: Array.from(pagesSet),
        pageViews: (existing.pageViews || 1) + 1,
      };

      updatedList = [updatedItem, ...cached.filter((_, idx) => idx !== existingIdx)];
    } else {
      const effectiveVisitCount = visitCount || (isReturning ? 2 : 1);
      const cleanDevice = sanitizeDeviceLabel(device || "Thiết bị di động");
      const newItem: VisitorHistoryItem = {
        id: effectiveId,
        visitorId,
        deviceId: deviceId || effectiveId,
        visitorName: visitorName || "Khách xem",
        role: role || "visitor",
        isAdminDevice: Boolean(isAdminDevice),
        isReturning: effectiveVisitCount > 1 || Boolean(isReturning),
        visitCount: effectiveVisitCount,
        device: cleanDevice,
        browser: browser || "Trình duyệt",
        browserVersion,
        connectionType,
        effectiveType,
        downlink,
        rtt,
        saveData,
        screenResolution: screenResolution || "",
        location: cleanLoc,
        ward,
        district,
        province,
        fullAddress,
        accuracyMeters,
        locationSource: locationSource || (latitude ? "GPS" : "IP"),
        isp,
        latitude,
        longitude,
        ip,
        rawIp,
        firstSeenAt: initialFirstSeen || nowIso,
        lastSeenAt: nowIso,
        entryPage: page || "Trang chủ Portfolio",
        lastPage: page || "Trang chủ Portfolio",
        lastViewDetail: detail || "Khám phá câu chuyện kỷ yếu",
        visitedPages: [page || "Trang chủ Portfolio"],
        pageViews: 1,
      };
      updatedList = [newItem, ...cached];
    }
    setCachedVisitorHistory(updatedList);
  } catch (_) {}

  // 2. Sync to Firestore if quota healthy
  if (isFirestoreQuotaExceeded()) return;

  try {
    const docRef = doc(db, "visitor_history", effectiveId);
    const cached = getCachedVisitorHistory();
    const existing = cached.find((item) => item.id === effectiveId || (deviceId && item.deviceId === deviceId));

    const effectiveVisitCount = Math.max(existing?.visitCount || 1, visitCount || 1);
    const effectiveReturning = effectiveVisitCount > 1 || Boolean(isReturning || existing?.isReturning);

    const updatePayload: any = {
      id: effectiveId,
      visitorId,
      deviceId: deviceId || effectiveId,
      visitorName,
      role,
      isAdminDevice: Boolean(isAdminDevice),
      isReturning: effectiveReturning,
      visitCount: effectiveVisitCount,
      device: sanitizeDeviceLabel(device || "Thiết bị di động"),
      browser,
      lastPage: page,
      lastViewDetail: detail || "",
      lastSeenAt: nowIso,
      visitedPages: arrayUnion(page),
      pageViews: increment(1),
    };

    if (browserVersion) updatePayload.browserVersion = browserVersion;
    if (connectionType) updatePayload.connectionType = connectionType;
    if (effectiveType) updatePayload.effectiveType = effectiveType;
    if (downlink !== undefined) updatePayload.downlink = downlink;
    if (rtt !== undefined) updatePayload.rtt = rtt;
    if (saveData !== undefined) updatePayload.saveData = saveData;
    if (screenResolution) updatePayload.screenResolution = screenResolution;

    if (!existing || !existing.firstSeenAt) {
      updatePayload.firstSeenAt = initialFirstSeen || nowIso;
      updatePayload.entryPage = page;
    }

    if (cleanLoc && cleanLoc !== "Việt Nam") {
      updatePayload.location = cleanLoc;
    }
    if (ward) updatePayload.ward = ward;
    if (district) updatePayload.district = district;
    if (province) updatePayload.province = province;
    if (fullAddress) updatePayload.fullAddress = fullAddress;
    if (accuracyMeters !== undefined) updatePayload.accuracyMeters = accuracyMeters;
    if (locationSource) updatePayload.locationSource = locationSource;
    if (isp) updatePayload.isp = isp;
    if (latitude !== undefined) updatePayload.latitude = latitude;
    if (longitude !== undefined) updatePayload.longitude = longitude;

    if (ip) updatePayload.ip = ip;
    if (rawIp) updatePayload.rawIp = rawIp;

    await setDoc(docRef, cleanFirestoreData(updatePayload), { merge: true });
  } catch (error: any) {
    if (
      error?.code === "resource-exhausted" ||
      error?.message?.includes("Quota limit exceeded") ||
      error?.message?.includes("Free daily write units")
    ) {
      markFirestoreQuotaExceeded();
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, "visitor_history");
  }
}

/**
 * Manually update or calibrate visitor location in history (e.g. by admin)
 */
export async function updateVisitorHistoryLocation(
  visitorId: string,
  newLocation: string,
  extraDetails?: {
    ward?: string;
    district?: string;
    province?: string;
    fullAddress?: string;
    accuracyMeters?: number;
    locationSource?: "GPS" | "IP" | "MANUAL";
    isp?: string;
    latitude?: number;
    longitude?: number;
  }
): Promise<void> {
  const cleanLoc = stripIspFromName(newLocation);
  if (!visitorId || !cleanLoc) return;

  // 1. Update local cache
  try {
    const cached = getCachedVisitorHistory();
    const updated = cached.map((item) =>
      item.visitorId === visitorId || item.id === visitorId
        ? {
            ...item,
            location: cleanLoc,
            ...(extraDetails || {}),
            locationSource: extraDetails?.locationSource || "MANUAL",
          }
        : item
    );
    setCachedVisitorHistory(updated);
  } catch (_) {}

  // 2. Update Firestore
  try {
    const docRef = doc(db, "visitor_history", visitorId);
    const payload: any = {
      location: cleanLoc,
      locationSource: extraDetails?.locationSource || "MANUAL",
      ...(extraDetails || {}),
    };
    await setDoc(docRef, cleanFirestoreData(payload), { merge: true });
    const activeRef = doc(db, "active_visitors", visitorId);
    await setDoc(activeRef, { location: cleanLoc }, { merge: true }).catch(() => {});
  } catch (_) {}
}

/**
 * Subscribe to real-time visitor history
 */
export function subscribeToVisitorHistory(
  callback: (history: VisitorHistoryItem[]) => void,
  maxItems = 60
): () => void {
  // Initial callback from cache
  const cached = getCachedVisitorHistory();
  if (cached.length > 0) {
    callback(cached);
  }

  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }

  try {
    const colRef = collection(db, "visitor_history");
    const q = query(colRef, orderBy("lastSeenAt", "desc"), limit(maxItems));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rawList: VisitorHistoryItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as VisitorHistoryItem;
          rawList.push({
            id: d.id,
            visitorId: data.visitorId || d.id,
            deviceId: data.deviceId || d.id,
            visitorName: data.visitorName || "Khách xem",
            role: data.role || "visitor",
            isAdminDevice: Boolean(data.isAdminDevice),
            isReturning: typeof data.isReturning === "boolean" ? data.isReturning : (typeof data.visitCount === "number" && data.visitCount > 1),
            visitCount: typeof data.visitCount === "number" ? data.visitCount : 1,
            device: sanitizeDeviceLabel(data.device || "Thiết bị di động", data.screenResolution || ""),
            browser: data.browser || "Trình duyệt",
            screenResolution: data.screenResolution || "",
            ip: data.ip || (data.rawIp ? data.rawIp : undefined),
            rawIp: data.rawIp,
            location: stripIspFromName(data.location || "Chưa rõ vị trí (Ẩn IP)"),
            ward: data.ward,
            district: data.district,
            province: data.province,
            fullAddress: data.fullAddress,
            accuracyMeters: data.accuracyMeters,
            locationSource: data.locationSource || (data.latitude && data.accuracyMeters ? "GPS" : "IP"),
            isp: data.isp,
            latitude: data.latitude,
            longitude: data.longitude,
            city: data.city,
            region: data.region,
            firstSeenAt: data.firstSeenAt || data.lastSeenAt || new Date().toISOString(),
            lastSeenAt: data.lastSeenAt || new Date().toISOString(),
            entryPage: data.entryPage || "Trang chủ",
            lastPage: data.lastPage || "Trang chủ",
            lastViewDetail: data.lastViewDetail || "",
            visitedPages: Array.isArray(data.visitedPages) ? data.visitedPages : [data.lastPage || "Trang chủ"],
            pageViews: typeof data.pageViews === "number" ? data.pageViews : 1,
          });
        });

        // Deduplicate items by unique visitor/device key
        const deduplicatedMap = new Map<string, VisitorHistoryItem>();
        for (const it of rawList) {
          const key = it.deviceId || it.visitorId || it.id;
          if (deduplicatedMap.has(key)) {
            const existing = deduplicatedMap.get(key)!;
            const mergedPages = Array.from(new Set([...(existing.visitedPages || []), ...(it.visitedPages || [])]));
            const isNewer = new Date(it.lastSeenAt || 0).getTime() > new Date(existing.lastSeenAt || 0).getTime();
            deduplicatedMap.set(key, {
              ...existing,
              ...(isNewer ? it : {}),
              visitCount: Math.max(existing.visitCount || 1, it.visitCount || 1),
              isReturning: Boolean(existing.isReturning || it.isReturning || Math.max(existing.visitCount || 1, it.visitCount || 1) > 1),
              pageViews: (existing.pageViews || 1) + (it.pageViews || 1),
              visitedPages: mergedPages,
              location: (it.location && it.location !== "Việt Nam" && it.location !== "Chưa rõ vị trí (Ẩn IP)") ? it.location : existing.location,
              ward: it.ward || existing.ward,
              district: it.district || existing.district,
              province: it.province || existing.province,
              fullAddress: it.fullAddress || existing.fullAddress,
              accuracyMeters: it.accuracyMeters || existing.accuracyMeters,
              locationSource: it.locationSource || existing.locationSource,
              isp: it.isp || existing.isp,
            });
          } else {
            deduplicatedMap.set(key, it);
          }
        }
        const items = Array.from(deduplicatedMap.values());

        if (items.length > 0) {
          setCachedVisitorHistory(items);
          callback(items);
        } else if (cached.length > 0) {
          callback(cached);
        }
      },
      (error) => {
        if (
          error?.code === "resource-exhausted" ||
          error?.message?.includes("Quota limit exceeded")
        ) {
          markFirestoreQuotaExceeded();
          return;
        }
        handleFirestoreError(error, OperationType.GET, "visitor_history");
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn("Could not subscribe to visitor history:", err);
    return () => {};
  }
}

/**
 * Delete a single visitor history record
 */
export async function deleteVisitorHistoryItem(visitorId: string): Promise<void> {
  // Delete from local cache
  try {
    const cached = getCachedVisitorHistory();
    const filtered = cached.filter((i) => i.visitorId !== visitorId);
    setCachedVisitorHistory(filtered);
  } catch (_) {}

  if (isFirestoreQuotaExceeded()) return;

  try {
    const docRef = doc(db, "visitor_history", visitorId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, "visitor_history");
  }
}

/**
 * Clear all visitor history records
 */
export async function clearAllVisitorHistory(): Promise<void> {
  // Clear local cache
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (_) {}

  if (isFirestoreQuotaExceeded()) return;

  try {
    const colRef = collection(db, "visitor_history");
    const snapshot = await getDocs(colRef);
    const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, "visitor_history");
  }
}
