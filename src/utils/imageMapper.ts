const img_1779872344025 = "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&q=80&w=800";
const img_1779872555701 = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=800";
import img_1779875876336 from "../assets/images/regenerated_image_1779875876336.png";
import img_1779875971462 from "../assets/images/regenerated_image_1779875971462.png";
const img_1779971738820 = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1000";
const img_1779882868759 = "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200";
const img_1779941564497 = "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=1000";
const img_1779883822320 = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=1000";
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

export function resolveImage(path: string | undefined): string | undefined {
  if (!path) return undefined;

  // 1. Unwrap if mistakenly wrapped by weserv.nl or proxy
  if (path.includes("images.weserv.nl")) {
    const driveMatch =
      path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      path.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      path.match(/%2Fd%2F([a-zA-Z0-9_-]+)/) ||
      path.match(/%3Fid%3D([a-zA-Z0-9_-]+)/) ||
      path.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
  }

  // 2. Support converting Google Drive URLs directly to Google's high-speed edge CDN
  if (path.includes("drive.google.com")) {
    const driveIdMatch =
      path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      path.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveIdMatch && driveIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${driveIdMatch[1]}`;
    }
  }

  // 3. Google Usercontent CDN: ensure clean ID without invalid trailing params
  if (path.includes("googleusercontent.com/d/")) {
    const lh3Match = path.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    if (lh3Match && lh3Match[1]) {
      return `https://lh3.googleusercontent.com/d/${lh3Match[1]}`;
    }
  }

  // 4. Extract filename if paths are formatted like /src/assets/images/xxx...
  if (
    path.startsWith("/src/assets/images/") ||
    path.startsWith("src/assets/images/") ||
    path.startsWith("../assets/images/")
  ) {
    const filename = path.substring(path.lastIndexOf("/") + 1);
    return imageMap[filename] || path;
  }

  if (imageMap[path]) {
    return imageMap[path];
  }

  return path;
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
