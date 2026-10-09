import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Sparkles,
  ArrowRight,
  FolderOpen,
  Camera,
} from "lucide-react";
import { ImageWithFallback } from "./ImageWithFallback";
import { resolveImage } from "../utils/imageMapper";
import { preloadImageFast } from "../utils/imageOptimizer";

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
}

interface Horizontal3DCollectionTrackProps {
  collections: CollectionItem[];
  categoryTitle: string;
  categorySubtitle?: string;
  onSelectCollection: (index: number) => void;
  isAdminMode?: boolean;
  preloadHighResImage?: (src: string) => void;
  slideImages?: Array<{ src: string }>;
  currentSlideId?: string;
  onNavigateCategory?: (slideId: string) => void;
}

// Single 3D Perspective Card in the horizontal rail
const Card3D: React.FC<{
  col: CollectionItem;
  originalIndex: number;
  displayIndex: number;
  onSelect: () => void;
  isAdminMode?: boolean;
  preloadHighResImage?: (src: string) => void;
  fallbackImageSrc?: string;
}> = ({
  col,
  originalIndex,
  displayIndex,
  onSelect,
  isAdminMode,
  preloadHighResImage,
  fallbackImageSrc,
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
    // Only apply tilt on fine-pointer devices (laptops/desktops) to avoid mobile touch lag
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
      opacity: 0.25,
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onPointerEnter={() => {
        if (coverImg && preloadHighResImage) preloadHighResImage(coverImg);
        if (col.images && col.images[0] && preloadHighResImage) preloadHighResImage(col.images[0].src);
      }}
      onClick={onSelect}
      style={{ perspective: 1000 }}
      className="relative shrink-0 w-[160px] min-[375px]:w-[172px] min-[410px]:w-[188px] sm:w-[280px] md:w-[320px] lg:w-[360px] select-none cursor-pointer group"
    >
      <div
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0px)`,
          transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          transformStyle: "preserve-3d",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
        className="relative rounded-xl sm:rounded-2xl md:rounded-3xl overflow-hidden liquid-glass border border-white/10 group-hover:border-[#B5945B]/70 transition-colors duration-300 flex flex-col h-[275px] sm:h-[390px] md:h-[450px]"
      >
        {/* Dynamic Specular Glare Reflection */}
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300 rounded-xl sm:rounded-2xl md:rounded-3xl"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.28) 0%, rgba(255, 255, 255, 0) 65%)`,
            opacity: glarePos.opacity,
          }}
        />

        {/* COVER PHOTO CANVAS */}
        <div className="relative w-full h-[165px] sm:h-[240px] md:h-[280px] overflow-hidden bg-zinc-950 shrink-0">
          {coverImg ? (
            <ImageWithFallback
              preset="card"
              targetWidth={1080}
              quality={92}
              priority={displayIndex < 4}
              src={coverImg}
              showAspectBlurBg={false}
              alt={col.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              sizes="(max-width: 640px) 360px, (max-width: 768px) 540px, 800px"
              loading={displayIndex < 4 ? "eager" : "lazy"}
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-white/5">
              <FolderOpen className="w-6 h-6 sm:w-8 sm:h-8 text-zinc-700" />
            </div>
          )}

          {/* Dark gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none" />

          {/* Floating 3D Badges */}
          <div
            style={{ transform: "translateZ(20px)" }}
            className="absolute top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 flex items-center justify-between gap-1.5 pointer-events-none z-20"
          >
            <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-sans font-bold bg-[#B5945B] text-black shadow-sm flex items-center gap-1 uppercase tracking-wider shrink-0">
              <Camera className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[2.5]" />
              <span>BST #{originalIndex + 1}</span>
            </span>

            <span className="liquid-glass-btn border-white/15 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-semibold text-white/95 font-sans tracking-wide shrink-0">
              {photoCount} ảnh
            </span>
          </div>
        </div>

        {/* BOTTOM METADATA CARD (Elevated in 3D) */}
        <div
          style={{ transform: "translateZ(14px)" }}
          className="flex-1 p-2.5 sm:p-4 flex flex-col justify-between text-left bg-zinc-950/60 backdrop-blur-md relative z-20 min-h-0"
        >
          <div className="space-y-0.5 sm:space-y-1">
            <h4 className="font-sans font-bold text-xs sm:text-base md:text-lg text-white tracking-tight group-hover:text-[#E5C17C] transition-colors line-clamp-1 leading-snug">
              {col.title}
            </h4>
            <p className="text-zinc-300 text-[10px] sm:text-xs line-clamp-1 sm:line-clamp-2 leading-relaxed">
              {col.subtitle || col.body || "Khám phá câu chuyện hình ảnh đầy màu sắc và nghệ thuật."}
            </p>
          </div>

          <div className="pt-1.5 sm:pt-2 border-t border-white/10 flex items-center justify-between mt-auto">
            <span className="text-[10px] sm:text-xs uppercase tracking-wide text-[#B5945B] font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
              <span>Xem album</span>
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

  const trackRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // High precision position accumulator (avoids integer truncation and 0 React re-renders)
  const scrollPosRef = useRef(0);

  // Drag-to-scroll states
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

  const visibleCollections = useMemo(() => {
    return collections.filter((c) => isAdminMode || !c.isHidden);
  }, [collections, isAdminMode]);

  // Eagerly pre-decode all collection cover images in parallel for instant display & original sharpness
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

  // To ensure truly seamless infinite horizontal wrapping without walls,
  // we clone cards to form at least 16 cards (minimum 4 cycles)
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

  // Initial scroll position in cycle 2 (runway for smooth left-to-right movement)
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
      }
    }
  }, [clonedItems.length, repeatCount]);

  // Proactively preload visible collection cover images in background off the main thread
  useEffect(() => {
    if (visibleCollections && visibleCollections.length > 0) {
      visibleCollections.slice(0, 6).forEach((col) => {
        const cover = col.coverImageSrc || col.images?.[0]?.src;
        if (cover) {
          preloadImageFast(cover, 1080, 90);
        }
      });
    }
  }, [visibleCollections]);

  // Unified Left-to-Right 60fps/120fps continuous flow across all collections
  useEffect(() => {
    const track = trackRef.current;
    if (!track || isInteracting || visibleCollections.length === 0) return;

    let lastTimestamp = performance.now();
    const speed = 32; // Butter-smooth continuous speed (pixels per second)

    const step = (timestamp: number) => {
      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // Clamp delta to prevent jumps
      lastTimestamp = timestamp;

      if (track) {
        const moveDistance = speed * delta;
        const singleCycleWidth = track.scrollWidth / repeatCount;

        // Unified flow: cards glide continuously towards the right across the screen
        scrollPosRef.current -= moveDistance;
        if (scrollPosRef.current <= singleCycleWidth * 0.5) {
          scrollPosRef.current += singleCycleWidth;
        }

        track.scrollLeft = scrollPosRef.current;

        // Update progress bar via DOM ref directly for 0 re-render jank
        if (progressFillRef.current && singleCycleWidth > 0) {
          const currentPosInCycle = scrollPosRef.current % singleCycleWidth;
          const pct = Math.min(100, Math.max(0, (currentPosInCycle / singleCycleWidth) * 100));
          progressFillRef.current.style.width = `${Math.max(6, pct)}%`;
        }
      }

      autoScrollRafRef.current = requestAnimationFrame(step);
    };

    autoScrollRafRef.current = requestAnimationFrame(step);

    return () => {
      if (autoScrollRafRef.current) {
        cancelAnimationFrame(autoScrollRafRef.current);
      }
    };
  }, [isInteracting, visibleCollections.length, repeatCount]);

  // Synchronize internal accumulator on manual native scrolling
  const handleScroll = useCallback(() => {
    if (isInteracting && trackRef.current) {
      scrollPosRef.current = trackRef.current.scrollLeft;
      const singleCycleWidth = trackRef.current.scrollWidth / repeatCount;
      if (progressFillRef.current && singleCycleWidth > 0) {
        const currentPosInCycle = scrollPosRef.current % singleCycleWidth;
        const pct = Math.min(100, Math.max(0, (currentPosInCycle / singleCycleWidth) * 100));
        progressFillRef.current.style.width = `${Math.max(6, pct)}%`;
      }
    }
  }, [isInteracting, repeatCount]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const track = trackRef.current;
    if (!track) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - track.offsetLeft;
    startScrollLeftRef.current = track.scrollLeft;
    setIsInteracting(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    trackRef.current.scrollLeft = startScrollLeftRef.current - walk;
    scrollPosRef.current = trackRef.current.scrollLeft;
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      resetInteractionDelay();
    }
  };

  const resetInteractionDelay = () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 1000);
  };

  if (visibleCollections.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full space-y-3 pt-1">
      {/* Category Subtitle */}
      {categorySubtitle && (
        <div className="text-left pb-1">
          <p className="text-xs sm:text-sm text-zinc-300 font-normal max-w-3xl leading-relaxed">
            {categorySubtitle}
          </p>
        </div>
      )}

      {/* HORIZONTAL CONTINUOUS 3D SCROLLYTELLING CONVEYOR (No black side bars) */}
      <div
        className="relative w-full"
        onMouseEnter={() => setIsInteracting(true)}
        onMouseLeave={() => {
          handleMouseUp();
          setIsInteracting(false);
        }}
        onTouchStart={() => setIsInteracting(true)}
        onTouchEnd={resetInteractionDelay}
      >
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex items-center gap-2.5 sm:gap-4 md:gap-5 overflow-x-auto py-3 px-1 scrollbar-none [webkit-overflow-scrolling:touch] cursor-grab active:cursor-grabbing select-none"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            willChange: "scroll-position",
          }}
        >
          {clonedItems.map((item, idx) => {
            const fallbackSrc =
              slideImages && slideImages[item.originalIdx % slideImages.length]?.src;

            return (
              <Card3D
                key={item.uniqueKey}
                col={item.col}
                originalIndex={item.originalIdx}
                displayIndex={idx}
                onSelect={() => onSelectCollection(item.originalIdx)}
                isAdminMode={isAdminMode}
                preloadHighResImage={preloadHighResImage}
                fallbackImageSrc={fallbackSrc}
              />
            );
          })}
        </div>
      </div>

      {/* SLIM PROGRESS TRACK AT BOTTOM */}
      <div className="w-full flex items-center justify-between gap-3 pt-0.5 text-[11px] text-zinc-400">
        <span className="hidden sm:inline text-zinc-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#B5945B]" />
          <span>Vuốt hoặc rê chuột để dừng lại và xem chi tiết từng album</span>
        </span>
        <div className="flex-1 sm:max-w-xs h-1 sm:h-1.5 bg-white/10 rounded-full overflow-hidden ml-auto">
          <div
            ref={progressFillRef}
            className="h-full bg-gradient-to-r from-[#B5945B] via-amber-300 to-[#B5945B] rounded-full"
            style={{ width: "6%" }}
          />
        </div>
      </div>
    </div>
  );
};
