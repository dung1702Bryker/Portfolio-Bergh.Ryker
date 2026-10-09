import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  X,
  Sparkles,
  Camera,
  Palette,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  User,
  Users,
  MessageCircle,
  FileCheck,
  AlertCircle,
  FolderDown,
  RefreshCw,
  Share2,
} from "lucide-react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Booking, PhotoEditingStatus } from "../types";

interface PhotoProgressLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBookingId?: string;
  myBookingIds?: string[];
}

const STEPS: {
  status: PhotoEditingStatus;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    status: "pending",
    label: "1. Đã duyệt & Chờ chụp",
    shortLabel: "Chờ chụp",
    icon: Calendar,
    description: "Đơn đặt lịch đã được xác nhận, ekip sẵn sàng cho ngày bấm máy.",
  },
  {
    status: "shooting_done",
    label: "2. Chụp xong & Chọn ảnh",
    shortLabel: "Chọn ảnh",
    icon: Camera,
    description: "Buổi chụp đã hoàn tất xuất sắc, đang lọc và tuyển chọn file gốc.",
  },
  {
    status: "editing",
    label: "3. Hậu kỳ & Retouch",
    shortLabel: "Chỉnh sửa",
    icon: Palette,
    description: "Đang blend màu nghệ thuật, chỉnh sửa da, ánh sáng và chi tiết.",
  },
  {
    status: "reviewing",
    label: "4. Kiểm duyệt chất lượng",
    shortLabel: "Kiểm duyệt",
    icon: FileCheck,
    description: "Đội ngũ chuyên môn đang rà soát chất lượng ảnh trước khi xuất file.",
  },
  {
    status: "completed",
    label: "5. Hoàn thành & Bàn giao",
    shortLabel: "Bàn giao",
    icon: CheckCircle2,
    description: "Toàn bộ file ảnh đã sẵn sàng, bạn có thể tải về chất lượng cao nhất.",
  },
];

const getStepIndex = (status?: PhotoEditingStatus) => {
  if (!status || status === "pending") return 0;
  if (status === "shooting_done") return 1;
  if (status === "editing") return 2;
  if (status === "reviewing") return 3;
  if (status === "completed") return 4;
  return 0;
};

