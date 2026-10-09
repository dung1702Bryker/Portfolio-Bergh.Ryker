import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { resolveImage } from "../utils/imageMapper";
import {
  getPictureSources,
  getOptimizedImageUrl,
  isImageLoadedInCache,
  markImageLoadedInCache,
  DEFAULT_RESPONSIVE_WIDTHS,
  THUMBNAIL_RESPONSIVE_WIDTHS,
  HERO_RESPONSIVE_WIDTHS,
} from "../utils/imageOptimizer";

export interface ImageWithFallbackProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "srcSet"> {
  wrapperClassName?: string;
  priority?: boolean;
  targetWidth?: number;
  widths?: number[];
  sizes?: string;
  fallbackImageSrc?: string;
  preset?: "thumbnail" | "card" | "hero" | "album" | "default";
  quality?: number;
  fitMode?: "cover" | "contain" | "natural";
  showAspectBlurBg?: boolean;
}

const EMERGENCY_FALLBACK =
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

const DEFAULT_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = React.memo(({
  src: rawSrc,
  alt,
  className,
  wrapperClassName,
  priority = false,
  targetWidth,
  widths = DEFAULT_RESPONSIVE_WIDTHS,
  sizes,
  fallbackImageSrc = EMERGENCY_FALLBACK,
  preset = "default",
  quality,
  fitMode = "cover",
  showAspectBlurBg,
  style,
  ...props
}) => {
  // Resolve virtual/asset paths to true URLs immediately
  const resolvedSrc = useMemo(() => resolveImage(rawSrc), [rawSrc]);

  // Check if image is already cached in memory or browser session
  const isAlreadyCached = useMemo(() => {
    return resolvedSrc ? isImageLoadedInCache(resolvedSrc) : false;
  }, [resolvedSrc]);

  const [isLoaded, setIsLoaded] = useState(isAlreadyCached);
  const [hasError, setHasError] = useState(false);
  const [triedProxy, setTriedProxy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if client is on a weak network or has Data Saver active
  const isSlowConnection = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const conn = (navigator as any).connection;
    if (!conn) return false;
    return !!(
      conn.saveData ||
      conn.effectiveType === "slow-2g" ||
      conn.effectiveType === "2g" ||
      conn.effectiveType === "3g"
    );
  }, []);

  // Reset error and proxy trial on src change
  useEffect(() => {
    setTriedProxy(false);
    setHasError(false);
    if (resolvedSrc && isImageLoadedInCache(resolvedSrc)) {
      setIsLoaded(true);
    } else {
      setIsLoaded(false);
    }
  }, [resolvedSrc]);

  // Fast layout check if browser already has image in cache
  useLayoutEffect(() => {
    if (imgRef.current && (imgRef.current.complete || imgRef.current.naturalWidth > 0)) {
      if (resolvedSrc) markImageLoadedInCache(resolvedSrc);
      setIsLoaded(true);
    }
  }, [resolvedSrc]);

  // Compute adaptive widths, targetWidth, and quality based on preset & viewport
  const { effectiveWidths, effectiveTargetWidth, effectiveQuality, effectiveSizes } = useMemo(() => {
    const isMobile = typeof window !== "undefined" ? window.innerWidth <= 640 : false;

    let baseTargetW = targetWidth || (isMobile ? 720 : 1200);
    let baseQ = quality || (isMobile ? 86 : 88);
    let baseWidths = widths;
    let baseSizes = sizes || (isMobile ? "100vw" : DEFAULT_SIZES);

    if (preset === "thumbnail") {
      baseWidths = widths === DEFAULT_RESPONSIVE_WIDTHS ? THUMBNAIL_RESPONSIVE_WIDTHS : widths;
      baseTargetW = targetWidth || (isMobile ? 480 : 640);
      baseQ = quality || 85;
      baseSizes = sizes || "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
    } else if (preset === "card") {
      baseWidths = widths === DEFAULT_RESPONSIVE_WIDTHS ? DEFAULT_RESPONSIVE_WIDTHS : widths;
      baseTargetW = targetWidth || (isMobile ? 720 : 1080);
      baseQ = quality || 88;
      baseSizes = sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";
    } else if (preset === "hero") {
      baseWidths = widths === DEFAULT_RESPONSIVE_WIDTHS ? HERO_RESPONSIVE_WIDTHS : widths;
      baseTargetW = targetWidth || (isMobile ? 1200 : 1920);
      baseQ = quality || 90;
      baseSizes = sizes || "100vw";
    } else if (preset === "album") {
      baseWidths = widths === DEFAULT_RESPONSIVE_WIDTHS ? HERO_RESPONSIVE_WIDTHS : widths;
      baseTargetW = targetWidth || (isMobile ? 1600 : 2560);
      baseQ = quality || 92;
      baseSizes = sizes || "(max-width: 768px) 100vw, 1200px";
    }

    if (isSlowConnection && !quality) {
      baseQ = 82;
    }

    return {
      effectiveWidths: baseWidths,
      effectiveTargetWidth: baseTargetW,
      effectiveQuality: baseQ,
      effectiveSizes: baseSizes,
    };
  }, [preset, widths, targetWidth, quality, sizes, isSlowConnection]);

  // Generate responsive WebP and fallback JPEG sources with URL-based resizing
  const pictureSources = useMemo(() => {
    if (!resolvedSrc || hasError) return null;
    return getPictureSources(resolvedSrc, effectiveWidths, effectiveTargetWidth, effectiveQuality);
  }, [resolvedSrc, effectiveWidths, effectiveTargetWidth, effectiveQuality, hasError]);

  useEffect(() => {
    // Safety timeout: reveal image smoothly so UI is never stuck
    const timeoutId = setTimeout(() => {
      setIsLoaded(true);
    }, 1200);

    return () => clearTimeout(timeoutId);
  }, [resolvedSrc]);

  const handleLoad = () => {
    if (resolvedSrc) {
      markImageLoadedInCache(resolvedSrc);
    }
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    // If direct Google CDN failed, try local server proxy fallback once
    if (!triedProxy && resolvedSrc) {
      const match = resolvedSrc.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
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

  // Determine standard <img> src
  const displaySrc = useMemo(() => {
    if (triedProxy && resolvedSrc) {
      const match = resolvedSrc.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
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
  }, [triedProxy, hasError, resolvedSrc, pictureSources, fallbackImageSrc, effectiveTargetWidth]);

  const enableBlurBg = showAspectBlurBg ?? (fitMode === "contain");

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${
        fitMode === "natural"
          ? "w-full flex items-center justify-center bg-transparent"
          : "w-full h-full bg-zinc-950"
      } ${fitMode === "contain" ? "flex items-center justify-center min-h-[220px]" : ""} ${
        wrapperClassName || ""
      }`}
    >
      {/* AMBIENT BLURRED BACKDROP (Only for contain mode or explicit showAspectBlurBg) */}
      {enableBlurBg && displaySrc && (
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

      {/* ULTRA-FAST CSS SHIMMER PLACEHOLDER (0 extra network roundtrips, pure CSS GPU) */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-zinc-900/90 pointer-events-none z-0 flex items-center justify-center animate-pulse">
          <div className="w-2 h-2 rounded-full bg-[#B5945B]/30" />
        </div>
      )}

      <picture
        className={`${
          fitMode === "natural"
            ? "w-full flex items-center justify-center block"
            : fitMode === "contain"
            ? "max-w-full max-h-full w-full h-full flex items-center justify-center"
            : "w-full h-full block"
        } relative z-10`}
      >
        {/* 1. WebP Format Source with Viewport-Adaptive URL Resizing */}
        {pictureSources?.isOptimizable && pictureSources.webpSrcSet && !hasError && !triedProxy && (
          <source
            type="image/webp"
            srcSet={pictureSources.webpSrcSet}
            sizes={effectiveSizes}
          />
        )}

        {/* 2. Fallback Format (JPEG) Source with Viewport-Adaptive URL Resizing */}
        {pictureSources?.isOptimizable && pictureSources.fallbackSrcSet && !hasError && !triedProxy && (
          <source
            type="image/jpeg"
            srcSet={pictureSources.fallbackSrcSet}
            sizes={effectiveSizes}
          />
        )}

        {/* 3. Base <img> Element with Native Lazy Loading & Async GPU Decoding */}
        <img
          ref={imgRef}
          src={displaySrc}
          alt={alt || "Gallery visual"}
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
          } ${
            className || ""
          } relative z-10 transform-gpu ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${isAlreadyCached ? "" : "transition-opacity duration-300 ease-out"}`}
          {...props}
        />
      </picture>
    </div>
  );
});

ImageWithFallback.displayName = "ImageWithFallback";
