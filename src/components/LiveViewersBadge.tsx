import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Radio,
  Eye,
  Smartphone,
  Laptop,
  Globe,
  Sparkles,
  ShieldCheck,
  X,
  Clock,
  Compass,
} from "lucide-react";
import { ActiveVisitor } from "../types/presence";
import { sanitizeDeviceLabel } from "../services/visitorHistoryService";

interface LiveViewersBadgeProps {
  activeVisitors: ActiveVisitor[];
  activeCount: number;
  currentVisitorId?: string;
  variant?: "pill" | "button" | "card";
  className?: string;
}

export const LiveViewersBadge: React.FC<LiveViewersBadgeProps> = ({
  activeVisitors,
  activeCount,
  currentVisitorId,
  variant = "pill",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getDeviceIcon = (deviceStr: string) => {
    if (deviceStr.includes("Phone") || deviceStr.includes("Android") || deviceStr.includes("iOS")) {
      return <Smartphone className="w-3.5 h-3.5 text-amber-400" />;
    }
    return <Laptop className="w-3.5 h-3.5 text-sky-400" />;
  };

  return (
    <>
      {/* TRIGGER BUTTON / PILL */}
      {variant === "pill" && (
        <button
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-lg shadow-emerald-950/30 transition-all hover:scale-105 cursor-pointer group ${className}`}
          title="Xem danh sách người đang xem trang web trực tiếp"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>

          <span className="font-bold tracking-tight">
            {activeCount} người đang xem trực tiếp
          </span>

          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 ml-0.5">
            Live
          </span>
        </button>
      )}

      {variant === "button" && (
        <button
          onClick={() => setIsOpen(true)}
          className={`px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-950/80 to-zinc-900 border border-emerald-500/40 text-white text-xs font-bold flex items-center gap-2 hover:border-emerald-400/60 transition-all cursor-pointer shadow-md ${className}`}
        >
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </div>
          <span>Ai Đang Xem ({activeCount})</span>
        </button>
      )}

      {/* LIVE VIEWERS POPUP / MODAL */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-zinc-950 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden z-10 max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-950 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Ai Đang Xem Web Trực Tiếp</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Live Presence
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Hiện có <strong className="text-emerald-400">{activeCount}</strong> người đang trực tuyến trên hệ thống
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Viewers List */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3 divide-y divide-white/5 flex-1">
                {activeVisitors.length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-xs space-y-2">
                    <Users className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p>Đang kết nối tín hiệu người xem trực tiếp...</p>
                  </div>
                ) : (
                  activeVisitors.map((visitor, idx) => {
                    const isSelf = visitor.id === currentVisitorId;
                    const isAdmin = visitor.role === "admin";

                    return (
                      <div
                        key={`viewer-${visitor.id || 'vis'}-${idx}`}
                        className={`pt-3 first:pt-0 p-3 rounded-xl transition-all ${
                          isSelf
                            ? "bg-emerald-950/20 border border-emerald-500/20"
                            : "bg-zinc-900/40 hover:bg-zinc-900/70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Avatar */}
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                isAdmin
                                  ? "bg-gradient-to-br from-amber-500 to-yellow-600 text-zinc-950 shadow-md ring-1 ring-amber-300"
                                  : isSelf
                                  ? "bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400"
                                  : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {isAdmin ? "👑" : idx + 1}
                            </div>

                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-sm truncate">
                                  {visitor.visitorName}
                                </span>

                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Bạn
                                  </span>
                                )}

                                {isAdmin && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" /> Quản Trị Viên
                                  </span>
                                )}
                              </div>

                              {/* Current Page / Activity */}
                              <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                                <Compass className="w-3.5 h-3.5 text-[#B5945B] shrink-0" />
                                <span className="font-medium text-[#B5945B] truncate">
                                  {visitor.currentPage}
                                </span>
                                {visitor.currentViewDetail && (
                                  <>
                                    <span className="text-zinc-600">•</span>
                                    <span className="text-zinc-400 truncate">
                                      {visitor.currentViewDetail}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Device & Browser info */}
                              <div className="flex items-center gap-3 text-[11px] text-zinc-500 pt-0.5">
                                <span className="flex items-center gap-1">
                                  {getDeviceIcon(sanitizeDeviceLabel(visitor.device))}
                                  <span>{sanitizeDeviceLabel(visitor.device)}</span>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3 text-zinc-400" />
                                  <span>{visitor.browser}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Online status indicator */}
                          <div className="flex flex-col items-end shrink-0">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              Online
                            </span>
                            <span className="text-[10px] text-zinc-500 mt-1">
                              Vừa hoạt động
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer info note */}
              <div className="p-3.5 border-t border-white/10 bg-zinc-900/60 text-center text-[11px] text-zinc-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <Sparkles className="w-3.5 h-3.5 text-[#B5945B]" />
                  Đồng bộ tức thì theo thời gian thực (Real-time Firestore)
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
