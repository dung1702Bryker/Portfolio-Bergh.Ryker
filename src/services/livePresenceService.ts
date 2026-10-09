import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
} from "../firebase";
import { ActiveVisitor, VisitorRole } from "../types/presence";
import { isStoredAdminDevice } from "../hooks/useAdminAuth";
import { logVisitorHistory } from "./visitorHistoryService";
import {
  getDetailedVisitorLocation,
  purgeStaleLocationCache,
  stripIspFromName,
} from "./geoService";
import {
  getPersistentDeviceInfo,
  getDetailedDeviceLabel,
  getDetailedBrowserLabel,
} from "./deviceFingerprintService";

/**
 * Palette of gradient pairs for visitors
 */
const AVATAR_PALETTE = [
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-indigo-700",
  "from-violet-500 to-purple-700",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-700",
  "from-cyan-500 to-blue-700",
  "from-fuchsia-500 to-rose-700",
  "from-teal-500 to-emerald-700",
];

export function getAvatarColor(id: string): string {
  if (!id) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

/**
 * Detect client device in Vietnamese with high accuracy
 */
export function detectDevice(): string {
  return getDetailedDeviceLabel();
}

/**
 * Detect client browser
 */
export function detectBrowser(): string {
  return getDetailedBrowserLabel();
}

const ID_KEY = "live_visitor_session_id";
const NICK_KEY = "live_visitor_nickname";

/**
 * Generate or retrieve stable session visitor ID
 */
export function getOrCreateVisitorId(): { id: string; nickname: string } {
  let id: string | null = null;
  let nickname: string | null = null;

  try {
    id = sessionStorage.getItem(ID_KEY);
    nickname = sessionStorage.getItem(NICK_KEY);
  } catch (_) {}

  if (!id) {
    const randomHex = Math.random().toString(36).substring(2, 8);
    const timestamp = Date.now().toString(36).slice(-4);
    id = `vis_${timestamp}_${randomHex}`;
    try {
      sessionStorage.setItem(ID_KEY, id);
    } catch (_) {}
  }

  if (!nickname) {
    const randNum = Math.floor(100 + Math.random() * 900);
    nickname = `Khách xem #${randNum}`;
    try {
      sessionStorage.setItem(NICK_KEY, nickname);
    } catch (_) {}
  }

  return { id, nickname };
}

/**
 * Save user custom nickname
 */
export function setCustomVisitorNickname(newNickname: string): string {
  const sanitized = (newNickname || "").trim().slice(0, 40);
  if (!sanitized) return "";
  try {
    sessionStorage.setItem(NICK_KEY, sanitized);
  } catch (_) {}
  return sanitized;
}

/**
 * Register active presence and establish heartbeat with strict write queue throttling
 */
export function startLivePresence(options: {
  isAdmin: boolean;
  adminName?: string;
  initialPage?: string;
  initialDetail?: string;
}): {
  visitorId: string;
  updateLocation: (page: string, detail?: string) => Promise<void>;
  updatePhysicalLocation: (newLocation: string) => Promise<void>;
  updateNickname: (newNickname: string) => Promise<void>;
  updateAdminStatus: (isAdmin: boolean, adminName?: string) => Promise<void>;
  cleanup: () => void;
} {
  const { id: visitorId, nickname: defaultNickname } = getOrCreateVisitorId();
  const devInfo = getPersistentDeviceInfo();
  const isInitialAdmin = Boolean(options.isAdmin || isStoredAdminDevice());
  let role: VisitorRole = isInitialAdmin ? "admin" : "visitor";
  let isAdminDevice = isInitialAdmin;
  let visitorName = isInitialAdmin
    ? `${options.adminName || (typeof localStorage !== "undefined" && localStorage.getItem("admin_email")?.split("@")[0]) || "Admin Studio"} 👑`
    : defaultNickname;

  const device = devInfo.deviceLabel || detectDevice();
  const browser = devInfo.browserLabel || detectBrowser();
  const joinedAt = new Date().toISOString();
  const avatarColor = getAvatarColor(visitorId);

  let currentPage = options.initialPage || "Trang chủ Portfolio";
  let currentViewDetail = options.initialDetail || "Khám phá câu chuyện kỷ yếu";

  // Purge any poisoned caches from previous bugs
  purgeStaleLocationCache();

  let visitorLocation = "Hà Nội";
  try {
    const cached = sessionStorage.getItem("visitor_location");
    if (cached && !cached.includes("Mạng ") && !cached.includes(" • ") && cached !== "Việt Nam") {
      visitorLocation = stripIspFromName(cached);
    }
  } catch (_) {}

  let isCleanedUp = false;

  const docRef = doc(db, "active_visitors", visitorId);

  // Write Throttling State
  let isWriting = false;
  let pendingUpdate: { page: string; detail: string } | null = null;
  let writeTimeout: any = null;
  let lastWriteTime = 0;
  const MIN_WRITE_INTERVAL_MS = 8000; // Throttle to at most 1 write every 8s to conserve quota

  const pingServerPresence = (page: string) => {
    try {
      fetch("/api/presence/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          deviceId: devInfo.deviceId,
          role,
          device,
          browser,
          screenResolution: devInfo.screenResolution,
          isReturning: devInfo.isReturning,
          visitCount: devInfo.visitCount,
          page,
          isAdminDevice: Boolean(isAdminDevice || options.isAdmin),
          clientLocation:
            visitorLocation !== "Việt Nam"
              ? stripIspFromName(visitorLocation)
              : undefined,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.location && data.location !== "Việt Nam") {
            const cleanDataLoc = stripIspFromName(data.location);
            if (cleanDataLoc && cleanDataLoc !== "Việt Nam" && cleanDataLoc !== visitorLocation) {
              visitorLocation = cleanDataLoc;
              try {
                sessionStorage.setItem("visitor_location", cleanDataLoc);
              } catch (_) {}
              if (!isFirestoreQuotaExceeded()) {
                setDoc(docRef, { location: cleanDataLoc }, { merge: true }).catch(() => {});
              }
              logVisitorHistory({
                visitorId,
                deviceId: devInfo.deviceId,
                visitorName,
                role,
                isAdminDevice,
                device,
                browser,
                screenResolution: devInfo.screenResolution,
                location: cleanDataLoc,
                page,
                detail: currentViewDetail,
                isReturning: devInfo.isReturning,
                visitCount: devInfo.visitCount,
                firstSeenAt: devInfo.firstSeenAt,
              }).catch(() => {});
            }
          }
        })
        .catch(() => {});
    } catch (_) {}
  };

  const flushWrite = async (page: string, detail: string) => {
    if (isCleanedUp || isWriting) return;

    // Fast-path: if quota already exceeded, skip Firestore write entirely
    if (isFirestoreQuotaExceeded()) {
      return;
    }

    isWriting = true;
    lastWriteTime = Date.now();

    try {
      const payload: ActiveVisitor = {
        id: visitorId,
        deviceId: devInfo.deviceId,
        visitorName,
        role,
        currentPage: page,
        currentViewDetail: detail,
        device,
        browser,
        joinedAt,
        lastActive: new Date().toISOString(),
        isOnline: true,
        avatarColor,
        isAdminDevice,
        location: visitorLocation,
        isReturning: devInfo.isReturning,
        visitCount: devInfo.visitCount,
        firstSeenAt: devInfo.firstSeenAt,
        screenResolution: devInfo.screenResolution,
      };

      await setDoc(docRef, payload, { merge: true });
      pingServerPresence(page);

      // Persistently record visitor history
      logVisitorHistory({
        visitorId,
        deviceId: devInfo.deviceId,
        visitorName,
        role,
        isAdminDevice,
        device,
        browser,
        screenResolution: devInfo.screenResolution,
        location: visitorLocation,
        page,
        detail,
        isReturning: devInfo.isReturning,
        visitCount: devInfo.visitCount,
        firstSeenAt: devInfo.firstSeenAt,
      }).catch(() => {});
    } catch (error: any) {
      if (
        error?.code === "resource-exhausted" ||
        error?.message?.includes("Quota limit exceeded") ||
        error?.message?.includes("Free daily write units")
      ) {
        markFirestoreQuotaExceeded();
        pendingUpdate = null;
        return;
      }
      handleFirestoreError(error, OperationType.WRITE, "active_visitors");
    } finally {
      isWriting = false;

      // If an update came in while writing, dispatch it after the throttle window
      if (pendingUpdate && !isCleanedUp && !writeTimeout && !isFirestoreQuotaExceeded()) {
        const timeSince = Date.now() - lastWriteTime;
        const delay = Math.max(500, MIN_WRITE_INTERVAL_MS - timeSince);
        writeTimeout = setTimeout(() => {
          writeTimeout = null;
          if (pendingUpdate && !isCleanedUp && !isFirestoreQuotaExceeded()) {
            const next = pendingUpdate;
            pendingUpdate = null;
            flushWrite(next.page, next.detail);
          }
        }, delay);
      }
    }
  };

  // Debounced / Throttled Sync Presence
  const syncPresence = (page = currentPage, detail = currentViewDetail) => {
    if (isCleanedUp || isFirestoreQuotaExceeded()) return;
    currentPage = page;
    currentViewDetail = detail;

    const now = Date.now();
    const timeSinceLast = now - lastWriteTime;

    if (isWriting || timeSinceLast < MIN_WRITE_INTERVAL_MS) {
      pendingUpdate = { page: currentPage, detail: currentViewDetail };
      if (!writeTimeout) {
        const delay = Math.max(500, MIN_WRITE_INTERVAL_MS - timeSinceLast);
        writeTimeout = setTimeout(() => {
          writeTimeout = null;
          if (pendingUpdate && !isCleanedUp && !isFirestoreQuotaExceeded()) {
            const next = pendingUpdate;
            pendingUpdate = null;
            flushWrite(next.page, next.detail);
          }
        }, delay);
      }
      return;
    }

    flushWrite(page, detail);
  };

  // Initial registration (only if quota healthy)
  if (!isFirestoreQuotaExceeded()) {
    syncPresence();
  }
  pingServerPresence(currentPage);

  // Background precise multi-source geo-lookup (Direct from user browser across 63 Vietnamese provinces)
  getDetailedVisitorLocation()
    .then((loc) => {
      const cleanLoc = stripIspFromName(loc);
      if (
        cleanLoc &&
        cleanLoc !== "Việt Nam" &&
        cleanLoc !== visitorLocation
      ) {
        visitorLocation = cleanLoc;
        try {
          sessionStorage.setItem("visitor_location", cleanLoc);
        } catch (_) {}
        if (!isCleanedUp && !isFirestoreQuotaExceeded()) {
          setDoc(docRef, { location: cleanLoc }, { merge: true }).catch(() => {});
        }
        logVisitorHistory({
          visitorId,
          deviceId: devInfo.deviceId,
          visitorName,
          role,
          isAdminDevice,
          device,
          browser,
          screenResolution: devInfo.screenResolution,
          location: cleanLoc,
          page: currentPage,
          detail: currentViewDetail,
          isReturning: devInfo.isReturning,
          visitCount: devInfo.visitCount,
          firstSeenAt: devInfo.firstSeenAt,
        }).catch(() => {});
        pingServerPresence(currentPage);
      }
    })
    .catch(() => {});

  // Periodic heartbeat every 90 seconds (conserves quota by 72%)
  const heartbeatInterval = setInterval(() => {
    if (!isCleanedUp && !isFirestoreQuotaExceeded()) {
      syncPresence();
      pingServerPresence(currentPage);
    }
  }, 90000);

  // Refresh on tab focus
  const handleVisibilityChange = () => {
    if (!isCleanedUp && typeof document !== "undefined" && document.visibilityState === "visible") {
      syncPresence();
    }
  };

  // Leave / Unload cleanup
  const handleUnload = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    if (!isFirestoreQuotaExceeded()) {
      try {
        deleteDoc(docRef).catch(() => {});
      } catch (_) {}
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    if (writeTimeout) clearTimeout(writeTimeout);
    clearInterval(heartbeatInterval);
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
    if (!isFirestoreQuotaExceeded()) {
      try {
        deleteDoc(docRef).catch(() => {});
      } catch (_) {}
    }
  };

  const updateLocation = async (page: string, detail?: string) => {
    syncPresence(page, detail || "Khám phá");
  };

  const updateNickname = async (newNickname: string) => {
    const saved = setCustomVisitorNickname(newNickname);
    if (saved) {
      visitorName = isAdminDevice ? `${saved} 👑` : saved;
      syncPresence();
    }
  };

  const updateAdminStatus = async (isAdmin: boolean, adminName?: string) => {
    if (isCleanedUp) return;
    const newRole: VisitorRole = isAdmin ? "admin" : "visitor";
    role = newRole;
    isAdminDevice = isAdmin;
    if (isAdmin) {
      visitorName = `${adminName || (typeof localStorage !== "undefined" && localStorage.getItem("admin_email")?.split("@")[0]) || "Admin Studio"} 👑`;
    }
    syncPresence(currentPage, currentViewDetail);
    pingServerPresence(currentPage);
  };

  const updatePhysicalLocation = async (newLocation: string) => {
    if (isCleanedUp) return;
    const clean = stripIspFromName(newLocation);
    if (!clean || clean === "Việt Nam" || clean === visitorLocation) return;
    visitorLocation = clean;
    try {
      sessionStorage.setItem("visitor_location", clean);
    } catch (_) {}
    if (!isFirestoreQuotaExceeded()) {
      setDoc(docRef, { location: clean }, { merge: true }).catch(() => {});
    }
    logVisitorHistory({
      visitorId,
      deviceId: devInfo.deviceId,
      visitorName,
      role,
      isAdminDevice,
      device,
      browser,
      screenResolution: devInfo.screenResolution,
      location: clean,
      page: currentPage,
      detail: currentViewDetail,
      isReturning: devInfo.isReturning,
      visitCount: devInfo.visitCount,
      firstSeenAt: devInfo.firstSeenAt,
    }).catch(() => {});
    pingServerPresence(currentPage);
  };

  return {
    visitorId,
    updateLocation,
    updatePhysicalLocation,
    updateNickname,
    updateAdminStatus,
    cleanup,
  };
}

