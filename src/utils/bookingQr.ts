import QRCode from "qrcode";
import { Booking } from "../types";
import { safeLocalStorage } from "./safeStorage";

/**
 * Đường dẫn công khai chuẩn (Public Production URL) của dự án Bergh.Ryker.
 * Mở trực tiếp trên điện thoại (4G, Wi-Fi, Safari, Zalo, Messenger, Chrome)
 * KHÔNG qua proxy nội bộ AI Studio (*.scf.usercontent.goog hay ais-dev-*) để không bị màn hình Cookie check / Google Login chặn.
 */
export const OFFICIAL_PUBLIC_DOMAIN =
  "https://striped-equinox-3r5vm.web.app";

/**
 * Lấy tên miền tùy chỉnh do Admin lưu (nếu có)
 */
export function getCustomPublicDomain(): string | null {
  try {
    const val = safeLocalStorage.getItem("bergh_public_domain");
    if (val && val.trim().startsWith("http")) {
      let clean = val.trim().replace(/\/+$/, "");
      // Tự động chuyển đổi nếu admin lỡ nhập ais-dev-
      if (clean.includes("ais-dev-")) {
        clean = clean.replace("ais-dev-", "ais-pre-");
      }
      // Bỏ qua các domain ví dụ mẫu chưa đăng ký DNS thực tế trên internet gây lỗi NXDOMAIN
      if (
        clean.includes("berghryker.vn") ||
        clean.includes("berghryker.st") ||
        clean.includes("example.com")
      ) {
        return null;
      }
      return clean;
    }
  } catch (_) {}
  return null;
}

/**
 * Cập nhật tên miền tùy chỉnh vào safeLocalStorage
 */
export function setCustomPublicDomain(domain: string): void {
  try {
    let clean = domain.trim().replace(/\/+$/, "");
    if (clean) {
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = `https://${clean}`;
      }
      // Tự động chuyển đổi nếu admin lỡ nhập ais-dev-
      if (clean.includes("ais-dev-")) {
        clean = clean.replace("ais-dev-", "ais-pre-");
      }
      safeLocalStorage.setItem("bergh_public_domain", clean);
    } else {
      safeLocalStorage.removeItem("bergh_public_domain");
    }
  } catch (_) {}
}

/**
 * Đọc biến môi trường PUBLIC_BOOKING_BASE_URL hoặc VITE_PUBLIC_BOOKING_BASE_URL.
 */
export const PUBLIC_BOOKING_BASE_URL: string = (() => {
  try {
    if (typeof import.meta !== "undefined" && (import.meta as any).env) {
      const viteEnv = (import.meta as any).env.VITE_PUBLIC_BOOKING_BASE_URL || (import.meta as any).env.PUBLIC_BOOKING_BASE_URL;
      if (viteEnv && typeof viteEnv === "string" && viteEnv.trim()) {
        let clean = viteEnv.trim().replace(/\/+$/, "");
        if (clean.includes("ais-dev-")) clean = clean.replace("ais-dev-", "ais-pre-");
        return clean;
      }
    }
  } catch (_) {}

  try {
    if (typeof process !== "undefined" && process.env) {
      const procEnv = process.env.PUBLIC_BOOKING_BASE_URL || process.env.VITE_PUBLIC_BOOKING_BASE_URL;
      if (procEnv && typeof procEnv === "string" && procEnv.trim()) {
        let clean = procEnv.trim().replace(/\/+$/, "");
        if (clean.includes("ais-dev-")) clean = clean.replace("ais-dev-", "ais-pre-");
        return clean;
      }
    }
  } catch (_) {}

  return OFFICIAL_PUBLIC_DOMAIN;
})();

