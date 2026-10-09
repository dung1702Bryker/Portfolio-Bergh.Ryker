import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { ActiveVisitor, LivePresenceContextValue } from "../types/presence";
import {
  startLivePresence,
  subscribeToLiveVisitors,
} from "../services/livePresenceService";
import { useAdminAuth } from "../hooks/useAdminAuth";
import {
  resolvePreciseVisitorLocation,
  stripIspFromName,
  purgeStaleLocationCache,
  getBrowserGpsProvince,
} from "../services/geoService";
import { logVisitorArrival, purgeLegacyGeoCache } from "../services/ipGeoService";
import { getPersistentDeviceInfo } from "../services/deviceFingerprintService";
import { sanitizeDeviceLabel } from "../services/visitorHistoryService";

const LivePresenceContext = createContext<LivePresenceContextValue | null>(null);

export const LivePresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, user } = useAdminAuth();
  const [activeVisitors, setActiveVisitors] = useState<ActiveVisitor[]>([]);
  const [currentVisitorId, setCurrentVisitorId] = useState<string>("");
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [visitorLocation, setVisitorLocation] = useState<string>(() => {
    try {
      purgeStaleLocationCache();
      const cached = sessionStorage.getItem("visitor_location");
      return cached ? stripIspFromName(cached) : "Việt Nam";
    } catch (_) {
      return "Việt Nam";
    }
  });

  const updateLocationRef = useRef<((page: string, detail?: string) => Promise<void>) | null>(null);
  const updatePhysicalLocationRef = useRef<((newLocation: string) => Promise<void>) | null>(null);
  const updateNicknameRef = useRef<((newNickname: string) => Promise<void>) | null>(null);
  const updateAdminStatusRef = useRef<((isAdmin: boolean, adminName?: string) => Promise<void>) | null>(null);

  useEffect(() => {
    const adminName = user?.email ? user.email.split("@")[0] : "Admin";

    const presenceHandle = startLivePresence({
      isAdmin,
      adminName,
      initialPage: "Trang Chủ Portfolio",
      initialDetail: "Khám phá câu chuyện kỷ yếu Bergh Ryker",
    });

    setCurrentVisitorId(presenceHandle.visitorId);
    updateLocationRef.current = presenceHandle.updateLocation;
    updatePhysicalLocationRef.current = presenceHandle.updatePhysicalLocation;
    updateNicknameRef.current = presenceHandle.updateNickname;
    updateAdminStatusRef.current = presenceHandle.updateAdminStatus;

    // Real-time Firestore presence subscription
    const unsubscribeSnapshot = subscribeToLiveVisitors((visitors) => {
      // Ensure all visitor locations and devices are sanitized and properly labeled without forcing overrides
      const sanitizedVisitors = visitors.map((v) => ({
        ...v,
        device: sanitizeDeviceLabel(v.device || "Thiết bị di động", v.screenResolution),
        location: v.location ? stripIspFromName(v.location) : "Việt Nam",
      }));
      setActiveVisitors(sanitizedVisitors);
    });

    return () => {
      unsubscribeSnapshot();
      presenceHandle.cleanup();
    };
  }, [isAdmin, user?.email]);

  /**
   * Dynamic Real-Time Location Detection Service:
   * Uses backend /api/visitor/log to resolve true client IP and accurate province
   * (TP. Hồ Chí Minh, Đà Nẵng, Cần Thơ, Hải Phòng, Quảng Ninh, Hà Nội...)
   * Automatically adapts to real device position without locking to any street
   */
  const detectLocation = useCallback(async (): Promise<string> => {
    try {
      purgeLegacyGeoCache();
      purgeStaleLocationCache();

      // Clear obsolete hardcoded locks if present
      try {
        const oldCalibrated = localStorage.getItem("visitor_calibrated_location") || sessionStorage.getItem("visitor_calibrated_location");
        if (oldCalibrated && oldCalibrated.includes("Phan Tây Nhạc")) {
          localStorage.removeItem("visitor_calibrated_location");
          sessionStorage.removeItem("visitor_calibrated_location");
        }
      } catch (_) {}

      // Check if user has an explicit custom location in this active session
      let savedCalibrated: string | null = null;
      try {
        savedCalibrated = sessionStorage.getItem("visitor_calibrated_location");
      } catch (_) {}

      const visitorId = currentVisitorId || sessionStorage.getItem("live_visitor_session_id") || "guest";
      const geoResult = await logVisitorArrival({
        visitorId,
        page: window.location.pathname || "Trang chủ",
        detail: "Xem Portfolio",
        role: isAdmin ? "admin" : "visitor",
        isAdminDevice: Boolean(isAdmin),
        clientLocation: savedCalibrated || undefined,
      });

      if (geoResult.ok && geoResult.location && geoResult.location !== "Việt Nam") {
        const cleanLoc = stripIspFromName(geoResult.location);
        setVisitorLocation(cleanLoc);
        try {
          sessionStorage.setItem("visitor_location", cleanLoc);
        } catch (_) {}

        if (updatePhysicalLocationRef.current) {
          await updatePhysicalLocationRef.current(cleanLoc);
        }
        return cleanLoc;
      }

      // Secondary client-side fallback if backend was unavailable
      const resolvedLoc = await resolvePreciseVisitorLocation();
      const cleanLoc = stripIspFromName(resolvedLoc);

      if (cleanLoc && cleanLoc !== "Việt Nam") {
        setVisitorLocation(cleanLoc);
        try {
          sessionStorage.setItem("visitor_location", cleanLoc);
        } catch (_) {}
        if (updatePhysicalLocationRef.current) {
          await updatePhysicalLocationRef.current(cleanLoc);
        }
        return cleanLoc;
      }
    } catch (_) {}
    return "Hà Nội";
  }, [currentVisitorId, isAdmin]);

  // Run precise location detection on mount and attempt silent GPS calibration if granted
  useEffect(() => {
    let isMounted = true;
    detectLocation().then((loc) => {
      if (isMounted && loc && loc !== "Việt Nam") {
        setVisitorLocation(loc);
      }
    });

    // Check GPS if permission is already granted on device to get live real-time position
    if (typeof window !== "undefined" && navigator?.geolocation) {
      getBrowserGpsProvince(false).then((gpsLoc) => {
        if (isMounted && gpsLoc && gpsLoc !== "Việt Nam") {
          const cleanGps = stripIspFromName(gpsLoc);
          setVisitorLocation(cleanGps);
          try {
            sessionStorage.setItem("visitor_location", cleanGps);
            sessionStorage.setItem("visitor_calibrated_location", cleanGps);
          } catch (_) {}
          if (updatePhysicalLocationRef.current) {
            updatePhysicalLocationRef.current(cleanGps);
          }
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [detectLocation]);

  const calibrateGpsLocation = useCallback(async (promptUser = true): Promise<string> => {
    try {
      const gpsLoc = await getBrowserGpsProvince(promptUser);
      if (gpsLoc && gpsLoc !== "Việt Nam") {
        const targetGps = stripIspFromName(gpsLoc);
        setVisitorLocation(targetGps);
        try {
          sessionStorage.setItem("visitor_location", targetGps);
          sessionStorage.setItem("visitor_calibrated_location", targetGps);
          sessionStorage.setItem("visitor_detailed_location_v7", targetGps);
        } catch (_) {}

        // Call calibration API with actual live GPS location
        try {
          const devInfo = getPersistentDeviceInfo();
          await fetch("/api/presence/calibrate-vip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              visitorId: currentVisitorId,
              deviceId: devInfo?.deviceId,
              newLocation: targetGps,
              device: devInfo?.deviceLabel,
            }),
          });
        } catch (_) {}

        if (updatePhysicalLocationRef.current) {
          await updatePhysicalLocationRef.current(targetGps);
        }
        return targetGps;
      }
    } catch (_) {}
    return visitorLocation;
  }, [currentVisitorId, visitorLocation]);

  const setCustomLocation = useCallback(async (newLocation: string): Promise<void> => {
    if (!newLocation) return;
    const clean = stripIspFromName(newLocation);
    setVisitorLocation(clean);
    try {
      sessionStorage.setItem("visitor_location", clean);
      sessionStorage.setItem("visitor_calibrated_location", clean);
      sessionStorage.setItem("visitor_detailed_location_v7", clean);
    } catch (_) {}

    // Synchronize to calibration endpoint with chosen location
    try {
      const devInfo = getPersistentDeviceInfo();
      await fetch("/api/presence/calibrate-vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId: currentVisitorId,
          deviceId: devInfo?.deviceId,
          newLocation: clean,
          device: devInfo?.deviceLabel,
        }),
      });
    } catch (_) {}

    if (updatePhysicalLocationRef.current) {
      await updatePhysicalLocationRef.current(clean);
    }
  }, [currentVisitorId]);

  const updateLocation = useCallback((page: string, detail?: string) => {
    if (updateLocationRef.current) {
      updateLocationRef.current(page, detail);
    }
  }, []);

  const updateNickname = useCallback((newNickname: string) => {
    if (updateNicknameRef.current) {
      updateNicknameRef.current(newNickname);
    }
  }, []);

  const updateAdminStatus = useCallback(async (newIsAdmin: boolean, adminName?: string) => {
    if (updateAdminStatusRef.current) {
      await updateAdminStatusRef.current(newIsAdmin, adminName);
    }
  }, []);

  const activeCount = Math.max(activeVisitors.length, 1);
  const currentVisitor = activeVisitors.find((v) => v.id === currentVisitorId);
  const devInfo = typeof window !== "undefined" ? getPersistentDeviceInfo() : null;
  const currentDeviceId = currentVisitor?.deviceId || devInfo?.deviceId || currentVisitorId;
  const isReturningVisitor = currentVisitor?.isReturning ?? (devInfo ? devInfo.isReturning : false);
  const visitCount = currentVisitor?.visitCount ?? (devInfo ? devInfo.visitCount : 1);

  return (
    <LivePresenceContext.Provider
      value={{
        activeVisitors,
        activeCount,
        currentVisitorId,
        currentDeviceId,
        currentVisitor,
        visitorLocation,
        isReturningVisitor,
        visitCount,
        refreshPreciseLocation: detectLocation,
        calibrateGpsLocation,
        setCustomLocation,
        updateLocation,
        updateNickname,
        updateAdminStatus,
        isWidgetOpen,
        setIsWidgetOpen,
      }}
    >
      {children}
    </LivePresenceContext.Provider>
  );
};

export function useLivePresenceContext(): LivePresenceContextValue {
  const context = useContext(LivePresenceContext);
  if (!context) {
    throw new Error("useLivePresenceContext must be used within a LivePresenceProvider");
  }
  return context;
}
