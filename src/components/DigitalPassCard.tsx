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
    booking.confirmationLink || `${publicBase}/booking/${bookingCode}`,
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
    <div
      ref={cardRef}
      className="relative w-full max-w-md mx-auto overflow-hidden rounded-3xl liquid-glass border border-white/10 text-white select-none transition-all duration-300"
      style={{
        boxShadow:
          "0 30px 80px rgba(0, 0, 0, 0.7), 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
      }}
    >
      {/* Visual Ambient Gold Highlight on Top */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#B5945B]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#E5C17C]/10 rounded-full blur-3xl pointer-events-none" />

      {/* TICKET TOP HEADER */}
      <div className="relative z-10 px-6 pt-6 pb-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#B5945B] to-[#7A5F32] p-[1px] shadow-lg">
            <div className="w-full h-full rounded-2xl bg-zinc-950 flex items-center justify-center text-[#E5C17C]">
              <Camera className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-[#E5C17C]">
                BERGH.RYKER
              </span>
              <span className="w-1 h-1 rounded-full bg-[#E5C17C]" />
              <span className="text-[9px] font-sans text-zinc-400 uppercase tracking-widest">
                STUDIO PASS
              </span>
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Thẻ Vé Điện Tử
            </h3>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isDepositPaid ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              ĐÃ XÁC NHẬN
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3 h-3" />
              CHỜ THANH TOÁN
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
      <div className="relative z-10 px-6 py-6 flex flex-col items-center justify-center text-center bg-black/20">
        <div className="relative p-3.5 rounded-3xl bg-white shadow-2xl border-4 border-[#B5945B]/40 group transition-transform duration-300 hover:scale-[1.02]">
          {/* Decorative Corner Aperture Marks */}
          <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#B5945B]" />
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#B5945B]" />
          <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#B5945B]" />
          <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#B5945B]" />

          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code ${bookingCode}`}
              className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-xl block select-none pointer-events-none"
            />
          ) : (
            <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center gap-2 bg-zinc-100 rounded-xl text-zinc-400">
              <QrCode className="w-8 h-8 animate-spin text-[#B5945B]" />
              <span className="text-[10px] font-mono">Đang tạo mã QR...</span>
            </div>
          )}
        </div>

        {/* Scan Guide */}
        <p className="mt-3.5 text-[11px] text-zinc-400 font-sans tracking-wide flex items-center justify-center gap-1.5">
          <QrCode className="w-3.5 h-3.5 text-[#E5C17C]" />
          <span>Quét bằng Camera để xem lịch trình & tải ảnh</span>
        </p>

        {/* Booking Code Pill */}
        <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono font-bold text-[#E5C17C]">
          <span>MÃ: {bookingCode}</span>
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1 hover:text-white transition-colors cursor-pointer"
            title="Sao chép link xác nhận"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* PERFORATED TICKET DIVIDER */}
      <div className="relative w-full h-4 flex items-center justify-between px-[-12px] overflow-hidden my-1">
        <div className="w-5 h-5 rounded-full bg-[#050505] -ml-2.5 border border-white/10" />
        <div className="flex-1 border-b-2 border-dashed border-white/15 mx-2" />
        <div className="w-5 h-5 rounded-full bg-[#050505] -mr-2.5 border border-white/10" />
      </div>

      {/* BOOKING DETAILS GRID */}
      <div className="relative z-10 px-6 py-4 space-y-3 font-sans text-xs">
        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-white/10">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-semibold block tracking-wider">
              Khách hàng / Lớp
            </span>
            <span className="text-white font-bold text-sm truncate block mt-0.5">
              {booking.schoolName || "Khách Hàng Bergh.Ryker"}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-semibold block tracking-wider">
              Gói Concept
            </span>
            <span className="text-[#E5C17C] font-bold text-sm block mt-0.5">
              {getConceptName(booking.conceptType)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#E5C17C] shrink-0" />
            <div>
              <span className="text-[9px] text-zinc-500 uppercase font-semibold block">
                Ngày Chụp
              </span>
              <span className="text-zinc-200 font-bold text-xs">{formattedDate}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#E5C17C] shrink-0" />
            <div>
              <span className="text-[9px] text-zinc-500 uppercase font-semibold block">
                Ca Chụp
              </span>
              <span className="text-zinc-200 font-bold text-xs truncate">
                {booking.timeSlot || "Cả ngày"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#E5C17C] shrink-0" />
            <div>
              <span className="text-[9px] text-zinc-500 uppercase font-semibold block">
                Số Lượng
              </span>
              <span className="text-zinc-200 font-bold text-xs">
                {booking.classSize || 1} người
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#E5C17C] shrink-0" />
            <div>
              <span className="text-[9px] text-zinc-500 uppercase font-semibold block">
                Địa Điểm
              </span>
              <span className="text-zinc-200 font-bold text-xs truncate block max-w-[130px]">
                {booking.address || "Hà Nội"}
              </span>
            </div>
          </div>
        </div>

        {/* Deposit & Pricing info */}
        {booking.deposit !== undefined && booking.deposit > 0 && (
          <div className="flex items-center justify-between py-1 bg-black/30 px-3 rounded-xl border border-white/5">
            <span className="text-zinc-400 text-[11px]">Tiền cọc giữ lịch:</span>
            <span className="font-mono font-bold text-[#E5C17C] text-xs">
              {booking.deposit.toLocaleString("vi-VN")}đ
            </span>
          </div>
        )}
      </div>

      {/* ACTION BUTTONS DOCK */}
      <div className="relative z-10 p-5 bg-black/40 border-t border-white/10 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownloadQr}
            className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
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
            className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Calendar className="w-3.5 h-3.5 text-[#E5C17C]" />
            <span>Thêm Lịch</span>
          </a>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#B5945B] hover:bg-[#a3844e] text-zinc-950 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Đã Sao Chép Link" : "Sao Chép Link Vé"}</span>
          </button>

          <a
            href={confirmationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Mở toàn màn hình xác nhận"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
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