/**
 * Lấy Base URL công khai chuẩn để tạo link xác nhận và mã QR cho khách.
 * - Ưu tiên 1: Tên miền tùy chỉnh Admin cài đặt trong Modal Chia Sẻ ('bergh_public_domain').
 * - Ưu tiên 2: Tên miền trực tiếp Cloud Run (.run.app) hoặc custom domain riêng.
 * - Tuyệt đối không dùng domain proxy nội bộ (*.scf.usercontent.goog, aistudio.google.com, hoặc ais-dev-*)
 *   vì sẽ bị màn hình 'Cookie check' / 'Action required' chặn trên iPhone.
 */
export function getPublicBookingBaseUrl(): string {
  // 1. Kiểm tra domain tùy chỉnh do Admin cài đặt
  const custom = getCustomPublicDomain();
  if (custom) {
    return custom;
  }

  // 2. Kiểm tra origin hiện tại
  try {
    if (typeof window !== "undefined" && window.location && window.location.origin) {
      const origin = window.location.origin.replace(/\/+$/, "");
      
      // Tuyệt đối không dùng domain proxy nội bộ của AI Studio hoặc usercontent.goog vì có trang Cookie check!
      if (
        origin.includes("usercontent.goog") ||
        origin.includes("aistudio.google.com") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.includes("0.0.0.0")
      ) {
        return OFFICIAL_PUBLIC_DOMAIN;
      }

      // Nếu admin đang làm việc trên máy chủ dev của AI Studio (ais-dev-*.run.app),
      // tự động chuyển sang public shared instance (ais-pre-*.run.app) để khách hàng không bị chặn Cookie check!
      if (origin.includes("ais-dev-")) {
        return origin.replace("ais-dev-", "ais-pre-");
      }

      // Domain trực tiếp Cloud Run (.run.app) hoặc custom domain (berghryker.vn, vercel.app, v.v.)
      if (origin.startsWith("http")) {
        return origin;
      }
    }
  } catch (_) {}

  if (PUBLIC_BOOKING_BASE_URL) {
    const cleaned = PUBLIC_BOOKING_BASE_URL.replace(/\/+$/, "");
    if (
      !cleaned.includes("usercontent.goog") &&
      !cleaned.includes("aistudio.google.com") &&
      !cleaned.includes("localhost")
    ) {
      if (cleaned.includes("ais-dev-")) {
        return cleaned.replace("ais-dev-", "ais-pre-");
      }
      return cleaned;
    }
  }

  return OFFICIAL_PUBLIC_DOMAIN;
}

/**
 * Helper function ensuring all URLs, QR codes, and OG image references
 * strictly use the production domain defined in PUBLIC_BOOKING_BASE_URL.
 * Automatically strips and replaces any detected AI Studio proxy domains
 * (such as *.usercontent.goog, aistudio.google.com, or ais-dev-*) before generating links.
 *
 * @param path Optional subpath, query string, or full URL to be sanitized
 * @param customDomainOverride Optional custom domain override provided by user
 * @returns Standardized public production URL (e.g. https://ais-pre-...run.app/?proofing=...)
 */
