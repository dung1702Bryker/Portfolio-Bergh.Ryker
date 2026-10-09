/**
 * High-performance client-side WebP image processing engine.
 * Automatically converts image files, data URLs, and remote images
 * into high-fidelity, lightweight WebP format to accelerate page load speeds.
 */

export interface WebPOptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0 (default 0.88 for gallery portfolio)
}

/**
 * Checks whether an image source is already WebP formatted.
 */
export function isWebP(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("data:image/webp")) return true;
  if (src.endsWith(".webp") || src.includes(".webp?")) return true;
  if (src.includes("fm=webp") || src.includes("output=webp") || src.includes("-rw") || src.includes("f_webp")) {
    return true;
  }
  return false;
}

import { resolveImage } from "./imageMapper";

/**
 * Ensures any remote image URL delivers high-speed WebP format.
 */
export function ensureWebPUrl(url: string, quality = 85): string {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  // Unsplash or Imgix - Native high-speed WebP
  if (url.includes("images.unsplash.com") || url.includes("imgix.net")) {
    try {
      const u = new URL(url);
      u.searchParams.set("fm", "webp");
      u.searchParams.set("q", quality.toString());
      u.searchParams.delete("auto");
      return u.toString();
    } catch {
      return url;
    }
  }

  // Google Drive CDN: resolve to Google's edge CDN URL directly without breaking it
  if (url.includes("drive.google.com") || url.includes("googleusercontent.com")) {
    return resolveImage(url) || url;
  }

  // Cloudinary
  if (url.includes("res.cloudinary.com")) {
    if (url.includes("/upload/")) {
      return url.replace("/upload/", "/upload/f_webp,q_auto:good/");
    }
  }

  return resolveImage(url) || url;
}

/**
 * Automatically converts any File, Blob, or base64 data URL to high-quality WebP.
 */
export async function convertToWebP(
  source: File | Blob | string,
  options: WebPOptimizeOptions = {}
): Promise<string> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.88,
  } = options;

  // If already WebP data URL or string, return as is unless resizing is desired
  if (typeof source === "string" && source.startsWith("data:image/webp;base64,") && source.length < 500000) {
    return source;
  }

  // If remote URL, ensure WebP URL transformation
  if (typeof source === "string" && (source.startsWith("http://") || source.startsWith("https://"))) {
    return ensureWebPUrl(source, Math.round(quality * 100));
  }

  // Convert File / Blob to Data URL first if needed
  let dataUrl = "";
  if (typeof source === "string") {
    dataUrl = source;
  } else {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(source);
    });
  }

  // Process via HTML5 Canvas
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!dataUrl.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = width / height;
          if (width > height) {
            width = Math.min(width, maxWidth);
            height = Math.round(width / ratio);
          } else {
            height = Math.min(height, maxHeight);
            width = Math.round(height * ratio);
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(img, 0, 0, width, height);

        const webpData = canvas.toDataURL("image/webp", quality);

        if (webpData.startsWith("data:image/webp")) {
          resolve(webpData);
        } else {
          resolve(dataUrl);
        }
      } catch (err) {
        if (typeof source === "string") {
          resolve(ensureWebPUrl(source));
        } else {
          resolve(dataUrl);
        }
      }
    };

    img.onerror = () => {
      if (typeof source === "string") {
        resolve(source);
      } else {
        resolve(dataUrl);
      }
    };

    img.src = dataUrl;
  });
}

/**
 * Backwards-compatible alias for existing code
 */
export const compressImage = (
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.88
): Promise<string> => {
  return convertToWebP(file, { maxWidth, maxHeight, quality });
};

export interface CompressedResolutions {
  thumbnail: string;
  medium: string;
  original: string;
}

export const compressImageResolutions = async (
  file: File
): Promise<CompressedResolutions> => {
  const [thumbnail, medium, original] = await Promise.all([
    convertToWebP(file, { maxWidth: 480, maxHeight: 480, quality: 0.78 }),
    convertToWebP(file, { maxWidth: 960, maxHeight: 960, quality: 0.84 }),
    convertToWebP(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.88 }),
  ]);
  return { thumbnail, medium, original };
};

/**
 * Batch convert an array of image files or URLs to WebP.
 */
export async function batchConvertToWebP(
  items: (File | string)[],
  options: WebPOptimizeOptions = {},
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];
  const total = items.length;

  for (let i = 0; i < total; i++) {
    try {
      const converted = await convertToWebP(items[i], options);
      results.push(converted);
    } catch {
      results.push(typeof items[i] === "string" ? (items[i] as string) : "");
    }
    if (onProgress) {
      onProgress(i + 1, total);
    }
  }

  return results;
}

