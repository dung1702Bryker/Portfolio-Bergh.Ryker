import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Sparkles,
  ArrowRight,
  FolderOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Tag,
  Layers,
  Check,
} from "lucide-react";
import { ImageWithFallback } from "./ImageWithFallback";
import { resolveImage } from "../utils/imageMapper";
import { preloadImageFast } from "../utils/imageOptimizer";
import { useDeviceTilt, DeviceTiltState } from "../hooks/useDeviceTilt";

export interface CollectionItem {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  coverImageSrc?: string;
  coverImagePosition?: string;
  driveLink?: string;
  images?: Array<{ src: string; [key: string]: any }>;
  isHidden?: boolean;
  year?: string;
  eventType?: string;
}

interface Horizontal3DCollectionTrackProps {
  collections: CollectionItem[];
  activeCollectionIdx?: number;
  categoryTitle: string;
  categorySubtitle?: string;
  onSelectCollection: (index: number, collectionId?: string) => void;
  isAdminMode?: boolean;
  preloadHighResImage?: (src: string) => void;
  slideImages?: Array<{ src: string }>;
  currentSlideId?: string;
  onNavigateCategory?: (slideId: string) => void;
}

/**
 * 3D Perspective Card in the horizontal carousel
 * Features dynamic specular glare, device gyro tilt, 3D depth layering, and active state spotlight.
 */
