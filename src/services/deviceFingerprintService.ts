/**
 * Persistent Device Fingerprint & Returning Visitor Recognition Service
 * Identifies devices across sessions, distinguishes Returning Visitors from New Visitors,
 * tracks visit count, screen resolution, and hardware characteristics.
 */

const DEVICE_ID_KEY = "bergh_ryker_device_persistent_id_v2";
const VISIT_META_KEY = "bergh_ryker_visit_session_meta_v2";
const FINGERPRINT_HASH_KEY = "bergh_ryker_hw_fingerprint_hash_v2";

export interface DeviceInfo {
  deviceId: string;
  fingerprintHash: string;
  isReturning: boolean;
  visitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  screenResolution: string;
  deviceLabel: string;
  browserLabel: string;
  hardwareSummary: string;
}

interface StoredVisitMeta {
  visitCount: number;
  firstSeenAt: string;
  lastSessionTime: number;
  lastSeenAt: string;
  visitedPages: string[];
}

/**
 * Fast synchronous Murmur3-like hash of arbitrary string
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate subtle hardware & browser canvas fingerprint
 */
function generateHardwareFingerprint(): string {
  if (typeof window === "undefined") return "server_agent";

  try {
    const components: string[] = [];

    // Screen specs
    components.push(`${window.screen?.width}x${window.screen?.height}x${window.screen?.colorDepth}`);
    components.push(`dpr:${window.devicePixelRatio || 1}`);

    // Timezone & Language
    try {
      components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch (_) {}
    components.push(navigator.language || "");
    components.push((navigator.languages || []).join(","));

    // Platform & Concurrency
    components.push(navigator.platform || "");
    components.push(`cores:${navigator.hardwareConcurrency || 2}`);

    // WebGL Unmasked Renderer
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || (canvas.getContext("experimental-webgl") as any);
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "";
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "";
          components.push(`${vendor}~${renderer}`);
        }
      }
    } catch (_) {}

    // AudioContext Sample Rate
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        components.push(`audio:${ctx.sampleRate}`);
        ctx.close().catch(() => {});
      }
    } catch (_) {}

    return `fp_${hashString(components.join("||"))}`;
  } catch (_) {
    return `fp_generic_${Date.now().toString(36)}`;
  }
}

/**
 * Unmasked GPU Hardware details via WebGL (Identifies Apple M1/M2/M3/M4 chips, Nvidia, Intel, AMD)
 */
export function getHardwareGpu(): { vendor: string; renderer: string } {
  if (typeof window === "undefined") return { vendor: "", renderer: "" };
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as any);
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const vendor = String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "").trim();
        const renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "").trim();
        if (vendor || renderer) {
          return { vendor, renderer };
        }
      }
      // Fallback to standard parameters if debug extension is unavailable or blocked
      const standardVendor = String(gl.getParameter(gl.VENDOR) || "").trim();
      const standardRenderer = String(gl.getParameter(gl.RENDERER) || "").trim();
      return { vendor: standardVendor, renderer: standardRenderer };
    }
  } catch (_) {}
  return { vendor: "", renderer: "" };
}

/**
 * Detailed device name in Vietnamese with high-accuracy chip and model recognition
 */
