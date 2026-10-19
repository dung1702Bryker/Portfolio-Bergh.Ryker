import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Booking } from "../../types";
import {
  generateBookingCode,
  generateQrDataUrl,
  downloadQrCodePng,
  generateMessengerConfirmationMessage,
  getPublicBookingBaseUrl,
  sanitizeBookingConfirmationLink,
  ensureValidPublicBookingUrl,
} from "../../utils/bookingQr";
import {
  QrCode,
  CheckCircle,
  Copy,
  ExternalLink,
  Download,
  MessageSquare,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
} from "lucide-react";

interface BookingConfirmationQrSectionProps {
  booking: Booking;
  onBookingUpdated?: (updated: Partial<Booking>) => void;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
}

export const BookingConfirmationQrSection: React.FC<
  BookingConfirmationQrSectionProps
> = ({ booking, onBookingUpdated, showToast }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>(booking.qrCodeUrl || "");
  const [copiedType, setCopiedType] = useState<
    "link" | "message" | "code" | null
  >(null);

  // Tính toán mã booking và link công khai chuẩn
  const currentCode = booking.bookingCode || booking.id;
  const baseUrl = getPublicBookingBaseUrl();
  const confirmationLink = sanitizeBookingConfirmationLink(
    booking.confirmationLink,
    currentCode
  );

  // Tự động tạo ảnh QR công khai chuẩn (hoặc tự sửa link nếu booking cũ bị dính aistudio / ais-dev-)
  useEffect(() => {
    let active = true;
    const isInvalidOldLink =
      booking.confirmationLink &&
      (booking.confirmationLink.includes("aistudio.google.com") ||
        booking.confirmationLink.includes("ais-dev-") ||
        booking.confirmationLink.includes("localhost") ||
        booking.confirmationLink.includes("127.0.0.1"));

    if (!qrDataUrl || isInvalidOldLink) {
      generateQrDataUrl(confirmationLink, 1200)
        .then((url) => {
          if (active) {
            setQrDataUrl(url);
            // Tự động cập nhật database nếu link cũ bị sai domain
            if (isInvalidOldLink) {
              updateDoc(doc(db, "bookings", booking.id), {
                confirmationLink,
                qrCodeUrl: url,
              }).catch(() => {});
            }
          }
        })
        .catch((err) => console.warn("Failed generating QR data url:", err));
    }
    return () => {
      active = false;
    };
  }, [confirmationLink, qrDataUrl, booking.confirmationLink, booking.id]);

  const copyToClipboard = (
    text: string,
    type: "link" | "message" | "code",
    successMsg: string
  ) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
      if (showToast) showToast(successMsg, "success");
    }
  };

  /**
   * Xác nhận đặt lịch:
   * - Đổi trạng thái booking thành "Đã duyệt" / "confirmed"
   * - Tạo hoặc cập nhật mã booking Code + link xác nhận + QR
   * - Ghi lại thời điểm xác nhận (confirmedAt)
   * - Tuyệt đối không gửi email, không gửi SMS, không gọi API bên thứ ba
   */
  const handleConfirmBooking = async () => {
    try {
      setIsProcessing(true);

      const bookingCode = booking.bookingCode || generateBookingCode();
      const newConfirmationLink = ensureValidPublicBookingUrl(
        `${baseUrl}/booking/${bookingCode}`,
        bookingCode
      );
      const newQrUrl = await generateQrDataUrl(newConfirmationLink, 1200);
      const confirmedAt = new Date().toLocaleString("vi-VN");

      const updates: Partial<Booking> = {
        status: "confirmed",
        bookingCode,
        confirmationLink: newConfirmationLink,
        qrCodeUrl: newQrUrl,
        confirmedAt,
        confirmationStatus: "link_created",
      };

      await updateDoc(doc(db, "bookings", booking.id), updates);

      setQrDataUrl(newQrUrl);
      if (onBookingUpdated) onBookingUpdated(updates);
      if (showToast)
        showToast(
          `Đã xác nhận đặt lịch cho ${booking.schoolName}! Link và mã QR đã sẵn sàng.`,
          "success"
        );
      setIsExpanded(true);
    } catch (err: any) {
      console.error("Confirm booking error:", err);
      if (showToast)
        showToast(
          err?.message || "Không thể xác nhận đặt lịch. Vui lòng thử lại.",
          "error"
        );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadQr = () => {
    if (qrDataUrl) {
      downloadQrCodePng(
        qrDataUrl,
        `bergh-ryker-booking-${currentCode}-qr.png`
      );
      if (showToast) showToast("Đã tải ảnh mã QR (1200x1200px) thành công!", "success");
    }
  };

  const handleCopyMessengerMessage = () => {
    const msg = generateMessengerConfirmationMessage(
      booking,
      confirmationLink
    );
    copyToClipboard(
      msg,
      "message",
      "Đã chép nội dung tin nhắn xác nhận Messenger!"
    );
  };

  // Trạng thái xác nhận
  const isConfirmed =
    booking.status === "Đã duyệt" ||
    booking.status === "confirmed" ||
    booking.status === "Đã xác nhận";

  const getConfirmationStatusBadge = () => {
    if (booking.confirmationStatus === "viewed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <Eye className="w-3 h-3" />
          Khách đã xem
        </span>
      );
    }
    if (booking.confirmationStatus === "link_created" || isConfirmed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
          <CheckCircle className="w-3 h-3" />
          Đã tạo link & QR
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
        <Clock className="w-3 h-3" />
        Chưa xác nhận
      </span>
    );
  };

  return (
    <div className="pt-2 border-t border-white/10 bg-zinc-950/70 p-2.5 rounded-lg text-left space-y-2">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-[#B5945B] shrink-0" />
          <span className="font-sans text-[11px] font-bold text-white uppercase tracking-wider">
            Xác nhận &amp; QR
          </span>
          {getConfirmationStatusBadge()}
        </div>

        <div className="flex items-center gap-1.5">
          {!isConfirmed && (
            <button
              type="button"
              onClick={handleConfirmBooking}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded bg-[#B5945B] hover:bg-[#a3844e] disabled:opacity-50 text-zinc-950 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-sm"
              title="Xác nhận lịch và sinh link QR"
            >
              <Sparkles className="w-3 h-3" />
              <span>Xác nhận lịch</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer rounded hover:bg-zinc-800"
            title={isExpanded ? "Thu gọn" : "Mở rộng chi tiết QR"}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details & Actions Area */}
      {isExpanded && (
        <div className="pt-2 space-y-3 animate-fadeIn">
          {/* Booking Code & Confirmation Link summary */}
          <div className="bg-zinc-900/90 border border-zinc-800 p-2.5 rounded-lg space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-400 font-sans">
                Mã booking:
              </span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-[12px] font-bold text-[#E5C17C] bg-zinc-950 px-2 py-0.5 rounded border border-zinc-700">
                  {currentCode}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      currentCode,
                      "code",
                      "Đã sao chép mã booking!"
                    )
                  }
                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                  title="Sao chép mã booking"
                >
                  {copiedType === "code" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-400 font-sans">
                Link xác nhận:
              </span>
              <span className="font-mono text-[11px] text-zinc-300 truncate max-w-[200px] sm:max-w-[280px]">
                {confirmationLink}
              </span>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/80">
              {/* Copy link */}
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(
                    confirmationLink,
                    "link",
                    "Đã copy link xác nhận đặt lịch!"
                  )
                }
                className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10.5px] font-medium transition-colors cursor-pointer"
              >
                {copiedType === "link" ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-400" />
                )}
                <span>Copy link xác nhận</span>
              </button>

              {/* Mở link xác nhận */}
              <a
                href={confirmationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10.5px] font-medium transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3 h-3 text-zinc-400" />
                <span>Mở link xác nhận</span>
              </a>

              {/* Copy tin nhắn xác nhận Messenger */}
              <button
                type="button"
                onClick={handleCopyMessengerMessage}
                className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-[10.5px] font-semibold transition-colors cursor-pointer"
                title="Tự động điền dữ liệu và copy tin nhắn gửi qua Messenger"
              >
                {copiedType === "message" ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <MessageSquare className="w-3 h-3 text-blue-300" />
                )}
                <span>Copy tin nhắn xác nhận</span>
              </button>
            </div>
          </div>

          {/* QR Code Visual Preview & Download */}
          <div className="flex items-center gap-3 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
            <div className="w-20 h-20 bg-white p-1 rounded-md shrink-0 flex items-center justify-center shadow-md">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR ${currentCode}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            <div className="flex-1 space-y-1.5">
              <div className="text-[11px] font-medium text-zinc-200">
                Mã QR chuẩn di động (1200px)
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Quét bằng camera điện thoại để mở thẳng trang xác nhận độc bản
                của khách.
              </p>
              <button
                type="button"
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#B5945B]/20 hover:bg-[#B5945B]/30 border border-[#B5945B]/40 text-[#E5C17C] text-[10.5px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Tải QR PNG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default BookingConfirmationQrSection;
