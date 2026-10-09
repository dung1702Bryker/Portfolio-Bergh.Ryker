import React, { useState } from "react";
import { Aperture, MapPin, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { SlideData } from "../types";
import { resolveImage } from "../utils/imageMapper";
import { ImageWithFallback } from "./ImageWithFallback";

interface MosaicGalleryProps {
  slide: SlideData;
}

export const MosaicGallery: React.FC<MosaicGalleryProps> = ({ slide }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const cardDetails = [
    {
      title: "Tốt Nghiệp Rực Rỡ",
      location: "Hà Nội Campus",
      gear: "Canon R6 II | 85mm L",
      category: "Tung mũ tốt nghiệp",
      aperture: "F/1.4",
      iso: "100",
    },
    {
      title: "Chân Dung Tân Cử Nhân",
      location: "Studio Chuyên Nghiệp",
      gear: "Sony A7 IV | 50mm GM",
      category: "Chân dung cao cấp",
      aperture: "F/1.2",
      iso: "50",
    },
    {
      title: "Phim Tài Liệu Khuôn Viên",
      location: "Melbourne Polytechnic",
      gear: "Canon R8 | 35mm L",
      category: "Campus Documentary",
      aperture: "F/2.0",
      iso: "400",
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full font-manrope">
      {/* Intro Header Section - Clean without harsh divider line */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="flex flex-col md:flex-row justify-between items-center md:items-end gap-3 sm:gap-4 pb-2 text-center md:text-left"
      >
        <div className="flex flex-col items-center md:items-start">
          <span className="font-sans text-xs sm:text-sm uppercase tracking-wider text-[#B5945B] mb-1.5 flex items-center justify-center md:justify-start gap-1.5 font-bold">
            <Sparkles className="w-4 h-4 text-optic-yellow" />
            ✦ {slide.subtitle || "EDITORIAL MOSAIC"} ✦
          </span>
          <h2 className="font-sans font-bold text-2xl min-[360px]:text-3xl md:text-5xl text-white tracking-tight leading-snug md:leading-[1.18] py-0.5">
            {slide.title}
          </h2>
        </div>
        <p className="text-zinc-200 text-xs sm:text-base max-w-md leading-relaxed font-normal text-center md:text-left">
          {slide.body}
        </p>
      </motion.div>

      {/* Apple Liquid Glass Collage Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 liquid-glass p-2 sm:p-4 rounded-2xl sm:rounded-3xl overflow-hidden shadow-none w-full border border-transparent"
      >
        {/* Large Left Photo (Spans 7 columns) */}
        <div
          className="lg:col-span-7 relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto min-h-[260px] sm:min-h-[300px] lg:min-h-[460px] rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer border border-white/10"
          onMouseEnter={() => setHoveredIdx(0)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <ImageWithFallback
            priority={false}
            preset="album"
            targetWidth={1600}
            quality={90}
            src={resolveImage(slide.images[0]?.src || "")}
            alt={slide.images[0]?.alt}
            sizes="(max-width: 1024px) 100vw, 60vw"
            style={{ objectPosition: slide.images[0]?.objectPosition || "center" }}
            className="w-full h-full object-cover filter brightness-100 group-hover:scale-105 transition-all duration-[900ms] ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 z-10 pointer-events-none" />

          {/* Sights and HUD - Apple Liquid Glass Pill */}
          <div className="absolute top-4 left-4 font-sans text-xs text-zinc-200 tracking-wider uppercase z-10 liquid-glass-btn px-3 py-1 rounded-full font-semibold">
            CAMERA 01 • EXP_9
          </div>

          {/* Interactive Core Details Card fading in at center - Liquid Glass */}
          <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6 z-20 liquid-glass-dark opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-12 h-12 rounded-full liquid-glass-btn flex items-center justify-center mb-3">
              <Aperture className="w-6 h-6 text-[#B5945B] animate-spin-slow" />
            </div>
            <span className="font-sans text-xs sm:text-sm text-[#B5945B] tracking-widest uppercase mb-1 font-bold">
              {cardDetails[0].category}
            </span>
            <h3 className="font-sans text-xl sm:text-2xl font-bold capitalize text-white tracking-tight">
              {cardDetails[0].title}
            </h3>
            <p className="font-sans text-xs sm:text-sm text-zinc-200 mt-2 flex items-center gap-1.5 justify-center font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#B5945B]" />
              <span>
                {cardDetails[0].location} · {cardDetails[0].gear}
              </span>
            </p>
          </div>

          {/* Standard Bottom Persistent Info when not hovered - Liquid Glass Floating Bar */}
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10 group-hover:opacity-0 transition-opacity liquid-glass-header px-4 py-3 rounded-2xl">
            <div>
              <span className="font-sans text-xs sm:text-sm text-[#B5945B] uppercase tracking-wider font-bold block">
                {cardDetails[0].category}
              </span>
              <h4 className="font-sans text-sm sm:text-base font-bold text-white mt-0.5">
                {cardDetails[0].title}
              </h4>
            </div>
            <span className="font-sans text-xs text-zinc-100 liquid-glass-btn px-3 py-1 rounded-full font-mono">
              {cardDetails[0].aperture} · ISO {cardDetails[0].iso}
            </span>
          </div>
        </div>

        {/* Right Columns (Spans 5 blocks) - Holds the Top Portrait and Bottom Landscape */}
        <div className="lg:col-span-5 grid grid-rows-2 gap-2.5 lg:min-h-[460px]">
          {/* Top Portrait Cell */}
          <div
            className="relative aspect-video lg:aspect-auto rounded-2xl overflow-hidden group cursor-pointer border border-white/10"
            onMouseEnter={() => setHoveredIdx(1)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <ImageWithFallback
              priority={false}
              preset="album"
              targetWidth={1200}
              quality={90}
              src={resolveImage(slide.images[1]?.src || "")}
              alt={slide.images[1]?.alt}
              sizes="(max-width: 1024px) 100vw, 40vw"
              style={{ objectPosition: slide.images[1]?.objectPosition || "center" }}
              className="w-full h-full object-cover filter brightness-100 group-hover:scale-105 transition-all duration-[900ms] ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 z-10 pointer-events-none" />

            <div className="absolute top-4 left-4 font-sans text-xs text-zinc-200 tracking-wider uppercase z-10 liquid-glass-btn px-3 py-1 rounded-full font-semibold">
              CAMERA 02 • PORTRAIT
            </div>

            {/* Interactive Overlay */}
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4 z-20 liquid-glass-dark opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="font-sans text-xs sm:text-sm text-[#B5945B] tracking-widest uppercase mb-1 font-bold">
                {cardDetails[1].category}
              </span>
              <h3 className="font-sans text-lg sm:text-xl font-bold capitalize text-white tracking-tight">
                {cardDetails[1].title}
              </h3>
              <p className="font-sans text-xs sm:text-sm text-zinc-200 mt-1 font-medium">
                {cardDetails[1].location} · {cardDetails[1].gear}
              </p>
            </div>

            {/* Bottom info banner */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-10 group-hover:opacity-0 transition-opacity liquid-glass-header px-3.5 py-2.5 rounded-xl">
              <div>
                <span className="font-sans text-xs sm:text-sm text-[#B5945B] uppercase tracking-wider font-bold block">
                  {cardDetails[1].category}
                </span>
                <h4 className="font-sans text-sm sm:text-base font-semibold text-white mt-0.5 truncate max-w-[150px] sm:max-w-none">
                  {cardDetails[1].title}
                </h4>
              </div>
              <span className="font-sans text-xs text-zinc-100 liquid-glass-btn px-2.5 py-1 rounded-full font-mono shrink-0">
                {cardDetails[1].aperture} · ISO {cardDetails[1].iso}
              </span>
            </div>
          </div>

          {/* Bottom Campus Landscape Cell */}
          <div
            className="relative aspect-video lg:aspect-auto rounded-2xl overflow-hidden group cursor-pointer border border-white/10"
            onMouseEnter={() => setHoveredIdx(2)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <ImageWithFallback
              priority={false}
              preset="album"
              targetWidth={1200}
              quality={90}
              src={resolveImage(slide.images[2]?.src || "")}
              alt={slide.images[2]?.alt}
              sizes="(max-width: 1024px) 100vw, 40vw"
              style={{ objectPosition: slide.images[2]?.objectPosition || "center" }}
              className="w-full h-full object-cover filter brightness-100 group-hover:scale-105 transition-all duration-[900ms] ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 z-10 pointer-events-none" />

            <div className="absolute top-4 left-4 font-sans text-xs text-zinc-200 tracking-wider uppercase z-10 liquid-glass-btn px-3 py-1 rounded-full font-semibold">
              CAMERA 03 • DOCUMENTARY
            </div>

            {/* Interactive Overlay */}
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-4 z-20 liquid-glass-dark opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="font-sans text-xs sm:text-sm text-[#B5945B] tracking-widest uppercase mb-1 font-bold">
                {cardDetails[2].category}
              </span>
              <h3 className="font-sans text-lg sm:text-xl font-bold capitalize text-white tracking-tight">
                {cardDetails[2].title}
              </h3>
              <p className="font-sans text-xs sm:text-sm text-zinc-200 mt-1 font-medium">
                {cardDetails[2].location} · {cardDetails[2].gear}
              </p>
            </div>

            {/* Bottom info banner */}
            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-10 group-hover:opacity-0 transition-opacity liquid-glass-header px-3.5 py-2.5 rounded-xl">
              <div>
                <span className="font-sans text-xs sm:text-sm text-[#B5945B] uppercase tracking-wider font-bold block">
                  {cardDetails[2].category}
                </span>
                <h4 className="font-sans text-sm sm:text-base font-semibold text-white mt-0.5 truncate max-w-[150px] sm:max-w-none">
                  {cardDetails[2].title}
                </h4>
              </div>
              <span className="font-sans text-xs text-zinc-100 liquid-glass-btn px-2.5 py-1 rounded-full font-mono shrink-0">
                {cardDetails[2].aperture} · ISO {cardDetails[2].iso}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