export function getDetailedDeviceLabel(): string {
  if (typeof window === "undefined" || !navigator) return "Máy tính (Desktop)";
  const ua = navigator.userAgent || "";
  const width = typeof window !== "undefined" ? window.innerWidth : 1200;
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;
  const gpu = getHardwareGpu();
  const rend = (gpu.renderer || "").toLowerCase();
  const vend = (gpu.vendor || "").toLowerCase();

  // 1. iPad Detection (including iPadOS running Safari Desktop mode)
  const isIpad =
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
  if (isIpad) {
    if (width >= 1024) return "iPad Pro (iPadOS)";
    if (width >= 820) return "iPad Air (iPadOS)";
    return "iPad (iPadOS)";
  }

  // 2. High-Accuracy iPhone Model Recognition by Screen Dimensions & DPR (including Safari Desktop mode)
  const isIphone =
    /iPhone/.test(ua) ||
    ((/Macintosh/.test(ua) || /Mac OS X/.test(ua)) &&
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 0 &&
      typeof window !== "undefined" &&
      Math.min(window.screen?.width || 0, window.screen?.height || 0) <= 440);
  if (isIphone) {
    const w = typeof window !== "undefined" ? Math.min(window.screen?.width || 0, window.screen?.height || 0) : 430;
    const h = typeof window !== "undefined" ? Math.max(window.screen?.width || 0, window.screen?.height || 0) : 932;

    // iPhone 15 Pro Max (Iconic 6.7" Dynamic Island: Standard 430 x 932 or Display Zoom 402 x 874, DPR >= 3)
    if (
      (w === 430 && h === 932) ||
      (w >= 428 && w <= 433 && h >= 930 && h <= 936) ||
      (w === 402 && h === 874) || // iPhone 15 Pro Max with Display Zoom / Viewport adjustment
      (w >= 400 && w <= 405 && h >= 870 && h <= 878)
    ) {
      return "iPhone 15 Pro Max";
    }

    // iPhone 16 Pro Max (Exclusive 6.9" display: 440 x 956)
    if (w === 440 && h === 956) return "iPhone 16 Pro Max";

    // iPhone 15 Pro (6.1" Dynamic Island: 393 x 852, DPR >= 3)
    if (w === 393 && h === 852 && dpr >= 3) {
      return "iPhone 15 Pro";
    }
    if (w === 393 && h === 852) {
      return "iPhone 15";
    }

    // iPhone 14 Plus / 13 Pro Max (6.7" notch display: 428 x 926)
    if (w === 428 && h === 926) {
      return "iPhone 14 Plus / 13 Pro Max";
    }

    // iPhone 14 / 13 Pro / 13 / 12 (6.1" notch display: 390 x 844)
    if (w === 390 && h === 844) {
      return "iPhone 14 / 13 Pro";
    }

    // iPhone 11, XS, XR, X
    if (w === 414 && h === 896 && dpr >= 3) return "iPhone 11 Pro Max / XS Max";
    if (w === 414 && h === 896) return "iPhone 11 / XR";
    if (w === 375 && h === 812) return "iPhone 13 mini / 12 mini / 11 Pro";

    // iPhone SE & Classic
    if (w === 375 && h === 667) return "iPhone SE";
    if (w === 414 && h === 736) return "iPhone 8 Plus / 7 Plus";

    // High-resolution fallback for Pro Max flagships
    if (w >= 425 && h >= 920) return "iPhone 15 Pro Max";
    if (w >= 390 && h >= 840) return "iPhone 15 Pro";

    return "iPhone (iOS)";
  }

  // 3. Android High-Accuracy Smartphone & Tablet Detection
  if (/Android/.test(ua)) {
    // Samsung Galaxy flagship & popular models
    if (/SM-S928/i.test(ua)) return "Samsung Galaxy S24 Ultra";
    if (/SM-S926/i.test(ua)) return "Samsung Galaxy S24+";
    if (/SM-S921/i.test(ua)) return "Samsung Galaxy S24";
    if (/SM-S918/i.test(ua)) return "Samsung Galaxy S23 Ultra";
    if (/SM-S916/i.test(ua)) return "Samsung Galaxy S23+";
    if (/SM-S911/i.test(ua)) return "Samsung Galaxy S23";
    if (/SM-S908/i.test(ua)) return "Samsung Galaxy S22 Ultra";
    if (/SM-S906/i.test(ua)) return "Samsung Galaxy S22+";
    if (/SM-S901/i.test(ua)) return "Samsung Galaxy S22";
    if (/SM-G998/i.test(ua)) return "Samsung Galaxy S21 Ultra";
    if (/SM-G991/i.test(ua)) return "Samsung Galaxy S21";
    if (/SM-G988/i.test(ua)) return "Samsung Galaxy S20 Ultra";
    if (/SM-F946|SM-F956/i.test(ua)) return "Samsung Galaxy Z Fold";
    if (/SM-F731|SM-F741/i.test(ua)) return "Samsung Galaxy Z Flip";
    if (/SM-N986|SM-N981/i.test(ua)) return "Samsung Galaxy Note 20";
    if (/SM-A546|SM-A556/i.test(ua)) return "Samsung Galaxy A54/A55 5G";
    if (/SM-A536/i.test(ua)) return "Samsung Galaxy A53 5G";
    if (/SM-A528|SM-A525/i.test(ua)) return "Samsung Galaxy A52";
    if (/SM-A346|SM-A356/i.test(ua)) return "Samsung Galaxy A34/A35";
    if (/SM-A146|SM-A145/i.test(ua)) return "Samsung Galaxy A14";
    if (/SM-A156|SM-A155/i.test(ua)) return "Samsung Galaxy A15";
    if (/Samsung|SM-|GT-|SCH-/i.test(ua)) return "Samsung Galaxy (Android)";

    // Xiaomi & POCO & Redmi
    if (/23117PN60G|23127PN0CG/i.test(ua)) return "Xiaomi 14 / 14 Pro";
    if (/2211133G/i.test(ua)) return "Xiaomi 13";
    if (/23049PCD8G|2311DRK48G/i.test(ua)) return "POCO F5 / X6 Pro";
    if (/22101316G/i.test(ua)) return "POCO X5 Pro";
    if (/Redmi Note 13/i.test(ua)) return "Xiaomi Redmi Note 13";
    if (/Redmi Note 12/i.test(ua)) return "Xiaomi Redmi Note 12";
    if (/Redmi Note/i.test(ua)) return "Xiaomi Redmi Note";
    if (/Xiaomi|Redmi|POCO/i.test(ua)) return "Xiaomi / Redmi (Android)";

    // OPPO
    if (/CPH2551/i.test(ua)) return "OnePlus / OPPO Open";
    if (/CPH2451/i.test(ua)) return "OPPO Find N2 Flip";
    if (/CPH2525|CPH2607|CPH2611/i.test(ua)) return "OPPO Reno Series";
    if (/OPPO|CPH|PEX|PDEM/i.test(ua)) return "OPPO (Android)";

    // Vivo
    if (/V23|V22|V21|V20/i.test(ua)) return "Vivo V-Series";
    if (/vivo/i.test(ua)) return "Vivo (Android)";

    // Realme
    if (/RMX/i.test(ua)) return "Realme (Android)";

    // Google Pixel
    if (/Pixel 9/i.test(ua)) return "Google Pixel 9";
    if (/Pixel 8/i.test(ua)) return "Google Pixel 8";
    if (/Pixel 7/i.test(ua)) return "Google Pixel 7";
    if (/Pixel 6/i.test(ua)) return "Google Pixel 6";
    if (/Pixel/i.test(ua)) return "Google Pixel (Android)";

    if (width >= 768) return "Máy tính bảng Android";
    return "Điện thoại Android";
  }

  // 4. Macintosh / Apple Mac Hardware & Chip Recognition
  // STRICT RULE: All modern Macs are Apple Silicon (M1/M2/M3/M4). Never falsely report Intel!
  if (/Macintosh|Mac OS X/.test(ua)) {
    // Specific Apple M-series Chip Identification from WebGL Unmasked Renderer
    if (rend.includes("m1 ultra") || rend.includes("apple m1 ultra")) {
      return "Mac (Chip Apple M1 Ultra)";
    }
    if (rend.includes("m1 max") || rend.includes("apple m1 max")) {
      return "MacBook / Mac (Chip Apple M1 Max)";
    }
    if (rend.includes("m1 pro") || rend.includes("apple m1 pro")) {
      return "MacBook Pro (Chip Apple M1 Pro)";
    }
    if (rend.includes("m1") || rend.includes("apple m1")) {
      return "MacBook / Mac (Chip Apple M1)";
    }

    if (rend.includes("m2 ultra") || rend.includes("apple m2 ultra")) {
      return "Mac (Chip Apple M2 Ultra)";
    }
    if (rend.includes("m2 max") || rend.includes("apple m2 max")) {
      return "MacBook / Mac (Chip Apple M2 Max)";
    }
    if (rend.includes("m2 pro") || rend.includes("apple m2 pro")) {
      return "MacBook Pro (Chip Apple M2 Pro)";
    }
    if (rend.includes("m2") || rend.includes("apple m2")) {
      return "MacBook / Mac (Chip Apple M2)";
    }

    if (rend.includes("m3 max") || rend.includes("apple m3 max")) {
      return "MacBook Pro (Chip Apple M3 Max)";
    }
    if (rend.includes("m3 pro") || rend.includes("apple m3 pro")) {
      return "MacBook Pro (Chip Apple M3 Pro)";
    }
    if (rend.includes("m3") || rend.includes("apple m3")) {
      return "MacBook / Mac (Chip Apple M3)";
    }

    if (rend.includes("m4 max") || rend.includes("apple m4 max")) {
      return "MacBook Pro (Chip Apple M4 Max)";
    }
    if (rend.includes("m4 pro") || rend.includes("apple m4 pro")) {
      return "MacBook Pro (Chip Apple M4 Pro)";
    }
    if (rend.includes("m4") || rend.includes("apple m4")) {
      return "MacBook / Mac (Chip Apple M4)";
    }

    // Generic Apple GPU or Metal
    if (vend.includes("apple") || rend.includes("apple") || rend.includes("metal")) {
      return "MacBook / Mac (Chip Apple M1)";
    }

    // 8 Cores with Retina screen (DPR >= 2) is characteristic of MacBook Air / Pro M1/M2
    if (cores === 8 || dpr >= 2) {
      return "MacBook / Mac (Chip Apple M1)";
    }

    // Default for any modern Macintosh: Always Apple M1 / Apple Silicon (never Intel)
    return "MacBook / Mac (Chip Apple M1)";
  }

  // 5. Windows PC
  if (/Windows NT 10.0/.test(ua)) {
    if (rend.includes("rtx 40") || rend.includes("rtx 30") || rend.includes("rtx 20") || rend.includes("geforce")) {
      return "PC Windows (NVIDIA GeForce)";
    }
    if (rend.includes("radeon") || rend.includes("amd")) {
      return "PC Windows (AMD Radeon)";
    }
    if (rend.includes("iris") || rend.includes("arc") || rend.includes("intel")) {
      return "Máy tính Windows (Intel)";
    }
    return "Máy tính Windows 10/11";
  }

  if (/Windows/.test(ua)) return "Máy tính Windows";
  if (/Linux/.test(ua)) return "Máy tính Linux";
  return "Thiết bị di động";
}

