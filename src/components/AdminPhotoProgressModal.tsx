import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Palette,
  CheckCircle2,
  Calendar,
  Camera,
  FileCheck,
  Link as LinkIcon,
  Clock,
  Sparkles,
  Save,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { Booking, PhotoEditingStatus } from "../types";

interface AdminPhotoProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onSaveProgress: (bookingId: string, data: Partial<Booking>) => Promise<void>;
}

export const AdminPhotoProgressModal: React.FC<AdminPhotoProgressModalProps> = ({
  isOpen,
  onClose,
  booking,
  onSaveProgress,
}) => {
  const [editingStatus, setEditingStatus] = useState<PhotoEditingStatus>("pending");
  const [editingProgress, setEditingProgress] = useState<number>(0);
  const [finalPhotosUrl, setFinalPhotosUrl] = useState<string>("");
  const [rawPhotosUrl, setRawPhotosUrl] = useState<string>("");
  const [editingNotes, setEditingNotes] = useState<string>("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (booking) {
      setEditingStatus(booking.editingStatus || "pending");
      setEditingProgress(booking.editingProgress ?? (booking.editingStatus === "completed" ? 100 : 0));
      setFinalPhotosUrl(booking.finalPhotosUrl || "");
      setRawPhotosUrl(booking.rawPhotosUrl || "");
      setEditingNotes(booking.editingNotes || "");
      setEstimatedDeliveryDate(booking.estimatedDeliveryDate || "");
    }
  }, [booking, isOpen]);

  if (!isOpen || !booking) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveProgress(booking.id, {
        editingStatus,
        editingProgress,
        finalPhotosUrl: finalPhotosUrl.trim(),
        rawPhotosUrl: rawPhotosUrl.trim(),
        editingNotes: editingNotes.trim(),
        estimatedDeliveryDate: estimatedDeliveryDate.trim(),
        editingUpdatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      console.error("[AdminPhotoProgress] Error saving progress:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickComplete = () => {
    setEditingStatus("completed");
    setEditingProgress(100);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-zinc-950 border border-[#B5945B]/40 rounded-2xl shadow-2xl p-4 sm:p-6 text-white my-auto overflow-hidden text-left"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-4 pr-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-[#B5945B]/20 text-[#B5945B] border border-[#B5945B]/30 rounded-lg">
                <Palette className="w-4 h-4" />
              </span>
              <span className="text-[11px] uppercase tracking-wider text-[#B5945B] font-bold">
                Quản Trị Tiến Độ Hậu Kỳ & Trả Ảnh
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white font-sans">
              Cập Nhật Tiến Độ: {booking.schoolName}
            </h2>
            <p className="text-zinc-400 text-xs mt-0.5">
              Mã vé: <span className="font-mono text-[#B5945B] font-bold">{booking.id}</span> • Concept: {booking.conceptType} • Ngày chụp: {booking.date ? booking.date.split("-").reverse().join("/") : "Chưa chọn"}
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Editing Status Selector */}
            <div>
              <label className="block text-zinc-300 font-bold mb-1.5 uppercase text-[11px]">
                Giai Đoạn Hậu Kỳ Hiện Tại
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {[
                  { id: "pending", label: "Chờ chụp", icon: Calendar },
                  { id: "shooting_done", label: "Đã chụp / Chọn ảnh", icon: Camera },
                  { id: "editing", label: "Đang chỉnh sửa", icon: Palette },
                  { id: "reviewing", label: "Kiểm duyệt file", icon: FileCheck },
                  { id: "completed", label: "Đã hoàn thành", icon: CheckCircle2 },
                ].map((s) => {
                  const isSelected = editingStatus === s.id;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setEditingStatus(s.id as PhotoEditingStatus);
                        if (s.id === "completed" && editingProgress < 100) setEditingProgress(100);
                        if (s.id === "editing" && editingProgress === 0) setEditingProgress(50);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#B5945B]/20 border-[#B5945B] text-white font-bold shadow-md shadow-amber-500/10"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-[#B5945B]" : "text-zinc-500"}`} />
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progress Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-zinc-300 font-bold uppercase text-[11px]">
                  Tiến Độ Hoàn Thành: <span className="font-mono text-[#B5945B] text-sm">{editingProgress}%</span>
                </label>
                <div className="flex gap-1">
                  {[25, 50, 75, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setEditingProgress(preset);
                        if (preset === 100) setEditingStatus("completed");
                        else if (preset >= 50 && editingStatus === "pending") setEditingStatus("editing");
                      }}
                      className="text-[10px] px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded font-mono text-zinc-400 hover:text-white"
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={editingProgress}
                onChange={(e) => setEditingProgress(parseInt(e.target.value, 10))}
                className="w-full accent-[#B5945B] bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Deliverable URLs */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-emerald-300 font-bold mb-1 uppercase text-[11px] flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5" />
                  Link File Ảnh Đã Hoàn Thiện (Google Drive / Cloud Folder) *
                </label>
                <input
                  type="url"
                  value={finalPhotosUrl}
                  onChange={(e) => setFinalPhotosUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full bg-white/5 border border-emerald-500/40 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 font-sans transition-all"
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Khách hàng tra cứu mã sẽ thấy nút tải toàn bộ file này khi hoàn tất.
                </span>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 text-[11px] flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#B5945B]" />
                  Link Ảnh Gốc Preview (Tuỳ chọn)
                </label>
                <input
                  type="url"
                  value={rawPhotosUrl}
                  onChange={(e) => setRawPhotosUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/... (Link ảnh gốc nếu có)"
                  className="w-full bg-white/5 border border-white/10 focus:border-[#B5945B] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 font-sans transition-all"
                />
              </div>
            </div>

            {/* Estimated Delivery & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-zinc-300 font-medium mb-1 text-[11px] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Ngày Dự Kiến Bàn Giao
                </label>
                <input
                  type="text"
                  value={estimatedDeliveryDate}
                  onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                  placeholder="VD: 15/10/2026 hoặc 3-5 ngày tới"
                  className="w-full bg-white/5 border border-white/10 focus:border-[#B5945B] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 font-sans transition-all"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1 text-[11px] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                  Ghi Chú Tiến Độ Cho Khách
                </label>
                <input
                  type="text"
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  placeholder="VD: Đã blend màu xong 50 ảnh..."
                  className="w-full bg-white/5 border border-white/10 focus:border-[#B5945B] rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 font-sans transition-all"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleQuickComplete}
                className="px-3 py-2 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/90 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Đánh dấu Hoàn tất 100%
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-[#B5945B] hover:bg-[#c4a46a] text-black font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/10 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Đang lưu..." : "Lưu Tiến Độ"}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
