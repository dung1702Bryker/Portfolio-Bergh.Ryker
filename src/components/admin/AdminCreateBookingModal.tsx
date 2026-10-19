import React, { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { Booking } from "../../types";
import {
  generateBookingCode,
  generateQrDataUrl,
  downloadQrCodePng,
  generateMessengerConfirmationMessage,
  getPublicBookingBaseUrl,
  ensureValidPublicBookingUrl,
} from "../../utils/bookingQr";
import {
  X,
  PlusCircle,
  Copy,
  ExternalLink,
  Download,
  MessageSquare,
  Sparkles,
  Check,
  Calendar,
  Clock,
  MapPin,
  Users,
  Phone,
  FileText,
} from "lucide-react";

interface AdminCreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
  onBookingCreated?: (booking: Booking) => void;
}

export const AdminCreateBookingModal: React.FC<AdminCreateBookingModalProps> = ({
  isOpen,
  onClose,
  showToast,
  onBookingCreated,
}) => {
  const [schoolName, setSchoolName] = useState("");
  const [phone, setPhone] = useState("");
  const [conceptType, setConceptType] = useState<"THPT" | "University" | "Event" | "Custom">("THPT");
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("07:30 - 11:30 (Sáng)");
  const [customTime, setCustomTime] = useState("");
  const [classSize, setClassSize] = useState<number>(30);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [autoConfirm, setAutoConfirm] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [createdQrUrl, setCreatedQrUrl] = useState<string>("");
  const [copiedType, setCopiedType] = useState<"link" | "message" | "code" | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setSchoolName("");
    setPhone("");
    setConceptType("THPT");
    setDate("");
    setTimeSlot("07:30 - 11:30 (Sáng)");
    setCustomTime("");
    setClassSize(30);
    setAddress("");
    setNotes("");
    setAutoConfirm(true);
    setCreatedBooking(null);
    setCreatedQrUrl("");
    setCopiedType(null);
  };

  const copyToClipboard = (text: string, type: "link" | "message" | "code", successMsg: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
      if (showToast) showToast(successMsg, "success");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) {
      if (showToast) showToast("Vui lòng nhập tên khách hàng hoặc lớp/trường!", "error");
      return;
    }
    if (!date) {
      if (showToast) showToast("Vui lòng chọn ngày chụp!", "error");
      return;
    }

    try {
      setIsSubmitting(true);

      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      // Tự động sinh mã booking định dạng BR-2026-X7Y9
      const bookingCode = generateBookingCode();
      const origin = getPublicBookingBaseUrl();
      const confirmationLink = ensureValidPublicBookingUrl(
        `${origin}/booking/${bookingCode}`,
        bookingCode
      );
      const qrUrl = await generateQrDataUrl(confirmationLink, 1200);
      const confirmedAt = autoConfirm ? new Date().toLocaleString("vi-VN") : undefined;

      const finalTimeSlot = timeSlot === "Khác" && customTime.trim() ? customTime.trim() : timeSlot;

      const newBooking: Booking = {
        id: bookingId,
        bookingCode,
        confirmationLink,
        qrCodeUrl: qrUrl,
        schoolName: schoolName.trim(),
        phone: phone.trim() || undefined,
        conceptType,
        date,
        timeSlot: finalTimeSlot,
        classSize: Number(classSize) || 1,
        address: address.trim() || undefined,
        notes: notes.trim() ? notes.trim() : "Nhập trực tiếp từ Facebook Messenger",
        instagramOrZalo: phone.trim() || "Facebook Messenger",
        status: autoConfirm ? "confirmed" : "Chờ duyệt",
        confirmationStatus: autoConfirm ? "link_created" : "not_sent",
        confirmedAt: confirmedAt || null,
        source: "admin_messenger",
        createdAt: serverTimestamp(),
      };

      // 1. Lưu vào Firestore document `bookings/{bookingId}`
      await setDoc(doc(db, "bookings", bookingId), newBooking);

      // 2. Tự động đánh dấu ngày đã đặt trong `availableDates`
      if (date) {
        try {
          await setDoc(
            doc(db, "availableDates", date),
            { date, status: "booked" },
            { merge: true }
          );
        } catch (dateErr) {
          console.warn("Could not mark availableDates:", dateErr);
        }
      }

      setCreatedBooking(newBooking);
      setCreatedQrUrl(qrUrl);
      if (onBookingCreated) onBookingCreated(newBooking);
      if (showToast) {
        showToast(
          `Đã tạo và lưu thành công booking ${bookingCode} cho ${schoolName}!`,
          "success"
        );
      }
    } catch (err: any) {
      console.error("Create booking error:", err);
      if (showToast) {
        showToast(err?.message || "Có lỗi khi lưu booking vào database.", "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-2xl text-zinc-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#B5945B]/20 border border-[#B5945B]/40 flex items-center justify-center text-[#B5945B]">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-white tracking-wide">
                Nhập Booking Mới (Messenger)
              </h2>
              <p className="text-[11px] text-zinc-400">
                Tự động sinh mã booking, link xác nhận công khai &amp; mã QR chất lượng cao
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* State 1: Success Banner & QR Tools */}
        {createdBooking ? (
          <div className="space-y-5 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Check className="w-3.5 h-3.5" />
                <span>Đã lưu &amp; xác nhận booking thành công!</span>
              </div>
              <h3 className="text-lg font-serif font-bold text-white pt-1">
                {createdBooking.schoolName}
              </h3>
              <p className="text-xs text-zinc-300">
                Mã booking:{" "}
                <span className="font-mono text-[#E5C17C] font-bold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700">
                  {createdBooking.bookingCode}
                </span>
              </p>
            </div>

            {/* QR Preview & Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
              <div className="sm:col-span-5 flex flex-col items-center">
                <div className="w-40 h-40 bg-white p-2 rounded-xl flex items-center justify-center shadow-lg border-2 border-[#B5945B]/40">
                  {createdQrUrl ? (
                    <img
                      src={createdQrUrl}
                      alt="QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 mt-1.5 font-mono">
                  Quét bằng camera điện thoại
                </span>
              </div>

              <div className="sm:col-span-7 space-y-2">
                {/* 1. Copy tin nhắn Messenger */}
                <button
                  type="button"
                  onClick={() => {
                    const msg = generateMessengerConfirmationMessage(
                      createdBooking,
                      createdBooking.confirmationLink || ""
                    );
                    copyToClipboard(
                      msg,
                      "message",
                      "Đã sao chép tin nhắn xác nhận Messenger!"
                    );
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  {copiedType === "message" ? (
                    <Check className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  <span>Copy tin nhắn xác nhận Messenger</span>
                </button>

                {/* 2. Tải QR PNG */}
                <button
                  type="button"
                  onClick={() => {
                    if (createdQrUrl) {
                      downloadQrCodePng(
                        createdQrUrl,
                        `bergh-ryker-${createdBooking.bookingCode}-qr.png`
                      );
                      if (showToast)
                        showToast("Đã tải ảnh mã QR (1200px) thành công!", "success");
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#B5945B] hover:bg-[#a3844e] text-zinc-950 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải QR PNG (1200px)</span>
                </button>

                {/* 3. Copy link xác nhận */}
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      createdBooking.confirmationLink || "",
                      "link",
                      "Đã chép link xác nhận!"
                    )
                  }
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  {copiedType === "link" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span>Copy link xác nhận</span>
                </button>

                {/* 4. Mở link xác nhận */}
                <a
                  href={createdBooking.confirmationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Mở link xác nhận</span>
                </a>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              >
                + Nhập thêm booking khác
              </button>

              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-[#B5945B] hover:bg-[#a3844e] text-zinc-950 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          /* State 2: Booking Input Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tên khách / Trường lớp */}
            <div>
              <label className="block text-[11px] font-sans text-zinc-300 font-medium uppercase tracking-wider mb-1">
                Tên khách hàng / Trường - Lớp *
              </label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="VD: THPT Chu Văn An - Lớp 12A1 (hoặc Chị Mai Lan)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#B5945B] text-white text-xs outline-none transition-all placeholder:text-zinc-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Số điện thoại */}
              <div>
                <label className="block text-[11px] font-sans text-zinc-300 font-medium uppercase tracking-wider mb-1">
                  Số điện thoại liên hệ
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0912 345 678"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#B5945B] text-white text-xs outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Concept Type */}
              <div>
                <label className="block text-[11px] font-sans text-zinc-300 font-medium uppercase tracking-wider mb-1">
                  Gói dịch vụ / Concept
                </label>
                <select
                  value={conceptType}
                  onChange={(e) => setConceptType(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#B5945B] text-white text-xs outline-none transition-all cursor-pointer"
                >
                  <option value="THPT">Kỷ Yếu THPT</option>
                  <option value="University">Kỷ Yếu Đại Học</option>
                  <option value="Event">Sự Kiện &amp; Tiệc</option>
                  <option value="Custom">Concept Riêng (Custom)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Ngày chụp */}
              <div>
                <label className="block text-[11px] font-sans text-zinc-300 font-medium uppercase tracking-wider mb-1">
                  Ngày chụp *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#B5945B] text-white text-xs outline-none transition-all"
                  />
                </div>
              </div>

              {/* Khung giờ */}
              <div>
                <label className="block text-[11px] font-sans text-zinc-300 font-medium uppercase tracking-wider mb-1">
                  Khung giờ
                </label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#B5945B] text-white text-xs outline-none transition-all cursor-pointer"
                >
                  <option value="07:30 - 11:30 (Sáng)">07:30 - 11:30 (Sáng)</option>
                  <option value="13:30 - 17:30 (Chiều)">13:30 - 17:30 (Chiều)</option>
                  <option value="18:00 - 21:30 (Tối)">18:00 - 21:30 (Tối)</option>
                  <option value="Cả ngày (Full day)">Cả ngày (Full day)</option>
                  <option value="Khác">Khung giờ khác...</option>
                </select>
              </div>

              {/* Số lượng người */}
              <div>
                <label className="block text-[11px] font-sans text-zinc-300 font-medium uppercase tracking-wider mb-1">
                  Số người
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={classSize}
                  onChange={(e) => setClassSize(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#B5945B] text-white text-xs outline-none transition-all"
                />
              </div>
            </div>

            {timeSlot === "Khác" && (
              <div>
                <label className="block text-[11px] font-sans text-zinc-300 font-medium uppercase tracking-wider mb-1">
                  Khung giờ tùy chỉnh
                </label>
                <input
                  type="text"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  placeholder="VD: 15:00 - 19:00"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#B5945B] text-white text-xs outline-none transition-all"
                />
              </div>
            )}

            {/* Địa điểm */}
            <div>
              <label className="block text-[11px] font-sans text-zinc-300 font-medium uppercase tracking-wider mb-1">
                Địa điểm chụp
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="VD: Trường THPT Chu Văn An, Thụy Khuê, Tây Hồ, Hà Nội"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#B5945B] text-white text-xs outline-none transition-all placeholder:text-zinc-600"
                />
              </div>
            </div>

            {/* Ghi chú từ khách */}
            <div>
              <label className="block text-[11px] font-sans text-zinc-300 font-medium uppercase tracking-wider mb-1">
                Ghi chú / Yêu cầu từ Messenger
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="VD: Khách yêu cầu chụp tone màu ấm hoàng hôn, cần 2 thợ chụp..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#B5945B] text-white text-xs outline-none transition-all placeholder:text-zinc-600 resize-none"
              />
            </div>

            {/* Auto confirm toggle */}
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">
                  Xác nhận &amp; tạo link QR ngay
                </div>
                <div className="text-[11px] text-zinc-400">
                  Trạng thái thành &quot;confirmed&quot;, sinh mã và link xác nhận sẵn sàng gửi khách
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoConfirm}
                onChange={(e) => setAutoConfirm(e.target.checked)}
                className="w-4 h-4 accent-[#B5945B] cursor-pointer"
              />
            </div>

            {/* Submit buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#B5945B] hover:bg-[#a3844e] disabled:opacity-50 text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#B5945B]/20 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Lưu &amp; Sinh Mã QR</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
export default AdminCreateBookingModal;
