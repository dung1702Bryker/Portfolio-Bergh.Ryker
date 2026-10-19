import { UAParser } from "ua-parser-js";

/**
 * Persistent Device Fingerprint & Returning Visitor Recognition Service
 * Identifies devices across sessions, distinguishes Returning Visitors from New Visitors,
 * tracks visit count, screen resolution, and hardware characteristics.
 */

const DEVICE_ID_KEY = "bergh_ryker_device_persistent_id_v2";
const VISIT_META_KEY = "bergh_ryker_visit_session_meta_v2";
const FINGERPRINT_HASH_KEY = "bergh_ryker_hw_fingerprint_hash_v2";

export interface NetworkConnectionInfo {
  connectionType: string; // "Wi-Fi", "5G", "4G", "3G", "2G", "Mạng dây (Ethernet)", "Ngoại tuyến"
  effectiveType?: string; // "4g", "3g", "2g", "slow-2g"
  downlink?: number; // Mb/s
  rtt?: number; // ms
  saveData?: boolean;
  statusLabel: string; // e.g. "Wi-Fi (10 Mb/s, 50ms)" or "4G (Cực nhanh)"
  bottleneckWarning?: string; // e.g. "Mạng 3G/2G chậm - có thể ảnh hưởng tải ảnh"
}

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
  browserName?: string;
  browserVersion?: string;
  network?: NetworkConnectionInfo;
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
 * High-accuracy model mapper for Android device codes extracted by ua-parser-js
 */
