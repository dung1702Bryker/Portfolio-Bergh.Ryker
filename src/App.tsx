/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from"react";
import gsap from"gsap";
import { ScrollTrigger } from"gsap/ScrollTrigger";
import {
 ShieldCheck,
 ShieldAlert,
 KeyRound,
 LogOut,
 Check,
 X,
 Settings,
 Lock,
 Unlock,
 User,
 RefreshCw,
 CalendarRange,
 MessageSquare,
 BarChart3,
 Eye,
 Bell,
 Search,
 Sparkles,
  Menu,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Helmet } from "react-helmet-async";
import { useAdminAuth } from "./hooks/useAdminAuth";
import { useSectionAnalytics } from "./hooks/useSectionAnalytics";
import { AnalyticsDashboardModal } from "./components/AnalyticsDashboardModal";
import { useLivePresenceContext } from "./context/LivePresenceContext";
import { LiveVisitorsFloatingWidget } from "./components/LiveVisitorsFloatingWidget";
import { recordPortfolioVisitor } from "./services/analyticsService";
import { useAdminNotification } from "./context/AdminNotificationContext";
import { AdminPushNotificationBanner } from "./components/AdminPushNotificationBanner";
import { AdminNotificationCenterModal } from "./components/AdminNotificationCenterModal";
import { PhotoProgressLookupModal } from "./components/PhotoProgressLookupModal";
import { BookingConfirmationPage } from "./components/BookingConfirmationPage";
import Lenis from "lenis";

// Slide Layout Components
import { HeroLayout } from "./components/HeroLayout";
import { GlobalBackgroundVideo } from "./components/GlobalBackgroundVideo";
import { SocialProofDashboard } from "./components/SocialProofDashboard";
import { PortfolioShowcase } from "./components/PortfolioShowcase";
import { MosaicGallery } from "./components/MosaicGallery";
import { CreatorShowcase } from "./components/CreatorShowcase";
import { BookingContactForm } from "./components/BookingContactForm";
import { SocialProof } from "./components/SocialProof";

// Lazy-loaded heavy off-screen & admin components
const SlideTextEditorCard = React.lazy(() => import("./components/SlideTextEditorCard").then((m) => ({ default: m.SlideTextEditorCard })));
const Chatbot = React.lazy(() => import("./components/Chatbot").then((m) => ({ default: m.Chatbot })));

const localforage = {
  getItem: async <T = any>(..._args: any[]): Promise<T | null> => null,
  setItem: async (..._args: any[]): Promise<void> => {},
};



// Data & Types
import contentData from "./data/contentData";
import { SlideData } from "./types";
import { db, auth, handleFirestoreError, OperationType, isFirestoreQuotaExceeded } from "./firebase";
import { doc, onSnapshot, setDoc, collection, getDocs } from "firebase/firestore";
import { CinematicIntroOverlay } from "./components/CinematicIntroOverlay";
import { AdminIntroEditorModal } from "./components/admin/AdminIntroEditorModal";
import { useIntroConfig } from "./hooks/useIntroConfig";
import { IntroCardConfig } from "./types/introConfig";

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

const idealOrder = ["S1", "S4", "S6", "S8", "S9", "S7"];

const searchKeywords = [
  "Trường bạn sẽ là cuốn phim tiếp theo?",
  "Trường bạn sẽ là cuốn phim tiếp theo",
  "bạn sẽ là cuốn phim tiếp theo?"
];

const cleanSlide = (slide: SlideData): SlideData => {
  let t = slide.title || "";
  let s = slide.subtitle || "";
  let b = slide.body || "";

  if (slide.id === "S1") {
    if (t.includes("Kỷ Yếu Cá Nhân") || (t.toLowerCase() === "portfolio kỷ yếu & sự kiện" && t !== "Portfolio Kỷ Yếu & Sự kiện")) {
      t = "Portfolio Kỷ Yếu & Sự kiện";
    }

    const englishSentences = [
      "For individuals seeking to capture their coming-of-age milestones, and events requiring cinematic, emotionally authentic imagery. We tell your unique story through personal graduation portraits, event documentaries, and highly creative freestyle concepts.",
      "Designed for individuals seeking to capture their unique expression and coming-of-age milestones, alongside cinematic event capture. We move away from generic formulas, telling your unique story through intimate personal graduation session and authentic moments."
    ];

    for (const phrase of englishSentences) {
      if (b.includes(phrase)) {
        b = b.replace(phrase, "").trim();
      }
    }

    b = b.replace(/\n{2,}/g, "\n\n").trim();
  }

  for (const keyword of searchKeywords) {
    if (t.includes(keyword)) {
      t = t.replace(keyword, "").trim();
      t = t.replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").trim();
    }
    if (s.includes(keyword)) {
      s = s.replace(keyword, "").trim();
      s = s.replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").trim();
    }
    if (b.includes(keyword)) {
      b = b.replace(keyword, "").trim();
    }
  }

  return {
    ...slide,
    title: t,
    subtitle: s,
    body: b
  };
};

