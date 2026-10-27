import React, { useState, useEffect, useRef } from "react";
import { ProofingPhoto } from "../types/proofing";

// ============================================================================
// 1. KIẾN TRÚC PHÂN GIẢI THÍCH ỨNG 3 TẦNG (3-TIER ADAPTIVE RESOLUTION ENGINE)
// ============================================================================

/**
 * Tầng 1 – Ảnh trên Lưới (Grid Card Thumbnail):
 * Chuẩn Retina w800 (~60KB–90KB), tải siêu nhanh, không nghẽn mạng
 */
export function getGridImageUrl(fileId: string, fallbackUrl?: string): string {
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }
  return fallbackUrl || "";
}

/**
 * Tầng 2 – Ảnh xem lớn trong Lightbox ở mức 1x:
 * Full HD+ w1600 (~200KB, sắc nét tuyệt đối trên mọi màn hình, tải < 0.1s)
 */
export function getLightboxFastHdUrl(fileId: string, fallbackUrl?: string): string {
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
  }
  return fallbackUrl || "";
}

/**
 * Tầng 3 – Ảnh Gốc Ultra HD 4K / Original khi khách Zoom 2x / 3x:
 * Trực tiếp luồng =s0 uncompressed của Google Drive
 */
export function getLightboxOriginalUrl(fileId: string, fallbackUrl?: string): string {
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=s0`;
  }
  return fallbackUrl || "";
}

// ============================================================================
// 3. BỘ TẢI TRƯỚC "CỬA SỔ TRƯỢT 8 ẢNH" TRONG RAM (SLIDING-WINDOW MEMORY PRELOADER)
// ============================================================================
export const preloadedImagesCache = new Map<string, HTMLImageElement>();

/**
 * Nạp trước 6 tấm kế tiếp [+1, +2, +3, +4, +5, +6] và 2 tấm phía trước [-1, -2]
 * theo thứ tự ưu tiên tấm gần nhất trước
 */
export function preloadLightboxImages(photos: ProofingPhoto[], currentIndex: number) {
  if (!photos || photos.length === 0 || currentIndex < 0) return;

  const priorityOffsets = [1, 2, -1, 3, 4, 5, 6, -2];

  priorityOffsets.forEach((offset) => {
    const targetIdx = currentIndex + offset;
    if (targetIdx >= 0 && targetIdx < photos.length) {
      const targetPhoto = photos[targetIdx];
      const fid = targetPhoto.driveFileId || targetPhoto.id;
      if (!fid) return;

      // 1. Preload Sharp HD Layer (w1600)
      const hdUrl = getLightboxFastHdUrl(fid, targetPhoto.hdUrl || targetPhoto.url);
      if (hdUrl && !preloadedImagesCache.has(hdUrl)) {
        const img = new Image();
        img.decoding = "async";
        img.src = hdUrl;
        preloadedImagesCache.set(hdUrl, img);
      }

      // 2. Preload Base Layer (w800)
      const baseUrl = getGridImageUrl(fid, targetPhoto.thumbnailUrl || targetPhoto.url);
      if (baseUrl && !preloadedImagesCache.has(baseUrl)) {
        const img = new Image();
        img.decoding = "async";
        img.src = baseUrl;
        preloadedImagesCache.set(baseUrl, img);
      }
    }
  });

  // Giới hạn bộ nhớ cache RAM tối đa 80 phần tử để tránh tràn RAM trên thiết bị di động
  if (preloadedImagesCache.size > 80) {
    const keys = Array.from(preloadedImagesCache.keys());
    for (let i = 0; i < 20; i++) {
      preloadedImagesCache.delete(keys[i]);
    }
  }
}

// ============================================================================
// PROOFING IMAGE COMPONENT
// ============================================================================
interface ProofingImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  photo: ProofingPhoto;
  viewMode?: "grid" | "lightbox";
  zoomLevel?: number;
  className?: string;
  alt?: string;
  onImageLoad?: () => void;
}

export const ProofingImage: React.FC<ProofingImageProps> = ({
  photo,
  viewMode = "grid",
  zoomLevel = 1,
  className = "",
  alt,
  onImageLoad,
  style,
  ...restProps
}) => {
  const fileId = photo.driveFileId || photo.id;

  // -------------------------------------------------------------
  // TRƯỜNG HỢP 1: LƯỚI ẢNH (GRID MODE)
  // -------------------------------------------------------------
  if (viewMode === "grid") {
    const gridCandidates = [
      getGridImageUrl(fileId, photo.thumbnailUrl || photo.url),
      fileId ? `https://lh3.googleusercontent.com/d/${fileId}=s800` : "",
      photo.thumbnailUrl || "",
      photo.url || "",
    ].filter(Boolean);

    const [candidateIdx, setCandidateIdx] = useState(0);
    const [hasError, setHasError] = useState(false);

    const handleGridError = () => {
      if (candidateIdx < gridCandidates.length - 1) {
        setCandidateIdx((prev) => prev + 1);
      } else {
        setHasError(true);
      }
    };

    if (hasError) {
      return (
        <div className={`flex flex-col items-center justify-center bg-zinc-900 text-zinc-400 p-2 text-center select-none ${className}`}>
          <span className="text-[10px] font-mono font-semibold text-zinc-400 truncate max-w-full">
            {photo.baseName || photo.fileName}
          </span>
          <span className="text-[9px] text-zinc-500">Lỗi tải ảnh</span>
        </div>
      );
    }

    return (
      <img
        src={gridCandidates[candidateIdx]}
        alt={alt || photo.fileName}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        referrerPolicy="no-referrer"
        onError={handleGridError}
        onLoad={onImageLoad}
        className={`${className} select-none transition-opacity duration-150`}
        style={style}
        {...restProps}
      />
    );
  }

  // -------------------------------------------------------------
  // TRƯỜNG HỢP 2: LIGHTBOX (INSTANT DUAL-LAYER STACK)
  // -------------------------------------------------------------
  return (
    <LightboxDualLayerImage
      photo={photo}
      fileId={fileId}
      zoomLevel={zoomLevel}
      className={className}
      alt={alt}
      onImageLoad={onImageLoad}
      style={style}
      {...restProps}
    />
  );
};

