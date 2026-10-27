import React, { useState, useEffect, useCallback, useRef } from "react";
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
  MessageCircle,
  FileCheck,
  AlertCircle,
  FolderDown,
  RefreshCw,
  Share2,
  HelpCircle,
  PhoneCall,
  RotateCcw,
  PlusCircle,
} from "lucide-react";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { Booking, PhotoEditingStatus } from "../types";
import { decodeBookingIdentifier } from "../utils/bookingQr";

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
  const [lastSearchedCode, setLastSearchedCode] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [localBookings, setLocalBookings] = useState<string[]>([]);
  const [proofingAlbumSlug, setProofingAlbumSlug] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Đồng bộ danh sách đơn đặt lịch từ localStorage trên thiết bị
  const syncLocalBookings = useCallback(() => {
    try {
      const saved = localStorage.getItem("my_booking_ids");
      const list: string[] = saved ? JSON.parse(saved) : [];
      const combined = Array.from(new Set([...myBookingIds, ...list])).filter(Boolean);
      setLocalBookings(combined);
      return combined;
    } catch (_) {
      setLocalBookings(myBookingIds);
      return myBookingIds;
    }
  }, [myBookingIds]);

  useEffect(() => {
    if (isOpen) {
      syncLocalBookings();
    }
  }, [isOpen, syncLocalBookings]);

  // Bộ giải mã và tra cứu dữ liệu đa tầng kết nối Firestore
  const executeSearch = useCallback(
    async (rawInput: string) => {
      const decoded = decodeBookingIdentifier(rawInput);
      const cleanInput = decoded.trim();

      if (!cleanInput) {
        setError(
          "Vui lòng nhập Mã booking (VD: BR-2026-6721), Số điện thoại hoặc dán link xác nhận đặt lịch."
        );
        setBooking(null);
        setLastSearchedCode("");
        return;
      }

      setLoading(true);
      setError(null);
      setLastSearchedCode(cleanInput);

      try {
        let foundBooking: Booking | null = null;
        const upper = cleanInput.toUpperCase();
        const cleanSearch = upper.replace(/[^A-Z0-9]/g, "");

        // TẦNG 1: Truy vấn Firestore trực tiếp theo trường `bookingCode`
        try {
          const qUpper = query(
            collection(db, "bookings"),
            where("bookingCode", "==", upper)
          );
          const snapUpper = await getDocs(qUpper);
          if (!snapUpper.empty) {
            const d = snapUpper.docs[0];
            foundBooking = { id: d.id, ...(d.data() as any) };
          } else if (cleanInput !== upper) {
            const qRaw = query(
              collection(db, "bookings"),
              where("bookingCode", "==", cleanInput)
            );
            const snapRaw = await getDocs(qRaw);
            if (!snapRaw.empty) {
              const d = snapRaw.docs[0];
              foundBooking = { id: d.id, ...(d.data() as any) };
            }
          }
        } catch (e1) {
          console.warn("[PhotoProgress] Tầng 1 query error:", e1);
        }

        // TẦNG 2: Tìm theo Document ID (VD: BRBK_016721 hoặc 016721)
        if (!foundBooking) {
          try {
            const docSnap = await getDoc(doc(db, "bookings", upper));
            if (docSnap.exists()) {
              foundBooking = { id: docSnap.id, ...(docSnap.data() as any) };
            } else if (!upper.startsWith("BRBK_")) {
              const docSnapPrefixed = await getDoc(
                doc(db, "bookings", `BRBK_${upper}`)
              );
              if (docSnapPrefixed.exists()) {
                foundBooking = {
                  id: docSnapPrefixed.id,
                  ...(docSnapPrefixed.data() as any),
                };
              }
            }
          } catch (e2) {
            console.warn("[PhotoProgress] Tầng 2 doc error:", e2);
          }
        }

        // TẦNG 3: Tìm theo trường `id` trong document
        if (!foundBooking) {
          try {
            const qId = query(
              collection(db, "bookings"),
              where("id", "==", upper)
            );
            const snapId = await getDocs(qId);
            if (!snapId.empty) {
              const d = snapId.docs[0];
              foundBooking = { id: d.id, ...(d.data() as any) };
            }
          } catch (_) {}
        }

        // TẦNG 4: Tìm kiếm theo tiền tố năm nếu người dùng chỉ nhập 4 ký tự đuôi
        if (!foundBooking && !upper.startsWith("BR-") && cleanSearch.length >= 3) {
          const currentYear = new Date().getFullYear();
          const candidateYears = [currentYear, currentYear - 1, currentYear + 1];
          for (const yr of candidateYears) {
            try {
              const candCode = `BR-${yr}-${upper}`;
              const qCand = query(
                collection(db, "bookings"),
                where("bookingCode", "==", candCode)
              );
              const snapCand = await getDocs(qCand);
              if (!snapCand.empty) {
                const d = snapCand.docs[0];
                foundBooking = { id: d.id, ...(d.data() as any) };
                break;
              }
            } catch (_) {}
          }
        }

        // TẦNG 5: Quét toàn bộ collection 'bookings' trong Firestore (Bảo đảm tìm thấy 100%)
        // Xử lý triệt để: confirmationLink chứa mã khác bookingCode, số điện thoại, tên trường, v.v.
        if (!foundBooking) {
          try {
            const allSnap = await getDocs(collection(db, "bookings"));
            for (const d of allSnap.docs) {
              const data = d.data() as any;
              const bCode = (data.bookingCode || "").trim().toUpperCase();
              const bConf = (data.confirmationLink || "").trim().toUpperCase();
              const bId = (data.id || d.id || "").trim().toUpperCase();
              const bPhone = (data.phone || data.instagramOrZalo || "").replace(
                /[^0-9]/g,
                ""
              );
              const cleanBCode = bCode.replace(/[^A-Z0-9]/g, "");

              // 5.1 Khớp với đường dẫn confirmationLink (chứa mã được click trong link)
              if (
                bConf &&
                (bConf.includes(upper) ||
                  (cleanSearch.length >= 4 &&
                    bConf.replace(/[^A-Z0-9]/g, "").includes(cleanSearch)))
              ) {
                foundBooking = { id: d.id, ...data };
                break;
              }

              // 5.2 Khớp với bookingCode (kể cả không dấu gạch nối)
              if (
                bCode === upper ||
                (cleanSearch.length >= 4 && cleanBCode === cleanSearch)
              ) {
                foundBooking = { id: d.id, ...data };
                break;
              }

              // 5.3 Khớp với Doc ID
              if (
                bId === upper ||
                (cleanSearch.length >= 4 &&
                  bId.replace(/[^A-Z0-9]/g, "") === cleanSearch)
              ) {
                foundBooking = { id: d.id, ...data };
                break;
              }

              // 5.4 Khớp 4 ký tự đuôi
              if (upper.length >= 4) {
                if (bCode.endsWith(upper) || bConf.endsWith(upper)) {
                  foundBooking = { id: d.id, ...data };
                  break;
                }
              }

              // 5.5 Khớp số điện thoại nếu nhập SĐT
              const searchDigits = cleanInput.replace(/[^0-9]/g, "");
              if (searchDigits.length >= 8 && bPhone.includes(searchDigits)) {
                foundBooking = { id: d.id, ...data };
                break;
              }

              // 5.6 Khớp tên trường / tên lớp / người liên hệ
              if (
                cleanInput.length >= 3 &&
                ((data.schoolName &&
                  data.schoolName.toLowerCase().includes(cleanInput.toLowerCase())) ||
                  (data.instagramOrZalo &&
                    data.instagramOrZalo
                      .toLowerCase()
                      .includes(cleanInput.toLowerCase())))
              ) {
                foundBooking = { id: d.id, ...data };
                break;
              }
            }
          } catch (scanErr) {
            console.warn("[PhotoProgress] Tầng 5 scan error:", scanErr);
          }
        }

        // TẦNG 6: Fallback bộ nhớ cache thiết bị (LocalStorage)
        if (!foundBooking) {
          try {
            const localSaved = localStorage.getItem(`booking_details_${cleanInput}`);
            if (localSaved) {
              const parsed = JSON.parse(localSaved);
              if (parsed) foundBooking = parsed;
            }
          } catch (_) {}
        }

        // XỬ LÝ KẾT QUẢ TÌM KIẾM
        if (foundBooking) {
          setBooking(foundBooking);
          setError(null);

          // Tự động lưu mã vào localStorage thiết bị để khách tiện tra cứu lần sau
          const activeCode = foundBooking.bookingCode || foundBooking.id;
          try {
            const currentList = syncLocalBookings();
            if (!currentList.includes(activeCode)) {
              const updated = [...currentList, activeCode];
              localStorage.setItem("my_booking_ids", JSON.stringify(updated));
              setLocalBookings(updated);
            }
          } catch (_) {}

          // Cập nhật URL sạch trên thanh địa chỉ mà không reload trang
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("ticket", activeCode);
            window.history.replaceState({}, "", url.toString());
          } catch (_) {}
        } else {
          setBooking(null);
          setError(
            `Không tìm thấy thông tin đơn đặt lịch khớp với "${cleanInput}".`
          );
        }
      } catch (err) {
        console.error("[PhotoProgress] General search exception:", err);
        setBooking(null);
        setError(
          "Không thể kết nối đến máy chủ để lấy thông tin. Vui lòng kiểm tra kết nối mạng và thử lại."
        );
      } finally {
        setLoading(false);
      }
    },
    [syncLocalBookings]
  );

  // Khởi tạo tra cứu tự động khi mở modal hoặc có mã truyền vào
  useEffect(() => {
    if (!isOpen) return;

    let targetCode = initialBookingId;

    // Nếu không truyền initialBookingId, tự động đọc URL trên trình duyệt
    if (!targetCode && typeof window !== "undefined") {
      targetCode = decodeBookingIdentifier(window.location.href);
    }

    if (targetCode && targetCode.trim()) {
      const clean = targetCode.trim();
      setSearchCode(clean);
      executeSearch(clean);
    }
  }, [isOpen, initialBookingId, executeSearch]);

  // Lắng nghe dữ liệu thời gian thực (Real-time Firestore) khi đã tìm thấy đơn
  useEffect(() => {
    if (!booking?.id || !isOpen) return;
    const unsub = onSnapshot(doc(db, "bookings", booking.id), (snap) => {
      if (snap.exists()) {
        setBooking({ id: snap.id, ...(snap.data() as any) });
      }
    });
    return () => unsub();
  }, [booking?.id, isOpen]);

  // Kiểm tra xem đơn booking này đã có Album Chọn Ảnh (Proofing) hay chưa
  useEffect(() => {
    if (!booking) {
      setProofingAlbumSlug(null);
      return;
    }
    const bCode = booking.bookingCode || booking.id;
    let isCancelled = false;

    const checkProofingAlbum = async () => {
      try {
        const q1 = query(collection(db, "proofing_albums"), where("bookingCode", "==", bCode));
        const snap1 = await getDocs(q1);
        if (!snap1.empty && !isCancelled) {
          const d = snap1.docs[0].data();
          setProofingAlbumSlug(d.slug || snap1.docs[0].id);
          return;
        }

        if (booking.bookingCode && booking.id !== booking.bookingCode) {
          const q2 = query(collection(db, "proofing_albums"), where("bookingCode", "==", booking.id));
          const snap2 = await getDocs(q2);
          if (!snap2.empty && !isCancelled) {
            const d = snap2.docs[0].data();
            setProofingAlbumSlug(d.slug || snap2.docs[0].id);
            return;
          }
        }
        if (!isCancelled) setProofingAlbumSlug(null);
      } catch (err) {
        console.warn("Could not check associated proofing album:", err);
      }
    };

    checkProofingAlbum();
    return () => {
      isCancelled = true;
    };
  }, [booking]);

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
    const activeCode = booking.bookingCode || booking.id;
    const url = new URL(window.location.origin);
    url.searchParams.set("ticket", activeCode);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleCopyTicket = () => {
    if (!booking) return;
    const activeCode = booking.bookingCode || booking.id;
    navigator.clipboard.writeText(activeCode).then(() => {
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2000);
    });
  };

  const handleResetSearch = () => {
    setSearchCode("");
    setBooking(null);
    setError(null);
    setLastSearchedCode("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleSelectRecent = (code: string) => {
    setSearchCode(code);
    executeSearch(code);
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
            aria-label="Đóng"
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
            <p className="text-zinc-400 text-xs sm:text-sm mt-1 leading-relaxed">
              Nhập Mã booking (VD: <span className="text-[#E5C17C] font-mono">BR-2026-6721</span>), Số điện thoại hoặc dán link xác nhận để theo dõi tiến độ hậu kỳ và nhận link tải file ảnh.
            </p>
          </div>

          {/* Search Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeSearch(searchCode);
            }}
            className="space-y-2 mb-5"
          >
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Nhập Mã booking (VD: BR-2026-6721) hoặc dán link xác nhận..."
                className="w-full liquid-glass-input rounded-2xl pl-11 pr-24 py-3.5 text-xs sm:text-sm text-white placeholder:text-zinc-400 font-mono tracking-wider transition-all focus:border-[#B5945B]/70"
              />
              <Search className="w-5 h-5 text-zinc-400 absolute left-3.5 pointer-events-none" />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-1.5 px-4 py-2 liquid-glass-gold-btn font-extrabold text-xs uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50 shadow-md"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                ) : (
                  "Tra cứu"
                )}
              </button>
            </div>

            {/* Quick Chips for local bookings on device */}
            {localBookings.length > 0 && !booking && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 pt-1">
                <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#B5945B]" />
                  Đơn gần đây:
                </span>
                {localBookings.slice(-4).reverse().map((bid) => (
                  <button
                    key={bid}
                    type="button"
                    onClick={() => handleSelectRecent(bid)}
                    className="font-mono text-[11px] px-2.5 py-1 rounded-lg border bg-white/5 text-zinc-300 border-white/10 hover:border-[#B5945B]/50 hover:text-white transition-colors cursor-pointer"
                  >
                    {bid}
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Missing Data Feedback UI (Khi không tìm thấy thông tin) */}
          {error && !booking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 sm:p-5 bg-gradient-to-b from-amber-950/30 via-zinc-900/60 to-zinc-950/80 border border-amber-500/30 rounded-2xl text-left mb-5 shadow-xl"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-amber-300 tracking-wide mb-1">
                    Không tìm thấy thông tin đơn đặt lịch
                  </h4>
                  <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                    {error}
                  </p>

                  {lastSearchedCode && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] font-mono text-zinc-300 mb-3">
                      <span className="text-zinc-500">Mã/từ khóa đã tra cứu:</span>
                      <span className="text-[#E5C17C] font-bold truncate max-w-[200px] sm:max-w-[320px]">
                        {lastSearchedCode}
                      </span>
                    </div>
                  )}

                  {/* Hướng dẫn gợi ý hữu ích */}
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-2 text-xs text-zinc-300 mb-4">
                    <div className="font-semibold text-[11px] text-[#B5945B] uppercase tracking-wider flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Gợi ý tra cứu nhanh:
                    </div>
                    <ul className="space-y-1.5 text-[11.5px] text-zinc-300 list-disc list-inside">
                      <li>
                        <strong className="text-white">Tìm bằng Số điện thoại:</strong> Nhập số điện thoại người đại diện đặt lịch chụp.
                      </li>
                      <li>
                        <strong className="text-white">Tìm bằng Tên trường/Lớp:</strong> Nhập tên trường (VD: Kim Liên, BTEC, FPT...) để quét đơn.
                      </li>
                      <li>
                        <strong className="text-white">Dán link xác nhận đầy đủ:</strong> Nếu mở từ Zalo hoặc Messenger, hãy copy toàn bộ link dán vào ô tìm kiếm.
                      </li>
                    </ul>
                  </div>

                  {/* Nút thao tác tương tác trực tiếp */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={`https://zalo.me/0365266204?text=${encodeURIComponent(
                        `Chào Studio Bergh Ryker, mình cần hỗ trợ tra cứu thông tin đặt lịch với mã: ${lastSearchedCode || "chưa rõ"}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#DFB779] to-[#CFA25E] text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all hover:brightness-110 shadow-md cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Hỗ Trợ Zalo (0365266204)</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleResetSearch}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-xs font-semibold transition-all cursor-pointer border border-white/10"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Nhập lại</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Booking Content Found */}
          {booking && (
            <div className="space-y-5 text-left">
              {/* Top Summary Card */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden">
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wide">
                        {booking.bookingCode || booking.id}
                      </span>
                      {booking.bookingCode && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#B5945B]/20 text-[#E5C17C] border border-[#B5945B]/40 font-mono font-bold">
                          MÃ BOOKING
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleCopyTicket}
                        className="text-zinc-400 hover:text-[#B5945B] transition-colors p-1 cursor-pointer"
                        title="Sao chép mã"
                      >
                        {copiedTicket ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <a
                        href={`/booking/${booking.bookingCode || booking.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white border border-white/20 transition-all font-sans font-medium ml-1"
                        title="Mở trang xác nhận booking & QR"
                      >
                        <ExternalLink className="w-3 h-3 text-[#B5945B]" />
                        <span>Xem trang xác nhận & QR</span>
                      </a>
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

              {/* Direct Link to Proofing Album if available */}
              {proofingAlbumSlug && (
                <div className="bg-gradient-to-r from-[#ffe3e3] to-[#fff0f0] border border-[#ffc9c9] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-900 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#e03131] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                      💎
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[#e03131]">
                        Album Chọn Ảnh Đã Sẵn Sàng!
                      </h4>
                      <p className="text-xs text-slate-600">
                        Studio đã tạo link chọn ảnh cho đơn đặt lịch này. Bạn có thể duyệt và thả tim những ảnh ưng ý nhất ngay bây giờ.
                      </p>
                    </div>
                  </div>
                  <a
                    href={`?proofing=${proofingAlbumSlug}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#e03131] hover:bg-[#c92a2a] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <span>💎 Vào Album Chọn Ảnh & Duyệt File</span>
                  </a>
                </div>
              )}

              {/* Progress Bar Container */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#B5945B]" />
                    Quy Trình Xử Lý Ảnh
                  </span>
                  <span className="font-mono text-xs font-bold text-[#B5945B]">
                    {progressPercent}% Hoàn Tất
                  </span>
                </div>

                <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10">
                  <div
                    className="bg-gradient-to-r from-[#DFB779] via-[#F4E1B5] to-[#DFB779] h-full rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(223,183,121,0.5)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Step Indicators */}
                <div className="grid grid-cols-5 gap-1 mt-4 pt-3 border-t border-white/5">
                  {STEPS.map((step, idx) => {
                    const StepIcon = step.icon;
                    const isDone = currentStepIdx > idx;
                    const isCurrent = currentStepIdx === idx;
                    return (
                      <div key={step.status} className="flex flex-col items-center text-center">
                        <div
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center mb-1 text-xs transition-all ${
                            isDone
                              ? "bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20"
                              : isCurrent
                                ? "bg-[#B5945B] text-black font-bold ring-2 ring-[#B5945B]/40 animate-pulse shadow-md shadow-[#B5945B]/30"
                                : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                          }`}
                        >
                          <StepIcon className="w-3.5 h-3.5" />
                        </div>
                        <span
                          className={`text-[9.5px] sm:text-[10.5px] font-medium leading-tight hidden min-[400px]:block ${
                            isCurrent
                              ? "text-[#E5C17C] font-bold"
                              : isDone
                                ? "text-zinc-300"
                                : "text-zinc-600"
                          }`}
                        >
                          {step.shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Download Section */}
              {booking.editingStatus === "completed" && booking.finalPhotosUrl ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-950 border border-emerald-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                      <FolderDown className="w-5 h-5" />
                    </span>
                    <h4 className="text-base font-bold text-white tracking-wide">
                      Bộ Ảnh Đã Sẵn Sàng Bàn Giao!
                    </h4>
                  </div>
                  <p className="text-zinc-300 text-xs sm:text-sm mb-4 leading-relaxed">
                    Đội ngũ Studio đã hoàn tất toàn bộ quá trình chỉnh sửa màu và kiểm duyệt chất lượng. Bạn có thể mở link bên dưới để tải về trọn bộ file chất lượng gốc cao nhất:
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <a
                      href={booking.finalPhotosUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
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
                  href={`https://zalo.me/0365266204?text=${encodeURIComponent(
                    `Chào Studio Bergh Ryker, mình cần hỗ trợ về tiến độ ảnh đơn booking ${booking.bookingCode || booking.id}`
                  )}`}
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