const sortSlides = (slidesList: SlideData[]): SlideData[] => {
  const cleaned = slidesList.map(cleanSlide);
  const sorted = [...cleaned].sort((a, b) => {
    const idxA = idealOrder.indexOf(a.id);
    const idxB = idealOrder.indexOf(b.id);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
  // Deduplicate slides by ID so no duplicate keys ever occur
  const seen = new Set<string>();
  const unique: SlideData[] = [];
  sorted.forEach((s, idx) => {
    let sId = s.id;
    if (!sId || seen.has(sId)) {
      sId = `${sId || 'slide'}_${idx}`;
    }
    seen.add(sId);
    unique.push({ ...s, id: sId });
  });
  return unique;
};

export default function App() {
 const containerRef = useRef<HTMLDivElement>(null);
 const [activeSlide, setActiveSlide] = useState<number>(0);
 const scrollTrackerRef = useRef<any[]>([]);

 // Local state for slides data to allow real-time text editing
 const [slides, setSlides] = useState<SlideData[]>(() => sortSlides(contentData.slides));
 const { portfolioVisitorsCount, formatViewCount } = useSectionAnalytics();
 const { activeCount, updateLocation, setIsWidgetOpen } = useLivePresenceContext();
 const { unreadCount, setIsNotificationCenterOpen } = useAdminNotification();
 const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
 const [isPhotoProgressOpen, setIsPhotoProgressOpen] = useState(false);
 const [lookupBookingId, setLookupBookingId] = useState("");
 const [myBookingIds, setMyBookingIds] = useState<string[]>(() => {
   try {
     const s = localStorage.getItem("my_booking_ids");
     return s ? JSON.parse(s) : [];
   } catch (e) {
     return [];
   }
 });

 useEffect(() => {
   const handler = (e: any) => {
     if (e.detail?.bookingId) {
       setLookupBookingId(e.detail.bookingId);
     }
     setIsPhotoProgressOpen(true);
   };
   window.addEventListener("openPhotoProgressLookup", handler);

   const params = new URLSearchParams(window.location.search);
   const ticketParam = params.get("ticket") || params.get("lookup") || params.get("progress");
   if (ticketParam) {
     setLookupBookingId(ticketParam);
     setIsPhotoProgressOpen(true);
   }

   return () => window.removeEventListener("openPhotoProgressLookup", handler);
 }, []);

 // Cấu hình Intro & Tải ngầm dữ liệu Firestore song song ngay từ giây 0.0s (Quy tắc 3)
 const { config: introConfig, saveIntroConfig } = useIntroConfig();
 const [isIntroComplete, setIsIntroComplete] = useState(() => {
   try {
     if (typeof window !== "undefined" && window.location.hash.includes("admin")) {
       return true;
     }
   } catch (_) {}
   return false;
 });
 const [isIntroEditorOpen, setIsIntroEditorOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
 const [prefetchedIntroCards, setPrefetchedIntroCards] = useState<IntroCardConfig[]>([]);

 // Quy tắc 3: Tải ngầm Firestore ngay từ giây 0.0s ở phía nền
 useEffect(() => {
   let isCancelled = false;
   const prefetchData = async () => {
     try {
       const collectionsToFetch = ["albums", "prom_albums", "freedom_albums"];
       const loadedCards: IntroCardConfig[] = [];
       const seen = new Set<string>();

       for (const colName of collectionsToFetch) {
         try {
           const snap = await getDocs(collection(db, colName));
           snap.forEach((docSnap) => {
             const d = docSnap.data();
             if (!d.deletedAt && !d.isHidden) {
               const cover = (d.coverImageSrc || (d.images && d.images[0]?.src) || "").trim();
               if (
                 cover &&
                 !cover.includes("unsplash.com") &&
                 !cover.startsWith("[") &&
                 !cover.includes("DÁN_LINK") &&
                 !seen.has(cover)
               ) {
                 seen.add(cover);
                 loadedCards.push({
                   id: `prefetch-${docSnap.id}`,
                   title: d.title || "Bộ Sưu Tập",
                   category: d.subtitle || (colName === "prom_albums" ? "Prom Night" : colName === "freedom_albums" ? "Concept Tự Do" : "Kỷ Yếu"),
                   src: cover,
                 });
               }
             }
           });
         } catch (_) {}
       }

       if (!isCancelled && loadedCards.length > 0) {
         setPrefetchedIntroCards(loadedCards);
       }
     } catch (_) {}
   };

   prefetchData();
   return () => {
     isCancelled = true;
   };
 }, []);

  // Hỗ trợ mở trực tiếp Thẻ vé điện tử & Xác nhận đặt lịch /booking/:code (Quy tắc 3)
  // Hỗ trợ mở trực tiếp Thẻ vé điện tử & Xác nhận đặt lịch /booking/:code hoặc ?booking=
  // Hỗ trợ mở trực tiếp Thẻ vé điện tử & Xác nhận đặt lịch /booking/:code hoặc ?booking=
  const [bookingConfirmationCode, setBookingConfirmationCode] = useState<string | null>(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const qCode = params.get("booking") || params.get("bookingCode") || params.get("bookingId") || params.get("code");
        if (qCode) return qCode.trim();
        const path = window.location.pathname;
        if (path.startsWith("/booking/")) {
          const code = path.replace("/booking/", "").trim();
          if (code) return decodeURIComponent(code);
        }
        const hash = window.location.hash;
        if (hash.includes("/booking/")) {
          const parts = hash.split("/booking/");
          if (parts[1]) {
            const code = parts[1].split("?")[0].trim();
            if (code) return decodeURIComponent(code);
          }
        }
      }
    } catch (_) {}
    return null;
  });

  // Lắng nghe thay đổi URL (popstate) để nhận diện tham số ?booking= công khai ngay lập tức
  useEffect(() => {
    const checkBookingFromUrl = () => {
      try {
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const qCode = params.get("booking") || params.get("bookingCode") || params.get("bookingId") || params.get("code");
          if (qCode && qCode.trim()) {
            setBookingConfirmationCode(qCode.trim());
            return;
          }
          const path = window.location.pathname;
          if (path.startsWith("/booking/")) {
            const code = path.replace("/booking/", "").trim();
            if (code) {
              setBookingConfirmationCode(decodeURIComponent(code));
              return;
            }
          }
        }
      } catch (_) {}
    };

    window.addEventListener("popstate", checkBookingFromUrl);
    return () => window.removeEventListener("popstate", checkBookingFromUrl);
  }, []);

  // Khởi tạo Lenis Smooth Scrolling mượt mà 60fps (Quy tắc 4)
  // Khởi tạo Lenis Smooth Scrolling mượt mà 60fps - Chỉ chạy trên Desktop
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth < 1024 || "ontouchstart" in window) {
      return;
    }
    let lenis: Lenis | null = null;
    let rafId: number;

   try {
     lenis = new Lenis({
       duration: 1.1,
       easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
       smoothWheel: true,
       touchMultiplier: 1.5,
     });

     (window as any).lenis = lenis;
     lenis.on("scroll", ScrollTrigger.update);

     function raf(time: number) {
       lenis?.raf(time);
       rafId = requestAnimationFrame(raf);
     }
     rafId = requestAnimationFrame(raf);
   } catch (e) {
     console.warn("Lenis init warning:", e);
   }

   return () => {
     if (rafId) cancelAnimationFrame(rafId);
     if (lenis) {
       lenis.destroy();
       (window as any).lenis = null;
     }
   };
 }, []);

 // Hidden admin access
 const [hasAdminAccess, setHasAdminAccess] = useState(() => {
 return (
 window.location.pathname ==="/admin"||
 window.location.hash ==="#admin"||
 window.location.hash ==="#admin-access"||
 window.location.search.includes("admin=true")
 );
 });

 useEffect(() => {
 const checkAdminAccess = () => {
 const isRouteMatch =
 window.location.pathname ==="/admin"||
 window.location.hash ==="#admin"||
 window.location.hash ==="#admin-access"||
 window.location.search.includes("admin=true");

 if (isRouteMatch) {
 setHasAdminAccess(true);
 setIsLoginOpen(true);
 if (window.history.replaceState) {
 const url = new URL(window.location.href);
 url.hash = '';
 url.searchParams.delete('admin');
 if (url.pathname ==="/admin") url.pathname ="/";
 window.history.replaceState({}, '', url.toString());
 }
 }
 };

 // Keyboard shortcut helper: Ctrl + Shift + A (Windows/Linux) or Cmd + Shift + A (macOS)
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() ==="a") {
 e.preventDefault();
 setHasAdminAccess(true);
 setIsLoginOpen(true);
 }
 };

 checkAdminAccess();
 window.addEventListener("hashchange", checkAdminAccess);
 window.addEventListener("popstate", checkAdminAccess);
 window.addEventListener("keydown", handleKeyDown);

 return () => {
 window.removeEventListener("hashchange", checkAdminAccess);
 window.removeEventListener("popstate", checkAdminAccess);
 window.removeEventListener("keydown", handleKeyDown);
 };
 }, []);

 useEffect(() => {
 recordPortfolioVisitor();
 }, []);



 useEffect(() => {
 const docRef = doc(db,"appStore","slidesConfig");
 const unsubscribe = onSnapshot(
 docRef, 
 async (docSnap) => {
 if (docSnap.exists()) {
 let data = docSnap.data()?.slides;
 if (data && Array.isArray(data) && data.length > 0) {
 // Migration for S1
 if (!data.find((s: any) => s.id ==="S1")) {
 const newS1 = contentData.slides.find((s) => s.id ==="S1");
 if (newS1) {
 data.unshift(newS1);
 }
 }
 // Migration for S8
 if (!data.find((s: any) => s.id ==="S8")) {
 const indexS9 = data.findIndex((s: any) => s.id ==="S9");
 const newS8 = contentData.slides.find((s) => s.id ==="S8");
 if (newS8) {
 if (indexS9 !== -1) {
 data.splice(indexS9, 0, newS8);
 } else {
 data.push(newS8);
 }
 }
 }

 // Self-healing sanitizer for user request"xoá Trường bạn sẽ là cuốn phim tiếp theo?"
 let modified = false;
 const searchKeywords = [
"Trường bạn sẽ là cuốn phim tiếp theo?",
"Trường bạn sẽ là cuốn phim tiếp theo",
"bạn sẽ là cuốn phim tiếp theo?"
 ];

 data = data.map((slide: any) => {
 let t = slide.title ||"";
 let s = slide.subtitle ||"";
 let b = slide.body ||"";

 
   if (slide.id === "S1") {
     if (t.includes("Kỷ Yếu Cá Nhân") || (t.toLowerCase() === "portfolio kỷ yếu & sự kiện" && t !== "Portfolio Kỷ Yếu & Sự kiện")) {
       t = "Portfolio Kỷ Yếu & Sự kiện";
       modified = true;
     }
     const englishSentences = [
       "For individuals seeking to capture their coming-of-age milestones, and events requiring cinematic, emotionally authentic imagery. We tell your unique story through personal graduation portraits, event documentaries, and highly creative freestyle concepts.",
       "Designed for individuals seeking to capture their unique expression and coming-of-age milestones, alongside cinematic event capture. We move away from generic formulas, telling your unique story through intimate personal graduation session and authentic moments."
     ];
     for (const phrase of englishSentences) {
       if (b.includes(phrase)) {
         b = b.replace(phrase, "").trim();
         modified = true;
       }
     }
     const origB = b;
     b = b.replace(/\n{2,}/g, "\n\n").trim();
     if (b !== origB) {
       modified = true;
     }
   }

   for (const keyword of searchKeywords) {
 if (t.includes(keyword)) {
 t = t.replace(keyword,"").trim();
 t = t.replace(/^\s*\|\s*/,"").replace(/\s*\|\s*$/,"").trim();
 modified = true;
 }
 if (s.includes(keyword)) {
 s = s.replace(keyword,"").trim();
 s = s.replace(/^\s*\|\s*/,"").replace(/\s*\|\s*$/,"").trim();
 modified = true;
 }
 if (b.includes(keyword)) {
 b = b.replace(keyword,"").trim();
 modified = true;
 }
 }

 // If the title or subtitle became empty or is just the target keyword, fallback to default S9 titles
 if (slide.id ==="S9") {
 const defaultS9 = contentData.slides.find((item) => item.id ==="S9");
 if (defaultS9) {
 const titleIsBad = !t || searchKeywords.some(w => t.toLowerCase() === w.toLowerCase());
 const subIsBad = !s || searchKeywords.some(w => s.toLowerCase() === w.toLowerCase());
 if (titleIsBad && t !== defaultS9.title) {
 t = defaultS9.title;
 modified = true;
 }
 if (subIsBad && s !== defaultS9.subtitle) {
 s = defaultS9.subtitle;
 modified = true;
 }
 }
 }

 return {
 ...slide,
 title: t,
 subtitle: s,
 body: b
 };
 });

      if (modified && auth.currentUser && !isFirestoreQuotaExceeded()) {
        try {
          await setDoc(docRef, { slides: data });
        } catch (err) {
          console.warn("Could not auto-write sanitized slides to database", err);
        }
      }

 setSlides(sortSlides(data));
 }
 } else {
 // Fallback or migration
 let initialData = contentData.slides;
 try {
 const saved = await localforage.getItem<string>(
"bergh_ryker_slides_v5",
 );
 if (saved) {
 const parsed = JSON.parse(saved);
 if (Array.isArray(parsed) && parsed.length > 0) {
 initialData = parsed;
 if (!initialData.find((s: any) => s.id ==="S1")) {
 const newS1 = contentData.slides.find((s) => s.id ==="S1");
 if (newS1) initialData.unshift(newS1);
 }
 }
 }
 } catch (e) {
 console.error(e);
 }
 setSlides(sortSlides(initialData));
 }
 },
 (error) => {
 handleFirestoreError(error, OperationType.GET,"appStore/slidesConfig");
 }
 );
 return () => unsubscribe();
 }, []);

 // Global Admin Mode states
 const {
 isAdmin: globalAdminMode,
 user: adminUser,
 login: handleLogin,
 loginWithEmailPassword: handleLoginWithEmailPassword,
 logout: handleLogout,
 } = useAdminAuth();

 const [isLoginOpen, setIsLoginOpen] = useState(false);
 const [loginError, setLoginError] = useState("");
 const [loginSuccess, setLoginSuccess] = useState(false);

 const [isEditMode, setIsEditMode] = useState(false);

 // Email and Password Login Input Fields
 const [emailInput, setEmailInput] = useState("");
 const [passwordInput, setPasswordInput] = useState("");
 const [authMethod, setAuthMethod] = useState<"email"|"google">("email");
 const [isLoggingOut, setIsLoggingOut] = useState(false);

 // Rate Limiting Config
 const [failedAttempts, setFailedAttempts] = useState(() => {
 const saved = sessionStorage.getItem("admin_failed_attempts");
 return saved ? parseInt(saved, 10) : 0;
 });
 const [lockoutUntil, setLockoutUntil] = useState(() => {
 const saved = sessionStorage.getItem("admin_lockout_until");
 return saved ? parseInt(saved, 10) : 0;
 });
 const [countdown, setCountdown] = useState(0);

 // Deep structural security evaluation
 const isVerifiedAdminLoggedIn = !!(globalAdminMode && adminUser && sessionStorage.getItem("admin_logged_in") === "true");

 const verifiedAdminEditMode = !!(
 isEditMode &&
 isVerifiedAdminLoggedIn
 );

 useEffect(() => {
 // If Admin logs out, reset edit mode immediately - Security Middleware
 if (!isVerifiedAdminLoggedIn) {
 setIsEditMode(false);
 }
 }, [isVerifiedAdminLoggedIn]);

 // Lockout system stopwatch
 useEffect(() => {
 if (lockoutUntil > Date.now()) {
 const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
 setCountdown(remaining);
 const interval = setInterval(() => {
 const rem = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
 setCountdown(rem);
 if (rem <= 0) {
 clearInterval(interval);
 }
 }, 1000);
 return () => clearInterval(interval);
 } else {
 setCountdown(0);
 }
 }, [lockoutUntil]);

 const handleSetGlobalAdminMode = async (val: boolean) => {
 if (!val) {
 await handleAdminLogout();
 }
 };

 const recordFailedAttempt = (customMsg?: string) => {
 const nextAttempts = failedAttempts + 1;
 setFailedAttempts(nextAttempts);
 sessionStorage.setItem("admin_failed_attempts", nextAttempts.toString());
 
 if (nextAttempts >= 5) {
 const lockTime = Date.now() + 30 * 1000; // 30 seconds lockout
 setLockoutUntil(lockTime);
 sessionStorage.setItem("admin_lockout_until", lockTime.toString());
 setLoginError("⚠️ Đăng nhập sai quá 5 lần! Hệ thống tạm thời khóa đăng nhập trong 30 giây.");
 } else {
 setLoginError(customMsg || `⚠️ Đăng nhập thất bại. Bạn còn ${5 - nextAttempts} lần thử.`);
 }
 };

 const handleAdminLogout = async () => {
 if (isLoggingOut) return;
 setIsLoggingOut(true);
 try {
 await handleLogout(); // This calls Firebase signOut
 // Clear any session storage we manually set
 sessionStorage.removeItem("admin_failed_attempts");
 sessionStorage.removeItem("admin_lockout_until");
 sessionStorage.removeItem("admin_logged_in");
 setIsEditMode(false);
 setIsLoginOpen(false);
 window.location.reload();
 } catch (err) {
 console.error("Logout failed", err);
 setIsLoggingOut(false);
 }
 };

 const handleGoogleLoginSubmit = async () => {
 if (lockoutUntil > Date.now()) {
 setLoginError(`⚠️ Hệ thống đang tạm khóa. Thử lại sau ${countdown} giây.`);
 return;
 }
 setLoginError("");
 setLoginSuccess(false);

 try {
 await handleLogin();
 // On successful login, clear lockout and count
 setFailedAttempts(0);
 sessionStorage.removeItem("admin_failed_attempts");
 sessionStorage.removeItem("admin_lockout_until");
 setLoginSuccess(true);
        sessionStorage.setItem('admin_logged_in', 'true');
 setTimeout(() => {
 setIsLoginOpen(false);
 setLoginSuccess(false);
 }, 1200);
 } catch (err: any) {
 console.error(err);
 let errMsg ="⚠️ Đăng nhập Google bị hủy hoặc thất bại.";
 if (err.message && err.message.includes("không có quyền")) {
 errMsg = `⚠️ ${err.message}`;
 }
 recordFailedAttempt(errMsg);
 }
 };

 const handleEmailPasswordLoginSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (lockoutUntil > Date.now()) {
 setLoginError(`⚠️ Hệ thống đang tạm khóa. Thử lại sau ${countdown} giây.`);
 return;
 }
 if (!emailInput.trim() || !passwordInput) {
 setLoginError("⚠️ Vui lòng điền đầy đủ Email và Mật khẩu.");
 return;
 }
 setLoginError("");
 setLoginSuccess(false);

 try {
 await handleLoginWithEmailPassword(emailInput.trim(), passwordInput);
 // On success
 setFailedAttempts(0);
 sessionStorage.removeItem("admin_failed_attempts");
 sessionStorage.removeItem("admin_lockout_until");
 setLoginSuccess(true);
        sessionStorage.setItem('admin_logged_in', 'true');
 setTimeout(() => {
 setIsLoginOpen(false);
 setLoginSuccess(false);
 setEmailInput("");
 setPasswordInput("");
 }, 1200);
 } catch (err: any) {
 console.error(err);
 let errMsg ="⚠️ Sai Email hoặc Mật khẩu quản trị.";
 if (err.code ==="auth/user-not-found"|| err.code ==="auth/wrong-password"|| err.code ==="auth/invalid-credential") {
 errMsg ="⚠️ Thông tin tài khoản hoặc mật khẩu không chính xác.";
 } else if (err.message && err.message.includes("không có quyền")) {
 errMsg = `⚠️ ${err.message}`;
 }
 recordFailedAttempt(errMsg);
 }
 };

 useEffect(() => {
 // Clear existing triggers to prevent duplicates in dev reload
 ScrollTrigger.getAll().forEach((t) => t.kill());

 const slidesElements = gsap.utils.toArray(
".slide-section",
 ) as HTMLElement[];

 slidesElements.forEach((slide, idx) => {
 // 1. ScrollSpy tracker to highlight the active focus point on the right
 ScrollTrigger.create({
 trigger: slide,
 start:"top 45%",
 end:"bottom 45%",
 onToggle: (self) => {
 if (self.isActive) {
 setActiveSlide(idx);
 }
 },
 });
 });

 return () => {
 ScrollTrigger.getAll().forEach((t) => t.kill());
 };
 }, [slides]); // rebuild bindings if slides content changes structure

 const lastReportedSlideRef = useRef<string>("");

 // Sync active slide section to live presence
 useEffect(() => {
 const currentSlide = slides[activeSlide];
 if (currentSlide && currentSlide.id !== lastReportedSlideRef.current) {
 lastReportedSlideRef.current = currentSlide.id;
 const slideMetaMap: Record<string, { page: string; detail: string }> = {
 S1: { page: "Trang Chủ Portfolio", detail: "Khám phá câu chuyện & thông điệp kỷ yếu" },
 S3: { page: "Bảng Tin Trực Tuyến", detail: "Xem đánh giá & phản hồi kỷ yếu" },
 S4: { page: "Bộ Sưu Tập Kỷ Yếu THPT", detail: "Xem các lớp & khoảnh khắc học đường" },
 S5: { page: "Khoảnh Khắc Mosaic", detail: "Xem thư viện ảnh ngẫu hứng" },
 S6: { page: "Bộ Sưu Tập Prom Night", detail: "Khám phá dạ hội & lễ tri ân" },
 S7: { page: "Đội Ngũ Nhiếp Ảnh", detail: "Ekip sáng tạo & triết lý hình ảnh" },
 S8: { page: "Concept Nghệ Thuật & Tự Do", detail: "Bộ ảnh sáng tạo độc bản" },
 S9: { page: "Đăng Ký & Đặt Lịch Chụp", detail: "Khám phá gói chụp & tư vấn lịch" },
 };
 const info = slideMetaMap[currentSlide.id] || {
 page: currentSlide.title || "Portfolio Kỷ Yếu",
 detail: currentSlide.subtitle || "Khám phá",
 };
 updateLocation(info.page, info.detail);
 }
 }, [activeSlide, slides, updateLocation]);

 // Handler to scroll to specific slides
 const scrollToSlide = (id: string) => {
 const el = document.getElementById(id);
 if (el) {
 el.scrollIntoView({ behavior:"smooth"});
 }
 };

 // Render correct component based on indices
 const renderLayout = (slide: SlideData, index: number) => {
 switch (slide.id) {
 case"S1":
 return (
 <HeroLayout
 slide={slide}
 onExplorePortfolios={() => scrollToSlide("S8")}
 onBookNow={() => scrollToSlide("S9")}
 />
 );
 case"S3":
 return <SocialProofDashboard slide={slide} />;
 case"S4":
 return (
 <PortfolioShowcase
 slide={slide}
 isAdminGlobal={verifiedAdminEditMode}
 firestoreCollection="albums"
 />
 );
 case"S5":
 return <MosaicGallery slide={slide} />;
 case"S6":
 return (
 <PortfolioShowcase
 slide={slide}
 isAdminGlobal={verifiedAdminEditMode}
 firestoreCollection="prom_albums"
 />
 );
 case"S7":
 return (
 <CreatorShowcase
 slide={slide}
 isAdminGlobal={verifiedAdminEditMode}
 onImagesBulkUpdate={async (newImages) => {
 const updatedSlides = slides.map((s) => {
 if (s.id === slide.id) {
 return { ...s, images: newImages };
 }
 return s;
 });
 setSlides(updatedSlides);
 try {
 await localforage.setItem(
"bergh_ryker_slides_v5",
 JSON.stringify(updatedSlides),
 );
 const payloadSize = JSON.stringify(updatedSlides).length;
 if (payloadSize < 900000) {
 await setDoc(doc(db,"appStore","slidesConfig"), {
 slides: updatedSlides,
 });
 } else {
 console.warn(
 `Payload too large for Firestore (${payloadSize} bytes). Allowed up to ~1MB. Only saved locally.`,
 );
 alert(
"⚠️ Dữ liệu ảnh quá lớn để lưu lên máy chủ (vượt 1MB). Ảnh hiện chỉ được lưu trực tiếp trên máy của bạn hiện tại. Hãy dùng ảnh bé hơn hoặc dùng link Google Drive để hiển thị chung cho tất cả mọi người.",
 );
 }
 } catch (e) {
 console.error(e);
 }
 }}
 />
 );
 case"S8":
 return (
 <PortfolioShowcase
 slide={slide}
 isAdminGlobal={verifiedAdminEditMode}
 firestoreCollection="freedom_albums"
 />
 );
 case"S9":
 return (
 <div className="w-full flex flex-col items-center">
 <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-8">
 <BookingContactForm slide={slide} isAdminGlobal={verifiedAdminEditMode} isLoggedAdmin={isVerifiedAdminLoggedIn} />
 </div>
 </div>
 );
 default:
 return null;
 }
 };

 const activeSeo = slides[activeSlide]?.seo;

 return (
 <div
 ref={containerRef}
 className="relative bg-transparent text-white font-manrope selection:bg-optic-yellow selection:text-black min-h-screen"
 >
 <Helmet>
 <title>{activeSeo?.title ||"BERGH.RYKER — Portfolio Kỷ Yếu & Nhiếp Ảnh Sự Kiện"}</title>
 <meta name="description"content={activeSeo?.description ||"Portfolio kỷ yếu và nhiếp ảnh sự kiện chất lượng cao của BERGH.RYKER. Lưu giữ mọi khoảnh khắc thanh xuân rực rỡ và chuyên nghiệp."} />
 {activeSeo?.keywords && <meta name="keywords"content={activeSeo.keywords} />}
 <meta property="og:title" content={activeSeo?.title || "BERGH.RYKER — Portfolio Kỷ Yếu & Nhiếp Ảnh Sự Kiện"} />
 <meta property="og:description" content={activeSeo?.description || "Portfolio kỷ yếu và nhiếp ảnh sự kiện chất lượng cao của BERGH.RYKER."} />
 <meta property="og:image" content="https://bergh-ryker.ai.studio/og-image-square.png?v=2" />
 <meta property="og:type" content="website" />
 <meta name="twitter:card" content="summary_large_image" />
 <meta name="twitter:image" content="https://bergh-ryker.ai.studio/og-image-square.png?v=2" />
 </Helmet>

 {/* CINEMATIC INTRO OVERLAY (Quy tắc 3) */}
  {!bookingConfirmationCode && introConfig.enabled && !isIntroComplete && (
   <CinematicIntroOverlay
     config={introConfig}
     realAlbumCards={prefetchedIntroCards}
     onComplete={() => setIsIntroComplete(true)}
   />
 )}

 {/* GLOBAL FIXED BACKGROUND VIDEO WITH ADAPTIVE STREAMING & COMPRESSED MOBILE FALLBACK */}
 <GlobalBackgroundVideo
 isHeroLayout={slides[activeSlide]?.layout ==="Hero Layout" || slides[activeSlide]?.layout ==="Hero"}
 />

  {/* 1. GLASSMORPHISM NAVIGATION HEADER */}
  {!bookingConfirmationCode && (
    <>
  <header className="sticky top-0 left-0 w-full z-40 bg-[rgba(18,18,20,0.75)] backdrop-blur-[16px] border-b border-[rgba(255,255,255,0.08)] pt-[max(env(safe-area-inset-top),0px)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 flex flex-row justify-between items-center gap-2">
      {/* Logo brand */}
      <div
        onClick={() => {
          scrollToSlide(slides[0]?.id || "S1");
          setIsMobileMenuOpen(false);
        }}
        className="flex items-center cursor-pointer group"
      >
        <span className="font-sans font-bold text-[13px] sm:text-base md:text-[17px] tracking-wide text-[#F8F8F8] transition-opacity hover:opacity-80 uppercase">
          BERGH.RYKER
        </span>
      </div>

      {/* Desktop Nav menu links */}
      <nav className="hidden md:flex items-center gap-4 sm:gap-6 md:gap-8 text-[11px] sm:text-[12px] md:text-[13px] font-sans font-medium tracking-wide">
        <button
          onClick={() => scrollToSlide("S8")}
          className="text-zinc-400 hover:text-[#F8F8F8] transition-colors cursor-pointer py-1"
        >
          Bộ sưu tập
        </button>

        <button
          onClick={() => scrollToSlide("S7")}
          className="text-zinc-400 hover:text-[#F8F8F8] transition-colors cursor-pointer py-1"
        >
          Giới thiệu
        </button>

        <button
          onClick={() => setIsPhotoProgressOpen(true)}
          className="text-[#B5945B] hover:text-[#d4af37] transition-colors cursor-pointer py-1 flex items-center gap-1.5 font-semibold"
          title="Tra cứu tiến độ chỉnh ảnh & tải file hoàn thiện"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Tra cứu ảnh</span>
        </button>

        <button
          onClick={() => scrollToSlide("S9")}
          className="transition-all cursor-pointer bg-[#F8F8F8] text-[#1A1A1A] hover:bg-[#EAEAEA] active:scale-95 text-[11px] font-bold block px-4 py-1.5 sm:px-5 sm:py-2 rounded-full font-sans tracking-wide"
        >
          Đặt lịch
        </button>
      </nav>

      {/* Mobile Right Action Cluster (Minimalist Split Navbar) */}
      <div className="flex md:hidden items-center gap-2">
        <button
          onClick={() => setIsPhotoProgressOpen(true)}
          className="p-2 rounded-full bg-white/5 border border-white/10 text-zinc-300 hover:text-white transition-all cursor-pointer"
          title="Tra cứu ảnh"
          aria-label="Tra cứu ảnh"
        >
          <Search className="w-4 h-4 text-[#B5945B]" />
        </button>

        <button
          onClick={() => scrollToSlide("S9")}
          className="px-3.5 py-1.5 rounded-full bg-[#F8F8F8] text-[#1A1A1A] font-bold text-xs tracking-wide shadow-sm active:scale-95 transition-all cursor-pointer"
        >
          Đặt lịch
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-full bg-white/5 border border-white/10 text-zinc-200 hover:text-white transition-all cursor-pointer ml-0.5"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5 text-[#E5C17C]" />
        </button>
      </div>
    </div>
  </header>

  {/* Mobile Liquid Glass Hamburger Menu Drawer */}
  <AnimatePresence>
    {isMobileMenuOpen && (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-x-0 top-[calc(56px+max(env(safe-area-inset-top),0px))] z-30 md:hidden bg-[rgba(18,18,20,0.92)] backdrop-blur-[20px] border-b border-white/10 shadow-2xl py-6 px-6 flex flex-col gap-4 text-left"
      >
        <button
          onClick={() => {
            scrollToSlide("S8");
            setIsMobileMenuOpen(false);
          }}
          className="py-2.5 text-sm font-medium text-zinc-300 hover:text-white border-b border-white/5 text-left transition-colors flex items-center justify-between"
        >
          <span>Bộ sưu tập</span>
          <span className="text-xs text-zinc-500 font-mono">01</span>
        </button>

        <button
          onClick={() => {
            scrollToSlide("S7");
            setIsMobileMenuOpen(false);
          }}
          className="py-2.5 text-sm font-medium text-zinc-300 hover:text-white border-b border-white/5 text-left transition-colors flex items-center justify-between"
        >
          <span>Giới thiệu</span>
          <span className="text-xs text-zinc-500 font-mono">02</span>
        </button>

        <button
          onClick={() => {
            setIsPhotoProgressOpen(true);
            setIsMobileMenuOpen(false);
          }}
          className="py-2.5 text-sm font-semibold text-[#B5945B] hover:text-[#d4af37] border-b border-white/5 text-left transition-colors flex items-center justify-between"
        >
          <span>Tra cứu tiến độ ảnh</span>
          <Search className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            scrollToSlide("S9");
            setIsMobileMenuOpen(false);
          }}
          className="mt-2 w-full py-3 rounded-full bg-[#B5945B] hover:bg-[#a3844e] text-zinc-950 font-bold text-xs uppercase tracking-wider text-center transition-all shadow-lg active:scale-95 cursor-pointer"
        >
          Đặt lịch chụp ngay
        </button>
      </motion.div>
    )}
  </AnimatePresence>


 {/* 2. RIGHT-SIDE SCROLLSPY PROGRESS INDICATOR (FOCUS POINTS) */}
 <div className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-5 items-center bg-graphite/45 backdrop-blur-md p-3 rounded-full border border-white/5 shadow-lg">
 
 {slides.map((slide, index) => {
 const isActive = activeSlide === index;
 return (
 <button
 key={`spy-nav-${slide.id || index}-${index}`}
 onClick={() => scrollToSlide(slide.id)}
 className="relative group focus:outline-none flex items-center justify-center cursor-pointer"
 aria-label={`Scroll spy to Section ${slide.title}`}
 >
 {/* Outer ring */}
 <div
 className={`w-5.5 h-5.5 rounded-full border flex items-center justify-center transition-all ${
 isActive
 ?"border-optic-yellow shadow-glow scale-100 rotate-90 duration-500"
 :"border-transparent scale-75 group-hover:border-white/25"
 }`}
 >
 {/* Center dot/dash */}
 <div
 className={`transition-all duration-300 rounded-[2px] ${
 isActive
 ?"w-1.5 h-1.5 bg-optic-yellow"
 :"w-1 h-1 bg-white opacity-25 group-hover:opacity-100 group-hover:bg-[#00D4FF]"
 }`}
 />
 </div>

 {/* Tooltip on left hover */}
 <span className="absolute right-8 font-sans text-[11px] uppercase tracking-wide text-[#E2FF00] bg-darkroom/90 border border-optic-yellow/10 px-2.5 py-1 rounded shadow-glow opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap">
 {slide.id} | {slide.title}
 </span>
 </button>
 );
 })}
 </div>
 </>
 )}

 {/* 3. MAIN FULL SCREEN SLIDES CONTAINER */}
  <main className="w-full relative touch-action-pan-y">
  {bookingConfirmationCode ? (
    <div className="w-full min-h-screen py-10 px-4 md:px-8 relative z-20 max-w-4xl mx-auto">
      <BookingConfirmationPage
        bookingCode={bookingConfirmationCode}
        onNavigateHome={() => {
          window.history.pushState({}, "", "/");
          setBookingConfirmationCode(null);
        }}
      />
    </div>
  ) : (
    <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8 md:pt-12 pb-4 md:pb-6 relative">
 {slides.map((slide, index) => {
 const isHero = index === 0;
 return (
 <section
 key={`slide-view-${slide.id || index}-${index}`}
 id={slide.id}
 className={`slide-section scroll-mt-20 w-full relative flex flex-col items-center justify-center ${
 isHero
 ?"pt-12 pb-6"
 :"min-h-[80vh] lg:min-h-screen py-20 lg:py-28 border-t border-[#ffffff05]"
 }`}
 >

 {/* Central Web Text Content Editor Panel (Trình sửa chữ Slide toàn diện) */}
 {verifiedAdminEditMode && (
 <div className="w-full relative z-30">
 <React.Suspense fallback={null}>
 <SlideTextEditorCard
 slide={slide}
 onSave={async (updated) => {
 const updatedSlides = slides.map((s) =>
 s.id === updated.id ? updated : s,
 );
 const sortedSlides = sortSlides(updatedSlides); setSlides(sortedSlides);
 try {
 await localforage.setItem(
"bergh_ryker_slides_v5",
 JSON.stringify(sortedSlides),
 );
 const payloadSize =
 JSON.stringify(sortedSlides).length;
 if (payloadSize < 900000) {
 await setDoc(doc(db,"appStore","slidesConfig"), {
 slides: sortedSlides,
 });
 } else {
 console.warn(
 `Payload too large for Firestore (${payloadSize} bytes). Allowed up to ~1MB. Only saved locally.`,
 );
 alert(
"⚠️ Dữ liệu ảnh quá lớn để lưu lên máy chủ (vượt 1MB). Ảnh hiện chỉ được lưu trực tiếp trên máy của bạn hiện tại. Hãy dùng ảnh bé hơn hoặc dùng link Google Drive để hiển thị chung cho tất cả mọi người.",
 );
 }
 } catch (e) {
 console.error(e);
 }
 }}
 />
 </React.Suspense>
 </div>
 )}

 {/* Animation revealing block wrappers using Framer Motion */}
 <motion.div
 initial={{ opacity: 0, y: 16 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true, amount: "some", margin: "250px 0px" }}
 transition={{ duration: 0.35, ease: "easeOut" }}
 className={`w-full flex items-center justify-center ${isHero ? "h-full" : ""}`}
 >
 {renderLayout(slide, index)}
 </motion.div>
 </section>
 );
 })}

 {/* Khách hàng nói gì? Những mảnh ghép cảm xúc - AT THE VERY END OF ALL SLIDES */}
 <section id="testimonials"className="w-full relative flex flex-col items-center justify-center py-10 md:py-14 border-t border-[#ffffff05] scroll-mt-20">
 <SocialProof isAdminGlobal={verifiedAdminEditMode} />
 </section>

    </div>
  )}
  </main>

 {/* 4. FOOTER WITH INTEGRATED GLOBAL ADMINISTRATIVE SWITCH */}
 {!bookingConfirmationCode && (
 <>
 <footer className="w-full bg-zinc-950/20 backdrop-blur-md border-t border-white/5 pt-8 pb-[calc(1.25rem+env(safe-area-inset-bottom,16px))] md:pt-10 md:pb-8 text-center font-sans text-[12px] text-gray-500 leading-relaxed relative z-20">
 <div className="max-w-2xl mx-auto px-6 space-y-4">
 {/* Admin Switcher & Console Button at very bottom as requested */}
 {isVerifiedAdminLoggedIn && (
  <div className="border-b border-white/5 pb-4 flex flex-col items-center justify-center gap-2">
    <div className="flex flex-col items-center gap-3 py-2 w-full">
      {/* Icon-only Liquid Glass Admin Dock */}
      <div className="flex items-center justify-center w-full relative px-2">
        <div className="flex items-center justify-between overflow-hidden bg-[rgba(18,18,20,0.75)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.1)] px-3 py-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.6)] relative z-10 gap-1 sm:gap-1.5 max-w-full">
          
          {/* 1. Nhóm Chế độ làm việc (Icon-only Mode Switcher) */}
          <div className="flex items-center bg-black/60 p-0.5 rounded-full border border-white/5 shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => setIsEditMode(false)}
              className={`p-2 rounded-full text-xs transition-all flex items-center justify-center cursor-pointer select-none 
                ${!isEditMode ? "bg-zinc-800 text-white shadow-sm font-semibold" : "text-zinc-400 hover:text-white hover:bg-white/10"}`}
              title="Xem trước website như khách hàng"
              aria-label="Xem trước website"
            >
              <Eye className="w-4 h-4 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => { if (isVerifiedAdminLoggedIn) setIsEditMode(true); }}
              className={`p-2 rounded-full text-xs transition-all flex items-center justify-center cursor-pointer select-none 
                ${isEditMode ? "bg-[#B5945B] text-zinc-950 font-bold shadow-md shadow-[#B5945B]/25" : "text-zinc-400 hover:text-white hover:bg-white/10"}`}
              title="Bật chế độ chỉnh sửa Quản trị"
              aria-label="Quản trị"
            >
              <Settings className={`w-4 h-4 shrink-0 ${isEditMode ? "animate-[spin_4s_linear_infinite]" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsIntroEditorOpen(true)}
              className="p-2 rounded-full text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center cursor-pointer select-none"
              title="Cài đặt màn hình Intro điện ảnh"
              aria-label="Cài đặt Intro"
            >
              <Sparkles className="w-4 h-4 text-[#B5945B] shrink-0" />
            </button>
          </div>

          {/* Subtle Divider */}
          <div className="w-[1px] h-4 bg-white/10 shrink-0" />

          {/* 2. Nhóm Giám sát & Phân tích (Icon-only Stats with Live Pulse) */}
          <div className="flex items-center bg-white/5 p-0.5 rounded-full border border-white/5 shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setIsAnalyticsOpen(true)}
              className="px-2.5 py-1.5 rounded-full text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title={`Thống kê: ${formatViewCount(portfolioVisitorsCount)} lượt xem`}
              aria-label="Thống kê lượt xem"
            >
              <BarChart3 className="w-4 h-4 text-[#B5945B] shrink-0" />
              <span className="text-[11px] font-bold text-zinc-200">
                {formatViewCount(portfolioVisitorsCount)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsWidgetOpen(true)}
              className="relative p-2 rounded-full text-xs text-emerald-400 hover:bg-emerald-500/15 transition-all flex items-center justify-center cursor-pointer"
              title={`Khách trực tuyến: ${activeCount} online`}
              aria-label="Khách trực tuyến"
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </button>
          </div>

          {/* Subtle Divider */}
          <div className="w-[1px] h-4 bg-white/10 shrink-0" />

          {/* 3. Nhóm Tiện ích & Tài khoản (Alerts, Profile & Logout) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsNotificationCenterOpen(true)}
              className="relative p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center cursor-pointer"
              title="Trung tâm cảnh báo & thông báo Admin"
              aria-label="Thông báo"
            >
              <Bell className={`w-4 h-4 ${unreadCount > 0 ? "text-amber-400 animate-bounce" : "text-zinc-400"}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white font-extrabold text-[9px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>

            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 select-none overflow-hidden"
              title={`Admin: ${adminUser?.email || "Quản trị viên"}`}
            >
              {adminUser?.photoURL ? (
                <img
                  src={adminUser.photoURL}
                  alt="Admin"
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-[#B5945B] font-bold text-[10px] sm:text-[11px] uppercase">
                  {adminUser?.email?.[0] || "A"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={async () => { await handleAdminLogout(); }}
              disabled={isLoggingOut}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 hover:bg-red-500/20 border border-white/5 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition-all flex items-center justify-center disabled:opacity-50 shrink-0 cursor-pointer ml-0.5"
              title="Đăng xuất quyền quản trị"
              aria-label="Đăng xuất"
            >
              {isLoggingOut ? (
                <div className="w-3 h-3 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  </div>
  )}

 <div className="flex flex-col items-center gap-3 py-1 mt-2 text-center">
 <p className="tracking-wide text-xs text-zinc-500 font-sans select-none">
 © 2026{" "}
 <span
 role="button"
 tabIndex={-1}
 onClick={() => {
 setHasAdminAccess(true);
 setIsLoginOpen(true);
 }}
 className="font-bold font-sans text-zinc-400 cursor-default"
 >
 BERGH.RYKER
 </span>{" "}
 · Portfolio Kỷ Yếu & Nhiếp Ảnh Sự Kiện
 </p>
 <div className="flex justify-center gap-6">
 <a href="https://www.instagram.com/berghryker.st?igsh=MTl0czYyNGUwcjN2MQ%3D%3D&utm_source=qr"target="_blank"rel="noopener noreferrer"className="text-zinc-500 hover:text-white transition-colors p-2 -m-2 opacity-80 hover:opacity-100" aria-label="Instagram">
 <svg className="w-5 h-5"fill="none"stroke="currentColor"viewBox="0 0 24 24"xmlns="http://www.w3.org/2000/svg"><rect x="2"y="2"width="20"height="20"rx="5"ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5"y1="6.5"x2="17.51"y2="6.5"></line></svg>
 </a>
 <a href="https://www.facebook.com/share/195Fyep4vh/?mibextid=wwXIfr"target="_blank"rel="noopener noreferrer"className="text-zinc-500 hover:text-white transition-colors p-2 -m-2 opacity-80 hover:opacity-100" aria-label="Facebook">
 <svg className="w-5 h-5"fill="none"stroke="currentColor"viewBox="0 0 24 24"xmlns="http://www.w3.org/2000/svg"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
 </a>
 <a href="https://zalo.me/0365266204"target="_blank"rel="noopener noreferrer"className="text-zinc-500 hover:text-white transition-colors p-2 -m-2 opacity-80 hover:opacity-100" aria-label="Zalo">
 <svg className="w-5 h-5"fill="none"stroke="currentColor"viewBox="0 0 24 24"xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round"strokeLinejoin="round"strokeWidth="2"d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
 </a>
 </div>
 </div>
 </div>
 </footer>


 {/* Chatbot siêu AI */}
 <React.Suspense fallback={null}>
  <Chatbot />
 </React.Suspense>
 </>
 )}



 {/* ADMIN PASSCODE ACCORDION / DIALOG WINDOW */}
 <AnimatePresence>
 {isLoginOpen && (
 <div key="admin-login-modal-overlay" className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
 <motion.div
 initial={{ scale: 0.93, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.93, opacity: 0 }}
 transition={{ type:"spring", duration: 0.4 }}
 className="w-full max-w-md bg-zinc-950 border-2 border-[#B5945B]/30 rounded-3xl p-6 shadow-lg relative overflow-hidden text-left"
 >
 {/* Visual Ambient Gold Highlight */}
 <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"/>

 <div className="flex justify-between items-start mb-5">
 <div className="flex items-center gap-2.5">
 <div className="p-2 bg-amber-400/10 rounded-xl border border-amber-400/20 text-[#B5945B]">
 <Lock className="w-5 h-5 animate-pulse"/>
 </div>
 <div>
 <span className="font-sans text-[11px] text-[#B5945B] tracking-wide uppercase font-medium block">
 Secure Infrastructure
 </span>
 <h4 className="font-sans font-bold text-sm text-white uppercase tracking-wide">
 ĐĂNG NHẬP SYSTEM ADMIN
 </h4>
 </div>
 </div>
 <button
 onClick={() => {
 setIsLoginOpen(false);
 setLoginError("");
 setEmailInput("");
 setPasswordInput("");
 }}
 className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white cursor-pointer"
 >
 <X className="w-4 h-4"/>
 </button>
 </div>

 {/* TABS INTERFACE */}
 <div className="flex border-b border-white/5 pb-1 mb-4">
 <button
 onClick={() => {
 setAuthMethod("email");
 setLoginError("");
 }}
 className={`flex-1 pb-2 text-center text-[12px] font-sans uppercase font-medium tracking-wide border-b-2 transition-all ${
 authMethod ==="email"
 ?"border-[#B5945B] text-[#B5945B]"
 :"border-transparent text-zinc-500 hover:text-zinc-300"
 }`}
 >
 Email & Password
 </button>
 <button
 onClick={() => {
 setAuthMethod("google");
 setLoginError("");
 }}
 className={`flex-1 pb-2 text-center text-[12px] font-sans uppercase font-medium tracking-wide border-b-2 transition-all ${
 authMethod ==="google"
 ?"border-[#B5945B] text-[#B5945B]"
 :"border-transparent text-zinc-500 hover:text-zinc-300"
 }`}
 >
 Google Account
 </button>
 </div>

 {loginError && (
 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500/90 text-xs font-semibold leading-relaxed mb-4">
 {loginError}
 </div>
 )}

 {loginSuccess && (
 <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 text-[11px] font-sans font-medium uppercase tracking-wide flex items-center gap-2 mb-4">
 <Check className="w-4 h-4 animate-bounce text-emerald-400"/>
 <span>Xác thực thành công! Đang chuyển hướng...</span>
 </div>
 )}

 {countdown > 0 ? (
 <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl text-center space-y-2 mb-2">
 <div className="text-red-400 text-xs font-medium">Bạn đã bị khóa do nhập sai quá 5 lần.</div>
 <div className="text-xl font-bold font-sans text-red-400 tracking-wide">
 {countdown} Giây còn lại
 </div>
 </div>
 ) : (
 <>
 {authMethod ==="email"? (
 <form onSubmit={handleEmailPasswordLoginSubmit} className="space-y-4">
 <div className="space-y-1.5">
 <label className="block text-[11px] font-sans text-zinc-400 font-medium">
 Email Quản Trị
 </label>
 <input
 type="email"
 required
 value={emailInput}
 onChange={(e) => setEmailInput(e.target.value)}
 placeholder="admin@example.com"
 className="w-full px-4 py-2.5 bg-black border border-white/10 focus:border-[#B5945B]/65 rounded-xl text-zinc-200 text-xs font-sans outline-none transition-all focus:ring-1 focus:ring-[#B5945B]/30"
 />
 </div>

 <div className="space-y-1.5">
 <label className="block text-[11px] font-sans text-zinc-400 font-medium">
 Mật Khẩu Quản Trị
 </label>
 <input
 type="password"
 required
 value={passwordInput}
 onChange={(e) => setPasswordInput(e.target.value)}
 placeholder="••••••••••••"
 className="w-full px-4 py-2.5 bg-black border border-white/10 focus:border-[#B5945B]/65 rounded-xl text-zinc-200 text-xs font-sans outline-none transition-all focus:ring-1 focus:ring-[#B5945B]/30"
 />
 </div>

 <div className="pt-2">
 <button
 type="submit"
 className="w-full py-3 bg-[#B5945B] hover:bg-[#cbb181] text-black font-medium uppercase tracking-wide rounded-xl transition-all font-sans text-xs shadow-lg shadow-[#B5945B]/10 cursor-pointer text-center"
 >
 XÁC THỰC CREDENTIALS
 </button>
 </div>
 </form>
 ) : (
 <div className="space-y-4 pt-1 pb-2">
 <button
 onClick={handleGoogleLoginSubmit}
 type="button"
 className="w-full flex items-center justify-center gap-2.5 px-5 py-3 bg-white text-black hover:bg-zinc-200 font-bold font-sans text-xs uppercase tracking-wide rounded-xl transition-all shadow-md cursor-pointer"
 >
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill="none"
 xmlns="http://www.w3.org/2000/svg"
 >
 <path
 d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
 fill="#4285F4"
 />
 <path
 d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
 fill="#34A853"
 />
 <path
 d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
 fill="#FBBC05"
 />
 <path
 d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
 fill="#EA4335"
 />
 </svg>
 Đồng bộ bằng Google
 </button>
 </div>
 )}
 </>
 )}

 <div className="mt-4 border-t border-white/5 pt-3">
 <button
 type="button"
 onClick={() => {
 setIsLoginOpen(false);
 setLoginError("");
 setEmailInput("");
 setPasswordInput("");
 }}
 className="w-full text-center text-zinc-500 hover:text-zinc-300 font-sans text-[11px] uppercase tracking-wide transition-colors py-1 cursor-pointer"
 >
 HỦY BỎ & QUAY LẠI PUBLIC
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>

 <AnalyticsDashboardModal
 isOpen={isAnalyticsOpen}
 onClose={() => setIsAnalyticsOpen(false)}
 />

 <LiveVisitorsFloatingWidget
 onOpenAnalytics={() => setIsAnalyticsOpen(true)}
 />

 <AdminPushNotificationBanner />
 <AdminNotificationCenterModal />

 <PhotoProgressLookupModal
 isOpen={isPhotoProgressOpen}
 onClose={() => {
   setIsPhotoProgressOpen(false);
   setLookupBookingId("");
 }}
 initialBookingId={lookupBookingId}
 myBookingIds={myBookingIds}
 />

 <AdminIntroEditorModal
 isOpen={isIntroEditorOpen}
 onClose={() => setIsIntroEditorOpen(false)}
 config={introConfig}
 onSave={saveIntroConfig}
 onPreview={() => {
   setIsIntroComplete(false);
 }}
 showToast={(msg) => alert(msg)}
 />
 </div>
 );
}
