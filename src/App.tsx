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
 MessageSquare,
 BarChart3,
 Eye,
 Bell,
 Search,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Helmet } from "react-helmet-async";
import Lenis from "lenis";
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

import localforage from"localforage";

// Data & Types
import contentData from"./data/contentData";
import { SlideData } from"./types";
import { db, auth, handleFirestoreError, OperationType, isFirestoreQuotaExceeded } from"./firebase";
import { doc, onSnapshot, setDoc } from"firebase/firestore";

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

 // Unified luxury smooth scrolling across all browsers via Lenis
 useEffect(() => {
 const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if (prefersReducedMotion) return;

 const lenis = new Lenis({
 duration: 1.15,
 easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
 smoothWheel: true,
 wheelMultiplier: 0.95,
 touchMultiplier: 1.1,
 });

 lenis.on("scroll", ScrollTrigger.update);
 const updateTicker = (time: number) => {
 lenis.raf(time * 1000);
 };
 gsap.ticker.add(updateTicker);
 gsap.ticker.lagSmoothing(0);

 const checkModalState = () => {
 const isBlocked =
 document.body.classList.contains("lightbox-active") ||
 document.body.style.overflow === "hidden";
 if (isBlocked) {
 lenis.stop();
 } else {
 lenis.start();
 }
 };

 const observer = new MutationObserver(checkModalState);
 observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });

 return () => {
 observer.disconnect();
 gsap.ticker.remove(updateTicker);
 lenis.destroy();
 };
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
 onNavigateSlide={scrollToSlide}
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
 onNavigateSlide={scrollToSlide}
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
 onNavigateSlide={scrollToSlide}
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
      className="relative bg-transparent text-white font-manrope selection:bg-optic-yellow selection:text-black min-h-screen w-full max-w-full overflow-x-hidden flex flex-col items-center"
 >
 <Helmet>
 <title>{activeSeo?.title ||"BERGH RYKER — Portfolio Kỷ Yếu & Nhiếp Ảnh Sự Kiện"}</title>
 <meta name="description"content={activeSeo?.description ||"Portfolio kỷ yếu và nhiếp ảnh sự kiện chất lượng cao của BERGH.RYKER. Lưu giữ mọi khoảnh khắc thanh xuân rực rỡ và chuyên nghiệp."} />
 {activeSeo?.keywords && <meta name="keywords"content={activeSeo.keywords} />}
 <meta property="og:title" content={activeSeo?.title || "BERGH RYKER — Portfolio Kỷ Yếu & Nhiếp Ảnh Sự Kiện"} />
 <meta property="og:description" content={activeSeo?.description || "Portfolio kỷ yếu và nhiếp ảnh sự kiện chất lượng cao của BERGH.RYKER."} />
 <meta property="og:image" content="https://bergh-ryker.ai.studio/og-image-square.png?v=2" />
 <meta property="og:type" content="website" />
 <meta name="twitter:card" content="summary_large_image" />
 <meta name="twitter:image" content="https://bergh-ryker.ai.studio/og-image-square.png?v=2" />
 </Helmet>

 {/* GLOBAL FIXED BACKGROUND VIDEO WITH ADAPTIVE STREAMING & COMPRESSED MOBILE FALLBACK */}
 <GlobalBackgroundVideo
 isHeroLayout={slides[activeSlide]?.layout ==="Hero Layout" || slides[activeSlide]?.layout ==="Hero"}
 />

  {/* 1. LUXURY MINIMALIST HEADER FOR YEARBOOK & EVENT PORTFOLIO */}
  <header className="sticky top-0 left-0 w-full z-50 pt-[max(env(safe-area-inset-top),0px)] transition-all duration-500 liquid-glass-header">
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 md:px-8 h-14 sm:h-16 flex flex-row justify-between items-center gap-2 sm:gap-4 flex-nowrap">
      {/* Luxury Brand Logo */}
      <div
        onClick={() => {
          scrollToSlide(slides[0]?.id || "S1");
        }}
        className="flex flex-col cursor-pointer group select-none shrink-0"
      >
        <span className="font-sans font-extrabold text-sm min-[360px]:text-base sm:text-lg md:text-xl tracking-[0.24em] text-white uppercase group-hover:text-[#F3E0B5] transition-colors whitespace-nowrap ">
          BERGH RYKER
        </span>
        <span className="text-[8.5px] sm:text-[9.5px] tracking-[0.26em] text-[#E8D2A6] font-semibold uppercase font-sans mt-0.5 whitespace-nowrap ">
          KỶ YẾU & SỰ KIỆN
        </span>
      </div>

      {/* Desktop Nav menu links */}
      <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs lg:text-sm font-sans font-medium tracking-wide">
        <button
          onClick={() => scrollToSlide("S8")}
          className="text-zinc-200 hover:text-[#F3E0B5] transition-colors cursor-pointer py-1 whitespace-nowrap  tracking-wider"
        >
          Bộ sưu tập
        </button>

        <button
          onClick={() => scrollToSlide("S4")}
          className="text-zinc-200 hover:text-[#F3E0B5] transition-colors cursor-pointer py-1 whitespace-nowrap  tracking-wider"
        >
          Kỷ yếu học đường
        </button>

        <button
          onClick={() => scrollToSlide("S7")}
          className="text-zinc-200 hover:text-[#F3E0B5] transition-colors cursor-pointer py-1 whitespace-nowrap  tracking-wider"
        >
          Giới thiệu
        </button>

        <button
          onClick={() => setIsPhotoProgressOpen(true)}
          className="text-zinc-100 hover:text-white bg-white/[0.08] hover:bg-white/[0.15] border border-white/20 hover:border-white/35 transition-all cursor-pointer py-1.5 px-3.5 rounded-full flex items-center gap-1.5 font-medium whitespace-nowrap shadow-sm backdrop-blur-md group active:scale-95"
          title="Tra cứu tiến độ chỉnh ảnh & tải file hoàn thiện"
        >
          <Search className="w-3.5 h-3.5 text-[#E8D2A6] group-hover:scale-110 transition-transform" />
          <span>Tra cứu ảnh</span>
        </button>

        <button
          onClick={() => scrollToSlide("S9")}
          className="transition-all cursor-pointer bg-gradient-to-r from-[#DFB779] via-[#F4E1B5] to-[#DFB779] hover:from-[#F0D59D] hover:to-[#CFA25E] text-zinc-950 font-bold text-xs px-5 py-2 rounded-full font-sans tracking-wider uppercase whitespace-nowrap shadow-[0_4px_16px_rgba(212,175,55,0.28),inset_0_1px_1.5px_rgba(255,255,255,0.85)] hover:scale-[1.03] active:scale-95"
        >
          Đặt lịch chụp
        </button>
      </nav>

      {/* Mobile Nav Actions (balanced, single-line, zero text wrapping) */}
      <div className="flex md:hidden items-center gap-2 shrink-0 flex-nowrap">
        <button
          onClick={() => setIsPhotoProgressOpen(true)}
          className="text-zinc-100 hover:text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 hover:border-white/35 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm backdrop-blur-md shrink-0 group"
          title="Tra cứu tiến độ ảnh khách hàng"
        >
          <Search className="w-3.5 h-3.5 text-[#E8D2A6] group-hover:scale-110 transition-transform shrink-0" />
          <span className="whitespace-nowrap font-medium text-zinc-100">Tra cứu</span>
        </button>

        <button
          onClick={() => {
            scrollToSlide("S9");
          }}
          className="bg-gradient-to-r from-[#DFB779] via-[#F4E1B5] to-[#DFB779] hover:from-[#F0D59D] hover:to-[#CFA25E] text-zinc-950 active:scale-95 font-bold text-xs px-3.5 sm:px-4 py-1.5 rounded-full whitespace-nowrap shadow-[0_4px_16px_rgba(212,175,55,0.28),inset_0_1px_1.5px_rgba(255,255,255,0.85)] cursor-pointer transition-all shrink-0 hover:scale-[1.03] tracking-wide uppercase"
        >
          Đặt lịch
        </button>
      </div>
    </div>
  </header>



 {/* 3. MAIN FULL SCREEN SLIDES CONTAINER */}
  <main className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 pt-2 sm:pt-4 md:pt-6 pb-6 md:pb-8 relative flex flex-col items-center">
 {slides.map((slide, index) => {
 const isHero = index === 0;
 return (
 <section
 key={`slide-view-${slide.id || index}-${index}`}
 id={slide.id}
 className={`slide-section scroll-mt-20 w-full relative flex flex-col items-center justify-center ${
 isHero
 ?"pt-2 sm:pt-6 pb-4 sm:pb-8"
      : "min-h-[70vh] sm:min-h-[80vh] lg:min-h-screen py-10 sm:py-16 lg:py-24"
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
 <section id="testimonials"className="w-full relative flex flex-col items-center justify-center py-10 md:py-14 scroll-mt-20">
 <SocialProof isAdminGlobal={verifiedAdminEditMode} />
 </section>

 </main>

 {/* 4. FOOTER WITH INTEGRATED GLOBAL ADMINISTRATIVE SWITCH */}
 <footer className="w-full liquid-glass-header border-t border-white/10 pt-8 pb-[calc(1.25rem+env(safe-area-inset-bottom,16px))] md:pt-10 md:pb-8 text-center font-sans text-[12px] text-zinc-400 leading-relaxed relative z-20">
 <div className="max-w-3xl mx-auto px-2 sm:px-6 space-y-4">
 {/* Admin Switcher & Console Button at very bottom as requested */}
 {isVerifiedAdminLoggedIn && (
 <div className="border-b border-white/5 pb-4 flex flex-col items-center justify-center gap-2">
                {/* Streamlined Minimalist Admin Dock - Pure Icons in 1 Unified Bar */}
                <div className="flex items-center justify-center w-full px-2">
                  <div className="inline-flex items-center liquid-glass-dock border border-[#B5945B]/30 px-2.5 sm:px-3 py-1.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.65)] relative z-10 gap-1.5 sm:gap-2 max-w-full box-border select-none">
                    
                    {/* 1. Mode Switcher (Chế độ Xem / Sửa bằng Icon) */}
                    <div className="flex items-center bg-black/50 p-0.5 rounded-full border border-white/10 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsEditMode(false)}
                        className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          !isEditMode
                            ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/20"
                            : "text-zinc-400 hover:text-white hover:bg-white/5"
                        }`}
                        title="Xem trước website như khách hàng"
                        aria-label="Xem trước"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isVerifiedAdminLoggedIn) setIsEditMode(true);
                        }}
                        className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          isEditMode
                            ? "bg-gradient-to-r from-[#B5945B] via-[#D4AF37] to-[#B5945B] text-zinc-950 font-bold shadow-md shadow-[#B5945B]/30 ring-1 ring-[#D4AF37]/50"
                            : "text-zinc-400 hover:text-[#E5C17C] hover:bg-white/5"
                        }`}
                        title="Bật chế độ quản trị & chỉnh sửa"
                        aria-label="Quản trị"
                      >
                        <Settings className={`w-3.5 h-3.5 shrink-0 ${isEditMode ? "animate-[spin_4s_linear_infinite]" : ""}`} />
                      </button>
                    </div>

                    {/* Subtle Hairline Divider */}
                    <div className="w-[1px] h-3.5 bg-white/15 shrink-0" />

                    {/* 2. Thống kê Lượt xem (Icon + Số tinh gọn) */}
                    <button
                      type="button"
                      onClick={() => setIsAnalyticsOpen(true)}
                      className="flex items-center gap-1 px-1.5 py-1 rounded-full text-zinc-300 hover:text-[#D4AF37] hover:bg-white/5 transition-all cursor-pointer shrink-0"
                      title="Thống kê chi tiết lượt xem Portfolio"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-[#B5945B] shrink-0" />
                      <span className="text-[11px] sm:text-xs font-semibold font-mono tracking-tight text-zinc-200">
                        {formatViewCount(portfolioVisitorsCount)}
                      </span>
                    </button>

                    {/* Subtle Hairline Divider */}
                    <div className="w-[1px] h-3.5 bg-white/15 shrink-0" />

                    {/* 3. Khách trực tiếp (Live Visitors) */}
                    <button
                      type="button"
                      onClick={() => setIsWidgetOpen(true)}
                      className="flex items-center gap-1 px-1.5 py-1 rounded-full text-emerald-400 hover:text-emerald-300 hover:bg-white/5 transition-all cursor-pointer shrink-0"
                      title="Khách đang trực tuyến trên website"
                    >
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-[11px] sm:text-xs font-bold font-mono text-emerald-400">
                        {activeCount}
                      </span>
                    </button>

                    {/* Subtle Hairline Divider */}
                    <div className="w-[1px] h-3.5 bg-white/15 shrink-0" />

                    {/* 4. Cảnh Báo / Thông Báo (Bell Icon) */}
                    <button
                      type="button"
                      onClick={() => setIsNotificationCenterOpen(true)}
                      className="relative w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center cursor-pointer shrink-0"
                      title="Trung tâm thông báo Admin"
                      aria-label="Thông báo"
                    >
                      <Bell className={`w-3.5 h-3.5 ${unreadCount > 0 ? "text-amber-400 animate-bounce" : "text-zinc-400"}`} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white font-extrabold text-[9px] min-w-[15px] h-3.5 px-0.5 rounded-full flex items-center justify-center animate-pulse shadow-md border border-black/40 pointer-events-none z-20">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* 5. Admin Avatar */}
                    <div
                      className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-white/10 border border-[#B5945B]/40 flex items-center justify-center shrink-0 select-none overflow-hidden"
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

                    {/* 6. Logout Button (Icon LogOut) */}
                    <button
                      type="button"
                      onClick={async () => {
                        await handleAdminLogout();
                      }}
                      disabled={isLoggingOut}
                      className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-zinc-400 hover:text-red-400 transition-all flex items-center justify-center disabled:opacity-50 shrink-0 cursor-pointer"
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
            )}

 <div className="flex flex-col items-center gap-3 py-1 mt-2 text-center">
 <p className="tracking-wide text-xs text-zinc-300 font-sans select-none text-legible-shadow">
 © 2026{" "}
 <span
 role="button"
 tabIndex={-1}
 onClick={() => {
 setHasAdminAccess(true);
 setIsLoginOpen(true);
 }}
 className="font-bold font-sans text-white hover:text-[#E5C17C] cursor-default transition-colors"
 >
 BERGH RYKER
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
 </div>
 );
}
