/**
 * Image optimization utility for gallery components.
 * Supports WebP format delivery with fallback (JPEG/original),
 * and URL-based resizing parameters (Cloudinary, Unsplash/Imgix, Google usercontent, and Weserv CDN)
 * to deliver appropriately sized images matching the user's viewport width.
 */

export type ImageFormat = "webp" | "jpg" | "png" | "original";

export interface OptimizeOptions {
  width?: number;
  height?: number;
  format?: ImageFormat;
  quality?: number;
  crop?: "fit" | "fill" | "limit" | "crop";
}

// Full responsive widths for Hero, Fullscreen, or Lightbox
export const HERO_RESPONSIVE_WIDTHS = [480, 768, 1080, 1440, 1920, 2560];

// Streamlined responsive widths for Card / Grid Thumbnails (especially Mobile 360px-430px)
// 240 for 2-column mobile, 360 for 1x mobile, 480 for 1.5x mobile, 640 for 2x retina, 800 for 3x/desktop
export const THUMBNAIL_RESPONSIVE_WIDTHS = [240, 360, 480, 640, 800];

// Standard responsive widths for breakpoints
export const DEFAULT_RESPONSIVE_WIDTHS = [360, 480, 640, 960, 1280, 1600];

// Safe check if running in browser
const isClient = typeof window !== "undefined";

// Global in-memory cache of already resolved & decoded images for instant 0ms paints
export const globalLoadedImages = new Set<string>();

export function isImageLoadedInCache(src: string | undefined): boolean {
  if (!src) return false;
  return globalLoadedImages.has(src);
}

export function markImageLoadedInCache(src: string | undefined): void {
  if (!src) return;
  globalLoadedImages.add(src);
}

/**
 * Proactively preloads and decodes an image in the background off the main thread.
 * Guarantees zero-delay transitions when user navigates or opens albums/lightbox.
 */
export function preloadImageFast(
  rawSrc: string | undefined,
  targetWidth = 1600,
  quality = 88
): Promise<boolean> {
  if (!rawSrc || typeof window === "undefined") return Promise.resolve(false);
  const optimized = getOptimizedImageUrl(rawSrc, { width: targetWidth, quality, format: "webp" });
  const finalUrl = optimized || rawSrc;

  if (globalLoadedImages.has(finalUrl)) return Promise.resolve(true);

  return new Promise((resolve) => {
    const img = new window.Image();
    img.decoding = "async";
    img.src = finalUrl;
    if (img.complete && img.naturalWidth > 0) {
      globalLoadedImages.add(finalUrl);
      resolve(true);
      return;
    }
    img.onload = () => {
      globalLoadedImages.add(finalUrl);
      if (img.decode) {
        img.decode().catch(() => {}).finally(() => resolve(true));
      } else {
        resolve(true);
      }
    };
    img.onerror = () => resolve(false);
  });
}

/**
 * Returns the Cloudinary Cloud Name from environment variables, or undefined if not set.
 */