const Card3D: React.FC<{
  col: CollectionItem;
  originalIndex: number;
  displayIndex: number;
  isActive: boolean;
  onSelect: (id?: string) => void;
  isAdminMode?: boolean;
  preloadHighResImage?: (src: string) => void;
  fallbackImageSrc?: string;
  deviceTilt?: DeviceTiltState;
}> = ({
  col,
  originalIndex,
  displayIndex,
  isActive,
  onSelect,
  isAdminMode,
  preloadHighResImage,
  fallbackImageSrc,
  deviceTilt,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const coverImg = col.coverImageSrc
    ? resolveImage(col.coverImageSrc)
    : col.images && col.images[0]
      ? resolveImage(col.images[0].src)
      : fallbackImageSrc
        ? resolveImage(fallbackImageSrc)
        : undefined;

  const photoCount = col.images?.length || 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only apply mouse tilt on fine-pointer devices (laptops/desktops)
    if (window.matchMedia("(pointer: coarse)").matches) return;
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -5.5;
    const rY = ((x - centerX) / centerX) * 5.5;

    setRotateX(rX);
    setRotateY(rY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.28,
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  const isTouchDevice =
    typeof window !== "undefined" &&
    (window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);

  const effectiveRotateX = isTouchDevice && deviceTilt ? deviceTilt.rotateX : rotateX;
  const effectiveRotateY = isTouchDevice && deviceTilt ? deviceTilt.rotateY : rotateY;
  const effectiveGlareX = isTouchDevice && deviceTilt ? deviceTilt.glareX : glarePos.x;
  const effectiveGlareY = isTouchDevice && deviceTilt ? deviceTilt.glareY : glarePos.y;
  const effectiveGlareOpacity =
    isTouchDevice && deviceTilt ? deviceTilt.glareOpacity : glarePos.opacity;

  return (
    <div
      ref={cardRef}
      data-card-3d="true"
      data-original-index={originalIndex}
      data-display-index={displayIndex}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onPointerEnter={() => {
        if (coverImg && preloadHighResImage) preloadHighResImage(coverImg);
        if (col.images && col.images[0] && preloadHighResImage)
          preloadHighResImage(col.images[0].src);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(col.id);
      }}
      style={{ perspective: 1200 }}
      className="relative shrink-0 w-[170px] min-[380px]:w-[195px] min-[440px]:w-[220px] sm:w-[280px] md:w-[320px] lg:w-[350px] select-none cursor-pointer group py-3"
    >
      <div
        data-card-inner="true"
        style={{
          transformStyle: "preserve-3d",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
          willChange: "transform, opacity",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
        className={`relative rounded-2xl md:rounded-3xl overflow-hidden liquid-glass transition-all duration-300 flex flex-col h-[300px] sm:h-[400px] md:h-[450px] ${
          isActive
            ? "border-2 border-[#E5C17C] shadow-[0_0_30px_rgba(229,193,124,0.35)] ring-1 ring-[#E5C17C]/50"
            : "border border-white/10 group-hover:border-[#B5945B]/70 shadow-lg shadow-black/40"
        }`}
      >
        {/* Dynamic Specular Glare Reflection */}
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300 rounded-2xl md:rounded-3xl"
          style={{
            background: `radial-gradient(circle at ${effectiveGlareX}% ${effectiveGlareY}%, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0) 65%)`,
            opacity: effectiveGlareOpacity,
          }}
        />

        {/* COVER PHOTO CANVAS */}
        <div className="relative w-full h-[180px] sm:h-[245px] md:h-[275px] overflow-hidden bg-zinc-950 shrink-0">
          {coverImg ? (
            <ImageWithFallback
              preset="card"
              targetWidth={1080}
              quality={92}
              priority={displayIndex < 4}
              src={coverImg}
              showAspectBlurBg={false}
              alt={col.title}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
              sizes="(max-width: 640px) 360px, (max-width: 768px) 540px, 800px"
              loading={displayIndex < 4 ? "eager" : "lazy"}
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-white/5">
              <FolderOpen className="w-8 h-8 text-zinc-700" />
            </div>
          )}

          {/* Dark gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none" />

          {/* Floating 3D Badges */}
          <div
            style={{ transform: "translateZ(24px)" }}
            className="absolute top-2.5 sm:top-3.5 left-2.5 sm:left-3.5 right-2.5 sm:right-3.5 flex items-center justify-between gap-1.5 pointer-events-none z-20"
          >
            <span
              className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-sans font-bold flex items-center gap-1 uppercase tracking-wider shrink-0 transition-colors ${
                isActive
                  ? "bg-[#E5C17C] text-black shadow-md shadow-[#E5C17C]/40"
                  : "bg-black/60 text-[#E5C17C] backdrop-blur-md border border-[#B5945B]/40"
              }`}
            >
              <Camera className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
              <span>{col.year ? `Năm ${col.year}` : `BST #${originalIndex + 1}`}</span>
            </span>

            {/* Active Spotlight Pin */}
            {isActive ? (
              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-sans font-extrabold bg-[#B5945B] text-black flex items-center gap-1 shadow-md shadow-[#B5945B]/50 animate-pulse">
                <Check className="w-3 h-3 stroke-[3]" />
                <span className="hidden min-[400px]:inline">Đang xem</span>
              </span>
            ) : photoCount > 0 ? (
              <span className="px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium bg-black/60 text-zinc-300 backdrop-blur-md border border-white/10 shrink-0">
                {photoCount} ảnh
              </span>
            ) : null}
          </div>
        </div>

        {/* ALBUM METADATA & TITLE */}
        <div className="p-3 sm:p-4 md:p-5 flex-1 flex flex-col justify-between text-left relative z-20">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {col.eventType && (
                <span className="text-[9px] sm:text-[10px] font-semibold text-[#E5C17C] bg-[#B5945B]/15 border border-[#B5945B]/30 px-2 py-0.5 rounded leading-none truncate max-w-[140px] sm:max-w-[200px]">
                  {col.eventType}
                </span>
              )}
            </div>

            <h4
              className={`font-sans font-extrabold text-sm sm:text-base md:text-lg tracking-tight transition-colors line-clamp-1 leading-snug ${
                isActive ? "text-[#E5C17C]" : "text-white group-hover:text-[#E5C17C]"
              }`}
            >
              {col.title}
            </h4>
            <p className="text-zinc-300 text-[11px] sm:text-xs line-clamp-2 leading-relaxed">
              {col.subtitle ||
                col.body ||
                "Khám phá câu chuyện hình ảnh đầy màu sắc và nghệ thuật đỉnh cao của Bergh.Ryker."}
            </p>
          </div>

          <div className="pt-2 sm:pt-3 border-t border-white/10 flex items-center justify-between mt-auto">
            <span
              className={`text-[10px] sm:text-xs uppercase tracking-wide font-bold flex items-center gap-1 group-hover:gap-2 transition-all ${
                isActive ? "text-[#E5C17C]" : "text-zinc-300 group-hover:text-[#B5945B]"
              }`}
            >
              <span>{isActive ? "Đang mở album" : "Xem album"}</span>
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
            </span>

            {isAdminMode && col.isHidden && (
              <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded">
                ẨN
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const Horizontal3DCollectionTrack: React.FC<Horizontal3DCollectionTrackProps> = ({
  collections,
  activeCollectionIdx = 0,
  categoryTitle,
  categorySubtitle,
  onSelectCollection,
  isAdminMode = false,
  preloadHighResImage,
  slideImages,
  currentSlideId,
  onNavigateCategory,
}) => {
  const [isInteracting, setIsInteracting] = useState(false);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const deviceTilt = useDeviceTilt(6.5);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const transformRafRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // High precision position accumulator (avoids integer truncation and 0 React re-renders)
  const scrollPosRef = useRef(0);

  // Drag-to-scroll states
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const velocityRef = useRef(0);
  const lastDragTimeRef = useRef(0);
  const lastDragXRef = useRef(0);

  const visibleCollections = useMemo(() => {
    return collections.filter((c) => isAdminMode || !c.isHidden);
  }, [collections, isAdminMode]);

  // Eagerly pre-decode all collection cover images in parallel for instant display
  useEffect(() => {
    if (typeof window === "undefined") return;
    visibleCollections.forEach((col) => {
      const cover = col.coverImageSrc || (col.images && col.images[0]?.src);
      if (cover) {
        const resolved = resolveImage(cover);
        if (resolved) {
          const img = new window.Image();
          img.decoding = "async";
          img.src = resolved;
        }
      }
    });
  }, [visibleCollections]);

  // Seamless infinite repetition: ensure enough cards for continuous 3D scrolling
  const repeatCount = useMemo(() => {
    if (visibleCollections.length === 0) return 1;
    return Math.max(4, Math.ceil(16 / visibleCollections.length));
  }, [visibleCollections.length]);

  const clonedItems = useMemo(() => {
    if (visibleCollections.length === 0) return [];
    const items: Array<{
      col: CollectionItem;
      originalIdx: number;
      uniqueKey: string;
      cycleIdx: number;
    }> = [];

    for (let cycle = 0; cycle < repeatCount; cycle++) {
      visibleCollections.forEach((col, idx) => {
        const origIdx = collections.findIndex((c) => c.id === col.id);
        items.push({
          col,
          originalIdx: origIdx !== -1 ? origIdx : idx,
          uniqueKey: `card-${col.id || "c"}-cyc${cycle}-idx${idx}`,
          cycleIdx: cycle,
        });
      });
    }

    return items;
  }, [visibleCollections, collections, repeatCount]);

  // High-performance 3D spatial transform calculation directly on DOM elements
  // Applies Cover Flow / Cylindrical 3D curvature relative to the container's center
  const update3DTransforms = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;
    const cards = track.querySelectorAll<HTMLElement>("[data-card-3d]");
    if (cards.length === 0) return;

    const maxReach = trackRect.width * 0.48;

    cards.forEach((card) => {
      const cardRect = card.getBoundingClientRect();
      // Skip offscreen elements beyond viewport reach to save GPU cycles
      if (cardRect.right < trackRect.left - 150 || cardRect.left > trackRect.right + 150) {
        return;
      }

      const cardCenter = cardRect.left + cardRect.width / 2;
      const distFromCenter = cardCenter - centerX;
      const normalized = Math.max(-1.5, Math.min(1.5, distFromCenter / maxReach));

      // 3D parameters:
      // Center card: rotateY = 0deg, translateZ = 35px, scale = 1.04, opacity = 1.0
      // Side cards: rotateY inward towards center, translateZ backwards, scale down to 0.92
      const rotateY = -normalized * 22; // Inward angle in degrees
      const translateZ = -Math.abs(normalized) * 60; // Depth in px
      const scale = 1.04 - Math.min(0.18, Math.abs(normalized) * 0.12);
      const opacity = 1 - Math.min(0.32, Math.abs(normalized) * 0.2);

      const inner = card.querySelector("[data-card-inner]") as HTMLElement | null;
      if (inner) {
        inner.style.transform = `perspective(1200px) rotateY(${rotateY.toFixed(2)}deg) translateZ(${translateZ.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        inner.style.opacity = opacity.toFixed(2);
      }
    });

    // Update progress bar without React re-render
    if (progressFillRef.current && track.scrollWidth > 0) {
      const singleCycleWidth = track.scrollWidth / repeatCount;
      if (singleCycleWidth > 0) {
        const currentPosInCycle = track.scrollLeft % singleCycleWidth;
        const pct = Math.min(100, Math.max(0, (currentPosInCycle / singleCycleWidth) * 100));
        progressFillRef.current.style.width = `${Math.max(6, pct)}%`;
      }
    }
  }, [repeatCount]);

  // Initial scroll position in cycle 2
  const isInitializedRef = useRef(false);
  useEffect(() => {
    const track = trackRef.current;
    if (track && clonedItems.length > 0 && !isInitializedRef.current) {
      const singleCycleWidth = track.scrollWidth / repeatCount;
      if (singleCycleWidth > 0) {
        const startPos = singleCycleWidth * 2;
        track.scrollLeft = startPos;
        scrollPosRef.current = startPos;
        isInitializedRef.current = true;
        update3DTransforms();
      }
    }
  }, [clonedItems.length, repeatCount, update3DTransforms]);

  // Smoothly center the active collection card when activeCollectionIdx changes externally
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !isInitializedRef.current || isDraggingRef.current) return;

    // Find the closest card matching activeCollectionIdx in the visible viewport
    const cards = track.querySelectorAll<HTMLElement>(
      `[data-card-3d][data-original-index="${activeCollectionIdx}"]`
    );
    if (cards.length === 0) return;

    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;

    let closestCard: HTMLElement | null = null;
    let minDistance = Infinity;

    cards.forEach((card) => {
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < minDistance) {
        minDistance = dist;
        closestCard = card;
      }
    });

    if (closestCard) {
      const card = closestCard as HTMLElement;
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const diff = cardCenter - centerX;

      if (Math.abs(diff) > 20) {
        track.scrollBy({ left: diff, behavior: "smooth" });
        scrollPosRef.current = track.scrollLeft + diff;
      }
    }
  }, [activeCollectionIdx]);

  // Proactively preload visible collection cover images in background
  useEffect(() => {
    if (visibleCollections && visibleCollections.length > 0) {
      visibleCollections.slice(0, 8).forEach((col) => {
        const cover = col.coverImageSrc || col.images?.[0]?.src;
        if (cover) {
          preloadImageFast(cover, 1080, 92);
        }
      });
    }
  }, [visibleCollections]);

  // Continuous 60fps/120fps smooth 3D drift carousel loop
  useEffect(() => {
    const track = trackRef.current;
    if (!track || isInteracting || isAutoScrollPaused || visibleCollections.length === 0) return;

    let lastTimestamp = performance.now();
    const speed = 24; // Smooth luxury drift speed (pixels per second)

    const step = (timestamp: number) => {
      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
      lastTimestamp = timestamp;

      if (track) {
        const moveDistance = speed * delta;
        const singleCycleWidth = track.scrollWidth / repeatCount;

        // Smooth left-to-right flow
        scrollPosRef.current -= moveDistance;
        if (scrollPosRef.current <= singleCycleWidth * 0.5) {
          scrollPosRef.current += singleCycleWidth;
        }

        track.scrollLeft = scrollPosRef.current;
        update3DTransforms();
      }

      autoScrollRafRef.current = requestAnimationFrame(step);
    };

    autoScrollRafRef.current = requestAnimationFrame(step);

    return () => {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
      }
    };
  }, [isInteracting, isAutoScrollPaused, visibleCollections.length, repeatCount, update3DTransforms]);

  // Handle native or drag scroll
  const handleScroll = useCallback(() => {
    if (trackRef.current) {
      scrollPosRef.current = trackRef.current.scrollLeft;
      // Schedule transform update on next animation frame
      if (transformRafRef.current) cancelAnimationFrame(transformRafRef.current);
      transformRafRef.current = requestAnimationFrame(update3DTransforms);
    }
  }, [update3DTransforms]);

  // Mouse Drag to scroll with momentum
  const handleMouseDown = (e: React.MouseEvent) => {
    const track = trackRef.current;
    if (!track) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - track.offsetLeft;
    startScrollLeftRef.current = track.scrollLeft;
    lastDragTimeRef.current = performance.now();
    lastDragXRef.current = e.pageX;
    velocityRef.current = 0;
    setIsInteracting(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    trackRef.current.scrollLeft = startScrollLeftRef.current - walk;
    scrollPosRef.current = trackRef.current.scrollLeft;

    const now = performance.now();
    const dt = now - lastDragTimeRef.current;
    if (dt > 10) {
      velocityRef.current = (e.pageX - lastDragXRef.current) / dt;
      lastDragTimeRef.current = now;
      lastDragXRef.current = e.pageX;
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      const track = trackRef.current;
      // Apply momentum flick
      if (track && Math.abs(velocityRef.current) > 0.4) {
        const momentumWalk = -velocityRef.current * 250;
        track.scrollBy({ left: momentumWalk, behavior: "smooth" });
      }
      resetInteractionDelay();
    }
  };

  const resetInteractionDelay = () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 1200);
  };

  // Step Left / Right Carousel Buttons
  const handleStepPrev = () => {
    const track = trackRef.current;
    if (!track) return;
    setIsInteracting(true);
    const cardW = track.querySelector("[data-card-3d]")?.getBoundingClientRect().width || 320;
    track.scrollBy({ left: -(cardW + 16), behavior: "smooth" });
    resetInteractionDelay();
  };

  const handleStepNext = () => {
    const track = trackRef.current;
    if (!track) return;
    setIsInteracting(true);
    const cardW = track.querySelector("[data-card-3d]")?.getBoundingClientRect().width || 320;
    track.scrollBy({ left: cardW + 16, behavior: "smooth" });
    resetInteractionDelay();
  };

  // Center clicked card smoothly
  const handleCardClick = (origIdx: number, colId?: string) => {
    onSelectCollection(origIdx, colId);

    const track = trackRef.current;
    if (!track) return;

    // Find the specific card element and center it
    const cards = track.querySelectorAll<HTMLElement>(
      `[data-card-3d][data-original-index="${origIdx}"]`
    );
    if (cards.length > 0) {
      const trackRect = track.getBoundingClientRect();
      const centerX = trackRect.left + trackRect.width / 2;

      let closestCard: HTMLElement | null = null;
      let minDistance = Infinity;

      cards.forEach((card) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const dist = Math.abs(cardCenter - centerX);
        if (dist < minDistance) {
          minDistance = dist;
          closestCard = card;
        }
      });

      if (closestCard) {
        const cardRect = (closestCard as HTMLElement).getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const diff = cardCenter - centerX;
        track.scrollBy({ left: diff, behavior: "smooth" });
      }
    }
  };

  if (visibleCollections.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full space-y-4 pt-2 group/carousel select-none"
    >
      {/* Category Subtitle & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
        {categorySubtitle ? (
          <p className="text-xs sm:text-sm text-zinc-300 font-normal max-w-2xl leading-relaxed">
            {categorySubtitle}
          </p>
        ) : (
          <div />
        )}

        {/* Carousel Quick Navigation Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {/* Step Prev Button */}
          <button
            type="button"
            onClick={handleStepPrev}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/90 hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Album trước"
            aria-label="Album trước"
          >
            <ChevronLeft className="w-4 h-4 text-[#E5C17C]" />
          </button>

          {/* Step Next Button */}
          <button
            type="button"
            onClick={handleStepNext}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/90 hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Album tiếp theo"
            aria-label="Album tiếp theo"
          >
            <ChevronRight className="w-4 h-4 text-[#E5C17C]" />
          </button>
        </div>
      </div>

      {/* 3D CAROUSEL STAGE WITH PERSPECTIVE */}
      <div
        className="relative w-full overflow-hidden py-2"
        onMouseEnter={() => setIsInteracting(true)}
        onMouseLeave={() => {
          handleMouseUp();
          setIsInteracting(false);
        }}
        onTouchStart={() => setIsInteracting(true)}
        onTouchEnd={resetInteractionDelay}
        style={{ perspective: 1400 }}
      >
        {/* Floating Quick Action Nav Arrows on Desktop */}
        <button
          type="button"
          onClick={handleStepPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full liquid-glass-gold-btn text-black flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 shadow-xl cursor-pointer hover:scale-105 active:scale-95 hidden sm:flex"
          title="Cuộn sang trái"
          aria-label="Cuộn sang trái"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        <button
          type="button"
          onClick={handleStepNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full liquid-glass-gold-btn text-black flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 shadow-xl cursor-pointer hover:scale-105 active:scale-95 hidden sm:flex"
          title="Cuộn sang phải"
          aria-label="Cuộn sang phải"
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* 3D HORIZONTAL RAIL */}
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex items-center gap-3 sm:gap-6 md:gap-7 overflow-x-auto py-4 px-6 scrollbar-none [webkit-overflow-scrolling:touch] cursor-grab active:cursor-grabbing select-none"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            willChange: "scroll-position",
            transformStyle: "preserve-3d",
          }}
        >
          {clonedItems.map((item, idx) => {
            const fallbackSrc =
              slideImages && slideImages[item.originalIdx % slideImages.length]?.src;
            const isCardActive = item.originalIdx === activeCollectionIdx;

            return (
              <Card3D
                key={item.uniqueKey}
                col={item.col}
                originalIndex={item.originalIdx}
                displayIndex={idx}
                isActive={isCardActive}
                onSelect={(id) => handleCardClick(item.originalIdx, id || item.col.id)}
                isAdminMode={isAdminMode}
                preloadHighResImage={preloadHighResImage}
                fallbackImageSrc={fallbackSrc}
                deviceTilt={deviceTilt}
              />
            );
          })}
        </div>
      </div>

      {/* SLIM PROGRESS & INTERACTION FOOTER */}
      <div className="w-full flex items-center justify-between gap-3 pt-1 text-[11px] text-zinc-400">
        <span className="text-zinc-400 flex items-center gap-1.5 text-left">
          <Sparkles className="w-3.5 h-3.5 text-[#B5945B] shrink-0" />
          <span className="hidden sm:inline">
            Kéo chuột hoặc vuốt ngang để lướt xem 3D toàn bộ các bộ sưu tập album. Bấm vào bất kỳ album nào để mở ngay.
          </span>
          <span className="sm:hidden">
            Vuốt ngang hoặc bấm album để mở ngay
          </span>
        </span>

        {/* Glowing Scrubber Bar */}
        <div className="flex-1 sm:max-w-xs h-1 sm:h-1.5 bg-white/10 rounded-full overflow-hidden ml-auto">
          <div
            ref={progressFillRef}
            className="h-full bg-gradient-to-r from-[#B5945B] via-[#E5C17C] to-[#B5945B] rounded-full shadow-[0_0_8px_rgba(229,193,124,0.6)] transition-all duration-75"
            style={{ width: "6%" }}
          />
        </div>
      </div>
    </div>
  );
};
