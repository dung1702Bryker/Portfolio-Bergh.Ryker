import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { resolveImage } from "../utils/imageMapper";
import {
  getPictureSources,
  isImageLoadedInCache,
  markImageLoadedInCache,
  DEFAULT_RESPONSIVE_WIDTHS,
  THUMBNAIL_RESPONSIVE_WIDTHS,
  HERO_RESPONSIVE_WIDTHS,
} from "../utils/imageOptimizer";

export interface LazyImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "srcSet"> {
  src: string;
  alt?: string;
  rootMargin?: string; // Mặc định '200px' theo yêu cầu
  threshold?: number | number[];
  priority?: boolean;
  wrapperClassName?: string;
  placeholderSrc?: string;
  fallbackImageSrc?: string;
  preset?: "thumbnail" | "card" | "hero" | "album" | "default";
  targetWidth?: number;
  quality?: number;
  fitMode?: "cover" | "contain" | "natural";
  showAspectBlurBg?: boolean;
  onIntersect?: () => void;
}

const EMERGENCY_FALLBACK = "";
const DEFAULT_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

/**
 * Reusable LazyImage component utilizing IntersectionObserver with rootMargin: '200px'.
 * Defers loading image assets until they are within 200px of the viewport,
 * dramatically conserving mobile 4G/5G bandwidth and ensuring smooth 60fps scrolling.
 */
