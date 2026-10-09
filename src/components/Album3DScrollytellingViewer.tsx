import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import {
  Eye,
  ZoomIn,
  Sparkles,
  Layers,
  Compass,
  Film,
  Heart,
  Share2,
} from "lucide-react";
import { ImageWithFallback } from "./ImageWithFallback";
import { resolveImage } from "../utils/imageMapper";
import { SlideData } from "../types";

export interface AlbumPhotoItem {
  id?: string;
  src: string;
  title?: string;
  desc?: string;
  alt?: string;
  views?: number;
  originalPhoto?: any;
}

interface Album3DScrollytellingViewerProps {
  collection: SlideData;
  photos: AlbumPhotoItem[];
  allPhotosCount: number;
  visibleCount: number;
  onLoadMore: () => void;
  onOpenLightbox: (photo: AlbumPhotoItem, index: number) => void;
  getPhotoViews: (photo: any) => number;
  formatViewCount: (views?: number) => string;
  recordPhotoView: (photoId: string, photoTitle: string, albumId: string) => void;
  preloadHighResImage: (src: string) => void;
}

// Cinematic Story Beats matching graduation / event / artistic mood
const STORY_BEATS = [
  { label: "Mở Đầu Câu Chuyện", tag: "Golden Hour · Ánh Sáng Tự Nhiên", mood: "Nắng sớm trong trẻo" },
  { label: "Cảm Xúc Tự Nhiên", tag: "Góc Máy Điện Ảnh · Bắt Trọn Thần Thái", mood: "Nụ cười rạng rỡ" },
  { label: "Nét Đẹp Tuổi Học Trò", tag: "Signature Color · Kỷ Niệm Tinh Tế", mood: "Thanh xuân trọn vẹn" },
  { label: "Khoảnh Khắc Đắt Giá", tag: "Góc Toàn Cảnh · Không Gian Rộng Mở", mood: "Bầu không khí lễ hội" },
  { label: "Chi Tiết Nghệ Thuật", tag: "Ống Kính 85mm · Chiều Sâu Điện Ảnh", mood: "Tâm hồn lắng đọng" },
  { label: "Giai Điệu Kỷ Yếu", tag: "Chân Dung Cảm Xúc · Tinh Khôi", mood: "Ký ức bất tận" },
  { label: "Nốt Trầm Hoàng Hôn", tag: "Ánh Hoàng Hôn · Tone Màu Hoài Niệm", mood: "Hoàng hôn buông dịu" },
  { label: "Khép Lại Khung Hình", tag: "Toàn Cảnh Bế Mạc · Kỷ Niệm Đẹp Nhất", mood: "Dấu ấn thanh xuân" },
];

