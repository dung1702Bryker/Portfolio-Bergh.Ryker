import React, { useState, useEffect } from"react";
import {
 Focus,
 Heart,
 Play,
 Pause,
 ChevronLeft,
 ChevronRight,
 ZoomIn,
 X,
 Sparkles,
 Calendar,
 Trash2,
 Plus,
 RotateCcw,
 Check,
 Save,
 Lock,
 Unlock,
 Settings,
 Image as ImageIcon,
 AlertTriangle,
} from"lucide-react";
import { motion, AnimatePresence } from"motion/react";
import { SlideData } from"../types";
import localforage from"localforage";
import { resolveImage } from"../utils/imageMapper";
const regeneratedImageS6 = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1000";
import { db, handleFirestoreError, OperationType } from"../firebase";
import { useAdminAuth } from"../hooks/useAdminAuth";
import { doc, onSnapshot, setDoc } from"firebase/firestore";
import { compressImage } from"../utils/imageCompressor";
import { ImageWithFallback } from"./ImageWithFallback";

interface EventSplitDashboardProps {
 slide: SlideData;
 isAdminGlobal?: boolean;
}

interface AlbumImage {
 src: string;
 alt: string;
 title: string;
 desc: string;
 shutter: string;
 aperture: string;
 iso: string;
}

