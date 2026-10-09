import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { ToastItem, ToastType, useToast, dismissToast } from "../hooks/useToast";

interface ToastContainerProps {
  toasts?: ToastItem[] | { id: string; message: string; type: any }[];
  isRoot?: boolean;
}

let globalContainerActive = false;

const typeConfig: Record<
  ToastType,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    borderClass: string;
    badgeClass: string;
    iconClass: string;
    progressClass: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    label: "Thành công",
    borderClass: "border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 to-zinc-950/90",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    iconClass: "text-emerald-400",
    progressClass: "bg-emerald-500",
  },
  error: {
    icon: AlertCircle,
    label: "Lỗi hệ thống",
    borderClass: "border-rose-500/30 bg-gradient-to-r from-rose-950/40 to-zinc-950/90",
    badgeClass: "bg-rose-500/20 text-rose-400 border border-rose-500/30",
    iconClass: "text-rose-400",
    progressClass: "bg-rose-500",
  },
  warning: {
    icon: AlertTriangle,
    label: "Cảnh báo",
    borderClass: "border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-zinc-950/90",
    badgeClass: "bg-amber-500/20 text-[#B5945B] border border-amber-500/30",
    iconClass: "text-[#B5945B]",
    progressClass: "bg-[#B5945B]",
  },
  info: {
    icon: Info,
    label: "Thông báo",
    borderClass: "border-sky-500/30 bg-gradient-to-r from-sky-950/40 to-zinc-950/90",
    badgeClass: "bg-sky-500/20 text-sky-400 border border-sky-500/30",
    iconClass: "text-sky-400",
    progressClass: "bg-sky-400",
  },
  loading: {
    icon: Loader2,
    label: "Đang xử lý...",
    borderClass: "border-[#B5945B]/40 bg-gradient-to-r from-zinc-900 to-zinc-950/95",
    badgeClass: "bg-[#B5945B]/20 text-[#B5945B] border border-[#B5945B]/30",
    iconClass: "text-[#B5945B] animate-spin",
    progressClass: "bg-[#B5945B]",
  },
};

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts: propToasts,
}) => {
  const { toasts: storeToasts } = useToast();

  // Use store toasts by default; fall back to propToasts if explicitly provided and store is empty
  const activeToasts =
    storeToasts.length > 0
      ? storeToasts
      : (propToasts as ToastItem[]) || [];

  if (activeToasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      id="global-toast-container"
      className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[999999] flex flex-col gap-2.5 pointer-events-none max-w-sm sm:max-w-md w-[calc(100vw-32px)] sm:w-auto"
    >
      <AnimatePresence mode="popLayout">
        {activeToasts.map((toastItem, toastIdx) => {
          const type = (toastItem.type || "info") as ToastType;
          const config = typeConfig[type] || typeConfig.info;
          const Icon = config.icon;
          const duration = toastItem.duration ?? 4000;

          return (
            <motion.div
              key={`toast-${toastItem.id}`}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 450, damping: 30 }}
              className={`pointer-events-auto relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl p-3.5 text-zinc-100 ${config.borderClass}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${config.badgeClass}`}
                >
                  <Icon className={`w-4 h-4 ${config.iconClass}`} />
                </div>

                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-semibold opacity-90">
                      {toastItem.title || config.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => dismissToast(toastItem.id)}
                      className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      title="Đóng thông báo"
                      aria-label="Đóng"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs font-sans text-zinc-200 leading-relaxed break-words whitespace-pre-line">
                    {toastItem.message}
                  </p>
                </div>
              </div>

              {/* Progress bar indicating time remaining */}
              {duration > 0 && type !== "loading" && (
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: duration / 1000, ease: "linear" }}
                  className={`absolute bottom-0 left-0 h-[2px] opacity-70 ${config.progressClass}`}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