// Single 3D Scrollytelling Card with Mouse Parallax & Depth
const Scrollytelling3DCard: React.FC<{
  photo: AlbumPhotoItem;
  index: number;
  total: number;
  collectionTitle: string;
  collectionId: string;
  onOpenLightbox: (photo: AlbumPhotoItem, index: number) => void;
  getPhotoViews: (photo: any) => number;
  formatViewCount: (views?: number) => string;
  recordPhotoView: (photoId: string, photoTitle: string, albumId: string) => void;
  preloadHighResImage: (src: string) => void;
  isActive: boolean;
}> = ({
  photo,
  index,
  total,
  collectionTitle,
  collectionId,
  onOpenLightbox,
  getPhotoViews,
  formatViewCount,
  recordPhotoView,
  preloadHighResImage,
  isActive,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [isLiked, setIsLiked] = useState(false);

  const beat = STORY_BEATS[index % STORY_BEATS.length];

  // Mouse Parallax Tilt Physics on Desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -7; // max 7 deg tilt
    const rY = ((x - centerX) / centerX) * 7;

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

  return (
    <motion.div
      ref={cardRef}
      id={`story-card-${index}`}
      initial={{ opacity: 0, y: 35, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onPointerEnter={() => preloadHighResImage(photo.src)}
      style={{
        perspective: 1200,
      }}
      className="relative w-full group select-none scroll-mt-24 sm:scroll-mt-28"
    >
      {/* 3D Transform Surface */}
      <div
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0px)`,
          transition: "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          transformStyle: "preserve-3d",
        }}
        className={`relative rounded-2xl sm:rounded-3xl overflow-hidden liquid-glass border transition-all duration-500 shadow-2xl ${
          isActive
            ? "border-[#B5945B]/60 shadow-[0_25px_60px_-15px_rgba(181,148,91,0.22)] ring-1 ring-[#B5945B]/40"
            : "border-white/10 hover:border-white/25 hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
        }`}
      >
        {/* Dynamic Specular Glass Glare Reflection */}
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300 rounded-2xl sm:rounded-3xl"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 65%)`,
            opacity: glarePos.opacity,
          }}
        />

        {/* TOP FLOATING 3D STORYLINE HEADER (Elevated in 3D) */}
        <div
          style={{ transform: "translateZ(26px)" }}
          className="p-3.5 sm:p-4.5 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between gap-3 text-left relative z-20 pointer-events-none"
        >
          {/* Chapter Beat Chip */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-sans font-bold bg-[#B5945B] text-black tracking-wider uppercase flex items-center gap-1.5 shrink-0 shadow-sm">
              <Film className="w-3 h-3 stroke-[2.5]" />
              <span>Khoảnh khắc #{index + 1}</span>
            </span>

            <span className="text-[11px] sm:text-xs text-white/90 font-medium truncate hidden sm:inline">
              ✦ {beat.label}
            </span>
          </div>

          {/* Counter pill */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-zinc-300 bg-black/60 backdrop-blur-md border border-white/15">
              {index + 1} / {total}
            </span>
          </div>
        </div>

        {/* MAIN PHOTO CANVAS WITH NATURAL PROPORTIONS */}
        <div
          onClick={() => {
            recordPhotoView(
              photo.id || photo.src,
              photo.title || `${collectionTitle} #${index + 1}`,
              collectionId
            );
            onOpenLightbox(photo, index);
          }}
          className="relative w-full overflow-hidden bg-black/30 flex items-center justify-center cursor-pointer"
        >
          <ImageWithFallback
            preset="album"
            fitMode="natural"
            showAspectBlurBg={false}
            targetWidth={2048}
            quality={92}
            priority={index < 3}
            src={resolveImage(photo.src)}
            fallbackImageSrc={
              photo.originalPhoto?.thumbnail ? resolveImage(photo.originalPhoto.thumbnail) : undefined
            }
            alt={photo.alt || `${collectionTitle} ảnh ${index + 1}`}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 95vw, 1200px"
            className="w-full h-auto max-h-[86vh] object-contain block mx-auto transition-transform duration-700 ease-out origin-center group-hover:scale-[1.015]"
          />

          {/* Hover Zoom Prompt Overlay */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
            <div
              style={{ transform: "translateZ(30px)" }}
              className="px-4 py-2 rounded-full bg-black/75 backdrop-blur-md border border-[#B5945B]/60 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-2xl"
            >
              <ZoomIn className="w-4 h-4 text-[#B5945B]" />
              <span>Chạm để phóng to toàn màn hình</span>
            </div>
          </div>
        </div>

        {/* BOTTOM STORY METADATA & EDITORIAL PANEL (Elevated in 3D) */}
        <div
          style={{ transform: "translateZ(20px)" }}
          className="p-4 sm:p-5 liquid-glass border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left relative z-20"
        >
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#E5C17C] uppercase tracking-wider bg-[#B5945B]/10 px-2 py-0.5 rounded-md border border-[#B5945B]/30">
                {beat.tag}
              </span>
              <span className="text-[10px] sm:text-[11px] text-zinc-400 font-normal">
                {beat.mood}
              </span>
            </div>

            <h5 className="font-sans font-bold text-sm sm:text-base text-white tracking-wide truncate">
              {photo.title || `${collectionTitle} • Tác phẩm #${index + 1}`}
            </h5>

            {photo.desc && (
              <p className="text-xs text-zinc-300 font-normal line-clamp-2 leading-relaxed">
                {photo.desc}
              </p>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
            {/* View count */}
            <div className="px-2.5 py-1 rounded-full text-zinc-300 text-xs flex items-center gap-1.5 bg-white/5 border border-white/10">
              <Eye className="w-3.5 h-3.5 text-[#B5945B]" />
              <span className="font-mono font-medium">{formatViewCount(getPhotoViews(photo))}</span>
            </div>

            {/* Favorite button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLiked(!isLiked);
              }}
              title="Yêu thích góc ảnh này"
              className={`p-2 rounded-full border transition-all cursor-pointer ${
                isLiked
                  ? "bg-rose-500/20 border-rose-500/50 text-rose-400"
                  : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-rose-400 stroke-rose-400" : ""}`} />
            </button>

            {/* Zoom Action */}
            <button
              type="button"
              onClick={() => {
                recordPhotoView(
                  photo.id || photo.src,
                  photo.title || `${collectionTitle} #${index + 1}`,
                  collectionId
                );
                onOpenLightbox(photo, index);
              }}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#B5945B] hover:bg-[#d4af37] text-zinc-950 flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
            >
              <ZoomIn className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Phóng to</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const Album3DScrollytellingViewer: React.FC<Album3DScrollytellingViewerProps> = ({
  collection,
  photos,
  allPhotosCount,
  visibleCount,
  onLoadMore,
  onOpenLightbox,
  getPhotoViews,
  formatViewCount,
  recordPhotoView,
  preloadHighResImage,
}) => {
  const [layoutMode, setLayoutMode] = useState<"scrollytelling" | "grid">("scrollytelling");
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  // Track scroll position to update active index & progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      // Find which card is closest to vertical center of viewport
      let closestIdx = 0;
      let minDistance = Infinity;

      photos.forEach((_, idx) => {
        const el = document.getElementById(`story-card-${idx}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const cardCenter = rect.top + rect.height / 2;
          const viewportCenter = windowHeight / 2;
          const distance = Math.abs(cardCenter - viewportCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestIdx = idx;
          }
        }
      });

      setActiveStoryIndex(closestIdx);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [photos]);

  // Proactively preload next album story photos for seamless mobile scrolling
  useEffect(() => {
    if (photos && photos.length > 0) {
      const next1 = photos[activeStoryIndex + 1]?.src;
      const next2 = photos[activeStoryIndex + 2]?.src;
      const next3 = photos[activeStoryIndex + 3]?.src;
      [next1, next2, next3].forEach((src) => {
        if (src) {
          preloadHighResImage(src);
        }
      });
    }
  }, [activeStoryIndex, photos, preloadHighResImage]);

  return (
    <div className="relative w-full flex flex-col items-center">
      {/* STREAM OF 3D SCROLLYTELLING CARDS */}
      {layoutMode === "scrollytelling" ? (
        <div className="flex flex-col gap-8 sm:gap-14 max-w-2xl sm:max-w-3xl mx-auto pb-8 w-full">
          {photos.map((photo, idx) => (
            <Scrollytelling3DCard
              key={`scrolly-${collection.id}-${photo.src}-${idx}`}
              photo={photo}
              index={idx}
              total={allPhotosCount}
              collectionTitle={collection.title}
              collectionId={collection.id || "album"}
              onOpenLightbox={onOpenLightbox}
              getPhotoViews={getPhotoViews}
              formatViewCount={formatViewCount}
              recordPhotoView={recordPhotoView}
              preloadHighResImage={preloadHighResImage}
              isActive={idx === activeStoryIndex}
            />
          ))}
        </div>
      ) : (
        /* COMPACT 2-COLUMN LUXURY GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto pb-8 w-full">
          {photos.map((photo, idx) => (
            <motion.div
              key={`grid-${collection.id}-${photo.src}-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4 }}
              onClick={() => {
                recordPhotoView(
                  photo.id || photo.src,
                  photo.title || `${collection.title} #${idx + 1}`,
                  collection.id || "album"
                );
                onOpenLightbox(photo, idx);
              }}
              className="relative rounded-2xl overflow-hidden liquid-glass-card border border-white/10 hover:border-[#B5945B]/50 transition-all cursor-pointer group shadow-xl"
            >
              <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] overflow-hidden bg-black/40">
                <ImageWithFallback
                  preset="album"
                  fitMode="cover"
                  showAspectBlurBg={false}
                  targetWidth={1200}
                  quality={90}
                  src={resolveImage(photo.src)}
                  alt={photo.alt || `${collection.title} ảnh ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2.5 left-2.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/70 text-white border border-white/10">
                    #{idx + 1}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-zinc-950/80 flex items-center justify-between text-left">
                <span className="text-xs font-bold text-white truncate min-w-0 pr-2">
                  {photo.title || `${collection.title} #${idx + 1}`}
                </span>
                <span className="text-[11px] text-[#B5945B] font-semibold flex items-center gap-1 shrink-0">
                  <Eye className="w-3 h-3" />
                  {formatViewCount(getPhotoViews(photo))}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Progressive loading action */}
      {visibleCount < allPhotosCount && (
        <div className="w-full py-8 flex flex-col items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={onLoadMore}
            className="px-6 py-2.5 rounded-full liquid-glass-btn hover:border-[#B5945B]/50 hover:text-[#B5945B] text-xs font-semibold text-zinc-200 transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#B5945B]" />
            <span>
              Xem thêm {Math.min(12, allPhotosCount - visibleCount)} ảnh tiếp theo (còn{" "}
              {allPhotosCount - visibleCount} ảnh)
            </span>
          </button>
          <span className="text-[11px] text-zinc-500 font-sans">
            ✦ Cuộn xuống để tiếp tục trải nghiệm câu chuyện tác phẩm
          </span>
        </div>
      )}
    </div>
  );
};