export const EventSplitDashboard: React.FC<EventSplitDashboardProps> = ({
 slide,
 isAdminGlobal,
}) => {
 const [selectedIndex, setSelectedIndex] = useState(0);
 const [isAutoplay, setIsAutoplay] = useState(false);
 const [isLightboxOpen, setIsLightboxOpen] = useState(false);
 const [likedMap, setLikedMap] = useState<{ [key: number]: boolean }>({});
 const [likeCount, setLikeCount] = useState<{ [key: number]: number }>({
 0: 524,
 1: 341,
 2: 418,
 });

 // Admin states
 const [isAdminMode, setIsAdminMode] = useState(false);

 // Synchronize with global admin state
 useEffect(() => {
 if (isAdminGlobal !== undefined) {
 setIsAdminMode(isAdminGlobal);
 }
 }, [isAdminGlobal]);

 const [adminTab, setAdminTab] = useState<"list"|"edit"|"add">("list");
 const [saveSuccess, setSaveSuccess] = useState(false);

 // States for adding a new album/photo
 const [newTitle, setNewTitle] = useState("");
 const [newDesc, setNewDesc] = useState("");
 const [newSrc, setNewSrc] = useState("");
 const [newShutter, setNewShutter] = useState("1/125s");
 const [newAperture, setNewAperture] = useState("F/2.0");
 const [newIso, setNewIso] = useState("400");
 const [addError, setAddError] = useState("");

 const images = slide.images;
 const image0 =
 regeneratedImageS6 ||
 (images[0]?.src
 ? resolveImage(images[0].src)
 :"https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=1200");

 const defaultAlbums: AlbumImage[] = [
 {
 src: image0,
 alt:"Graduation Moment",
 title:"GRADUATION CEREMONY BTEC FPT",
 desc:"Cột mốc thiêng liêng và trang trọng của các tân cử nhân. Những nụ cười rạng rỡ, giọt nước mắt hạnh phúc và giây phút tung mũ đầy tự hào được cảm nhận và ghi lại qua lăng kính đầy nghệ thuật.",
 shutter:"1/160s",
 aperture:"F/2.0",
 iso:"200",
 },
 {
 src: images[1]?.src
 ? resolveImage(images[1].src)
 :"https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=800",
 alt:"Campfire Warm Documentary",
 title:"Lửa Trại Gắn Kết",
 desc:"Những quầng lửa ấm bập bùng chiếu rọi hàng trăm gương mặt rạng rỡ kề vai hát ca. Tông màu nóng ấm, tương phản tự nhiên của ánh lửa hồng mang đến sự gần gũi, kết chặt tình bạn bè.",
 shutter:"1/60s",
 aperture:"F/1.4",
 iso:"3200",
 },
 {
 src: images[2]?.src
 ? resolveImage(images[2].src)
 :"https://images.unsplash.com/photo-1484820540004-14229fe36ca4?auto=format&fit=crop&q=80&w=800",
 alt:"Deep Emotion Documentary",
 title:"Cầm Tay Hẹn Ước",
 desc:"Giọt nước mắt chia tay, những cái ôm ghì chặt đẫm mồ hôi của các sĩ tử trước kỳ thi lớn. Sự thấu cảm trọn vẹn của phóng viên tài liệu mang lại những khung ảnh giàu sức sống, đong đầy xúc cảm.",
 shutter:"1/160s",
 aperture:"F/2.0",
 iso:"800",
 },
 ];

 const LOCAL_STORAGE_KEY ="bergh_ryker_event_albums_v3";

 const [albumImages, setAlbumImages] = useState<AlbumImage[]>(defaultAlbums);

 const { isAdmin: globalAdminMode } = useAdminAuth();

 useEffect(() => {
 const docRef = doc(db,"appStore","eventAlbums");
 const unsubscribe = onSnapshot(
 docRef, 
 async (docSnap) => {
 if (docSnap.exists()) {
 let data = docSnap.data()?.albums;
 if (data && Array.isArray(data) && data.length > 0) {
 // Cleanup wrong data (TECHVIFY) mapped incorrectly from another album
 data = data.map((item: any) => {
 if (item.alt?.includes("TECHVIFY") || item.title?.includes("TECHVIFY")) {
 return {
 ...item,
 alt:"Graduation Moment",
 title:"GRADUATION CEREMONY BTEC FPT",
 src: image0
 };
 }
 return item;
 });
 setAlbumImages(data);
 }
 } else {
 // Fallback or migration
 let initialData = defaultAlbums;
 try {
 const saved = await localforage.getItem<string>(LOCAL_STORAGE_KEY);
 if (saved) {
 const parsed = JSON.parse(saved);
 if (Array.isArray(parsed) && parsed.length > 0) {
 initialData = parsed.map((item: any) => {
 if (item.alt?.includes("TECHVIFY") || item.title?.includes("TECHVIFY")) {
 return {
 ...item,
 alt:"Graduation Moment",
 title:"GRADUATION CEREMONY BTEC FPT",
 src: image0
 };
 }
 return item;
 });
 }
 }
 } catch (e) {
 console.error(e);
 }
 setAlbumImages(initialData);
 }
 },
 (error) => {
 handleFirestoreError(error, OperationType.GET,"appStore/eventAlbums");
 }
 );

 return () => unsubscribe();
 }, []); // dependencies can run once

 // Watch selectedIndex bounds safety
 useEffect(() => {
 if (selectedIndex >= albumImages.length) {
 setSelectedIndex(0);
 }
 }, [albumImages.length, selectedIndex]);

 // Auto-save albumImages to local storage and Firestore when changed
 useEffect(() => {
 const saveToCloud = async () => {
 try {
 await localforage.setItem(
 LOCAL_STORAGE_KEY,
 JSON.stringify(albumImages),
 );
 if (globalAdminMode) {
 const payloadSize = JSON.stringify(albumImages).length;
 if (payloadSize < 900000) {
 await setDoc(doc(db,"appStore","eventAlbums"), {
 albums: albumImages,
 });
 } else {
 console.warn(
 `Payload too large for Firestore (${payloadSize} bytes). Allowed up to ~1MB. Only saved locally.`,
 );
 }
 }
 } catch (e) {
 console.error("Lỗi khi lưu album trường học:", e);
 }
 };
 saveToCloud();
 }, [albumImages, globalAdminMode]);

 // Handle autoplay loop
 useEffect(() => {
 let interval: any = null;
 if (isAutoplay && albumImages.length > 0) {
 interval = setInterval(() => {
 setSelectedIndex((prev) => (prev + 1) % albumImages.length);
 }, 3500);
 }
 return () => {
 if (interval) clearInterval(interval);
 };
 }, [isAutoplay, albumImages.length]);

 const handleNextImage = () => {
 if (albumImages.length === 0) return;
 setSelectedIndex((prev) => (prev + 1) % albumImages.length);
 setIsAutoplay(false);
 };

 const handlePrevImage = () => {
 if (albumImages.length === 0) return;
 setSelectedIndex(
 (prev) => (prev - 1 + albumImages.length) % albumImages.length,
 );
 setIsAutoplay(false);
 };

 const toggleLike = (index: number) => {
 setLikedMap((prev) => {
 const current = prev[index];
 setLikeCount((counts) => ({
 ...counts,
 [index]: current ? (counts[index] || 1) - 1 : (counts[index] || 0) + 1,
 }));
 return {
 ...prev,
 [index]: !current,
 };
 });
 };

 // Admin edits active image in the state list
 const updateActiveImageField = (field: keyof AlbumImage, value: string) => {
 setAlbumImages((prev) => {
 const updated = [...prev];
 if (updated[selectedIndex]) {
 updated[selectedIndex] = {
 ...updated[selectedIndex],
 [field]: value,
 };
 }
 return updated;
 });
 };

 // Add new image moment to the album
 const handleAddNewMoment = (e: React.FormEvent) => {
 e.preventDefault();
 setAddError("");

 if (!newTitle.trim()) {
 setAddError("⚠️ Vui lòng nhập tiêu đề cho khoảnh khắc.");
 return;
 }
 if (!newDesc.trim()) {
 setAddError("⚠️ Vui lòng nhập mô tả chi tiết.");
 return;
 }

 // Fallback beautiful image if left empty
 const finalSrc =
 newSrc.trim() ||
 `https://images.unsplash.com/photo-${
 [
"1511795409834-ef04bbd61622",
"1516450360452-9312f5e86fc7",
"1464366400600-7168b8af9bc3",
"1501281668745-f7f57925c3b4",
 ][Math.floor(Math.random() * 4)]
 }?auto=format&fit=crop&q=80&w=1200`;

 const newMoment: AlbumImage = {
 src: finalSrc,
 alt: newTitle,
 title: newTitle,
 desc: newDesc,
 shutter: newShutter ||"1/125s",
 aperture: newAperture ||"F/2.8",
 iso: newIso ||"400",
 };

 setAlbumImages((prev) => [...prev, newMoment]);

 // Clear form
 setNewTitle("");
 setNewDesc("");
 setNewSrc("");
 setNewShutter("1/125s");
 setNewAperture("F/2.0");
 setNewIso("400");

 // Auto navigate to the newly added image
 setSelectedIndex(albumImages.length);
 triggerSuccessBanner();
 };

 // Delete dynamic scene
 const handleDeleteMoment = (indexToDelete: number) => {
 if (albumImages.length <= 1) {
 alert("⚠️ Album hệ thống cần duy trì ít nhất 1 hình ảnh làm tâm điểm!");
 return;
 }

 // In iframe, window.confirm is bypassed
 const confirmDelete = true;
 if (!confirmDelete) return;

 setAlbumImages((prev) => {
 const filtered = prev.filter((_, idx) => idx !== indexToDelete);
 return filtered;
 });

 setSelectedIndex((prevIndex) => {
 if (indexToDelete === prevIndex) {
 return Math.max(0, indexToDelete - 1);
 } else if (indexToDelete < prevIndex) {
 return prevIndex - 1;
 }
 return prevIndex;
 });

 triggerSuccessBanner();
 };

 // Persist current state list into localStorage
 const saveStateToLocalStorage = async () => {
 try {
 await localforage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(albumImages));
 triggerSuccessBanner();
 } catch (e) {
 console.error(e);
 alert("⚠️ Không thể lưu cấu hình do giới hạn trình duyệt.");
 }
 };

 // Reset to static system defaults
 const handleResetToDefaults = async () => {
 // In iframe, window.confirm is bypassed
 const confirmReset = true;
 if (!confirmReset) return;

 await localforage.removeItem(LOCAL_STORAGE_KEY);
 setAlbumImages(defaultAlbums);
 setSelectedIndex(0);
 triggerSuccessBanner();
 };

 const triggerSuccessBanner = () => {
 setSaveSuccess(true);
 setTimeout(() => {
 setSaveSuccess(false);
 }, 3000);
 };

 // Direct presets helper to quickly insert beautiful school imagery URLs
 const handleQuickPresetUrl = (url: string) => {
 setNewSrc(url);
 };

 return (
 <div className="w-full font-sans">
 {/* Dynamic Success Notification */}
 <AnimatePresence>
 {saveSuccess && (
 <motion.div
 initial={{ opacity: 0, y: -20 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -20 }}
 className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-white/10 text-white px-5 py-3 rounded-full shadow-glow flex items-center gap-2"
 >
 <Check className="w-4 h-4 text-emerald-400"/>
 <span className="text-[11px] font-sans font-medium uppercase tracking-wide">
 Hệ thống đã đồng bộ & cập nhật thành công!
 </span>
 </motion.div>
 )}
 </AnimatePresence>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
 {/* 1. VIEWER SIDE: Spans 7 cols */}
 <div className="lg:col-span-7 flex flex-col gap-5 text-left order-2 lg:order-1">
 {albumImages.length > 0 ? (
 <>
 {/* Main active image frame */}
 <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 p-3 rounded-2xl relative shadow-md group">
 {/* Viewport canvas with aspect 16:10 */}
 <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-gray-950 flex items-center justify-center">
 <AnimatePresence>
 <motion.img
 key={`event-split-img-${selectedIndex}-${albumImages[selectedIndex]?.src || ''}`}
 initial={{ opacity: 0.4, scale: 1.02 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ duration: 0.35 }}
 drag="x"
 dragConstraints={{ left: 0, right: 0 }}
 dragElastic={0.7}
 onDragEnd={(_event, info) => {
 const swipeThreshold = 50;
 if (info.offset.x < -swipeThreshold) {
 handleNextImage();
 } else if (info.offset.x > swipeThreshold) {
 handlePrevImage();
 }
 }}
 src={resolveImage(albumImages[selectedIndex]?.src ||"") || undefined}
 alt={
 albumImages[selectedIndex]?.alt ||"School Album Focus"
 }
 className="absolute inset-0 w-full h-full object-cover select-none cursor-grab active:cursor-grabbing"
 referrerPolicy="no-referrer" loading="eager" fetchPriority="high"decoding="async"
 />
 </AnimatePresence>

 {/* Gradient overlays */}
 <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 pointer-events-none"/>

 {/* Overlay elements inside frame */}
 <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-auto">
 {/* Heart Button */}
 <button
 onClick={() => toggleLike(selectedIndex)}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold font-sans transition-all backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95 ${
 likedMap[selectedIndex]
 ?"bg-red-500/95 text-white border-red-500"
 :"bg-black/45 text-zinc-100 border-white/10 hover:bg-black/60"
 }`}
 >
 <Heart
 className={`w-3.5 h-3.5 ${likedMap[selectedIndex] ?"fill-current text-white":""}`}
 />
 <span>{likeCount[selectedIndex] || 0} THÍCH</span>
 </button>

 {/* Lightbox / Fullscreen trigger */}
 <button
 onClick={() => setIsLightboxOpen(true)}
 className="p-2 rounded-full border border-white/10 bg-black/45 hover:bg-black/60 text-white backdrop-blur-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
 title="Phóng to ảnh"
 >
 <ZoomIn className="w-4 h-4"/>
 </button>
 </div>

 {/* Bottom Frame Narrative Banner Overlaid inside picture */}
 <div className="absolute bottom-4 left-4 right-4 z-10 text-left bg-black/55 backdrop-blur-md p-3.5 rounded-xl border border-white/10 text-white">
 <div className="flex items-center justify-between">
 <h5 className="font-sans font-bold text-sm text-white truncate max-w-xs sm:max-w-md uppercase tracking-wide">
 {albumImages[selectedIndex]?.title}
 </h5>
 <span className="font-sans text-[11px] bg-[#B5945B] text-white px-2 py-0.5 rounded font-bold shrink-0">
 SỰ KIỆN{""}
 {(selectedIndex + 1).toString().padStart(2,"0")}
 </span>
 </div>

 <div className="flex items-center gap-3 mt-2 pr-1 pt-2 border-t border-white/10 text-[11px] font-sans text-gray-300">
 <span className="flex items-center gap-1">
 <Focus className="w-3 h-3 text-[#B5945B]"/>
 shutter: {albumImages[selectedIndex]?.shutter}
 </span>
 <span>•</span>
 <span>
 aperture: {albumImages[selectedIndex]?.aperture}
 </span>
 <span>•</span>
 <span>ISO: {albumImages[selectedIndex]?.iso}</span>
 <span className="hidden sm:inline text-gray-500">•</span>
 <span className="hidden sm:inline text-amber-400 font-sans tracking-wide">
 💡 Gạt/vuốt để chuyển ảnh
 </span>
 </div>
 </div>
 </div>

 {/* Viewer Controls */}
 <div className="flex items-center justify-between mt-3 px-1 text-xs text-gray-500">
 {/* Autoplay Toggle */}
 <button
 onClick={() => setIsAutoplay((prev) => !prev)}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer text-[11px] font-sans font-medium uppercase tracking-wide ${
 isAutoplay
 ?"bg-amber-50 text-amber-800 border-amber-200 shadow-sm"
 :"bg-gray-50 text-gray-500 border-gray-150 hover:bg-gray-100"
 }`}
 >
 {isAutoplay ? (
 <Pause className="w-3 h-3 text-red-600 fill-red-600"/>
 ) : (
 <Play className="w-3 h-3 text-emerald-600 fill-emerald-600"/>
 )}
 <span>{isAutoplay ?"Đang phát":"Tự động phát"}</span>
 </button>

 {/* Progress Indicator Dots */}
 <div className="flex items-center gap-1.5">
 {albumImages.map((_, dotIdx) => (
 <button
 key={`split-dot-${dotIdx}`}
 onClick={() => {
 setSelectedIndex(dotIdx);
 setIsAutoplay(false);
 }}
 className={`h-2 rounded-full cursor-pointer transition-all ${
 selectedIndex === dotIdx
 ?"w-6 bg-[#B5945B]"
 :"w-2 bg-gray-300 hover:bg-gray-400"
 }`}
 title={`Chuyển đến ảnh ${dotIdx + 1}`}
 />
 ))}
 </div>

 {/* Navigation Buttons */}
 <div className="flex items-center gap-1">
 <button
 onClick={handlePrevImage}
 className="p-1 px-2 border border-gray-200 rounded hover:bg-gray-50 active:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
 title="Ảnh trước"
 >
 <ChevronLeft className="w-3.5 h-3.5"/>
 </button>
 <span className="font-sans text-[12px] min-w-[32px] text-center font-bold">
 {selectedIndex + 1} / {albumImages.length}
 </span>
 <button
 onClick={handleNextImage}
 className="p-1 px-2 border border-gray-200 rounded hover:bg-gray-50 active:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
 title="Ảnh tiếp"
 >
 <ChevronRight className="w-3.5 h-3.5"/>
 </button>
 </div>
 </div>
 </div>

 {/* Dynamic Thumbnail Strip */}
 <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
 {albumImages.map((item, idx) => (
 <div
 key={`thumb-${item.src || idx}-${idx}`}
 onClick={() => {
 setSelectedIndex(idx);
 setIsAutoplay(false);
 }}
 className={`relative aspect-[16/10] rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
 selectedIndex === idx
 ?"border-[#B5945B] shadow-sm ring-1 ring-[#B5945B]/15"
 :"border-transparent hover:border-gray-200 hover:scale-[1.01]"
 }`}
 >
 <ImageWithFallback
 preset="thumbnail"
 targetWidth={280}
 src={resolveImage(item.src)}
 alt={item.title}
 sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
 className="w-full h-full object-cover"
 />
 {selectedIndex !== idx && (
 <div className="absolute inset-0 bg-black/15 hover:bg-transparent"/>
 )}
 <div className="absolute top-1 left-1 pb-0.5 px-1 rounded bg-black/60 text-white text-[11px] font-sans whitespace-nowrap">
 #{idx + 1}
 </div>

 {/* Direct quick delete action for admin */}
 {isAdminMode && albumImages.length > 1 && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteMoment(idx);
 }}
 className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded shadow-md z-10 cursor-pointer transition-colors"
 title="Xoá khoảnh khắc này khỏi bảng tin"
 >
 <Trash2 className="w-3 h-3"/>
 </button>
 )}
 </div>
 ))}
 </div>
 </>
 ) : (
 <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-16 text-center text-gray-500">
 <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4 animate-bounce"/>
 <p className="text-sm font-medium">
 Không tìm thấy ảnh nào trong album sự kiện.
 </p>
 <button
 onClick={handleResetToDefaults}
 className="mt-4 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors"
 >
 Khôi phục định dạng mẫu
 </button>
 </div>
 )}
 </div>

 {/* 2. TEXT/DETAILS SIDE: Spans 5 cols */}
 <div className="lg:col-span-5 flex flex-col gap-6 order-1 lg:order-2">
 <motion.div
 initial={{ opacity: 0, x: 25 }}
 whileInView={{ opacity: 1, x: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.7 }}
 className="liquid-glass border border-white/10 p-8 rounded-tech shadow-lg text-left"
 >
 <span className="font-sans text-xs uppercase tracking-wide text-[#B5945B] mb-2 block font-bold flex items-center gap-1.5">
 <Calendar className="w-3.5 h-3.5 text-[#B5945B]"/>
 {slide.subtitle}
 </span>
 <h2 className="font-sans font-bold text-3xl tracking-editorial uppercase text-white mb-4 leading-snug py-0.5">
 {slide.title}
 </h2>
 <p className="text-gray-100 text-sm leading-relaxed mb-6 font-normal">
 {slide.body}
 </p>

 {/* Selected Scene Context Banner */}
 {albumImages[selectedIndex] && (
 <div className="p-4 rounded-xl bg-black/40 border border-white/10 relative overflow-hidden">
 <div className="absolute top-0 right-0 p-1 bg-amber-400/10 border-b border-l border-amber-400/20 text-amber-400 font-sans text-[11px] tracking-wide uppercase font-semibold">
 Active Scene Info
 </div>
 <span className="font-sans text-[11px] text-[#B5945B] font-medium uppercase">
 Đang hiển thị phân cảnh: 0{selectedIndex + 1}
 </span>
 <h4 className="font-sans font-bold text-sm text-white mt-1 uppercase">
 {albumImages[selectedIndex].title?.toUpperCase()}
 </h4>
 <p className="text-xs text-gray-300 mt-2 font-normal leading-relaxed">
 {albumImages[selectedIndex].desc}
 </p>

 {/* Admin quick access delete */}
 {isAdminMode && (
 <button
 onClick={() => handleDeleteMoment(selectedIndex)}
 className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 hover:text-red-300 text-[12px] font-bold tracking-wide uppercase transition-all cursor-pointer"
 >
 <Trash2 className="w-3.5 h-3.5"/>
 <span>Xóa phân cảnh này</span>
 </button>
 )}
 </div>
 )}

 {/* Prompt extra photography notes */}
 <div className="p-4 rounded-xl bg-amber-500/5 border border-[#B5945B]/10 flex gap-3 items-start mt-4">
 <Sparkles className="w-4 h-4 text-[#B5945B] mt-0.5 shrink-0"/>
 <div>
 <h4 className="text-[11px] font-sans font-medium uppercase tracking-wide text-[#B5945B]">
 Quản trị viên
 </h4>
 <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
 Sử dụng hệ thống console bên dưới để thay đổi hình ảnh, chú
 thích, thông số EXIF (Khẩu độ, ISO, Shutter Speed) và lưu tức
 thì cấu hình.
 </p>
 </div>
 </div>
 </motion.div>
 </div>
 </div>

 {/* --- DYNAMIC ADMINISTRATOR CONTROL CABINET --- */}
 <AnimatePresence>
 {isAdminMode && (
 <motion.div
 initial={{ opacity: 0, y: 30 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 30 }}
 transition={{ type:"spring", damping: 25, stiffness: 120 }}
 className="mt-12 bg-gray-950 text-zinc-100 rounded-3xl p-6 md:p-8 border-2 border-[#B5945B]/30 shadow-lg relative overflow-hidden"
 >
 {/* Visual Gold Mesh Highlights */}
 <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[80px] pointer-events-none"/>
 <div className="absolute -left-32 -bottom-32 w-64 h-64 bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none"/>

 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
 <div className="flex items-center gap-3">
 <div className="p-3 bg-amber-400/10 rounded-2xl border border-[#B5945B]/30 text-[#B5945B]">
 <Settings
 className="w-6 h-6 animate-spin"
 style={{ animationDuration:"6s"}}
 />
 </div>
 <div className="text-left">
 <span className="font-sans text-[12px] tracking-wide text-[#B5945B] font-medium uppercase">
 Consolidated Panel v2.5
 </span>
 <h3 className="font-sans font-bold text-lg text-white uppercase tracking-wide">
 BÀN ĐIỀU KHIỂN & CHỈNH SỬA ALBUM
 </h3>
 </div>
 </div>

 {/* Action Tabs and storage utilities */}
 <div className="flex flex-wrap items-center gap-2">
 <button
 onClick={() => setAdminTab("list")}
 className={`px-4 py-2 rounded-xl text-[11px] font-sans font-medium uppercase tracking-wide font-sans tracking-wide transition-all cursor-pointer ${
 adminTab ==="list"
 ?"bg-amber-400/15 border-2 border-[#B5945B] text-white font-bold shadow-sm"
 :"bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
 }`}
 >
 📋 Danh Sách Phân Cảnh
 </button>
 <button
 onClick={() => setAdminTab("edit")}
 className={`px-4 py-2 rounded-xl text-[11px] font-sans font-medium uppercase tracking-wide font-sans tracking-wide transition-all cursor-pointer ${
 adminTab ==="edit"
 ?"bg-amber-400/15 border-2 border-[#B5945B] text-white font-bold shadow-sm"
 :"bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
 }`}
 >
 ✏️ Sửa ảnh #{selectedIndex + 1}
 </button>
 <button
 onClick={() => setAdminTab("add")}
 className={`px-4 py-2 rounded-xl text-[11px] font-sans font-medium uppercase tracking-wide font-sans tracking-wide transition-all cursor-pointer ${
 adminTab ==="add"
 ?"bg-amber-400/15 border-2 border-[#B5945B] text-white font-bold shadow-sm"
 :"bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
 }`}
 >
 <Plus className="w-3 h-3 inline mr-1 mb-0.5"/>
 Thêm Phân Cảnh Mới
 </button>
 </div>
 </div>

 {/* TAB 0: LIST OF ALL MOMENTS / SCENES */}
 {adminTab ==="list"&& (
 <div className="py-6 text-left relative z-10 space-y-4">
 <div className="flex items-center justify-between border-b border-white/5 pb-2">
 <span className="font-sans text-xs uppercase tracking-wide text-zinc-300 font-bold flex items-center gap-1.5 animate-pulse">
 <span className="w-2.5 h-2.5 rounded-full bg-amber-500"/>
 📁 DANH SÁCH TOÀN BỘ PHÂN CẢNH TRONG THƯ VIỆN (
 {albumImages.length})
 </span>
 <button
 type="button"
 onClick={() => setAdminTab("add")}
 className="px-3.5 py-1.5 bg-[#B5945B]/20 hover:bg-[#B5945B]/30 border border-[#B5945B]/40 text-white rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide flex items-center gap-1 transition-all cursor-pointer"
 >
 <Plus className="w-3.5 h-3.5"/> Thêm nhanh phân cảnh mới
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
 {albumImages.map((item, idx) => (
 <div
 key={`manage-item-${item.src || idx}-${idx}`}
 onClick={() => setSelectedIndex(idx)}
 className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer gap-4 ${
 selectedIndex === idx
 ?"bg-[#B5945B]/10 border-[#B5945B]/50 shadow-lg shadow-[#B5945B]/5"
 :"bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
 }`}
 >
 <div className="flex items-center gap-3 truncate flex-1 min-w-0">
 <div className="relative w-16 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-zinc-900">
 <ImageWithFallback
 src={resolveImage(item.src)}
 alt={item.title}
 sizes="64px"
 targetWidth={160}
 className="w-full h-full object-cover"
 />
 <div className="absolute inset-0 bg-black/15"/>
 <div className="absolute bottom-0 right-0 bg-black/70 text-[11px] font-sans text-[#B5945B] px-1 rounded-tl">
 #{idx + 1}
 </div>
 </div>

 <div className="text-left truncate min-w-0 flex-1">
 <h5 className="text-xs font-bold text-white uppercase tracking-wide truncate">
 {item.title?.toUpperCase()}
 </h5>
 <p className="text-[12px] text-zinc-400 font-light truncate mt-0.5">
 {item.desc}
 </p>
 <div className="flex gap-2 mt-1 text-[11px] font-sans text-zinc-500">
 <span>S: {item.shutter}</span>
 <span>•</span>
 <span>A: {item.aperture}</span>
 <span>•</span>
 <span>I: {item.iso}</span>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5 ml-auto">
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 setSelectedIndex(idx);
 setAdminTab("edit");
 }}
 className="flex-1 sm:flex-none justify-center px-2.5 py-1.5 bg-zinc-800 hover:bg-slate-750 text-slate-250 hover:text-white rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide transition-colors cursor-pointer border border-zinc-700/60"
 >
 Sửa
 </button>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 handleDeleteMoment(idx);
 }}
 className="flex-1 sm:flex-none justify-center px-2.5 py-1.5 bg-red-950/60 hover:bg-red-900 text-red-400 hover:text-white rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide transition-colors cursor-pointer border border-red-900/40"
 >
 Xoá
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* TAB 1: EDIT ACTIVE MOMENT */}
 {adminTab ==="edit"&& albumImages[selectedIndex] && (
 <div className="py-6 grid grid-cols-1 md:grid-cols-12 gap-8 text-left relative z-10">
 {/* Visual Thumbnail Info */}
 <div className="md:col-span-4 flex flex-col gap-4">
 <span className="font-sans text-xs uppercase tracking-wide text-zinc-400 font-bold">
 Xem trước chỉnh sửa:
 </span>
 <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-white/15 shadow-inner">
 <ImageWithFallback
 src={resolveImage(albumImages[selectedIndex].src)}
 alt={albumImages[selectedIndex].title}
 sizes="(max-width: 768px) 100vw, 33vw"
 targetWidth={800}
 className="w-full h-full object-cover"
 />
 <div className="absolute top-3 left-3 bg-black/80 border border-white/10 px-2.5 py-1 rounded text-white font-sans text-[11px]">
 HÌNH ẢNH SỐ {selectedIndex + 1}
 </div>
 </div>

 <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-zinc-400 leading-relaxed font-light">
 📝 Thay đổi bất kỳ trường nhập liệu nào bên phải đều sẽ{""}
 <strong className="text-white">
 cập nhật trực quan và tức thì
 </strong>{""}
 tại vùng trình chiếu phía trên để quý khách dễ dàng căn
 chỉnh bối cảnh.
 </div>
 </div>

 {/* Interactive forms inputs for active moment */}
 <div className="md:col-span-8 flex flex-col gap-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="font-sans text-[12px] font-medium text-zinc-400 block mb-1.5">
 Tiêu đề sự kiện
 </label>
 <input
 type="text"
 value={albumImages[selectedIndex].title}
 onChange={(e) =>
 updateActiveImageField("title", e.target.value)
 }
 className="w-full px-3 py-2.5 bg-white/5 rounded-lg border border-white/10 focus:border-[#B5945B] focus:ring-1 focus:ring-[#B5945B]/30 outline-none text-zinc-100 text-sm transition-all"
 placeholder="VD: GRADUATION DAY - BTEC FPT"
 />
 </div>
 <div>
 <label className="font-sans text-[12px] font-medium text-zinc-400 block mb-1.5">
 Hình ảnh (Tải lên)
 </label>
 <div className="flex items-center gap-2 bg-white/5 rounded-lg border border-white/10 p-1.5">
 <div className="w-8 h-8 rounded border border-white/20 overflow-hidden shrink-0 bg-black">
 {albumImages[selectedIndex].src && (
 <img
 src={resolveImage(albumImages[selectedIndex].src)}
 alt="preview"
 referrerPolicy="no-referrer"loading="lazy"decoding="async"
 className="w-full h-full object-cover"
 />
 )}
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
 updateActiveImageField(
"src",
 compressedDataUrl,
 );
 } catch (err) {
 console.error("Image compression failed", err);
 }
 }
 }}
 className="w-full text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:uppercase file:bg-[#B5945B]/20 file:text-[#B5945B] hover:file:bg-[#B5945B]/30 cursor-pointer"
 />
 </div>
 </div>
 </div>

 <div>
 <label className="font-sans text-[12px] font-medium text-zinc-400 block mb-1.5">
 Mô tả chi tiết khoảnh khắc
 </label>
 <textarea
 rows={3}
 value={albumImages[selectedIndex].desc}
 onChange={(e) =>
 updateActiveImageField("desc", e.target.value)
 }
 className="w-full px-3 py-2.5 bg-white/5 rounded-lg border border-white/10 focus:border-[#B5945B] focus:ring-1 focus:ring-[#B5945B]/30 outline-none text-zinc-100 text-sm transition-all resize-none leading-relaxed"
 placeholder="Nhập nội dung xúc cảm, mô tả câu chuyện..."
 />
 </div>

 {/* Photo details parameters */}
 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="font-sans text-[12px] font-medium text-zinc-400 block mb-1.5">
 Shutter (Tốc độ)
 </label>
 <input
 type="text"
 value={albumImages[selectedIndex].shutter}
 onChange={(e) =>
 updateActiveImageField("shutter", e.target.value)
 }
 className="w-full px-3 py-2 bg-white/5 rounded-lg border border-white/10 focus:border-[#B5945B] text-zinc-100 text-xs font-sans outline-none"
 />
 </div>
 <div>
 <label className="font-sans text-[12px] font-medium text-zinc-400 block mb-1.5">
 Aperture (Khẩu độ)
 </label>
 <input
 type="text"
 value={albumImages[selectedIndex].aperture}
 onChange={(e) =>
 updateActiveImageField("aperture", e.target.value)
 }
 className="w-full px-3 py-2 bg-white/5 rounded-lg border border-white/10 focus:border-[#B5945B] text-zinc-100 text-xs font-sans outline-none"
 />
 </div>
 <div>
 <label className="font-sans text-[12px] font-medium text-zinc-400 block mb-1.5">
 ISO (Độ nhạy sáng)
 </label>
 <input
 type="text"
 value={albumImages[selectedIndex].iso}
 onChange={(e) =>
 updateActiveImageField("iso", e.target.value)
 }
 className="w-full px-3 py-2 bg-white/5 rounded-lg border border-white/10 focus:border-[#B5945B] text-zinc-100 text-xs font-sans outline-none"
 />
 </div>
 </div>

 {/* Auto-saved notification and big delete button for administrative comfort */}
 <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-white/10">
 <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-sans">
 <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
 <span>Đồng bộ tức thì & Tự động lưu hệ thống!</span>
 </div>

 <button
 type="button"
 onClick={() => handleDeleteMoment(selectedIndex)}
 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-sans font-medium uppercase tracking-wide flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
 >
 <Trash2 className="w-3.5 h-3.5"/>
 <span>Xóa Phân Cảnh Này</span>
 </button>
 </div>
 </div>
 </div>
 )}

 {/* TAB 2: ADD A BRAND NEW ALBUM MOMENT */}
 {adminTab ==="add"&& (
 <form
 onSubmit={handleAddNewMoment}
 className="py-6 text-left relative z-10 flex flex-col gap-5"
 >
 {addError && (
 <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
 <AlertTriangle className="w-4 h-4"/>
 <span>{addError}</span>
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="font-sans text-[12px] font-medium text-zinc-400 block mb-1.5">
 Nhập tiêu đề khoảnh khắc/sự kiện mới
 </label>
 <input
 type="text"
 value={newTitle}
 onChange={(e) => setNewTitle(e.target.value)}
 className="w-full px-3 py-2.5 bg-white/5 rounded-lg border border-white/10 focus:border-[#B5945B] text-zinc-100 text-sm outline-none transition-all"
 placeholder="Ví dụ: Đêm Dạ Tiệc Prom Night 2026"
 required
 />
 </div>
 <div>
 <label className="font-sans text-[12px] font-medium text-zinc-400 block mb-1.5">
 Hình ảnh (Tải lên)
 </label>
 <div className="flex items-center gap-2 bg-white/5 rounded-lg border border-white/10 p-1.5">
 <div className="w-8 h-8 rounded border border-white/20 overflow-hidden shrink-0 bg-black">
 {newSrc && (
 <img
 src={resolveImage(newSrc)}
 alt="preview"
 referrerPolicy="no-referrer"loading="lazy"decoding="async"
 className="w-full h-full object-cover"
 />
 )}
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
 setNewSrc(compressedDataUrl);
 } catch (err) {
 console.error("Image compression failed", err);
 }
 }
 }}
 className="w-full text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:uppercase file:bg-[#B5945B]/20 file:text-[#B5945B] hover:file:bg-[#B5945B]/30 cursor-pointer"
 />
 </div>

 {/* Prest image quick insertions */}
 <div className="flex gap-2.5 mt-2 overflow-x-auto">
 <span className="text-[11px] text-zinc-500 font-sans self-center">
 Chọn nhanh mẫu:
 </span>
 <button
 type="button"
 onClick={() =>
 handleQuickPresetUrl(
"https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=800",
 )
 }
 className="text-[11px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 font-sans text-zinc-300 cursor-pointer whitespace-nowrap"
 >
 Đại nhạc hội
 </button>
 <button
 type="button"
 onClick={() =>
 handleQuickPresetUrl(
"https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=800",
 )
 }
 className="text-[11px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 font-sans text-zinc-300 cursor-pointer whitespace-nowrap"
 >
 Hội nghị / Sự kiện
 </button>
 <button
 type="button"
 onClick={() =>
 handleQuickPresetUrl(
"https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800",
 )
 }
 className="text-[11px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 font-sans text-zinc-300 cursor-pointer whitespace-nowrap"
 >
 Nghi thức tốt nghiệp
 </button>
 </div>
 </div>
 </div>

 <div>
 <label className="font-sans text-[12px] font-medium text-zinc-400 block mb-1.5">
 Mô tả chi tiết câu chuyện/sự kiện
 </label>
 <textarea
 rows={3}
 value={newDesc}
 onChange={(e) => setNewDesc(e.target.value)}
 className="w-full px-3 py-2.5 bg-white/5 rounded-lg border border-white/10 focus:border-[#B5945B] text-zinc-100 text-sm outline-none transition-all resize-none leading-relaxed"
 placeholder="Những giai điệu sôi động, các cặp đôi trao nhau điệu nhảy đầu đời đầy lãng mạn dưới ánh đèn màu..."
 required
 />
 </div>

 {/* EXIF camera details placeholders */}
 <div className="grid grid-cols-3 gap-4">
 <div>
 <label className="font-sans text-[12px] text-zinc-400 block mb-1 font-semibold">
 Tốc độ màn trập
 </label>
 <input
 type="text"
 value={newShutter}
 onChange={(e) => setNewShutter(e.target.value)}
 className="w-full px-3 py-2 bg-white/5 rounded border border-white/10 text-xs font-sans text-white outline-none focus:border-[#B5945B]"
 placeholder="1/125s"
 />
 </div>
 <div>
 <label className="font-sans text-[12px] text-zinc-400 block mb-1 font-semibold">
 Khẩu độ ống kính
 </label>
 <input
 type="text"
 value={newAperture}
 onChange={(e) => setNewAperture(e.target.value)}
 className="w-full px-3 py-2 bg-white/5 rounded border border-white/10 text-xs font-sans text-white outline-none focus:border-[#B5945B]"
 placeholder="F/2.8"
 />
 </div>
 <div>
 <label className="font-sans text-[12px] text-zinc-400 block mb-1 font-semibold">
 Độ nhạy sáng (ISO)
 </label>
 <input
 type="text"
 value={newIso}
 onChange={(e) => setNewIso(e.target.value)}
 className="w-full px-3 py-2 bg-white/5 rounded border border-white/10 text-xs font-sans text-white outline-none focus:border-[#B5945B]"
 placeholder="400"
 />
 </div>
 </div>

 <div className="flex justify-end pt-2">
 <button
 type="submit"
 className="flex items-center gap-1.5 px-6 py-2.5 bg-[#B5945B] hover:bg-[#a3834e] text-white text-xs font-medium uppercase tracking-wide rounded-xl transition-all shadow-md cursor-pointer hover:scale-103"
 >
 <Plus className="w-4 h-4"/>
 <span>Thêm Phân Cảnh Này Vào Vòng Lặp</span>
 </button>
 </div>
 </form>
 )}

 {/* General System Console Utility Buttons */}
 <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 z-10 relative">
 <p className="text-[12px] font-sans text-zinc-400 leading-relaxed font-light">
 ⚙️ Thay đổi của bạn nằm ở{""}
 <strong className="text-[#B5945B]">
 Bộ nhớ Cục bộ (Local Sandbox)
 </strong>
 . <br />
 Nhấn <strong className="text-white">
"Đồng Bộ Hệ Thống"
 </strong>{""}
 để lưu trữ lâu dài.
 </p>

 <div className="flex gap-2.5">
 <button
 onClick={handleResetToDefaults}
 className="flex items-center gap-1.5 px-4 py-2 hover:bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 text-[12px] font-medium uppercase font-sans tracking-wide rounded-xl transition-all cursor-pointer"
 title="Nhấn để khôi phục mặc định ban đầu"
 >
 <RotateCcw className="w-3.5 h-3.5"/>
 <span>Khôi phục mặc định</span>
 </button>

 <button
 onClick={saveStateToLocalStorage}
 className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-medium uppercase font-sans tracking-wide rounded-xl transition-all hover:scale-103 shadow-glow cursor-pointer"
 title="Đồng bộ cấu hình vào dữ liệu vĩnh cửu"
 >
 <Save className="w-4 h-4"/>
 <span>Đồng Bộ Hệ Thống</span>
 </button>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* --- IMMERSIVE LIGHTBOX OVERLAY --- */}
 <AnimatePresence>
 {isLightboxOpen && albumImages[selectedIndex] && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col justify-between p-4"
 >
 {/* Top Close bar */}
 <div className="flex items-center justify-between p-3 text-zinc-300">
 <span className="font-sans text-[12px] tracking-wide text-[#B5945B] uppercase font-medium">
 {slide.title} — PHÂN CẢNH{""}
 {(selectedIndex + 1).toString().padStart(2,"0")}
 </span>
 <button
 onClick={() => setIsLightboxOpen(false)}
 className="p-3 bg-white/10 hover:bg-white/20 text-white hover:scale-105 active:scale-95 transition-all rounded-full cursor-pointer border border-white/5"
 title="Đóng chế độ phóng to"
 >
 <X className="w-5 h-5"/>
 </button>
 </div>

 {/* Immersive Center image frame */}
 <div className="relative flex-1 flex items-center justify-center max-h-[85vh] w-full self-center">
 <button
 onClick={handlePrevImage}
 className="absolute left-4 p-3.5 bg-black/50 hover:bg-black/75 text-white border border-white/10 rounded-full cursor-pointer z-50 transition-all"
 title="Ảnh trước"
 >
 <ChevronLeft className="w-6 h-6"/>
 </button>

 <ImageWithFallback
 priority={true}
 src={resolveImage(albumImages[selectedIndex].src)}
 alt={albumImages[selectedIndex].alt}
 sizes="100vw"
 className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg select-none mx-auto"
 />

 <button
 onClick={handleNextImage}
 className="absolute right-4 p-3.5 bg-black/50 hover:bg-black/75 text-white border border-white/10 rounded-full cursor-pointer z-50 transition-all"
 title="Ảnh tiếp"
 >
 <ChevronRight className="w-6 h-6"/>
 </button>

 {/* Bottom Details Overlay */}
 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 border border-white/10 p-4 rounded-xl max-w-lg w-10/12 text-center text-white backdrop-blur">
 <h4 className="font-sans font-bold text-sm tracking-wide uppercase text-[#B5945B]">
 {albumImages[selectedIndex].title?.toUpperCase()}
 </h4>
 <p className="text-xs text-zinc-300 font-light mt-1.5 leading-relaxed">
 {albumImages[selectedIndex].desc}
 </p>
 <div className="flex items-center justify-center gap-3 mt-2.5 pt-2 border-t border-white/10 text-[11px] font-sans text-zinc-400">
 <span>shutter: {albumImages[selectedIndex].shutter}</span>
 <span>•</span>
 <span>aperture: {albumImages[selectedIndex].aperture}</span>
 <span>•</span>
 <span>ISO: {albumImages[selectedIndex].iso}</span>
 </div>
 </div>
 </div>

 {/* Empty footer for spacer */}
 <div className="h-4"/>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
};