export const PhotoProgressLookupModal: React.FC<PhotoProgressLookupModalProps> = ({
  isOpen,
  onClose,
  initialBookingId = "",
  myBookingIds = [],
}) => {
  const [searchCode, setSearchCode] = useState(initialBookingId);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Sync initial code
  useEffect(() => {
    if (initialBookingId) {
      setSearchCode(initialBookingId);
      handleLookup(initialBookingId);
    }
  }, [initialBookingId, isOpen]);

  // Lookup function with real-time listener if found
  const handleLookup = async (codeToSearch: string) => {
    const trimmed = codeToSearch.trim().toUpperCase();
    if (!trimmed) {
      setError("Vui lòng nhập mã Ticket / Mã Booking của bạn");
      setBooking(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const docRef = doc(db, "bookings", trimmed);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data() as Booking;
        setBooking(data);

        // Update URL query parameter without reloading
        const url = new URL(window.location.href);
        url.searchParams.set("ticket", trimmed);
        window.history.replaceState({}, "", url.toString());
      } else {
        setBooking(null);
        setError(`Không tìm thấy đơn đặt lịch nào với mã "${trimmed}". Quý khách vui lòng kiểm tra lại mã trên Gmail xác nhận hoặc vé điện tử.`);
      }
    } catch (err: any) {
      console.error("[PhotoProgress] Lookup error:", err);
      setError("Không thể tải thông tin lúc này. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscription when booking is loaded
  useEffect(() => {
    if (!booking?.id || !isOpen) return;
    const unsub = onSnapshot(doc(db, "bookings", booking.id), (snap) => {
      if (snap.exists()) {
        setBooking(snap.data() as Booking);
      }
    });
    return () => unsub();
  }, [booking?.id, isOpen]);

  const currentStepIdx = getStepIndex(booking?.editingStatus);
  const progressPercent =
    booking?.editingProgress !== undefined
      ? booking.editingProgress
      : booking?.editingStatus === "completed"
        ? 100
        : booking?.editingStatus === "reviewing"
          ? 85
          : booking?.editingStatus === "editing"
            ? 55
            : booking?.editingStatus === "shooting_done"
              ? 25
              : 10;

  const handleCopyShareLink = () => {
    if (!booking) return;
    const url = new URL(window.location.origin);
    url.searchParams.set("ticket", booking.id);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopyTicket = () => {
    if (!booking) return;
    navigator.clipboard.writeText(booking.id).then(() => {
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-2xl liquid-glass-dark liquid-glass border border-white/15 rounded-3xl shadow-2xl p-5 sm:p-7 text-white my-auto overflow-hidden"
        >
          {/* Ambient lighting glow */}
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#B5945B]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors z-20 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="mb-5 text-left pr-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-[#B5945B]/15 border border-[#B5945B]/30 rounded-lg text-[#B5945B]">
                <Palette className="w-4 h-4" />
              </span>
              <span className="text-[11px] uppercase tracking-wider text-[#B5945B] font-bold">
                Cổng Theo Dõi Hậu Kỳ & Trả File
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
              Tiến Độ Chỉnh Sửa & Bàn Giao Ảnh
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1">
              Nhập mã vé đặt lịch để theo dõi tiến độ hậu kỳ và nhận link tải trọn bộ ảnh đã hoàn thiện.
            </p>
          </div>

          {/* Search Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLookup(searchCode);
            }}
            className="space-y-2 mb-5"
          >
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã Ticket (Ví dụ: BRBK_420362)..."
                className="w-full liquid-glass-input rounded-2xl pl-11 pr-24 py-3.5 text-sm text-white placeholder:text-zinc-400 font-mono tracking-wider transition-all uppercase"
              />
              <Search className="w-5 h-5 text-zinc-400 absolute left-3.5 pointer-events-none" />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-1.5 px-4 py-2 liquid-glass-gold-btn font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50 shadow-md"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Tra cứu"}
              </button>
            </div>

            {/* Quick Chips for local bookings */}
            {myBookingIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 pt-1">
                <span className="text-[11px] text-zinc-500">Đơn của bạn:</span>
                {myBookingIds.slice(-4).reverse().map((bid) => (
                  <button
                    key={bid}
                    type="button"
                    onClick={() => {
                      setSearchCode(bid);
                      handleLookup(bid);
                    }}
                    className={`font-mono text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      booking?.id === bid
                        ? "bg-[#B5945B]/20 text-[#B5945B] border-[#B5945B]/40 font-bold"
                        : "bg-white/5 text-zinc-300 border-white/10 hover:border-[#B5945B]/50 hover:text-white"
                    }`}
                  >
                    {bid}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Error notice */}
          {error && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl text-red-200 text-xs flex items-start gap-2.5 mb-5 text-left">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* Booking Content Found */}
          {booking && (
            <div className="space-y-5 text-left">
              {/* Top Summary Card */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wide">
                        {booking.id}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyTicket}
                        className="text-zinc-400 hover:text-[#B5945B] transition-colors p-1"
                        title="Sao chép mã"
                      >
                        {copiedTicket ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-[#B5945B] mt-0.5">
                      {booking.schoolName}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-sans tracking-wide uppercase ${
                        booking.editingStatus === "completed"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
                          : booking.editingStatus === "reviewing"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : booking.editingStatus === "editing"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : booking.editingStatus === "shooting_done"
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {STEPS[currentStepIdx].shortLabel}: {progressPercent}%
                    </span>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Gói Concept</span>
                    <span className="font-semibold text-zinc-200">{booking.conceptType}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Ngày chụp</span>
                    <span className="font-semibold text-zinc-200">
                      {booking.date ? booking.date.split("-").reverse().join("/") : "Chưa chọn"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Ca chụp</span>
                    <span className="font-semibold text-zinc-200">{booking.timeSlot || "Cả ngày"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">Quy mô</span>
                    <span className="font-semibold text-zinc-200">{booking.classSize || 1} người</span>
                  </div>
                </div>
              </div>

              {/* Progress Stepper */}
              <div className="bg-zinc-900/70 border border-white/10 rounded-xl p-4 sm:p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Quy Trình Thực Hiện
                  </span>
                  <span className="text-xs font-mono font-bold text-[#B5945B]">
                    {progressPercent}% HOÀN TẤT
                  </span>
                </div>

                {/* Progress bar line */}
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mb-5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      progressPercent === 100
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : "bg-gradient-to-r from-[#B5945B] to-amber-300"
                    }`}
                  />
                </div>

                {/* Step items */}
                <div className="grid grid-cols-5 gap-1 text-center">
                  {STEPS.map((step, idx) => {
                    const isPassed = idx <= currentStepIdx;
                    const isCurrent = idx === currentStepIdx;
                    const IconComp = step.icon;

                    return (
                      <div key={step.status} className="flex flex-col items-center">
                        <div
                          className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all ${
                            isCurrent
                              ? "bg-[#B5945B] text-black font-bold ring-4 ring-[#B5945B]/25 scale-110 shadow-lg"
                              : isPassed
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : "bg-zinc-800/80 text-zinc-500 border border-white/5"
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <span
                          className={`text-[10px] sm:text-[11px] font-sans mt-2 tracking-tight ${
                            isCurrent
                              ? "text-[#B5945B] font-bold"
                              : isPassed
                                ? "text-zinc-300 font-medium"
                                : "text-zinc-600"
                          }`}
                        >
                          {step.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Current Stage Description */}
                <div className="mt-4 p-3 bg-black/40 border border-white/5 rounded-lg text-xs flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#B5945B] mt-1 shrink-0 animate-ping" />
                  <div className="flex-1">
                    <strong className="text-white block font-medium">
                      {STEPS[currentStepIdx].label}
                    </strong>
                    <span className="text-zinc-400 text-[11px] sm:text-xs">
                      {STEPS[currentStepIdx].description}
                    </span>
                  </div>
                </div>

                {/* Estimated Delivery Date & Studio Notes */}
                {(booking.estimatedDeliveryDate || booking.editingNotes) && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5 text-xs">
                    {booking.estimatedDeliveryDate && (
                      <div className="flex items-center gap-2 text-amber-300">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Dự kiến bàn giao: <strong>{booking.estimatedDeliveryDate}</strong>
                        </span>
                      </div>
                    )}
                    {booking.editingNotes && (
                      <div className="flex items-start gap-2 text-zinc-300 text-[12px] bg-white/5 p-2.5 rounded-lg">
                        <span className="text-[#B5945B] font-bold shrink-0">Studio ghi chú:</span>
                        <span>{booking.editingNotes}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* DELIVERABLES & DOWNLOAD SECTION */}
              {booking.finalPhotosUrl ? (
                /* Completed Photos Available */
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-emerald-950/80 via-zinc-950 to-zinc-900 border-2 border-emerald-500/50 p-5 rounded-2xl shadow-xl shadow-emerald-950/30 text-center relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    File Đã Hoàn Thiện & Sẵn Sàng Tải
                  </span>

                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 font-sans">
                    Bộ Ảnh Của Bạn Đã Được Retouch Hoàn Tất! 🎉
                  </h3>
                  <p className="text-zinc-300 text-xs sm:text-sm max-w-md mx-auto mb-4 leading-relaxed">
                    Studio đã tải toàn bộ ảnh độ phân giải gốc cao nhất lên bộ nhớ lưu trữ an toàn. Bạn có thể mở link Google Drive dưới đây để tải về máy hoặc lưu trữ.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                    <a
                      href={booking.finalPhotosUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                    >
                      <FolderDown className="w-5 h-5" />
                      Mở Thư Mục Ảnh Hoàn Thiện
                      <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
                    </a>

                    {booking.rawPhotosUrl && (
                      <a
                        href={booking.rawPhotosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/15 text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 active:scale-95 transition-all cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-[#B5945B]" />
                        Xem File Gốc
                      </a>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-400 italic mt-3">
                    * Khuyên dùng: Nên tải ảnh về máy tính hoặc đồng bộ về tài khoản Google cá nhân để bảo toàn chất lượng ảnh cao nhất.
                  </p>
                </motion.div>
              ) : (
                /* Still in progress */
                <div className="bg-zinc-900/60 border border-white/10 p-4 rounded-xl text-center">
                  <div className="w-10 h-10 rounded-full bg-[#B5945B]/15 border border-[#B5945B]/30 flex items-center justify-center mx-auto mb-2 text-[#B5945B]">
                    <Palette className="w-5 h-5 animate-pulse" />
                  </div>
                  <h4 className="font-bold text-sm text-white mb-1">
                    Ảnh Đang Được Đội Ngũ Studio Hậu Kỳ Tỉ Mỉ
                  </h4>
                  <p className="text-zinc-400 text-xs max-w-md mx-auto leading-relaxed">
                    Sau khi hoàn thiện chỉnh màu và kiểm duyệt chất lượng, link tải trọn bộ file chất lượng cao sẽ tự động hiển thị trực tiếp tại mục này.
                  </p>

                  {booking.rawPhotosUrl && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <a
                        href={booking.rawPhotosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#B5945B] hover:underline font-medium"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Đã có link xem trước ảnh gốc (Bấm vào đây để xem)
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 transition-colors cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300 font-bold">Đã sao chép link tra cứu</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5 text-[#B5945B]" />
                      <span>Chia sẻ tiến độ cho lớp / bạn bè</span>
                    </>
                  )}
                </button>

                <a
                  href="https://zalo.me/0365266204"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-amber-400/90 hover:text-amber-300 font-medium py-1 px-2 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Cần hỗ trợ chỉnh ảnh? Zalo 0365.266.204
                </a>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
