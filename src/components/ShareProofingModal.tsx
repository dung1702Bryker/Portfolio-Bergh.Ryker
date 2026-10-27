import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Share2,
  QrCode,
  Eye,
  Heart,
  Sparkles,
  ExternalLink,
  Globe,
  MessageCircle,
  Smartphone,
  Save,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import QRCode from "qrcode";
import { ProofingAlbum } from "../services/proofingService";
import {
  getPublicBookingBaseUrl,
  getPublicUrl,
  getCustomPublicDomain,
  setCustomPublicDomain,
  OFFICIAL_PUBLIC_DOMAIN,
} from "../utils/bookingQr";

interface ShareProofingModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: ProofingAlbum;
  showToast?: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const ShareProofingModal: React.FC<ShareProofingModalProps> = ({
  isOpen,
  onClose,
  album,
  showToast,
}) => {
  const [copiedLink, setCopiedLink] = useState<"client" | "view" | "message" | null>(null);
  const [clientQrUrl, setClientQrUrl] = useState<string>("");
  const [viewQrUrl, setViewQrUrl] = useState<string>("");
  const [isGeneratingQr, setIsGeneratingQr] = useState(true);

  // Cấu hình tên miền Public chính thức gửi khách (Tránh proxy nội bộ *.usercontent.goog gây lỗi Cookie Check trên iPhone)
  const [customDomainInput, setCustomDomainInput] = useState<string>(() => {
    return getPublicUrl("");
  });
  const [isDomainSaved, setIsDomainSaved] = useState(false);

  // Compute public URLs using getPublicUrl helper (Tự động đảm bảo luôn dùng ais-pre- hoặc custom domain, không dùng ais-dev- hoặc usercontent.goog)
  const albumIdentifier = album.slug || album.id;
  const clientSelectionUrl = getPublicUrl(`?proofing=${albumIdentifier}`, customDomainInput);
  const viewOnlyUrl = getPublicUrl(`?proofing=${albumIdentifier}&mode=view`, customDomainInput);

  // Tin nhắn mẫu gửi khách hàng qua Zalo / Messenger kèm hướng dẫn mở Safari
  const sampleClientMessage = `Chào bạn, Bergh.Ryker Studio gửi bạn liên kết chọn ảnh và gửi ghi chú hậu kỳ album "${album.title}":
🔗 ${clientSelectionUrl}

📌 Hướng dẫn mở nhanh trên điện thoại (Zalo / Messenger):
• Nếu màn hình hiện "Action required": Bạn chỉ cần bấm nút "Close and continue" để vào xem ảnh ngay.
• Hoặc bấm dấu (•••) ở góc trên bên phải màn hình ➔ Chọn "Mở bằng trình duyệt Safari / Chrome" để trải nghiệm mượt và nét nhất nhé!`;

  // Generate QR codes for both links
  useEffect(() => {
    let isMounted = true;
    const generateQrs = async () => {
      setIsGeneratingQr(true);
      try {
        const qrOptions = {
          width: 900,
          margin: 2,
          errorCorrectionLevel: "H" as const,
          color: {
            dark: "#0a0a0c",
            light: "#ffffff",
          },
        };

        const [qr1, qr2] = await Promise.all([
          QRCode.toDataURL(clientSelectionUrl, qrOptions),
          QRCode.toDataURL(viewOnlyUrl, qrOptions),
        ]);

        if (isMounted) {
          setClientQrUrl(qr1);
          setViewQrUrl(qr2);
        }
      } catch (err) {
        console.error("Failed to generate QR codes:", err);
      } finally {
        if (isMounted) {
          setIsGeneratingQr(false);
        }
      }
    };

    if (isOpen) {
      generateQrs();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, clientSelectionUrl, viewOnlyUrl]);

  if (!isOpen) return null;

  const handleSaveDomain = () => {
    let clean = customDomainInput.trim().replace(/\/+$/, "");
    if (clean && !clean.startsWith("http://") && !clean.startsWith("https://")) {
      clean = `https://${clean}`;
    }
    const sanitized = getPublicUrl("", clean);
    setCustomDomainInput(sanitized);
    setCustomPublicDomain(sanitized);
    setIsDomainSaved(true);
    if (showToast) {
      showToast("Đã lưu tên miền Public thành công!", "success");
    }
    setTimeout(() => setIsDomainSaved(false), 2000);
  };

  const handleResetDefaultDomain = () => {
    setCustomPublicDomain("");
    const defaultPublic = getPublicUrl("");
    setCustomDomainInput(defaultPublic);
    if (showToast) {
      showToast("Đã khôi phục tên miền mặc định!", "info");
    }
  };

  const handleCopy = (text: string, type: "client" | "view" | "message") => {
    navigator.clipboard.writeText(text);
    setCopiedLink(type);
    if (showToast) {
      if (type === "client") {
        showToast("Đã sao chép link chọn ảnh cho khách hàng!", "success");
      } else if (type === "view") {
        showToast("Đã sao chép link xem album (chỉ xem)!", "success");
      } else {
        showToast("Đã sao chép tin nhắn mẫu (kèm hướng dẫn iPhone)!", "success");
      }
    }
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const handleDownloadQrPng = (dataUrl: string, suffix: string) => {
    if (!dataUrl) return;
    const cleanSlug = (album.slug || album.title || "album").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `QR_${cleanSlug}_${suffix}.png`;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (showToast) {
      showToast(`Đã tải xuống mã QR: ${fileName}`, "success");
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl bg-gradient-to-b from-zinc-950/98 via-zinc-900/98 to-zinc-950/98 border border-[#B5945B]/40 rounded-3xl p-5 sm:p-7 shadow-[0_20px_80px_rgba(0,0,0,0.9),0_0_50px_rgba(181,148,91,0.15)] text-left backdrop-blur-2xl my-auto max-h-[92vh] flex flex-col"
      >
        {/* Subtle Ambient Gold Glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#B5945B]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#DFB779]/20 to-[#B5945B]/10 border border-[#B5945B]/40 flex items-center justify-center text-[#E5C17C] shadow-inner">
              <Share2 className="w-5 h-5 text-[#B5945B]" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#B5945B] bg-[#B5945B]/10 px-2 py-0.5 rounded-full border border-[#B5945B]/30">
                Chia sẻ Album & Mã QR
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 flex items-center gap-2">
                Chia sẻ
                <span className="text-xs font-normal text-zinc-400 truncate max-w-[200px] sm:max-w-xs">
                  ({album.title})
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 pr-1">
          {/* CẤU HÌNH DOMAIN PUBLIC GỬI KHÁCH */}
          <div className="p-3.5 rounded-2xl bg-[#B5945B]/[0.08] border border-[#B5945B]/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#E2C792]">
                <Globe className="w-3.5 h-3.5 text-[#B5945B]" />
                <span>🌐 Tên miền Public gửi khách (Tránh lỗi Cookie check trên iPhone)</span>
              </div>
              <button
                type="button"
                onClick={handleResetDefaultDomain}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition"
                title="Khôi phục tên miền mặc định"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Mặc định</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customDomainInput}
                onChange={(e) => setCustomDomainInput(e.target.value)}
                placeholder="https://ten-mien-that-cua-studio.com (chỉ nhập khi đã mua domain)"
                className="flex-1 min-w-0 px-3 py-2 bg-black/60 border border-white/15 focus:border-[#B5945B] rounded-xl text-xs text-zinc-200 outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleSaveDomain}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-zinc-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer border border-white/10 shrink-0"
              >
                {isDomainSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5 text-[#B5945B]" />}
                <span>{isDomainSaved ? "Đã lưu!" : "Lưu"}</span>
              </button>
            </div>
            {customDomainInput.includes("berghryker.vn") ||
            customDomainInput.includes("berghryker.st") ? (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-rose-200 text-[11px] leading-relaxed">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-rose-300">
                    ❌ Tên miền này chưa được mua/đăng ký (Lỗi NXDOMAIN):
                  </p>
                  <p className="text-zinc-300">
                    Địa chỉ <code className="text-rose-300 bg-black/40 px-1 py-0.5 rounded font-mono">{customDomainInput}</code> chưa tồn tại trên hệ thống DNS toàn cầu nên không ai có thể truy cập được.
                  </p>
                  <p className="text-zinc-200">
                    👉 Bấm ngay nút <button type="button" onClick={handleResetDefaultDomain} className="text-[#E5C17C] font-bold underline cursor-pointer hover:text-white">Khôi phục Mặc định</button> để quay lại đường dẫn Cloud Run đang hoạt động của Studio.
                  </p>
                </div>
              </div>
            ) : customDomainInput.includes("ais-pre-") ||
            customDomainInput.includes("ais-dev-") ||
            customDomainInput.includes("usercontent.goog") ||
            customDomainInput.includes("aistudio") ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-amber-200 text-[11px] leading-relaxed">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-300">
                    ℹ️ Đang dùng đường dẫn Cloud Run trực tiếp của dự án:
                  </p>
                  <p className="text-zinc-300">
                    Khách mở trên iPhone qua Zalo/Messenger nếu gặp thông báo <em>"Action required / Cookie check"</em>: Khách chỉ cần bấm nút <strong>"Close and continue"</strong> hoặc bấm dấu (•••) chọn <strong>"Mở bằng Safari"</strong> là vào xem ảnh bình thường.
                  </p>
                  <p className="text-zinc-400 text-[10px]">
                    (Chỉ nhập tên miền tùy chỉnh nếu bạn đã mua domain riêng như .vn hoặc .com và trỏ DNS về máy chủ).
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-emerald-400/90 flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Đang sử dụng tên miền độc lập. Khách hàng mở link qua Zalo, Messenger, Safari sẽ vào thẳng album 100% không cần đăng nhập Google.</span>
              </p>
            )}
          </div>

          {/* SECTION 1: LINK DÀNH CHO KHÁCH HÀNG CHỌN ẢNH */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-[#B5945B]/30 relative overflow-hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#E5C17C] uppercase tracking-wide">
                <Heart className="w-4 h-4 fill-[#B5945B] text-[#B5945B]" />
                <span>1. Đường dẫn cho khách hàng chọn ảnh & ghi chú</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                Khách chọn ❤️ & gửi duyệt
              </span>
            </div>

            {/* Input & Copy Row */}
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 min-w-0 relative">
                <input
                  type="text"
                  readOnly
                  value={clientSelectionUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full px-3.5 py-2.5 bg-black/60 border border-white/15 focus:border-[#B5945B] rounded-xl text-xs text-zinc-200 outline-none font-mono cursor-pointer select-all truncate"
                />
              </div>
              <a
                href={clientSelectionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white transition flex items-center justify-center shrink-0 border border-white/10"
                title="Mở thử nghiệm link trong tab mới"
              >
                <ExternalLink className="w-4 h-4 text-[#B5945B]" />
              </a>
              <button
                type="button"
                onClick={() => handleCopy(clientSelectionUrl, "client")}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  copiedLink === "client"
                    ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30"
                    : "bg-gradient-to-r from-[#DFB779] to-[#B5945B] hover:opacity-90 text-zinc-950 shadow-md shadow-[#B5945B]/20"
                }`}
              >
                {copiedLink === "client" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Đã chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            {/* QR Code Presentation */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pt-2 border-t border-white/5">
              <div className="w-28 h-28 p-2 bg-white rounded-2xl shadow-xl flex items-center justify-center shrink-0">
                {isGeneratingQr ? (
                  <div className="w-full h-full bg-zinc-100 rounded-xl animate-pulse" />
                ) : (
                  <img
                    src={clientQrUrl}
                    alt="Mã QR khách chọn ảnh"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="space-y-2 text-center sm:text-left flex-1">
                <div className="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-[#B5945B]" />
                  <span>Mã QR khách chọn ảnh</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Khách quét bằng camera điện thoại hoặc Zalo để mở giao diện chọn ảnh, thả tim ❤️ và ghi chú trực tiếp.
                </p>
                <div className="pt-1 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={() => handleDownloadQrPng(clientQrUrl, "Khach_Chon_Anh")}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-zinc-200 hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer border border-white/10"
                  >
                    <Download className="w-3.5 h-3.5 text-[#B5945B]" />
                    <span>⬇️ Tải về [.PNG]</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: TIN NHẮN MẪU GỬI ZALO / MESSENGER KÈM LƯU Ý IPHONE */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>Tin nhắn mẫu gửi khách (kèm lưu ý iPhone/Zalo)</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(sampleClientMessage, "message")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  copiedLink === "message"
                    ? "bg-emerald-500 text-black font-bold"
                    : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
                }`}
              >
                {copiedLink === "message" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink === "message" ? "Đã chép tin nhắn!" : "Sao chép tin nhắn"}</span>
              </button>
            </div>
            <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[11px] font-sans text-zinc-300 leading-relaxed whitespace-pre-wrap select-all cursor-pointer">
              {sampleClientMessage}
            </div>
          </div>

          {/* SECTION 3: LINK CHỈ XEM (VIEW-ONLY) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 relative overflow-hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200 uppercase tracking-wide">
                <Eye className="w-4 h-4 text-blue-400" />
                <span>3. Đường dẫn chia sẻ cho người xem (Chỉ xem)</span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                Khóa chọn & ghi chú
              </span>
            </div>

            {/* Input & Copy Row */}
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 min-w-0 relative">
                <input
                  type="text"
                  readOnly
                  value={viewOnlyUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full px-3.5 py-2.5 bg-black/60 border border-white/15 focus:border-[#B5945B] rounded-xl text-xs text-zinc-200 outline-none font-mono cursor-pointer select-all truncate"
                />
              </div>
              <a
                href={viewOnlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white transition flex items-center justify-center shrink-0 border border-white/10"
                title="Mở thử nghiệm link trong tab mới"
              >
                <ExternalLink className="w-4 h-4 text-blue-400" />
              </a>
              <button
                type="button"
                onClick={() => handleCopy(viewOnlyUrl, "view")}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  copiedLink === "view"
                    ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/30"
                    : "bg-white/15 hover:bg-white/20 text-white border border-white/15"
                }`}
              >
                {copiedLink === "view" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Đã chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            {/* QR Code Presentation */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 pt-2 border-t border-white/5">
              <div className="w-28 h-28 p-2 bg-white rounded-2xl shadow-xl flex items-center justify-center shrink-0">
                {isGeneratingQr ? (
                  <div className="w-full h-full bg-zinc-100 rounded-xl animate-pulse" />
                ) : (
                  <img
                    src={viewQrUrl}
                    alt="Mã QR khách xem album"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="space-y-2 text-center sm:text-left flex-1">
                <div className="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>Mã QR khách xem album (View-Only)</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Dành cho bạn bè hoặc người thân xem album công khai mà không sợ thay đổi danh sách ảnh đã chọn.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadQrPng(viewQrUrl, "Khach_Xem_Album")}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-zinc-200 hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer border border-white/10"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>⬇️ Tải về [.PNG]</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#B5945B]" />
            <span>Mã QR chuẩn nét cao (1200x1200px) hỗ trợ quét trực tiếp trên mọi camera điện thoại.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer font-semibold text-xs"
          >
            Đóng
          </button>
        </div>
      </motion.div>
    </div>
  );
};
