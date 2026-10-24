/**
 * IP-Based Geolocation Client Service
 * 
 * - Strictly IP-based (zero navigator.geolocation calls, zero intrusive permission popups).
 * - Sends visitor arrival log to backend (/api/visitor/log).
 * - Backend extracts true public client IP (handling Cloud Run / reverse proxies),
 *   queries high-precision GeoIP with coordinate bounds validation, and stores to Firestore.
 * - Prevents all false-positive "Hà Nội" defaults across Vietnam's 63 provinces.
 */

import { getPersistentDeviceInfo } from "./deviceFingerprintService";

export interface VisitorGeoResult {
  ok: boolean;
  ip?: string;
  maskedIp?: string;
  city?: string;
  region?: string;
  country?: string;
  location: string;
  ward?: string;
  district?: string;
  province?: string;
  fullAddress?: string;
  accuracyMeters?: number;
  locationSource?: "GPS" | "IP" | "MANUAL";
  isp?: string;
  latitude?: number;
  longitude?: number;
  source?: string;
}

const STORAGE_KEY_LOCATION = "visitor_location";
const STORAGE_KEY_GEO_DETAILS = "visitor_geo_details_v2";

/**
 * Mask an IP for privacy (e.g. 113.161.23.45 -> 113.161.xxx.xxx)
 */
export function maskIp(ip: string): string {
  if (!ip) return "";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + ":xxxx:xxxx";
  }
  return ip;
}

/**
 * Purge legacy corrupted caches where previous bugs wrote raw ISP names or false Long Biên datacenter
 */
export function purgeLegacyGeoCache(): void {
  try {
    const val = sessionStorage.getItem(STORAGE_KEY_LOCATION);
    if (
      val &&
      (val.includes("Mạng ") ||
        val.includes(" • ") ||
        val.includes("FPT") ||
        val.includes("VNPT") ||
        val.includes("Phan Tây Nhạc") ||
        val === "Việt Nam")
    ) {
      sessionStorage.removeItem(STORAGE_KEY_LOCATION);
      sessionStorage.removeItem(STORAGE_KEY_GEO_DETAILS);
    }
  } catch (_) {}
}

/**
 * Log visitor arrival to backend and resolve accurate province location
 */