export function resolveModelCodeName(model: string, vendor: string): string | null {
  if (!model) return null;
  const m = model.trim().toUpperCase();

  // Samsung Galaxy S series
  if (m.includes("SM-S928")) return "Samsung Galaxy S24 Ultra";
  if (m.includes("SM-S926")) return "Samsung Galaxy S24+";
  if (m.includes("SM-S921")) return "Samsung Galaxy S24";
  if (m.includes("SM-S918")) return "Samsung Galaxy S23 Ultra";
  if (m.includes("SM-S916")) return "Samsung Galaxy S23+";
  if (m.includes("SM-S911")) return "Samsung Galaxy S23";
  if (m.includes("SM-S908")) return "Samsung Galaxy S22 Ultra";
  if (m.includes("SM-S906")) return "Samsung Galaxy S22+";
  if (m.includes("SM-S901")) return "Samsung Galaxy S22";
  if (m.includes("SM-G998")) return "Samsung Galaxy S21 Ultra";
  if (m.includes("SM-G991")) return "Samsung Galaxy S21";
  if (m.includes("SM-G988")) return "Samsung Galaxy S20 Ultra";
  if (m.includes("SM-G780") || m.includes("SM-G781")) return "Samsung Galaxy S20 FE";

  // Samsung Galaxy Z Fold & Z Flip
  if (m.includes("SM-F956")) return "Samsung Galaxy Z Fold 6";
  if (m.includes("SM-F946")) return "Samsung Galaxy Z Fold 5";
  if (m.includes("SM-F936")) return "Samsung Galaxy Z Fold 4";
  if (m.includes("SM-F741")) return "Samsung Galaxy Z Flip 6";
  if (m.includes("SM-F731")) return "Samsung Galaxy Z Flip 5";
  if (m.includes("SM-F721")) return "Samsung Galaxy Z Flip 4";

  // Samsung Galaxy Note
  if (m.includes("SM-N986")) return "Samsung Galaxy Note 20 Ultra";
  if (m.includes("SM-N981")) return "Samsung Galaxy Note 20";

  // Samsung Galaxy A series
  if (m.includes("SM-A556")) return "Samsung Galaxy A55 5G";
  if (m.includes("SM-A546")) return "Samsung Galaxy A54 5G";
  if (m.includes("SM-A536")) return "Samsung Galaxy A53 5G";
  if (m.includes("SM-A528") || m.includes("SM-A525")) return "Samsung Galaxy A52s";
  if (m.includes("SM-A356")) return "Samsung Galaxy A35 5G";
  if (m.includes("SM-A346")) return "Samsung Galaxy A34 5G";
  if (m.includes("SM-A256")) return "Samsung Galaxy A25 5G";
  if (m.includes("SM-A156") || m.includes("SM-A155")) return "Samsung Galaxy A15";
  if (m.includes("SM-A146") || m.includes("SM-A145")) return "Samsung Galaxy A14";

  // Xiaomi & Redmi & POCO
  if (m.includes("24030PN60G") || m.includes("24031PN0DC")) return "Xiaomi 14 Ultra";
  if (m.includes("23117PN60G") || m.includes("23127PN0CG")) return "Xiaomi 14 Pro";
  if (m.includes("23116PN5BC")) return "Xiaomi 14";
  if (m.includes("2210132G") || m.includes("2211133G")) return "Xiaomi 13 / 13 Pro";
  if (m.includes("2312DRA50G") || m.includes("23090RA98G")) return "Xiaomi Redmi Note 13 Pro+";
  if (m.includes("24069PC21G") || m.includes("2311DRK48G")) return "POCO F6 / X6 Pro";
  if (m.includes("23049PCD8G")) return "POCO F5";
  if (m.includes("22101316G")) return "POCO X5 Pro";

  // OPPO & OnePlus
  if (m.includes("CPH2607") || m.includes("CPH2611")) return "OPPO Reno 12 Pro";
  if (m.includes("CPH2525")) return "OPPO Reno 11 Series";
  if (m.includes("CPH2551")) return "OPPO Find N3";
  if (m.includes("CPH2451")) return "OPPO Find N2 Flip";
  if (m.includes("PHY110")) return "OPPO Find X7 Ultra";
  if (m.includes("CPH2573") || m.includes("CPH2581")) return "OnePlus 12";
  if (m.includes("CPH2449")) return "OnePlus 11";

  // Vivo & iQOO
  if (m.includes("V2324A")) return "Vivo X100 Pro";
  if (m.includes("V2318") || m.includes("V2319")) return "Vivo V30 5G";
  if (m.includes("V2250") || m.includes("V2254")) return "Vivo V27 5G";
  if (m.includes("I2220")) return "iQOO 12";

  // Realme
  if (m.includes("RMX3851")) return "Realme GT 6";

  // Google Pixel
  if (m.includes("PIXEL 9 PRO XL")) return "Google Pixel 9 Pro XL";
  if (m.includes("PIXEL 9 PRO")) return "Google Pixel 9 Pro";
  if (m.includes("PIXEL 9")) return "Google Pixel 9";
  if (m.includes("PIXEL 8 PRO")) return "Google Pixel 8 Pro";
  if (m.includes("PIXEL 8")) return "Google Pixel 8";
  if (m.includes("PIXEL 7 PRO")) return "Google Pixel 7 Pro";
  if (m.includes("PIXEL 7A")) return "Google Pixel 7a";
  if (m.includes("PIXEL 7")) return "Google Pixel 7";
  if (m.includes("PIXEL 6")) return "Google Pixel 6 Series";

  // Sony
  if (m.includes("XQ-EC54")) return "Sony Xperia 1 VI";
  if (m.includes("XQ-DQ54")) return "Sony Xperia 1 V";

  // General vendor + model if known
  if (vendor && model && !m.startsWith("GENERIC")) {
    return `${vendor} ${model}`;
  }

  return null;
}

/**
 * Detailed device name in Vietnamese with high-accuracy chip and model recognition
 */
