const img_1779872344025 = "";
const img_1779872555701 = "";
import img_1779875876336 from "../assets/images/regenerated_image_1779875876336.png";
import img_1779875971462 from "../assets/images/regenerated_image_1779875971462.png";
const img_1779971738820 = "";
const img_1779882868759 = "";
const img_1779941564497 = "";
const img_1779883822320 = "";
import img_1779884047451 from "../assets/images/regenerated_image_1779884047451.jpg";
import img_1779884713797 from "../assets/images/regenerated_image_1779884713797.jpg";
import img_1779928721895 from "../assets/images/regenerated_image_1779928721895.png";
import img_1779933195915 from "../assets/images/regenerated_image_1779933195915.webp";

const imageMap: Record<string, string> = {
  "regenerated_image_1779872344025.jpg": img_1779872344025,
  "regenerated_image_1779872555701.jpg": img_1779872555701,
  "regenerated_image_1779875876336.png": img_1779875876336,
  "regenerated_image_1779875971462.png": img_1779875971462,
  "regenerated_image_1779971738820.jpg": img_1779971738820,
  "regenerated_image_1779882868759.jpg": img_1779882868759,
  "regenerated_image_1779941564497.jpg": img_1779941564497,
  "regenerated_image_1779883822320.jpg": img_1779883822320,
  "regenerated_image_1779884047451.jpg": img_1779884047451,
  "regenerated_image_1779884713797.jpg": img_1779884713797,
  "regenerated_image_1779928721895.png": img_1779928721895,
  "regenerated_image_1779933195915.webp": img_1779933195915,
};

/**
 * Tối ưu URL Google Drive cho mạng 4G:
 * - sz=w600 cho ảnh thu nhỏ / thẻ album (thumbnail / card)
 * - sz=w1200 cho ảnh xem chi tiết / phóng to
 */
export function optimizeDriveImageUrl(
  url: string | undefined | null,
  size: number | "thumb" | "card" | "detail" = "card"
): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  
  // Tuyệt đối không chấp nhận placeholder hoặc text chưa thay thế
  if (trimmed.startsWith("[") || trimmed.includes("DÁN_LINK")) return "";

  const targetWidth = typeof size === "number" ? size : (size === "detail" ? 1200 : 600);

  if (trimmed.includes("drive.google.com") || trimmed.includes("googleusercontent.com")) {
    const driveIdMatch =
      trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    if (driveIdMatch && driveIdMatch[1]) {
      return `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w${targetWidth}`;
    }
  }

  return trimmed;
}

export function resolveImage(
  path: string | undefined | null,
  size: number | "thumb" | "card" | "detail" = 1200
): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (trimmed.startsWith("[") || trimmed.includes("DÁN_LINK")) return undefined;

  // Support converting Google Drive URLs directly to Google's direct thumbnail format
  if (trimmed.includes("drive.google.com") || trimmed.includes("googleusercontent.com")) {
    const opt = optimizeDriveImageUrl(trimmed, size);
    if (opt) return opt;
  }

  // Extract filename if paths are formatted like /src/assets/images/xxx...
  if (
    trimmed.startsWith("/src/assets/images/") ||
    trimmed.startsWith("src/assets/images/") ||
    trimmed.startsWith("../assets/images/")
  ) {
    const filename = trimmed.substring(trimmed.lastIndexOf("/") + 1);
    return imageMap[filename] || trimmed;
  }
  return trimmed;
}


import { buildOptimizedLightboxSources, getOptimizedImageUrl } from "./imageOptimizer";
export type { ImageResolutions } from "../types";

export const LIGHTBOX_MIN_WIDTH = 1200;

export function createResolutionsFromUrl(rawUrl: string | undefined) {
  if (!rawUrl) {
    return { thumbnail: "", medium: "", original: "" };
  }
  const resolved = resolveImage(rawUrl) || rawUrl;
  return {
    thumbnail: getOptimizedImageUrl(resolved, { width: 480, quality: 75, format: "webp" }),
    medium: getOptimizedImageUrl(resolved, { width: 1080, quality: 80, format: "webp" }),
    original: resolved,
  };
}

export function buildLightboxSources(originalSrc: string, minWidth = LIGHTBOX_MIN_WIDTH) {
  if (!originalSrc) {
    return {
      highResSrc: "",
      highResFallbackSrc: "",
      lightboxSrcSet: undefined,
      fallbackSrcSet: undefined,
    };
  }

  const sources = buildOptimizedLightboxSources(originalSrc, minWidth);
  return {
    highResSrc: sources.highResWebpSrc,
    highResFallbackSrc: sources.highResFallbackSrc,
    lightboxSrcSet: sources.webpLightboxSrcSet,
    fallbackSrcSet: sources.fallbackLightboxSrcSet,
  };
}
