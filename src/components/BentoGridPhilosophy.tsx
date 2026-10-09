import React from "react";
import { motion } from "motion/react";
import { SlideData } from "../types";

interface BentoGridPhilosophyProps {
  slide: SlideData;
}

export const BentoGridPhilosophy: React.FC<BentoGridPhilosophyProps> = ({
  slide,
}) => {
  return (
    <div className="flex justify-center items-center w-full font-manrope">
      {/* Editorial Text Block - centered and beautifully presented */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-3xl flex flex-col items-center justify-center text-center liquid-glass-card liquid-glass p-6 sm:p-10 md:p-16 rounded-3xl shadow-2xl relative overflow-hidden group border border-white/15 min-h-[320px]"
      >
        <div className="py-2">
          <span className="font-sans text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#B5945B] mb-3 block">
            {slide.subtitle}
          </span>
          <h2 className="font-sans font-bold text-2xl sm:text-3xl md:text-4xl text-white tracking-tight mb-4 sm:mb-6 leading-snug md:leading-[1.2] py-0.5">
            {slide.title}
          </h2>
          <p className="text-zinc-200 text-base md:text-lg leading-relaxed font-normal">
            {slide.body}
          </p>
        </div>
      </motion.div>
    </div>
  );
};
