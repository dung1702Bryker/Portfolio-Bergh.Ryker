import React from "react";
import { Eye, TrendingUp } from "lucide-react";
import { formatViewCount } from "../services/analyticsService";

interface SectionViewBadgeProps {
  views: number;
  label?: string;
  isPopular?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showIcon?: boolean;
}

export const SectionViewBadge: React.FC<SectionViewBadgeProps> = ({
  views,
  label = "lượt xem",
  isPopular = false,
  size = "sm",
  className = "",
  showIcon = true,
}) => {
  const formatted = formatViewCount(views);

  const sizeClasses = {
    xs: "text-[10px] px-2 py-0.5 gap-1",
    sm: "text-[11px] px-2.5 py-0.5 gap-1.5",
    md: "text-xs px-3 py-1 gap-2",
    lg: "text-sm px-3.5 py-1.5 gap-2",
  }[size];

  return (
    <div
      className={`inline-flex items-center rounded-full bg-zinc-950/80 border border-white/10 text-zinc-300 font-sans font-medium backdrop-blur-md transition-all shadow-sm select-none ${sizeClasses} ${className}`}
      title={`${views} ${label}`}
    >
      {showIcon && <Eye className={`${size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} text-[#B5945B] shrink-0`} />}
      <span className="font-semibold text-white tracking-tight">{formatted}</span>
      {label && <span className="text-zinc-400 font-normal">{label}</span>}

      {isPopular && (
        <span className="inline-flex items-center gap-0.5 ml-0.5 pl-1 border-l border-white/10 text-[9px] text-amber-400 font-semibold tracking-wide uppercase">
          <TrendingUp className="w-2.5 h-2.5 text-amber-400" />
          <span>Hot</span>
        </span>
      )}
    </div>
  );
};
