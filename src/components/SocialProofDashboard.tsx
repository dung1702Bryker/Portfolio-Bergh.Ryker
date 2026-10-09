import React from"react";
import { GraduationCap, Users, Award, ShieldCheck } from"lucide-react";
import { motion } from"motion/react";
import { SlideData } from"../types";
import { resolveImage } from"../utils/imageMapper";
import { ImageWithFallback } from"./ImageWithFallback";

interface SocialProofDashboardProps {
 slide: SlideData;
}

export const SocialProofDashboard: React.FC<SocialProofDashboardProps> = ({
 slide,
}) => {
 const imagesCover = resolveImage(
 slide.images[0]?.src ||
"https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1200",
 );

 // Match metrics representation
 const defaultMetrics = [
 {
 value:"80+",
 label:"Trường Đối Tác",
 desc:"Tập thể trường học đã tin chọn",
 icon: <GraduationCap className="w-5 h-5 text-optic-yellow"/>,
 },
 {
 value:"1,000+",
 label:"Học Sinh Đồng Hành",
 desc:"Khoảnh khắc hồn nhiên được đóng băng",
 icon: <Users className="w-5 h-5 text-zinc-400"/>,
 },
 {
 value:"100%",
 label:"Hài Lòng Tuyệt Đối",
 desc:"Từ ban phụ huynh & đội ngũ tổ chức",
 icon: <Award className="w-5 h-5 text-zinc-100"/>,
 },
 ];

 return (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full font-manrope">
 {/* 60% Left Section - Emotional Atmosphere Photograph Cover */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, margin:"-100px"}}
 transition={{ duration: 0.7 }}
 className="lg:col-span-7 flex flex-col justify-between liquid-glass border border-white/5 rounded-2xl overflow-hidden relative shadow-none group min-h-[350px] lg:min-h-[500px]"
 >
 {/* Background photo - cleared of default black darken vignette */}
 <div className="absolute inset-0 z-0">
 <ImageWithFallback
 src={imagesCover}
 alt={slide.images[0]?.alt ||"Youth group happiness"}
 sizes="(max-width: 1024px) 100vw, 60vw"
 style={{ objectPosition: slide.images[0]?.objectPosition ||"center"}}
 className="w-full h-full object-cover filter brightness-100 group-hover:scale-102 transition-all duration-1000 ease-out"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10 pointer-events-none"/>
 </div>

 {/* Framing watermark and details inside the photo */}
 <div className="relative z-10 p-6 flex flex-col justify-between h-full bg-black/10">
 <div className="flex justify-between items-center">
 <span className="font-sans text-[11px] text-[#E5C17C] tracking-wide uppercase liquid-glass px-2.5 py-1 rounded border border-white/10 font-bold shadow-sm ">
 LIVE BROADCAST • WIDE ANGLE 24mm
 </span>
 <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
 </div>

 <div className="max-w-md liquid-glass p-5 rounded-2xl border border-transparent shadow-none ">
 <div className="flex gap-2 items-center text-[#E5C17C] text-[12px] uppercase font-sans tracking-wide mb-2 font-bold ">
 <ShieldCheck className="w-4 h-4 text-[#E5C17C]"/>
 <span>Bảo chứng thanh xuân</span>
 </div>
 <p className="text-xs text-zinc-100 leading-relaxed font-normal ">
"Ký ức là thước phim duy nhất chúng ta có thể mang theo suốt cuộc
 đời. Chúng tôi tự hào được chọn làm người gác cổng ký ức cho bạn."
 </p>
 </div>
 </div>
 </motion.div>

 {/* 40% Right Section - Statistics and Metrics Data */}
 <div className="lg:col-span-5 flex flex-col justify-center gap-6">
 <motion.div
 initial={{ opacity: 0, y: 15 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.6 }}
 >
 <span className="font-sans text-xs uppercase tracking-wider text-[#E5C17C] mb-2 block font-bold ">
 {slide.subtitle}
 </span>
 <h2 className="font-sans font-bold text-3xl md:text-4xl text-white tracking-tight mb-3 leading-snug md:leading-[1.2] py-0.5 ">
 {slide.title}
 </h2>
 <p className="text-zinc-100 text-sm leading-relaxed mb-4 font-normal ">
 {slide.body}
 </p>
 </motion.div>

 {/* Display High-tech Metric Cards */}
 <div className="space-y-4">
 {defaultMetrics.map((item, index) => (
 <motion.div
 key={`metric-${item.label || index}-${index}`}
 initial={{ opacity: 0, y: 15 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ duration: 0.6, delay: index * 0.12 }}
 className="liquid-glass border border-white/5 hover:border-[#B5945B]/40 p-5 rounded-2xl flex items-center gap-5 group transition-all shadow-none"
 >
 <div className="p-3 liquid-glass rounded-xl border border-white/15 group-hover:border-[#B5945B]/40 transition-colors shadow-sm shrink-0">
 {item.icon}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-baseline justify-between gap-2">
 <span className="font-sans font-extrabold text-2xl sm:text-3xl text-white tracking-editorial group-hover:text-[#E5C17C] transition-colors leading-none ">
 {item.value}
 </span>
 {/* Decorative focal signal line */}
 <span className="font-sans text-[11px] text-[#E5C17C]/80 font-bold shrink-0 ">
 MTR_0{index + 1}
 </span>
 </div>
 <h4 className="text-xs text-zinc-100 font-bold uppercase tracking-wide mt-1.5  truncate">
 {item.label}
 </h4>
 <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed ">
 {item.desc}
 </p>

 {/* Animated fluorescent bar backing */}
 <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mt-3 border border-white/10">
 <div
 className={`h-full rounded-full transition-all duration-[1.5s] ${index === 0 ?"bg-gradient-to-r from-[#B5945B] to-[#E5C17C] w-4/5": index === 1 ?"bg-gradient-to-r from-emerald-500 to-emerald-400 w-11/12":"bg-gradient-to-r from-zinc-200 to-white w-[100%]"}`}
 ></div>
 </div>
 </div>
 </motion.div>

 ))}
 </div>
 </div>
 </div>
 );
};