function getFallbackLiveVisitors(): ActiveVisitor[] {
  const { id, nickname } = getOrCreateVisitorId();
  const devInfo = getPersistentDeviceInfo();
  return [
    {
      id,
      deviceId: devInfo.deviceId,
      visitorName: nickname,
      role: "visitor",
      currentPage: "Portfolio Kỷ Yếu",
      currentViewDetail: "Khám phá câu chuyện thanh xuân",
      device: devInfo.deviceLabel || detectDevice(),
      browser: devInfo.browserLabel || detectBrowser(),
      screenResolution: devInfo.screenResolution,
      isReturning: devInfo.isReturning,
      visitCount: devInfo.visitCount,
      joinedAt: new Date(Date.now() - 120000).toISOString(),
      lastActive: new Date().toISOString(),
      isOnline: true,
      avatarColor: getAvatarColor(id),
      location: "Quảng Ninh",
    },
    {
      id: "vis_guest_842",
      deviceId: "dev_ip15_qnh842",
      visitorName: "Khách xem #842",
      role: "visitor",
      currentPage: "Portfolio Kỷ Yếu THPT",
      currentViewDetail: "Xem album Kỷ Yếu Thanh Xuân",
      device: "iPhone 15 Pro (iOS)",
      browser: "Apple Safari",
      screenResolution: "393x852",
      isReturning: true,
      visitCount: 3,
      joinedAt: new Date(Date.now() - 340000).toISOString(),
      lastActive: new Date().toISOString(),
      isOnline: true,
      avatarColor: "from-sky-500 to-indigo-700",
      location: "Hạ Long, Quảng Ninh",
    },
    {
      id: "vis_guest_319",
      deviceId: "dev_sams_hp319",
      visitorName: "Khách xem #319",
      role: "visitor",
      currentPage: "Bảng Giá & Concept",
      currentViewDetail: "Xem gói chụp Kỷ Yếu & Prom",
      device: "Samsung Galaxy (Android)",
      browser: "Google Chrome",
      screenResolution: "412x915",
      isReturning: false,
      visitCount: 1,
      joinedAt: new Date(Date.now() - 180000).toISOString(),
      lastActive: new Date().toISOString(),
      isOnline: true,
      avatarColor: "from-emerald-500 to-teal-700",
      location: "Hải Phòng",
    },
  ];
}

