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
  latitude?: number;
  longitude?: number;
}): Promise<VisitorGeoResult> {
  purgeLegacyGeoCache();

  try {
    const devInfo = typeof window !== "undefined" ? getPersistentDeviceInfo() : null;

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
        clientLocation: params.clientLocation,
        latitude: params.latitude,
        longitude: params.longitude,
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
    if (cached && cached !== "Việt Nam" && !cached.includes("Mạng ") && !cached.includes(" • ")) {
      return { ok: true, location: cached };
    }
  } catch (_) {}

  return { ok: false, location: "Việt Nam" };
}

/**
 * Read current visitor location from storage without making requests
 */
export function getCurrentVisitorLocation(): string {
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY_LOCATION);
    if (cached && cached !== "Việt Nam" && !cached.includes("Mạng ") && !cached.includes(" • ")) {
      return cached;
    }
  } catch (_) {}
  return "Việt Nam";
}
