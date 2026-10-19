import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { IntroConfig, IntroCardConfig, DEFAULT_INTRO_CONFIG } from "../types/introConfig";
import { optimizeDriveImageUrl } from "../utils/imageMapper";

interface CinematicIntroOverlayProps {
  config: IntroConfig;
  realAlbumCards?: IntroCardConfig[];
  onComplete: () => void;
}

export const CinematicIntroOverlay: React.FC<CinematicIntroOverlayProps> = ({
  config,
  realAlbumCards,
  onComplete,
}) => {
  const [introFinished, setIntroFinished] = useState(false);
  const [isUnlockingTouch, setIsUnlockingTouch] = useState(false);

  // Quy tắc 4: Khắc phục triệt để độ trễ vuốt trang sau khi Intro kết thúc (Khóa cuộn tức thì)
  // Thực thi ngay từ mili-giây đầu tiên bắt đầu hiệu ứng fade-out:
  // (1) Đặt pointer-events: none
  // (2) Khôi phục ngay document.body.style.overflow = 'auto'
  // (3) Kích hoạt lại Lenis instance: lenis.start()
  const unlockScrollAndLenis = () => {
    document.body.style.removeProperty("overflow");
    document.documentElement.style.removeProperty("overflow");
    document.body.style.overflow = "auto";
    document.documentElement.style.overflow = "auto";
    setIsUnlockingTouch(true);

    if (typeof window !== "undefined") {
      try {
        (window as any).lenis?.start?.();
      } catch (_) {}
    }
  };

  useEffect(() => {
    // Quy tắc: Không khóa cuộn trên thiết bị di động
    const isMobile = typeof window !== "undefined" && (window.innerWidth < 1024 || "ontouchstart" in window);
    
    if (!isMobile) {
        // Khóa thanh cuộn body khi hiệu ứng Intro bắt đầu (chỉ trên desktop)
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
    }

    if (typeof window !== "undefined") {
        try {
            (window as any).lenis?.stop?.();
        } catch (_) {}
    }

    // Mili-giây đầu tiên fade-out bắt đầu (3.5 giây): Mở khóa cảm ứng, body overflow & Lenis NGAY LẬP TỨC
    const unlockTimer = setTimeout(() => {
      unlockScrollAndLenis();
    }, 3500);

    // Mốc 4.2 giây: Kết thúc mờ dần, gỡ hoàn toàn DOM của Intro
    const finishTimer = setTimeout(() => {
      unlockScrollAndLenis();
      setIntroFinished(true);
      onComplete();
    }, 4200);

    return () => {
      clearTimeout(unlockTimer);
      clearTimeout(finishTimer);
      unlockScrollAndLenis();
    };
  }, [onComplete]);

  // Nút bỏ qua vào thẳng trang chính ngay lập tức, mở khóa cuộn tức thì
  const handleSkip = () => {
    unlockScrollAndLenis();
    setIntroFinished(true);
    onComplete();
  };

  // Gỡ hoàn toàn DOM của Intro khỏi trang sau khi hoàn thành
  if (introFinished) {
    return null;
  }

  // Quy tắc 3: Kiểm tra link ảnh thật, tuyệt đối loại bỏ mọi link Unsplash
  const isRealCard = (c?: IntroCardConfig | null) => {
    if (!c || !c.src) return false;
    const s = String(c.src).trim();
    if (s.includes("images.unsplash.com") || s.includes("unsplash.com") || s.startsWith("[") || s.includes("DÁN_LINK")) {
      return false;
    }
    return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:") || s.startsWith("/");
  };

  // Ưu tiên ảnh thật từ Firestore (albums/prom_albums/freedom_albums) được pre-fetch ở giây 0.0s
  const realFromFirestore = (realAlbumCards || []).filter(isRealCard);
  const realFromConfig = (config.cards || []).filter(isRealCard);
  const defaultDriveCards = (DEFAULT_INTRO_CONFIG.cards || []).filter(isRealCard);

  const candidateCards = realFromFirestore.length >= 3
    ? realFromFirestore
    : (realFromConfig.length >= 3 ? realFromConfig : (realFromFirestore.length > 0 ? [...realFromFirestore, ...defaultDriveCards] : defaultDriveCards));

  const cardsData = candidateCards.slice(0, 5);
  while (cardsData.length < 5) {
    cardsData.push(
      candidateCards[cardsData.length % Math.max(1, candidateCards.length)] || {
        id: `card-fallback-${cardsData.length}`,
        title: "Bergh.Ryker Portfolio",
        category: "Cinematic",
        src: "",
      }
    );
  }

  // Tọa độ và góc xoay hình cánh quạt (card fan)
  const fanConfigs = [
    { angle: -24, x: -140, y: -16, zIndex: 20 },
    { angle: -12, x: -70, y: -8, zIndex: 22 },
    { angle: 0, x: 0, y: -4, zIndex: 26, isCenter: true },
    { angle: 12, x: 70, y: -8, zIndex: 24 },
    { angle: 24, x: 140, y: -16, zIndex: 21 },
  ];

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  // Cubic bezier theo yêu cầu: cubic-bezier(0.22, 1, 0.36, 1)
  const smoothEase = [0.22, 1, 0.36, 1];

  return (
    // Tổng thời gian: 4.2 giây
    // Giai đoạn 4 (3.5s -> 4.2s): Làm mờ dần lớp Intro (opacity 1 -> 0)
    // Kích hoạt pointer-events: none và mở khóa cuộn tức thì ngay tại 3.5s (mili-giây đầu tiên của fade-out)
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 1, 0] }}
      transition={{
        duration: 4.2,
        times: [0, 0.45, 0.833, 1.0], // 0s -> 3.5s: 1 | 3.5s -> 4.2s: mờ dần về 0
        ease: "easeInOut",
      }}
      className={`fixed inset-0 z-[9999] bg-[#0A0A0C] text-white overflow-hidden flex flex-col justify-between selection:bg-[#B5945B]/30 select-none ${
        isUnlockingTouch ? "pointer-events-none" : "pointer-events-auto"
      }`}
      style={{
        willChange: "opacity",
        pointerEvents: isUnlockingTouch ? "none" : "auto",
      }}
    >
      {/* Preload & Decode ảnh ngay từ giây 00:00 ở trạng thái ẩn */}
      <div
        className="fixed -top-[9999px] -left-[9999px] w-1 h-1 overflow-hidden pointer-events-none select-none"
        style={{ opacity: 0.01 }}
        aria-hidden="true"
      >
        {cardsData.map((cardItem, idx) => (
          <img
            key={`preload-thumb-${cardItem.id || idx}`}
            src={optimizeDriveImageUrl(cardItem.src, 600)}
            alt=""
            loading="eager"
            decoding="async"
            className="w-1 h-1 object-cover"
            onError={(e) => {
              // Tuyệt đối không fallback về bất kỳ link ảnh mẫu nào
              e.currentTarget.style.display = "none";
            }}
          />
        ))}
      </div>

      {/* Vầng sáng vàng kim trung tâm (Ambient Glow) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: [0, 0.85, 0.75, 0],
          scale: [0.8, 1.2, 1.15, 0.85],
        }}
        transition={{
          duration: 4.6,
          times: [0, 0.196, 0.848, 1.0],
          ease: "easeOut",
        }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] max-w-[95vw] max-h-[95vw] rounded-full pointer-events-none blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(181, 148, 91, 0.28) 0%, rgba(10, 10, 12, 0) 70%)",
          transform: "translateZ(0)",
        }}
      />

      {/* Top Header Watermark */}
      <header className="relative z-50 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#E5C17C] animate-pulse" />
          <span className="text-[10px] sm:text-xs font-sans tracking-[0.2em] uppercase text-zinc-400 font-semibold">
            Bergh.Ryker Cinematic
          </span>
        </div>
      </header>

      {/* Giai đoạn 1 (0.0s -> 0.9s): Logo xuất hiện êm ái ở giữa màn hình */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{
          opacity: [0, 1, 1, 0, 0],
          scale: [0.88, 1.04, 1.0, 0.85, 0.8],
          y: [0, 0, -4, -25, -25],
        }}
        transition={{
          duration: 4.6,
          times: [0, 0.09, 0.196, 0.32, 1.0], // 0.0s -> 0.9s hiện êm ái, sau đó mờ dần nhường chỗ cho quạt ảnh
          ease: "easeOut",
        }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] flex flex-col items-center justify-center pointer-events-none select-none"
        style={{
          willChange: "transform, opacity",
          transform: "translateZ(0)",
        }}
      >
        <div
          className={`relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-[#141418] flex flex-col items-center justify-center border border-[#B5945B]/60 shadow-[0_4px_30px_rgba(181,148,91,0.35)] overflow-hidden ${
            config.logoType === "image" && config.logoImageUrl ? "p-0" : "p-3"
          }`}
        >
          <div className="absolute inset-0 rounded-2xl border border-white/10 pointer-events-none z-10" />

          {config.logoType === "image" && config.logoImageUrl ? (
            <img
              src={optimizeDriveImageUrl(config.logoImageUrl, 400)}
              alt="Logo"
              loading="eager"
              decoding="async"
              className={`w-full h-full ${
                config.logoFit === "contain" ? "object-contain p-2" : "object-cover"
              } rounded-2xl block transition-opacity duration-300`}
              onError={(e) => {
                // Tuyệt đối không fallback về bất kỳ ảnh mẫu nào
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <>
              <span className="text-3xl sm:text-4xl font-extrabold font-serif tracking-wider text-[#E5C17C] leading-none">
                {config.logoMonogram || "BR"}
              </span>
              <span className="text-[8px] sm:text-[9px] font-sans font-bold tracking-[0.25em] text-zinc-400 mt-1 uppercase">
                {config.logoSubtitle || "STUDIO"}
              </span>
            </>
          )}
        </div>
      </motion.div>

      {/* Sân khấu chính hiển thị 5 thẻ ảnh */}
      <main className="relative z-10 w-full max-w-5xl mx-auto flex-1 flex flex-col items-center justify-center px-4">
        <div
          className="relative w-full h-[280px] sm:h-[350px] md:h-[400px] flex items-center justify-center"
          style={{ perspective: 1200 }}
        >
          {cardsData.map((cardItem, idx) => {
            const conf = fanConfigs[idx] || fanConfigs[2];
            const targetX = isMobile ? conf.x * 0.58 : conf.x;

            return (
              // Timeline phân kỳ rõ ràng:
              // - Giai đoạn 1 (0.0s -> 0.9s): Ẩn (opacity: 0)
              // - Giai đoạn 2 (0.9s -> 2.1s = 1.2s): Bung xòe quạt chậm rãi, mượt mà với cubic-bezier(0.22, 1, 0.36, 1)
              // - Giai đoạn 3 (2.1s -> 3.9s = 1.8s - QUAN TRỌNG): Giữ nguyên trạng thái xòe quạt để khách ngắm ảnh
              // - Giai đoạn 4 (3.9s -> 4.6s = 0.7s): Mờ dần (opacity 0) để vào trang chính
              <motion.div
                key={cardItem.id || `intro-card-${idx}`}
                initial={{
                  opacity: 0,
                  scale: 0.6,
                  x: 0,
                  y: 35,
                  rotate: 0,
                }}
                animate={{
                  opacity: [0, 0, 1, 1, 0],
                  scale: [
                    0.6,
                    0.6,
                    conf.isCenter ? 1.06 : 0.93,
                    conf.isCenter ? 1.06 : 0.93,
                    (conf.isCenter ? 1.06 : 0.93) * 0.92,
                  ],
                  x: [0, 0, targetX, targetX, targetX],
                  y: [35, 35, conf.y, conf.y, conf.y - 8],
                  rotate: [0, 0, conf.angle, conf.angle, conf.angle],
                }}
                transition={{
                  duration: 4.6,
                  times: [0, 0.196, 0.457, 0.848, 1.0], // 0.0s -> 0.9s -> 2.1s -> 3.9s -> 4.6s
                  ease: smoothEase,
                }}
                className="absolute w-[160px] h-[230px] sm:w-[220px] sm:h-[300px] rounded-2xl overflow-hidden border border-white/15 bg-zinc-950 flex flex-col justify-end pointer-events-none select-none"
                style={{
                  zIndex: conf.zIndex,
                  willChange: "transform, opacity",
                  transformOrigin: "center bottom",
                  transform: "translateZ(0)",
                  WebkitTransform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
                }}
              >
                {cardItem.src ? (
                  <img
                    src={optimizeDriveImageUrl(cardItem.src, 600)}
                    alt={cardItem.title}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      // Tuyệt đối không fallback về bất kỳ link ảnh mẫu nào khác
                      e.currentTarget.style.opacity = "0";
                    }}
                  />
                ) : (
                  <div className="luxury-shimmer absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                    <span className="text-xl font-bold font-serif text-[#E5C17C] tracking-wider mb-1">BR</span>
                    <span className="text-[8px] font-sans text-zinc-400 uppercase tracking-widest">STUDIO</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                {conf.isCenter && (
                  <div className="absolute top-2.5 right-2.5 bg-[#B5945B] text-black text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm z-10">
                    Tiêu Biểu
                  </div>
                )}

                <div className="relative z-10 p-3 sm:p-3.5 text-left pointer-events-none">
                  {cardItem.category && (
                    <span className="text-[9px] text-[#E5C17C] font-bold uppercase tracking-wider block mb-0.5">
                      {cardItem.category}
                    </span>
                  )}
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-sm">
                    {cardItem.title}
                  </h4>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>

      {/* Footer chứa nút Bỏ qua Intro tinh tế */}
      <footer className="relative z-50 pb-6 sm:pb-8 flex flex-col items-center justify-center gap-2 px-4 pointer-events-auto">
        <button
          type="button"
          onClick={handleSkip}
          className="group px-4 py-2 rounded-full text-xs font-sans font-medium text-zinc-300 hover:text-white liquid-glass hover:border-[#E5C17C]/70 transition-all duration-200 flex items-center gap-2 active:scale-95 cursor-pointer"
          title="Bỏ qua Intro và vào thẳng trang chính"
        >
          <span>Bỏ qua Intro</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#E5C17C] transition-transform group-hover:translate-x-0.5" />
        </button>

        <p className="text-[10px] sm:text-[11px] font-sans text-zinc-500 tracking-wider uppercase pointer-events-none">
          Khám phá nghệ thuật kỷ yếu & sự kiện độc bản
        </p>
      </footer>
    </motion.div>
  );
};