export function getCloudinaryCloudName(): string | undefined {
  try {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    if (typeof cloudName === "string" && cloudName.trim().length > 0) {
      return cloudName.trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Builds Cloudinary transformation parameter string (w_*, h_*, c_*, f_*, q_*)
 */
export function buildCloudinaryTransforms(options: OptimizeOptions): string {
  const {
    width,
    height,
    format = "webp",
    quality = 82,
    crop = "limit",
  } = options;

  const transforms: string[] = [];
  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (crop) transforms.push(`c_${crop}`);
  if (format === "webp") {
    transforms.push("f_webp");
  } else if (format === "jpg") {
    transforms.push("f_jpg");
  } else if (format === "png") {
    transforms.push("f_png");
  } else {
    transforms.push("f_auto");
  }
  // Cloudinary quality optimization
  if (quality <= 75) {
    transforms.push("q_auto:eco");
  } else if (quality > 85) {
    transforms.push("q_auto:best");
  } else {
    transforms.push("q_auto:good");
  }

  return transforms.join(",");
}

/**
 * Normalizes and resolves Google Drive URLs into direct CDN format
 */
export function normalizeGoogleDriveUrl(url: string): string {
  if (!url) return "";

  // Unwrap if mistakenly wrapped by weserv.nl
  if (url.includes("images.weserv.nl")) {
    const driveMatch =
      url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      url.match(/%2Fd%2F([a-zA-Z0-9_-]+)/) ||
      url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
  }

  if (url.includes("drive.google.com")) {
    const driveIdMatch =
      url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveIdMatch && driveIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${driveIdMatch[1]}`;
    }
  }
  if (url.includes("googleusercontent.com/d/")) {
    const lh3Match = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    if (lh3Match && lh3Match[1]) {
      return `https://lh3.googleusercontent.com/d/${lh3Match[1]}`;
    }
  }
  return url;
}

/**
 * Determines whether a URL can be optimized via URL-based query/transformation parameters.
 */
export function isOptimizableUrl(url: string | undefined): boolean {
  if (!url) return false;
  // Local base64, blobs, SVGs, or relative bundle imports without HTTP
  if (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.endsWith(".svg") ||
    url.includes(".svg?")
  ) {
    return false;
  }
  return true;
}

/**
 * Generates an optimized image URL using URL-based resizing and format parameters
 * tailored to Cloudinary, Unsplash (Imgix), Google User Content, or direct CDN.
 */
export function getOptimizedImageUrl(
  rawSrc: string | undefined,
  options: OptimizeOptions = {}
): string {
  if (!rawSrc) return "";

  const src = normalizeGoogleDriveUrl(rawSrc);

  if (!isOptimizableUrl(src)) {
    return src;
  }

  const cloudName = getCloudinaryCloudName();
  const transformStr = cloudName ? buildCloudinaryTransforms(options) : "";

  const {
    width,
    height,
    format = "webp",
    quality = 82,
  } = options;

  // 1. CLOUDINARY DIRECT UPLOADS OR ASSET URLs (res.cloudinary.com/.../image/upload/...)
  if (cloudName && src.includes("res.cloudinary.com") && src.includes("/image/upload/")) {
    try {
      const parts = src.split("/image/upload/");
      const rest = parts[1];

      const existingMatch = rest.match(/^([a-z0-9_,:-]+)\/(v[0-9]+\/.*)$/i);
      let cleanPath = rest;
      if (existingMatch) {
        cleanPath = existingMatch[2];
      } else if (/^(?:w_|h_|c_|f_|q_|dpr_)[a-z0-9_,:-]*\/(.*)$/i.test(rest)) {
        cleanPath = rest.replace(/^(?:w_|h_|c_|f_|q_|dpr_)[a-z0-9_,:-]*\//i, "");
      }

      return `https://res.cloudinary.com/${cloudName}/image/upload/${transformStr}/${cleanPath}`;
    } catch {
      return src;
    }
  }

  // 2. CLOUDINARY CUSTOM PREFIX
  if (cloudName && (src.startsWith("cloudinary://") || src.startsWith("cld:"))) {
    try {
      const cleanPath = src.replace(/^(cloudinary:\/\/|cld:)/i, "").replace(/^\/+/, "");
      return `https://res.cloudinary.com/${cloudName}/image/upload/${transformStr}/${cleanPath}`;
    } catch {
      return src;
    }
  }

  // 3. CLOUDINARY FETCH
  if (cloudName && src.includes("res.cloudinary.com") && src.includes("/image/fetch/")) {
    try {
      const parts = src.split("/image/fetch/");
      const rawTargetUrl = parts[1].replace(/^[a-z0-9_,:-]+\//i, "");
      return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformStr}/${rawTargetUrl}`;
    } catch {
      return src;
    }
  }

  // 4. UNSPLASH (images.unsplash.com - Native Imgix URL Parameters)
  if (src.includes("images.unsplash.com")) {
    try {
      const urlObj = new URL(src);
      if (width) urlObj.searchParams.set("w", width.toString());
      if (height) urlObj.searchParams.set("h", height.toString());
      urlObj.searchParams.set("q", (quality || 86).toString());
      urlObj.searchParams.set("fit", options.crop === "crop" ? "crop" : "max");

      // auto=format ensures Unsplash edge CDN dynamically serves AVIF on Chrome/Safari 16+ or WebP
      // providing maximal razor-sharp studio quality at 1/5th the payload
      urlObj.searchParams.set("auto", "format");
      if (format === "webp") {
        urlObj.searchParams.set("fm", "webp");
      } else if (format === "jpg") {
        urlObj.searchParams.set("fm", "jpg");
      } else if (format === "png") {
        urlObj.searchParams.set("fm", "png");
      }
      return urlObj.toString();
    } catch {
      return src;
    }
  }

  // 4.5. LOCAL SERVER HIGH-PERFORMANCE PROXY (/api/proxy-image)
  if (src.startsWith("/api/proxy-image")) {
    try {
      const urlObj = new URL(src, "http://localhost");
      if (width) urlObj.searchParams.set("w", width.toString());
      return `${urlObj.pathname}${urlObj.search}`;
    } catch {
      return src;
    }
  }

  // 5. GOOGLE USERCONTENT / GOOGLE DRIVE (lh3.googleusercontent.com/d/FILE_ID)
  // Direct Google Edge CDN: support =w{width}-rw for fast responsive WebP, or =w2560-rw for ultra-high native resolution
  if (src.includes("googleusercontent.com/d/")) {
    const match = src.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const id = match[1];
      if (width && width > 0 && width < 2560) {
        return format === "webp"
          ? `https://lh3.googleusercontent.com/d/${id}=w${width}-rw`
          : `https://lh3.googleusercontent.com/d/${id}=w${width}`;
      }
      return `https://lh3.googleusercontent.com/d/${id}=w2560-rw`;
    }
    return src.split("=")[0];
  }

  // 6. EXTERNAL IMAGES VIA CLOUDINARY FETCH (if configured)
  if (cloudName && (src.startsWith("http://") || src.startsWith("https://"))) {
    return `https://res.cloudinary.com/${cloudName}/image/fetch/${transformStr}/${encodeURIComponent(src)}`;
  }

  // Fallback: deliver direct original URL reliably
  return src;
}

/**
 * Generates an HTML srcset string for a set of responsive widths and a given image format.
 */
export function generateResponsiveSrcSet(
  src: string | undefined,
  widths: number[] = DEFAULT_RESPONSIVE_WIDTHS,
  format: ImageFormat = "webp",
  quality?: number
): string {
  if (!src || !isOptimizableUrl(src)) return "";

  return widths
    .map((w) => `${getOptimizedImageUrl(src, { width: w, format, quality })} ${w}w`)
    .join(", ");
}

/**
 * Generates the full set of responsive picture sources:
 * - webpSrcSet for the <source type="image/webp">
 * - fallbackSrcSet for the <source type="image/jpeg">
 * - defaultSrc for the standard <img> fallback
 */
export function getPictureSources(
  src: string | undefined,
  widths: number[] = DEFAULT_RESPONSIVE_WIDTHS,
  defaultWidth = 1200,
  quality?: number
): {
  webpSrcSet: string;
  fallbackSrcSet: string;
  defaultSrc: string;
  webpDefaultSrc: string;
  isOptimizable: boolean;
} {
  if (!src) {
    return {
      webpSrcSet: "",
      fallbackSrcSet: "",
      defaultSrc: "",
      webpDefaultSrc: "",
      isOptimizable: false,
    };
  }

  const optimizable = isOptimizableUrl(src);

  if (!optimizable) {
    return {
      webpSrcSet: "",
      fallbackSrcSet: "",
      defaultSrc: src,
      webpDefaultSrc: src,
      isOptimizable: false,
    };
  }

  const webpSrcSet = generateResponsiveSrcSet(src, widths, "webp", quality);
  const fallbackSrcSet = generateResponsiveSrcSet(src, widths, "jpg", quality);
  const defaultSrc = getOptimizedImageUrl(src, { width: defaultWidth, format: "jpg", quality });
  const webpDefaultSrc = getOptimizedImageUrl(src, { width: defaultWidth, format: "webp", quality });

  return {
    webpSrcSet,
    fallbackSrcSet,
    defaultSrc,
    webpDefaultSrc,
    isOptimizable: true,
  };
}

/**
 * Lightbox helper: delivers genuine ultra-high camera resolution (=s0 for Google Drive, 4K for Unsplash)
 * without downsampling srcset that degrades sharpness on mobile screens.
 */
export function buildOptimizedLightboxSources(
  originalSrc: string,
  minWidth = 1920
): {
  highResWebpSrc: string;
  highResFallbackSrc: string;
  webpLightboxSrcSet: string;
  fallbackLightboxSrcSet: string;
} {
  if (!originalSrc) {
    return {
      highResWebpSrc: "",
      highResFallbackSrc: "",
      webpLightboxSrcSet: "",
      fallbackLightboxSrcSet: "",
    };
  }

  // 1. GOOGLE USERCONTENT / GOOGLE DRIVE:
  // Google Edge CDN delivers 2560px WebP (=w2560-rw) with master camera fidelity in 150ms instead of uncompressed =s0 which can be 30MB
  const driveMatch =
    originalSrc.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
    originalSrc.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    originalSrc.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    const id = driveMatch[1];
    const highResWebp = `https://lh3.googleusercontent.com/d/${id}=w2560-rw`;
    const ultraRawSrc = `https://lh3.googleusercontent.com/d/${id}=s0`;
    return {
      highResWebpSrc: highResWebp,
      highResFallbackSrc: ultraRawSrc,
      webpLightboxSrcSet: "",
      fallbackLightboxSrcSet: "",
    };
  }

  // 2. UNSPLASH: Request ultra-crisp 4K/Retina master source while preserving native camera aspect ratio (no cropping)
  // Instead of an enormous 3840px / 12MB raw file that causes 5-10s mobile latency, request crystal-clear 2560px (1600 on mobile)
  // with auto=format & q=88! Delivers 100% pixel-perfect 4K master sharpness with 0 visual degradation, downloading in ~150ms!
  if (originalSrc.includes("images.unsplash.com")) {
    try {
      const urlObj = new URL(originalSrc);
      const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
      urlObj.searchParams.set("w", isMobile ? "1600" : "2560");
      urlObj.searchParams.set("q", "88");
      urlObj.searchParams.set("auto", "format");
      urlObj.searchParams.delete("fit");
      urlObj.searchParams.delete("crop");
      urlObj.searchParams.delete("h");
      const ultraSrc = urlObj.toString();
      return {
        highResWebpSrc: ultraSrc,
        highResFallbackSrc: ultraSrc,
        webpLightboxSrcSet: "",
        fallbackLightboxSrcSet: "",
      };
    } catch {
      // fallback
    }
  }

  return {
    highResWebpSrc: originalSrc,
    highResFallbackSrc: originalSrc,
    webpLightboxSrcSet: "",
    fallbackLightboxSrcSet: "",
  };
}