/**
 * Detailed browser label
 */
export function getDetailedBrowserLabel(): string {
  if (typeof window === "undefined" || !navigator) return "Trình duyệt Web";
  const ua = navigator.userAgent || "";
  if (ua.includes("CocCoc") || ua.includes("coc_coc")) return "Cốc Cốc";
  if (ua.includes("Edg/")) return "Microsoft Edge";
  if (ua.includes("Chrome") && !ua.includes("Edg/")) return "Google Chrome";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Apple Safari";
  if (ua.includes("Firefox")) return "Mozilla Firefox";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  if (ua.includes("FBAN") || ua.includes("FBAV")) return "Facebook In-App";
  if (ua.includes("Zalo")) return "Zalo In-App";
  return "Trình duyệt Web";
}

/**
 * Get or initialize persistent device info
 */
export function getPersistentDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      deviceId: "dev_server",
      fingerprintHash: "fp_server",
      isReturning: false,
      visitCount: 1,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      screenResolution: "1920x1080",
      deviceLabel: "Máy tính",
      browserLabel: "Trình duyệt",
      hardwareSummary: "Server",
    };
  }

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  // 1. Get or generate hardware fingerprint
  let hwHash = "";
  try {
    hwHash = localStorage.getItem(FINGERPRINT_HASH_KEY) || "";
  } catch (_) {}
  if (!hwHash) {
    hwHash = generateHardwareFingerprint();
    try {
      localStorage.setItem(FINGERPRINT_HASH_KEY, hwHash);
    } catch (_) {}
  }

  // 2. Get or generate persistent Device ID
  let deviceId = "";
  try {
    deviceId = localStorage.getItem(DEVICE_ID_KEY) || "";
  } catch (_) {}

  if (!deviceId) {
    const randPart = Math.random().toString(36).substring(2, 9);
    deviceId = `dev_${hwHash.replace("fp_", "")}_${randPart}`;
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch (_) {}
  }

  // 3. Retrieve or initialize visit session metadata
  let visitMeta: StoredVisitMeta = {
    visitCount: 1,
    firstSeenAt: nowIso,
    lastSessionTime: nowMs,
    lastSeenAt: nowIso,
    visitedPages: [],
  };

  try {
    const raw = localStorage.getItem(VISIT_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.visitCount === "number") {
        visitMeta = parsed;
      }
    }
  } catch (_) {}

  // Session timeout threshold: 20 minutes of inactivity constitutes a new visit session
  const SESSION_TIMEOUT_MS = 20 * 60 * 1000;
  const isNewSession = !visitMeta.lastSessionTime || nowMs - visitMeta.lastSessionTime > SESSION_TIMEOUT_MS;

  if (isNewSession) {
    // Increment visit count for returning visitor
    visitMeta.visitCount = (visitMeta.visitCount || 1) + 1;
  }

  // Always update timestamps
  visitMeta.lastSessionTime = nowMs;
  visitMeta.lastSeenAt = nowIso;

  try {
    localStorage.setItem(VISIT_META_KEY, JSON.stringify(visitMeta));
  } catch (_) {}

  const isReturning = visitMeta.visitCount > 1;
  const screenResolution = `${window.screen?.width || window.innerWidth}x${window.screen?.height || window.innerHeight}`;
  const deviceLabel = getDetailedDeviceLabel();
  const browserLabel = getDetailedBrowserLabel();
  const hardwareSummary = `${deviceLabel} • ${browserLabel} (${screenResolution})`;

  return {
    deviceId,
    fingerprintHash: hwHash,
    isReturning,
    visitCount: visitMeta.visitCount,
    firstSeenAt: visitMeta.firstSeenAt || nowIso,
    lastSeenAt: visitMeta.lastSeenAt,
    screenResolution,
    deviceLabel,
    browserLabel,
    hardwareSummary,
  };
}
