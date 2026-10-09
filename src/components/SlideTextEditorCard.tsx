import React, { useState } from"react";
import {
 Settings,
 Save,
 Check,
 Edit3,
 Eye,
 EyeOff,
 Sparkles,
 Compass,
 Link2,
} from"lucide-react";
import { motion, AnimatePresence } from"motion/react";
import { SlideData, SlideCtaConfig } from"../types";
import { compressImage } from"../utils/imageCompressor";
import { ImagePositionControl } from"./ImagePositionControl";
import { resolveImage } from"../utils/imageMapper";
import { useAdminAuth } from"../hooks/useAdminAuth";
import { toast } from "../hooks/useToast";

interface SlideTextEditorProps {
 slide: SlideData;
 onSave: (updated: SlideData) => void;
}

export const SlideTextEditorCard: React.FC<SlideTextEditorProps> = ({
 slide,
 onSave,
}) => {
 const { isAdmin } = useAdminAuth();
 const isHeroSlide = slide.id === "S1" || slide.layout === "Hero" || slide.layout?.toLowerCase().includes("hero");
 const [isOpen, setIsOpen] = useState(false);
 const [title, setTitle] = useState(slide.title);
 const [subtitle, setSubtitle] = useState(slide.subtitle);
 const [body, setBody] = useState(slide.body);
 const [images, setImages] = useState(slide.images || []);
 const [seo, setSeo] = useState(slide.seo || { title:"", description:"", keywords:""});
 const [primaryCta, setPrimaryCta] = useState<SlideCtaConfig>(
  slide.primaryCta || { text: "", target: "" }
 );
 const [secondaryCta, setSecondaryCta] = useState<SlideCtaConfig>(
  slide.secondaryCta || { text: "", target: "" }
 );
 const [isSaved, setIsSaved] = useState(false);
 const [isOptimizing, setIsOptimizing] = useState<string | null>(null);

 React.useEffect(() => {
 setTitle(slide.title);
 setSubtitle(slide.subtitle);
 setBody(slide.body);
 setImages(slide.images || []);
 setSeo(slide.seo || { title:"", description:"", keywords:""});
 setPrimaryCta(slide.primaryCta || { text: "", target: "" });
 setSecondaryCta(slide.secondaryCta || { text: "", target: "" });
 }, [slide]);

 if (!isAdmin) {
 return null;
 }

 const handleOptimize = async (type: 'title' | 'subtitle' | 'body', currentValue: string, setter: (val: string) => void) => {
 if (!currentValue) return;
 setIsOptimizing(type);
 try {
 const res = await fetch("/api/optimize-text", {
 method:"POST",
 headers: {"Content-Type":"application/json"},
 body: JSON.stringify({ textRaw: currentValue, type }),
 });
 const data = await res.json();
 if (data.optimizedText) {
 setter(data.optimizedText);
 toast.success("AI đã tối ưu hóa văn bản thành công!");
 }
 } catch (err) {
 console.error(err);
 toast.error("Lỗi khi tối ưu hóa văn bản hoặc chưa cài API Key.");
 } finally {
 setIsOptimizing(null);
 }
 };

 const handleSave = () => {
 onSave({
 ...slide,
 title,
 subtitle,
 body,
 images,
 seo,
 ...(isHeroSlide
  ? {
     primaryCta: {
      text: primaryCta.text?.trim() || undefined,
      target: primaryCta.target?.trim() || undefined,
     },
     secondaryCta: {
      text: secondaryCta.text?.trim() || undefined,
      target: secondaryCta.target?.trim() || undefined,
     },
    }
  : {}),
 });
 setIsSaved(true);
 toast.success(`Đã lưu thay đổi cho phần "${slide.title || slide.id}" thành công!`);
 setTimeout(() => {
 setIsSaved(false);
 }, 2000);
 };

 return (
 <div className="absolute top-4 left-4 sm:top-6 sm:left-6 md:top-8 md:left-8 w-[calc(100%-32px)] sm:w-auto sm:min-w-[320px] max-w-xl z-50 font-sans text-left transition-all">
 <div className="bg-black/30 hover:bg-black/50 border border-white/10 rounded-2xl shadow-md overflow-hidden backdrop-blur-md transition-all">
 {/* Toggle Bar */}
 <div className="p-2 sm:p-2.5 flex items-center justify-between gap-3">
 <div className="flex items-center gap-2 overflow-hidden">
 <span className="flex items-center justify-center p-1.5 bg-white/5 rounded-lg text-white/50 border border-white/5 shrink-0">
 <Settings className="w-3.5 h-3.5"/>
 </span>
 <div className="text-left truncate hidden sm:block">
 <span className="text-[10px] uppercase tracking-wide text-white/40 block leading-tight">
 Section Edit [{slide.id}]
 </span>
 <span className="text-[10px] font-medium text-white/70 truncate block leading-tight">
 {slide.title}
 </span>
 </div>
 </div>

 <button
 onClick={() => setIsOpen(!isOpen)}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-medium uppercase tracking-wide transition-all cursor-pointer shrink-0 ${
 isOpen
 ?"bg-[#B5945B]/10 text-[#B5945B] border-[#B5945B]/20"
 :"bg-white/5 text-white/60 border-white/5 hover:bg-white/10 hover:text-white"
 }`}
 >
 {isOpen ? (
 <>
 <EyeOff className="w-3 h-3"/>
 <span>Đóng</span>
 </>
 ) : (
 <>
 <Edit3 className="w-3 h-3"/>
 <span>Sửa Slide</span>
 </>
 )}
 </button>
 </div>

 {/* Expandable editor body */}
 <AnimatePresence initial={false}>
 {isOpen && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height:"auto", opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.3, ease:"easeInOut"}}
 className="border-t border-white/10"
 >
 <div className="p-5 space-y-4 font-sans">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Title editor */}
 <div>
 <div className="flex items-center justify-between mb-1">
 <label className="font-sans text-[11px] text-[#B5945B] block font-medium">
 Tiêu đề chính (Title)
 </label>
 <button
 onClick={() => handleOptimize('title', title, setTitle)}
 disabled={isOptimizing === 'title' || !title}
 className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
 title="Dùng AI viết lại cho hay hơn"
 >
 <Sparkles className={`w-3 h-3 ${isOptimizing === 'title' ? 'animate-spin' : ''}`} />
 AI Tối Ưu
 </button>
 </div>
 <input
 type="text"
 className="w-full px-3 py-2 bg-black/60 rounded-xl border border-white/10 focus:border-[#B5945B] outline-none text-white text-sm"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="Nhập tiêu đề chính"
 />
 </div>

 {/* Subtitle editor */}
 <div>
 <div className="flex items-center justify-between mb-1">
 <label className="font-sans text-[11px] text-[#B5945B] block font-medium">
 Tiêu đề phụ / Phân nhánh (Subtitle)
 </label>
 <button
 onClick={() => handleOptimize('subtitle', subtitle, setSubtitle)}
 disabled={isOptimizing === 'subtitle' || !subtitle}
 className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
 title="Dùng AI viết lại cảm xúc hơn"
 >
 <Sparkles className={`w-3 h-3 ${isOptimizing === 'subtitle' ? 'animate-spin' : ''}`} />
 AI Tối Ưu
 </button>
 </div>
 <input
 type="text"
 className="w-full px-3 py-2 bg-black/60 rounded-xl border border-white/10 focus:border-[#B5945B] outline-none text-white text-sm"
 value={subtitle}
 onChange={(e) => setSubtitle(e.target.value)}
 placeholder="Nhập phụ đề/subtitle"
 />
 </div>
 </div>

 {/* Body/Paragraph description editor */}
 <div>
 <div className="flex items-center justify-between mb-1">
 <label className="font-sans text-[11px] text-[#B5945B] block font-medium">
 Mô tả / Đoạn văn bản chi tiết (Body Description)
 </label>
 <button
 onClick={() => handleOptimize('body', body, setBody)}
 disabled={isOptimizing === 'body' || !body}
 className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
 title="Dùng AI trau chuốt câu từ"
 >
 <Sparkles className={`w-3 h-3 ${isOptimizing === 'body' ? 'animate-spin' : ''}`} />
 AI Viết Lại (Hay Hơn)
 </button>
 </div>
 <textarea
 rows={3}
 className="w-full px-3 py-2 bg-black/60 rounded-xl border border-white/10 focus:border-[#B5945B] outline-none text-white text-sm resize-none leading-relaxed"
 value={body}
 onChange={(e) => setBody(e.target.value)}
 placeholder="Nhập nội dung mô tả của slide"
 />
 </div>

 {/* Hero CTA Button Links (Optional fields for Primary 'Book' and Secondary 'Explore' buttons) */}
 {isHeroSlide && (
 <div className="border border-[#B5945B]/30 rounded-xl p-4 bg-[#B5945B]/5 space-y-3.5">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[#B5945B]/15">
 <h4 className="font-sans text-[12px] text-[#B5945B] uppercase font-semibold tracking-wider flex items-center gap-2">
 <Compass className="w-3.5 h-3.5 text-[#B5945B]" />
 Cấu hình Nút Hero (CTA Navigation Buttons)
 </h4>
 <span className="text-[10px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/5 w-fit">
 Tùy chọn điều hướng trang bìa
 </span>
 </div>

 <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
 Tùy chỉnh nhãn hiển thị và đích đến khi người xem bấm vào nút <strong>Thao tác chính (Book/Đặt lịch)</strong> hoặc <strong>Thao tác phụ (Explore/Khám phá)</strong>. Để trống sẽ dùng liên kết mặc định.
 </p>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* Primary CTA (Book Button) */}
 <div className="p-3 bg-black/50 rounded-xl border border-white/10 space-y-2.5">
 <div className="flex items-center justify-between">
 <span className="text-xs font-semibold text-white flex items-center gap-1.5">
 <span className="w-2 h-2 rounded-full bg-[#B5945B] animate-pulse"></span>
 Nút Chính (Primary CTA)
 </span>
 <span className="text-[10px] text-[#B5945B] font-mono">Mặc định: 'Đặt Lịch' → S9</span>
 </div>

 <div>
 <label className="text-[11px] text-zinc-400 font-sans mb-1 block font-medium">
 Tên nút hiển thị (Button Text)
 </label>
 <input
 type="text"
 className="w-full px-3 py-1.5 bg-black/60 rounded-lg border border-white/10 focus:border-[#B5945B] outline-none text-white text-xs placeholder:text-zinc-600"
 value={primaryCta.text || ""}
 onChange={(e) => setPrimaryCta({ ...primaryCta, text: e.target.value })}
 placeholder="Mặc định: Đặt Lịch Ngay / Book"
 />
 </div>

 <div>
 <label className="text-[11px] text-zinc-400 font-sans mb-1 block font-medium">
 Đích đến điều hướng (Slide ID hoặc URL)
 </label>
 <div className="relative">
 <input
 type="text"
 className="w-full pl-7 pr-3 py-1.5 bg-black/60 rounded-lg border border-white/10 focus:border-[#B5945B] outline-none text-white text-xs font-mono placeholder:text-zinc-600"
 value={primaryCta.target || ""}
 onChange={(e) => setPrimaryCta({ ...primaryCta, target: e.target.value })}
 placeholder="Mặc định: S9 (hoặc link https://...)"
 />
 <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
 </div>
 </div>

 <div>
 <span className="text-[10px] text-zinc-500 block mb-1.5 font-sans">Chọn nhanh đích đến:</span>
 <div className="flex flex-wrap gap-1">
 {[
 { label: "S9 (Form Đặt Lịch)", value: "S9" },
 { label: "S8 (Concept Tự Do)", value: "S8" },
 { label: "S4 (Kỷ Yếu THPT)", value: "S4" },
 { label: "S6 (Sự Kiện & Prom)", value: "S6" },
 { label: "S7 (Về Creator)", value: "S7" },
 ].map((preset, pIdx) => (
 <button
 key={`pri-preset-${preset.value}-${pIdx}`}
 type="button"
 onClick={() => setPrimaryCta({ ...primaryCta, target: preset.value })}
 className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
 (primaryCta.target || "S9") === preset.value
 ? "bg-[#B5945B]/20 border-[#B5945B] text-[#B5945B] font-medium"
 : "bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
 }`}
 >
 {preset.label}
 </button>
 ))}
 </div>
 </div>
 </div>

 {/* Secondary CTA (Explore Button) */}
 <div className="p-3 bg-black/50 rounded-xl border border-white/10 space-y-2.5">
 <div className="flex items-center justify-between">
 <span className="text-xs font-semibold text-white flex items-center gap-1.5">
 <span className="w-2 h-2 rounded-full bg-white/60"></span>
 Nút Phụ (Secondary CTA)
 </span>
 <span className="text-[10px] text-zinc-400 font-mono">Mặc định: 'Khám Phá' → S8</span>
 </div>

 <div>
 <label className="text-[11px] text-zinc-400 font-sans mb-1 block font-medium">
 Tên nút hiển thị (Button Text)
 </label>
 <input
 type="text"
 className="w-full px-3 py-1.5 bg-black/60 rounded-lg border border-white/10 focus:border-[#B5945B] outline-none text-white text-xs placeholder:text-zinc-600"
 value={secondaryCta.text || ""}
 onChange={(e) => setSecondaryCta({ ...secondaryCta, text: e.target.value })}
 placeholder="Mặc định: Khám Phá / Explore"
 />
 </div>

 <div>
 <label className="text-[11px] text-zinc-400 font-sans mb-1 block font-medium">
 Đích đến điều hướng (Slide ID hoặc URL)
 </label>
 <div className="relative">
 <input
 type="text"
 className="w-full pl-7 pr-3 py-1.5 bg-black/60 rounded-lg border border-white/10 focus:border-[#B5945B] outline-none text-white text-xs font-mono placeholder:text-zinc-600"
 value={secondaryCta.target || ""}
 onChange={(e) => setSecondaryCta({ ...secondaryCta, target: e.target.value })}
 placeholder="Mặc định: S8 (hoặc S4, S5...)"
 />
 <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
 </div>
 </div>

 <div>
 <span className="text-[10px] text-zinc-500 block mb-1.5 font-sans">Chọn nhanh đích đến:</span>
 <div className="flex flex-wrap gap-1">
 {[
 { label: "S8 (Concept Tự Do)", value: "S8" },
 { label: "S4 (Kỷ Yếu THPT)", value: "S4" },
 { label: "S5 (Mosaic Gallery)", value: "S5" },
 { label: "S6 (Sự Kiện & Prom)", value: "S6" },
 { label: "S9 (Form Đặt Lịch)", value: "S9" },
 ].map((preset, pIdx) => (
 <button
 key={`sec-preset-${preset.value}-${pIdx}`}
 type="button"
 onClick={() => setSecondaryCta({ ...secondaryCta, target: preset.value })}
 className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
 (secondaryCta.target || "S8") === preset.value
 ? "bg-[#B5945B]/20 border-[#B5945B] text-[#B5945B] font-medium"
 : "bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
 }`}
 >
 {preset.label}
 </button>
 ))}
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* SEO Configuration */}
 <div className="border border-indigo-500/20 rounded-xl p-4 bg-indigo-500/5">
 <h4 className="font-sans text-[12px] text-indigo-400 uppercase font-medium tracking-wide mb-3 flex items-center gap-2">
 <Sparkles className="w-3.5 h-3.5"/>
 SEO Metadata (Thay đổi khi người dùng xem slide này)
 </h4>
 <div className="space-y-3">
 <div>
 <label className="text-[12px] text-zinc-400 font-sans mb-1 block">SEO Title</label>
 <input
 type="text"
 className="w-full px-3 py-1.5 bg-black/60 rounded-lg border border-indigo-500/20 focus:border-indigo-500 outline-none text-white text-xs"
 value={seo.title ||""}
 onChange={(e) => setSeo({ ...seo, title: e.target.value })}
 placeholder="VD: Bergh.Ryker - Bảng Giá Chụp Ảnh"
 />
 </div>
 <div>
 <label className="text-[12px] text-zinc-400 font-sans mb-1 block">SEO Description</label>
 <textarea
 rows={2}
 className="w-full px-3 py-1.5 bg-black/60 rounded-lg border border-indigo-500/20 focus:border-indigo-500 outline-none text-white text-xs resize-none"
 value={seo.description ||""}
 onChange={(e) => setSeo({ ...seo, description: e.target.value })}
 placeholder="Mô tả cho công cụ tìm kiếm..."
 />
 </div>
 <div>
 <label className="text-[12px] text-zinc-400 font-sans mb-1 block">SEO Keywords</label>
 <input
 type="text"
 className="w-full px-3 py-1.5 bg-black/60 rounded-lg border border-indigo-500/20 focus:border-indigo-500 outline-none text-white text-xs"
 value={seo.keywords ||""}
 onChange={(e) => setSeo({ ...seo, keywords: e.target.value })}
 placeholder="kỷ yếu, nhiếp ảnh, bergh ryker..."
 />
 </div>
 </div>
 </div>

 {/* Image Manager with File Upload */}
 <div className="mt-4 border-t border-white/10 pt-4">
 <div className="flex items-center justify-between mb-2">
 <label className="font-sans text-[11px] text-[#B5945B] block font-medium">
 Quản lý Ảnh (Thay ảnh hiển thị)
 </label>
 <button
 type="button"
 onClick={() => setImages([...images, { src:"", alt:"Ảnh mới", type:"Thêm tự động"}])}
 className="px-2 py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-white rounded border border-white/10 transition-colors"
 >
 + Thêm Ảnh
 </button>
 </div>
 {images.length === 0 ? (
 <p className="text-[12px] text-zinc-500 italic mb-2">Slide này chưa có ảnh. Nhấn"Thêm Ảnh"để bắt đầu.</p>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {images.map((img, idx) => (
 <div
 key={`slide-img-${img.src || idx}-${idx}`}
 className="flex flex-col gap-1 p-2 border border-white/10 rounded-xl bg-black/40"
 >
 <div className="flex items-center justify-between mb-1">
 <label className="text-[12px] text-zinc-300 font-sans">
 Ảnh {idx + 1} {img.alt ? `- ${img.alt}` :""}
 </label>
 <button
 type="button"
 onClick={() => {
 const newImages = [...images];
 newImages.splice(idx, 1);
 setImages(newImages);
 }}
 className="text-[11px] text-red-400 hover:text-red-300 transition-colors uppercase font-medium"
 >
 Xóa
 </button>
 </div>
 <div className="flex flex-col gap-2.5">
 <div className="flex items-start gap-3">
 <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-black shadow-inner flex items-center justify-center">
 {img.src ? (
 <img
 src={resolveImage(img.src) || undefined}
 alt="thumbnail"
 referrerPolicy="no-referrer"loading="lazy"decoding="async"
 className="w-full h-full object-cover"
 style={{ objectPosition: img.objectPosition || "center"}}
 />
 ) : (
 <span className="text-[10px] text-zinc-600">No image</span>
 )}
 </div>
 <div className="flex-1 space-y-2">
              {/* Direct link option (Google Drive, Web URL) */}
              <div>
                <span className="text-[10px] text-zinc-400 font-sans block mb-1">Dán Link Google Drive / Link Ảnh trực tiếp:</span>
 <input
 type="text"
 className="w-full px-2 py-1.5 bg-black/60 rounded-lg border border-white/10 focus:border-[#B5945B] outline-none text-white text-xs placeholder:text-zinc-600"
 placeholder="https://drive.google.com/file/d/... hoặc link ảnh"
 value={img.src && img.src.startsWith("data:") ? "" : img.src || ""}
 onChange={(e) => {
 const val = e.target.value;
 const newImages = [...images];
 newImages[idx] = {
 ...newImages[idx],
 src: val,
 };
 setImages(newImages);
 }}
 />
 <span className="text-[9px] text-[#B5945B]/80 block mt-0.5 leading-tight">
 *Hệ thống tự động chuyển đổi định dạng link Google Drive sang ảnh hiển thị trực tiếp siêu sắc nét và tải cực nhanh.
 </span>
 </div>
 </div>
 </div>
 <div className="mt-2 w-[160px]">
 <ImagePositionControl
 src={resolveImage(img.src) ||""}
 value={img.objectPosition ||"center"}
 onChange={(val) => {
 const newImages = [...images];
 newImages[idx] = { ...newImages[idx], objectPosition: val };
 setImages(newImages);
 }}
 />
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Action panel */}
 <div className="flex items-center justify-between pt-1 border-t border-white/5">
 <span className="font-sans text-[11px] text-zinc-500 flex items-center gap-1">
 <Sparkles className="w-3 h-3 text-amber-500"/>
 Bấm lưu để cập nhật trực quan tới slide tương ứng.
 </span>

 <button
 onClick={handleSave}
 className={`flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-[11px] font-sans font-medium uppercase tracking-wide transition-all cursor-pointer ${
 isSaved
 ?"bg-emerald-600 border border-emerald-500 text-white"
 :"bg-[#B5945B] text-white hover:bg-[#a3834e]"
 }`}
 >
 {isSaved ? (
 <>
 <Check className="w-3.5 h-3.5 animate-bounce"/>
 <span>Đã lưu chữ!</span>
 </>
 ) : (
 <>
 <Save className="w-3.5 h-3.5"/>
 <span>Lưu chữ</span>
 </>
 )}
 </button>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </div>
 );
};
