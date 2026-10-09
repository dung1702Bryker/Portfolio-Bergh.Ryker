import React from"react";
import { motion } from"motion/react";
import {
 Heart,
 ZoomIn,
 ChevronLeft,
 ChevronRight,
 Image,
 Pause,
 Play,
} from"lucide-react";
import { CustomCollection } from"../hooks/usePortfolioData";
import { resolveImage } from "../utils/imageMapper";
import { getPictureSources } from "../utils/imageOptimizer";

interface GalleryViewerProps {
 activeCollection: CustomCollection | null;
 selectedIndex: number;
 setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
 isAutoplay: boolean;
 setIsAutoplay: React.Dispatch<React.SetStateAction<boolean>>;
 setIsLightboxOpen: (isOpen: boolean) => void;
 favorites: Record<string, boolean>;
 toggleFavorite: (e: React.MouseEvent, photoIdx: number) => void;
}

export const GalleryViewer: React.FC<GalleryViewerProps> = ({
 activeCollection,
 selectedIndex,
 setSelectedIndex,
 isAutoplay,
 setIsAutoplay,
 setIsLightboxOpen,
 favorites,
 toggleFavorite,
}) => {
 if (!activeCollection) return null;

 const handlePrevImage = () => {
 if (activeCollection.images.length === 0) return;
 setSelectedIndex((prev) =>
 prev === 0 ? activeCollection.images.length - 1 : prev - 1,
 );
 };

 const handleNextImage = () => {
 if (activeCollection.images.length === 0) return;
 setSelectedIndex((prev) =>
 prev === activeCollection.images.length - 1 ? 0 : prev + 1,
 );
 };

 const currentFavoriteKey = `${activeCollection.id}-${selectedIndex}`;
 const isSelectedFavorite = favorites[currentFavoriteKey] || false;

 return (
 <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-2xl relative shadow-md group">
 <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-gray-950 flex items-center justify-center">
 {activeCollection.images[selectedIndex] ? (() => {
 const rawSrc = resolveImage(activeCollection.images[selectedIndex].src);
 const sources = getPictureSources(rawSrc);
 const displayImg = sources.defaultSrc || rawSrc;
 return (
 <>
 <img
 src={displayImg}
 alt=""
 aria-hidden="true"
 className="absolute inset-0 w-full h-full object-cover filter blur-2xl scale-125 opacity-25 pointer-events-none select-none z-0"
 />
 <picture className="w-full h-full flex items-center justify-center relative z-10">
 {sources.isOptimizable && sources.webpSrcSet && (
 <source
 type="image/webp"
 srcSet={sources.webpSrcSet}
 sizes="(max-width: 1024px) 100vw, 1200px"
 />
 )}
 {sources.isOptimizable && sources.fallbackSrcSet && (
 <source
 type="image/jpeg"
 srcSet={sources.fallbackSrcSet}
 sizes="(max-width: 1024px) 100vw, 1200px"
 />
 )}
 <motion.img
 key={`gallery-viewer-img-${activeCollection.id}-${selectedIndex}`}
 initial={{ opacity: 0.4, scale: 1.02 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.35 }}
 drag="x"
 dragConstraints={{ left: 0, right: 0 }}
 dragElastic={0.7}
 onDragEnd={(_event, info) => {
 const swipeThreshold = 50;
 if (info.offset.x < -swipeThreshold) handleNextImage();
 else if (info.offset.x > swipeThreshold) handlePrevImage();
 }}
 onClick={() => setIsLightboxOpen(true)}
 src={sources.defaultSrc || rawSrc}
 alt={activeCollection.images[selectedIndex].alt}
 className="max-w-full max-h-full w-auto h-auto object-contain select-none cursor-grab active:cursor-grabbing"
 referrerPolicy="no-referrer"
 loading="lazy"
 decoding="async"
 />
 </picture>
 </>
 );
 })() : (
 <div className="flex flex-col items-center justify-center text-gray-400 gap-2 py-10">
 <Image className="w-10 h-10 stroke-1"/>
 <span className="text-xs font-sans">Khung hình trống</span>
 </div>
 )}

 <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25 pointer-events-none"/>

 <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
 <button
 onClick={(e) => toggleFavorite(e, selectedIndex)}
 className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-md text-white hover:text-red-500 hover:scale-105 active:scale-95 transition-all cursor-pointer"
 title="Yêu thích khung hình này"
 >
 <Heart
 className={`w-4 h-4 ${isSelectedFavorite ?"fill-red-500 text-red-500":"text-white/80"}`}
 />
 </button>

 <button
 onClick={() => setIsLightboxOpen(true)}
 className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-md text-white hover:text-[#B5945B] hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer font-bold text-[12px]"
 >
 <ZoomIn className="w-4 h-4 text-white"/>
 <span className="hidden sm:inline font-sans text-[11px] tracking-wide text-white">
 Xem full
 </span>
 </button>
 </div>

 <button
 onClick={handlePrevImage}
 title="Trang trước"
 aria-label="Trang trước"
 className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-[#B5945B]/90 backdrop-blur-sm text-white transition-all cursor-pointer z-10"
 >
 <ChevronLeft className="w-5 h-5"/>
 </button>

 <button
 onClick={handleNextImage}
 title="Trang sau"
 aria-label="Trang sau"
 className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/40 hover:bg-[#B5945B]/90 backdrop-blur-sm text-white transition-all cursor-pointer z-10"
 >
 <ChevronRight className="w-5 h-5"/>
 </button>

 <div className="absolute bottom-4 left-4 right-4 z-10 text-left text-white">
 <h5 className="font-sans font-bold text-sm text-white truncate max-w-xs sm:max-w-md">
 {activeCollection.images[selectedIndex]?.title ||"Bộ ảnh kỷ yếu"}
 </h5>
 </div>
 </div>

 <div className="flex items-center justify-between mt-3 px-1 text-xs">
 <button
 onClick={() => setIsAutoplay(!isAutoplay)}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer text-[11px] font-sans font-medium capitalize tracking-wide ${
 isAutoplay
 ?"bg-amber-500/20 text-amber-300 border-amber-500/40"
 :"bg-[#101012]/80 text-gray-300 border-white/10 hover:bg-[#151518]"
 }`}
 >
 {isAutoplay ? (
 <Pause className="w-3 h-3 text-red-400 fill-red-400"/>
 ) : (
 <Play className="w-3 h-3 text-emerald-400 fill-emerald-400"/>
 )}
 <span>{isAutoplay ?"Đang chiếu tự động":"Tự động chạy"}</span>
 </button>

 <div className="flex items-center gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-xs scrollbar-none py-1">
 {activeCollection.images.map((_, idx) => (
 <button
 key={`gallery-dot-${activeCollection.id}-${idx}`}
 onClick={() => {
 setSelectedIndex(idx);
 setIsAutoplay(false);
 }}
 className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${selectedIndex === idx ?"w-5 bg-[#B5945B]":"w-2 bg-white/30 hover:bg-white/55"}`}
 />
 ))}
 </div>

 <div className="text-[12px] text-gray-300 font-sans font-bold">
 {selectedIndex + 1} / {activeCollection.images.length} ảnh
 </div>
 </div>
 </div>
 );
};
