import React, { useState } from "react";
import {
  Lightbulb,
  Map,
  Camera,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { SlideData } from "../types";

interface WorkflowBentoProps {
  slide: SlideData;
}

export const WorkflowBento: React.FC<WorkflowBentoProps> = ({ slide }) => {
  const [hoveredPhase, setHoveredPhase] = useState<number | null>(null);

  const stepsDetails = slide.steps || [
    {
      step: "Bước 1",
      title: "Khảo Sát & Tư Vấn",
      desc: "Lắng nghe ý tưởng sáng tạo và lên phác thảo Concept phù hợp với chất riêng của trường lớp.",
    },
    {
      step: "Bước 2",
      title: "Timeline & Lộ Trình",
      desc: "Chốt sơ đồ di chuyển chi tiết từng điểm chụp, phân bổ thời gian hợp lý tối ưu ánh sáng tự nhiên.",
    },
    {
      step: "Bước 3",
      title: "Bấm Máy & Hậu Trường",
      desc: "Thực hiện buổi chụp đầy năng lượng với trang bị cao cấp, bắt trọn từng khoảnh khắc tự nhiên.",
    },
    {
      step: "Bước 4",
      title: "Hậu Kỳ & Bàn Giao",
      desc: "Color grading độc bản từng khung hình, bàn giao thư viện ảnh chất lượng gốc siêu tốc.",
    },
  ];

  const phaseMeta = [
    {
      icon: <Lightbulb className="w-6 h-6 text-opticYellow" />,
      advice: "Chuẩn bị mẫu ảnh, áo lớp tự chọn sẵn trước 2 tuần",
      duration: "Thời gian: 3-5 ngày",
    },
    {
      icon: <Map className="w-6 h-6 text-cyanOptic" />,
      advice: "Kế hoạch đón bình minh sân trường / giữ xe thầy cô hỗ trợ",
      duration: "Thời gian: 1 ngày",
    },
    {
      icon: <Camera className="w-6 h-6 text-white" />,
      advice: "Ánh sáng đẹp nhất lúc 14:30 - Chạy liên hoàn outdoor",
      duration: "Thời gian: 1-2 ngày",
    },
    {
      icon: <Sparkles className="w-6 h-6 text-opticYellow animate-pulse" />,
      advice: "Đã bao gồm ảnh in gỗ cao cấp & file tải drive trọn đời",
      duration: "Thời gian: Tối đa 7 ngày",
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full font-manrope">
      {/* Intro Header banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-metallic pb-4">
        <div>
          <span className="font-sans text-xs sm:text-sm font-semibold uppercase tracking-wider text-emerald-400 mb-1.5 block">
            {slide.subtitle}
          </span>
          <h2 className="font-sans font-bold text-3xl md:text-5xl text-white tracking-tight leading-snug md:leading-[1.2] py-0.5">
            {slide.title}
          </h2>
        </div>
        <p className="text-zinc-200 text-sm sm:text-base max-w-lg leading-relaxed font-normal">
          {slide.body}
        </p>
      </div>

      {/* Bento Grid - 4 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {stepsDetails.map((item, i) => (
          <div
            key={`step-${item.num || i}-${i}`}
            onMouseEnter={() => setHoveredPhase(i)}
            onMouseLeave={() => setHoveredPhase(null)}
            className="group liquid-glass-card liquid-glass border border-white/15 hover:border-[#B5945B]/60 hover:shadow-[0_12px_36px_rgba(181,148,91,0.18)] p-5 sm:p-6 rounded-3xl transition-all duration-500 flex flex-col justify-between min-h-[280px] relative overflow-hidden shadow-xl"
          >
            {/* Viewfinder Decorative corner */}
            <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute top-2 right-2 w-2.5 h-2.5 border-t border-r border-[#B5945B]" />
            </div>

            <div>
              {/* Box Header containing Phase number and Icon */}
              <div className="flex justify-between items-center mb-5 sm:mb-6">
                <span className="font-sans text-xs uppercase tracking-wider text-zinc-300 liquid-glass-btn px-2.5 py-1 rounded-full border border-white/15 font-semibold">
                  PHASE_0{i + 1}
                </span>
                <div className="p-2 bg-white/5 rounded-xl border border-white/15 group-hover:border-[#B5945B]/40 transition-colors">
                  {phaseMeta[i].icon}
                </div>
              </div>

              {/* Step name */}
              <span className="text-xs sm:text-sm text-[#00D4FF] font-sans font-semibold tracking-wide block mb-1">
                {item.step}
              </span>
              <h3 className="font-sans font-bold text-base sm:text-lg uppercase text-white tracking-wide group-hover:text-opticYellow transition-colors flex items-center gap-2">
                {item.title}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 mt-2.5 leading-relaxed font-normal">
                {item.desc}
              </p>
            </div>

            {/* Bottom metadata or interactive quick recommendation tip */}
            <div className="mt-6 pt-4 border-t border-white/5 relative z-10">
              {hoveredPhase === i ? (
                <div className="text-xs sm:text-sm text-opticYellow font-sans leading-relaxed bg-[#E2FF00]/5 p-2 rounded border border-opticYellow/10 animate-fade-in-quick">
                  ▲ Tip: {phaseMeta[i].advice}
                </div>
              ) : (
                <div className="flex justify-between items-center text-xs sm:text-sm font-sans text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" /> Thống nhất ý tưởng
                  </span>
                  <span className="text-cyanOptic font-medium">
                    {phaseMeta[i].duration}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