export async function logVisitorArrival(params: {
  visitorId: string;
  sessionId?: string;
  page?: string;
  detail?: string;
  device?: string;
  browser?: string;
  role?: string;
  isAdminDevice?: boolean;
  clientLocation?: string;
  ward?: string;
  district?: string;
  province?: string;
  fullAddress?: string;
  accuracyMeters?: number;
  locationSource?: "GPS" | "IP" | "MANUAL";
  isp?: string;
  latitude?: number;
  longitude?: number;
}): Promise<VisitorGeoResult> {
  purgeLegacyGeoCache();

  try {
    const devInfo = typeof window !== "undefined" ? getPersistentDeviceInfo() : null;

    // Check cached geo details
    let cachedDetails: any = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_GEO_DETAILS);
      if (raw) cachedDetails = JSON.parse(raw);
    } catch (_) {}

    // Passive client-side IP and geo hint check
    let clientIpHint: string | undefined = cachedDetails?.ip;
    let clientGeoHint: { city?: string; region?: string; country?: string; isp?: string } | undefined;

    try {
      const cachedIp = sessionStorage.getItem("visitor_detected_ip");
      if (cachedIp && !cachedIp.startsWith("127.") && !cachedIp.startsWith("192.168.")) {
        clientIpHint = cachedIp;
      }

      if (!clientIpHint) {
        const [ipwhoRes, ipifyRes] = await Promise.allSettled([
          fetch("https://ipwho.is/", { signal: AbortSignal.timeout(2500) }),
          fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(2000) }),
        ]);

        if (ipwhoRes.status === "fulfilled" && ipwhoRes.value.ok) {
          const geoJson = await ipwhoRes.value.json();
          if (geoJson && geoJson.success !== false) {
            clientIpHint = geoJson.ip || clientIpHint;
            clientGeoHint = {
              city: geoJson.city || "",
              region: geoJson.region || "",
              country: geoJson.country || "Việt Nam",
              isp: geoJson.connection?.isp || geoJson.connection?.org || "",
            };
            if (clientIpHint) sessionStorage.setItem("visitor_detected_ip", clientIpHint);
          }
        } else if (ipifyRes.status === "fulfilled" && ipifyRes.value.ok) {
          const ipifyJson = await ipifyRes.value.json();
          if (ipifyJson && ipifyJson.ip) {
            clientIpHint = ipifyJson.ip;
            sessionStorage.setItem("visitor_detected_ip", clientIpHint);
          }
        }
      }
    } catch (_) {}

    const effectiveWard = params.ward || cachedDetails?.ward;
    const effectiveDistrict = params.district || cachedDetails?.district;
    const effectiveProvince = params.province || cachedDetails?.province;
    const effectiveFullAddress = params.fullAddress || cachedDetails?.fullAddress;
    const effectiveAccuracy = params.accuracyMeters || cachedDetails?.accuracyMeters;
    const effectiveLocationSource = params.locationSource || cachedDetails?.locationSource || (params.latitude ? "GPS" : "IP");
    const effectiveIsp = params.isp || cachedDetails?.isp || clientGeoHint?.isp;

    const response = await fetch("/api/visitor/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        visitorId: params.visitorId,
        sessionId: params.sessionId || params.visitorId,
        deviceId: devInfo?.deviceId || params.visitorId,
        page: params.page || window.location.pathname || "Trang chủ",
        detail: params.detail || "Xem Portfolio",
        device: devInfo?.deviceLabel || params.device || "Thiết bị di động",
        browser: devInfo?.browserLabel || params.browser || "Trình duyệt",
        screenResolution: devInfo?.screenResolution || "",
        isReturning: devInfo?.isReturning || false,
        visitCount: devInfo?.visitCount || 1,
        role: params.role || "visitor",
        isAdminDevice: Boolean(params.isAdminDevice),
        browserVersion: devInfo?.browserVersion || "",
        connectionType: devInfo?.network?.connectionType,
        effectiveType: devInfo?.network?.effectiveType,
        downlink: devInfo?.network?.downlink,
        rtt: devInfo?.network?.rtt,
        saveData: devInfo?.network?.saveData,
        clientLocation: params.clientLocation || (() => {
          try {
            const cal = sessionStorage.getItem("visitor_calibrated_location") || localStorage.getItem("visitor_calibrated_location");
            if (cal && cal !== "Việt Nam" && cal !== "Chưa rõ vị trí (Ẩn IP)") return cal;
          } catch (_) {}
          return undefined;
        })(),
        ward: effectiveWard,
        district: effectiveDistrict,
        province: effectiveProvince,
        fullAddress: effectiveFullAddress,
        accuracyMeters: effectiveAccuracy,
        locationSource: effectiveLocationSource,
        isp: effectiveIsp,
        latitude: params.latitude || cachedDetails?.latitude,
        longitude: params.longitude || cachedDetails?.longitude,
        clientIp: clientIpHint,
        clientGeo: clientGeoHint,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.ok && data.location && data.location !== "Việt Nam") {
        try {
          sessionStorage.setItem(STORAGE_KEY_LOCATION, data.location);
          sessionStorage.setItem(
            STORAGE_KEY_GEO_DETAILS,
            JSON.stringify({
              ip: data.ip,
              city: data.city,
              region: data.region,
              country: data.country,
              location: data.location,
              ward: data.ward || effectiveWard,
              district: data.district || effectiveDistrict,
              province: data.province || effectiveProvince,
              fullAddress: data.fullAddress || effectiveFullAddress,
              accuracyMeters: data.accuracyMeters || effectiveAccuracy,
              locationSource: data.locationSource || effectiveLocationSource,
              isp: data.isp || effectiveIsp,
              latitude: data.latitude,
              longitude: data.longitude,
            })
          );
        } catch (_) {}

        return {
          ok: true,
          ip: data.ip,
          maskedIp: data.ip ? maskIp(data.ip) : undefined,
          city: data.city,
          region: data.region,
          country: data.country,
          location: data.location,
          ward: data.ward || effectiveWard,
          district: data.district || effectiveDistrict,
          province: data.province || effectiveProvince,
          fullAddress: data.fullAddress || effectiveFullAddress,
          accuracyMeters: data.accuracyMeters || effectiveAccuracy,
          locationSource: data.locationSource || effectiveLocationSource,
          isp: data.isp || effectiveIsp,
          latitude: data.latitude,
          longitude: data.longitude,
          source: data.source || "backend-geoip",
        };
      }
    }
  } catch (err) {
    console.warn("[ipGeoService] Error logging visitor arrival:", err);
  }

  // Fallback: check cached location if available
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY_LOCATION);
    if (
      cached &&
      cached !== "Việt Nam" &&
      cached !== "Chưa rõ vị trí (Ẩn IP)" &&
      !cached.includes("Mạng ") &&
      !cached.includes(" • ") &&
      !cached.includes("Phan Tây Nhạc")
    ) {
      return { ok: true, location: cached };
    }
  } catch (_) {}

  return { ok: false, location: "Chưa rõ vị trí (Ẩn IP)" };
}

/**
 * Read current visitor location from storage without making requests
 */
export function getCurrentVisitorLocation(): string {
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY_LOCATION);
    if (
      cached &&
      cached !== "Việt Nam" &&
      cached !== "Chưa rõ vị trí (Ẩn IP)" &&
      !cached.includes("Mạng ") &&
      !cached.includes(" • ")
    ) {
      return cached;
    }
  } catch (_) {}
  return "Chưa rõ vị trí (Ẩn IP)";
}
