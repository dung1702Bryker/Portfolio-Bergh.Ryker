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
      className="relative w-full flex items-center justify-center overflow-hidden py-4 sm:py-12 md:py-16 lg:py-20 px-3.5 sm:px-6 lg:px-12 bg-transparent min-h-0 sm:min-h-[460px]"
      id="viewfinder-hero"
    >
      {/* Master Container - Clean, centered, elegant editorial layout */}
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center relative z-10">
        {/* Main Title - Compact on mobile, elegant on desktop */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans font-extrabold text-2xl min-[360px]:text-3xl min-[480px]:text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight text-white leading-tight sm:leading-[1.12] max-w-5xl text-center mb-3 sm:mb-6 px-2 select-none"
        >
          {titleParts.hasAmpersand ? (
            <span className="flex flex-col items-center justify-center gap-1 sm:gap-2.5">
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

        {/* Subtext - Compact on mobile to reveal background photos */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-zinc-100/90 text-xs min-[360px]:text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl lg:max-w-4xl leading-relaxed font-normal text-center px-2 sm:px-6 [text-wrap:balance]"
        >
          {slide.body}
        </motion.p>

        {/* Subtle Editorial Grounding Accent */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-3 sm:mt-6 flex items-center justify-center gap-2 sm:gap-3 text-zinc-400 text-xs sm:text-sm font-sans tracking-widest uppercase select-none"
        >
          <span className="w-5 sm:w-12 h-px bg-white/20" />
          <span className="text-[#E5C17C] font-semibold text-[10px] sm:text-xs tracking-[0.18em]">
            Bộ Sưu Tập Kỷ Yếu & Sự Kiện Độc Bản
          </span>
          <span className="w-5 sm:w-12 h-px bg-white/20" />
        </motion.div>
      </div>
    </div>
  );
};