export function getDetailedDeviceLabel(): string {
  if (typeof window === "undefined" || !navigator) return "Máy tính (Desktop)";
  const ua = navigator.userAgent || "";
  const scrW = typeof window !== "undefined" ? window.screen?.width || window.innerWidth : 1200;
  const scrH = typeof window !== "undefined" ? window.screen?.height || window.innerHeight : 800;
  const w = Math.min(scrW, scrH);
  const h = Math.max(scrW, scrH);
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;
  const maxTouch = typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0;
  const gpu = getHardwareGpu();
  const rend = (gpu.renderer || "").toLowerCase();

  // Parse user-agent with ua-parser-js
  const parser = new UAParser(ua);
  const parsed = parser.getResult();
  const osName = parsed.os.name || "";
  const osVersion = parsed.os.version || "";
  const devVendor = parsed.device.vendor || "";
  const devModel = parsed.device.model || "";
  const devType = parsed.device.type; // 'mobile', 'tablet', undefined

  // 1. High-Accuracy iPhone Recognition (Checked FIRST so mobile phones are NEVER mistaken for iPad)
  const isIphone =
    devModel === "iPhone" ||
    /iPhone/i.test(ua) ||
    /iPod/i.test(ua) ||
    ((osName === "iOS" || /iOS/i.test(ua)) && !/iPad/i.test(ua) && w < 700) ||
    ((/Macintosh/i.test(ua) || /Mac OS X/i.test(ua)) && maxTouch > 0 && w < 600 && !/Android/i.test(ua)) ||
    (typeof navigator !== "undefined" && (navigator.platform === "iPhone" || (navigator.platform === "MacIntel" && maxTouch > 1 && w < 600)));

  if (isIphone) {
    let iosMajor = "";
    const iosMatch = ua.match(/CPU (?:iPhone )?OS (\d+)[._](\d+)/i) || ua.match(/iPhone OS (\d+)[._](\d+)/i) || ua.match(/OS (\d+)[._](\d+)/i);
    if (iosMatch) {
      iosMajor = iosMatch[1];
    } else if (osVersion && !osVersion.startsWith("10.")) {
      iosMajor = osVersion.split(".")[0];
    }
    const osLabel = iosMajor ? `iOS ${iosMajor}` : "iOS";

    // iPhone 16 Pro Max (Exclusive 6.9" display: 440 x 956)
    if ((w === 440 && h === 956) || (w >= 438 && w <= 442 && h >= 950 && h <= 960)) {
      return `iPhone 16 Pro Max (${osLabel})`;
    }

    // iPhone 16 Pro (6.3" display: 402 x 874)
    if ((w === 402 && h === 874) || (w >= 400 && w <= 405 && h >= 870 && h <= 878)) {
      return `iPhone 16 Pro (${osLabel})`;
    }

    // iPhone 15 Pro Max (430 x 932 @ DPR 3, flagship 6.7" Super Retina XDR ProMotion)
    if ((w === 430 && h === 932) || (w >= 428 && w <= 433 && h >= 930 && h <= 936)) {
      return `iPhone 15 Pro Max (${osLabel})`;
    }

    // iPhone 15 Pro (393 x 852 @ DPR 3, flagship 6.1" Super Retina XDR ProMotion)
    if ((w === 393 && h === 852) || (w >= 390 && w <= 395 && h >= 850 && h <= 856)) {
      return `iPhone 15 Pro (${osLabel})`;
    }

    // iPhone 14 Plus / 13 Pro Max (428 x 926)
    if ((w === 428 && h === 926) || (w >= 426 && w <= 430 && h >= 922 && h <= 928)) {
      return `iPhone 14 Plus / 13 Pro Max (${osLabel})`;
    }

    // iPhone 14 / 13 Pro / 13 / 12 Pro / 12 (390 x 844)
    if ((w === 390 && h === 844) || (w >= 388 && w <= 392 && h >= 840 && h <= 848)) {
      return `iPhone 14 / 13 / 12 (${osLabel})`;
    }

    // iPhone 13 mini / 12 mini / 11 Pro / XS / X (375 x 812)
    if ((w === 375 && h === 812) || (w >= 373 && w <= 378 && h >= 808 && h <= 816)) {
      if (dpr >= 3) return `iPhone 13 mini / 12 mini / 11 Pro (${osLabel})`;
      return `iPhone XS / X (${osLabel})`;
    }

    // iPhone 11 Pro Max / XS Max (414 x 896, DPR >= 3)
    if (w === 414 && h === 896 && dpr >= 3) return `iPhone 11 Pro Max / XS Max (${osLabel})`;

    // iPhone 11 / XR (414 x 896, DPR < 3)
    if (w === 414 && h === 896) return `iPhone 11 / XR (${osLabel})`;

    // iPhone 8 Plus / 7 Plus (414 x 736)
    if (w === 414 && h === 736) return `iPhone 8 Plus / 7 Plus (${osLabel})`;

    // iPhone SE & Classic (375 x 667)
    if (w === 375 && h === 667) return `iPhone SE (${osLabel})`;

    // iPhone SE 1st gen (320 x 568)
    if (w === 320 && h === 568) return `iPhone SE 1st gen (${osLabel})`;

    // iPhone Display Zoom (320 x 693)
    if (w === 320 && h >= 690 && h <= 700) return `iPhone 14 / 13 (Zoom màn hình)`;

    if (w >= 420) return `iPhone Pro Max (${osLabel})`;
    if (w >= 390) return `iPhone Pro (${osLabel})`;
    return `Apple iPhone (${osLabel})`;
  }

  // 2. iPad Detection (ONLY for genuine tablets with screen width >= 700px, NEVER phones)
  const isIpad =
    !isIphone &&
    (w >= 700 || h >= 1000) &&
    (
      devModel === "iPad" ||
      osName === "iPadOS" ||
      /iPad/i.test(ua) ||
      ((/Macintosh/i.test(ua) || /Mac OS X/i.test(ua)) && maxTouch > 1)
    );
  if (isIpad) {
    let ipadMajor = "";
    const ipadMatch = ua.match(/OS (\d+)[._](\d+)/i) || ua.match(/Version\/(\d+)/i);
    if (ipadMatch) {
      ipadMajor = ipadMatch[1];
    } else if (osVersion) {
      ipadMajor = osVersion.split(".")[0];
    }
    const osVerStr = ipadMajor ? `iPadOS ${ipadMajor}` : "iPadOS";

    if (w >= 1024 || (w >= 1000 && h >= 1300)) return `iPad Pro 12.9" / 13" (${osVerStr})`;
    if (w >= 834 && h >= 1190) return `iPad Pro 11" (${osVerStr})`;
    if (w >= 820 && h >= 1180) return `iPad Air / Gen 10 (${osVerStr})`;
    if (w >= 744 && h >= 1130) return `iPad mini (${osVerStr})`;
    return `Apple iPad (${osVerStr})`;
  }

  // 3. Android High-Accuracy Smartphone & Tablet Recognition via ua-parser-js
  if (osName === "Android" || /Android/.test(ua)) {
    // 3a. Resolve model from ua-parser-js device model code
    if (devModel) {
      const resolvedFromCode = resolveModelCodeName(devModel, devVendor);
      if (resolvedFromCode) {
        return resolvedFromCode;
      }
    }

    // 3b. Fallback to model string matching
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
    if (/SM-G780|SM-G781/i.test(ua)) return "Samsung Galaxy S20 FE";
    if (/SM-F956/i.test(ua)) return "Samsung Galaxy Z Fold 6";
    if (/SM-F946/i.test(ua)) return "Samsung Galaxy Z Fold 5";
    if (/SM-F936/i.test(ua)) return "Samsung Galaxy Z Fold 4";
    if (/SM-F741/i.test(ua)) return "Samsung Galaxy Z Flip 6";
    if (/SM-F731/i.test(ua)) return "Samsung Galaxy Z Flip 5";
    if (/SM-F721/i.test(ua)) return "Samsung Galaxy Z Flip 4";
    if (/SM-N986/i.test(ua)) return "Samsung Galaxy Note 20 Ultra";
    if (/SM-N981/i.test(ua)) return "Samsung Galaxy Note 20";
    if (/SM-A556/i.test(ua)) return "Samsung Galaxy A55 5G";
    if (/SM-A546/i.test(ua)) return "Samsung Galaxy A54 5G";
    if (/SM-A536/i.test(ua)) return "Samsung Galaxy A53 5G";
    if (/SM-A528|SM-A525/i.test(ua)) return "Samsung Galaxy A52s";
    if (/SM-A356/i.test(ua)) return "Samsung Galaxy A35 5G";
    if (/SM-A346/i.test(ua)) return "Samsung Galaxy A34 5G";
    if (/SM-A256/i.test(ua)) return "Samsung Galaxy A25 5G";
    if (/SM-A156|SM-A155/i.test(ua)) return "Samsung Galaxy A15";
    if (/SM-A146|SM-A145/i.test(ua)) return "Samsung Galaxy A14";

    // Xiaomi & POCO & Redmi
    if (/24030PN60G|24031PN0DC/i.test(ua)) return "Xiaomi 14 Ultra";
    if (/23117PN60G|23127PN0CG/i.test(ua)) return "Xiaomi 14 Pro";
    if (/23127PN0CG|23116PN5BC/i.test(ua)) return "Xiaomi 14";
    if (/2210132G|2211133G/i.test(ua)) return "Xiaomi 13 / 13 Pro";
    if (/2312DRA50G|23090RA98G/i.test(ua)) return "Xiaomi Redmi Note 13 Pro+";
    if (/Redmi Note 13/i.test(ua)) return "Xiaomi Redmi Note 13";
    if (/Redmi Note 12/i.test(ua)) return "Xiaomi Redmi Note 12";
    if (/Redmi Note/i.test(ua)) return "Xiaomi Redmi Note";
    if (/24069PC21G|2311DRK48G/i.test(ua)) return "POCO F6 / X6 Pro";
    if (/23049PCD8G/i.test(ua)) return "POCO F5";
    if (/22101316G/i.test(ua)) return "POCO X5 Pro";

    // OPPO & OnePlus
    if (/CPH2607|CPH2611/i.test(ua)) return "OPPO Reno 12 Pro";
    if (/CPH2525/i.test(ua)) return "OPPO Reno 11 Series";
    if (/CPH2551/i.test(ua)) return "OPPO Find N3";
    if (/CPH2451/i.test(ua)) return "OPPO Find N2 Flip";
    if (/PHY110/i.test(ua)) return "OPPO Find X7 Ultra";
    if (/CPH2573|CPH2581/i.test(ua)) return "OnePlus 12";
    if (/CPH2449/i.test(ua)) return "OnePlus 11";

    // Vivo & iQOO
    if (/V2324A/i.test(ua)) return "Vivo X100 Pro";
    if (/V2318|V2319/i.test(ua)) return "Vivo V30 5G";
    if (/V2250|V2254/i.test(ua)) return "Vivo V27 5G";
    if (/I2220/i.test(ua)) return "iQOO 12";

    // Google Pixel
    if (/Pixel 9 Pro XL/i.test(ua)) return "Google Pixel 9 Pro XL";
    if (/Pixel 9 Pro/i.test(ua)) return "Google Pixel 9 Pro";
    if (/Pixel 9/i.test(ua)) return "Google Pixel 9";
    if (/Pixel 8 Pro/i.test(ua)) return "Google Pixel 8 Pro";
    if (/Pixel 8/i.test(ua)) return "Google Pixel 8";
    if (/Pixel 7 Pro/i.test(ua)) return "Google Pixel 7 Pro";
    if (/Pixel 7a/i.test(ua)) return "Google Pixel 7a";
    if (/Pixel 7/i.test(ua)) return "Google Pixel 7";
    if (/Pixel 6/i.test(ua)) return "Google Pixel 6 Series";

    if (devType === "tablet" || w >= 768) {
      return devVendor ? `Máy tính bảng ${devVendor}` : "Máy tính bảng Android";
    }

    if (devVendor) {
      return `${devVendor} (Android ${osVersion || ""})`.trim();
    }
    return `Điện thoại Android (v${osVersion || "14"})`;
  }

  // 4. Apple Mac Form Factor & Chip Specific Identification
  if (osName === "Mac OS" || osName === "macOS" || /Macintosh|Mac OS X/.test(ua)) {
    // Identify Chip
    let chip = "Chip Apple Silicon";
    if (rend.includes("m4 max")) chip = "Apple M4 Max";
    else if (rend.includes("m4 pro")) chip = "Apple M4 Pro";
    else if (rend.includes("m4")) chip = "Apple M4";
    else if (rend.includes("m3 max")) chip = "Apple M3 Max";
    else if (rend.includes("m3 pro")) chip = "Apple M3 Pro";
    else if (rend.includes("m3")) chip = "Apple M3";
    else if (rend.includes("m2 ultra")) chip = "Apple M2 Ultra";
    else if (rend.includes("m2 max")) chip = "Apple M2 Max";
    else if (rend.includes("m2 pro")) chip = "Apple M2 Pro";
    else if (rend.includes("m2")) chip = "Apple M2";
    else if (rend.includes("m1 ultra")) chip = "Apple M1 Ultra";
    else if (rend.includes("m1 max")) chip = "Apple M1 Max";
    else if (rend.includes("m1 pro")) chip = "Apple M1 Pro";
    else if (rend.includes("m1")) chip = "Apple M1";
    else if (rend.includes("intel") || rend.includes("iris") || rend.includes("radeon pro")) {
      chip = "Intel Core";
    }

    // Identify Form Factor by Display Resolution & DPR
    // MacBook Pro 16" (1728 x 1117 @ 2x or 1680 x 1050)
    if ((scrW === 1728 && scrH === 1117) || (scrW >= 1680 && scrW <= 1730 && scrH >= 1050 && scrH <= 1120)) {
      return `MacBook Pro 16" (${chip})`;
    }

    // MacBook Pro 14" (1512 x 982 @ 2x)
    if ((scrW === 1512 && scrH === 982) || (scrW >= 1500 && scrW <= 1520 && scrH >= 975 && scrH <= 990)) {
      return `MacBook Pro 14" (${chip})`;
    }

    // MacBook Air 15" (1440 x 932 @ 2x)
    if (scrW === 1440 && scrH === 932) {
      return `MacBook Air 15" (${chip})`;
    }

    // MacBook Air 13" / MacBook Pro 13" (1470 x 956, 1280 x 800, 1440 x 900 @ 2x)
    if (
      (scrW === 1470 && scrH === 956) ||
      (scrW === 1280 && scrH === 800) ||
      (scrW === 1440 && scrH === 900)
    ) {
      return `MacBook Air 13" (${chip})`;
    }

    // iMac 24" (2240 x 1260 @ 2x)
    if ((scrW === 2240 && scrH === 1260) || (scrW >= 2048 && scrH >= 1152 && dpr >= 2)) {
      return `iMac 24" (${chip})`;
    }

    // External Monitors (Mac Studio / Mac mini)
    if (scrW >= 2560 || scrW >= 1920) {
      if (chip.includes("Ultra") || chip.includes("Max")) {
        return `Mac Studio (${chip})`;
      }
      if (chip.includes("Pro")) {
        return `Mac mini / MacBook Pro (${chip})`;
      }
      return `Mac mini / Studio (${chip})`;
    }

    return `MacBook (${chip})`;
  }

  // 5. Windows PC & Laptops with Specific Windows Version & GPU
  if (osName === "Windows" || /Windows/.test(ua)) {
    const winVer = osVersion || (/Windows NT 10.0/.test(ua) ? "10/11" : /Windows NT 6.3/.test(ua) ? "8.1" : /Windows NT 6.1/.test(ua) ? "7" : "");
    const winLabel = winVer ? `Windows ${winVer}` : "Windows";

    // Microsoft Surface Detection (Windows + Touch + 3:2 Display Aspect Ratio)
    const isSurface = maxTouch > 0 && Math.abs(scrW / scrH - 1.5) < 0.05;
    if (isSurface) {
      return `Microsoft Surface Pro (${winLabel})`;
    }

    // NVIDIA GeForce GPU Identification
    if (rend.includes("rtx 4090")) return `PC ${winLabel} (GeForce RTX 4090)`;
    if (rend.includes("rtx 4080")) return `PC ${winLabel} (GeForce RTX 4080)`;
    if (rend.includes("rtx 4070")) return `PC ${winLabel} (GeForce RTX 4070)`;
    if (rend.includes("rtx 4060")) return `Laptop/PC ${winLabel} (GeForce RTX 4060)`;
    if (rend.includes("rtx 4050")) return `Laptop ${winLabel} (GeForce RTX 4050)`;
    if (rend.includes("rtx 3080") || rend.includes("rtx 3090")) return `PC ${winLabel} (GeForce RTX 3080/3090)`;
    if (rend.includes("rtx 3070")) return `PC ${winLabel} (GeForce RTX 3070)`;
    if (rend.includes("rtx 3060")) return `Laptop/PC ${winLabel} (GeForce RTX 3060)`;
    if (rend.includes("rtx 3050")) return `Laptop ${winLabel} (GeForce RTX 3050)`;
    if (rend.includes("rtx 2060") || rend.includes("rtx 2070") || rend.includes("rtx 2080")) {
      return `PC ${winLabel} (GeForce RTX 20-Series)`;
    }
    if (rend.includes("gtx 1660") || rend.includes("gtx 1650")) {
      return `Laptop/PC ${winLabel} (GeForce GTX)`;
    }
    if (rend.includes("geforce") || rend.includes("nvidia")) {
      return `PC ${winLabel} (NVIDIA GeForce)`;
    }

    // AMD Radeon GPU Identification
    if (rend.includes("rx 7900") || rend.includes("rx 7800") || rend.includes("rx 7700")) {
      return `PC ${winLabel} (AMD Radeon RX 7000)`;
    }
    if (rend.includes("rx 6700") || rend.includes("rx 6600") || rend.includes("rx 6800")) {
      return `PC ${winLabel} (AMD Radeon RX 6000)`;
    }
    if (rend.includes("radeon") || rend.includes("amd")) {
      return `PC ${winLabel} (AMD Radeon Graphics)`;
    }

    // Intel Arc / Iris Xe GPU Identification
    if (rend.includes("arc")) return `PC ${winLabel} (Intel Arc Graphics)`;
    if (rend.includes("iris xe") || rend.includes("iris")) return `Laptop ${winLabel} (Intel Iris Xe)`;
    if (rend.includes("uhd") || rend.includes("intel")) return `Máy tính ${winLabel} (Intel UHD)`;

    if (maxTouch > 0) return `Laptop ${winLabel} cảm ứng (Touchscreen)`;
    if (cores >= 12) return `PC ${winLabel} Workstation (Đa nhân)`;
    return `Máy tính ${winLabel}`;
  }

  // 6. Linux Workstations & Distributions
  if (osName === "Linux" || /Linux/.test(ua)) {
    const dist = /Ubuntu/i.test(ua) ? "Ubuntu" : /Fedora/i.test(ua) ? "Fedora" : /Arch/i.test(ua) ? "Arch Linux" : "Linux";
    if (rend.includes("nvidia")) return `Máy tính ${dist} (NVIDIA GPU)`;
    if (rend.includes("amd") || rend.includes("radeon")) return `Máy tính ${dist} (AMD GPU)`;
    return `Máy tính ${dist}`;
  }

  // 7. Chrome OS
  if (osName === "Chromium OS" || /CrOS/i.test(ua)) {
    return "Chromebook (Chrome OS)";
  }

  return "Thiết bị di động";
}

