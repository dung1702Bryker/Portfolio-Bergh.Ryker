import React, { useState, useEffect } from"react";
import { motion, AnimatePresence } from"motion/react";
import { Quote, Plus, X, Loader2, Check, Trash2, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { db, handleFirestoreError, OperationType } from"../firebase";
import { collection, doc, setDoc, onSnapshot, query, orderBy, deleteDoc } from"firebase/firestore";
import { Testimonial } from"../types";

const STATIC_TESTIMONIALS: Testimonial[] = [
 {
 id:"static-1",
 content:"Concept kỷ yếu rõ ràng, mạch lạc. Màu ảnh đậm chất điện ảnh, mỗi khung hình đều chứa đựng câu chuyện riêng của lớp chúng mình.",
 author:"Minh Anh",
 role:"Lớp trưởng 12A1 Chu Văn An",
 createdAt:"2024-01-01",
 status:"Đã duyệt"
 },
 {
 id:"static-2",
 content:"Working với Bergh.Ryker rất chuyên nghiệp và nhẹ nhàng. Dũng biết cách khai thác tối đa năng lượng của các bạn học sinh.",
 author:"Hoàng Tùng",
 role:"Ban Tổ Chức Prom 2024",
 createdAt:"2024-02-01",
 status:"Đã duyệt"
 },
 {
 id:"static-3",
 content:"Thấu hiểu insight cực tốt, biến những ý tưởng vụn vặt của bọn em thành một bộ ảnh cực kỳ hoành tráng và giàu cảm xúc.",
 author:"Thảo Ngọc",
 role:"Cử nhân Ngoại thương",
 createdAt:"2024-03-01",
 status:"Đã duyệt"
 },
];

export const SocialProof: React.FC<{ isAdminGlobal?: boolean }> = ({ isAdminGlobal = false }) => {
 const [testimonials, setTestimonials] = useState<Testimonial[]>(STATIC_TESTIMONIALS);
 const [activeIndex, setActiveIndex] = useState(0);
 const [direction, setDirection] = useState(1);
 const [isPaused, setIsPaused] = useState(false);
 const [showForm, setShowForm] = useState(false);

 useEffect(() => {
 if (testimonials.length <= 1 || isPaused) return;
 const interval = setInterval(() => {
 setDirection(1);
 setActiveIndex((prev) => (prev + 1) % testimonials.length);
 }, 6500); // 6.5 seconds per testimonial
 return () => clearInterval(interval);
 }, [testimonials.length, isPaused]);
 
 // Form state
 const [content, setContent] = useState("");
 const [author, setAuthor] = useState("");
 const [role, setRole] = useState("");
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [submitSuccess, setSubmitSuccess] = useState(false);

 useEffect(() => {
 const q = query(collection(db,"testimonials"), orderBy("createdAt","desc"));
 const unsubscribe = onSnapshot(
 q,
 (snapshot) => {
 const fetched: Testimonial[] = [];
 snapshot.forEach((doc) => {
 fetched.push(doc.data() as Testimonial);
 });
 
 // Admins see everything, users only see approved
 const dynamicToShow = isAdminGlobal ? fetched : fetched.filter(t => t.status ==="Đã duyệt");
 const rawList = [...STATIC_TESTIMONIALS, ...dynamicToShow];
 const seenIds = new Set<string>();
 const uniqueTestimonials: Testimonial[] = [];
 rawList.forEach((item, itemIdx) => {
   let itemId = item.id;
   if (!itemId || seenIds.has(itemId)) {
     itemId = `${itemId || 'testim'}_${itemIdx}`;
   }
   seenIds.add(itemId);
   uniqueTestimonials.push({ ...item, id: itemId });
 });
 setTestimonials(uniqueTestimonials);
 },
 (error) => {
 handleFirestoreError(error, OperationType.LIST,"testimonials");
 }
 );

 return () => unsubscribe();
 }, [isAdminGlobal]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!content.trim() || !author.trim() || !role.trim()) return;

 setIsSubmitting(true);
 const newId ="FB_"+ Date.now().toString();
 const newTestimonial: Testimonial = {
 id: newId,
 content: content.trim(),
 author: author.trim(),
 role: role.trim(),
 createdAt: new Date().toISOString(),
 status:"Chờ duyệt"// require admin approval to show up
 };

 try {
 await setDoc(doc(db,"testimonials", newId), newTestimonial);
 setSubmitSuccess(true);
 setTimeout(() => {
 setShowForm(false);
 setSubmitSuccess(false);
 setContent("");
 setAuthor("");
 setRole("");
 }, 3000);
 } catch (error) {
 handleFirestoreError(error, OperationType.CREATE,"testimonials");
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleApprove = async (id: string, current: Testimonial) => {
 try {
 await setDoc(doc(db,"testimonials", id), { ...current, status:"Đã duyệt"});
 } catch (error) {
 handleFirestoreError(error, OperationType.UPDATE, `testimonials/${id}`);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 if (id.startsWith("static-")) {
 // Cannot delete static testimonials in UI
 return;
 }
 await deleteDoc(doc(db,"testimonials", id));
 } catch (error) {
 handleFirestoreError(error, OperationType.DELETE, `testimonials/${id}`);
 }
 };

 return (
 <section className="w-full relative overflow-hidden pb-4 md:pb-6">
 <div className="max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8 relative z-10 px-4">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.6 }}
 className="text-center space-y-4"
 >
 <span className="font-sans text-xs text-[#B5945B] font-medium">
 Khách hàng nói gì?
 </span>
 <h2 className="text-2xl min-[360px]:text-3xl md:text-4xl font-sans font-bold text-white tracking-tight">
 Những mảnh ghép cảm xúc
 </h2>
 </motion.div>

 {/* Focal Artistic Carousel Slider */}
 <div 
 className="relative w-full max-w-3xl mx-auto flex flex-col items-center gap-6"
 onMouseEnter={() => setIsPaused(true)}
 onMouseLeave={() => setIsPaused(false)}
 >
 {/* Central Animated Viewport */}
 <div className="w-full overflow-hidden relative z-10 px-1 min-h-[290px] xs:min-h-[250px] sm:min-h-[220px] md:min-h-[200px] flex items-center justify-center">
 <AnimatePresence mode="popLayout"custom={direction}>
 {testimonials[activeIndex] && (
 <motion.div
 key={`testimonial-${testimonials[activeIndex].id || activeIndex}`}
 custom={direction}
 variants={{
 initial: (dir: number) => ({
 x: dir > 0 ? 40 : -40,
 opacity: 0,
 scale: 0.98,
 }),
 animate: {
 x: 0,
 opacity: 1,
 scale: 1,
 transition: {
 x: { type:"spring", stiffness: 220, damping: 26 },
 opacity: { duration: 0.35, ease:"easeOut"},
 scale: { duration: 0.35, ease:"easeOut"}
 }
 },
 exit: (dir: number) => ({
 x: dir > 0 ? -40 : 40,
 opacity: 0,
 scale: 0.98,
 transition: {
 x: { type:"spring", stiffness: 220, damping: 26 },
 opacity: { duration: 0.2 },
 scale: { duration: 0.2 }
 }
 }),
 }}
 initial="initial"
 animate="animate"
 exit="exit"
 className="w-full liquid-glass border border-white/10 p-4 xs:p-6 sm:p-10 rounded-2xl sm:rounded-3xl relative flex flex-col justify-between gap-5 sm:gap-6 cursor-grab active:cursor-grabbing shadow-none"
 drag="x"
 dragConstraints={{ left: 0, right: 0 }}
 dragElastic={0.3}
 onDragEnd={(e, { offset, velocity }) => {
   const swipe = Math.abs(offset.x) > 50 || Math.abs(velocity.x) > 500;
   if (swipe) {
     if (offset.x < 0) {
       setDirection(1);
       setActiveIndex((prev) => (prev + 1) % testimonials.length);
     } else {
       setDirection(-1);
       setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
     }
   }
 }}
 >
 {/* Elegant quotes glyph watermark */}
 <div className="absolute right-6 top-4 text-6xl sm:text-7xl font-serif text-[#B5945B]/5 select-none pointer-events-none font-bold">
 “
 </div>

 <div className="space-y-4">
 <Quote className="w-6 h-6 text-[#B5945B]/40 mb-1"/>
 <p className="text-white text-base sm:text-base md:text-lg leading-relaxed font-serif italic tracking-wide font-normal ">
 "{testimonials[activeIndex].content}"
 </p>
 </div>

 <div className="border-t border-white/[0.04] pt-4 sm:pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <div className="flex items-center gap-2">
 <p className="font-sans font-bold text-[#E5C17C] tracking-wide text-sm sm:text-base ">
 {testimonials[activeIndex].author}
 </p>
 {testimonials[activeIndex].rating && (
   <div className="flex items-center gap-0.5">
     {[1, 2, 3, 4, 5].map((star, sIdx) => (
       <Star
         key={`star-${star}-${sIdx}`}
         className={`w-3.5 h-3.5 ${
           star <= (testimonials[activeIndex].rating || 5)
             ? "text-optic-yellow fill-current"
             : "text-zinc-700"
         }`}
       />
     ))}
   </div>
 )}
 </div>
 <p className="text-zinc-200 font-sans text-xs sm:text-sm mt-1 tracking-wide ">
 {testimonials[activeIndex].role}
 </p>
 </div>

 {/* Admin Actions Overlay (Only visible on dashboard preview side) */}
 {isAdminGlobal && (
 <div className="flex items-center gap-2 self-start sm:self-center">
 {testimonials[activeIndex].status ==="Chờ duyệt"&& (
 <button
 onClick={() => handleApprove(testimonials[activeIndex].id, testimonials[activeIndex])}
 className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg border border-emerald-500/20 transition-all text-[11px] font-sans uppercase tracking-wide flex items-center gap-1.5 cursor-pointer"
 title="Kiểm duyệt và cho hiển thị"
 >
 <Check className="w-3.5 h-3.5"/> Duyệt
 </button>
 )}
 {!testimonials[activeIndex].id.startsWith("static-") && (
 <button
 onClick={() => handleDelete(testimonials[activeIndex].id)}
 className="px-2.5 py-1.5 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20 transition-all text-[11px] font-sans uppercase tracking-wide flex items-center gap-1.5 cursor-pointer"
 title="Xóa đánh giá"
 >
 <Trash2 className="w-3.5 h-3.5"/> Xóa
 </button>
 )}
 {testimonials[activeIndex].status ==="Chờ duyệt"&& (
 <span className="px-2 py-1 bg-[#B5945B]/10 text-[#B5945B] text-[11px] font-sans font-medium tracking-wide uppercase rounded-lg border border-[#B5945B]/20">
 Đang đợi duyệt
 </span>
 )}
 </div>
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* Sleek Integrated Controls Line (Artful dot indicators + touch-friendly arrow triggers) */}
 <div className="flex items-center justify-center gap-6 mt-2 relative z-10 w-full">
 <button
 onClick={() => {
 setDirection(-1);
 setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
 }}
 className="p-2 sm:p-2.5 rounded-full border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-90 transition-all duration-300 cursor-pointer"
 title="Trước đó"
 >
 <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5"/>
 </button>

 <div className="flex items-center gap-1.5">
 {testimonials.map((tItem, idx) => (
 <div key={`dot-${tItem.id || 't'}-${idx}`} className="px-1.5 py-3 cursor-pointer flex items-center justify-center group" onClick={() => { setDirection(idx > activeIndex ? 1 : -1); setActiveIndex(idx); }}><div className="h-1 rounded-full transition-all duration-500 relative overflow-hidden bg-white/10 group-hover:bg-white/20" style={{
 width: activeIndex === idx ?"2rem":"0.5rem",
 }}
 >
 {activeIndex === idx && (
 <motion.div
 key={`dot-prog-${tItem.id || 't'}-${idx}-${isPaused}`}
 initial={{ scaleX: 0 }}
 animate={{ scaleX: 1 }}
 transition={{ duration: isPaused ? 0 : 6.5, ease:"linear"}}
 className="absolute inset-y-0 inset-x-0 bg-[#B5945B] origin-left"
 />
 )}
 </div></div>
            ))}
 </div>

 <button
 onClick={() => {
 setDirection(1);
 setActiveIndex((prev) => (prev + 1) % testimonials.length);
 }}
 className="p-2 sm:p-2.5 rounded-full border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 hover:border-white/20 active:scale-90 transition-all duration-300 cursor-pointer"
 title="Kế tiếp"
 >
 <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5"/>
 </button>
 </div>
 </div>

 <motion.div 
 initial={{ opacity: 0 }}
 whileInView={{ opacity: 1 }}
 viewport={{ once: true }}
 className="flex justify-center mt-3"
 >
 <button
 onClick={() => setShowForm(true)}
 className="flex items-center gap-2 px-5 py-2.5 liquid-glass-btn border-white/15 hover:border-[#B5945B]/50 text-zinc-300 hover:text-white rounded-full transition-all text-[13px] font-bold tracking-wide font-sans group cursor-pointer shadow-md"
 >
 <Plus className="w-3.5 h-3.5 text-[#B5945B] group-hover:scale-110 transition-transform"/>
 Gửi cảm nhận của bạn
 </button>
 </motion.div>
 </div>

 {/* Feedback Modal */}
 <AnimatePresence>
 {showForm && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm"
 >
 <motion.div
 initial={{ scale: 0.9, opacity: 0, y: 20 }}
 animate={{ scale: 1, opacity: 1, y: 0 }}
 exit={{ scale: 0.9, opacity: 0, y: 20 }}
 className="liquid-glass-dark liquid-glass border border-white/15 p-6 md:p-8 rounded-3xl w-full max-w-lg relative shadow-none"
 >
 <button
 onClick={() => setShowForm(false)}
 className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
 >
 <X className="w-5 h-5"/>
 </button>

 <div className="mb-6">
 <h3 className="text-xl font-sans font-semibold text-white tracking-wide">
 Gửi Cảm Nhận
 </h3>
 <p className="text-zinc-400 text-sm mt-1">
 Chia sẻ trải nghiệm của bạn với Bergh.Ryker
 </p>
 </div>

 {submitSuccess ? (
 <motion.div 
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg flex items-center gap-3"
 >
 <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
 <p className="text-sm font-medium">Cảm ơn bạn! Đánh giá đang chờ duyệt.</p>
 </motion.div>
 ) : (
 <form onSubmit={handleSubmit} className="space-y-4">
 <div>
 <label className="block text-xs font-medium text-zinc-400 mb-1.5">
 Tên của bạn <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 required
 value={author}
 onChange={(e) => setAuthor(e.target.value)}
 placeholder="VD: Minh Anh"
 className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#B5945B]/50 focus:ring-1 focus:ring-[#B5945B]/50 transition-all font-medium"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-400 mb-1.5">
 Đại diện cho <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 required
 value={role}
 onChange={(e) => setRole(e.target.value)}
 placeholder="VD: Lớp 12A1 Chu Văn An"
 className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#B5945B]/50 focus:ring-1 focus:ring-[#B5945B]/50 transition-all font-medium"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-zinc-400 mb-1.5">
 Cảm nhận <span className="text-red-500">*</span>
 </label>
 <textarea
 required
 rows={4}
 value={content}
 onChange={(e) => setContent(e.target.value)}
 placeholder="Chia sẻ trải nghiệm chụp ảnh của bạn..."
 className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#B5945B]/50 focus:ring-1 focus:ring-[#B5945B]/50 transition-all resize-none font-medium"
 />
 </div>
 <div className="pt-2">
 <button
 type="submit"
 disabled={isSubmitting}
 className="w-full flex items-center justify-center gap-2 bg-[#B5945B] hover:bg-[#c6a56c] text-white font-semibold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
 >
 {isSubmitting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin"/>
 Đang gửi...
 </>
 ) : (
"Gửi đánh giá"
 )}
 </button>
 </div>
 </form>
 )}
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 </section>
 );
};