export function getPublicUrl(path = "", customDomainOverride?: string): string {
  // 1. Resolve production base domain strictly from customDomainOverride, PUBLIC_BOOKING_BASE_URL or getCustomPublicDomain()
  let prodDomain = PUBLIC_BOOKING_BASE_URL || OFFICIAL_PUBLIC_DOMAIN;
  const custom =
    customDomainOverride !== undefined && customDomainOverride !== null && customDomainOverride.trim() !== ""
      ? customDomainOverride.trim()
      : getCustomPublicDomain();

  if (
    custom &&
    !custom.includes("usercontent.goog") &&
    !custom.includes("aistudio.google.com") &&
    !custom.includes("localhost")
  ) {
    prodDomain = custom;
  }

  // Ensure production domain is cleaned of trailing slashes and dev proxy indicators
  prodDomain = prodDomain.trim().replace(/\/+$/, "");
  if (prodDomain.includes("ais-dev-")) {
    prodDomain = prodDomain.replace("ais-dev-", "ais-pre-");
  }

  if (!prodDomain.startsWith("http://") && !prodDomain.startsWith("https://")) {
    prodDomain = `https://${prodDomain}`;
  }

  if (!path || !path.trim()) {
    return prodDomain;
  }

  let cleanPath = path.trim();

  // If path is a full URL containing usercontent.goog, aistudio, or ais-dev-, replace its origin with prodDomain
  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    try {
      const urlObj = new URL(cleanPath);
      if (
        urlObj.hostname.includes("usercontent.goog") ||
        urlObj.hostname.includes("aistudio.google.com") ||
        urlObj.hostname.includes("localhost") ||
        urlObj.hostname.includes("127.0.0.1") ||
        urlObj.hostname.includes("ais-dev-")
      ) {
        const prodObj = new URL(prodDomain);
        urlObj.protocol = prodObj.protocol;
        urlObj.host = prodObj.host;
        return urlObj.toString();
      }
      return cleanPath;
    } catch (_) {
      cleanPath = cleanPath.replace(/^https?:\/\/[^/?#]+/, "");
    }
  }

  // Format relative path or query string
  if (cleanPath.startsWith("?")) {
    return `${prodDomain}/${cleanPath}`;
  }
  if (!cleanPath.startsWith("/")) {
    cleanPath = `/${cleanPath}`;
  }
  return `${prodDomain}${cleanPath}`;
}

/**
 * Danh sách từ khóa domain bị cấm (chỉ dành cho môi trường nội bộ/dev).
 * Khách hàng quét mã QR trên điện thoại gặp các domain này sẽ bị lỗi không mở được.
 */
export const UNAUTHORIZED_DOMAIN_KEYWORDS = [
  "aistudio",
  "aistudio.google.com",
  "usercontent.goog",
  "scf.usercontent.goog",
  "ais-dev-",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
];

/**
 * Kiểm tra xem một đường dẫn URL có chứa domain không hợp lệ hay không
 */
export function containsUnauthorizedDomainKeywords(url?: string): boolean {
  if (!url || typeof url !== "string") return true;
  const lower = url.toLowerCase();
  return UNAUTHORIZED_DOMAIN_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Helper function bắt buộc: Kiểm tra URL booking và chuẩn hóa sang định dạng:
 * ${publicBase}/?booking=${bookingCode}
 * Bỏ qua hoàn toàn các subpath /booking/... để tránh lỗi 404/Page not found trên điện thoại.
 */
export function ensureValidPublicBookingUrl(
  rawUrl?: string,
  bookingCode?: string
): string {
  const publicBase = getPublicBookingBaseUrl();
  const code = (bookingCode || decodeBookingIdentifier(rawUrl) || "").trim() || "BR-STUDIO";
  return `${publicBase}/?booking=${encodeURIComponent(code)}`;
}

/**
 * Chuẩn hóa link xác nhận đảm bảo luôn trỏ về domain public xem được trên điện thoại
 */
export function sanitizeBookingConfirmationLink(
  existingLink?: string,
  bookingCode?: string
): string {
  return ensureValidPublicBookingUrl(existingLink, bookingCode);
}

/**
 * Trích xuất chuẩn xác mã booking, booking ID, hoặc mã tra cứu từ bất kỳ định dạng nào:
 * - URL xác nhận đầy đủ (VD: https://domain/booking/BR-2026-CNM6, https://domain/?bookingId=BRBK_016721)
 * - Đường dẫn tương đối (/booking/BR-2026-6721, #booking/BR-2026-CNM6)
 * - Query parameter (?ticket=..., ?progress=..., ?bookingCode=..., ?id=...)
 * - Mã trực tiếp (BR-2026-6721, BRBK_016721, 6721, 0853326829, v.v.)
 */
export function decodeBookingIdentifier(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "";
  let str = decodeURIComponent(raw).trim().replace(/^["'`]+|["'`]+$/g, "");
  if (!str) return "";

  // 1. Nếu là URL hợp lệ hoặc có cấu trúc URL (chứa ://, /, ?, #)
  try {
    const parseUrl = str.includes("://") ? new URL(str) : new URL(str, "https://berghryker.vn");
    const paramKeys = [
      "bookingId",
      "booking_id",
      "id",
      "ticket",
      "progress",
      "track",
      "lookup",
      "bookingCode",
      "code",
      "booking",
      "b",
    ];

    // Kiểm tra search params (?bookingId=..., ?ticket=...)
    for (const key of paramKeys) {
      const val = parseUrl.searchParams.get(key);
      if (val && val.trim()) return val.trim();
    }

    // Kiểm tra hash (#booking/... hoặc #...?bookingId=...)
    if (parseUrl.hash) {
      const hashClean = parseUrl.hash.replace(/^#\/?/, "");
      const hashPathMatch = hashClean.match(/(?:^|\/)booking\/([^/?#&]+)/i);
      if (hashPathMatch && hashPathMatch[1]) return hashPathMatch[1].trim();

      const hashParamMatch = hashClean.match(
        /(?:[?&]|^)(?:bookingId|booking_id|id|ticket|progress|track|lookup|bookingCode|code|booking|b)=([^/?#&]+)/i
      );
      if (hashParamMatch && hashParamMatch[1]) return hashParamMatch[1].trim();
    }

    // Kiểm tra pathname (/booking/BR-2026-CNM6)
    const pathMatch = parseUrl.pathname.match(/(?:^|\/)booking\/([^/?#&]+)/i);
    if (
      pathMatch &&
      pathMatch[1] &&
      pathMatch[1] !== "undefined" &&
      pathMatch[1] !== "null" &&
      pathMatch[1] !== "SEARCH"
    ) {
      return pathMatch[1].trim();
    }
  } catch (_) {}

  // 2. Regex quét trực tiếp tham số dạng query hoặc hash nằm trong chuỗi
  const paramRegex =
    /(?:[?&]|^)(?:bookingId|booking_id|id|ticket|progress|track|lookup|bookingCode|code|booking|b)=([^/?#&]+)/i;
  const pMatch = str.match(paramRegex);
  if (pMatch && pMatch[1]) return pMatch[1].trim();

  // 3. Regex quét đường dẫn /booking/... trong chuỗi
  const pathRegex = /(?:^|\/|#)booking\/([^/?#&]+)/i;
  const pathMatch = str.match(pathRegex);
  if (
    pathMatch &&
    pathMatch[1] &&
    pathMatch[1] !== "undefined" &&
    pathMatch[1] !== "null" &&
    pathMatch[1] !== "SEARCH"
  ) {
    return pathMatch[1].trim();
  }

  // 4. Loại bỏ các tiền tố thường gặp nếu nhập thủ công
  let clean = str
    .replace(/^[#/?]+/, "")
    .replace(/^(?:booking|ticket|progress|track|lookup)\//i, "")
    .trim();

  const kvMatch = clean.match(
    /^(?:bookingId|booking_id|id|ticket|progress|track|lookup|bookingCode|code|booking)=([^/?#&]+)$/i
  );
  if (kvMatch && kvMatch[1]) return kvMatch[1].trim();

  return clean.replace(/\/+$/, "").trim();
}


/**
 * Sinh mã booking ngẫu nhiên theo chuẩn Bergh.Ryker
 * Định dạng: BR-YYYY-XXXX (ví dụ: BR-2026-0158 hoặc BR-2026-K7M9)
 */
export function generateBookingCode(): string {
  const year = new Date().getFullYear();
  // Ký tự dễ đọc, tránh nhầm lẫn (bỏ 0, O, 1, I)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    randomPart += chars[idx];
  }
  return `BR-${year}-${randomPart}`;
}

/**
 * Ẩn bớt số điện thoại theo quy chuẩn bảo mật: 09xx xxx x68
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return "(Chưa cung cấp)";
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 8) return "******";
  const start = clean.slice(0, 2);
  const end = clean.slice(-2);
  return `${start}xx xxx x${end}`;
}

/**
 * Tạo data URL mã QR kích thước cao (tối thiểu 1000x1000px)
 */
export async function generateQrDataUrl(
  text: string,
  width = 1200
): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: Math.max(width, 1000),
    margin: 3, // Khoảng trắng an toàn xung quanh đủ lớn để quét dễ dàng
    errorCorrectionLevel: "H", // High redundancy
    color: {
      dark: "#09090b",
      light: "#ffffff",
    },
  });
}

/**
 * Tải mã QR dạng file PNG về máy với chất lượng cao
 */
export function downloadQrCodePng(
  dataUrl: string,
  fileName = "bergh-ryker-booking-qr.png"
): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Tạo nội dung tin nhắn xác nhận chuẩn để copy gửi qua Messenger
 */
export function generateMessengerConfirmationMessage(
  booking: {
    schoolName?: string;
    bookingCode?: string;
    id?: string;
    conceptType?: string;
    date?: string;
    timeSlot?: string;
    address?: string;
    classSize?: number;
    notes?: string;
    customRequest?: string;
  },
  confirmationLink: string
): string {
  const clientName = booking.schoolName || "bạn";
  const code = booking.bookingCode || booking.id || "BR-STUDIO";
  const concept = booking.conceptType || "Chụp ảnh nghệ thuật";
  const time = [booking.date, booking.timeSlot].filter(Boolean).join(" - ");
  const location = booking.address || "Hà Nội (Thỏa thuận với Studio)";
  const size = booking.classSize ? `${booking.classSize} người` : "1 người";
  const noteContent = booking.customRequest || booking.notes || "Không có";

  return `Chào ${clientName}, Bergh Ryker xác nhận đặt lịch chụp thành công ✨

Mã booking: ${code}
Dịch vụ: ${concept}
Thời gian: ${time}
Địa điểm: ${location}
Số lượng: ${size}
Ghi chú: ${noteContent}

Xem chi tiết và lưu lịch tại:
${confirmationLink}

Nếu cần dời lịch, vui lòng nhắn trước ít nhất 24 giờ nhé!
Hotline/Zalo: 0365266204`;
}

/**
 * Tạo URL thêm sự kiện vào Google Calendar
 */
export function createGoogleCalendarUrl(booking: {
  schoolName?: string;
  conceptType?: string;
  date?: string;
  timeSlot?: string;
  address?: string;
  bookingCode?: string;
  id?: string;
  notes?: string;
}): string {
  const title = encodeURIComponent(
    `📸 Chụp ảnh ${booking.conceptType || "Kỷ yếu"} - Bergh.Ryker Studio (${booking.schoolName || "Khách hàng"})`
  );
  const location = encodeURIComponent(booking.address || "Hà Nội");
  const details = encodeURIComponent(
    `Lịch chụp ảnh cùng Bergh.Ryker Studio.\nMã booking: ${booking.bookingCode || booking.id}${booking.timeSlot ? `\nKhung giờ: ${booking.timeSlot}` : ""}${booking.notes ? `\nGhi chú: ${booking.notes}` : ""}\nHotline/Zalo hỗ trợ: 0365266204`
  );

  let dateParam = "";
  if (booking.date) {
    const raw = booking.date.trim();
    let y = 0,
      m = 0,
      d = 0;
    if (raw.includes("-")) {
      const parts = raw.split("-");
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    } else if (raw.includes("/")) {
      const parts = raw.split("/");
      d = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      y = parseInt(parts[2], 10);
    }

    if (y && m && d) {
      const startIso = `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}T080000Z`;
      const endIso = `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}T180000Z`;
      dateParam = `&dates=${startIso}/${endIso}`;
    }
  }

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}${dateParam}`;
}

/**
 * Tạo link mở bản đồ Google Maps
 */
export function createGoogleMapsUrl(address?: string): string {
  if (!address || !address.trim()) return "https://www.google.com/maps";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address.trim()
  )}`;
}