export const LazyImage: React.FC<LazyImageProps> = React.memo(({
  src: rawSrc,
  alt = "Bergh.Ryker visual",
  className = "",
  wrapperClassName = "",
  rootMargin = "200px",
  threshold = 0.01,
  priority = false,
  placeholderSrc,
  fallbackImageSrc = "",
  preset = "default",
  targetWidth,
  quality,
  fitMode = "cover",
  showAspectBlurBg,
  style,
  onIntersect,
  ...props
}) => {
  // Resolve image URL (resolves asset tokens or Google Drive paths)
  const resolvedSrc = useMemo(() => resolveImage(rawSrc), [rawSrc]);

  // Check if image has already been loaded and decoded in browser session
  const isAlreadyCached = useMemo(() => {
    return resolvedSrc ? isImageLoadedInCache(resolvedSrc) : false;
  }, [resolvedSrc]);

  // Container ref for IntersectionObserver
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection state: if priority is true or already cached in memory, trigger immediately
  const [isInView, setIsInView] = useState<boolean>(() => {
    if (priority) return true;
    if (typeof window === "undefined") return false;
    return isAlreadyCached;
  });

  const [isLoaded, setIsLoaded] = useState(isAlreadyCached);
  const [hasError, setHasError] = useState(false);
  const [triedProxy, setTriedProxy] = useState(false);

  // Fast layout check if already completed
  useLayoutEffect(() => {
    if (imgRef.current && (imgRef.current.complete || imgRef.current.naturalWidth > 0)) {
      if (resolvedSrc) markImageLoadedInCache(resolvedSrc);
      setIsLoaded(true);
    }
  }, [resolvedSrc, isInView]);

  // Observe container intersection with rootMargin: '200px'
  useEffect(() => {
    if (isInView || priority) return;
    const element = containerRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && (entry.isIntersecting || entry.intersectionRatio > 0)) {
          setIsInView(true);
          onIntersect?.();
          observer.unobserve(element);
          observer.disconnect();
        }
      },
      {
        rootMargin, // '200px' margin for seamless pre-fetching before visible
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isInView, priority, rootMargin, threshold, onIntersect]);

  // Reset states when rawSrc changes
  useEffect(() => {
    setTriedProxy(false);
    setHasError(false);
    if (resolvedSrc && isImageLoadedInCache(resolvedSrc)) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [resolvedSrc]);

  // Responsive sizes & widths calculation based on preset & device
  const { effectiveWidths, effectiveTargetWidth, effectiveQuality, effectiveSizes } = useMemo(() => {
    const isMobile = typeof window !== "undefined" ? window.innerWidth <= 640 : false;

    let baseTargetW = targetWidth || (isMobile ? 720 : 1200);
    let baseQ = quality || (isMobile ? 86 : 88);
    let baseWidths = DEFAULT_RESPONSIVE_WIDTHS;
    let baseSizes = props.sizes || (isMobile ? "100vw" : DEFAULT_SIZES);

    if (preset === "thumbnail") {
      baseWidths = THUMBNAIL_RESPONSIVE_WIDTHS;
      baseTargetW = targetWidth || (isMobile ? 480 : 640);
      baseQ = quality || 85;
      baseSizes = props.sizes || "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
    } else if (preset === "card") {
      baseWidths = DEFAULT_RESPONSIVE_WIDTHS;
      baseTargetW = targetWidth || (isMobile ? 720 : 1080);
      baseQ = quality || 88;
      baseSizes = props.sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";
    } else if (preset === "hero") {
      baseWidths = HERO_RESPONSIVE_WIDTHS;
      baseTargetW = targetWidth || (isMobile ? 1200 : 1920);
      baseQ = quality || 90;
      baseSizes = props.sizes || "100vw";
    } else if (preset === "album") {
      baseWidths = HERO_RESPONSIVE_WIDTHS;
      baseTargetW = targetWidth || (isMobile ? 1600 : 2560);
      baseQ = quality || 92;
      baseSizes = props.sizes || "(max-width: 768px) 100vw, 1200px";
    }

    return {
      effectiveWidths: baseWidths,
      effectiveTargetWidth: baseTargetW,
      effectiveQuality: baseQ,
      effectiveSizes: baseSizes,
    };
  }, [preset, targetWidth, quality, props.sizes]);

  // Generate responsive WebP and fallback JPEG sources with URL-based resizing
  const pictureSources = useMemo(() => {
    if (!isInView || !resolvedSrc || hasError) return null;
    return getPictureSources(resolvedSrc, effectiveWidths, effectiveTargetWidth, effectiveQuality);
  }, [isInView, resolvedSrc, effectiveWidths, effectiveTargetWidth, effectiveQuality, hasError]);

  const handleLoad = () => {
    if (resolvedSrc) {
      markImageLoadedInCache(resolvedSrc);
    }
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    if (!triedProxy && resolvedSrc) {
      const match =
        resolvedSrc.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
        resolvedSrc.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        setTriedProxy(true);
        setIsLoaded(false);
        return;
      }
    }
    setHasError(true);
    setIsLoaded(true);
  };

  // Determine standard <img> displaySrc
  const displaySrc = useMemo(() => {
    if (!isInView) {
      return placeholderSrc || "";
    }
    if (triedProxy && resolvedSrc) {
      const match =
        resolvedSrc.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
        resolvedSrc.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `/api/proxy-image?id=${match[1]}&w=${effectiveTargetWidth}`;
      }
    }
    if (hasError || !resolvedSrc) {
      return fallbackImageSrc || EMERGENCY_FALLBACK;
    }
    if (pictureSources?.webpDefaultSrc) {
      return pictureSources.webpDefaultSrc;
    }
    if (pictureSources?.defaultSrc) {
      return pictureSources.defaultSrc;
    }
    return resolvedSrc;
  }, [
    isInView,
    placeholderSrc,
    triedProxy,
    resolvedSrc,
    hasError,
    fallbackImageSrc,
    pictureSources,
    effectiveTargetWidth,
  ]);

  const enableBlurBg = showAspectBlurBg ?? (fitMode === "contain");

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${
        fitMode === "natural"
          ? "w-full flex items-center justify-center bg-transparent"
          : "w-full h-full bg-zinc-950"
      } ${fitMode === "contain" ? "flex items-center justify-center min-h-[200px]" : ""} ${
        wrapperClassName || ""
      }`}
    >
      {/* 1. LUXURY SKELETON PLACEHOLDER - Active until photo is scrolled into view (within 200px) & loaded */}
      {(!isInView || !isLoaded) && (
        <div
          aria-hidden="true"
          className="luxury-shimmer absolute inset-0 z-0 pointer-events-none flex items-center justify-center"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-[#E5C17C]/20 border border-[#B5945B]/30 animate-pulse" />
        </div>
      )}

      {/* 2. AMBIENT BLURRED BACKDROP (For contain mode or explicit showAspectBlurBg) */}
      {isInView && enableBlurBg && displaySrc && (
        <img
          src={displaySrc}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover filter blur-2xl scale-125 pointer-events-none opacity-25 select-none z-0"
        />
      )}

      {/* 3. ACTUAL RESPONSIVE PICTURE / IMG - ONLY MOUNTED/FETCHED WHEN IN VIEW */}
      {isInView && displaySrc && (
        <picture
          className={`${
            fitMode === "natural"
              ? "w-full flex items-center justify-center block"
              : fitMode === "contain"
              ? "max-w-full max-h-full w-full h-full flex items-center justify-center"
              : "w-full h-full block"
          } relative z-10`}
        >
          {pictureSources?.isOptimizable && pictureSources.webpSrcSet && !hasError && !triedProxy && (
            <source
              type="image/webp"
              srcSet={pictureSources.webpSrcSet}
              sizes={effectiveSizes}
            />
          )}

          {pictureSources?.isOptimizable && pictureSources.fallbackSrcSet && !hasError && !triedProxy && (
            <source
              type="image/jpeg"
              srcSet={pictureSources.fallbackSrcSet}
              sizes={effectiveSizes}
            />
          )}

          <img
            ref={imgRef}
            src={displaySrc}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            referrerPolicy="no-referrer"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            sizes={effectiveSizes}
            style={style}
            className={`${
              fitMode === "natural"
                ? "w-full h-auto max-h-[85vh] object-contain block mx-auto"
                : fitMode === "contain"
                ? "max-w-full max-h-full w-auto h-auto object-contain block"
                : "w-full h-full object-cover"
            } ${className} relative z-10 transform-gpu ${
              isLoaded ? "opacity-100" : "opacity-0"
            } transition-opacity duration-700 ease-out`}
            {...props}
          />
        </picture>
      )}
    </div>
  );
});

LazyImage.displayName = "LazyImage";
export default LazyImage;
