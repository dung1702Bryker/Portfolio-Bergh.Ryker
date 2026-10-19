import React, { useState, useRef } from "react";
import {
  X,
  Sparkles,
  Save,
  Play,
  RotateCcw,
  Upload,
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  Layers,
  Settings,
  Sliders,
  Download,
} from "lucide-react";
import { IntroConfig, IntroCardConfig, DEFAULT_INTRO_CONFIG } from "../../types/introConfig";
import { compressImage } from "../../utils/imageCompressor";
import { resolveImage, optimizeDriveImageUrl } from "../../utils/imageMapper";

interface AdminIntroEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: IntroConfig;
  onSave: (newConfig: IntroConfig) => Promise<boolean>;
  onPreview: (testConfig: IntroConfig) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const AdminIntroEditorModal: React.FC<AdminIntroEditorModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  onPreview,
  showToast,
}) => {
  const [draft, setDraft] = useState<IntroConfig>(() => ({
    ...DEFAULT_INTRO_CONFIG,
    ...config,
    cards: config.cards && config.cards.length > 0 ? [...config.cards] : [...DEFAULT_INTRO_CONFIG.cards],
  }));

  const [activeTab, setActiveTab] = useState<"cards" | "logo" | "settings">("cards");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCardChange = (idx: number, field: keyof IntroCardConfig, value: string) => {
    setDraft((prev) => {
      const newCards = [...prev.cards];
      if (newCards[idx]) {
        newCards[idx] = { ...newCards[idx], [field]: value };
      }
      return { ...prev, cards: newCards };
    });
  };

  const handleAddCard = () => {
    if (draft.cards.length >= 8) {
      showToast("Tối đa 8 thẻ ảnh để đảm bảo hiệu ứng mượt mà!", "info");
      return;
    }
    const newCard: IntroCardConfig = {
      id: `intro-card-${Date.now()}`,
      title: "Tác Phẩm Mới",
      category: "Kỷ Yếu Nghệ Thuật",
      src: "https://drive.google.com/file/d/1B6o81j7uI02iB-y-E2WpUfG35K1U0jFk/view?usp=sharing",
    };
    setDraft((prev) => ({
      ...prev,
      cards: [...prev.cards, newCard],
    }));
  };

  const handleRemoveCard = (idx: number) => {
    if (draft.cards.length <= 3) {
      showToast("Cần tối thiểu 3 thẻ ảnh để xòe quạt và hiển thị Carousel!", "info");
      return;
    }
    setDraft((prev) => ({
      ...prev,
      cards: prev.cards.filter((_, i) => i !== idx),
    }));
  };

  const handleFileUpload = async (idx: number, file: File) => {
    setUploadingIdx(idx);
    try {
      const compressed = await compressImage(file, 1200, 1600, 0.88);
      handleCardChange(idx, "src", compressed);
      showToast("Đã tối ưu và tải ảnh thành công!", "success");
    } catch (err) {
      console.error(err);
      showToast("Lỗi nén ảnh, vui lòng thử lại", "error");
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      const compressed = await compressImage(file, 600, 600, 0.9);
      setDraft((prev) => ({
        ...prev,
        logoType: "image",
        logoImageUrl: compressed,
      }));
      showToast("Đã tải logo mới!", "success");
    } catch (err) {
      showToast("Lỗi tải logo", "error");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onSave(draft);
    setIsSaving(false);
    if (success) {
      showToast("Đã lưu cấu hình Intro vào hệ thống thành công!", "success");
      onClose();
    } else {
      showToast("Lỗi lưu cấu hình, vui lòng thử lại", "error");
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm("Bạn có chắc chắn muốn đặt lại tất cả ảnh và logo Intro về mặc định không?")) {
      setDraft(DEFAULT_INTRO_CONFIG);
      showToast("Đã đặt lại về mẫu mặc định", "info");
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    try {
      const allData: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const val = localStorage.getItem(key);
          try {
            allData[key] = val ? JSON.parse(val) : val;
          } catch {
            allData[key] = val;
          }
        }
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `bergh_studio_localStorage_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast("Xuất toàn bộ localStorage ra JSON thành công!", "success");
    } catch (err) {
      console.error(err);
      showToast("Lỗi xuất dữ liệu JSON", "error");
    }
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        if (parsedData && typeof parsedData === "object") {
          for (const [key, val] of Object.entries(parsedData)) {
            localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val));
          }
          showToast("Khôi phục thành công toàn bộ dữ liệu từ JSON! Đang tải lại...", "success");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          showToast("File JSON không hợp lệ", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Lỗi đọc file JSON", "error");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#121216] border border-white/15 shadow-2xl text-white overflow-hidden font-sans">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#B5945B]/20 text-[#E5C17C] border border-[#B5945B]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Quản Lý Màn Mở Đầu (Cinematic Intro)</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-[#E5C17C] border border-[#B5945B]/30">
                  Admin
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Tùy chỉnh 5 thẻ ảnh bung xòe quạt, logo phát sáng và cài đặt hiển thị
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-white/10 bg-[#16161c]">
          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "cards"
                ? "border-[#E5C17C] text-[#E5C17C]"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>5 Thẻ Ảnh Dự Án ({draft.cards.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("logo")}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "logo"
                ? "border-[#E5C17C] text-[#E5C17C]"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Logo Mở Đầu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "settings"
                ? "border-[#E5C17C] text-[#E5C17C]"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Cài Đặt Hiển Thị</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* TAB 1: 5 CARDS EDITOR */}
          {activeTab === "cards" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Thứ tự các thẻ ảnh khi bung xòe quạt từ trái sang phải. Thẻ ở vị trí giữa (thẻ thứ 3) sẽ là thẻ chính trong Carousel.
                </p>
                <button
                  type="button"
                  onClick={handleAddCard}
                  className="px-3 py-1.5 rounded-lg bg-[#B5945B]/15 hover:bg-[#B5945B]/25 border border-[#B5945B]/30 text-[#E5C17C] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm thẻ</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {draft.cards.map((card, idx) => (
                  <div
                    key={card.id || `card-${idx}`}
                    className={`p-3.5 rounded-2xl bg-black/40 border transition-all ${
                      idx === 2
                        ? "border-[#B5945B]/70 ring-1 ring-[#B5945B]/40 bg-[#B5945B]/5"
                        : "border-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Photo Thumbnail */}
                      <div className="relative w-20 h-28 rounded-xl overflow-hidden bg-zinc-900 border border-white/15 shrink-0 group">
                        <img
                          src={optimizeDriveImageUrl(card.src, 300)}
                          alt={card.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.opacity = "0";
                          }}
                        />
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] text-white font-medium cursor-pointer transition-opacity">
                          <Upload className="w-4 h-4 mb-1 text-[#E5C17C]" />
                          <span>Đổi ảnh</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(idx, f);
                            }}
                          />
                        </label>
                        {uploadingIdx === idx && (
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-[10px] text-[#E5C17C]">
                            Đang nén...
                          </div>
                        )}
                      </div>

                      {/* Info Inputs */}
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#E5C17C]">
                            Thẻ #{idx + 1} {idx === 2 && "• (Thẻ Chính Trung Tâm)"}
                          </span>
                          {draft.cards.length > 3 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCard(idx)}
                              className="text-zinc-500 hover:text-red-400 p-1"
                              title="Xóa thẻ này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Tiêu đề dự án</label>
                          <input
                            type="text"
                            value={card.title}
                            onChange={(e) => handleCardChange(idx, "title", e.target.value)}
                            placeholder="Ví dụ: Chuyến Tàu Thanh Xuân"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-[#B5945B]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Thể loại / Nhãn (Tag)</label>
                          <input
                            type="text"
                            value={card.category}
                            onChange={(e) => handleCardChange(idx, "category", e.target.value)}
                            placeholder="Ví dụ: Kỷ Yếu Hà Nội"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-[#B5945B]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Link ảnh (URL hoặc tải lên)</label>
                          <input
                            type="text"
                            value={card.src}
                            onChange={(e) => handleCardChange(idx, "src", e.target.value)}
                            placeholder="https://drive.google.com/file/d/..."
                            className="w-full px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-white/10 text-[11px] text-zinc-300 font-mono truncate focus:outline-none focus:border-[#B5945B]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: LOGO EDITOR */}
          {activeTab === "logo" && (
            <div className="space-y-6 max-w-xl mx-auto py-2">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col items-center text-center">
                <span className="text-xs text-zinc-400 mb-3 uppercase tracking-wider font-semibold">
                  Xem Trước Logo Trung Tâm Mở Đầu
                </span>
                
                {/* Live Preview Box - Full Khung Ảnh */}
                <div className={`relative w-32 h-32 sm:w-36 sm:h-36 rounded-2xl bg-[#141418]/90 backdrop-blur-xl flex flex-col items-center justify-center border border-[#B5945B]/60 shadow-[0_0_50px_rgba(181,148,91,0.35)] mb-4 overflow-hidden ${draft.logoType === "image" && draft.logoImageUrl ? "p-0" : "p-3"}`}>
                  {draft.logoType === "image" && draft.logoImageUrl ? (
                    <img
                      src={optimizeDriveImageUrl(draft.logoImageUrl, 400)}
                      alt="Logo Preview"
                      className={`w-full h-full ${draft.logoFit === "contain" ? "object-contain p-2" : "object-cover"} rounded-2xl block transition-all`}
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none" />
                      <span className="text-4xl font-extrabold font-serif tracking-wider text-[#E5C17C] leading-none">
                        {draft.logoMonogram || "BR"}
                      </span>
                      <span className="text-[9px] font-sans font-bold tracking-[0.25em] text-zinc-400 mt-1 uppercase">
                        {draft.logoSubtitle || "STUDIO"}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="logoType"
                      checked={draft.logoType === "monogram"}
                      onChange={() => setDraft((p) => ({ ...p, logoType: "monogram" }))}
                      className="accent-[#B5945B]"
                    />
                    <span>Chữ viết tắt Monogram (BR)</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="logoType"
                      checked={draft.logoType === "image"}
                      onChange={() => setDraft((p) => ({ ...p, logoType: "image" }))}
                      className="accent-[#B5945B]"
                    />
                    <span>Dùng file ảnh logo (Full khung)</span>
                  </label>
                </div>
              </div>

              {draft.logoType === "monogram" ? (
                <div className="space-y-4 bg-zinc-900/50 p-4 rounded-2xl border border-white/10">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Chữ viết tắt chính (Monogram)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={draft.logoMonogram}
                      onChange={(e) => setDraft((p) => ({ ...p, logoMonogram: e.target.value.toUpperCase() }))}
                      placeholder="Ví dụ: BR"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white font-serif uppercase tracking-widest focus:outline-none focus:border-[#B5945B]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Dòng chữ phụ bên dưới (Subtitle)
                    </label>
                    <input
                      type="text"
                      maxLength={18}
                      value={draft.logoSubtitle}
                      onChange={(e) => setDraft((p) => ({ ...p, logoSubtitle: e.target.value.toUpperCase() }))}
                      placeholder="Ví dụ: STUDIO hoặc BERGH RYKER"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white font-sans uppercase tracking-widest focus:outline-none focus:border-[#B5945B]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 bg-zinc-900/50 p-4 rounded-2xl border border-white/10">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Đường dẫn URL ảnh Logo
                    </label>
                    <input
                      type="text"
                      value={draft.logoImageUrl || ""}
                      onChange={(e) => setDraft((p) => ({ ...p, logoImageUrl: e.target.value }))}
                      placeholder="https://... hoặc tải từ máy"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-[#B5945B]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Kiểu hiển thị ảnh trong khung:
                    </label>
                    <div className="flex items-center gap-4 text-xs">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-200">
                        <input
                          type="radio"
                          name="logoFit"
                          checked={draft.logoFit !== "contain"}
                          onChange={() => setDraft((p) => ({ ...p, logoFit: "cover" }))}
                          className="accent-[#B5945B]"
                        />
                        <span className="font-semibold text-[#E5C17C]">Tràn viền (Full 100% khung - Khuyên dùng)</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-300">
                        <input
                          type="radio"
                          name="logoFit"
                          checked={draft.logoFit === "contain"}
                          onChange={() => setDraft((p) => ({ ...p, logoFit: "contain" }))}
                          className="accent-[#B5945B]"
                        />
                        <span>Vừa vặn (Thu trọn ảnh)</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#B5945B]/20 text-[#E5C17C] border border-[#B5945B]/40 text-xs font-semibold hover:bg-[#B5945B]/30 cursor-pointer transition-all">
                      <Upload className="w-4 h-4" />
                      <span>Tải file ảnh logo từ máy tính</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleLogoUpload(f);
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-5 max-w-xl mx-auto py-2">
              {/* Enable / Disable Intro */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">Bật hiệu ứng Intro mở màn</h4>
                  <p className="text-xs text-zinc-400">
                    Khi bật, khách truy cập vào website sẽ được chào đón bằng màn bung ảnh xòe quạt và chuyển cảnh mượt mà.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => setDraft((p) => ({ ...p, enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B5945B]" />
                </label>
              </div>

              {/* Once per session setting */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white mb-0.5">Chỉ phát 1 lần trong mỗi phiên duyệt (Khuyên dùng)</h4>
                  <p className="text-xs text-zinc-400">
                    Tránh phát lại liên tục khi khách bấm tải lại trang hoặc điều hướng quay lại, tạo cảm giác chuyên nghiệp và không gây phiền.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={draft.autoPlayOnlyOncePerSession}
                    onChange={(e) => setDraft((p) => ({ ...p, autoPlayOnlyOncePerSession: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B5945B]" />
                </label>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại tất cả về mẫu mặc định ban đầu</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-white/10 bg-black/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                onPreview(draft);
              }}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 border border-white/10"
            >
              <Play className="w-4 h-4 fill-current text-[#E5C17C]" />
              <span>Xem Thử</span>
            </button>
            <button
              type="button"
              onClick={handleExportJSON}
              className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-[#E5C17C] text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 border border-amber-500/30"
              title="Xuất toàn bộ localStorage ra file JSON để sao lưu vĩnh viễn"
            >
              <Download className="w-4 h-4" />
              <span>Xuất dữ liệu gốc (Export JSON)</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportJSON}
              accept=".json"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 border border-blue-500/30"
              title="Khôi phục lại dữ liệu từ file JSON đã backup"
            >
              <Upload className="w-4 h-4" />
              <span>Khôi phục JSON (Import)</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#DFB779] via-[#F4E1B5] to-[#DFB779] text-black font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Đang lưu..." : "Lưu Cấu Hình Intro"}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