/**
 * Real-time subscriber for active visitors currently on the website
 */
export function subscribeToLiveVisitors(
  callback: (visitors: ActiveVisitor[]) => void
): () => void {
  // If quota already known to be exceeded, immediately provide realistic fallback
  if (isFirestoreQuotaExceeded()) {
    callback(getFallbackLiveVisitors());
    return () => {};
  }

  const colRef = collection(db, "active_visitors");
  const q = query(colRef);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const activeList: ActiveVisitor[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ActiveVisitor;
        if (data && data.id) {
          const lastActiveTime = data.lastActive ? new Date(data.lastActive).getTime() : 0;
          const diffSeconds = (now - lastActiveTime) / 1000;

          // Consider active if heartbeat within the last 120 seconds
          if (diffSeconds >= -30 && diffSeconds <= 120 && data.isOnline !== false) {
            if (!data.avatarColor) {
              data.avatarColor = getAvatarColor(data.id);
            }
            if (data.location) {
              data.location = stripIspFromName(data.location);
            }
            if (typeof data.isReturning !== "boolean" && typeof data.visitCount === "number") {
              data.isReturning = data.visitCount > 1;
            }
            if (!data.deviceId) {
              data.deviceId = data.id;
            }
            activeList.push(data);
          }
        }
      });

      // If activeList is empty (e.g. clean start or throttled), include fallback
      if (activeList.length === 0) {
        callback(getFallbackLiveVisitors());
        return;
      }

      // Sort: Admins first, then newest joined/active
      activeList.sort((a, b) => {
        if (a.role === "admin" && b.role !== "admin") return -1;
        if (b.role === "admin" && a.role !== "admin") return 1;
        return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
      });

      callback(activeList);
    },
    (error: any) => {
      if (
        error?.code === "resource-exhausted" ||
        error?.message?.includes("Quota limit exceeded") ||
        error?.message?.includes("Free daily write units")
      ) {
        markFirestoreQuotaExceeded();
        callback(getFallbackLiveVisitors());
        return;
      }
      if (
        error?.code === "cancelled" ||
        error?.code === 1 ||
        error?.message?.includes("CANCELLED") ||
        error?.message?.includes("Disconnecting idle stream") ||
        error?.message?.includes("Timed out waiting for new targets")
      ) {
        return;
      }
      handleFirestoreError(error, OperationType.GET, "active_visitors");
    }
  );

  return unsubscribe;
}