/**
 * Detailed browser label with exact version from ua-parser-js
 */
/**
 * Get detailed browser info including exact version string and browser name
 */
export function getDetailedBrowserVersion(): { browserName: string; browserVersion: string; fullLabel: string } {
  if (typeof window === "undefined" || !navigator) {
    return { browserName: "Trình duyệt Web", browserVersion: "", fullLabel: "Trình duyệt Web" };
  }
  const ua = navigator.userAgent || "";

  // Priority special local browsers & in-app webviews
  if (ua.includes("CocCoc") || ua.includes("coc_coc")) {
    const match = ua.match(/CocCoc\/([0-9.]+)/i);
    const ver = match ? match[1] : "";
    return {
      browserName: "Cốc Cốc",
      browserVersion: ver,
      fullLabel: ver ? `Cốc Cốc v${ver}` : "Cốc Cốc",
    };
  }
  if (ua.includes("FBAN") || ua.includes("FBAV")) {
    const match = ua.match(/FBAV\/([0-9.]+)/i);
    const ver = match ? match[1] : "";
    return {
      browserName: "Facebook In-App",
      browserVersion: ver,
      fullLabel: ver ? `Facebook App v${ver}` : "Facebook In-App",
    };
  }
  if (ua.includes("Zalo")) {
    const match = ua.match(/Zalo\/([0-9.]+)/i);
    const ver = match ? match[1] : "";
    return {
      browserName: "Zalo In-App",
      browserVersion: ver,
      fullLabel: ver ? `Zalo v${ver}` : "Zalo In-App",
    };
  }

  const parser = new UAParser(ua);
  const browser = parser.getBrowser();
  const name = browser.name || "";
  const version = browser.version || browser.major || "";

  if (name) {
    let cleanName = name;
    if (name === "Mobile Safari") cleanName = "Safari Mobile";
    else if (name === "Mobile Chrome") cleanName = "Chrome Mobile";
    else if (name === "Chrome") cleanName = "Google Chrome";
    else if (name === "Edge") cleanName = "Microsoft Edge";
    else if (name === "Firefox") cleanName = "Mozilla Firefox";

    const fullLabel = version ? `${cleanName} v${version}` : cleanName;
    return {
      browserName: cleanName,
      browserVersion: version,
      fullLabel,
    };
  }

  return {
    browserName: "Trình duyệt Web",
    browserVersion: "",
    fullLabel: getDetailedBrowserLabel(),
  };
}

