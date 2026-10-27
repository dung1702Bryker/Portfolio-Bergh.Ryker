import React, { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  HelpCircle, 
  Bell, 
  FolderOpen, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Sparkles,
  Link as LinkIcon,
  Ticket
} from "lucide-react";
import { 
  ProofingAlbum, 
  createProofingAlbum, 
  parseDriveFolderId,
  getDriveDirectImageUrl,
  fetchDriveFolderImages
} from "../../services/proofingService";
import { collection, getDocs, db, getAccessToken, googleSignIn } from "../../firebase";
import { GooglePickerButton } from "../GooglePickerButton";

interface CreateProofingAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAlbumCreated: (album: ProofingAlbum) => void;
}

export const CreateProofingAlbumModal: React.FC<CreateProofingAlbumModalProps> = ({
  isOpen,
  onClose,
  onAlbumCreated,
}) => {
  const [activeTab, setActiveTab] = useState<"drive" | "local">("drive");
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");

  // Form Fields
  const [driveFolderUrl, setDriveFolderUrl] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [tagInput, setTagInput] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [clientPhone, setClientPhone] = useState<string>("");
  const [bookingCode, setBookingCode] = useState<string>("");

  // Scanned Photos from Drive
  const [scannedPhotos, setScannedPhotos] = useState<any[]>([]);
  const [isScanningDrive, setIsScanningDrive] = useState(false);
  const [scanMessage, setScanMessage] = useState<string>("");

  // Client Reminder
  const [clientReminderEnabled, setClientReminderEnabled] = useState(true);
  const [clientReminderText, setClientReminderText] = useState(
    "Chào bạn! Hãy bấm vào biểu tượng ♡ trên những tấm ảnh ưng ý nhất để chọn ảnh chỉnh sửa. Bạn cũng có thể bấm vào biểu tượng 💬 trên từng ảnh để ghi chú yêu cầu chi tiết (ví dụ: bóp eo, xóa vật thể, chỉnh tone màu vintage ấm...)."
  );

  // 6 Toggle switches
  const [allowComments, setAllowComments] = useState(true);
  const [enableWatermark, setEnableWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState("BERGH RYKER STUDIO");
  const [showNameCard, setShowNameCard] = useState(true);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [allowDownload, setAllowDownload] = useState(false);
  const [limitSelection, setLimitSelection] = useState(true);
  const [maxSelectionCount, setMaxSelectionCount] = useState<number>(35);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load existing bookings from Firestore for intelligent auto-fill
  useEffect(() => {
    if (isOpen) {
      getDocs(collection(db, "bookings"))
        .then((snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setBookings(list);
        })
        .catch((e) => console.warn("Could not load bookings list for proofing auto-fill:", e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Booking auto-fill
  const handleBookingSelect = (bId: string) => {
    setSelectedBookingId(bId);
    if (!bId) return;

    const b = bookings.find((item) => item.id === bId || item.bookingCode === bId);
    if (b) {
      const bCode = b.bookingCode || b.id || "";
      const cName = b.clientName || b.schoolName || b.contactName || "Khách Hàng";
      const concept = b.conceptType || b.conceptName || "Kỷ Yếu";
      const phone = b.instagramOrZalo || b.phone || "";

      setClientName(cName);
      setTitle(`${concept} - ${cName}`);
      setBookingCode(bCode);
      setSlug(bCode.toLowerCase().replace(/[^a-z0-9_-]/g, "-"));
      setClientPhone(phone);
      setLimitSelection(true);
      setMaxSelectionCount(b.classSize && b.classSize > 20 ? 50 : 35);

      const autoTags = [concept, "Studio", "Shotpik"].filter(Boolean);
      setTags(autoTags);
    }
  };

  // Add tag
  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, "");
    if (clean && tags.length < 5 && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Parse & Scan Google Drive folder
  const handleScanDriveFolder = async (targetUrl?: string) => {
    const urlToScan = (targetUrl !== undefined ? targetUrl : driveFolderUrl).trim();
    if (!urlToScan) {
      alert("Vui lòng nhập Link thư mục ảnh Google Drive");
      return;
    }

    const folderId = parseDriveFolderId(urlToScan);
    if (!folderId) {
      alert("Không tìm thấy Folder ID hợp lệ trong liên kết Google Drive.");
      return;
    }

    setIsScanningDrive(true);
    setScanMessage("Đang quét toàn bộ ảnh từ Google Drive (kể cả thư mục con)...");

    try {
      const fetched = await fetchDriveFolderImages(folderId, null, (msg) => {
        setScanMessage(msg);
      });
      setScannedPhotos(fetched);
      if (fetched.length > 0) {
        setScanMessage(`✅ Đã nhận diện thành công ${fetched.length} ảnh từ Google Drive.`);
      } else {
        setScanMessage(`⚠️ Đã quét xong nhưng thư mục không chứa file ảnh hợp lệ.`);
      }
    } catch (err: any) {
      console.warn("Drive scan error:", err);
      setScanMessage(`Lỗi quét Drive: ${err.message || "Không thể truy cập thư mục"}`);
    } finally {
      setIsScanningDrive(false);
    }
  };

  // Submit create album
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Vui lòng nhập tên album");
      return;
    }
    if (!clientName.trim()) {
      setErrorMessage("Vui lòng nhập tên khách hàng");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const folderId = parseDriveFolderId(driveFolderUrl) || "";
      const finalSlug =
        slug.trim() ||
        (bookingCode.trim()
          ? bookingCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-")
          : `album-${Date.now().toString(36).substring(2, 7)}`);

      let finalPhotos = scannedPhotos;

      // BẮT BUỘC TỰ ĐỘNG QUÉT KHI BẤM "TẠO NGAY" (AUTO-FETCH ON SUBMIT)
      // Nếu có link Drive nhưng danh sách ảnh đang rỗng, tự động quét trước khi lưu!
      if (driveFolderUrl.trim() && folderId && (!finalPhotos || finalPhotos.length === 0)) {
        setIsScanningDrive(true);
        setScanMessage("Đang tự động quét toàn bộ ảnh từ Google Drive trước khi tạo album...");
        try {
          finalPhotos = await fetchDriveFolderImages(folderId, null, (msg) => {
            setScanMessage(msg);
          });
          setScannedPhotos(finalPhotos);
        } catch (scanErr: any) {
          console.warn("Auto-scan on submit failed:", scanErr);
          setErrorMessage("Lỗi quét ảnh Google Drive: " + (scanErr.message || scanErr));
          setIsSubmitting(false);
          setIsScanningDrive(false);
          return;
        } finally {
          setIsScanningDrive(false);
        }
      }

      const newAlbumData: Omit<ProofingAlbum, "id" | "createdAt" | "photos"> & { photos: any[] } = {
        title: title.trim(),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        bookingCode: bookingCode.trim(),
        slug: finalSlug,
        tags,
        isLocked: false,
        pipelineStage: "new",
        driveFolderId: folderId,
        driveFolderUrl: driveFolderUrl.trim(),
        photos: finalPhotos || [],

        clientReminderEnabled,
        clientReminderText: clientReminderText.trim(),
        allowComments,
        enableWatermark,
        watermarkText: watermarkText.trim() || "BERGH RYKER STUDIO",
        showNameCard,
        passwordProtected,
        password: passwordProtected ? password.trim() : "",
        allowDownload,
        limitSelection,
        maxSelectionCount: Number(maxSelectionCount) || 35,

        settings: {
          clientReminderEnabled,
          clientReminderText: clientReminderText.trim(),
          allowComments,
          enableWatermark,
          watermarkText: watermarkText.trim() || "BERGH RYKER STUDIO",
          showNameCard,
          passwordProtected,
          password: passwordProtected ? password.trim() : "",
          allowDownload,
          limitSelection,
          maxSelectionCount: Number(maxSelectionCount) || 35,
        },
      };

      const docRef = await createProofingAlbum(newAlbumData);
      onAlbumCreated({
        id: docRef.id,
        createdAt: new Date().toISOString(),
        ...newAlbumData,
      });
      onClose();
    } catch (err: any) {
      console.error("Create album error:", err);
      setErrorMessage("Lỗi khi tạo album: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-[540px] max-h-[90vh] bg-[#121216] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-left font-sans">
        {/* Header: Champagne Title & Close Button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-[#E2C792] text-xl font-serif font-bold tracking-tight">
            Tạo album
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2 Tabs: Google Drive & Local */}
        <div className="flex items-center gap-6 px-6 pt-3 border-b border-white/10 text-sm shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("drive")}
            className={`pb-2.5 font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "drive"
                ? "text-[#E2C792] border-b-2 border-[#B5945B]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Google Drive
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("local")}
            className={`pb-2.5 font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "local"
                ? "text-[#E2C792] border-b-2 border-[#B5945B]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Local
          </button>
        </div>

        {/* Form with Scrollable Body and Pinned Footer */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable Body: overflow-x-hidden strictly enforced */}
          <div className="w-full flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-4 box-border text-left">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span className="break-words">{errorMessage}</span>
              </div>
            )}

            {/* ① Khối: Mã Booking khách hàng (Tự động điền thông tin) */}
            <div className="w-full box-border rounded-xl bg-[#B5945B]/[0.07] border border-[#B5945B]/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-xs font-bold uppercase tracking-wider text-[#E2C792] truncate flex items-center gap-1.5">
                  <Ticket size={15} className="text-[#B5945B] shrink-0" />
                  <span className="truncate">Mã Booking (Tự điền thông tin)</span>
                </span>
                <span className="text-[11px] text-[#B5945B] shrink-0">Khớp dữ liệu đơn chụp</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                <select
                  value={selectedBookingId}
                  onChange={(e) => handleBookingSelect(e.target.value)}
                  className="w-full min-w-0 truncate bg-black/60 border border-white/15 focus:border-[#B5945B] rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#181820]">-- Chọn đơn Booking đã duyệt --</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id} className="bg-[#181820]">
                      {b.bookingCode ? `[#${b.bookingCode}] ` : ""}{b.clientName || b.schoolName} - {b.date || "Chưa chọn ngày"}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={bookingCode}
                  onChange={(e) => {
                    setBookingCode(e.target.value);
                    handleBookingSelect(e.target.value);
                  }}
                  placeholder="Hoặc gõ Mã Booking / SĐT..."
                  className="w-full min-w-0 bg-black/60 border border-white/15 focus:border-[#B5945B] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 outline-none font-mono"
                />
              </div>
            </div>

            {/* ② Khối: Link ảnh Google Drive */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between gap-2 w-full">
                <label className="text-xs font-bold text-zinc-300 flex items-center gap-1 truncate">
                  <span>Link ảnh Google Drive</span>
                  <span title="Dán link thư mục Google Drive đã chia sẻ quyền 'Bất kỳ ai có đường liên kết'" className="cursor-help shrink-0">
                    <HelpCircle size={14} className="text-zinc-500" />
                  </span>
                </label>
                <div className="flex items-center gap-2 shrink-0">
                  {scannedPhotos.length > 0 && (
                    <span className="text-xs text-[#E2C792] font-semibold font-mono hidden sm:inline">
                      {scannedPhotos.length} ảnh
                    </span>
                  )}
                  <GooglePickerButton
                    mode="folders"
                    size="sm"
                    buttonText="📁 Chọn từ Drive"
                    className="!shrink-0 !text-xs !px-3 !py-1.5 !rounded-lg !border !border-[#B5945B]/40 !bg-[#B5945B]/10 !text-[#E2C792] hover:!bg-[#B5945B]/20 transition"
                    onSelect={(url) => {
                      setDriveFolderUrl(url);
                      handleScanDriveFolder(url);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full">
                <input
                  type="url"
                  value={driveFolderUrl}
                  onChange={(e) => setDriveFolderUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/1ABCxyz..."
                  className="flex-1 min-w-0 bg-black/50 border border-white/10 focus:border-[#B5945B] rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleScanDriveFolder()}
                  disabled={isScanningDrive}
                  title="Quét danh sách file từ Google Drive"
                  className="shrink-0 w-10 h-10 rounded-xl bg-[#B5945B] hover:brightness-110 text-black font-bold flex items-center justify-center transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isScanningDrive ? <RefreshCw size={16} className="animate-spin text-black" /> : <Plus size={18} className="stroke-[3]" />}
                </button>
              </div>

              {scanMessage && (
                <p className="text-[11px] text-[#E2C792] font-medium break-words whitespace-normal">{scanMessage}</p>
              )}
            </div>

            {/* ③ Khối: Tên album (100% chiều rộng) */}
            <div className="w-full">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tên album</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Kỷ Yếu 12A1 Chuyên Anh"
                className="w-full min-w-0 box-border bg-black/50 border border-white/10 focus:border-[#B5945B] rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 outline-none"
              />
            </div>

            {/* ③ Khối: Tên khách hàng (100% chiều rộng) */}
            <div className="w-full">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tên khách hàng</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="VD: Nguyễn Văn A & Tập thể lớp"
                className="w-full min-w-0 box-border bg-black/50 border border-white/10 focus:border-[#B5945B] rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 outline-none"
              />
            </div>

            {/* ④ Khối: Tên miền album (Slug) */}
            <div className="w-full">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tên miền album (Slug)</label>
              <div className="flex items-center w-full min-w-0 rounded-xl bg-black/50 border border-white/10 focus-within:border-[#B5945B] overflow-hidden">
                <span className="px-3 py-2.5 bg-white/[0.04] border-r border-white/10 text-xs text-zinc-400 shrink-0 select-none max-w-[180px] truncate font-mono">
                  /?album=
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="ma-album-tuy-chon"
                  className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none font-mono"
                />
              </div>
            </div>

            {/* ⑤ Khối: Tags (Tối đa 5 tag) */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5">
                <span>Tags (Tối đa 5 tag)</span>
                <span className="text-[11px] text-zinc-500 font-mono">{tags.length}/5</span>
              </div>
              <div className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Nhập Tag..."
                  className="flex-1 min-w-0 bg-black/50 border border-white/10 focus:border-[#B5945B] rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="shrink-0 w-10 h-10 rounded-xl bg-[#B5945B] hover:brightness-110 text-black font-bold flex items-center justify-center transition cursor-pointer"
                >
                  <Plus size={16} />
                </button>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 w-full">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.06] text-[#E2C792] text-xs font-medium border border-white/10"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-zinc-400 hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ⑥ Ghi chú ảnh bìa */}
            <div className="w-full min-w-0 box-border p-3 bg-white/[0.02] border border-white/10 rounded-xl text-xs text-zinc-400 leading-relaxed italic break-words whitespace-normal">
              Lưu ý: Ảnh bìa album sẽ được thiết lập sau khi tạo album. Sau khi tạo album, hãy chọn mở ảnh bạn muốn làm ảnh bìa album và nhấn nút &apos;Đặt làm ảnh bìa&apos; để hoàn tất.
            </div>

            {/* ⑥ Lời nhắc cho khách hàng */}
            <div className="w-full min-w-0 box-border bg-white/[0.03] border border-[#B5945B]/30 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-200">
                  <Bell size={18} className="text-[#B5945B] shrink-0" />
                  <span className="font-bold text-xs uppercase tracking-wide text-[#E2C792]">
                    Lời nhắc cho khách hàng
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={clientReminderEnabled}
                  onChange={(e) => setClientReminderEnabled(e.target.checked)}
                  className="w-4 h-4 accent-[#B5945B] cursor-pointer"
                />
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed break-words whitespace-normal">
                Khi khách hàng mở link chọn ảnh, một bảng thông báo sẽ hiện lời nhắc của bạn.
              </p>
              {clientReminderEnabled && (
                <textarea
                  rows={3}
                  value={clientReminderText}
                  onChange={(e) => setClientReminderText(e.target.value)}
                  placeholder="Nhập nội dung lời nhắc cho khách..."
                  className="w-full min-w-0 box-border mt-2 p-3 bg-black/60 border border-white/15 rounded-xl text-xs text-zinc-200 outline-none resize-none focus:border-[#B5945B]"
                />
              )}
            </div>

            {/* ⑥ Danh sách 6 công tắc (Toggle switches) */}
            <div className="w-full min-w-0 box-border space-y-3 pt-1">
              {/* Toggle 1: Cho phép bình luận */}
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-xs font-semibold text-zinc-300">Cho phép bình luận</span>
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="w-4 h-4 accent-[#B5945B] cursor-pointer"
                />
              </div>

              {/* Toggle 2: Bật watermark */}
              <div className="py-1 border-b border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Bật watermark</span>
                  <input
                    type="checkbox"
                    checked={enableWatermark}
                    onChange={(e) => setEnableWatermark(e.target.checked)}
                    className="w-4 h-4 accent-[#B5945B] cursor-pointer"
                  />
                </div>
                {enableWatermark && (
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="Nội dung watermark (VD: BERGH RYKER STUDIO)"
                    className="w-full min-w-0 box-border px-3 py-1.5 bg-black/60 border border-white/15 rounded-lg text-xs font-mono text-zinc-200 outline-none focus:border-[#B5945B]"
                  />
                )}
              </div>

              {/* Toggle 3: Hiện Name Card */}
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <span className="text-xs font-semibold text-zinc-300">Hiện Name Card</span>
                <input
                  type="checkbox"
                  checked={showNameCard}
                  onChange={(e) => setShowNameCard(e.target.checked)}
                  className="w-4 h-4 accent-[#B5945B] cursor-pointer"
                />
              </div>

              {/* Toggle 4: Bảo vệ album bằng mật khẩu */}
              <div className="py-1 border-b border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Bảo vệ album bằng mật khẩu</span>
                  <input
                    type="checkbox"
                    checked={passwordProtected}
                    onChange={(e) => setPasswordProtected(e.target.checked)}
                    className="w-4 h-4 accent-[#B5945B] cursor-pointer"
                  />
                </div>
                {passwordProtected && (
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu album"
                    className="w-full min-w-0 box-border px-3 py-1.5 bg-black/60 border border-white/15 rounded-lg text-xs font-mono text-zinc-200 outline-none focus:border-[#B5945B]"
                  />
                )}
              </div>

              {/* Toggle 5: Cho phép tải xuống 👑 */}
              <div className="flex items-center justify-between py-1 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-300">Cho phép tải xuống</span>
                  <span className="text-amber-400 text-xs font-bold">👑</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowDownload}
                  onChange={(e) => setAllowDownload(e.target.checked)}
                  className="w-4 h-4 accent-[#B5945B] cursor-pointer"
                />
              </div>

              {/* Toggle 6: Giới hạn số lượng ảnh được chọn */}
              <div className="py-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Giới hạn số lượng ảnh được chọn</span>
                  <input
                    type="checkbox"
                    checked={limitSelection}
                    onChange={(e) => setLimitSelection(e.target.checked)}
                    className="w-4 h-4 accent-[#B5945B] cursor-pointer"
                  />
                </div>
                {limitSelection && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-zinc-400">Số lượng ảnh tối đa:</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={maxSelectionCount}
                      onChange={(e) => setMaxSelectionCount(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 bg-black/60 border border-white/15 rounded-lg text-xs font-mono text-zinc-100 outline-none focus:border-[#B5945B]"
                    />
                    <span className="text-xs text-zinc-400">ảnh</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Modal: Pinned at bottom outside scrollable body */}
          <div className="px-6 py-4 border-t border-white/10 bg-[#0D0D10] flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-white/15 text-zinc-400 hover:text-white hover:bg-white/5 font-semibold text-xs transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 disabled:opacity-50 text-black font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-[0_0_20px_rgba(181,148,91,0.25)] inline-flex items-center gap-2"
            >
              {isSubmitting && <RefreshCw size={14} className="animate-spin text-black" />}
              <span>Tạo ngay</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