// ============================================================================
// LIGHTBOX INSTANT DUAL-LAYER STACK COMPONENT
// Lớp 1: Base Layer (w800) - Hiện tức thì 0.00s không độ trễ, không blur
// Lớp 2: Sharp HD Layer (w1600) - Đè lên sắc nét, khi zoom 2x/3x nâng lên =s0
// ============================================================================
interface LightboxDualLayerProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  photo: ProofingPhoto;
  fileId: string;
  zoomLevel: number;
  className?: string;
  alt?: string;
  onImageLoad?: () => void;
}

const LightboxDualLayerImage: React.FC<LightboxDualLayerProps> = ({
  photo,
  fileId,
  zoomLevel,
  className = "",
  alt,
  onImageLoad,
  style,
  ...restProps
}) => {
  // Lớp 1: Base URL (w800 - đã có trong browser cache từ ngoài lưới)
  const baseCandidates = [
    getGridImageUrl(fileId, photo.thumbnailUrl || photo.url),
    fileId ? `https://lh3.googleusercontent.com/d/${fileId}=s800` : "",
    photo.thumbnailUrl || "",
    photo.url || "",
  ].filter(Boolean);

  const [baseIdx, setBaseIdx] = useState(0);

  // Lớp 2: Sharp HD URL (w1600 - siêu nét Retina Full HD+)
  const hdCandidates = [
    getLightboxFastHdUrl(fileId, photo.hdUrl || photo.url),
    fileId ? `https://lh3.googleusercontent.com/d/${fileId}=s1600` : "",
    fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w2048` : "",
    photo.hdUrl || "",
    photo.url || "",
  ].filter(Boolean);

  const [hdIdx, setHdIdx] = useState(0);
  const [isHdLoaded, setIsHdLoaded] = useState(false);
  const [activeSharpSrc, setActiveSharpSrc] = useState(hdCandidates[0] || "");
  const [hasError, setHasError] = useState(false);

  // Reset khi đổi sang ảnh khác
  useEffect(() => {
    setBaseIdx(0);
    setHdIdx(0);
    setHasError(false);

    const initialHd = hdCandidates[0] || "";
    // Kiểm tra nếu ảnh w1600 đã nạp sẵn trong cache RAM thì hiển thị HD tức thì
    if (preloadedImagesCache.has(initialHd)) {
      setIsHdLoaded(true);
    } else {
      setIsHdLoaded(false);
    }
    setActiveSharpSrc(initialHd);
  }, [photo.id, fileId]);

  // Tầng 3: Khi khách zoom 2x hoặc 3x -> Tải ngầm ảnh gốc =s0 ở hậu trường
  useEffect(() => {
    if (zoomLevel > 1 && fileId) {
      const originalUrl = getLightboxOriginalUrl(fileId, photo.originalUrl || photo.url);
      if (originalUrl && activeSharpSrc !== originalUrl) {
        // Kiểm tra cache trước
        if (preloadedImagesCache.has(originalUrl)) {
          setActiveSharpSrc(originalUrl);
          setIsHdLoaded(true);
        } else {
          // Tải ngầm bằng new Image() không chặn giao diện
          const bgImg = new Image();
          bgImg.decoding = "async";
          bgImg.src = originalUrl;
          bgImg.onload = () => {
            preloadedImagesCache.set(originalUrl, bgImg);
            setActiveSharpSrc(originalUrl);
            setIsHdLoaded(true);
          };
        }
      }
    }
  }, [zoomLevel, fileId, photo.originalUrl, photo.url, activeSharpSrc]);

  const handleHdError = () => {
    if (hdIdx < hdCandidates.length - 1) {
      const nextIdx = hdIdx + 1;
      setHdIdx(nextIdx);
      setActiveSharpSrc(hdCandidates[nextIdx]);
    } else {
      // Nếu lớp HD lỗi, lớp base vẫn hiển thị rõ ràng
      setHasError(true);
    }
  };

  const handleHdLoad = () => {
    setIsHdLoaded(true);
    if (activeSharpSrc) {
      // Đưa vào cache RAM
      if (!preloadedImagesCache.has(activeSharpSrc)) {
        const cached = new Image();
        cached.src = activeSharpSrc;
        preloadedImagesCache.set(activeSharpSrc, cached);
      }
    }
    if (onImageLoad) onImageLoad();
  };

  return (
    <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
      {/* LỚP 1: BASE LAYER (w800) - Hiển thị ngay lập tức 0ms, sắc nét từ cache, KHÔNG blur */}
      <img
        src={baseCandidates[baseIdx] || photo.thumbnailUrl || photo.url}
        alt={alt || photo.fileName}
        loading="eager"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (baseIdx < baseCandidates.length - 1) setBaseIdx((p) => p + 1);
        }}
        className={`${className} select-none`}
        style={style}
      />

      {/* LỚP 2: SHARP HD LAYER (w1600 / Original HD) - Đè lên trên khi sẵn sàng */}
      {!hasError && (
        <img
          src={activeSharpSrc}
          alt={alt || photo.fileName}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleHdError}
          onLoad={handleHdLoad}
          className={`absolute inset-0 w-full h-full ${className} select-none transition-opacity duration-150 ${
            isHdLoaded ? "opacity-100" : "opacity-0"
          }`}
          style={style}
          {...restProps}
        />
      )}
    </div>
  );
};
