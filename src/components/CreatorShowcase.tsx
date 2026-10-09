import React, { useState } from"react";
import { motion, AnimatePresence } from"motion/react";
import { Award, Camera, Settings, X, Save } from"lucide-react";
import { SlideData } from"../types";
import { compressImage } from"../utils/imageCompressor";
import { ImageWithFallback } from"./ImageWithFallback";
import { resolveImage } from"../utils/imageMapper";

interface CreatorShowcaseProps {
 slide: SlideData;
 isAdminGlobal?: boolean;
 onImagesBulkUpdate?: (
 images: { src: string; alt?: string; type?: string }[],
 ) => void;
}

export const CreatorShowcase: React.FC<CreatorShowcaseProps> = ({
 slide,
 isAdminGlobal,
 onImagesBulkUpdate,
}) => {
 const paragraphs = slide.body ? slide.body.split("\n\n") : [];

 // Custom admin editor state
 const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
 const [img0, setImg0] = useState("");
 const [img1, setImg1] = useState("");
 const [img2, setImg2] = useState("");
 const [img3, setImg3] = useState("");

 // Helper to safely get image source or default
 const getImageSrc = (index: number, fallback: string) => {
 const src =
 slide.images && slide.images[index]?.src
 ? slide.images[index].src
 : fallback;
 return resolveImage(src);
 };

 const openAdminPanel = () => {
 setImg0(slide.images?.[0]?.src ||"");
 setImg1(slide.images?.[1]?.src ||"");
 setImg2(slide.images?.[2]?.src ||"");
 setImg3(slide.images?.[3]?.src ||"");
 setIsAdminPanelOpen(true);
 };

 const formatImageUrl = (url: string) => {
 return resolveImage(url) || url;
 };

 const handleSaveLinks = () => {
 if (onImagesBulkUpdate) {
 const currentImages = slide.images || [];
 const newImages = [...currentImages];

 // Update image URLs with deep copy for the updated indexes
 newImages[0] = newImages[0]
 ? { ...newImages[0], src: formatImageUrl(img0) }
 : { src: formatImageUrl(img0), alt:"Founder Portrait"};
 newImages[1] = newImages[1]
 ? { ...newImages[1], src: formatImageUrl(img1) }
 : { src: formatImageUrl(img1), alt:"Gear 1"};
 newImages[2] = newImages[2]
 ? { ...newImages[2], src: formatImageUrl(img2) }
 : { src: formatImageUrl(img2), alt:"Gear 2"};
 newImages[3] = newImages[3]
 ? { ...newImages[3], src: formatImageUrl(img3) }
 : { src: formatImageUrl(img3), alt:"Gear 3"};

 onImagesBulkUpdate(newImages);
 setIsAdminPanelOpen(false); // Close panel on save
 }
 };

 return (
  <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-12 liquid-glass rounded-2xl sm:rounded-3xl overflow-hidden shadow-none relative border border-transparent">
 {/* GLOBAL ADMIN DASHBOARD for Slide 7 specific details */}
 {isAdminGlobal && (
 <>
 <div className="absolute top-4 right-4 z-40">
 <button
 onClick={openAdminPanel}
 className="px-3 py-1.5 flex items-center gap-1.5 bg-[#B5945B]/10 text-[#B5945B] border border-[#B5945B]/20 rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide hover:bg-amber-500 hover:text-black transition-all"
 >
 <Settings className="w-3.5 h-3.5"/>
 Sửa Ảnh Slide 7
 </button>
 </div>

 <AnimatePresence>
 {isAdminPanelOpen && (
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="absolute top-16 right-4 left-4 sm:left-auto sm:w-96 bg-gray-900 border border-[#B5945B]/50 rounded-xl shadow-lg z-50 overflow-hidden"
 >
 <div className="px-4 py-3 bg-black/50 border-b border-white/10 flex items-center justify-between">
 <span className="font-sans text-[11px] uppercase tracking-wide text-[#B5945B] font-semibold flex items-center gap-1.5">
 <Camera className="w-4 h-4"/> Bảng Sửa Chi Tiết (S7)
 </span>
 <button
 onClick={() => setIsAdminPanelOpen(false)}
 className="text-gray-400 hover:text-white"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>
 <div className="p-4 space-y-4 font-sans text-xs">
 {[0, 1, 2, 3].map((idx) => {
 const labels = [
"Ảnh Chân Dung (Portrait)",
"Ảnh Thiết bị / Gear 1",
"Ảnh Thiết bị / Gear 2",
"Ảnh Thiết bị / Gear 3",
 ];
 const currentImg = [img0, img1, img2, img3][idx];
 const setImg = [setImg0, setImg1, setImg2, setImg3][idx];
 return (
 <div
 key={`gear-img-edit-${idx}`}
 className="flex flex-col gap-1 p-2 border border-white/10 rounded-lg bg-black/40"
 >
 <label className="block text-gray-400 mb-1 font-medium text-[12px]">
 {labels[idx]}
 </label>
 <div className="flex flex-col gap-2 w-full">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded overflow-hidden border border-white/20 shrink-0 bg-black">
 <img
 src={resolveImage(currentImg) || undefined}
 alt="preview"
 referrerPolicy="no-referrer"loading="lazy"decoding="async"
 className="w-full h-full object-cover"
 />
 </div>
 <input
 type="file"
 accept="image/*"
 onChange={async (e) => {
 const file = e.target.files?.[0];
 if (file) {
 try {
 const compressedDataUrl =
 await compressImage(file);
 setImg(compressedDataUrl);
 } catch (err) {
 console.error(
"Image compression failed",
 err,
 );
 }
 }
 }}
 className="w-full text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[12px] file:font-bold file:uppercase file:bg-amber-500/20 file:text-amber-500 hover:file:bg-amber-500/30 cursor-pointer"
 />
 </div>
 <input
 type="text"
 placeholder="Hoặc dán Link Google Drive / URL ảnh trực tiếp..."
 value={currentImg}
 onChange={(e) => setImg(e.target.value)}
 className="w-full px-2 py-1.5 bg-black/60 border border-white/10 rounded text-[12px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
 />
 </div>
 </div>
 );
 })}
 <div className="pt-2">
 <button
 onClick={() => {
 handleSaveLinks();
 alert("Đã gửi lệnh cập nhật ảnh!");
 }}
 className="w-full py-2 bg-amber-500 text-black font-medium uppercase rounded flex items-center justify-center gap-1.5 hover:bg-amber-400"
 >
 <Save className="w-4 h-4"/> Lưu Link Ảnh
 </button>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </>
 )}

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
 {/* LEFT COLUMN: GORGEOUS PORTRAIT */}
 <div className="lg:col-span-5">
 <div className="relative group rounded-xl overflow-hidden bg-zinc-950 aspect-[3/4] shadow-lg">
 {/* Elegant Nameplate overlay card on bottom */}
 <div className="absolute bottom-4 left-4 right-4 liquid-glass-header border border-white/15 p-4 sm:p-5 rounded-2xl z-20 shadow-xl">
 <span className="font-sans text-[12px] text-zinc-400 font-medium tracking-wide block mb-1">
 Founder & Photographer
 </span>
 <h3 className="font-sans font-bold text-lg tracking-wide text-white uppercase">
 Nguyễn Đức Dũng
 </h3>
 </div>

 <ImageWithFallback
 src={getImageSrc(
 0,
"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600",
 )}
 alt="Hồ sơ Founder"
 sizes="(max-width: 1024px) 100vw, 40vw"
 style={{ objectPosition: slide.images?.[0]?.objectPosition ||"center"}}
 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
 />
 </div>
 </div>

 {/* RIGHT COLUMN: GORGEOUS BIO */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-center lg:text-left flex flex-col items-center lg:items-start">
 <div className="space-y-4">
            <h2 className="text-2xl min-[360px]:text-3xl sm:text-4xl lg:text-5xl font-sans font-extrabold text-white leading-tight tracking-tight">
 {slide.title ||"Phía sau ống kính"}
 </h2>
            <div className="w-12 h-1 bg-[#B5945B] rounded-full mx-auto lg:mx-0"/>
 </div>

          <div className="space-y-4 sm:space-y-6 text-sm sm:text-base text-zinc-200 font-normal leading-relaxed text-center lg:text-left">
 <p>
 Chào bạn, tôi là Đức Dũng — một người gieo xúc cảm qua từng thấu kính. Với hơn <strong>4 năm kinh nghiệm hoạt động tự do</strong> (Freelance Photographer), tôi tin rằng kỷ yếu không chỉ là một tệp lưu trữ hình ảnh thông qua lăng kính thông thường, mà là một cuốn phim ngắn gói trọn thanh xuân rực rỡ nhất của tập thể.
 </p>
 <p>
 Sở hữu nền tảng kiến thức từ khoa <strong>Marketing & Communication tại Melbourne Polytechnic Vietnam</strong>, sự nhạy bén giúp tôi thấu hiểu sâu sắc insight của nhân vật. Điểm mạnh lớn nhất của tôi là khả năng <strong>Storytelling qua hình ảnh</strong> và xây dựng lên những thước phim concept thống nhất, làm nổi bật hoàn toàn cá tính cũng như câu chuyện riêng biệt của từng tập thể lớp.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
};