/**
 * Detailed Network Connection Status & Mobile Bottleneck Detection
 * Supports Network Information API (navigator.connection / mozConnection / webkitConnection)
 */
export function getClientNetworkConnection(): NetworkConnectionInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      connectionType: "Mạng trực tuyến",
      statusLabel: "Trực tuyến",
    };
  }

  // Check if browser reports offline
  if (navigator.onLine === false) {
    return {
      connectionType: "Ngoại tuyến",
      statusLabel: "Mất mạng (Offline)",
      bottleneckWarning: "Thiết bị hiện đang mất kết nối Internet!",
    };
  }

  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

  if (!conn) {
    return {
      connectionType: "Trực tuyến (Wi-Fi/4G)",
      statusLabel: "Trực tuyến",
    };
  }

  const effectiveType = conn.effectiveType || ""; // "slow-2g", "2g", "3g", "4g"
  const type = conn.type || ""; // "wifi", "cellular", "ethernet", etc.
  const downlink = typeof conn.downlink === "number" ? conn.downlink : undefined; // Mb/s
  const rtt = typeof conn.rtt === "number" ? conn.rtt : undefined; // ms
  const saveData = Boolean(conn.saveData);

  let connectionType = "Wi-Fi";
  let bottleneckWarning: string | undefined;

  // Resolve connectionType (Wi-Fi, 5G, 4G, 3G, 2G, Ethernet)
  if (type === "wifi") {
    connectionType = "Wi-Fi";
  } else if (type === "ethernet") {
    connectionType = "Ethernet (Dây)";
  } else if (type === "cellular" || !type) {
    // If cellular or unspecified mobile network
    if (downlink && downlink >= 35) {
      connectionType = "5G";
    } else if (effectiveType === "4g") {
      connectionType = "4G";
    } else if (effectiveType === "3g") {
      connectionType = "3G";
    } else if (effectiveType === "2g" || effectiveType === "slow-2g") {
      connectionType = "2G";
    } else {
      connectionType = "4G / Wi-Fi";
    }
  }

  // Refine 5G detection on mobile: modern 5G cellular delivers high downlink (>= 30-40 Mbps) or low latency (< 40ms)
  if (connectionType === "4G" && downlink && downlink >= 40) {
    connectionType = "5G / 4G+";
  }

  // Detect bottleneck warnings for high-resolution photo gallery loading
  if (saveData) {
    bottleneckWarning = "Tiết kiệm dữ liệu (Data Saver) đang bật - ảnh có thể giảm tải";
  } else if (effectiveType === "slow-2g" || effectiveType === "2g") {
    bottleneckWarning = `Mạng 2G cực chậm (${downlink ? downlink + " Mb/s" : "< 0.5 Mb/s"}, ${rtt ? rtt + "ms" : "ping cao"}) - dễ nghẽn tải ảnh HD`;
  } else if (effectiveType === "3g" || (downlink && downlink < 1.5)) {
    bottleneckWarning = `Mạng 3G (${downlink ? downlink + " Mb/s" : "tốc độ trung bình"}) - ảnh lớn có thể tải chậm`;
  } else if (rtt && rtt > 450) {
    bottleneckWarning = `Độ trễ cao (${rtt}ms) - phản hồi trang có thể bị giật`;
  }

  // Format status label
  const parts: string[] = [connectionType];
  if (downlink !== undefined && downlink > 0) {
    parts.push(`${downlink} Mb/s`);
  }
  if (rtt !== undefined && rtt > 0) {
    parts.push(`${rtt}ms`);
  }
  if (saveData) {
    parts.push("Data Saver");
  }

  const statusLabel = parts.join(" • ");

  return {
    connectionType,
    effectiveType,
    downlink,
    rtt,
    saveData,
    statusLabel,
    bottleneckWarning,
  };
}

/**
 * Detailed browser label with exact version from ua-parser-js
 */
export function getDetailedBrowserLabel(): string {
  if (typeof window === "undefined" || !navigator) return "Trình duyệt Web";
  const { fullLabel } = getDetailedBrowserVersion();
  return fullLabel;
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
  const browserVerInfo = getDetailedBrowserVersion();
  const browserLabel = browserVerInfo.fullLabel || getDetailedBrowserLabel();
  const networkInfo = getClientNetworkConnection();
  const hardwareSummary = `${deviceLabel} • ${browserLabel} (${screenResolution}) • ${networkInfo.statusLabel}`;

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
    browserName: browserVerInfo.browserName,
    browserVersion: browserVerInfo.browserVersion,
    network: networkInfo,
    hardwareSummary,
  };
}
