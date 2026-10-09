import React, { useMemo } from "react";
import { motion } from "motion/react";
import { SlideData } from "../types";

interface HeroLayoutProps {
  slide: SlideData;
  onExplorePortfolios?: () => void;
  onBookNow?: () => void;
}

export const HeroLayout: React.FC<HeroLayoutProps> = ({
  slide,
}) => {
  // Parse and separate title intelligently so "Portfolio Kỷ Yếu" and "& Sự kiện" sit on distinct, beautifully balanced lines
  const titleParts = useMemo(() => {
    const raw = (slide.title || "Portfolio Kỷ Yếu & Sự kiện").trim();
    if (raw.includes("&")) {
      const parts = raw.split("&");
      return {
        line1: parts[0].trim(),
        hasAmpersand: true,
        line2: parts.slice(1).join("&").trim(),
      };
    }
    return {
      line1: raw,
      hasAmpersand: false,
      line2: "",
    };
  }, [slide.title]);

  return (
    <div
      className="relative w-full flex items-center justify-center overflow-hidden py-8 sm:py-14 md:py-20 lg:py-24 px-3.5 sm:px-6 lg:px-12 bg-transparent min-h-[420px] sm:min-h-[500px] md:min-h-[560px]"
      id="viewfinder-hero"
    >
      {/* Master Container - Clean, centered, elegant editorial layout */}
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center relative z-10">
        {/* Main Title - Line 1: Portfolio Kỷ Yếu / Line 2: & Sự kiện (Đồng bộ 100% màu sắc, phông chữ và cỡ chữ) */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans font-extrabold text-3xl min-[360px]:text-4xl min-[480px]:text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight text-white leading-[1.15] sm:leading-[1.12] max-w-5xl text-center mb-5 sm:mb-8 px-2 select-none"
        >
          {titleParts.hasAmpersand ? (
            <span className="flex flex-col items-center justify-center gap-1.5 sm:gap-3">
              <span className="block whitespace-nowrap text-white font-extrabold">
                {titleParts.line1}
              </span>
              <span className="block whitespace-nowrap text-white font-extrabold">
                & {titleParts.line2}
              </span>
            </span>
          ) : (
            <span className="block text-white font-extrabold">
              {slide.title}
            </span>
          )}
        </motion.h1>

        {/* Subtext - Cỡ chữ to hơn, rõ nét, cân đối lấp kín khoảng trống dưới chân */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-zinc-100/90 text-sm min-[360px]:text-base sm:text-lg md:text-xl lg:text-2xl max-w-3xl lg:max-w-4xl leading-relaxed sm:leading-relaxed font-normal text-center px-3 sm:px-6 [text-wrap:balance]"
        >
          {slide.body}
        </motion.p>

        {/* Subtle Editorial Grounding Accent */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-6 sm:mt-8 flex items-center justify-center gap-2 sm:gap-3 text-zinc-400 text-xs sm:text-sm font-sans tracking-widest uppercase select-none"
        >
          <span className="w-6 sm:w-12 h-px bg-white/20" />
          <span className="text-[#E5C17C] font-semibold text-[11px] sm:text-xs tracking-[0.2em]">
            Bộ Sưu Tập Kỷ Yếu & Sự Kiện Độc Bản
          </span>
          <span className="w-6 sm:w-12 h-px bg-white/20" />
        </motion.div>
      </div>
    </div>
  );
};
