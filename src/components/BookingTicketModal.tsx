import React, { useRef, useState } from "react";
import {
  X,
  Download,
  Copy,
  Check,
  Calendar,
  Share2,
  ExternalLink,
  Sparkles,
  MapPin,
  Clock,
  Camera,
  Users,
  ShieldCheck,
  MessageCircle,
  QrCode
} from "lucide-react";
import { Booking } from "../types";
import { useToast } from "../hooks/useToast";

interface BookingTicketModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BookingTicketModal: React.FC<BookingTicketModalProps> = ({
  booking,
  isOpen,
  onClose,
}) => {
  const { showToast } = useToast();
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const ticketCardRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !booking) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://bergh-ryker.ai.studio";
  const trackingUrl = `${origin}/?ticket=${encodeURIComponent(booking.id)}`;
  const dateFormatted = booking.date ? booking.date.split("-").reverse().join("/") : "(Chưa chọn ngày)";
  const isApproved =
    booking.status === "Đã duyệt" ||
    booking.status === "Đã khoá lịch" ||
    booking.hasConfirmedPayment === true;

  // Build formatted Facebook Messenger confirmation text
  const generateFacebookMessage = () => {
    const depositStatus = booking.hasConfirmedPayment
      ? `✅ ĐÃ XÁC NHẬN CỌC (${booking.amountPaid ? Number(booking.amountPaid).toLocaleString("vi-VN") + "đ" : "Hệ thống đã nhận"})`
      : "⏳ ĐANG CHỜ CỌC / THANH TOÁN KHI CHỤP";

    return (
`✨ BERGH.RYKER PHOTOGRAPHY STUDIO ✨
📸 XÁC NHẬN TIẾP NHẬN & KHOÁ LỊCH CHỤP THÀNH CÔNG

Kính chào ${booking.schoolName || "bạn"},
Studio đã cập nhật thông tin buổi chụp của bạn lên hệ thống quản lý lịch hẹn:

🎟️ MÃ ĐẶT LỊCH: ${booking.id}
🎯 Gói Concept: ${booking.conceptType || "Concept Chụp Ảnh"}
👥 Số lượng người: ${booking.classSize || 1} người
📅 Ngày chụp: ${dateFormatted}
⏰ Ca chụp: ${booking.timeSlot || "Cả ngày"}
📍 Địa điểm: ${booking.address || "Studio / Thỏa thuận"}
💰 Chi phí tạm tính: ${booking.estimatedCost || "Theo bảng giá hệ thống"}
💎 Trạng thái: ${depositStatus}
${booking.notes ? `📝 Ghi chú: ${booking.notes}\n` : ""}
🔗 TRA CỨU LỊCH HẸN & TIẾN ĐỘ ẢNH TRỰC TUYẾN:
${trackingUrl}
(Bạn có thể bấm vào link trên để xem chi tiết lịch hẹn, đếm ngược ngày chụp và tải file ảnh sau khi chụp xong nhé!)

💌 DẶN DÒ CHUẨN BỊ TRƯỚC NGÀY CHỤP:
- Vui lòng có mặt trước giờ hẹn 15-20 phút để chuẩn bị trang phục & makeup.
- Nếu cần thay đổi thời gian hoặc hỏi thêm trang phục/đạo cụ, bạn cứ nhắn trực tiếp tại đây hoặc gọi Hotline/Zalo: 0365.266.204.

Cảm ơn bạn đã tin chọn Bergh.Ryker Studio! Hẹn gặp bạn tại buổi chụp lung linh nhất nhé! 📸🎉`
    );
  };

  const handleCopyFacebookMessage = async () => {
    try {
      const msg = generateFacebookMessage();
      await navigator.clipboard.writeText(msg);
      setCopiedText(true);
      showToast("Đã sao chép lời nhắn Facebook! Bạn có thể dán (Paste) ngay vào khung chat với khách.", "success");
      setTimeout(() => setCopiedText(false), 2500);
    } catch (_) {
      showToast("Không thể sao chép lời nhắn. Vui lòng thử lại.", "error");
    }
  };

  const handleCopyTrackingLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopiedLink(true);
      showToast("Đã sao chép link tra cứu trực tuyến!", "success");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (_) {
      showToast("Không thể sao chép link.", "error");
    }
  };

  // Generate Google Calendar Link
  const handleOpenGoogleCalendar = () => {
    if (!booking.date) {
      showToast("Đơn chưa có ngày chụp cụ thể.", "warning");
      return;
    }
    const cleanDate = booking.date.replace(/-/g, "");
    const title = encodeURIComponent(`📸 Chụp ảnh kỷ yếu cùng Bergh.Ryker Studio (${booking.schoolName})`);
    const details = encodeURIComponent(
      `Mã đặt lịch: ${booking.id}\nConcept: ${booking.conceptType}\nCa chụp: ${booking.timeSlot || "Cả ngày"}\nĐịa điểm: ${booking.address || "Studio"}\nHotline: 0365.266.204\nXem chi tiết: ${trackingUrl}`
    );
    const location = encodeURIComponent(booking.address || "Bergh.Ryker Studio Hà Nội");
    const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${cleanDate}T010000Z/${cleanDate}T110000Z&details=${details}&location=${location}`;
    window.open(gCalUrl, "_blank", "noopener,noreferrer");
  };

  // Render high-res PNG pass card using pure HTML5 Canvas
  const drawTicketCanvas = (): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    const width = 1000;
    const height = 1280;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    // Background gradient - Luxury Matte Black
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0e0e11");
    bgGrad.addColorStop(0.5, "#141419");
    bgGrad.addColorStop(1, "#0a0a0c");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Gold border
    ctx.strokeStyle = "#B5945B";
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Inner thin border
    ctx.strokeStyle = "rgba(181, 148, 91, 0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Header Glow
    const headerGlow = ctx.createRadialGradient(width / 2, 90, 10, width / 2, 90, 250);
    headerGlow.addColorStop(0, "rgba(181, 148, 91, 0.18)");
    headerGlow.addColorStop(1, "rgba(181, 148, 91, 0)");
    ctx.fillStyle = headerGlow;
    ctx.fillRect(40, 40, width - 80, 180);

    // Brand Name
    ctx.fillStyle = "#E5C17C";
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BERGH.RYKER PHOTOGRAPHY STUDIO", width / 2, 95);

    // Subtitle
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "600 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("OFFICIAL PHOTOGRAPHY BOOKING PASS • THẺ XÁC NHẬN ĐẶT LỊCH", width / 2, 125);

    // Divider line
    ctx.strokeStyle = "rgba(181, 148, 91, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, 150);
    ctx.lineTo(width - 80, 150);
    ctx.stroke();

    // Status Badge
    const badgeText = isApproved ? "★ ĐÃ DUYỆT & KHOÁ LỊCH HẸN ★" : "★ YÊU CẦU ĐÃ TIẾP NHẬN ★";
    ctx.fillStyle = isApproved ? "rgba(16, 185, 129, 0.18)" : "rgba(245, 158, 11, 0.18)";
    ctx.fillRect(width / 2 - 200, 175, 400, 42);
    ctx.strokeStyle = isApproved ? "#10b981" : "#f59e0b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(width / 2 - 200, 175, 400, 42);

    ctx.fillStyle = isApproved ? "#34d399" : "#fbbf24";
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(badgeText, width / 2, 202);

    // Booking Code Box
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(80, 245, width - 160, 95);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.strokeRect(80, 245, width - 160, 95);

    ctx.textAlign = "left";
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("MÃ SỐ ĐẶT LỊCH (BOOKING TICKET ID)", 110, 275);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px 'Courier New', monospace";
    ctx.fillText(booking.id, 110, 315);

    ctx.textAlign = "right";
    ctx.fillStyle = "#B5945B";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(booking.conceptType || "Concept Chụp", width - 110, 285);
    ctx.fillStyle = "#d4d4d8";
    ctx.font = "14px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`${booking.classSize || 1} người tham gia`, width - 110, 312);

    // Details Grid Section
    const details = [
      { label: "KHÁCH HÀNG / TỔ CHỨC", val: booking.schoolName || "(Chưa rõ)" },
      { label: "NGÀY CHỤP (DỰ KIẾN)", val: dateFormatted },
      { label: "CA CHỤP / THỜI GIAN", val: booking.timeSlot || "Cả ngày (7h00 - 17h00)" },
      { label: "ĐỊA ĐIỂM CHỤP", val: booking.address || "Studio Bergh Ryker / Thỏa thuận" },
      { label: "LIÊN HỆ KHÁCH HÀNG", val: booking.instagramOrZalo || booking.phone || "(Đã ghi nhận trên hệ thống)" },
      { label: "TẠM TÍNH CHI PHÍ", val: booking.estimatedCost || "Theo bảng giá hệ thống" },
      {
        label: "TRẠNG THÁI THANH TOÁN",
        val: booking.hasConfirmedPayment
          ? `Đã nhận cọc: ${booking.amountPaid ? Number(booking.amountPaid).toLocaleString("vi-VN") + "đ" : "Hợp lệ"}`
          : "Chờ thanh toán / Thanh toán khi chụp",
      },
    ];

    let currentY = 380;
    ctx.textAlign = "left";
    details.forEach((item, index) => {
      // Row background
      if (index % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
        ctx.fillRect(80, currentY - 22, width - 160, 48);
      }

      ctx.fillStyle = "#a1a1aa";
      ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(item.label, 105, currentY + 6);

      ctx.fillStyle = index === 0 ? "#E5C17C" : "#ffffff";
      ctx.font = index === 0 ? "bold 17px -apple-system, BlinkMacSystemFont, sans-serif" : "600 15px -apple-system, BlinkMacSystemFont, sans-serif";
      
      // Truncate long value if needed
      let textVal = item.val;
      if (textVal.length > 45) {
        textVal = textVal.substring(0, 42) + "...";
      }
      ctx.fillText(textVal, 380, currentY + 6);

      currentY += 50;
    });

    // Notes Box if present
    if (booking.notes) {
      ctx.fillStyle = "rgba(181, 148, 91, 0.08)";
      ctx.fillRect(80, currentY, width - 160, 75);
      ctx.strokeStyle = "rgba(181, 148, 91, 0.3)";
      ctx.strokeRect(80, currentY, width - 160, 75);

      ctx.fillStyle = "#E5C17C";
      ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("LỜI NHẮN / GHI CHÚ CHUẨN BỊ:", 100, currentY + 25);

      ctx.fillStyle = "#d4d4d8";
      ctx.font = "italic 13px -apple-system, BlinkMacSystemFont, sans-serif";
      const noteCut = booking.notes.length > 90 ? booking.notes.substring(0, 87) + "..." : booking.notes;
      ctx.fillText(`"${noteCut}"`, 100, currentY + 52);

      currentY += 95;
    } else {
      currentY += 20;
    }

    // QR & Online Tracking Footer Box
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(80, currentY, width - 160, 160);
    ctx.strokeStyle = "rgba(181, 148, 91, 0.3)";
    ctx.strokeRect(80, currentY, width - 160, 160);

    // Decorative Barcode graphic on left
    ctx.fillStyle = "#B5945B";
    let barX = 110;
    const barHeights = [40, 60, 50, 60, 45, 60, 35, 60, 55, 60, 40, 60, 50, 45, 60, 55, 40, 60];
    for (let i = 0; i < 38; i++) {
      const h = barHeights[i % barHeights.length];
      const w = (i % 3 === 0) ? 3 : (i % 2 === 0) ? 2 : 1;
      ctx.fillRect(barX, currentY + 80 - h / 2, w, h);
      barX += w + 2;
    }

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.fillText(`PASS-${booking.id}`, 110, currentY + 130);

    // Tracking text on right
    ctx.textAlign = "left";
    ctx.fillStyle = "#E5C17C";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("TRA CỨU TRỰC TUYẾN & TIẾN ĐỘ ẢNH", 260, currentY + 45);

    ctx.fillStyle = "#ffffff";
    ctx.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`Truy cập: ${trackingUrl}`, 260, currentY + 75);

    ctx.fillStyle = "#71717a";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Theo dõi đồng hồ đếm ngược, danh sách ảnh chụp & tải file gốc tại link này.", 260, currentY + 100);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Hotline Studio: 0365.266.204 • Hà Nội", 260, currentY + 128);

    // Bottom copyright
    ctx.textAlign = "center";
    ctx.fillStyle = "#52525b";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Bergh.Ryker Photography Studio • Thẻ có giá trị xác nhận dịch vụ chính thức • Chúc bạn có buổi chụp tuyệt vời!", width / 2, height - 45);

    return canvas;
  };

  // Download high-res PNG image
  const handleDownloadImage = () => {
    try {
      setIsExporting(true);
      const canvas = drawTicketCanvas();
      const link = document.createElement("a");
      link.download = `BerghRyker_VeLichHen_${booking.id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("Đã tải thẻ vé ảnh PNG thành công! Bạn có thể gửi file ảnh này cho khách qua Facebook chat.", "success");
    } catch (err: any) {
      console.error("Export canvas error:", err);
      showToast("Lỗi khi tải ảnh: " + (err.message || err), "error");
    } finally {
      setIsExporting(false);
    }
  };

  // Copy Image directly to clipboard (so admin can just Ctrl+V into Facebook Messenger)
  const handleCopyImageToClipboard = async () => {
    try {
      setIsExporting(true);
      const canvas = drawTicketCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) {
          showToast("Không thể tạo dữ liệu ảnh để copy.", "error");
          setIsExporting(false);
          return;
        }
        try {
          // Clipboard Item Image support
          const item = new ClipboardItem({ "image/png": blob });
          await navigator.clipboard.write([item]);
          setCopiedImage(true);
          showToast("ĐÃ COPY ẢNH VÀO BỘ NHỚ TẠM! Hãy chuyển sang khung chat Facebook và bấm Ctrl+V để gửi ngay.", "success");
          setTimeout(() => setCopiedImage(false), 3000);
        } catch (clipErr: any) {
          // Fallback to regular download if browser disallows clipboard image write
          handleDownloadImage();
        } finally {
          setIsExporting(false);
        }
      }, "image/png");
    } catch (_) {
      handleDownloadImage();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-[#B5945B]/40 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#B5945B]/20 text-[#B5945B] rounded-xl border border-[#B5945B]/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base tracking-wide flex items-center gap-2">
                <span>Thẻ Xác Nhận Đặt Lịch Điện Tử (E-Ticket Pass)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Gửi qua Facebook
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Tải ảnh hoặc sao chép tin nhắn để gửi cho khách hàng trên Facebook Messenger
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Ticket Preview */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto overscroll-contain">
          {/* Card Visual Preview */}
          <div
            ref={ticketCardRef}
            className="relative bg-gradient-to-br from-zinc-900 via-black to-zinc-900 border-2 border-[#B5945B]/60 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-white overflow-hidden"
          >
            {/* Top golden accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#B5945B] to-transparent" />

            {/* Studio Header */}
            <div className="text-center space-y-1 pb-3 border-b border-white/10">
              <span className="text-[10px] uppercase tracking-[2px] text-[#B5945B] font-bold">
                Bergh.Ryker Photography Studio
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide">
                THẺ XÁC NHẬN ĐẶT LỊCH CHỤP ẢNH
              </h2>
              <p className="text-[11px] text-zinc-400 font-sans">
                Official Booking Confirmation Pass • Hà Nội
              </p>
            </div>

            {/* Status & Code Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-black/60 border border-white/10 rounded-xl p-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-semibold">
                  Mã Vé Đặt Lịch:
                </span>
                <span className="text-sm sm:text-base font-bold font-mono text-[#E5C17C]">
                  {booking.id}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    isApproved
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                  }`}
                >
                  {isApproved ? "✓ Đã Duyệt & Khoá Lịch" : "⏳ Chờ Duyệt Lịch"}
                </span>
              </div>
            </div>

            {/* Booking Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-zinc-400 text-[11px] block">Khách hàng / Trường lớp:</span>
                <strong className="text-white text-sm block mt-0.5 truncate">
                  {booking.schoolName || "(Chưa rõ)"}
                </strong>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <span className="text-zinc-400 text-[11px] block">Concept mong muốn:</span>
                <strong className="text-[#E5C17C] text-sm block mt-0.5">
                  {booking.conceptType || "Concept Chụp"}
                </strong>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#B5945B] shrink-0" />
                <div>
                  <span className="text-zinc-400 text-[11px] block">Ngày chụp dự kiến:</span>
                  <strong className="text-white text-xs block font-mono">{dateFormatted}</strong>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#B5945B] shrink-0" />
                <div>
                  <span className="text-zinc-400 text-[11px] block">Ca chụp / Thời gian:</span>
                  <strong className="text-white text-xs block">{booking.timeSlot || "Cả ngày"}</strong>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 sm:col-span-2 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#B5945B] shrink-0 mt-0.5" />
                <div>
                  <span className="text-zinc-400 text-[11px] block">Địa điểm chụp:</span>
                  <strong className="text-white text-xs block">{booking.address || "Studio Bergh Ryker / Thỏa thuận"}</strong>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#B5945B] shrink-0" />
                <div>
                  <span className="text-zinc-400 text-[11px] block">Số lượng tham gia:</span>
                  <strong className="text-white text-xs block">{booking.classSize || 1} người</strong>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-zinc-400 text-[11px] block">Trạng thái đặt cọc:</span>
                  <strong className="text-emerald-300 text-xs block">
                    {booking.hasConfirmedPayment
                      ? `Đã nhận cọc (${booking.amountPaid ? Number(booking.amountPaid).toLocaleString("vi-VN") + "đ" : "Hợp lệ"})`
                      : "Chờ cọc / Thanh toán khi chụp"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Tracking Link Bar */}
            <div className="bg-black/80 border border-[#B5945B]/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <QrCode className="w-4 h-4 text-[#B5945B] shrink-0" />
                <div className="min-w-0">
                  <span className="text-zinc-400 text-[10px] block">Link tra cứu tiến độ ảnh:</span>
                  <span className="text-[#E5C17C] font-mono text-[11px] truncate block">
                    {trackingUrl}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyTrackingLink}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 shrink-0"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? "Đã copy" : "Copy Link"}</span>
              </button>
            </div>
          </div>

          {/* Quick Copy Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* 1. Copy Facebook Message */}
            <button
              type="button"
              onClick={handleCopyFacebookMessage}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-600/20 to-blue-600/20 hover:from-sky-600/30 hover:to-blue-600/30 border border-sky-500/40 text-left transition cursor-pointer flex items-center gap-3 active:scale-[0.98]"
            >
              <div className="p-2.5 rounded-xl bg-sky-500/30 text-sky-300">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-xs text-white block">
                  {copiedText ? "✓ ĐÃ SAO CHÉP LỜI NHẮN!" : "Sao Chép Lời Nhắn Facebook"}
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  1-Click copy mẫu tin nhắn chuẩn icon để paste vào chat FB
                </span>
              </div>
            </button>

            {/* 2. Copy Image directly to Clipboard for instant FB paste */}
            <button
              type="button"
              onClick={handleCopyImageToClipboard}
              disabled={isExporting}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-[#B5945B]/20 to-amber-500/20 hover:from-[#B5945B]/30 hover:to-amber-500/30 border border-[#B5945B]/40 text-left transition cursor-pointer flex items-center gap-3 active:scale-[0.98] disabled:opacity-50"
            >
              <div className="p-2.5 rounded-xl bg-[#B5945B]/30 text-[#E5C17C]">
                <Copy className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-xs text-white block">
                  {copiedImage ? "✓ ĐÃ COPY ẢNH VÀO CLIPBOARD!" : "Copy Ảnh Vé Gửi Khách (Ctrl+V)"}
                </span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  Copy ảnh vào bộ nhớ tạm rồi dán thẳng vào Messenger
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-4 border-t border-white/10 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {/* Add to Google Calendar */}
            <button
              type="button"
              onClick={handleOpenGoogleCalendar}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              title="Thêm lịch hẹn vào Google Calendar"
            >
              <Calendar className="w-3.5 h-3.5 text-[#B5945B]" />
              <span>Thêm vào Lịch</span>
            </button>

            {/* Direct Tracking Page Button */}
            <a
              href={trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Mở Trang Tra Cứu</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            {/* Download PNG File */}
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B5945B] to-[#d4af37] hover:brightness-110 text-black text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-lg shadow-[#B5945B]/20 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? "Đang tạo ảnh..." : "Tải Ảnh Thẻ Vé (PNG)"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
