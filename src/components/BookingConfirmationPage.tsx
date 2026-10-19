import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Booking } from "../types";
import {
  generateQrDataUrl,
  downloadQrCodePng,
  maskPhoneNumber,
  createGoogleCalendarUrl,
  createGoogleMapsUrl,
  getPublicBookingBaseUrl,
  decodeBookingIdentifier,
} from "../utils/bookingQr";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Phone,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Download,
  Share2,
  ExternalLink,
  Camera,
  ArrowLeft,
  Copy,
  Check,
  Palette,
  Search,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

interface BookingConfirmationPageProps {
  bookingCode: string;
  onNavigateHome?: () => void;
}

export const BookingConfirmationPage: React.FC<BookingConfirmationPageProps> = ({
  bookingCode,
  onNavigateHome,
}) => {
  const [currentCode, setCurrentCode] = useState<string>(() => {
    return bookingCode === "SEARCH" ? "" : bookingCode;
  });
  const [searchInput, setSearchInput] = useState<string>(() => {
    return bookingCode === "SEARCH" ? "" : bookingCode;
  });
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);

  // Đọc danh sách đơn gần đây từ localStorage trên thiết bị
  useEffect(() => {
    try {
      const saved = localStorage.getItem("my_booking_ids");
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentCodes(parsed.slice(-3).reverse());
        }
      }
    } catch (_) {}
  }, []);

  /**
   * Thuật toán tra cứu đa tầng (Multi-tier Lookup) cực kỳ mạnh mẽ:
   * 1. Query trực tiếp bookingCode (chuẩn & chữ hoa).
   * 2. Tìm theo Document ID (BRBK_... hoặc booking_...).
   * 3. Tìm theo trường id.
   * 4. Quét toàn bộ collection 'bookings' trong Firestore:
   *    - Khớp với confirmationLink (giải quyết triệt để trường hợp link xác nhận chứa mã khác bookingCode).
   *    - Khớp bookingCode không phân biệt dấu gạch nối và khoảng trắng.
   *    - Khớp 4 ký tự đuôi (VD: CNM6, 6721).
   *    - Khớp số điện thoại / Zalo.
   * 5. Fallback tra cứu trong localStorage của thiết bị.
   */
  const findBookingData = useCallback(async (rawCode: string): Promise<Booking | null> => {
    const code = decodeBookingIdentifier(rawCode);

    if (!code || code === "SEARCH") return null;

    const upper = code.toUpperCase();

    // Tầng 1: Query chính xác theo trường bookingCode
    try {
      const q1 = query(collection(db, "bookings"), where("bookingCode", "==", code));
      const s1 = await getDocs(q1);
      if (!s1.empty) {
        const d = s1.docs[0];
        return { id: d.id, ...(d.data() as any) };
      }

      if (upper !== code) {
        const q1u = query(collection(db, "bookings"), where("bookingCode", "==", upper));
        const s1u = await getDocs(q1u);
        if (!s1u.empty) {
          const d = s1u.docs[0];
          return { id: d.id, ...(d.data() as any) };
        }
      }
    } catch (e) {
      console.warn("[BookingConfirm] Tầng 1 query error:", e);
    }

    // Tầng 2: Tìm trực tiếp theo Doc ID
    try {
      const docSnap = await getDoc(doc(db, "bookings", code));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...(docSnap.data() as any) };
      }

      if (upper !== code) {
        const docSnapU = await getDoc(doc(db, "bookings", upper));
        if (docSnapU.exists()) {
          return { id: docSnapU.id, ...(docSnapU.data() as any) };
        }
      }

      if (!upper.startsWith("BRBK_")) {
        const docSnapPrefixed = await getDoc(doc(db, "bookings", `BRBK_${upper}`));
        if (docSnapPrefixed.exists()) {
          return { id: docSnapPrefixed.id, ...(docSnapPrefixed.data() as any) };
        }
      }
    } catch (e) {
      console.warn("[BookingConfirm] Tầng 2 doc error:", e);
    }

    // Tầng 3: Tìm theo trường `id` trong document
    try {
      const qId = query(collection(db, "bookings"), where("id", "==", code));
      const sId = await getDocs(qId);
      if (!sId.empty) {
        const d = sId.docs[0];
        return { id: d.id, ...(d.data() as any) };
      }
    } catch (_) {}

    // Tầng 4: Quét toàn bộ collection bookings (Bảo đảm tìm thấy 100%)
    try {
      const allSnap = await getDocs(collection(db, "bookings"));
      const cleanSearch = upper.replace(/[^A-Z0-9]/g, "");

      for (const d of allSnap.docs) {
        const data = d.data() as any;
        const bCode = (data.bookingCode || "").trim().toUpperCase();
        const bConf = (data.confirmationLink || "").trim().toUpperCase();
        const bId = (data.id || d.id || "").trim().toUpperCase();
        const bPhone = (data.phone || data.instagramOrZalo || "").replace(/[^0-9]/g, "");
        const cleanBCode = bCode.replace(/[^A-Z0-9]/g, "");

        // 4.1 Khớp với đường dẫn confirmationLink (chứa mã được click trong link)
        if (
          bConf &&
          (bConf.includes(upper) ||
            (cleanSearch.length >= 4 && bConf.replace(/[^A-Z0-9]/g, "").includes(cleanSearch)))
        ) {
          return { id: d.id, ...data };
        }

        // 4.2 Khớp với bookingCode (kể cả bỏ dấu gạch nối)
        if (bCode === upper || (cleanSearch.length >= 4 && cleanBCode === cleanSearch)) {
          return { id: d.id, ...data };
        }

        // 4.3 Khớp với Doc ID
        if (bId === upper || (cleanSearch.length >= 4 && bId.replace(/[^A-Z0-9]/g, "") === cleanSearch)) {
          return { id: d.id, ...data };
        }

        // 4.4 Khớp với 4 ký tự đuôi
        if (upper.length >= 4) {
          if (bCode.endsWith(upper) || bConf.endsWith(upper)) {
            return { id: d.id, ...data };
          }
        }

        // 4.5 Khớp số điện thoại nếu người dùng nhập SĐT
        const searchDigits = code.replace(/[^0-9]/g, "");
        if (searchDigits.length >= 8 && bPhone.includes(searchDigits)) {
          return { id: d.id, ...data };
        }

        // 4.6 Khớp tên trường / tên khách hàng nếu tìm kiếm
        if (
          data.schoolName &&
          code.length >= 3 &&
          data.schoolName.toLowerCase().includes(code.toLowerCase())
        ) {
          return { id: d.id, ...data };
        }
      }
    } catch (scanErr) {
      console.warn("[BookingConfirm] Tầng 4 scan error:", scanErr);
    }

    // Tầng 5: Tra cứu trong LocalStorage trên thiết bị
    try {
      const localSaved = localStorage.getItem(`booking_details_${code}`);
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed) return parsed;
      }
      const myIdsStr = localStorage.getItem("my_booking_ids");
      if (myIdsStr) {
        const myIds: string[] = JSON.parse(myIdsStr);
        for (const id of myIds) {
          if (id.includes(code) || code.includes(id)) {
            const docSnap = await getDoc(doc(db, "bookings", id));
            if (docSnap.exists()) return { id: docSnap.id, ...(docSnap.data() as any) };
          }
        }
      }
    } catch (_) {}

    return null;
  }, []);

  // Thực thi fetch booking
  const executeLookup = useCallback(async (codeToSearch: string) => {
    if (!codeToSearch.trim() || codeToSearch === "SEARCH") {
      setLoading(false);
      setBooking(null);
      setError("Vui lòng nhập Mã booking hoặc Số điện thoại để tra cứu.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const found = await findBookingData(codeToSearch);

      if (!found) {
        setError(
          `Không tìm thấy thông tin đặt lịch với mã "${codeToSearch}". Vui lòng kiểm tra lại đường dẫn hoặc nhập số điện thoại đặt lịch.`
        );
        setBooking(null);
        setLoading(false);
        return;
      }

      setBooking(found);

      // Cập nhật URL sạch trên thanh địa chỉ mà không reload trang
      const activeDisplayCode = found.bookingCode || found.id;
      if (window.history.replaceState) {
        window.history.replaceState({}, "", `/booking/${activeDisplayCode}`);
      }

      // Đánh dấu đã xem nếu chưa cập nhật
      if (
        found.confirmationStatus === "link_created" ||
        found.confirmationStatus === "not_sent"
      ) {
        try {
          await updateDoc(doc(db, "bookings", found.id), {
            confirmationStatus: "viewed",
          });
        } catch (_) {}
      }

      // Tạo mã QR từ đường dẫn công khai chuẩn
      const publicBase = getPublicBookingBaseUrl();
      const publicUrl = `${publicBase}/booking/${activeDisplayCode}`;
      const qrUrl = await generateQrDataUrl(publicUrl, 1200);
      setQrDataUrl(qrUrl);
    } catch (err) {
      console.error("[BookingConfirm] Fetch error:", err);
      setError("Có lỗi khi kết nối hệ thống. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }, [findBookingData]);

  useEffect(() => {
    executeLookup(currentCode);
  }, [currentCode, executeLookup]);

  // Xử lý tìm kiếm thủ công
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setCurrentCode(searchInput.trim());
    }
  };

  const handleCopyLink = () => {
    const publicBase = getPublicBookingBaseUrl();
    const publicUrl = `${publicBase}/booking/${booking?.bookingCode || booking?.id || currentCode}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleDownloadQr = () => {
    if (qrDataUrl) {
      const fileName = `bergh-ryker-booking-${booking?.bookingCode || booking?.id || "qr"}.png`;
      downloadQrCodePng(qrDataUrl, fileName);
    }
  };

  // Xác định trạng thái hiển thị
  const isCancelled =
    booking?.status === "Từ chối" || booking?.status === "Đã hủy";
  const isConfirmed =
    booking?.status === "Đã duyệt" ||
    booking?.status === "confirmed" ||
    booking?.status === "Đã xác nhận" ||
    booking?.status === "Đã khoá lịch" ||
    booking?.status === "Đã hoàn thành";

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col justify-between selection:bg-[#B5945B]/30 selection:text-white">
      {/* Background ambient luxury glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-[#B5945B]/15 via-transparent to-transparent blur-3xl opacity-70" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-t from-[#8E7037]/10 via-transparent to-transparent blur-3xl opacity-50" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onNavigateHome ? (
              <button
                onClick={onNavigateHome}
                className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 hover:text-white transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-zinc-800/60"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Trang Chủ</span>
              </button>
            ) : (
              <a
                href="/"
                className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-zinc-800/60"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Trang Chủ</span>
              </a>
            )}
            <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#B5945B]" />
              <span className="font-serif tracking-widest text-sm uppercase text-white font-semibold">
                BERGH.RYKER
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-all cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Đã chép link</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Chia sẻ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex-1">
        {loading ? (
          <div className="py-24 text-center">
            <div className="inline-block w-10 h-10 border-2 border-[#B5945B] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-zinc-400 text-sm tracking-wide">
              Đang xác thực và nạp thông tin đặt lịch...
            </p>
          </div>
        ) : error || !booking ? (
          <div className="max-w-lg mx-auto py-10 px-6 sm:px-8 rounded-3xl bg-zinc-900/90 border border-zinc-800/90 shadow-2xl backdrop-blur-xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-serif font-bold text-white mb-2">
              {currentCode ? "Không tìm thấy thông tin đặt lịch" : "Tra cứu xác nhận đặt lịch"}
            </h2>

            <p className="text-xs sm:text-sm text-zinc-400 mb-6 leading-relaxed">
              {error || "Vui lòng nhập Mã booking (ví dụ: BR-2026-6721) hoặc Số điện thoại để xem vé xác nhận."}
            </p>

            {/* Thanh tìm kiếm trực tiếp trên trang */}
            <form onSubmit={handleSearchSubmit} className="mb-6">
              <div className="flex items-center gap-2 p-1.5 bg-zinc-950 border border-zinc-700/80 rounded-2xl focus-within:border-[#B5945B] transition-all">
                <Search className="w-4 h-4 text-zinc-400 ml-2.5 shrink-0" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Nhập mã booking (VD: BR-2026-6721) hoặc SĐT..."
                  className="flex-1 bg-transparent px-2 py-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#B5945B] hover:bg-[#a3844e] text-zinc-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
                >
                  Tìm Kiếm
                </button>
              </div>
            </form>

            {/* Đơn gần đây trên máy */}
            {recentCodes.length > 0 && (
              <div className="mb-6 p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 text-left">
                <div className="text-[11px] text-zinc-400 font-medium mb-2.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#E5C17C]" />
                  <span>Đơn đặt lịch gần đây trên thiết bị của bạn:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentCodes.map((codeItem) => (
                    <button
                      key={codeItem}
                      type="button"
                      onClick={() => {
                        setSearchInput(codeItem);
                        setCurrentCode(codeItem);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-xs text-[#E5C17C] font-mono border border-zinc-700/60 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{codeItem}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Các nút hành động hỗ trợ */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <a
                href="https://zalo.me/0365266204"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#E5C17C]" />
                <span>Hỗ Trợ Zalo (0365266204)</span>
              </a>

              {onNavigateHome ? (
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#B5945B] hover:bg-[#a3844e] text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  Về Trang Chủ Bergh.Ryker
                </button>
              ) : (
                <a
                  href="/"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#B5945B] hover:bg-[#a3844e] text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center"
                >
                  Về Trang Chủ Bergh.Ryker
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Status Hero Card */}
            <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-[#B5945B] font-semibold">
                      THÔNG TIN XÁC NHẬN ĐẶT LỊCH
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                    {booking.schoolName}
                  </h1>
                  <p className="text-sm text-zinc-400 mt-1">
                    Gói dịch vụ:{" "}
                    <span className="text-zinc-200 font-medium">
                      {booking.conceptType}
                    </span>
                  </p>
                </div>

                {/* Status Badge */}
                <div>
                  {isCancelled ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 font-medium text-sm">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span>Đã hủy</span>
                    </div>
                  ) : isConfirmed ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-medium text-sm shadow-inner">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Đã xác nhận</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-300 font-medium text-sm">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Chờ xác nhận</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Booking Code Banner */}
              <div className="pt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider">
                    Mã đặt lịch:
                  </span>
                  <span className="px-3 py-1 rounded-lg bg-zinc-800/90 text-white font-mono text-sm font-semibold tracking-wider border border-zinc-700/60">
                    {booking.bookingCode || booking.id}
                  </span>
                </div>

                {booking.confirmedAt && (
                  <div className="text-xs text-zinc-400">
                    Xác nhận lúc:{" "}
                    <span className="text-zinc-300 font-mono">
                      {typeof booking.confirmedAt === "string"
                        ? booking.confirmedAt
                        : new Date().toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Split Grid: Details + QR */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Left Column: Details (8 cols) */}
              <div className="md:col-span-7 space-y-6">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-7 backdrop-blur-sm space-y-5">
                  <h2 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#B5945B]" />
                    <span>Chi Tiết Lịch Chụp</span>
                  </h2>

                  <div className="space-y-4">
                    {/* Date & Time */}
                    <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                      <Calendar className="w-4 h-4 text-[#E5C17C] mt-1 shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-zinc-400 font-medium">
                          Ngày chụp & Khung giờ
                        </div>
                        <div className="text-sm font-semibold text-white mt-0.5">
                          {booking.date}
                          {booking.timeSlot && (
                            <span className="text-zinc-300 font-normal">
                              {" "}
                              ({booking.timeSlot})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Location */}
                    {booking.address && (
                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                        <MapPin className="w-4 h-4 text-[#E5C17C] mt-1 shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-zinc-400 font-medium">
                            Địa điểm chụp
                          </div>
                          <div className="text-sm font-semibold text-white mt-0.5">
                            {booking.address}
                          </div>
                          <a
                            href={createGoogleMapsUrl(booking.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#B5945B] hover:underline mt-1"
                          >
                            <span>Xem trên Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Class Size */}
                    <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                      <Users className="w-4 h-4 text-[#E5C17C] mt-1 shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-zinc-400 font-medium">
                          Số lượng người chụp
                        </div>
                        <div className="text-sm font-semibold text-white mt-0.5">
                          {booking.classSize || 1} người
                        </div>
                      </div>
                    </div>

                    {/* Contact Phone */}
                    {(booking.phone || booking.instagramOrZalo) && (
                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                        <Phone className="w-4 h-4 text-[#E5C17C] mt-1 shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-zinc-400 font-medium">
                            Liên hệ đặt lịch
                          </div>
                          <div className="text-sm font-semibold text-white mt-0.5">
                            {maskPhoneNumber(booking.phone || booking.instagramOrZalo)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Estimated Cost */}
                    {booking.estimatedCost && (
                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                        <Palette className="w-4 h-4 text-[#E5C17C] mt-1 shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-zinc-400 font-medium">
                            Chi phí dự toán
                          </div>
                          <div className="text-sm font-semibold text-[#E5C17C] mt-0.5">
                            {booking.estimatedCost}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Custom Request & Notes */}
                    {(booking.notes || booking.customRequest) && (
                      <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-800/60">
                        <FileText className="w-4 h-4 text-[#E5C17C] mt-1 shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-zinc-400 font-medium">
                            Yêu cầu concept & Ghi chú
                          </div>
                          <div className="text-xs text-zinc-300 mt-1 leading-relaxed whitespace-pre-wrap">
                            {booking.customRequest || booking.notes}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Calendar Add Button */}
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Thêm vào Google Calendar
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Đồng bộ lịch chụp vào ứng dụng điện thoại để nhận thông báo nhắc hẹn.
                    </p>
                  </div>
                  <a
                    href={createGoogleCalendarUrl(booking)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold border border-zinc-700/80 transition-all cursor-pointer shadow-md"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#E5C17C]" />
                    <span>Lưu Vào Lịch</span>
                  </a>
                </div>

                {/* Photo Editing Progress Shortcut */}
                <div className="rounded-3xl border border-[#B5945B]/30 bg-gradient-to-r from-zinc-900/90 to-zinc-950/90 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="p-1 rounded bg-[#B5945B]/20 text-[#B5945B]">
                        <Palette className="w-3.5 h-3.5" />
                      </span>
                      <h3 className="text-sm font-semibold text-white">
                        Theo Dõi Tiến Độ Hậu Kỳ & Trả File Ảnh
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Kiểm tra trạng thái chụp xong, chọn ảnh, retouch màu và tải về trọn bộ ảnh chất lượng cao.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const activeCode = booking.bookingCode || booking.id;
                      window.dispatchEvent(
                        new CustomEvent("openPhotoProgressLookup", {
                          detail: { bookingId: activeCode },
                        })
                      );
                    }}
                    className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#DFB779] to-[#CFA25E] text-zinc-950 text-xs font-bold uppercase tracking-wider transition-all hover:brightness-110 cursor-pointer shadow-md active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Xem Tiến Độ Ảnh</span>
                  </button>
                </div>
              </div>

              {/* Right Column: QR Code & Verification Pass (5 cols) */}
              <div className="md:col-span-5 space-y-6">
                <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-6 sm:p-7 backdrop-blur-xl shadow-2xl text-center">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-[#B5945B] font-semibold mb-1">
                    VÉ XÁC NHẬN ĐIỆN TỬ
                  </div>
                  <h3 className="text-base font-serif font-bold text-white mb-5">
                    Mã QR Check-in Buổi Chụp
                  </h3>

                  {/* QR Image Box */}
                  <div className="p-4 rounded-2xl bg-white max-w-[240px] mx-auto shadow-2xl border-4 border-zinc-800/30 mb-5">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Booking QR Code"
                        className="w-full h-auto aspect-square object-contain block mx-auto"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-zinc-100 rounded-lg text-zinc-400 text-xs">
                        Đang tạo QR...
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
                    Lưu mã QR về điện thoại. Khi đến buổi chụp, bạn chỉ cần mở ảnh QR để ekip Bergh.Ryker quét check-in.
                  </p>

                  <div className="flex flex-col gap-2.5">
                    <button
                      onClick={handleDownloadQr}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#B5945B] hover:bg-[#a3844e] text-zinc-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      <span>Tải Mã QR Về Máy</span>
                    </button>

                    <button
                      onClick={handleCopyLink}
                      className="w-full py-2.5 px-4 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Đã chép link xác nhận</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Sao chép link xác nhận</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Studio Guarantee & Support Card */}
                <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-3 text-xs text-zinc-400">
                  <div className="text-zinc-200 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#B5945B]" />
                    <span>Cam kết chất lượng Bergh.Ryker</span>
                  </div>
                  <p className="leading-relaxed">
                    Hỗ trợ dời lịch miễn phí trước 24 giờ. File ảnh gốc được lưu trữ bảo mật tối thiểu 6 tháng kể từ ngày chụp.
                  </p>
                  <div className="pt-1 text-[11px] text-zinc-500">
                    Hotline/Zalo hỗ trợ trực tiếp:{" "}
                    <a
                      href="tel:0365266204"
                      className="text-[#E5C17C] font-mono hover:underline"
                    >
                      0365266204
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/60 bg-zinc-950/80 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© 2026 Bergh.Ryker Studio. All rights reserved.</span>
          <div className="flex items-center gap-4 text-zinc-400">
            <span>Hotline/Zalo: 0365266204</span>
            <span>•</span>
            {onNavigateHome ? (
              <button
                onClick={onNavigateHome}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Trang Chủ
              </button>
            ) : (
              <a href="/" className="hover:text-white transition-colors">
                Trang Chủ
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BookingConfirmationPage;
