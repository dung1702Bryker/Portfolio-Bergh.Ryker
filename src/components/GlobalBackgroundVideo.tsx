import React, { useState, useEffect, useRef, useCallback } from "react";

export interface GlobalBackgroundVideoProps {
  desktopVideoSrc?: string;
  mobileVideoSrc?: string;
  hlsStreamSrc?: string;
  posterDesktopSrc?: string;
  posterMobileSrc?: string;
  lqipPosterSrc?: string;
  isHeroLayout?: boolean;
}

const DEFAULT_DESKTOP_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260319_015952_e1deeb12-8fb7-4071-a42a-60779fc64ab6.mp4";
const DEFAULT_MOBILE_VIDEO = "/videos/bg-video-mobile.mp4";
const DEFAULT_HLS_STREAM = "/videos/hls/playlist.m3u8";
const DEFAULT_POSTER_DESKTOP = "/images/bg-video-poster.webp";
const DEFAULT_POSTER_MOBILE = "/images/bg-video-poster-mobile.webp";
const DEFAULT_LQIP_POSTER = "/images/bg-video-poster-lqip.webp";

export const GlobalBackgroundVideo: React.FC<GlobalBackgroundVideoProps> = ({
  desktopVideoSrc = DEFAULT_DESKTOP_VIDEO,
  mobileVideoSrc = DEFAULT_MOBILE_VIDEO,
  hlsStreamSrc = DEFAULT_HLS_STREAM,
  posterDesktopSrc = DEFAULT_POSTER_DESKTOP,
  posterMobileSrc = DEFAULT_POSTER_MOBILE,
  lqipPosterSrc = DEFAULT_LQIP_POSTER,
  isHeroLayout = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [saveDataEnabled, setSaveDataEnabled] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Detect screen size, reduced motion preference, and data-saver mode
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check Data Saver mode
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    if (nav.connection?.saveData || nav.connection?.effectiveType === "slow-2g") {
      setSaveDataEnabled(true);
    }

    // Check Reduced Motion preference
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    motionQuery.addEventListener?.("change", handleMotionChange);

    // Responsive screen width listener
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      motionQuery.removeEventListener?.("change", handleMotionChange);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Determine active video source
  const selectedVideoSrc = isMobile ? mobileVideoSrc : desktopVideoSrc;
  const selectedPoster = isMobile ? posterMobileSrc : posterDesktopSrc;

  // Handle play attempt gracefully with browser autoplay policy / low power mode
  const attemptPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || prefersReducedMotion) return;

    video
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch((err: unknown) => {
        // Autoplay may be restricted by iOS Low Power Mode or user preferences.
        // In this case, poster image remains gracefully visible.
        console.debug("Background video autoplay deferred, serving poster backdrop:", err);
        setIsPlaying(false);
      });
  }, [prefersReducedMotion]);

  // Sync playback on source change or visibility change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsVideoReady(false);
    setIsPlaying(false);
    setHasError(false);

    // If reduced motion is requested, pause and stay on static poster
    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    video.load();
    attemptPlay();
  }, [selectedVideoSrc, prefersReducedMotion, attemptPlay]);

  // Tab visibility: pause video when backgrounded to preserve mobile CPU & battery
  useEffect(() => {
    const handleVisibilityChange = () => {
      const video = videoRef.current;
      if (!video) return;

      if (document.visibilityState === "hidden") {
        video.pause();
      } else if (!prefersReducedMotion && !saveDataEnabled) {
        attemptPlay();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [attemptPlay, prefersReducedMotion, saveDataEnabled]);

  const handleCanPlay = () => {
    setIsVideoReady(true);
    attemptPlay();
  };

  const handlePlaying = () => {
    setIsPlaying(true);
    setIsVideoReady(true);
  };

  const handleError = () => {
    console.debug("Background video fallback: switching to high-fidelity poster image");
    setHasError(true);
    setIsVideoReady(false);
    setIsPlaying(false);
  };

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-full h-full z-0 pointer-events-none select-none overflow-hidden bg-zinc-950"
    >
      {/* 1. ULTRA-LIGHTWEIGHT LQIP BLURRED LAYER (Loads instantly ~264 bytes to eliminate any flash) */}
      <img
        src={lqipPosterSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-center filter blur-xl scale-110 opacity-70 transform-gpu z-0"
      />

      {/* 2. ADAPTIVE RESPONSIVE POSTER IMAGE (Mobile 28KB vs Desktop 108KB) */}
      <picture className="absolute inset-0 w-full h-full z-[1]">
        <source media="(max-width: 768px)" srcSet={posterMobileSrc} type="image/webp" />
        <source media="(min-width: 769px)" srcSet={posterDesktopSrc} type="image/webp" />
        <img
          src={selectedPoster}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-out transform-gpu ${
            isPlaying && isVideoReady ? "opacity-0" : "opacity-100"
          }`}
        />
      </picture>

      {/* 3. OPTIMIZED VIDEO ELEMENT (With adaptive sources and mobile check) */}
      {!prefersReducedMotion && !hasError && (
        <video
          ref={videoRef}
          key={selectedVideoSrc}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          preload={isMobile || saveDataEnabled ? "metadata" : "auto"}
          poster={selectedPoster}
          onCanPlay={handleCanPlay}
          onPlaying={handlePlaying}
          onError={handleError}
          referrerPolicy="no-referrer"
          className={`absolute inset-0 w-full h-full object-cover object-center scale-[1.02] transform-gpu transition-opacity duration-1000 ease-out z-[2] ${
            isPlaying && isVideoReady ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Adaptive HLS Stream for native Safari/iOS devices */}
          {hlsStreamSrc && (
            <source src={hlsStreamSrc} type="application/vnd.apple.mpegurl" />
          )}

          {/* Compressed Mobile Video (487 KB) for phone viewports */}
          <source
            src={mobileVideoSrc}
            media="(max-width: 768px)"
            type="video/mp4"
          />

          {/* High Definition Video for Desktop / Tablet viewports */}
          <source
            src={desktopVideoSrc}
            media="(min-width: 769px)"
            type="video/mp4"
          />

          {/* Direct selected fallback */}
          <source src={selectedVideoSrc} type="video/mp4" />
        </video>
      )}

      {/* 4. ULTRA-TRANSPARENT LIQUID GLASS SHADE OVERLAY */}
      <div
        className={`absolute inset-0 transition-all duration-700 ease-in-out z-[3] ${
          isHeroLayout
            ? "bg-black/28 backdrop-blur-[0.5px]"
            : "bg-black/20 backdrop-blur-[1px]"
        }`}
      />
    </div>
  );
};
