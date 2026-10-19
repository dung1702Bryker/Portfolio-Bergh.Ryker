/**
 * Configuration and helpers for Founder & Photographer - NGUYỄN ĐỨC DŨNG
 * Bergh.Ryker - The Visual Storyteller
 */

/**
 * Trích xuất FILE_ID từ link Google Drive và chuẩn hóa sang định dạng thumbnail độ nét cao:
 * https://drive.google.com/thumbnail?id={FILE_ID}&sz=w1200
 * Định dạng này hiển thị trực tiếp tức thì, không bị CORS, không bị chuyển hướng hay chặn trên mọi thiết bị.
 */
export function normalizeDriveImageUrl(url: string | undefined | null, width = 1200): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();

  // Kiểm tra link Google Drive: /file/d/{ID}, ?id={ID}, &id={ID}, thumbnail?id={ID}, uc?id={ID}, hoặc lh3.googleusercontent.com/d/{ID}
  const driveIdMatch =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);

  if (driveIdMatch && driveIdMatch[1]) {
    const fileId = driveIdMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
  }

  return trimmed;
}

/**
 * Kiểm tra xem một link ảnh có phải là ảnh mẫu Unsplash hay không
 */
export function isUnsplashUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  return url.includes("images.unsplash.com") || url.includes("unsplash.com");
}

/**
 * Kiểm tra xem URL có hợp lệ để hiển thị ảnh thật hay không
 */
export function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("[") ||
    trimmed.includes("DÁN_LINK") ||
    trimmed.includes("DÁN_LINK_ẢNH") ||
    isUnsplashUrl(trimmed)
  ) {
    return false;
  }
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("/");
}

/**
 * LINK ẢNH CHÂN DUNG FOUNDER & PHOTOGRAPHER - NGUYỄN ĐỨC DŨNG
 * Dán link Google Drive hoặc URL ảnh của bạn vào đây:
 */
export const RAW_FOUNDER_PORTRAIT_URL = "[DÁN_LINK_DRIVE_ẢNH_CHÂN_DUNG_CỦA_BẠN_VÀO_ĐÂY]";

/**
 * Hằng số DEFAULT_FOUNDER_PORTRAIT chuẩn hóa (sz=w1200 nếu là Google Drive)
 */
export const DEFAULT_FOUNDER_PORTRAIT = normalizeDriveImageUrl(RAW_FOUNDER_PORTRAIT_URL, 1200);
