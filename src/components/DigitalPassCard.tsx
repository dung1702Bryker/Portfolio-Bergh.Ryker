import React, { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import {
  QrCode,
  Calendar,
  Clock,
  MapPin,
  Users,
  Copy,
  Check,
  Download,
  Share2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import {
  ensureValidPublicBookingUrl,
  getPublicBookingBaseUrl,
  createGoogleCalendarUrl,
  createGoogleMapsUrl,
  downloadQrCodePng,
} from "../utils/bookingQr";

export interface DigitalPassBookingInfo {
  id: string;
  bookingCode?: string;
  schoolName?: string;
  classSize?: number;
  date?: string;
  timeSlot?: string;
  conceptType?: string;
  instagramOrZalo?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  customRequest?: string;
  status?: string;
  deposit?: number;
  estimatedCost?: string;
  confirmationLink?: string;
  hasConfirmedPayment?: boolean;
  createdAt?: any;
}

interface DigitalPassCardProps {
  booking: DigitalPassBookingInfo;
  onClose?: () => void;
  isModal?: boolean;
}

export const DigitalPassCard: React.FC<DigitalPassCardProps> = ({
  booking,
  onClose,
  isModal = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const bookingCode = booking.bookingCode || booking.id || "BR-STUDIO";
  const publicBase = getPublicBookingBaseUrl();
  const confirmationUrl = ensureValidPublicBookingUrl(
    booking.confirmationLink,
    bookingCode
  );

  useEffect(() => {
    let isCancelled = false;
    const generate = async () => {
      try {
        const url = await QRCode.toDataURL(confirmationUrl, {
          width: 800,
          margin: 2,
          errorCorrectionLevel: "H",
          color: {
            dark: "#09090b",
            light: "#ffffff",
          },
        });
        if (!isCancelled) {
          setQrDataUrl(url);
        }
      } catch (err) {
        console.error("QR Generation error:", err);
      }
    };
    generate();
    return () => {
      isCancelled = true;
    };
  }, [confirmationUrl]);

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(confirmationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    if (qrDataUrl) {
      downloadQrCodePng(qrDataUrl, `bergh-ryker-pass-${bookingCode}.png`);
    }
  };

  const isDepositPaid =
    booking.hasConfirmedPayment ||
    booking.status === "Đã cọc" ||
    booking.status === "Đã chốt" ||
    booking.status === "Hoàn thành";

  const getConceptName = (concept?: string) => {
    if (concept === "THPT") return "Kỷ Yếu THPT";
    if (concept === "University") return "Pre-Graduation";
    if (concept === "Event") return "Prom & Sự Kiện";
    if (concept === "Custom") return "Concept Tự Do";
    return concept || "Chụp Ảnh Nghệ Thuật";
  };

  const formattedDate = booking.date
    ? booking.date.includes("-")
      ? booking.date.split("-").reverse().join("/")
      : booking.date
    : "Chờ xác nhận";

  const cardContent = (
    <div className="w-full flex justify-center px-3 sm:px-4 py-2 sm:py-3">
      <div
        ref={cardRef}
        className="relative w-full max-w-[390px] sm:max-w-[420px] mx-auto overflow-hidden rounded-[30px] sm:rounded-[36px] bg-[#0c0c0e]/95 backdrop-blur-2xl border border-[#B5945B]/35 text-white select-none transition-all duration-300"
        style={{
          boxShadow:
            "0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(181, 148, 91, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Visual Ambient Gold Highlight */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-[#B5945B]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-44 h-44 bg-[#E5C17C]/10 rounded-full blur-3xl pointer-events-none" />

        {/* TICKET TOP HEADER */}
        <div className="relative z-10 px-4 sm:px-6 pt-5 pb-4 border-b border-white/10 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#B5945B] to-[#7A5F32] p-[1px] shadow-lg shrink-0">
              <div className="w-full h-full rounded-2xl bg-zinc-950 flex items-center justify-center text-[#E5C17C]">
                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-nowrap">
                <span className="text-[9px] sm:text-[10px] font-sans font-bold uppercase tracking-[0.18em] text-[#E5C17C] whitespace-nowrap">
                  BERGH.RYKER
                </span>
                <span className="w-1 h-1 rounded-full bg-[#E5C17C] shrink-0" />
                <span className="text-[8px] sm:text-[9px] font-sans text-zinc-400 uppercase tracking-widest whitespace-nowrap">
                  STUDIO PASS
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase truncate mt-0.5">
                Thẻ Vé Điện Tử
              </h3>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isDepositPaid ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>ĐÃ XÁC NHẬN</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>CHỜ THANH TOÁN</span>
              </span>
            )}

            {isModal && onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* QR CODE CENTER APERTURE */}
        <div className="relative z-10 px-4 sm:px-6 py-5 sm:py-6 flex flex-col items-center justify-center text-center bg-black/25">
          <div className="relative p-2.5 sm:p-3 rounded-[26px] bg-gradient-to-b from-[#B5945B]/30 via-white/5 to-[#B5945B]/20 border border-[#B5945B]/40 shadow-2xl transition-transform duration-300 hover:scale-[1.02]">
            <div className="p-2 sm:p-2.5 rounded-[20px] bg-white shadow-inner flex items-center justify-center">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code ${bookingCode}`}
                  className="w-44 h-44 sm:w-52 sm:h-52 object-contain rounded-xl block select-none pointer-events-none"
                />
              ) : (
                <div className="w-44 h-44 sm:w-52 sm:h-52 flex flex-col items-center justify-center gap-2 bg-zinc-100 rounded-xl text-zinc-400">
                  <QrCode className="w-8 h-8 animate-spin text-[#B5945B]" />
                  <span className="text-[10px] font-sans font-medium">Đang tạo mã QR...</span>
                </div>
              )}
            </div>
          </div>

          {/* Scan Guide */}
          <p className="mt-3 text-[11px] text-zinc-400 font-sans tracking-wide flex items-center justify-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-[#E5C17C]" />
            <span>Quét bằng Camera để xem lịch trình & tải ảnh</span>
          </p>

          {/* Booking Code Pill */}
          <div className="mt-2.5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-[#B5945B]/30 text-xs font-bold text-[#E5C17C] tracking-wider shadow-sm">
            <span>MÃ: {bookingCode}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1 hover:text-white transition-colors cursor-pointer rounded-full"
              title="Sao chép link xác nhận"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* PERFORATED TICKET DIVIDER */}
        <div className="relative w-full h-5 flex items-center justify-between overflow-hidden my-0.5">
          <div className="w-6 h-6 rounded-full bg-[#070709] -ml-3 border border-[#B5945B]/30 shadow-inner" />
          <div className="flex-1 border-b-2 border-dashed border-white/15 mx-3" />
          <div className="w-6 h-6 rounded-full bg-[#070709] -mr-3 border border-[#B5945B]/30 shadow-inner" />
        </div>

        {/* BOOKING DETAILS GRID */}
        <div className="relative z-10 px-4 sm:px-6 py-4 space-y-2.5 font-sans text-xs">
          {/* Customer & Concept */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] min-w-0">
              <span className="text-[9px] sm:text-[10px] text-zinc-400 uppercase font-semibold block tracking-wider">
                Khách hàng / Lớp
              </span>
              <span className="text-white font-bold text-xs sm:text-sm truncate block mt-0.5">
                {booking.schoolName || "Khách Hàng Bergh.Ryker"}
              </span>
            </div>
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] min-w-0">
              <span className="text-[9px] sm:text-[10px] text-zinc-400 uppercase font-semibold block tracking-wider">
                Gói Concept
              </span>
              <span className="text-[#E5C17C] font-bold text-xs sm:text-sm truncate block mt-0.5">
                {getConceptName(booking.conceptType)}
              </span>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center gap-2 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-[#E5C17C] shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-zinc-400 uppercase font-semibold block">
                  Ngày Chụp
                </span>
                <span className="text-zinc-100 font-bold text-xs truncate block">{formattedDate}</span>
              </div>
            </div>
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-[#E5C17C] shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-zinc-400 uppercase font-semibold block">
                  Ca Chụp
                </span>
                <span className="text-zinc-100 font-bold text-xs truncate block">
                  {booking.timeSlot || "Cả ngày"}
                </span>
              </div>
            </div>
          </div>

          {/* Size & Location */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center gap-2 min-w-0">
              <Users className="w-3.5 h-3.5 text-[#E5C17C] shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-zinc-400 uppercase font-semibold block">
                  Số Lượng
                </span>
                <span className="text-zinc-100 font-bold text-xs truncate block">
                  {booking.classSize || 1} người
                </span>
              </div>
            </div>
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center gap-2 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-[#E5C17C] shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-zinc-400 uppercase font-semibold block">
                  Địa Điểm
                </span>
                <span className="text-zinc-100 font-bold text-xs truncate block">
                  {booking.address || "Hà Nội"}
                </span>
              </div>
            </div>
          </div>

          {/* Deposit info */}
          {booking.deposit !== undefined && booking.deposit > 0 && (
            <div className="flex items-center justify-between py-2 px-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20">
              <span className="text-emerald-300 text-[11px] font-medium">Tiền cọc giữ lịch:</span>
              <span className="font-sans font-bold text-emerald-200 text-xs sm:text-sm">
                {booking.deposit.toLocaleString("vi-VN")}đ
              </span>
            </div>
          )}
        </div>

        {/* ACTION BUTTONS DOCK */}
        <div className="relative z-10 px-4 sm:px-6 py-4 bg-black/45 border-t border-white/10 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-[#E5C17C]" />
              <span>Tải Mã QR</span>
            </button>

            <a
              href={createGoogleCalendarUrl({
                schoolName: booking.schoolName,
                conceptType: booking.conceptType,
                date: booking.date,
                timeSlot: booking.timeSlot,
                address: booking.address,
                notes: booking.notes,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5 text-[#E5C17C]" />
              <span>Thêm Lịch</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-[#DFB779] to-[#CFA25E] hover:brightness-110 text-zinc-950 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Đã Sao Chép Link" : "Sao Chép Link Vé"}</span>
            </button>

            <a
              href={confirmationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer shrink-0"
              title="Mở toàn màn hình xác nhận"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="w-full max-w-md my-auto"
        >
          {cardContent}
        </motion.div>
      </div>
    );
  }

  return cardContent;
};
