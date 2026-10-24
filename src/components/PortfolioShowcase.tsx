import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Focus,
  Heart,
  Compass,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Edit3,
  Save,
  ExternalLink,
  FolderOpen,
  Image as ImageIcon,
  RefreshCw,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  GripVertical,
  Crop,
  Settings,
  Search,
  Eye,
  EyeOff,
  Columns,
  Grid,
  Maximize2,
  Minimize2,
  Square,
  Calendar,
  Filter,
  Layers,
  Tag,
  SlidersHorizontal,
  LayoutGrid,
  Camera,
  FolderKanban,
  PenTool,
  Sliders,
  HardDrive,
  Upload,
  Download,
  ShieldCheck,
  Copy,
  Star,
  List,
  Loader2,
} from "lucide-react";
import { PortfolioSkeleton } from "./PortfolioSkeleton";
import { GooglePickerButton } from "./GooglePickerButton";
const GoogleDrivePicker = React.lazy(() =>
  import("./GoogleDrivePicker").then((m) => ({ default: m.GoogleDrivePicker }))
);
import { motion, AnimatePresence } from "motion/react";
import {
  exportMasterBackupJSON,
  importMasterBackupJSON,
  generateContentDataCode,
} from "../services/backupService";
import { SlideData, ImageResolutions } from "../types";
import { resolveImage, buildLightboxSources } from "../utils/imageMapper";
import { getOptimizedImageUrl, markImageLoadedInCache } from "../utils/imageOptimizer";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { validateUrl } from "../utils/validateUrl";
import {
  usePortfolioData,
  AllowedCollection,
  extractYearFromText,
  inferEventTypeFromText,
} from "../hooks/usePortfolioData";
import { useToast } from "../hooks/useToast";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { ToastContainer } from "./ToastContainer";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  compressImage,
  convertToWebP,
  ensureWebPUrl,
  batchConvertToWebP,
  isWebP,
} from "../utils/imageCompressor";
import { ImageWithFallback } from "./ImageWithFallback";
import { LazyImage } from "./LazyImage";
import { Album3DScrollytellingViewer } from "./Album3DScrollytellingViewer";
import { Horizontal3DCollectionTrack } from "./Horizontal3DCollectionTrack";
import { ImagePositionControl } from "./ImagePositionControl";
import {
  recordPortfolioVisitor,
  recordCollectionView,
  recordAlbumView,
  recordPhotoView,
  sanitizeAnalyticsId,
} from "../services/analyticsService";
import { SectionViewBadge } from "./SectionViewBadge";
import { useSectionAnalytics } from "../hooks/useSectionAnalytics";
import { useLivePresenceContext } from "../context/LivePresenceContext";

const preloadedUrls = new Set<string>();
export const preloadHighResImage = (rawSrc?: string) => {
  if (!rawSrc || typeof window === "undefined") return;
  // If user is on a slow 2G network or has Data Saver turned on, skip preloading
  if ("connection" in navigator) {
    const conn = (navigator as any).connection;
    if (
      conn?.saveData ||
      conn?.effectiveType === "slow-2g" ||
      conn?.effectiveType === "2g"
    ) {
      return;
    }
  }

  const resolved = resolveImage(rawSrc);
  if (!resolved || preloadedUrls.has(resolved)) return;
  preloadedUrls.add(resolved);

  // Preload high-res image directly into browser cache with async decoding and mark in global cache
  const isMobile = window.innerWidth <= 640;
  const targetW = isMobile ? 1200 : 1920;
  const optimizedUrl = getOptimizedImageUrl(resolved, {
    width: targetW,
    format: "webp",
    quality: 90,
  });

  const finalUrl = optimizedUrl || resolved;
  const img = new window.Image();
  img.decoding = "async";
  img.src = finalUrl;
  if (img.complete && img.naturalWidth > 0) {
    markImageLoadedInCache(resolved);
    markImageLoadedInCache(finalUrl);
  } else {
    img.onload = () => {
      markImageLoadedInCache(resolved);
      markImageLoadedInCache(finalUrl);
      if (img.decode) img.decode().catch(() => {});
    };
  }
};

interface CustomPhoto {
  id?: string;
  src: string;
  alt: string;
  title: string;
  focal: string;
  iso: string;
  desc: string;
  galleryImages?: string[];
  order?: number;
  objectPosition?: string;
  imagePosition?: string;
  aspectRatio?: string;
  imageScale?: number;
}

interface CustomCollection {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  driveLink: string;
  images: CustomPhoto[];
  coverImageSrc?: string;
  coverImageResolutions?: ImageResolutions;
  coverImagePosition?: string;
  order?: number;
  isHidden?: boolean;
  year?: string;
  eventType?: string;
}

// Quy tắc 1: Khởi tạo mảng rỗng [] không chứa bất kỳ ảnh mẫu Unsplash nào
const DEFAULT_COLLECTIONS: CustomCollection[] = [];
const DEFAULT_PROM_COLLECTIONS: CustomCollection[] = [];
const DEFAULT_FREEDOM_COLLECTIONS: CustomCollection[] = [];

interface PortfolioShowcaseProps {
  slide: SlideData;
  isAdminGlobal?: boolean;
  firestoreCollection?: string;
  onNavigateSlide?: (slideId: string) => void;
}

export const PortfolioShowcase: React.FC<PortfolioShowcaseProps> = ({
  slide,
  isAdminGlobal,
  firestoreCollection = "albums",
  onNavigateSlide,
}) => {
  // Khởi tạo danh sách album rỗng [] theo Quy tắc 1, cấm fallback về ảnh mẫu Unsplash
  const defaultSeeds: CustomCollection[] = [];

  // --- STATE DEFINITIONS ---
  const {
    collectionsData: collections,
    loading,
    isLoadingData,
    addAlbum,
    updateAlbumMeta,
    addPhotos,
    updatePhoto,
    deletePhoto,
    reorderPhoto,
    reorderAlbum,
    reorderAlbumsBatch,
    softDeleteAlbum,
  } = usePortfolioData(
    firestoreCollection as AllowedCollection,
    defaultSeeds,
    isAdminGlobal,
  );
  const { activeCount, updateLocation, setIsWidgetOpen } = useLivePresenceContext();
  const { toasts, showToast } = useToast();
  const [confirmDialogState, setConfirmDialogState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Master Backup Vault & Anti-Data-Loss States
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [importBackupProgress, setImportBackupProgress] = useState<{ message: string; percent: number } | null>(null);
  const [freezeCodeModal, setFreezeCodeModal] = useState<{ isOpen: boolean; code: string; isCopied: boolean }>({
    isOpen: false,
    code: "",
    isCopied: false,
  });
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    try {
      const res = await exportMasterBackupJSON();
      showToast(
        `Đã xuất bản sao lưu "${res.filename}" thành công! (${res.summary.totalAlbums} album, ${res.summary.totalPhotos} ảnh, ${res.summary.totalBookings} bookings)`,
        "success"
      );
    } catch (err: any) {
      console.error(err);
      showToast("Lỗi khi tải bản sao lưu: " + (err.message || "Không xác định"), "error");
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("⚠️ Khôi phục dữ liệu sẽ cập nhật và đồng bộ toàn bộ Album, Ảnh, Cấu hình và Lịch trình vào Cloud Firestore từ file đã chọn. Bạn có chắc chắn muốn tiến hành?")) {
      e.target.value = "";
      return;
    }

    setIsImportingBackup(true);
    setImportBackupProgress({ message: "Đang đọc file...", percent: 10 });

    try {
      const text = await file.text();
      const result = await importMasterBackupJSON(text, (msg, pct) => {
        setImportBackupProgress({ message: msg, percent: pct });
      });
      showToast(
        `Khôi phục thành công: ${result.restoredAlbums} album, ${result.restoredPhotos} ảnh, ${result.restoredBookings} bookings, ${result.restoredSlides} slides! Đang làm mới...`,
        "success"
      );
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      showToast("Lỗi khi khôi phục dữ liệu: " + (err.message || "File không đúng định dạng"), "error");
      setIsImportingBackup(false);
      setImportBackupProgress(null);
    } finally {
      e.target.value = "";
    }
  };

  const handleFreezeToCode = async () => {
    try {
      showToast("Đang tạo mã nguồn Freeze to Code...", "info");
      const code = await generateContentDataCode(slide?.slides);
      try {
        await navigator.clipboard.writeText(code);
        setFreezeCodeModal({ isOpen: true, code, isCopied: true });
        showToast("Đã sao chép mã nguồn vào clipboard! Bạn có thể dán thẳng vào src/data/contentData.ts", "success");
      } catch (_) {
        setFreezeCodeModal({ isOpen: true, code, isCopied: false });
      }
    } catch (err: any) {
      showToast("Lỗi khi tạo mã nguồn: " + (err.message || "Không xác định"), "error");
    }
  };

  const [activeCollectionIdx, setActiveCollectionIdx] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedWorkIdx, setSelectedWorkIdx] = useState(0);
  const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({});

  // Admin and authorization states
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Synchronize with global admin state
  useEffect(() => {
    if (isAdminGlobal !== undefined) {
      setIsAdminMode(isAdminGlobal);
    }
  }, [isAdminGlobal]);

  // Global triggers to directly invoke Freeze to Code or jump to Master Backup Vault from anywhere
  useEffect(() => {
    if (firestoreCollection !== "albums") return;
    const handleTriggerFreeze = () => {
      handleFreezeToCode();
    };
    const handleOpenVault = () => {
      setIsAdminMode(true);
      setAdminActiveTab("settings");
      setTimeout(() => {
        const el = document.getElementById("admin-control-hub");
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        } else {
          document.getElementById("S4")?.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    };

    window.addEventListener("triggerFreezeToCode", handleTriggerFreeze);
    window.addEventListener("openMasterBackupTab", handleOpenVault);
    return () => {
      window.removeEventListener("triggerFreezeToCode", handleTriggerFreeze);
      window.removeEventListener("openMasterBackupTab", handleOpenVault);
    };
  }, [firestoreCollection, slide?.slides]);

  // View mode and Search states for advanced grid/detail navigation and filters
  const [viewMode, setViewMode] = useState<"grid" | "detail">("grid");

  const categoryTitle = useMemo(() => {
    if (slide.id === "S6") return "Event & Prom Night";
    if (slide.id === "S4") return "Kỷ Yếu THPT & Pre Graduation";
    if (slide.id === "S8") return "Concept Theo Yêu cầu";
    return slide.title || "BỘ SƯU TẬP ALBUM";
  }, [slide.id, slide.title]);

  const categorySubtitle = useMemo(() => {
    if (slide.id === "S6") return "Bữa tiệc dạ hội thăng hoa, ánh sáng huyền ảo và những cảm xúc lắng đọng nhất tuổi thanh xuân.";
    if (slide.id === "S4") return "Lưu giữ khoảnh khắc thanh xuân rực rỡ, trang phục cử nhân & kỷ niệm học đường trọn vẹn.";
    if (slide.id === "S8") return "Sáng tạo không giới hạn theo cá tính riêng, màu sắc điện ảnh và phong cách nghệ thuật độc bản.";
    return "Khám phá câu chuyện hình ảnh đầy màu sắc và nghệ thuật.";
  }, [slide.id]);

  const [quickSearchAlbumQuery, setQuickSearchAlbumQuery] = useState("");
  const [quickSearchPhotoQuery, setQuickSearchPhotoQuery] = useState("");

  const handleOpenAlbum = (albumId?: string, fallbackIdx?: number) => {
    if (albumId) {
      const targetIdx = collections.findIndex((c) => c.id === albumId);
      if (targetIdx !== -1) {
        setActiveCollectionIdx(targetIdx);
        setSelectedIndex(0);
        setVisiblePhotoCount(12);
        setIsAutoplay(false);
        showcaseRef.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    if (typeof fallbackIdx === "number" && fallbackIdx >= 0) {
      setActiveCollectionIdx(fallbackIdx);
      setSelectedIndex(0);
      setVisiblePhotoCount(12);
      setIsAutoplay(false);
      showcaseRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Slide autoplay features
  const [isAutoplay, setIsAutoplay] = useState(true);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [galleryDisplayMode, setGalleryDisplayMode] = useState<"single">("single");
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const activeThumbnailRef = useRef<HTMLDivElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const activeAlbumTabRef = useRef<HTMLDivElement>(null);
  const [activePhotoAspect, setActivePhotoAspect] = useState<string | null>(null);
  const [activePhotoDimensions, setActivePhotoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [lightboxFitMode, setLightboxFitMode] = useState<"contain" | "cover">("contain");
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [showUIOverlay, setShowUIOverlay] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const isZoomed = zoomScale > 1;
  const [zoomTranslate, setZoomTranslate] = useState({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);
  const lastTapTimeRef = useRef<number>(0);

  // Sync browser native fullscreen status
  useEffect(() => {
    const handleFsChange = () => {
      setIsBrowserFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Reset zoom, translate, aspect and slideshow when lightbox closes or selected photo changes
  useEffect(() => {
    setZoomScale((prev) => (prev !== 1 ? 1 : prev));
    setZoomTranslate((prev) => (prev.x !== 0 || prev.y !== 0 ? { x: 0, y: 0 } : prev));
    setActivePhotoAspect(null);
    setActivePhotoDimensions(null);
    if (!isLightboxOpen) {
      setIsSlideshowActive(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isLightboxOpen, selectedIndex]);

  // Keyboard navigation was moved below activeCollection

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Admin section sub-tab selection
  const [adminActiveTab, setAdminActiveTab] = useState<
    | "photo"
    | "manage-albums"
    | "edit-meta"
    | "edit-frames"
    | "settings"
    | "google-drive"
  >("manage-albums");

  // Drag and drop state for albums
  const [draggedAlbumIdx, setDraggedAlbumIdx] = useState<number | null>(null);
  const [draggedPhotoIdx, setDraggedPhotoIdx] = useState<number | null>(null);

  // Form inputs for creating a new album
  const [newColTitle, setNewColTitle] = useState("");
  const [newColSubtitle, setNewColSubtitle] = useState("");
  const [newColYear, setNewColYear] = useState("2026");
  const [newColEventType, setNewColEventType] = useState("");
  const [newColBody, setNewColBody] = useState("");
  const [newColDrive, setNewColDrive] = useState("");
  const [newColCoverSrc, setNewColCoverSrc] = useState("");

  // Form inputs for adding a single photo
  const [newPhotoSrcs, setNewPhotoSrcs] = useState<string[]>([]);
  const [newPhotoTitle, setNewPhotoTitle] = useState("");
  const [newPhotoFocal, setNewPhotoFocal] = useState("50mm F/1.8");
  const [newPhotoIso, setNewPhotoIso] = useState("100");
  const [newPhotoDesc, setNewPhotoDesc] = useState("");
  const [newPhotoUrlInput, setNewPhotoUrlInput] = useState("");
  const [quickLinkStr, setQuickLinkStr] = useState("");

  // Selected photo deletion confirmation index for safe local confirmation
  const [photoToDeleteConfirmIdx, setPhotoToDeleteConfirmIdx] = useState<
    number | null
  >(null);
  const [albumToDeleteConfirmId, setAlbumToDeleteConfirmId] = useState<
    string | null
  >(null);

  // Form inputs for editing a photo
  const [photoToEditIdx, setPhotoToEditIdx] = useState<number | null>(null);
  const [editPhotoTitle, setEditPhotoTitle] = useState("");
  const [editPhotoDesc, setEditPhotoDesc] = useState("");
  const [editPhotoObjectPosition, setEditPhotoObjectPosition] =
    useState("center");
  const [editPhotoAspectRatio, setEditPhotoAspectRatio] = useState("16/9");
  const [editPhotoScale, setEditPhotoScale] = useState<number>(1.0);
  const [editPhotoGalleryImages, setEditPhotoGalleryImages] = useState<
    string[]
  >([]);
  const [newGalleryUrlInput, setNewGalleryUrlInput] = useState("");

  // Master-Detail Studio Workspace states
  const [framesViewMode, setFramesViewMode] = useState<"list" | "grid">("list");
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [quickAddUrlsInput, setQuickAddUrlsInput] = useState("");
  const [isUploadingQuickFiles, setIsUploadingQuickFiles] = useState(false);
  const [isSavingPhotoFrame, setIsSavingPhotoFrame] = useState(false);
  const [lastSavedPhotoId, setLastSavedPhotoId] = useState<string | null>(null);
  const [isApplyingRatioAll, setIsApplyingRatioAll] = useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);

  // Form inputs for editing active album info
  const [editColTitle, setEditColTitle] = useState("");
  const [editColSubtitle, setEditColSubtitle] = useState("");
  const [editColYear, setEditColYear] = useState("");
  const [editColEventType, setEditColEventType] = useState("");
  const [editColBody, setEditColBody] = useState("");
  const [editColDrive, setEditColDrive] = useState("");
  const [editColCoverPosition, setEditColCoverPosition] = useState("center");
  const [editColCoverSrc, setEditColCoverSrc] = useState("");

  // AI Generation States
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  // Automated WebP Image Processing Engine States
  const [isOptimizingWebP, setIsOptimizingWebP] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState({ current: 0, total: 0 });

  const handleBatchOptimizeWebP = async () => {
    if (isOptimizingWebP) return;
    try {
      setIsOptimizingWebP(true);

      let totalImages = 0;
      collections.forEach((col) => {
        if (col.coverImageSrc) totalImages++;
        if (col.images) {
          col.images.forEach((img) => {
            totalImages++;
            if (img.galleryImages) totalImages += img.galleryImages.length;
          });
        }
      });

      setOptimizeProgress({ current: 0, total: Math.max(totalImages, 1) });
      let currentProgress = 0;

      for (const col of collections) {
        // Optimize cover image
        if (col.coverImageSrc && !isWebP(col.coverImageSrc)) {
          try {
            const webpCover = await convertToWebP(col.coverImageSrc, { maxWidth: 1920, maxHeight: 1920, quality: 0.88 });
            await updateAlbumMeta(col.id, { coverImageSrc: webpCover });
          } catch (e) {
            console.warn("Cover WebP optimization skipped:", e);
          }
        }
        currentProgress++;
        setOptimizeProgress({ current: currentProgress, total: totalImages });

        // Optimize album photos
        if (col.images && col.images.length > 0) {
          for (const img of col.images) {
            let changed = false;
            let updatedSrc = img.src;
            if (img.src && !isWebP(img.src)) {
              try {
                updatedSrc = await convertToWebP(img.src, { maxWidth: 1920, maxHeight: 1920, quality: 0.88 });
                changed = true;
              } catch (e) {
                console.warn("Photo WebP conversion error:", e);
              }
            }

            let updatedGallery = img.galleryImages;
            if (Array.isArray(img.galleryImages) && img.galleryImages.length > 0) {
              const newGallery: string[] = [];
              for (const gSrc of img.galleryImages) {
                if (gSrc && !isWebP(gSrc)) {
                  try {
                    const gWebp = await convertToWebP(gSrc, { maxWidth: 1920, maxHeight: 1920, quality: 0.88 });
                    newGallery.push(gWebp);
                    changed = true;
                  } catch {
                    newGallery.push(gSrc);
                  }
                } else {
                  newGallery.push(gSrc);
                }
              }
              updatedGallery = newGallery;
            }

            if (changed && img.id) {
              try {
                await updatePhoto(col.id, img.id, {
                  src: updatedSrc,
                });
              } catch (err) {
                console.warn("Failed updating photo in firestore:", err);
              }
            }

            currentProgress++;
            setOptimizeProgress({ current: currentProgress, total: totalImages });
          }
        }
      }

      showToast(`Đã tối ưu chuyển đổi thành công toàn bộ ảnh sang chuẩn WebP siêu tốc!`, "success");
    } catch (err: any) {
      console.error("WebP Optimization error:", err);
      showToast("Lỗi khi tối ưu ảnh WebP: " + (err.message || "Không xác định"), "error");
    } finally {
      setIsOptimizingWebP(false);
    }
  };

  // Sync index correction whenever active collection updates
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeCollectionIdx]);

  // Handle Autoplay Slideshow logic
  const currentCollectionImagesLength = collections[activeCollectionIdx]?.images?.length || 0;
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (
      isAutoplay &&
      !isLightboxOpen &&
      currentCollectionImagesLength > 0
    ) {
      intervalId = setInterval(() => {
        setSelectedIndex(
          (prevIdx) => (prevIdx + 1) % currentCollectionImagesLength,
        );
      }, 4000); // Transitions every 4.0 seconds
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoplay, isLightboxOpen, activeCollectionIdx, currentCollectionImagesLength]);

  const activeCollection =
    collections[activeCollectionIdx] || collections[0] || null;

  const validCollections = useMemo(
    () => collections.filter((c) => isAdminMode || !c.isHidden),
    [collections, isAdminMode]
  );
  const currentColPos = activeCollection
    ? validCollections.findIndex((c) => c.id === activeCollection.id)
    : -1;
  const prevCol = currentColPos > 0 ? validCollections[currentColPos - 1] : null;
  const nextCol =
    currentColPos >= 0 && currentColPos < validCollections.length - 1
      ? validCollections[currentColPos + 1]
      : null;
  const prevColIdx = prevCol
    ? collections.findIndex((c) => c.id === prevCol.id)
    : -1;
  const nextColIdx = nextCol
    ? collections.findIndex((c) => c.id === nextCol.id)
    : -1;

  const { getItemViews, formatViewCount } = useSectionAnalytics();

  // Helper to get album views
  const getAlbumViews = (albumIdOrTitle: string) => {
    const key = `album_${sanitizeAnalyticsId(albumIdOrTitle)}`;
    return getItemViews(key) || 0;
  };

  // Helper to get individual photo views
  const getPhotoViews = (photo: { id?: string; src: string; title?: string }) => {
    const photoKey = `photo_${sanitizeAnalyticsId(photo.id || photo.src)}`;
    return getItemViews(photoKey) || 0;
  };

  // 1. Track collection & album view when active collection/album changes
  const lastTrackedAlbumRef = useRef<string>("");
  useEffect(() => {
    if (activeCollection && activeCollection.id && activeCollection.id !== lastTrackedAlbumRef.current) {
      lastTrackedAlbumRef.current = activeCollection.id;
      const collectionName =
        firestoreCollection === "albums"
          ? "Kỷ Yếu Học Đường (Lớp / THPT)"
          : firestoreCollection === "prom_albums"
          ? "Prom Night & Dạ Hội"
          : "Concept Nghệ Thuật & Tự Do";

      recordCollectionView(firestoreCollection, collectionName);

      recordAlbumView(
        activeCollection.id,
        activeCollection.title || activeCollection.id,
        firestoreCollection
      );

      updateLocation(
        collectionName,
        `Đang xem: ${activeCollection.title}`
      );
    }
  }, [activeCollection?.id, activeCollection?.title, firestoreCollection, updateLocation]);

  // 2. Record photo view when lightbox is open and navigating photos
  const lastTrackedPhotoRef = useRef<string>("");
  useEffect(() => {
    if (isLightboxOpen && activeWorkSubPhotos[selectedIndex]) {
      const curPhoto = activeWorkSubPhotos[selectedIndex];
      const photoKey = `${curPhoto.id || curPhoto.src}_${selectedIndex}`;
      if (photoKey !== lastTrackedPhotoRef.current) {
        lastTrackedPhotoRef.current = photoKey;

        recordPhotoView(
          curPhoto.id || curPhoto.src,
          curPhoto.title || activeCollection?.title || "Tác phẩm",
          activeCollection?.id || "album"
        );

        updateLocation(
          "Chi Tiết Ảnh Kỷ Yếu",
          `Đang xem ảnh: ${curPhoto.title || activeCollection?.title || "Tác phẩm"}`
        );
      }
    }
  }, [isLightboxOpen, selectedIndex, selectedWorkIdx, activeCollection?.id, activeCollection?.title, updateLocation]);

  const allAlbumPhotos = useMemo(() => {
    if (!activeCollection) return [];
    return activeCollection.images.map((img) => ({
      src: img.src,
      alt: img.alt || img.title || "",
      title: img.title || "",
      desc: img.desc || "",
      focal: img.focal || "",
      iso: img.iso || "",
      id: img.id,
      originalPhoto: img,
    }));
  }, [activeCollection]);

  // Progressive image batching for weak networks and smooth viewport rendering
  const INITIAL_BATCH_SIZE = 12;
  const [visiblePhotoCount, setVisiblePhotoCount] = useState(INITIAL_BATCH_SIZE);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible photo count when switching albums or view mode
  useEffect(() => {
    setVisiblePhotoCount(INITIAL_BATCH_SIZE);
  }, [activeCollectionIdx, viewMode]);

  // Infinite scroll intersection observer to load next batch as user scrolls
  useEffect(() => {
    if (visiblePhotoCount >= allAlbumPhotos.length) return;
    if (typeof IntersectionObserver === "undefined") return;

    const sentinelEl = loadMoreSentinelRef.current;
    if (!sentinelEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisiblePhotoCount((prev) => Math.min(prev + 12, allAlbumPhotos.length));
        }
      },
      { rootMargin: "350px 0px" }
    );

    observer.observe(sentinelEl);
    return () => observer.disconnect();
  }, [visiblePhotoCount, allAlbumPhotos.length]);

  const displayedPhotos = useMemo(() => {
    return allAlbumPhotos.slice(0, visiblePhotoCount);
  }, [allAlbumPhotos, visiblePhotoCount]);

  const selectedWork =
    activeCollection && activeCollection.images[selectedWorkIdx]
      ? activeCollection.images[selectedWorkIdx]
      : null;

  // Complete list of all viewable photos in the active album for full traversal in lightbox
  const activeAlbumLightboxPhotos = useMemo(() => {
    if (!activeCollection || !activeCollection.images) return [];
    const list: Array<{
      src: string;
      alt: string;
      title: string;
      desc: string;
      focal?: string;
      iso?: string;
      id?: string;
      originalPhoto: CustomPhoto;
      photoIndex: number;
      isVariant?: boolean;
    }> = [];

    activeCollection.images.forEach((img, idx) => {
      const resolved = resolveImage(img.src) || img.src;
      list.push({
        src: resolved,
        alt: img.alt || img.title || `${activeCollection.title} - Ảnh ${idx + 1}`,
        title: img.title || `${activeCollection.title} • #${idx + 1}`,
        desc: img.desc || "",
        focal: img.focal || "",
        iso: img.iso || "",
        id: img.id,
        originalPhoto: img,
        photoIndex: idx,
        isVariant: false,
      });

      if (Array.isArray(img.galleryImages) && img.galleryImages.length > 0) {
        img.galleryImages.forEach((gSrc, gIdx) => {
          const resolvedG = resolveImage(gSrc) || gSrc;
          list.push({
            src: resolvedG,
            alt: `${img.title || "Tác phẩm"} (Góc ${gIdx + 2})`,
            title: img.title ? `${img.title} (Góc ${gIdx + 2})` : `Góc chụp ${gIdx + 2}`,
            desc: img.desc || "",
            focal: img.focal || "",
            iso: img.iso || "",
            id: `${img.id || idx}-gallery-${gIdx}`,
            originalPhoto: img,
            photoIndex: idx,
            isVariant: true,
          });
        });
      }
    });

    return list;
  }, [activeCollection]);

  // Full album traversal in Lightbox
  const activeWorkSubPhotos = activeAlbumLightboxPhotos;

  // Auto-scroll active thumbnail into view in bottom strip
  useEffect(() => {
    if (isLightboxOpen && activeThumbnailRef.current) {
      activeThumbnailRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [isLightboxOpen, selectedIndex]);

  // Auto-scroll active album tab into view
  useEffect(() => {
    if (viewMode === "detail" && activeAlbumTabRef.current) {
      activeAlbumTabRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [viewMode, activeCollectionIdx]);

  // Autoplay slideshow timer when active
  useEffect(() => {
    if (!isLightboxOpen || !isSlideshowActive || activeWorkSubPhotos.length <= 1) return;
    const interval = setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % activeWorkSubPhotos.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isLightboxOpen, isSlideshowActive, activeWorkSubPhotos.length]);

  const handleDragEnd = (event: any, info: any) => {
    if (isZoomed) return;
    const thresholdX = 40;
    const thresholdY = 70;
    const swipeX =
      Math.abs(info.offset.x) > thresholdX || Math.abs(info.velocity.x) > 400;
    const swipeY =
      Math.abs(info.offset.y) > thresholdY || Math.abs(info.velocity.y) > 700;

    // Y takes precedence if stronger or explicitly closing
    if (swipeY && Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      setIsLightboxOpen(false);
      return;
    }

    // Horizontal swipe
    if (swipeX) {
      if (info.offset.x < 0) {
        setSelectedIndex((prev) => (prev + 1) % activeWorkSubPhotos.length);
      } else {
        setSelectedIndex(
          (prev) =>
            (prev - 1 + activeWorkSubPhotos.length) %
            activeWorkSubPhotos.length,
        );
      }
    }
  };

  // Sync edit values whenever active collection index changes
  useEffect(() => {
    if (activeCollection) {
      setEditColTitle(activeCollection.title || "");
      setEditColSubtitle(activeCollection.subtitle || "");
      setEditColYear(
        activeCollection.year ||
          extractYearFromText(
            activeCollection.title,
            activeCollection.subtitle,
            activeCollection.body,
          ),
      );
      setEditColEventType(
        activeCollection.eventType ||
          inferEventTypeFromText(
            activeCollection.title,
            activeCollection.subtitle,
            firestoreCollection,
          ),
      );
      setEditColBody(activeCollection.body || "");
      setEditColDrive(activeCollection.driveLink || "");
      setEditColCoverPosition(
        activeCollection.coverImagePosition ||
          activeCollection.images?.[0]?.objectPosition ||
          "center",
      );
      setEditColCoverSrc(activeCollection.coverImageSrc || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCollectionIdx, activeCollection?.id]);

  // Toggle body class to hide standard layout headers when viewing lightbox/fullscreen
  useEffect(() => {
    if (isLightboxOpen) {
      document.body.classList.add("lightbox-active");
    } else {
      document.body.classList.remove("lightbox-active");
    }
    return () => {
      document.body.classList.remove("lightbox-active");
    };
  }, [isLightboxOpen]);

  // Handle keyboard navigation for main lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Lightbox overlay key controls
      if (
        isLightboxOpen &&
        activeCollection &&
        activeWorkSubPhotos.length > 0
      ) {
        if (e.key === "Escape") {
          setIsLightboxOpen(false);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          goToPrevPhoto();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          goToNextPhoto();
        } else if (e.key === " " || e.code === "Space") {
          e.preventDefault();
          setIsSlideshowActive((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, selectedIndex, activeWorkSubPhotos]);

  // Smart background preloader: preload adjacent album images for instantaneous mobile swiping
  useEffect(() => {
    if (
      isLightboxOpen &&
      activeWorkSubPhotos &&
      activeWorkSubPhotos.length > 0
    ) {
      const len = activeWorkSubPhotos.length;
      const nextIdx1 = (selectedIndex + 1) % len;
      const nextIdx2 = (selectedIndex + 2) % len;
      const prevIdx = (selectedIndex - 1 + len) % len;

      [nextIdx1, nextIdx2, prevIdx].forEach((idx) => {
        const targetSrc = resolveImage(activeWorkSubPhotos[idx]?.src) || "";
        if (!targetSrc) return;
        const { highResSrc, lightboxSrcSet } = buildLightboxSources(targetSrc);
        const finalPreloadUrl = highResSrc || targetSrc;
        const preloadImg = new window.Image();
        preloadImg.decoding = "async";
        if (lightboxSrcSet) {
          preloadImg.srcset = lightboxSrcSet;
          preloadImg.sizes = "100vw";
        }
        preloadImg.src = finalPreloadUrl;
        if (preloadImg.complete && preloadImg.naturalWidth > 0) {
          markImageLoadedInCache(targetSrc);
          markImageLoadedInCache(finalPreloadUrl);
        } else {
          preloadImg.onload = () => {
            markImageLoadedInCache(targetSrc);
            markImageLoadedInCache(finalPreloadUrl);
            preloadImg.decode?.().catch(() => {});
          };
        }
      });
    }
  }, [isLightboxOpen, selectedIndex, activeWorkSubPhotos]);

  const toggleFavorite = (e: React.MouseEvent, photoIdx: number) => {
    e.stopPropagation();
    const key = `${activeCollection?.id}-${photoIdx}`;
  };

  const currentFavoriteKey = activeCollection
    ? `${activeCollection.id}-${selectedIndex}`
    : "";
  const isSelectedFavorite = favorites[currentFavoriteKey] || false;

  // Directional navigation state for silky 60fps photo transitions
  const [slideDirection, setSlideDirection] = useState<number>(1);

  const goToNextPhoto = () => {
    if (!activeWorkSubPhotos || activeWorkSubPhotos.length === 0) return;
    setSlideDirection(1);
    setSelectedIndex((prev) => (prev + 1) % activeWorkSubPhotos.length);
  };

  const goToPrevPhoto = () => {
    if (!activeWorkSubPhotos || activeWorkSubPhotos.length === 0) return;
    setSlideDirection(-1);
    setSelectedIndex((prev) => (prev - 1 + activeWorkSubPhotos.length) % activeWorkSubPhotos.length);
  };

  // Navigation handlers
  const handlePrevImage = () => {
    goToPrevPhoto();
  };

  const handleNextImage = () => {
    goToNextPhoto();
  };

  // Preset quick insert helper for quick testing
  const handleQuickInsertPreset = (preset: { src: string; title: string; focal: string; iso: string; desc: string }) => {
    setNewPhotoSrcs([preset.src]);
    setNewPhotoTitle(preset.title);
    setNewPhotoFocal(preset.focal);
    setNewPhotoIso(preset.iso);
    setNewPhotoDesc(preset.desc);
  };

  // --- ADMIN ACTIONS ---
  const { login: adminLogThisIn } = useAdminAuth();

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    try {
      await adminLogThisIn();
      setIsAdminMode(true);
      setShowPasswordModal(false);
      setPasswordError("");
    } catch (err: any) {
      console.error(err);
      if (
        err.message === "Tài khoản này không có quyền truy cập quản trị!" ||
        err.message?.includes("claim")
      ) {
        setPasswordError(err.message);
      } else if (err.code === "auth/popup-closed-by-user") {
        setPasswordError("Đăng nhập đã bị huỷ.");
      } else {
        setPasswordError("Đã có lỗi xảy ra khi đăng nhập bằng Google.");
      }
    }
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColTitle.trim()) {
      showToast("Vui lòng nhập tên bộ sưu tập!", "error");
      return;
    }

    const coverUrl =
      newColCoverSrc.trim() ||
      "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&q=80&w=800";

    if (!validateUrl(coverUrl)) {
      showToast("Khung hình đại diện không hợp lệ", "error");
      return;
    }

    const defaultImage = {
      src: coverUrl,
      alt: "Khung hình đầu tiên",
      title: "Ảnh Chào Sân",
      focal: "50mm F/1.8",
      iso: "200",
      desc: "Thước phim đầu tiên đánh dấu buổi chụp rực rỡ nhiệt huyết tuổi trẻ.",
    };

    const newColId = `col-${Date.now()}`;
    const newCol = {
      id: newColId,
      title: newColTitle,
      subtitle: newColSubtitle || "Bộ Sưu Tập Mới",
      year: newColYear.trim() || extractYearFromText(newColTitle, newColSubtitle, newColBody),
      eventType: newColEventType.trim() || inferEventTypeFromText(newColTitle, newColSubtitle, firestoreCollection),
      body:
        newColBody ||
        "Câu chuyện hình ảnh mới được thực hiện bởi đội ngũ Bergh.Ryker.",
      driveLink: newColDrive || "https://drive.google.com",
    };

    addAlbum(newCol, defaultImage)
      .then(() => {
        setActiveCollectionIdx(collections.length);
        // Reset fields
        setNewColTitle("");
        setNewColSubtitle("");
        setNewColYear("2026");
        setNewColEventType("");
        setNewColBody("");
        setNewColDrive("");
        setNewColCoverSrc("");
        setAdminActiveTab("photo"); // Switch automatically to photo management
        showToast("Khởi tạo Album kỷ yếu nghệ thuật thành công!", "success");
      })
      .catch((error) => {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `${firestoreCollection}/${newCol.id}`,
        );
        showToast("Lỗi khi tạo album:" + error.message, "error");
      });
  };

  const handleDriveImportToActive = (urls: string[]) => {
    if (!activeCollection) return;

    if (urls.length === 0) return;

    const newPhotos = urls.map((url) => ({
      src: ensureWebPUrl(url),
      alt: "Imported from Drive",
      title: "",
      desc: "",
      focal: "",
      iso: "ISO 100",
      thumbnailColSpan: Math.random() > 0.6 ? 2 : 1,
      thumbnailRowSpan: Math.random() > 0.8 ? 2 : 1,
      galleryImages: [],
    }));

    addPhotos(activeCollection.id, newPhotos)
      .then(() => {
        showToast(
          `Đã nhập ${urls.length} ảnh trực tiếp từ Google Drive vào Album!`,
          "success",
        );
        setAdminActiveTab("photo");
      })
      .catch((error) => {
        console.error("Error adding drive photos:", error);
        showToast("Có lỗi xảy ra khi lưu lên database.", "error");
      });
  };

  const handleAddPhotoToActive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollection) return;
    if (newPhotoSrcs.length === 0 && !newPhotoUrlInput.trim()) {
      showToast("Vui lòng tải lên hoặc dán link ít nhất một ảnh!", "error");
      return;
    }

    const newPhotos: Omit<CustomPhoto, "id" | "order">[] = [];

    // Thêm ảnh từ URL trực tiếp
    if (newPhotoUrlInput.trim()) {
      const urls = newPhotoUrlInput
        .split(/[,;\s\n]+/)
        .map((u) => u.trim())
        .filter((u) => u.length > 0);

      urls.forEach((url, i) => {
        if (validateUrl(url)) {
          newPhotos.push({
            src: ensureWebPUrl(url),
            alt: newPhotoTitle
              ? `${newPhotoTitle} ${i + 1}`
              : "Direct External Photo",
            title: newPhotoTitle
              ? urls.length > 1
                ? `${newPhotoTitle} ${i + 1}`
                : newPhotoTitle
              : `Khung hình bằng Link ${activeCollection.images.length + i + 1}`,
            focal: newPhotoFocal || "85mm F/1.4",
            iso: newPhotoIso || "100",
            desc: newPhotoDesc || "Bức ảnh ở độ phân giải gốc siêu nét.",
          });
        }
      });
    }

    // Thêm ảnh tải lên (đã qua nén)
    newPhotoSrcs.forEach((src, index) => {
      newPhotos.push({
        src,
        alt: newPhotoTitle ? `${newPhotoTitle} ${index + 1}` : "Custom Photo",
        title: newPhotoTitle
          ? `${newPhotoTitle} ${index + 1}`
          : `Khung hình số ${activeCollection.images.length + newPhotos.length + index + 1}`,
        focal: newPhotoFocal || "85mm F/1.4",
        iso: newPhotoIso || "100",
        desc: newPhotoDesc || "Mô tả khoảnh khắc tuyệt đẹp buổi tác nghiệp.",
      });
    });

    if (newPhotos.length === 0) {
      showToast("Không có ảnh hợp lệ để thêm", "error");
      return;
    }

    addPhotos(activeCollection.id, newPhotos)
      .then(() => {
        setSelectedIndex(activeCollection.images.length); // View newly inserted frame
        // Reset inputs
        setNewPhotoSrcs([]);
        setNewPhotoUrlInput("");
        setNewPhotoTitle("");
        setNewPhotoFocal("50mm F/1.8");
        setNewPhotoIso("100");
        setNewPhotoDesc("");
        showToast(
          `Thêm ${newPhotos.length} ảnh vào Album thành công!`,
          "success",
        );
      })
      .catch((error) => {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `${firestoreCollection}/${activeCollection.id}`,
        );
        showToast("Lỗi khi thêm ảnh:" + error.message, "error");
      });
  };

  const handleReorderPhoto = async (
    photoIdx: number,
    direction: "up" | "down" | "drop",
    targetDropIdx?: number,
  ) => {
    if (!activeCollection) return;
    if (direction === "up" && photoIdx === 0) return;
    if (direction === "down" && photoIdx === activeCollection.images.length - 1)
      return;
    if (
      direction === "drop" &&
      (targetDropIdx === undefined || photoIdx === targetDropIdx)
    )
      return;

    const photo1 = activeCollection.images[photoIdx];
    const targetIdx =
      direction === "drop"
        ? targetDropIdx!
        : direction === "up"
          ? photoIdx - 1
          : photoIdx + 1;
    const photo2 = activeCollection.images[targetIdx];

    if (!photo1?.id || !photo2?.id) return;

    // Default order falls back to index if not set
    const order1 = photo1.order ?? photoIdx;
    const order2 = photo2.order ?? targetIdx;

    try {
      await reorderPhoto(
        activeCollection.id,
        { id: photo1.id, order: order1 },
        { id: photo2.id, order: order2 },
      );
      showToast("Đã thay đổi thứ tự ảnh", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Lỗi khi sắp xếp ảnh:" + err.message, "error");
    }
  };

  const handleReorderAlbum = async (
    albumIdx: number,
    direction: "up" | "down" | "drop",
    targetDropIdx?: number,
  ) => {
    if (direction === "up" && albumIdx === 0) return;
    if (direction === "down" && albumIdx === collections.length - 1) return;
    if (
      direction === "drop" &&
      (targetDropIdx === undefined || albumIdx === targetDropIdx)
    )
      return;

    try {
      if (direction === "drop") {
        const newCollections = [...collections];
        const [draggedItem] = newCollections.splice(albumIdx, 1);
        newCollections.splice(targetDropIdx!, 0, draggedItem);
        const updates = newCollections.map((col, i) => ({
          id: col.id,
          order: i,
        }));
        await reorderAlbumsBatch(updates);
      } else {
        const album1 = collections[albumIdx];
        const targetIdx = direction === "up" ? albumIdx - 1 : albumIdx + 1;
        const album2 = collections[targetIdx];
        if (!album1?.id || !album2?.id) return;
        const order1 = album1.order ?? albumIdx;
        const order2 = album2.order ?? targetIdx;
        await reorderAlbum(
          { id: album1.id, order: order1 },
          { id: album2.id, order: order2 },
        );
      }
      showToast("Đã sắp xếp lại album", "success");
    } catch (err: any) {
      console.error(err);
      showToast("Lỗi khi sắp xếp album: " + err.message, "error");
    }
  };

  const handleDeletePhoto = (
    photoIdxToDelete: number,
    bypassConfirm = false,
  ) => {
    if (!activeCollection) return;
    if (activeCollection.images.length <= 1) {
      showToast("Bộ sưu tập phải giữ lại ít nhất một hình ảnh gốc!", "error");
      return;
    }

    const photoTarget = activeCollection.images[photoIdxToDelete];
    if (!photoTarget?.id) return;

    if (!bypassConfirm) {
      setConfirmDialogState({
        isOpen: true,
        title: "Xoá ảnh",
        message: "Bạn có chắc chắn muốn xoá ảnh này khỏi bộ sưu tập?",
        onConfirm: () => {
          deletePhoto(activeCollection.id, photoTarget.id!)
            .then(() => {
              setSelectedIndex((prev) =>
                prev >= activeCollection.images.length - 1
                  ? Math.max(0, activeCollection.images.length - 2)
                  : prev,
              );
              showToast("Đã xoá ảnh", "success");
            })
            .catch((error) => {
              handleFirestoreError(
                error,
                OperationType.WRITE,
                `${firestoreCollection}/${activeCollection.id}`,
              );
              showToast("Lỗi khi xoá:" + error.message, "error");
            });
        },
      });
      return;
    }

    deletePhoto(activeCollection.id, photoTarget.id!)
      .then(() => {
        setSelectedIndex((prev) =>
          prev >= activeCollection.images.length - 1
            ? Math.max(0, activeCollection.images.length - 2)
            : prev,
        );
        showToast("Đã xoá ảnh", "success");
      })
      .catch((error) => {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `${firestoreCollection}/${activeCollection.id}`,
        );
        showToast("Lỗi khi xoá:" + error.message, "error");
      });
  };

  const handleDeleteActiveCollection = () => {
    if (collections.length <= 1) {
      showToast("Bạn không thể xoá bộ sưu tập duy nhất còn lại!", "error");
      return;
    }

    setConfirmDialogState({
      isOpen: true,
      title: "Xác nhận xoá Album",
      message: `Xoá toàn bộ sưu tập"${activeCollection.title}"? Thao tác này KHÔNG THỂ khôi phục!`,
      onConfirm: () => {
        softDeleteAlbum(activeCollection.id)
          .then(() => {
            setActiveCollectionIdx(0);
            setSelectedIndex(0);
            showToast("Xoá album thành công!", "success");
          })
          .catch((error) => {
            handleFirestoreError(
              error,
              OperationType.DELETE,
              `${firestoreCollection}/${activeCollection.id}`,
            );
            showToast("Lỗi khi xoá:" + error.message, "error");
          });
      },
    });
  };

  const selectPhotoForInspector = (idx: number) => {
    if (!activeCollection || !activeCollection.images[idx]) return;
    const img = activeCollection.images[idx];
    setPhotoToEditIdx(idx);
    setEditPhotoTitle(img.title || "");
    setEditPhotoDesc(img.desc || "");
    setEditPhotoObjectPosition(
      img.imagePosition || img.objectPosition || "center",
    );
    setEditPhotoAspectRatio(img.aspectRatio || "16/9");
    setEditPhotoScale(img.imageScale ?? 1.0);
    setEditPhotoGalleryImages(img.galleryImages || []);
  };

  const handleSavePhotoEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeCollection || photoToEditIdx === null) return;

    const photoTarget = activeCollection.images[photoToEditIdx];
    if (!photoTarget?.id) return;

    setIsSavingPhotoFrame(true);
    updatePhoto(activeCollection.id, photoTarget.id, {
      title: editPhotoTitle,
      desc: editPhotoDesc,
      objectPosition: editPhotoObjectPosition,
      imagePosition: editPhotoObjectPosition,
      aspectRatio: editPhotoAspectRatio,
      imageScale: Number(editPhotoScale) || 1.0,
      galleryImages: editPhotoGalleryImages,
    })
      .then(() => {
        setLastSavedPhotoId(photoTarget.id);
        showToast("✅ Đã lưu thứ tự & khung hình!", "success");
        setTimeout(() => setLastSavedPhotoId(null), 3500);
      })
      .catch((error) => {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `${firestoreCollection}/${activeCollection.id}`,
        );
        showToast("Lỗi khi cập nhật khung hình: " + error.message, "error");
      })
      .finally(() => {
        setIsSavingPhotoFrame(false);
      });
  };

  const handleSetAsAlbumCover = async (photo: CustomPhoto) => {
    if (!activeCollection) return;
    try {
      await updateAlbumMeta(activeCollection.id, {
        coverImageSrc: photo.src,
        coverImagePosition:
          photo.imagePosition || photo.objectPosition || "center",
      });
      setEditColCoverSrc(photo.src);
      showToast("⭐ Đã đặt ảnh này làm ảnh bìa Album!", "success");
    } catch (err: any) {
      showToast("Lỗi khi đặt ảnh bìa: " + err.message, "error");
    }
  };

  const handleApplyRatioToAllAlbum = async () => {
    if (!activeCollection || !activeCollection.images.length) return;
    if (
      !window.confirm(
        `Áp dụng tỷ lệ khung "${editPhotoAspectRatio}" cho toàn bộ ${activeCollection.images.length} ảnh trong album "${activeCollection.title}"?`,
      )
    )
      return;

    setIsApplyingRatioAll(true);
    try {
      for (const img of activeCollection.images) {
        if (img.id) {
          await updatePhoto(activeCollection.id, img.id, {
            aspectRatio: editPhotoAspectRatio,
          });
        }
      }
      showToast(
        `✅ Đã áp dụng tỷ lệ "${editPhotoAspectRatio}" cho toàn bộ ${activeCollection.images.length} ảnh trong Album!`,
        "success",
      );
    } catch (err: any) {
      showToast("Lỗi khi áp dụng tỷ lệ cho album: " + err.message, "error");
    } finally {
      setIsApplyingRatioAll(false);
    }
  };

  const handleQuickAddFromDrive = async (urls: string[]) => {
    if (!activeCollection || urls.length === 0) return;
    const currentCount = activeCollection.images.length;
    const newPhotosToAdd = urls.map((url, i) => ({
      src: ensureWebPUrl(url),
      alt: `Khung hình ${currentCount + i + 1}`,
      title: `Khung hình ${currentCount + i + 1}`,
      desc: "",
      focal: "50mm F/1.8",
      iso: "100",
      aspectRatio: editPhotoAspectRatio || "16/9",
      objectPosition: "center",
      imagePosition: "center",
      imageScale: 1.0,
      galleryImages: [],
    }));

    try {
      await addPhotos(activeCollection.id, newPhotosToAdd);
      showToast(
        `Đã thêm ${urls.length} ảnh trực tiếp từ Google Drive vào Album!`,
        "success",
      );
      selectPhotoForInspector(currentCount);
    } catch (err: any) {
      showToast("Lỗi khi thêm ảnh từ Drive: " + err.message, "error");
    }
  };

  const handleQuickAddUrls = async () => {
    if (!activeCollection || !quickAddUrlsInput.trim()) return;
    const urls = quickAddUrlsInput
      .split(/[,;\s\n]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && validateUrl(u));
    if (urls.length === 0) {
      showToast("Vui lòng nhập ít nhất một liên kết ảnh hợp lệ!", "error");
      return;
    }
    const currentCount = activeCollection.images.length;
    const newPhotos = urls.map((url, i) => ({
      src: ensureWebPUrl(url),
      alt: `Khung hình ${currentCount + i + 1}`,
      title: `Khung hình ${currentCount + i + 1}`,
      desc: "",
      focal: "50mm F/1.8",
      iso: "100",
      aspectRatio: editPhotoAspectRatio || "16/9",
      objectPosition: "center",
      imagePosition: "center",
      imageScale: 1.0,
      galleryImages: [],
    }));

    try {
      await addPhotos(activeCollection.id, newPhotos);
      setQuickAddUrlsInput("");
      setIsQuickAddModalOpen(false);
      showToast(`Đã thêm ${urls.length} ảnh vào Album!`, "success");
      selectPhotoForInspector(currentCount);
    } catch (err: any) {
      showToast("Lỗi khi thêm ảnh: " + err.message, "error");
    }
  };

  const handleQuickAddLocalFiles = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!activeCollection || files.length === 0) return;
    setIsUploadingQuickFiles(true);
    try {
      const compressedUrls = await Promise.all(
        files.map((f: File) => compressImage(f)),
      );
      const currentCount = activeCollection.images.length;
      const newPhotos = compressedUrls.map((src, i) => ({
        src,
        alt: `Khung hình ${currentCount + i + 1}`,
        title: `Khung hình ${currentCount + i + 1}`,
        desc: "",
        focal: "50mm F/1.8",
        iso: "100",
        aspectRatio: editPhotoAspectRatio || "16/9",
        objectPosition: "center",
        imagePosition: "center",
        imageScale: 1.0,
        galleryImages: [],
      }));
      await addPhotos(activeCollection.id, newPhotos);
      setIsQuickAddModalOpen(false);
      showToast(`Đã nén và thêm ${files.length} ảnh vào Album!`, "success");
      selectPhotoForInspector(currentCount);
    } catch (err: any) {
      showToast("Lỗi khi tải ảnh: " + err.message, "error");
    } finally {
      setIsUploadingQuickFiles(false);
      e.target.value = "";
    }
  };

  const handleUpdateCollectionInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCollection) return;

    const metaPromise = updateAlbumMeta(activeCollection.id, {
      title: editColTitle,
      subtitle: editColSubtitle,
      year: editColYear.trim() || extractYearFromText(editColTitle, editColSubtitle, editColBody),
      eventType: editColEventType.trim() || inferEventTypeFromText(editColTitle, editColSubtitle, firestoreCollection),
      body: editColBody,
      driveLink: editColDrive,
      coverImageSrc: editColCoverSrc,
      coverImagePosition: editColCoverPosition,
    });

    // We can also let the object position sync to the first image if they didn't upload a custom cover
    const photoPromise =
      !editColCoverSrc && activeCollection.images?.[0]?.id
        ? updatePhoto(activeCollection.id, activeCollection.images[0].id, {
            objectPosition: editColCoverPosition,
          })
        : Promise.resolve();

    Promise.all([metaPromise, photoPromise])
      .then(() => {
        showToast("Cập nhật thông tin album thành công!", "success");
      })
      .catch((error) => {
        handleFirestoreError(
          error,
          OperationType.WRITE,
          `${firestoreCollection}/${activeCollection.id}`,
        );
        showToast("Lỗi khi cập nhật album:" + error.message, "error");
      });
  };

  const handleAiSuggest = async (type: "create" | "edit") => {
    const title = type === "create" ? newColTitle : editColTitle;
    if (!title || !title.trim()) {
      showToast("Vui lòng nhập Tên Album trước khi yêu cầu AI gợi ý!", "error");
      return;
    }

    setIsAiGenerating(true);
    setAiError("");

    try {
      const response = await fetch("/api/recommend-album-meta", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Lỗi từ phía máy chủ khi gọi AI gợi ý");
      }

      if (type === "create") {
        setNewColSubtitle(data.subtitle || "");
        setNewColBody(data.body || "");
      } else {
        setEditColSubtitle(data.subtitle || "");
        setEditColBody(data.body || "");
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Lỗi gợi ý AI");
      showToast(
        err.message ||
          "Không thể lấy gợi ý từ AI lúc này. Hãy kiểm tra lại kết nối mạng của bạn.",
        "error",
      );
    } finally {
      setIsAiGenerating(false);
    }
  };

  const [isAiPhotoGenerating, setIsAiPhotoGenerating] = useState(false);

  const handleAiSuggestPhoto = async () => {
    if (!activeCollection?.title) {
      showToast("Vui lòng chọn Album trước khi yêu cầu AI gợi ý!", "error");
      return;
    }
    if (!newPhotoTitle.trim()) {
      showToast(
        "Vui lòng nhập Tiêu đề ảnh trước khi yêu cầu AI gợi ý Mô tả chi tiết!",
        "error",
      );
      return;
    }

    setIsAiPhotoGenerating(true);
    setAiError("");

    try {
      const response = await fetch("/api/recommend-photo-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumTitle: activeCollection.title,
          photoTitle: newPhotoTitle,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Lỗi từ phía máy chủ khi gọi AI gợi ý");
      }

      if (data.desc) setNewPhotoDesc(data.desc);
      if (data.focal) setNewPhotoFocal(data.focal);
      if (data.iso) setNewPhotoIso(data.iso);
      showToast("Gợi ý từ AI đã được áp dụng thành công", "success");
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Lỗi gợi ý AI");
      showToast(
        err.message ||
          "Không thể lấy gợi ý từ AI lúc này. Hãy kiểm tra lại kết nối mạng của bạn.",
        "error",
      );
    } finally {
      setIsAiPhotoGenerating(false);
    }
  };

  const resetToFactoryDefaults = async () => {
    setConfirmDialogState({
      isOpen: true,
      title: "Xác nhận khôi phục",
      message:
        "Đặt lại toàn bộ danh mục album về nguyên bản mặc định? Thao tác này sẽ xoá sạch các album tự thêm.",
      onConfirm: async () => {
        try {
          for (const col of collections) {
            await softDeleteAlbum(col.id);
          }
          showToast("Đã khôi phục cài đặt gốc thành công", "success");
        } catch (error) {
          console.error("Error resetting defaults:", error);
          showToast("Lỗi khi khôi phục cài đặt gốc", "error");
        }
      },
    });
  };

  const focalSuggestions = [
    { focal: "35mm F/2.0", label: "Góc rộng kể chuyện chân thực" },
    { focal: "85mm F/1.4", label: "Chân dung xóa phông nghệ thuật" },
    { focal: "50mm F/1.8", label: "Góc nhìn tự nhiên trong trẻo" },
    { focal: "24-70mm F/2.8", label: "Linh hoạt đa sắc thái" },
  ];

  const showcaseRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={showcaseRef}
      className="w-full flex flex-col gap-6 font-manrope scroll-mt-24"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
          body.lightbox-active [id*="chat"], body.lightbox-active [class*="chat"], 
          body.lightbox-active .drift-widget, body.lightbox-active [id*="drift"] {
             display: none !important;
          }
        `,
        }}
      />

      {/* 1. HEADER ROW: Category title, Quick Photo Progress Lookup, and Album Pill Selector */}
      <div className="flex flex-col gap-4 pb-4 border-b border-white/10 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-sans font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              {slide.id === "S6"
                ? "Event & Prom Night"
                : slide.id === "S4"
                  ? "Kỷ Yếu THPT & Pre Graduation"
                  : slide.id === "S8"
                    ? "Concept Theo Yêu Cầu"
                    : slide.title || "BỘ SƯU TẬP ALBUM"}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#B5945B]/15 text-[#E5C17C] border border-[#B5945B]/30 tracking-tight shrink-0">
              {collections.length} album
            </span>
          </div>

          {/* Quick Lookup by Booking Code Button */}
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("openPhotoProgressLookup", {}));
            }}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-[#B5945B]/40 hover:border-[#B5945B] text-[#E8D2A6] hover:text-white text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm active:scale-95 group"
            title="Tra cứu tiến độ ảnh và tải trọn bộ file bằng Mã booking"
          >
            <Search className="w-3.5 h-3.5 text-[#B5945B] group-hover:scale-110 transition-transform" />
            <span>Tra cứu ảnh bằng Mã booking</span>
          </button>
        </div>

        {/* Horizontal Album Navigation Pills (Zero Grid, Direct Showcase) */}
        {isLoadingData && collections.length === 0 ? (
          <PortfolioSkeleton />
        ) : collections.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 transition-opacity duration-700 ease-out opacity-100">
            {collections.map((col, idx) => (
              <button
                key={col.id || idx}
                type="button"
                onClick={() => {
                  setActiveCollectionIdx(idx);
                  setSelectedIndex(0);
                  setVisiblePhotoCount(12);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer select-none ${
                  activeCollectionIdx === idx
                    ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/25 font-extrabold scale-[1.02]"
                    : "bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10"
                }`}
              >
                {col.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* 2. 3D CONTINUOUS FLOW OR LUXURY DARK SKELETON */}
      {isLoadingData && collections.length === 0 ? (
        <div className="w-full py-4 space-y-6">
          {/* Skeleton Album Track */}
          <div className="flex gap-4 overflow-hidden py-4 px-2">
            {[1, 2, 3].map((skeletonIdx) => (
              <div
                key={`album-skeleton-${skeletonIdx}`}
                className="luxury-shimmer shrink-0 w-[280px] sm:w-[340px] md:w-[380px] aspect-[16/10] rounded-2xl border border-[#B5945B]/20 flex flex-col justify-between p-5 relative"
              >
                <div className="flex items-center justify-between">
                  <div className="w-24 h-5 rounded-full bg-white/5 border border-white/10" />
                  <div className="w-2 h-2 rounded-full bg-[#E5C17C]/40 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="w-3/4 h-5 rounded-md bg-white/10" />
                  <div className="w-1/2 h-3.5 rounded-md bg-white/5" />
                </div>
              </div>
            ))}
          </div>

          {/* Skeleton Detail Grid Preview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 pt-4">
            {[1, 2, 3, 4].map((gridIdx) => (
              <div
                key={`grid-skeleton-${gridIdx}`}
                className="luxury-shimmer aspect-[3/4] rounded-xl border border-[#B5945B]/15"
              />
            ))}
          </div>
        </div>
      ) : collections.length > 0 ? (
        <div className="w-full transition-opacity duration-700 ease-out opacity-100">
          <Horizontal3DCollectionTrack
            collections={collections as any}
            activeCollectionIdx={activeCollectionIdx}
            categoryTitle={categoryTitle}
            categorySubtitle={categorySubtitle}
            onSelectCollection={(idx, colId) => {
              handleOpenAlbum(colId, idx);
            }}
            isAdminMode={isAdminMode}
            preloadHighResImage={preloadHighResImage}
            slideImages={slide.images}
            currentSlideId={slide.id}
          />
        </div>
      ) : null}

      {collections.length > 0 && (
        <div className="flex flex-col gap-6 transition-opacity duration-700 ease-out opacity-100">
          {/* Quick Next/Previous album hops right in header */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/5 text-left text-xs sm:text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-zinc-400 font-sans text-xs shrink-0">Đang xem:</span>
            <span className="text-[#E5C17C] font-extrabold uppercase tracking-wide truncate">
              {activeCollection?.title || "Album"}
            </span>
            {activeCollection?.images?.length ? (
              <span className="text-zinc-500 text-xs shrink-0 font-sans">
                ({activeCollection.images.length} ảnh)
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {prevCol && (
              <button
                type="button"
                onClick={() => {
                  if (prevColIdx !== -1) {
                    setActiveCollectionIdx(prevColIdx);
                    setSelectedIndex(0);
                    setVisiblePhotoCount(12);
                    showcaseRef.current?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="text-white/90 hover:text-white font-semibold flex items-center gap-1 transition-all cursor-pointer py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs"
                title={`Album trước: ${prevCol.title}`}
              >
                <ChevronLeft className="w-3.5 h-3.5 text-[#E5C17C]" />
                <span className="hidden sm:inline font-medium">{prevCol.title}</span>
                <span className="sm:hidden font-bold">Trước</span>
              </button>
            )}
            {prevCol && nextCol && (
              <span className="text-white/40">·</span>
            )}
            {nextCol && (
              <button
                type="button"
                onClick={() => {
                  if (nextColIdx !== -1) {
                    setActiveCollectionIdx(nextColIdx);
                    setSelectedIndex(0);
                    setVisiblePhotoCount(12);
                    showcaseRef.current?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="text-[#E5C17C] hover:text-[#f3e5ab] font-bold flex items-center gap-1 transition-all cursor-pointer py-1 px-2.5 rounded-lg bg-[#B5945B]/15 hover:bg-[#B5945B]/25 border border-[#B5945B]/30 text-xs"
                title={`Album tiếp theo: ${nextCol.title}`}
              >
                <span className="hidden sm:inline font-bold">{nextCol.title}</span>
                <span className="sm:hidden font-extrabold">Tiếp</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#E5C17C]" />
              </button>
            )}
          </div>
        </div>

          {activeCollection ? (
            <div className="flex flex-col gap-8">
              {/* Viewer Info (Album Title, Description, Badge) */}
              <div className="flex flex-col gap-6 text-left">
                <motion.div
                  key={`album-header-${activeCollection.id}`}
                  initial={{ opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <h4 className="font-sans font-bold text-xl min-[400px]:text-2xl sm:text-3xl md:text-4xl tracking-tight text-white leading-snug">
                    {activeCollection.title}
                  </h4>
                  <p className="text-zinc-300 text-xs sm:text-sm md:text-base leading-relaxed max-w-3xl line-clamp-3 sm:line-clamp-none">
                    {activeCollection.body}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-sans text-xs text-zinc-400 bg-zinc-800/50 px-3 py-1 rounded-md">
                        {activeCollection.images.length} ảnh
                      </span>
                      {/* Year Badge */}
                      <span className="font-sans text-xs text-[#E5C17C] font-bold bg-[#B5945B]/15 px-3 py-1 rounded-md border border-[#B5945B]/30 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-[#B5945B]" />
                        <span>
                          Năm{" "}
                          {activeCollection.year ||
                            extractYearFromText(
                              activeCollection.title,
                              activeCollection.subtitle,
                              activeCollection.body,
                            )}
                        </span>
                      </span>
                      {/* Event Type Badge */}
                      <span className="font-sans text-xs text-zinc-200 font-semibold bg-white/10 px-3 py-1 rounded-md border border-white/15 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-[#B5945B]" />
                        <span>
                          {activeCollection.eventType ||
                            inferEventTypeFromText(
                              activeCollection.title,
                              activeCollection.subtitle,
                              firestoreCollection,
                            )}
                        </span>
                      </span>
                      {activeCollection.subtitle && (
                        <span className="font-sans text-[12px] capitalize tracking-wide text-[#B5945B] font-medium bg-[#B5945B]/10 px-3 py-1 rounded-md border border-[#B5945B]/30">
                          {activeCollection.subtitle}
                        </span>
                      )}
                      <SectionViewBadge
                        views={getAlbumViews(activeCollection.id || activeCollection.title)}
                        label="lượt xem album"
                        size="sm"
                        isPopular={getAlbumViews(activeCollection.id || activeCollection.title) > 100}
                      />
                      {isAdminGlobal ? (
                        <button
                          type="button"
                          onClick={() => setIsWidgetOpen(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-sans font-medium transition-all cursor-pointer shadow-sm"
                          title="Xem chi tiết ai đang xem (Admin)"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
                          <span>{activeCount} đang xem</span>
                        </button>
                      ) : (
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-sans font-medium shadow-sm select-none"
                          title={`${activeCount} người đang xem website`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" />
                          <span>{activeCount} đang xem</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Album Hopping */}
                    <div className="flex items-center gap-2">
                      {/* Quick jump to prev/next album */}
                      {prevCol && (
                        <button
                          type="button"
                          onClick={() => {
                            if (prevColIdx !== -1) {
                              setActiveCollectionIdx(prevColIdx);
                              setSelectedIndex(0);
                              setVisiblePhotoCount(12);
                              showcaseRef.current?.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-full liquid-glass-btn text-xs text-zinc-300 hover:text-white flex items-center gap-1 cursor-pointer transition-all border border-white/10"
                          title={`Album trước: ${prevCol.title}`}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Album trước</span>
                        </button>
                      )}
                      {nextCol && (
                        <button
                          type="button"
                          onClick={() => {
                            if (nextColIdx !== -1) {
                              setActiveCollectionIdx(nextColIdx);
                              setSelectedIndex(0);
                              setVisiblePhotoCount(12);
                              showcaseRef.current?.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-full liquid-glass-gold-btn text-xs font-bold text-black flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                          title={`Album tiếp theo: ${nextCol.title}`}
                        >
                          <span className="hidden sm:inline">Album tiếp theo</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* 3D SCROLLYTELLING ALBUM EXPERIENCE */}
              {allAlbumPhotos.length === 0 ? (
                <div className="w-full flex flex-col items-center justify-center p-12 bg-white/5 border border-white/10 rounded-xl">
                  <div className="text-zinc-500 mb-4 bg-zinc-900/50 p-4 rounded-full">
                    <ZoomIn className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="text-zinc-400 font-medium text-sm">
                    Album này chưa có tác phẩm nào.
                  </p>
                </div>
              ) : (
                <Album3DScrollytellingViewer
                  collection={activeCollection}
                  photos={displayedPhotos}
                  allPhotosCount={allAlbumPhotos.length}
                  visibleCount={visiblePhotoCount}
                  onLoadMore={() =>
                    setVisiblePhotoCount((prev) =>
                      Math.min(prev + 12, allAlbumPhotos.length)
                    )
                  }
                  onOpenLightbox={(photo, idx) => {
                    recordPhotoView(
                      photo.id || photo.src,
                      photo.title || activeCollection?.title || "Tác phẩm",
                      activeCollection?.id || "album"
                    );
                    const targetIdx = activeAlbumLightboxPhotos.findIndex(
                      (p) => p.originalPhoto === photo.originalPhoto || p.src === photo.src
                    );
                    setSelectedWorkIdx(idx);
                    setSelectedIndex(targetIdx !== -1 ? targetIdx : idx);
                    setIsAutoplay(false);
                    setIsLightboxOpen(true);
                  }}
                  getPhotoViews={getPhotoViews}
                  formatViewCount={formatViewCount}
                  recordPhotoView={recordPhotoView}
                  preloadHighResImage={preloadHighResImage}
                />
              )}

              {/* Prev / Next Album quick jumper cards */}
              <div className="w-full max-w-2xl sm:max-w-3xl mx-auto pt-6 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {prevCol && (
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      if (prevColIdx !== -1) {
                        setActiveCollectionIdx(prevColIdx);
                        setSelectedIndex(0);
                        setVisiblePhotoCount(12);
                        showcaseRef.current?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className="p-3.5 rounded-2xl liquid-glass-card border border-white/15 hover:border-[#B5945B]/50 cursor-pointer transition-all flex items-center gap-3 group shadow-lg"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/30 border border-white/10">
                      {prevCol.coverImageSrc || (prevCol.images && prevCol.images[0]) ? (
                        <LazyImage
                          src={prevCol.coverImageSrc || prevCol.images[0].src}
                          alt={prevCol.title}
                          preset="thumbnail"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <FolderOpen className="w-full h-full p-3 text-[#B5945B]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-sans uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        <ChevronLeft className="w-3 h-3 text-[#B5945B]" /> Album trước
                      </span>
                      <h6 className="font-sans font-bold text-xs sm:text-sm text-white truncate group-hover:text-[#B5945B] transition-colors">
                        {prevCol.title}
                      </h6>
                      <span className="text-[11px] text-zinc-500 font-sans">
                        {prevCol.images?.length || 0} ảnh
                      </span>
                    </div>
                  </motion.div>
                )}

                {nextCol && (
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      if (nextColIdx !== -1) {
                        setActiveCollectionIdx(nextColIdx);
                        setSelectedIndex(0);
                        setVisiblePhotoCount(12);
                        showcaseRef.current?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className="p-3.5 rounded-2xl liquid-glass-card border border-white/15 hover:border-[#B5945B]/50 cursor-pointer transition-all flex items-center justify-between gap-3 group shadow-lg sm:ml-auto w-full"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-sans uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        Album tiếp theo <ChevronRight className="w-3 h-3 text-[#B5945B]" />
                      </span>
                      <h6 className="font-sans font-bold text-xs sm:text-sm text-white truncate group-hover:text-[#B5945B] transition-colors">
                        {nextCol.title}
                      </h6>
                      <span className="text-[11px] text-zinc-500 font-sans">
                        {nextCol.images?.length || 0} ảnh
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/30 border border-white/10">
                      {nextCol.coverImageSrc || (nextCol.images && nextCol.images[0]) ? (
                        <LazyImage
                          src={nextCol.coverImageSrc || nextCol.images[0].src}
                          alt={nextCol.title}
                          preset="thumbnail"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <FolderOpen className="w-full h-full p-3 text-[#B5945B]" />
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 4. RE-ARCHITECTED ADMIN ACTION DECK: Sleek tabbed workspace panel */}
      <AnimatePresence>
        {isAdminMode && (
          <motion.div
            key="admin-control-hub-deck"
            id="admin-control-hub"
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full bg-zinc-900/80 backdrop-blur-xl text-zinc-100 p-6 rounded-3xl shadow-lg text-left border border-white/10 ring-1 ring-white/5 space-y-6"
          >
            {/* Admin Hub Title & Reset button */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                <h4 className="font-sans font-medium text-amber-500 text-xs tracking-wide flex items-center gap-1.5 capitalize">
                  <Unlock className="w-4 h-4" /> Trung tâm quản trị
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[12px] bg-zinc-800/80 text-zinc-300 font-sans px-2.5 py-1.5 rounded-lg border border-white/5 shadow-inner">
                  Admin:{""}
                  <span className="text-emerald-400 font-bold">
                    {activeCollection?.title ? `Đang Online` : `Không xác định`}
                  </span>
                </span>
              </div>
            </div>

            {/* Hub Workspace Tabs Navigation - Segmented Liquid Glass Pill Bar */}
            <div className="w-full overflow-x-auto no-scrollbar pb-1 border-b border-white/5">
              <div className="inline-flex sm:flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 min-w-full sm:min-w-0 snap-x">
                {[
                  { id: "photo", label: "Ảnh chụp", icon: Camera },
                  { id: "manage-albums", label: "Quản lý Album", icon: FolderKanban },
                  { id: "edit-meta", label: "Đổi Tóm tắt", icon: PenTool },
                  { id: "edit-frames", label: "Chỉnh Frames", icon: LayoutGrid },
                  { id: "settings", label: "Hệ thống", icon: Sliders },
                  { id: "google-drive", label: "Google Drive", icon: HardDrive },
                ].map((tab) => {
                  const IconComp = tab.icon;
                  const isActive = adminActiveTab === tab.id;
                  return (
                    <button
                      key={`tab-opt-${tab.id}`}
                      type="button"
                      onClick={() => setAdminActiveTab(tab.id as any)}
                      className={`relative min-h-[42px] px-3.5 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap snap-start shrink-0 active:scale-95 ${
                        isActive
                          ? "bg-gradient-to-r from-[#B5945B] to-[#d4af37] text-zinc-950 font-bold shadow-lg shadow-[#B5945B]/20"
                          : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <IconComp
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isActive ? "text-zinc-950 scale-105" : "text-[#B5945B]"
                        }`}
                      />
                      <span className="tracking-wide uppercase text-[11px] sm:text-xs">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TAB CONTENT 1: Add Image tool */}
            {adminActiveTab === "photo" && activeCollection && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                  <div className="text-xs text-zinc-300 flex items-center gap-1">
                    <span className="font-semibold text-amber-500">
                      Đang chọn Album:
                    </span>
                    <span className="bg-zinc-800 text-amber-100 px-2 py-0.5 rounded uppercase font-medium text-[11px]">
                      {activeCollection.title}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={isOptimizingWebP}
                      onClick={handleBatchOptimizeWebP}
                      className="w-full sm:w-auto min-h-[40px] px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 text-zinc-300 hover:text-white text-[11px] sm:text-xs font-bold border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm uppercase whitespace-nowrap"
                      title="Tự động quét và chuyển đổi toàn bộ ảnh sang định dạng WebP chất lượng cao giúp tăng tốc tải trang"
                    >
                      {isOptimizingWebP ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#B5945B]" />
                          <span>Đang nén ({optimizeProgress.current}/{optimizeProgress.total})</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#B5945B]" />
                          <span>Tối Ưu Toàn Bộ WebP</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isAiPhotoGenerating}
                      onClick={handleAiSuggestPhoto}
                      className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl bg-[#B5945B]/15 hover:bg-[#B5945B]/25 active:scale-95 text-[#E5C17C] hover:text-white text-[11px] sm:text-xs font-bold border border-[#B5945B]/40 hover:border-[#B5945B] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(181,148,91,0.2)] uppercase whitespace-nowrap backdrop-blur-md disabled:opacity-50"
                    >
                      {isAiPhotoGenerating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E5C17C]" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-[#E5C17C] animate-pulse" />
                      )}
                      <span>AI Gợi Ý Ảnh ✨</span>
                    </button>
                  </div>
                </div>

                {/* Image Submission Form */}
                <form onSubmit={handleAddPhotoToActive} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                      <label className="block text-[12px] items-center gap-1 font-sans text-teal-400 font-semibold mb-2">
                        <span>Lưu trữ Database trực tiếp (Ảnh nén)</span>
                      </label>
                      <div className="flex flex-col gap-2">
                        {newPhotoSrcs.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                            {newPhotoSrcs.map((src, i) => (
                              <img
                                key={`preview-photo-${src}-${i}`}
                                src={resolveImage(src)}
                                alt="preview"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
                                className="w-10 h-10 rounded-lg border border-white/20 object-cover shrink-0 shadow-lg"
                              />
                            ))}
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(
                              e.target.files || [],
                            ) as File[];
                            if (files.length > 0) {
                              try {
                                const compressedUrls = await Promise.all(
                                  files.map((file) => compressImage(file)),
                                );
                                setNewPhotoSrcs((prev) => [
                                ]);
                              } catch (err) {
                                console.error("Image compression failed", err);
                              }
                            }
                          }}
                          className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[11px] file:font-bold  file:bg-amber-500/20 file:text-amber-400 hover:file:bg-amber-500/30 cursor-pointer transition-all file:shadow-md"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <label className="text-[12px] items-center gap-1 font-sans text-[#B5945B] font-semibold flex">
                          <span>🔗 Dán LINK Ảnh Gốc Chất Lượng Cao</span>
                        </label>
                        <GooglePickerButton
                          mode="images"
                          multiselect={true}
                          size="sm"
                          buttonText="📁 Quét chọn ảnh từ Drive"
                          onSelectMultiple={(urls) => {
                            setNewPhotoUrlInput((prev) =>
                              prev.trim() ? `${prev.trim()}\n${urls.join("\n")}` : urls.join("\n")
                            );
                            showToast(`Đã thêm ${urls.length} link ảnh từ Google Drive!`, "success");
                          }}
                          onSelect={(url) => {
                            setNewPhotoUrlInput((prev) =>
                              prev.trim() ? `${prev.trim()}\n${url}` : url
                            );
                            showToast("Đã chọn ảnh từ Google Drive!", "success");
                          }}
                        />
                      </div>
                      <input
                        type="text"
                        value={newPhotoUrlInput}
                        onChange={(e) => setNewPhotoUrlInput(e.target.value)}
                        className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-3 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 max-w-full placeholder:text-zinc-600 transition-all shadow-inner"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed tracking-wide">
                        Khuyên dùng để lách giới hạn 1MB: Tải lên Drive/Imgur,
                        copy link dán vào.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                      <label className="block text-[12px] font-sans text-zinc-400 font-semibold">
                        Tiêu đề
                      </label>
                      <input
                        type="text"
                        value={newPhotoTitle}
                        onChange={(e) => setNewPhotoTitle(e.target.value)}
                        className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-3 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 transition-all shadow-inner placeholder:text-zinc-600"
                      />
                    </div>
                    <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                      <label className="block text-[12px] font-sans text-zinc-400 font-semibold">
                        Mô tả chi tiết
                      </label>
                      <input
                        type="text"
                        value={newPhotoDesc}
                        onChange={(e) => setNewPhotoDesc(e.target.value)}
                        className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-3 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 transition-all shadow-inner placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div className="w-full pt-3 pb-2">
                    <button
                      type="submit"
                      className="w-full h-13 rounded-2xl bg-gradient-to-r from-[#B5945B] via-[#c9a769] to-[#B5945B] hover:brightness-110 active:scale-[0.99] hover:scale-[1.01] text-zinc-950 font-extrabold text-xs sm:text-sm tracking-wider uppercase shadow-[0_10px_30px_rgba(181,148,91,0.3)] hover:shadow-[0_12px_35px_rgba(181,148,91,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                      <span>THÊM KHUNG HÌNH MỚI VÀO BỘ SƯU TẬP</span>
                    </button>
                  </div>
                </form>

                {/* Direct photo deletion manager section inside Admin panel workspace */}
                <div className="border-t border-zinc-800 pt-4 mt-4">
                  <span className="block text-[12px] font-sans uppercase tracking-wide text-amber-500 font-bold mb-3">
                    🛠️ QUẢN LÝ KHUNG HÌNH TRONG ALBUM (
                    {activeCollection.images.length})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                    {activeCollection.images.map((img, idx) => (
                      <div
                        key={`manage-frame-${img.src}-${idx}`}
                        className="flex items-center justify-between gap-2.5 p-2 rounded bg-slate-850 border border-zinc-800/80 hover:border-slate-755 text-zinc-200 text-left transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-10 h-10 rounded overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0">
                            <img
                              src={resolveImage(img.src)}
                              alt={img.alt}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-zinc-100 truncate uppercase">
                              {img.title || "(Chưa có tiêu đề)"}
                            </p>
                            <p className="text-[11px] text-[#B5945B] font-sans">
                              FRAME {(idx + 1).toString().padStart(2, "0")}
                            </p>
                          </div>
                        </div>
                        {photoToDeleteConfirmIdx === idx ? (
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                handleDeletePhoto(idx, true);
                                setPhotoToDeleteConfirmIdx(null);
                              }}
                              className="px-2 py-1 text-[12px] bg-red-600 hover:bg-red-700 text-white font-bold rounded cursor-pointer transition-all animate-pulse"
                            >
                              Xoá!
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhotoToDeleteConfirmIdx(null)}
                              className="px-1.5 py-1 text-[12px] bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded cursor-pointer transition-all"
                            >
                              Huỷ
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1 shrink-0">
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleReorderPhoto(idx, "up")}
                                className="px-2 py-1 text-[12px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-300 hover:text-white rounded flex items-center justify-center cursor-pointer transition-all"
                                title="Di chuyển lên"
                              >
                                <ArrowUp className="w-3" />
                              </button>
                            )}
                            {idx < activeCollection.images.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleReorderPhoto(idx, "down")}
                                className="px-2 py-1 text-[12px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-300 hover:text-white rounded flex items-center justify-center cursor-pointer transition-all"
                                title="Di chuyển xuống"
                              >
                                <ArrowDown className="w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setAdminActiveTab("edit-frames");
                                setPhotoToEditIdx(idx);
                                setEditPhotoTitle(img.title || "");
                                setEditPhotoDesc(img.desc || "");
                                setEditPhotoObjectPosition(
                                  img.objectPosition || "center",
                                );
                                setEditPhotoGalleryImages(
                                  img.galleryImages || [],
                                );
                              }}
                              className="px-2 py-1 text-[12px] bg-amber-950/60 hover:bg-amber-900 border border-amber-900/40 text-amber-400 hover:text-white rounded flex items-center gap-1 cursor-pointer transition-all"
                              title="Chỉnh sửa thông tin"
                            >
                              <Edit3 className="w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPhotoToDeleteConfirmIdx(idx)}
                              className="px-2 py-1 text-[12px] bg-red-950/60 hover:bg-red-900 border border-red-900/40 text-red-400 hover:text-white rounded flex items-center gap-1 cursor-pointer transition-all"
                              title="Xoá khung hình"
                            >
                              <Trash2 className="w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: Create Album tool */}
            {adminActiveTab === "manage-albums" && (
              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleCreateCollection}
                className="space-y-5"
              >
                {/* Header & Quick Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#B5945B]/15 border border-[#B5945B]/30 flex items-center justify-center text-[#E5C17C] shrink-0">
                      <FolderKanban className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-[#E5C17C] uppercase tracking-wider block">
                        ✦ Album Creator
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide">
                        Thiết lập Album Kỷ Yếu / Sự kiện nghệ thuật mới
                      </h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={isOptimizingWebP}
                      onClick={handleBatchOptimizeWebP}
                      className="w-full sm:w-auto min-h-[40px] px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 text-zinc-300 hover:text-white text-[11px] sm:text-xs font-bold border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm uppercase whitespace-nowrap"
                      title="Tự động quét và chuyển đổi toàn bộ ảnh sang định dạng WebP chất lượng cao giúp tăng tốc tải trang"
                    >
                      {isOptimizingWebP ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#B5945B]" />
                          <span>Đang nén ({optimizeProgress.current}/{optimizeProgress.total})</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#B5945B]" />
                          <span>Tối Ưu Toàn Bộ WebP</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isAiGenerating}
                      onClick={() => handleAiSuggest("create")}
                      className="w-full sm:w-auto min-h-[40px] px-4 py-2 rounded-xl bg-[#B5945B]/15 hover:bg-[#B5945B]/25 active:scale-95 text-[#E5C17C] hover:text-white text-[11px] sm:text-xs font-bold border border-[#B5945B]/40 hover:border-[#B5945B] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(181,148,91,0.2)] uppercase whitespace-nowrap backdrop-blur-md disabled:opacity-50"
                    >
                      {isAiGenerating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E5C17C]" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-[#E5C17C] animate-pulse" />
                      )}
                      <span>
                        {isAiGenerating
                          ? "Đang tạo..."
                          : "AI Gợi ý mô tả ✨"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Tactile Form Controls - Unified Liquid Glass Container */}
                <div className="rounded-3xl bg-zinc-900/50 backdrop-blur-2xl border border-white/10 p-5 md:p-7 shadow-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Tên Album mới */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <FolderKanban className="w-3.5 h-3.5 text-[#B5945B]" />
                        <span>Tên Album mới <span className="text-amber-400">*</span></span>
                      </label>
                      <input
                        type="text"
                        placeholder="Vd: Kỷ Yếu THPT Trần Phú 12B5"
                        required
                        value={newColTitle}
                        onChange={(e) => setNewColTitle(e.target.value)}
                        className="w-full min-h-[48px] bg-black/40 text-zinc-100 px-4 py-3 rounded-2xl border border-white/12 focus:outline-none focus:border-[#B5945B] focus:ring-1 focus:ring-[#B5945B]/50 transition-all text-xs sm:text-sm placeholder:text-zinc-600 shadow-inner"
                      />
                    </div>

                    {/* Tiêu đề phụ giới thiệu */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <PenTool className="w-3.5 h-3.5 text-[#B5945B]" />
                        <span>Tiêu đề phụ giới thiệu</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Vd: Kỷ niệm thanh xuân niên khóa 2023 - 2026"
                        value={newColSubtitle}
                        onChange={(e) => setNewColSubtitle(e.target.value)}
                        className="w-full min-h-[48px] bg-black/40 text-zinc-100 px-4 py-3 rounded-2xl border border-white/12 focus:outline-none focus:border-[#B5945B] focus:ring-1 focus:ring-[#B5945B]/50 transition-all text-xs sm:text-sm placeholder:text-zinc-600 shadow-inner"
                      />
                    </div>

                    {/* Năm thực hiện with integrated 2026 | 2025 | 2024 chips */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#B5945B]" />
                        <span>Năm thực hiện</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="2026"
                          value={newColYear}
                          onChange={(e) => setNewColYear(e.target.value)}
                          className="w-full min-h-[48px] bg-black/40 text-zinc-100 pl-4 pr-36 py-3 rounded-2xl border border-white/12 focus:outline-none focus:border-[#B5945B] focus:ring-1 focus:ring-[#B5945B]/50 transition-all text-xs sm:text-sm placeholder:text-zinc-600 shadow-inner"
                        />
                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-white/10 shadow-sm">
                          {["2026", "2025", "2024"].map((yr) => (
                            <button
                              key={yr}
                              type="button"
                              onClick={() => setNewColYear(yr)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                newColYear === yr
                                  ? "bg-gradient-to-r from-[#B5945B] to-[#d4af37] text-zinc-950 shadow-sm"
                                  : "text-zinc-400 hover:text-white hover:bg-white/10"
                              }`}
                            >
                              {yr}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Loại hình sự kiện / Concept with quick chips */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-[#B5945B]" />
                        <span>Loại hình sự kiện / Concept</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Vd: Kỷ Yếu THPT / Prom Night"
                        value={newColEventType}
                        onChange={(e) => setNewColEventType(e.target.value)}
                        className="w-full min-h-[48px] bg-black/40 text-zinc-100 px-4 py-3 rounded-2xl border border-white/12 focus:outline-none focus:border-[#B5945B] focus:ring-1 focus:ring-[#B5945B]/50 transition-all text-xs sm:text-sm placeholder:text-zinc-600 shadow-inner"
                      />
                      {/* Quick Chips for mobile & desktop */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {[
                          "Kỷ Yếu THPT",
                          "Pre-Graduation",
                          "Prom Night",
                          "Concept Tự Do",
                        ].map((concept) => (
                          <button
                            key={concept}
                            type="button"
                            onClick={() => setNewColEventType(concept)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border ${
                              newColEventType === concept
                                ? "bg-[#B5945B]/20 text-[#E5C17C] border-[#B5945B]/50 shadow-sm"
                                : "bg-white/[0.03] text-zinc-400 border-white/8 hover:text-zinc-200 hover:bg-white/[0.08]"
                            }`}
                          >
                            + {concept}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Đường dẫn Google Drive của Album */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-[#B5945B]" />
                          <span>Đường dẫn Google Drive của Album <span className="text-amber-400">*</span></span>
                        </label>
                        <GooglePickerButton
                          mode="folders"
                          size="sm"
                          buttonText="📁 Chọn từ Google Drive"
                          onSelect={(url) => {
                            setNewColDrive(url);
                            showToast("Đã lấy liên kết thư mục Google Drive thành công!", "success");
                          }}
                        />
                      </div>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/drive/folders/..."
                        required
                        value={newColDrive}
                        onChange={(e) => setNewColDrive(e.target.value)}
                        className="w-full min-h-[48px] bg-black/40 text-zinc-100 px-4 py-3 rounded-2xl border border-white/12 focus:outline-none focus:border-[#B5945B] focus:ring-1 focus:ring-[#B5945B]/50 font-sans transition-all text-xs sm:text-sm placeholder:text-zinc-600 shadow-inner"
                      />
                    </div>

                    {/* Ảnh bìa cho Album (Tải lên / Dán link Drive) - Unified Block */}
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#B5945B]" />
                        <span>Ảnh bìa cho Album (Tải lên / Chọn Drive)</span>
                      </label>
                      <div className="p-3 sm:p-3.5 rounded-2xl bg-black/40 border border-white/12 space-y-3">
                        <div className="flex items-center gap-3">
                          {/* Thumbnail preview with rounded-2xl */}
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border border-white/15 overflow-hidden shrink-0 bg-zinc-900/80 flex items-center justify-center relative shadow-inner">
                            {newColCoverSrc ? (
                              <img
                                src={resolveImage(newColCoverSrc)}
                                alt="Album cover preview"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-zinc-600" />
                            )}
                          </div>

                          {/* Upload button & Google Drive Picker */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <label className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-[#B5945B]/15 hover:bg-[#B5945B]/25 active:scale-95 text-[#E5C17C] text-xs font-bold border border-[#B5945B]/30 transition-all cursor-pointer shadow-sm">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Tải ảnh lên</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        const compressedDataUrl =
                                          await compressImage(file);
                                        setNewColCoverSrc(compressedDataUrl);
                                      } catch (err) {
                                        console.error("Image compression failed", err);
                                      }
                                    }
                                  }}
                                />
                              </label>
                              <GooglePickerButton
                                mode="images"
                                size="sm"
                                buttonText="Chọn từ Drive"
                                onSelect={(url) => {
                                  setNewColCoverSrc(url);
                                  showToast("Đã chọn ảnh bìa từ Google Drive!", "success");
                                }}
                              />
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-1 truncate">
                              {newColCoverSrc ? "Đã có ảnh bìa xem trước" : "Hỗ trợ JPEG, PNG, WebP hoặc chọn trực tiếp từ Drive"}
                            </p>
                          </div>
                        </div>

                        {/* Paste link input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Hoặc dán URL / link Google Drive ảnh bìa tại đây..."
                            value={newColCoverSrc}
                            onChange={(e) => setNewColCoverSrc(e.target.value)}
                            className="w-full min-h-[44px] bg-zinc-950/70 text-zinc-100 px-3.5 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-[#B5945B] focus:ring-1 focus:ring-[#B5945B]/50 transition-all text-xs placeholder:text-zinc-600 shadow-inner"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Lời giới thiệu / Câu chuyện của Album (Span 2 cols) */}
                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <PenTool className="w-3.5 h-3.5 text-[#B5945B]" />
                        <span>Lời giới thiệu / Câu chuyện của Album</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Viết đôi dòng cảm xúc về album này, hoặc bấm 'AI GỢI Ý MÔ TẢ' ở góc trên để AI tự động soạn thảo..."
                        value={newColBody}
                        onChange={(e) => setNewColBody(e.target.value)}
                        className="w-full min-h-[96px] bg-black/40 text-zinc-100 p-4 rounded-2xl border border-white/12 focus:outline-none focus:border-[#B5945B] focus:ring-1 focus:ring-[#B5945B]/50 transition-all text-xs sm:text-sm placeholder:text-zinc-600 shadow-inner leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* Sticky Bottom Action Button */}
                <div className="pt-2 pb-6">
                  <button
                    type="submit"
                    className="w-full h-13 rounded-2xl bg-gradient-to-r from-[#B5945B] via-[#c9a769] to-[#B5945B] hover:brightness-110 active:scale-[0.99] hover:scale-[1.01] text-zinc-950 font-extrabold text-xs sm:text-sm tracking-wider uppercase shadow-[0_10px_30px_rgba(181,148,91,0.3)] hover:shadow-[0_12px_35px_rgba(181,148,91,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                    <span>KHỞI TẠO VÀ ĐỒNG BỘ LÊN CLOUD FIRESTORE</span>
                  </button>
                </div>
              </motion.form>
            )}

            {/* TAB CONTENT 3: Edit metadata */}
            {adminActiveTab === "edit-meta" && activeCollection && (
              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleUpdateCollectionInfo}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <span className="block text-xs text-amber-500 font-medium uppercase tracking-wide flex items-center gap-2">
                    ✏️ CẬP NHẬT TÓM TẮT ALBUM ĐANG CHỌN
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isAiGenerating}
                      onClick={() => handleAiSuggest("edit")}
                      className="px-4 py-2 rounded-xl bg-[#B5945B]/15 hover:bg-[#B5945B]/25 active:scale-95 text-[#E5C17C] hover:text-white text-[11px] sm:text-xs font-bold border border-[#B5945B]/40 hover:border-[#B5945B] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(181,148,91,0.2)] uppercase whitespace-nowrap backdrop-blur-md disabled:opacity-50"
                    >
                      {isAiGenerating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E5C17C]" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-[#E5C17C] animate-pulse" />
                      )}
                      <span>{isAiGenerating ? "Đang tạo..." : "AI Gợi Ý Mô Tả ✨"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteActiveCollection}
                      className="px-4 py-1.5 bg-red-950/50 hover:bg-red-900 border border-red-900/50 text-red-400 hover:text-white text-[12px] uppercase font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition-all backdrop-blur-md shadow-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> XÓA ALBUM NÀY VĨNH VIỄN
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                    <label className="block text-[12px] font-sans text-zinc-400 font-semibold">
                      Tiêu đề Album
                    </label>
                    <input
                      type="text"
                      required
                      value={editColTitle}
                      onChange={(e) => setEditColTitle(e.target.value)}
                      className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-3 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 transition-all shadow-inner placeholder:text-zinc-600"
                    />
                  </div>

                  <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                    <label className="block text-[12px] font-sans text-zinc-400 font-semibold">
                      Tiêu đề phụ
                    </label>
                    <input
                      type="text"
                      required
                      value={editColSubtitle}
                      onChange={(e) => setEditColSubtitle(e.target.value)}
                      className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-3 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 transition-all shadow-inner placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                    <label className="block text-[12px] font-sans text-zinc-400 font-semibold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>Năm thực hiện</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editColYear}
                        onChange={(e) => setEditColYear(e.target.value)}
                        className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-3 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 transition-all shadow-inner placeholder:text-zinc-600"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        {["2026", "2025", "2024"].map((yr) => (
                          <button
                            key={yr}
                            type="button"
                            onClick={() => setEditColYear(yr)}
                            className={`px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                              editColYear === yr
                                ? "bg-amber-500 text-black border-amber-400"
                                : "bg-zinc-800 text-zinc-300 border-white/10 hover:text-white"
                            }`}
                          >
                            {yr}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                    <label className="block text-[12px] font-sans text-zinc-400 font-semibold flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      <span>Loại hình sự kiện / Concept</span>
                    </label>
                    <input
                      type="text"
                      value={editColEventType}
                      onChange={(e) => setEditColEventType(e.target.value)}
                      className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-3 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 transition-all shadow-inner placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="block text-[12px] font-sans text-zinc-400 font-semibold flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-[#B5945B]" />
                      <span>Đường dẫn Google Drive</span>
                    </label>
                    <GooglePickerButton
                      mode="folders"
                      size="sm"
                      buttonText="📁 Chọn từ Drive"
                      onSelect={(url) => {
                        setEditColDrive(url);
                        showToast("Đã chọn thư mục Google Drive!", "success");
                      }}
                    />
                  </div>
                  <input
                    type="url"
                    required
                    value={editColDrive}
                    onChange={(e) => setEditColDrive(e.target.value)}
                    className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-3 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 font-sans transition-all shadow-inner placeholder:text-zinc-600"
                  />
                </div>

                <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                  <label className="block text-[12px] font-sans text-zinc-400 font-semibold">
                    Lời giới thiệu / Câu chuyện của Album
                  </label>
                  <textarea
                    rows={3}
                    value={editColBody}
                    onChange={(e) => setEditColBody(e.target.value)}
                    className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-3 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 transition-all shadow-inner placeholder:text-zinc-600"
                  />
                </div>

                {activeCollection.images &&
                  activeCollection.images.length > 0 && (
                    <div className="space-y-1.5 focus-within:ring-1 focus-within:ring-white/10 rounded-xl p-3 bg-zinc-800/20 border border-transparent transition-all">
                      <label className="block text-[12px] font-sans text-amber-500 font-medium mb-2 flex items-center gap-2">
                        ẢNH BÌA ALBUM
                      </label>
                      <p className="text-[12px] text-zinc-400 mb-3 italic">
                        Nếu để trống, ảnh đầu tiên trong Album sẽ tự động được
                        lấy làm ảnh bìa.
                      </p>

                      <div className="flex flex-col gap-2 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-md border border-white/10 overflow-hidden shrink-0 bg-zinc-900 shadow-inner">
                            {(editColCoverSrc ||
                              activeCollection.images[0]?.src) && (
                              <img
                                src={
                                  resolveImage(
                                    editColCoverSrc ||
                                      activeCollection.images[0]?.src,
                                  ) || undefined
                                }
                                alt="preview"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                                style={{
                                  objectPosition:
                                    editColCoverPosition || "center",
                                }}
                              />
                            )}
                          </div>
                          <div className="flex flex-col gap-2 flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const compressedDataUrl =
                                      await compressImage(file);
                                    setEditColCoverSrc(compressedDataUrl);
                                  } catch (err) {
                                    console.error(
                                      "Image compression failed",
                                      err,
                                    );
                                    showToast("Lỗi nén ảnh bìa", "error");
                                  }
                                }
                              }}
                              className="block w-full text-xs text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-300 hover:file:text-white hover:file:bg-zinc-700 transition-all cursor-pointer"
                            />
                            <GooglePickerButton
                              mode="images"
                              size="sm"
                              buttonText="Chọn ảnh bìa từ Drive"
                              onSelect={(url) => {
                                setEditColCoverSrc(url);
                                showToast("Đã chọn ảnh bìa từ Google Drive!", "success");
                              }}
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="Hoặc dán URL / link Google Drive ảnh bìa..."
                          value={editColCoverSrc}
                          onChange={(e) => setEditColCoverSrc(e.target.value)}
                          className="w-full text-xs bg-zinc-900/50 text-zinc-100 px-3.5 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-amber-500 transition-all shadow-inner placeholder:text-zinc-600"
                        />
                      </div>

                      <label className="block text-[12px] font-sans text-amber-500 font-medium mb-2 mt-4 flex items-center gap-2">
                        CĂN CHỈNH ẢNH BÌA ALBUM
                      </label>
                      <p className="text-[12px] text-zinc-400 mb-3 italic">
                        Kéo trực tiếp ảnh bên dưới để thay đổi khung hình hiển
                        thị (tương tự cover Facebook)
                      </p>
                      <div className="w-full max-w-sm mx-auto">
                        <ImagePositionControl
                          src={
                            resolveImage(
                              editColCoverSrc ||
                                activeCollection.images[0]?.src,
                            ) || ""
                          }
                          value={editColCoverPosition}
                          onChange={(val) => setEditColCoverPosition(val)}
                          aspectRatio="21/9"
                        />
                      </div>
                    </div>
                  )}

                <div className="pt-2 pb-6">
                  <button
                    type="submit"
                    className="w-full h-13 rounded-2xl bg-gradient-to-r from-[#B5945B] via-[#c9a769] to-[#B5945B] hover:brightness-110 active:scale-[0.99] hover:scale-[1.01] text-zinc-950 font-extrabold text-xs sm:text-sm tracking-wider uppercase shadow-[0_10px_30px_rgba(181,148,91,0.3)] hover:shadow-[0_12px_35px_rgba(181,148,91,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-5 h-5 stroke-[2.5]" />
                    <span>LƯU THAY ĐỔI VÀ ĐỒNG BỘ FIRESTORE</span>
                  </button>
                </div>
              </motion.form>
            )}

            {/* TAB CONTENT 6: Master-Detail Studio Workspace - CHỈNH FRAMES */}
            {adminActiveTab === "edit-frames" && activeCollection && (() => {
              const filteredPhotos = activeCollection.images
                .map((img, idx) => ({ img, idx }))
                .filter(({ img }) => {
                  if (!quickSearchPhotoQuery.trim()) return true;
                  const q = quickSearchPhotoQuery.toLowerCase();
                  const titleMatch = img.title && img.title.toLowerCase().includes(q);
                  const descMatch = img.desc && img.desc.toLowerCase().includes(q);
                  return titleMatch || descMatch;
                });

              const inspectedIdx =
                photoToEditIdx !== null && activeCollection.images[photoToEditIdx]
                  ? photoToEditIdx
                  : activeCollection.images.length > 0
                  ? 0
                  : null;
              const inspectedPhoto =
                inspectedIdx !== null ? activeCollection.images[inspectedIdx] : null;

              // Shared Inspector Component for Desktop Sticky Column & Mobile Bottom Sheet
              const renderInspectorContent = (isMobile = false) => {
                if (!inspectedPhoto || inspectedIdx === null) {
                  return (
                    <div className="p-8 text-center text-zinc-500 text-xs">
                      Chưa chọn khung hình nào. Hãy click vào ảnh bên trái để chỉnh sửa.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4 text-left">
                    {/* Header with Title and Sequential Navigation */}
                    <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#B5945B] block">
                          Khung hình #{inspectedIdx + 1} / {activeCollection.images.length}
                        </span>
                        <p className="text-xs font-semibold text-zinc-100 truncate max-w-[200px] sm:max-w-[240px]">
                          {inspectedPhoto.title || "(Chưa có tiêu đề)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={inspectedIdx <= 0}
                          onClick={() => selectPhotoForInspector(inspectedIdx - 1)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                          title="Chuyển sang ảnh trước"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Trước</span>
                        </button>
                        <button
                          type="button"
                          disabled={inspectedIdx >= activeCollection.images.length - 1}
                          onClick={() => selectPhotoForInspector(inspectedIdx + 1)}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                          title="Chuyển sang ảnh tiếp theo"
                        >
                          <span className="hidden sm:inline">Sau</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        {isMobile && (
                          <button
                            type="button"
                            onClick={() => setIsMobileInspectorOpen(false)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white ml-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Interactive Drag-to-Pan Position Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 uppercase font-semibold tracking-wider flex items-center gap-1.5">
                          <Crop className="w-3.5 h-3.5 text-[#B5945B]" />
                          Khu vực căn chỉnh vị trí
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditPhotoObjectPosition("center");
                            setEditPhotoScale(1.0);
                          }}
                          className="text-zinc-400 hover:text-[#E5C17C] flex items-center gap-1 transition-colors cursor-pointer"
                          title="Đặt lại vị trí giữa và zoom 100%"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Đặt lại gốc</span>
                        </button>
                      </div>

                      <div
                        className="w-full max-w-[280px] sm:max-w-[320px] mx-auto rounded-2xl overflow-hidden bg-zinc-950 border border-white/15 relative shadow-inner flex items-center justify-center transition-all"
                        style={{
                          aspectRatio: editPhotoAspectRatio
                            ? editPhotoAspectRatio.replace("/", " / ")
                            : "16/9",
                        }}
                      >
                        <ImagePositionControl
                          src={resolveImage(inspectedPhoto.src)}
                          value={editPhotoObjectPosition || "center"}
                          onChange={(val) => setEditPhotoObjectPosition(val)}
                          scale={editPhotoScale}
                          aspectRatio={editPhotoAspectRatio}
                        />
                      </div>
                      <p className="text-center text-[10.5px] text-zinc-500 italic">
                        * Nhấn giữ và rê chuột/ngón tay trên ảnh để di chuyển vị trí trọng tâm
                      </p>
                    </div>

                    {/* 1. ASPECT RATIO PILL BUTTONS + BATCH SHORTCUT */}
                    <div className="space-y-2 pt-1 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide">
                          1. Tỷ lệ khung (Aspect Ratio):
                        </label>
                        <span className="text-[11px] font-mono font-bold text-[#E5C17C] bg-[#B5945B]/10 px-2 py-0.5 rounded border border-[#B5945B]/20">
                          {editPhotoAspectRatio}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {["16/9", "4/3", "1/1", "3/4", "9/16"].map((ratio) => (
                          <button
                            key={`ratio-pill-${ratio}`}
                            type="button"
                            onClick={() => setEditPhotoAspectRatio(ratio)}
                            className={`py-1.5 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer ${
                              editPhotoAspectRatio === ratio
                                ? "bg-gradient-to-r from-[#B5945B] to-[#d4af37] text-zinc-950 border-[#B5945B] shadow-md shadow-[#B5945B]/25"
                                : "bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border-white/10"
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>

                      {/* Apply Ratio to All Photos in Album */}
                      <button
                        type="button"
                        onClick={handleApplyRatioToAllAlbum}
                        disabled={isApplyingRatioAll}
                        className="w-full py-1.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-bold text-[#E5C17C] hover:text-white border border-[#B5945B]/30 hover:border-[#B5945B] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        title="Đồng bộ tỷ lệ khung hình này cho toàn bộ ảnh trong album"
                      >
                        {isApplyingRatioAll ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-[#B5945B]" />
                            <span>Đang áp dụng...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-[#B5945B]" />
                            <span>Áp dụng tỷ lệ "{editPhotoAspectRatio}" cho toàn bộ Album</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* 2. ZOOM / SCALE CONTROL */}
                    <div className="space-y-1.5 pt-1 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide">
                          2. Độ Zoom / Scale ảnh:
                        </label>
                        <span className="text-xs font-mono font-bold text-[#E5C17C] bg-[#B5945B]/10 px-2 py-0.5 rounded border border-[#B5945B]/20">
                          {Math.round(editPhotoScale * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-950/80 p-2.5 rounded-xl border border-white/10 shadow-inner">
                        <button
                          type="button"
                          onClick={() =>
                            setEditPhotoScale((prev) =>
                              Math.max(1.0, +(prev - 0.05).toFixed(2))
                            )
                          }
                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
                          title="Giảm 5%"
                        >
                          -
                        </button>
                        <span className="text-[10.5px] font-mono text-zinc-500">100%</span>
                        <input
                          type="range"
                          min="1.0"
                          max="2.0"
                          step="0.05"
                          value={editPhotoScale}
                          onChange={(e) => setEditPhotoScale(parseFloat(e.target.value))}
                          className="flex-1 accent-[#B5945B] h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-[10.5px] font-mono text-zinc-500">200%</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEditPhotoScale((prev) =>
                              Math.min(2.0, +(prev + 0.05).toFixed(2))
                            )
                          }
                          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0"
                          title="Tăng 5%"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* 3. TITLE & DESCRIPTION */}
                    <div className="space-y-2 pt-1 border-t border-white/5">
                      <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide block">
                        3. Thông tin khung hình:
                      </label>
                      <input
                        type="text"
                        placeholder="Tiêu đề tác phẩm..."
                        value={editPhotoTitle}
                        onChange={(e) => setEditPhotoTitle(e.target.value)}
                        className="w-full text-xs bg-zinc-950 text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:border-[#B5945B] focus:outline-none placeholder-zinc-600 transition-all shadow-inner"
                      />
                      <textarea
                        placeholder="Mô tả chi tiết khoảnh khắc..."
                        value={editPhotoDesc}
                        onChange={(e) => setEditPhotoDesc(e.target.value)}
                        rows={2}
                        className="w-full text-xs bg-zinc-950 text-white px-3.5 py-2.5 rounded-xl border border-white/10 focus:border-[#B5945B] focus:outline-none placeholder-zinc-600 resize-none transition-all shadow-inner"
                      />
                    </div>

                    {/* 4. SUB-PHOTOS GALLERY */}
                    <div className="space-y-2 pt-1 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide">
                          4. Ảnh chi tiết Album ({editPhotoGalleryImages.length}):
                        </label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Dán link ảnh chi tiết..."
                          value={newGalleryUrlInput}
                          onChange={(e) => setNewGalleryUrlInput(e.target.value)}
                          className="flex-1 text-[11px] bg-zinc-950 text-white px-3 py-2 rounded-xl border border-white/10 focus:border-[#B5945B] focus:outline-none placeholder-zinc-600 transition-all min-h-[36px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newGalleryUrlInput.trim()) return;
                            setEditPhotoGalleryImages((prev) => [
                              ...prev,
                              newGalleryUrlInput.trim(),
                            ]);
                            setNewGalleryUrlInput("");
                            showToast("Đã thêm link ảnh chi tiết!", "success");
                          }}
                          className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-[#B5945B]/30 text-[#E5C17C] font-bold text-[11px] rounded-xl transition-all min-h-[36px] shrink-0 cursor-pointer"
                        >
                          Thêm
                        </button>
                        <GooglePickerButton
                          mode="images"
                          multiselect={true}
                          size="sm"
                          buttonText="📁 Drive"
                          onSelectMultiple={(urls) => {
                            setEditPhotoGalleryImages((prev) => [...prev, ...urls]);
                            showToast(
                              `Đã thêm ${urls.length} ảnh chi tiết từ Google Drive!`,
                              "success"
                            );
                          }}
                          onSelect={(url) => {
                            setEditPhotoGalleryImages((prev) => [...prev, url]);
                            showToast("Đã thêm ảnh chi tiết từ Google Drive!", "success");
                          }}
                        />
                      </div>

                      {/* Sub-photo thumbnail list */}
                      {editPhotoGalleryImages.length > 0 && (
                        <div className="grid grid-cols-4 gap-1.5 pt-1 max-h-[110px] overflow-y-auto pr-1 custom-scrollbar">
                          {editPhotoGalleryImages.map((gSrc, gIdx) => (
                            <div
                              key={`sub-${gSrc}-${gIdx}`}
                              className="relative group/sub aspect-square rounded-lg overflow-hidden border border-white/10 bg-zinc-950"
                            >
                              <img
                                src={resolveImage(gSrc)}
                                alt={`sub-${gIdx}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditPhotoGalleryImages((prev) =>
                                    prev.filter((_, idx) => idx !== gIdx)
                                  );
                                  showToast("Đã gỡ ảnh chi tiết", "success");
                                }}
                                className="absolute inset-0 bg-red-600/90 opacity-0 group-hover/sub:opacity-100 flex items-center justify-center text-white text-[10px] font-bold uppercase transition-opacity cursor-pointer"
                              >
                                Xoá
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 5. SAVE BUTTON & FEEDBACK */}
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <button
                        type="button"
                        onClick={handleSavePhotoEdit}
                        disabled={isSavingPhotoFrame}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#B5945B] via-[#c5a367] to-[#B5945B] hover:brightness-110 active:scale-[0.98] text-zinc-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#B5945B]/25 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isSavingPhotoFrame ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                            <span>Đang lưu khung hình...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Khóa Lưu Khung Hình</span>
                          </>
                        )}
                      </button>

                      {lastSavedPhotoId === inspectedPhoto.id && (
                        <div className="text-center text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 animate-fadeIn">
                          <Check className="w-3.5 h-3.5" />
                          <span>✅ Đã lưu thứ tự & khung hình thành công!</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              };

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* 1. TOP ACTION BAR (ALBUM SELECTOR + QUICK ADD PHOTOS) */}
                  <div className="rounded-3xl p-4 bg-zinc-900/70 backdrop-blur-2xl border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                    {/* Left: Album Selector Dropdown & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#B5945B] shrink-0 flex items-center gap-1.5">
                          <FolderKanban className="w-4 h-4" /> Album:
                        </span>
                        <select
                          value={activeCollectionIdx}
                          onChange={(e) => {
                            const newIdx = Number(e.target.value);
                            setActiveCollectionIdx(newIdx);
                            setSelectedIndex(0);
                            selectPhotoForInspector(0);
                          }}
                          className="bg-zinc-950 text-zinc-100 text-xs font-semibold px-3 py-2 rounded-xl border border-white/10 hover:border-[#B5945B]/50 focus:border-[#B5945B] focus:outline-none transition-all cursor-pointer truncate max-w-xs sm:max-w-sm shadow-inner"
                        >
                          {collections.map((col, idx) => (
                            <option
                              key={`album-select-opt-${col.id}-${idx}`}
                              value={idx}
                              className="bg-zinc-900 text-zinc-100"
                            >
                              {col.title} ({col.images?.length || 0} ảnh)
                            </option>
                          ))}
                        </select>
                        <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-zinc-400 font-mono shrink-0">
                          {activeCollection.images.length} frames
                        </span>
                      </div>

                      {/* Compact Search */}
                      <div className="relative w-full sm:w-48 shrink-0">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Tìm khung hình..."
                          value={quickSearchPhotoQuery}
                          onChange={(e) => setQuickSearchPhotoQuery(e.target.value)}
                          className="w-full pl-8 pr-7 py-2 bg-zinc-950 text-zinc-200 text-xs rounded-xl border border-white/10 focus:border-[#B5945B] focus:outline-none transition-all placeholder:text-zinc-600 shadow-inner"
                        />
                        {quickSearchPhotoQuery && (
                          <button
                            type="button"
                            onClick={() => setQuickSearchPhotoQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right: Quick Add Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <GooglePickerButton
                        mode="images"
                        multiselect={true}
                        size="md"
                        buttonText="📁 + Thêm từ Google Drive"
                        onSelectMultiple={handleQuickAddFromDrive}
                        onSelect={(url) => handleQuickAddFromDrive([url])}
                        className="shadow-md shadow-[#B5945B]/15"
                      />
                      <button
                        type="button"
                        onClick={() => setIsQuickAddModalOpen(true)}
                        className="px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:scale-95 text-[#E5C17C] hover:text-white border border-[#B5945B]/30 hover:border-[#B5945B] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap min-h-[40px] cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#B5945B]" />
                        <span>+ Tải ảnh lên / Dán Link</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. TWO-COLUMN MASTER-DETAIL WORKSPACE */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN: Compact Reorderable Photo List (lg:col-span-7) */}
                    <div className="lg:col-span-7 flex flex-col space-y-3 min-w-0">
                      {/* Sub-header with Count & View Mode Toggle */}
                      <div className="flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                            <LayoutGrid className="w-3.5 h-3.5 text-[#B5945B]" />
                            <span>Danh sách khung hình</span>
                          </span>
                          <span className="text-[11px] font-mono text-zinc-500">
                            ({filteredPhotos.length} / {activeCollection.images.length})
                          </span>
                        </div>

                        {/* View Mode Toggle: List vs Grid */}
                        <div className="flex items-center p-0.5 rounded-xl bg-white/[0.04] border border-white/10">
                          <button
                            type="button"
                            onClick={() => setFramesViewMode("list")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              framesViewMode === "list"
                                ? "bg-[#B5945B] text-zinc-950 font-bold shadow-sm"
                                : "text-zinc-400 hover:text-white"
                            }`}
                            title="Chế độ Danh sách thu gọn"
                          >
                            <List className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Danh sách</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFramesViewMode("grid")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                              framesViewMode === "grid"
                                ? "bg-[#B5945B] text-zinc-950 font-bold shadow-sm"
                                : "text-zinc-400 hover:text-white"
                            }`}
                            title="Chế độ Lưới thu nhỏ"
                          >
                            <Grid className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Lưới</span>
                          </button>
                        </div>
                      </div>

                      {/* Smooth Scrollable Container */}
                      <div className="max-h-[72vh] overflow-y-auto pr-1.5 custom-scrollbar space-y-2">
                        {filteredPhotos.length === 0 ? (
                          <div className="p-10 rounded-2xl bg-zinc-900/40 border border-dashed border-white/10 text-center space-y-3">
                            <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                            <p className="text-zinc-400 text-xs">
                              {quickSearchPhotoQuery
                                ? "Không tìm thấy khung hình nào khớp với từ khóa."
                                : "Album này hiện chưa có khung hình nào."}
                            </p>
                            <div className="flex items-center justify-center gap-2">
                              <GooglePickerButton
                                mode="images"
                                multiselect={true}
                                size="sm"
                                buttonText="📁 Chọn ảnh từ Google Drive"
                                onSelectMultiple={handleQuickAddFromDrive}
                              />
                              <button
                                type="button"
                                onClick={() => setIsQuickAddModalOpen(true)}
                                className="px-3 py-1.5 rounded-xl bg-white/5 text-xs text-zinc-300 hover:text-white border border-white/10"
                              >
                                Dán Link / Tải ảnh lên
                              </button>
                            </div>
                          </div>
                        ) : framesViewMode === "list" ? (
                          /* Compact List View (Height ~72px, rounded-2xl) */
                          filteredPhotos.map(({ img, idx }) => {
                            const isSelected = inspectedIdx === idx;
                            const isAlbumCover =
                              activeCollection.coverImageSrc === img.src ||
                              (!activeCollection.coverImageSrc && idx === 0);

                            return (
                              <div
                                key={`compact-photo-row-${img.src}-${idx}`}
                                draggable
                                onDragStart={() => setDraggedPhotoIdx(idx)}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.add(
                                    "border-[#B5945B]",
                                    "bg-[#B5945B]/10"
                                  );
                                }}
                                onDragLeave={(e) => {
                                  e.currentTarget.classList.remove(
                                    "border-[#B5945B]",
                                    "bg-[#B5945B]/10"
                                  );
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove(
                                    "border-[#B5945B]",
                                    "bg-[#B5945B]/10"
                                  );
                                  if (
                                    draggedPhotoIdx !== null &&
                                    draggedPhotoIdx !== idx
                                  ) {
                                    handleReorderPhoto(draggedPhotoIdx, "drop", idx);
                                  }
                                  setDraggedPhotoIdx(null);
                                }}
                                onClick={() => {
                                  selectPhotoForInspector(idx);
                                  setIsMobileInspectorOpen(true);
                                }}
                                className={`h-[72px] rounded-2xl p-2.5 flex items-center justify-between gap-3 border transition-all cursor-pointer select-none group ${
                                  isSelected
                                    ? "border-[#E5C17C] bg-[#B5945B]/15 shadow-[0_0_20px_rgba(181,148,91,0.2)]"
                                    : "border-white/10 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-white/20"
                                }`}
                              >
                                {/* Left: Drag handle, Index, Thumbnail, Info */}
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {/* Drag Handle */}
                                  <div
                                    className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-[#E5C17C] p-1 rounded transition-colors shrink-0"
                                    title="Kéo thả để đổi thứ tự ảnh"
                                  >
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </div>

                                  {/* Index Badge */}
                                  <span className="w-6 h-6 rounded-lg bg-zinc-950 border border-white/10 text-amber-500 text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                                    #{idx + 1}
                                  </span>

                                  {/* Small Thumbnail Reflecting Crop & Zoom */}
                                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-zinc-950 border border-white/10 relative shrink-0">
                                    <LazyImage
                                      src={img.src}
                                      alt={img.alt || `Khung hình #${idx + 1}`}
                                      preset="thumbnail"
                                      className="w-full h-full object-cover transition-transform"
                                      style={{
                                        objectPosition:
                                          img.imagePosition ||
                                          img.objectPosition ||
                                          "center",
                                        transform: `scale(${img.imageScale || 1.0})`,
                                      }}
                                    />
                                  </div>

                                  {/* Title & Metadata */}
                                  <div className="min-w-0 flex-1 text-left">
                                    <p
                                      className="text-xs font-semibold text-zinc-100 truncate"
                                      title={img.title}
                                    >
                                      {img.title || `Khung hình #${idx + 1}`}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <span className="text-[10px] bg-zinc-800/90 text-zinc-400 px-1.5 py-0.2 rounded border border-white/5 font-mono">
                                        {img.aspectRatio || "16/9"}
                                      </span>
                                      {isAlbumCover && (
                                        <span className="text-[10px] bg-amber-500/20 text-[#E5C17C] border border-[#B5945B]/30 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                                          <Star className="w-2.5 h-2.5 fill-current" /> Bìa
                                        </span>
                                      )}
                                      {img.galleryImages && img.galleryImages.length > 0 && (
                                        <span className="text-[10px] text-zinc-500 font-mono">
                                          +{img.galleryImages.length} chi tiết
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Quick 1-Click Action Buttons */}
                                <div
                                  className="flex items-center gap-1 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Move Up */}
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleReorderPhoto(idx, "up")}
                                    className="w-7 h-7 rounded-lg bg-zinc-800/90 hover:bg-[#B5945B]/20 hover:text-[#E5C17C] disabled:opacity-20 text-zinc-300 border border-white/5 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
                                    title="Di chuyển lên (▲)"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Move Down */}
                                  <button
                                    type="button"
                                    disabled={idx === activeCollection.images.length - 1}
                                    onClick={() => handleReorderPhoto(idx, "down")}
                                    className="w-7 h-7 rounded-lg bg-zinc-800/90 hover:bg-[#B5945B]/20 hover:text-[#E5C17C] disabled:opacity-20 text-zinc-300 border border-white/5 flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
                                    title="Di chuyển xuống (▼)"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Set as Album Cover */}
                                  <button
                                    type="button"
                                    onClick={() => handleSetAsAlbumCover(img)}
                                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                                      isAlbumCover
                                        ? "bg-amber-500/20 text-[#E5C17C] border-[#B5945B]"
                                        : "bg-zinc-800/90 hover:bg-amber-500/20 text-zinc-400 hover:text-[#E5C17C] border-white/5"
                                    }`}
                                    title="Đặt làm ảnh bìa Album (⭐)"
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${
                                        isAlbumCover ? "fill-current" : ""
                                      }`}
                                    />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePhoto(idx)}
                                    className="w-7 h-7 rounded-lg bg-zinc-800/90 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-white/5 flex items-center justify-center transition-all cursor-pointer"
                                    title="Xóa khỏi Album (🗑️)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          /* Thumbnail Grid View */
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {filteredPhotos.map(({ img, idx }) => {
                              const isSelected = inspectedIdx === idx;
                              const isAlbumCover =
                                activeCollection.coverImageSrc === img.src ||
                                (!activeCollection.coverImageSrc && idx === 0);

                              return (
                                <div
                                  key={`grid-photo-card-${img.src}-${idx}`}
                                  onClick={() => {
                                    selectPhotoForInspector(idx);
                                    setIsMobileInspectorOpen(true);
                                  }}
                                  className={`rounded-2xl p-2 bg-zinc-900/60 border transition-all cursor-pointer select-none space-y-2 group ${
                                    isSelected
                                      ? "border-[#E5C17C] bg-[#B5945B]/15 shadow-[0_0_20px_rgba(181,148,91,0.2)]"
                                      : "border-white/10 hover:border-white/20 hover:bg-zinc-800/80"
                                  }`}
                                >
                                  {/* Thumbnail */}
                                  <div className="aspect-[16/10] rounded-xl overflow-hidden bg-zinc-950 border border-white/10 relative">
                                    <LazyImage
                                      src={img.src}
                                      alt={img.alt || `Khung hình #${idx + 1}`}
                                      preset="thumbnail"
                                      className="w-full h-full object-cover transition-transform"
                                      style={{
                                        objectPosition:
                                          img.imagePosition ||
                                          img.objectPosition ||
                                          "center",
                                        transform: `scale(${img.imageScale || 1.0})`,
                                      }}
                                    />
                                    <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-400 border border-white/10">
                                      #{idx + 1}
                                    </span>
                                    {isAlbumCover && (
                                      <span className="absolute top-1.5 right-1.5 bg-amber-500 text-black px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                                        <Star className="w-2.5 h-2.5 fill-current" /> Bìa
                                      </span>
                                    )}
                                  </div>

                                  {/* Title & Quick Actions */}
                                  <div className="flex items-center justify-between gap-1 text-left px-0.5">
                                    <span className="text-[11px] font-semibold text-zinc-200 truncate flex-1">
                                      {img.title || `Ảnh #${idx + 1}`}
                                    </span>
                                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1 py-0.2 rounded">
                                      {img.aspectRatio || "16/9"}
                                    </span>
                                  </div>

                                  {/* Action Buttons */}
                                  <div
                                    className="flex items-center justify-between pt-1 border-t border-white/5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleReorderPhoto(idx, "up")}
                                        className="w-6 h-6 rounded bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-20 flex items-center justify-center text-xs"
                                        title="Lên"
                                      >
                                        <ArrowUp className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === activeCollection.images.length - 1}
                                        onClick={() => handleReorderPhoto(idx, "down")}
                                        className="w-6 h-6 rounded bg-zinc-800 text-zinc-300 hover:text-white disabled:opacity-20 flex items-center justify-center text-xs"
                                        title="Xuống"
                                      >
                                        <ArrowDown className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleSetAsAlbumCover(img)}
                                        className="w-6 h-6 rounded bg-zinc-800 text-amber-400 hover:text-amber-300 flex items-center justify-center text-xs"
                                        title="Đặt làm ảnh bìa"
                                      >
                                        <Star className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePhoto(idx)}
                                        className="w-6 h-6 rounded bg-zinc-800 text-red-400 hover:text-red-300 flex items-center justify-center text-xs"
                                        title="Xóa"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Sticky Frame & Crop Inspector (lg:col-span-5) */}
                    <div className="hidden lg:block lg:col-span-5 sticky top-6">
                      <div className="rounded-3xl bg-zinc-900/80 backdrop-blur-2xl border border-white/10 p-5 shadow-2xl max-h-[82vh] overflow-y-auto custom-scrollbar">
                        {renderInspectorContent(false)}
                      </div>
                    </div>
                  </div>

                  {/* MOBILE INSPECTOR DRAWER / BOTTOM SHEET (< lg) */}
                  {isMobileInspectorOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden bg-black/80 backdrop-blur-md flex flex-col justify-end">
                      <div className="rounded-t-3xl bg-zinc-900/95 border-t border-white/15 p-5 max-h-[88vh] overflow-y-auto custom-scrollbar shadow-2xl animate-slideUp">
                        <div className="w-12 h-1.5 rounded-full bg-zinc-700 mx-auto mb-3" />
                        {renderInspectorContent(true)}
                      </div>
                    </div>
                  )}

                  {/* QUICK ADD PHOTOS MODAL */}
                  {isQuickAddModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                      <div className="w-full max-w-md rounded-3xl bg-zinc-900/95 backdrop-blur-2xl border border-white/15 p-5 sm:p-6 shadow-2xl space-y-4 text-left animate-scaleIn">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#B5945B] block">
                              Thêm ảnh nhanh
                            </span>
                            <h3 className="text-sm font-bold text-white truncate">
                              Album: {activeCollection.title}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsQuickAddModalOpen(false)}
                            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Option 1: Paste Links */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-zinc-200 block">
                            Dán một hoặc nhiều link ảnh (cách nhau bằng dòng mới hoặc dấu phẩy):
                          </label>
                          <textarea
                            rows={3}
                            placeholder="https://images.unsplash.com/...&#10;https://drive.google.com/..."
                            value={quickAddUrlsInput}
                            onChange={(e) => setQuickAddUrlsInput(e.target.value)}
                            className="w-full text-xs bg-zinc-950 text-white p-3 rounded-xl border border-white/10 focus:border-[#B5945B] focus:outline-none placeholder-zinc-600 transition-all font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleQuickAddUrls}
                            className="w-full py-2.5 rounded-xl bg-[#B5945B] hover:bg-[#c5a367] text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Thêm ảnh từ danh sách link</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2 my-1">
                          <div className="flex-1 h-px bg-white/10" />
                          <span className="text-[11px] text-zinc-500 uppercase font-sans">HOẶC</span>
                          <div className="flex-1 h-px bg-white/10" />
                        </div>

                        {/* Option 2: Upload local files with auto-compression */}
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-zinc-200 block">
                            Tải file ảnh trực tiếp từ máy tính (tự động nén WebP):
                          </label>
                          <label className="block p-4 rounded-2xl border border-dashed border-[#B5945B]/40 hover:border-[#B5945B] bg-[#B5945B]/5 hover:bg-[#B5945B]/10 text-center cursor-pointer transition-all">
                            <Upload className="w-6 h-6 text-[#E5C17C] mx-auto mb-1.5" />
                            <span className="text-xs font-semibold text-zinc-200 block">
                              {isUploadingQuickFiles
                                ? "Đang nén và tải ảnh lên..."
                                : "Nhấn để chọn file ảnh JPG, PNG, WEBP..."}
                            </span>
                            <span className="text-[10.5px] text-zinc-500">
                              Hỗ trợ chọn cùng lúc nhiều ảnh
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={isUploadingQuickFiles}
                              onChange={handleQuickAddLocalFiles}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })()}

            {/* TAB CONTENT 5: Manage & Delete Albums */}
            {adminActiveTab === "manage-albums" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 pt-8 mt-4 border-t border-white/5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <div className="flex flex-col gap-1.5 text-left">
                    <span className="block text-xs text-amber-500 font-medium uppercase tracking-wide flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" /> QUẢN LÝ THỨ TỰ & THUỘC
                      TÍNH CÁC ALBUM
                    </span>
                    <p className="text-[11px] text-zinc-400 font-light bg-zinc-800/30 px-2.5 py-1.5 rounded-md inline-block w-fit border border-amber-500/10 flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-amber-500" />
                      Kéo thả{" "}
                      <GripVertical className="w-3 h-3 inline mx-0.5 text-zinc-500" />{" "}
                      để đổi vị trí hiển thị. Xoá album sẽ tự phát đồng bộ.
                    </p>
                  </div>

                  {/* Thanh tìm kiếm nhanh các album */}
                  <div className="relative w-full sm:max-w-xs shrink-0">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={quickSearchAlbumQuery}
                      onChange={(e) => setQuickSearchAlbumQuery(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 bg-zinc-950 text-zinc-200 text-[11px] rounded-lg border border-white/5 focus:border-amber-500 focus:outline-none transition-all placeholder:text-slate-650"
                    />
                    {quickSearchAlbumQuery && (
                      <button
                        onClick={() => setQuickSearchAlbumQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] uppercase font-medium text-zinc-500 hover:text-zinc-300"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
                  {collections
                    .map((col, idx) => ({ col, idx }))
                    .filter(({ col }) => {
                      if (!quickSearchAlbumQuery) return true;
                      return (
                        col.title
                          .toLowerCase()
                          .includes(quickSearchAlbumQuery.toLowerCase()) ||
                        (col.subtitle &&
                          col.subtitle
                            .toLowerCase()
                            .includes(quickSearchAlbumQuery.toLowerCase()))
                      );
                    })
                    .map(({ col, idx }) => {
                      const firstImg = col.coverImageSrc
                        ? resolveImage(col.coverImageSrc)
                        : col.images && col.images[0]?.src
                          ? resolveImage(col.images[0].src)
                          : undefined;
                      const coverPos =
                        col.coverImagePosition ||
                        (col.images && col.images[0]
                          ? col.images[0].imagePosition ||
                            col.images[0].objectPosition ||
                            "center"
                          : "center");
                      return (
                        <div
                          key={`manage-col-${col.id || 'col'}-${idx}`}
                          draggable
                          onDragStart={() => setDraggedAlbumIdx(idx)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            // Show some visual indication
                            e.currentTarget.classList.add(
                              "border-amber-500",
                              "bg-zinc-800/80",
                            );
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove(
                              "border-amber-500",
                              "bg-zinc-800/80",
                            );
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove(
                              "border-amber-500",
                              "bg-zinc-800/80",
                            );
                            if (
                              draggedAlbumIdx !== null &&
                              draggedAlbumIdx !== idx
                            ) {
                              handleReorderAlbum(draggedAlbumIdx, "drop", idx);
                            }
                            setDraggedAlbumIdx(null);
                          }}
                          className={`flex items-center justify-between gap-4 p-3.5 rounded-xl bg-zinc-900/50 border ${draggedAlbumIdx === idx ? "border-amber-500/50 opacity-50" : "border-white/10"} hover:border-white/20 hover:bg-zinc-800/60 transition-all shadow-sm group cursor-move`}
                        >
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="shrink-0 cursor-grab active:cursor-grabbing text-zinc-500 hover:text-amber-400 p-1 bg-zinc-900/50 rounded flex items-center justify-center border border-transparent hover:border-[#B5945B]/30/20 transition-all">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="w-16 h-12 rounded-md overflow-hidden bg-zinc-950 border border-white/10 shrink-0 shadow-inner relative">
                              {firstImg ? (
                                <LazyImage
                                  src={firstImg}
                                  alt={col.title}
                                  preset="thumbnail"
                                  style={{ objectPosition: coverPos }}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                  <FolderOpen className="w-5 h-5 text-zinc-500" />
                                </div>
                              )}
                              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-md pointer-events-none" />
                            </div>
                            <div className="min-w-0 text-left">
                              <h5 className="text-xs font-bold text-zinc-100 truncate uppercase tracking-tight group-hover:text-amber-400 transition-colors">
                                {col.title?.toUpperCase()}
                              </h5>
                              <p className="text-[12px] text-zinc-500 truncate font-light mt-0.5">
                                {col.subtitle || "Không có mô tả phụ"}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="inline-block font-sans text-[11px] bg-zinc-950 text-amber-500 px-2 py-0.5 rounded border border-white/5 shadow-inner leading-none tracking-wide font-bold">
                                  {col.images?.length || 0} ITEMS
                                </span>
                                {col.isHidden ? (
                                  <span className="text-[11px] font-bold bg-rose-500/10 border border-rose-500/35 text-rose-400 px-1.5 py-0.5 rounded shadow-sm font-sans">
                                    ẨN
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-1.5 py-0.5 rounded shadow-sm font-sans">
                                    ĐANG HIỆN
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                updateAlbumMeta(col.id, {
                                  isHidden: !col.isHidden,
                                })
                                  .then(() =>
                                    showToast(
                                      `Đã thay đổi hiển thị album"${col.title}"`,
                                      "success",
                                    ),
                                  )
                                  .catch((err) =>
                                    showToast("Lỗi:" + err.message, "error"),
                                  );
                              }}
                              className={`w-7 h-7 border rounded-md flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                                col.isHidden
                                  ? "bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border-rose-500/30"
                                  : "bg-emerald-500/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border-emerald-500/20"
                              }`}
                              title={
                                col.isHidden
                                  ? "Hiện album này lên trang chính"
                                  : "Ẩn album này khỏi trang chính"
                              }
                            >
                              {col.isHidden ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5 font-bold" />
                              )}
                            </button>
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleReorderAlbum(idx, "up")}
                                className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/5 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-sm hover:text-white"
                                title="Chuyển lên trước"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {idx < collections.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleReorderAlbum(idx, "down")}
                                className="w-7 h-7 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/5 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-sm hover:text-white"
                                title="Chuyển xuống sau"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {albumToDeleteConfirmId === col.id ? (
                              <div className="flex gap-1.5 bg-zinc-950 p-1 rounded-lg border border-white/5 shadow-inner ml-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Perform delete action
                                    softDeleteAlbum(col.id)
                                      .then(() => {
                                        if (
                                          activeCollectionIdx >=
                                          collections.length - 1
                                        ) {
                                          setActiveCollectionIdx(
                                            Math.max(0, collections.length - 2),
                                          );
                                        }
                                        setAlbumToDeleteConfirmId(null);
                                        showToast(
                                          "Xoá Album thành công!",
                                          "success",
                                        );
                                      })
                                      .catch((error) => {
                                        showToast(
                                          "Lỗi khi xoá:" + error.message,
                                          "error",
                                        );
                                      });
                                  }}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[12px] font-bold rounded-md uppercase transition-colors cursor-pointer animate-pulse shadow-md"
                                >
                                  Xác nhận!
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAlbumToDeleteConfirmId(null)
                                  }
                                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[12px] font-bold rounded-md uppercase transition-colors cursor-pointer border border-white/5"
                                >
                                  Huỷ
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (collections.length <= 1) {
                                    showToast(
                                      "Không thể xoá danh mục cuối cùng!",
                                      "error",
                                    );
                                    return;
                                  }
                                  setAlbumToDeleteConfirmId(col.id);
                                }}
                                className="w-7 h-7 ml-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-400 border border-red-500/20 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-sm"
                                title="Xoá vĩnh viễn"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT 4: Settings & Guide guidelines */}
            {adminActiveTab === "settings" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 text-xs text-zinc-300 leading-relaxed font-light"
              >
                {/* MASTER BACKUP & ANTI-DATA-LOSS PANEL */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-950/20 via-zinc-900/60 to-black/80 border border-amber-500/25 shadow-xl space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-[#E5C17C] to-[#B5945B] text-zinc-950 font-bold shadow-md shadow-[#B5945B]/20">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                          <span>Trung Tâm Sao Lưu & Chống Mất Dữ Liệu</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-[#E5C17C] border border-[#B5945B]/30">
                            Master Backup Vault
                          </span>
                        </h4>
                        <p className="text-[11px] text-zinc-400">
                          Bảo vệ toàn vẹn 100% tất cả ảnh, Album Google Drive, ảnh Founder (S7), Intro và Lịch trình Booking
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Buttons row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {/* Nút 1: Tải bản sao lưu toàn bộ dữ liệu (.JSON) */}
                    <button
                      type="button"
                      disabled={isExportingBackup}
                      onClick={handleExportBackup}
                      className="px-4 py-3 rounded-xl bg-[#B5945B]/20 hover:bg-[#B5945B]/30 text-[#E5C17C] border border-[#B5945B]/40 font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      title="Gom toàn bộ dữ liệu thật hiện có từ Firestore và tải xuống file JSON"
                    >
                      {isExportingBackup ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>📥 Tải bản sao lưu toàn bộ (.JSON)</span>
                    </button>

                    {/* Nút 2: Khôi phục dữ liệu từ file sao lưu */}
                    <input
                      type="file"
                      ref={backupFileInputRef}
                      onChange={handleImportBackupFile}
                      accept=".json"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isImportingBackup}
                      onClick={() => backupFileInputRef.current?.click()}
                      className="px-4 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/40 font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      title="Đẩy toàn bộ ảnh, album và lịch trình quay trở lại Cloud Firestore"
                    >
                      {isImportingBackup ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>📤 Khôi phục từ file sao lưu</span>
                    </button>

                    {/* Nút 4: Copy dữ liệu thật làm mặc định (Freeze to Code) */}
                    <button
                      type="button"
                      onClick={handleFreezeToCode}
                      className="px-4 py-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                      title="Xuất ra đoạn code JSON chuẩn để dán thẳng vào src/data/contentData.ts để khóa chết vào mã nguồn"
                    >
                      <Lock className="w-4 h-4" />
                      <span>🔒 Copy dữ liệu thật làm mặc định</span>
                    </button>
                  </div>

                  {/* Progress bar during restore */}
                  {importBackupProgress && (
                    <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs text-blue-200">
                        <span>{importBackupProgress.message}</span>
                        <span className="font-bold">{importBackupProgress.percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-blue-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-[#E5C17C] transition-all duration-300"
                          style={{ width: `${importBackupProgress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 border-b border-white/5 pb-3 pt-2">
                  <span className="block text-xs text-amber-500 font-medium uppercase tracking-wide flex items-center gap-2">
                    📖 HƯỚNG DẪN ĐỒNG BỘ THỜI GIAN THỰC (REALTIME CLOUD SYNC)
                  </span>
                </div>

                <div className="space-y-3 bg-zinc-900/50 p-4 rounded-xl border border-white/5 shadow-inner">
                  <p className="flex gap-2">
                    <span className="text-amber-500 font-bold">1.</span>
                    <span>
                      Mọi nâng cấp, thêm mới, sửa đổi hay xóa Album trên giao
                      diện quản trị này sẽ được ghi nhận và lưu trữ tức thì lên
                      cơ sở dữ liệu lưu trữ đám mây{""}
                      <strong className="text-white font-bold bg-white/10 px-1 rounded">
                        Firebase Firestore
                      </strong>
                      .
                    </span>
                  </p>
                  <p className="flex gap-2">
                    <span className="text-amber-500 font-bold">2.</span>
                    <span>
                      Khách hàng truy cập trang web bằng bất kỳ thiết bị nào
                      (điện thoại, máy tính bảng, máy tính) đều sẽ thấy các cải
                      tiến này hiển thị đồng thời mà hoàn toàn không cần nhấp
                      lệnh refresh hoặc làm mới trang.
                    </span>
                  </p>
                  <p className="flex gap-2">
                    <span className="text-amber-500 font-bold">3.</span>
                    <span>
                      <strong className="text-amber-400 font-bold">
                        Mẹo thêm ảnh:
                      </strong>
                      {""}
                      Bạn có thể dùng bất cứ link ảnh trực tiếp nào của Unsplash
                      (vd:{""}
                      <code className="text-amber-200/80 font-sans bg-zinc-950 px-1 py-0.5 rounded text-[12px] break-all border border-white/5 shadow-inner">
                      </code>
                      ) hoặc liên kết ảnh thô từ máy chủ của bạn để hiển thị
                      hình tức thì với độ nét chuẩn cao nhất.
                    </span>
                  </p>
                </div>

                <div className="bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 p-4 rounded-xl mt-4 flex items-start gap-3 text-[11px] text-amber-100/70 shadow-sm flex-col md:flex-row md:items-center justify-between">
                  <div className="flex gap-3">
                    <div className="bg-amber-500/20 p-1.5 rounded-lg shrink-0 border border-[#B5945B]/10 h-fit">
                      <Info className="w-4 h-4 text-amber-400" />
                    </div>
                    <span className="pt-0.5">
                      Cần đặt lại bộ nhớ từ đầu của ứng dụng? Có thể dùng nút
                      khôi phục cài đặt gốc bên cạnh.
                    </span>
                  </div>
                  <button
                    onClick={resetToFactoryDefaults}
                    className="shrink-0 px-4 py-2 mt-2 md:mt-0 text-[12px] font-sans font-medium uppercase bg-red-900/50 hover:bg-red-800 text-red-100 border border-red-500/50 hover:border-red-400 rounded-lg transition-all cursor-pointer flex items-center gap-2 shadow-lg"
                  >
                    <Trash2 className="w-4 h-4" /> KHÔI PHỤC DỮ LIỆU GỐC (NGUY
                    HIỂM)
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB CONTENT: Google Drive */}
            {adminActiveTab === "google-drive" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex flex-col gap-1.5 border-b border-white/5 pb-3">
                  <span className="block text-xs text-emerald-500 font-medium uppercase tracking-wide flex items-center gap-2">
                    ☁️ TÍCH HỢP GOOGLE DRIVE
                  </span>
                </div>
                <React.Suspense
                  fallback={
                    <div className="p-4 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                    </div>
                  }
                >
                  <GoogleDrivePicker onSelectUrls={handleDriveImportToActive} />
                </React.Suspense>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PASSWORD AUTH MODAL DIALOG --- */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 text-white p-6 rounded-lg shadow-lg max-w-sm w-full text-left relative"
          >
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordError("");
                setEmailInput("");
                setPasswordInput("");
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-5 h-5 text-amber-500" />
              <h4 className="font-sans font-medium text-lg text-white capitalize">
                XÁC THỰC QUẢN TRỊ VIÊN
              </h4>
            </div>

            <p className="text-xs text-gray-300 mb-4 leading-relaxed font-normal">
              Vui lòng cung cấp tài khoản quản trị để truy cập các tính năng
              quản lý, thêm ảnh và chỉnh sửa album nghệ thuật.
            </p>

            <form onSubmit={handleAdminAuth} className="space-y-4">
              {passwordError && (
                <p className="text-xs text-red-400 font-medium">
                  ⚠️ {passwordError}
                </p>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-gray-200 text-black font-bold text-xs uppercase tracking-wide rounded cursor-pointer transition-colors"
                >
                  <svg
                    width="18"
                    height="18"
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
                  Đăng Nhập bằng Google
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordError("");
                  }}
                  className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wide rounded cursor-pointer"
                >
                  Huỷ bỏ
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- GUEST PERSPECTIVE IMMERSIVE LIGHTBOX OVERLAY --- */}
      <AnimatePresence>
        {isLightboxOpen &&
          activeCollection &&
          activeWorkSubPhotos.length > 0 && (
            <motion.div
              key="portfolio-lightbox-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 h-[100dvh] w-screen bg-black/92 backdrop-blur-3xl z-[9999] flex flex-col overflow-hidden select-none"
              onClick={() => setShowUIOverlay((prev) => !prev)}
            >
              {/* Top Minimalist Overlay Bar */}
              <div
                style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
                className={`absolute top-0 inset-x-0 h-16 sm:h-20 flex items-center justify-between px-3 sm:px-8 z-[70] bg-gradient-to-b from-black/95 via-black/80 to-transparent transition-opacity duration-300 pointer-events-auto ${
                  showUIOverlay
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                {/* Left: Back / Title & Count */}
                <div
                  className="flex items-center gap-2 sm:gap-3 min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setIsLightboxOpen(false)}
                    className="p-2 -ml-1 rounded-full bg-white/10 hover:bg-white/20 text-white active:scale-95 transition-all cursor-pointer"
                    title="Đóng xem ảnh"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-xs sm:text-sm tracking-wider text-[#B5945B] font-bold uppercase truncate max-w-[140px] sm:max-w-xs">
                        {activeCollection.title}
                      </span>
                      {activePhotoAspect && (
                        <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium bg-[#B5945B]/20 text-[#E5C17C] border border-[#B5945B]/35 shrink-0">
                          <Sparkles className="w-2.5 h-2.5 text-[#B5945B]" />
                          <span>{activePhotoAspect}</span>
                          {activePhotoDimensions && (
                            <span className="text-white/60">({activePhotoDimensions.width}×{activePhotoDimensions.height})</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-sans">
                      <span>Ảnh {selectedIndex + 1} / {activeWorkSubPhotos.length}</span>
                      <span className="text-white/30 hidden min-[480px]:inline">•</span>
                      <span className="text-emerald-400/90 font-medium hidden min-[480px]:inline">Độ nét gốc 4K</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div
                  className="flex items-center gap-1.5 sm:gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* True Fullscreen Toggle Button */}
                  <button
                    type="button"
                    onClick={toggleBrowserFullscreen}
                    className={`p-2 rounded-full transition-all cursor-pointer ${
                      isBrowserFullscreen
                        ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/30"
                        : "bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white"
                    }`}
                    title={isBrowserFullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình (Full Screen)"}
                  >
                    {isBrowserFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>

                  {/* Aspect Ratio Fit Mode Toggle (Vừa màn hình chuẩn tỉ lệ gốc vs Tràn màn hình) */}
                  <button
                    type="button"
                    onClick={() => setLightboxFitMode((prev) => (prev === "contain" ? "cover" : "contain"))}
                    className={`p-2 rounded-full transition-all cursor-pointer ${
                      lightboxFitMode === "cover"
                        ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/30"
                        : "bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white"
                    }`}
                    title={
                      lightboxFitMode === "contain"
                        ? "Chế độ hiện tại: Vừa màn hình (Chuẩn tỉ lệ ảnh gốc 100%). Bấm để chuyển sang Tràn màn hình."
                        : "Chế độ hiện tại: Tràn màn hình. Bấm để về chuẩn tỉ lệ ảnh gốc."
                    }
                  >
                    {lightboxFitMode === "contain" ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>

                  {/* Slideshow Button */}
                  <button
                    type="button"
                    onClick={() => setIsSlideshowActive((prev) => !prev)}
                    className={`p-2 rounded-full transition-all cursor-pointer ${
                      isSlideshowActive
                        ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/30"
                        : "bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white"
                    }`}
                    title={isSlideshowActive ? "Dừng trình chiếu" : "Bật trình chiếu tự động (Slideshow)"}
                  >
                    {isSlideshowActive ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>

                  {/* Floating Admin quick edit actions */}
                  {isAdminMode && (
                    <button
                      onClick={() => {
                        const photoToDelete =
                          activeWorkSubPhotos[selectedIndex];
                        if (!photoToDelete) return;
                        setConfirmDialogState({
                          isOpen: true,
                          title: "Xoá tác phẩm",
                          message:
                            "Bạn có chắc chắn muốn xoá tác phẩm này khỏi album?",
                          onConfirm: () => {
                            const original = photoToDelete.originalPhoto;
                            if (photoToDelete.src === original.src) {
                              const photoIdx =
                                activeCollection.images.findIndex(
                                  (p) => p.id === original.id,
                                );
                              if (photoIdx !== -1) {
                                handleDeletePhoto(photoIdx, true);
                                setIsLightboxOpen(false);
                              }
                            } else {
                              const newGallery = (
                                original.galleryImages || []
                              ).filter((u) => u !== photoToDelete.src);
                              updatePhoto(activeCollection.id, original.id!, {
                                galleryImages: newGallery,
                              }).then(() => {
                                showToast(
                                  "Đã xoá ảnh chi tiết thành công!",
                                  "success",
                                );
                                setSelectedIndex((prev) =>
                                  Math.max(0, prev - 1),
                                );
                              });
                            }
                          },
                        });
                      }}
                      className="p-2 rounded-full bg-red-600/20 hover:bg-red-600/90 text-red-400 hover:text-white border border-red-500/20 transition-all cursor-pointer"
                      title="Xoá tác phẩm này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Zoom Controls Pill (Desktop/Tablet) */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="hidden sm:flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-full px-2 py-1 border border-white/10"
                  >
                    <button
                      onClick={() => {
                        const newScale = Math.max(1, zoomScale - 0.5);
                        setZoomScale(newScale);
                        if (newScale === 1) setZoomTranslate({ x: 0, y: 0 });
                      }}
                      disabled={zoomScale <= 1}
                      className="p-1.5 rounded-full hover:bg-white/15 text-white/80 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
                      title="Thu nhỏ"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-sans font-medium text-white/90 px-1 min-w-[2.4rem] text-center select-none">
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      onClick={() => {
                        const newScale = Math.min(3.5, zoomScale + 0.5);
                        setZoomScale(newScale);
                      }}
                      disabled={zoomScale >= 3.5}
                      className="p-1.5 rounded-full hover:bg-white/15 text-white/80 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
                      title="Phóng to"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    {zoomScale > 1 && (
                      <button
                        onClick={() => {
                          setZoomScale(1);
                          setZoomTranslate({ x: 0, y: 0 });
                        }}
                        className="p-1.5 rounded-full hover:bg-white/15 text-amber-400 hover:text-amber-300 transition-all cursor-pointer ml-0.5"
                        title="Đặt lại zoom (100%)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setIsLightboxOpen(false)}
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 active:scale-95 transition-all cursor-pointer"
                    title="Đóng (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Immersive Central Photo Canvas */}
              <div
                className="flex-1 w-full h-full flex items-center justify-center relative overflow-hidden"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  if (x < rect.width * 0.25) {
                    goToPrevPhoto();
                  } else if (x > rect.width * 0.75) {
                    goToNextPhoto();
                  } else {
                    setShowUIOverlay(!showUIOverlay);
                  }
                }}
              >
                {/* Ambient Soft Glow Backdrop - Stable, Single GPU Compositor Layer */}
                <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0">
                  {activeWorkSubPhotos[selectedIndex] && (
                    <img
                      key={`ambient-backdrop-${activeWorkSubPhotos[selectedIndex]?.src}`}
                      src={resolveImage(activeWorkSubPhotos[selectedIndex]?.src) || ""}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      decoding="async"
                      className="w-full h-full object-cover filter blur-2xl scale-110 opacity-20 transition-opacity duration-500 ease-out transform-gpu will-change-[opacity]"
                    />
                  )}
                </div>

                {/* Discrete Left Arrow for Desktop & Tablet */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevPhoto();
                  }}
                  className={`hidden sm:flex absolute left-3 sm:left-6 p-2.5 sm:p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white active:scale-90 transition-all z-[65] cursor-pointer ${
                    showUIOverlay
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none"
                  }`}
                  title="Ảnh trước"
                  aria-label="Ảnh trước"
                >
                  <ChevronLeft className="w-5 h-5 text-white/90" />
                </button>

                <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
                  <motion.div
                    key={`lightbox-photo-${activeCollection.id}-${selectedIndex}`}
                    custom={slideDirection}
                    variants={{
                      enter: (dir: number) => ({
                        opacity: 0,
                        x: dir > 0 ? 36 : -36,
                        scale: 0.985,
                      }),
                      center: {
                        opacity: 1,
                        x: 0,
                        scale: 1,
                        transition: {
                          x: { type: "spring", stiffness: 360, damping: 32 },
                          opacity: { duration: 0.22, ease: "easeOut" },
                          scale: { duration: 0.22, ease: "easeOut" },
                        },
                      },
                      exit: (dir: number) => ({
                        opacity: 0,
                        x: dir > 0 ? -36 : 36,
                        scale: 0.985,
                        transition: {
                          duration: 0.18,
                          ease: "easeIn",
                        },
                      }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    style={{
                      paddingTop: showUIOverlay
                        ? "max(env(safe-area-inset-top, 0px), 3.25rem)"
                        : "max(env(safe-area-inset-top, 0px), 0px)",
                      paddingBottom: showUIOverlay
                        ? "max(env(safe-area-inset-bottom, 0px), 4.75rem)"
                        : "max(env(safe-area-inset-bottom, 0px), 0px)",
                      paddingLeft: "env(safe-area-inset-left, 0px)",
                      paddingRight: "env(safe-area-inset-right, 0px)",
                    }}
                    className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none transform-gpu will-change-transform"
                  >
                    {(() => {
                      const originalSrc = resolveImage(activeWorkSubPhotos[selectedIndex].src) || "";
                      const { highResSrc, highResFallbackSrc } = buildLightboxSources(originalSrc);
                      const displayHighRes = highResSrc || highResFallbackSrc || originalSrc;
                      return (
                        <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center pointer-events-auto overflow-hidden">
                          <motion.img
                            src={displayHighRes}
                            alt={activeWorkSubPhotos[selectedIndex].alt}
                            referrerPolicy="no-referrer"
                            loading="eager"
                            fetchPriority="high"
                            decoding="async"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (originalSrc && target.src !== originalSrc) {
                                target.src = originalSrc;
                                return;
                              }
                              const match = originalSrc.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
                                            originalSrc.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                              if (match && match[1]) {
                                target.src = `/api/proxy-image?id=${match[1]}&w=0`;
                              }
                            }}
                            drag={true}
                            dragConstraints={
                              zoomScale > 1
                                ? {
                                    left: -((typeof window !== "undefined" ? window.innerWidth : 800) * 0.5) * (zoomScale - 1),
                                    right: ((typeof window !== "undefined" ? window.innerWidth : 800) * 0.5) * (zoomScale - 1),
                                    top: -((typeof window !== "undefined" ? window.innerHeight : 600) * 0.5) * (zoomScale - 1),
                                    bottom: ((typeof window !== "undefined" ? window.innerHeight : 600) * 0.5) * (zoomScale - 1),
                                  }
                                : {
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                  }
                            }
                            dragElastic={zoomScale > 1 ? 0.05 : 0.4}
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              if (img.naturalWidth && img.naturalHeight) {
                                const ratio = img.naturalWidth / img.naturalHeight;
                                let label = "";
                                if (ratio >= 2.0) label = "19:9 • Siêu rộng";
                                else if (ratio >= 1.6) label = "16:9 • Ngang chuẩn";
                                else if (ratio >= 1.4) label = "3:2 • Chuẩn máy ảnh";
                                else if (ratio >= 1.2) label = "4:3 • Tiêu chuẩn";
                                else if (ratio >= 0.95 && ratio <= 1.05) label = "1:1 • Vuông";
                                else if (ratio <= 0.6) label = "9:16 • Dọc Story/Reels";
                                else if (ratio < 0.95) label = "3:4 • Dọc chân dung";
                                else label = `${img.naturalWidth}×${img.naturalHeight}`;
                                setActivePhotoAspect(label);
                              }
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (zoomScale > 1) {
                                setZoomScale(1);
                                setZoomTranslate({ x: 0, y: 0 });
                              } else {
                                setZoomScale(2.5);
                              }
                            }}
                            onWheel={(e) => {
                              e.stopPropagation();
                              const delta = e.deltaY < 0 ? 0.25 : -0.25;
                              const newScale = Math.min(Math.max(1, zoomScale + delta), 3.5);
                              setZoomScale(newScale);
                              if (newScale === 1) setZoomTranslate({ x: 0, y: 0 });
                            }}
                            onTouchStart={(e) => {
                              if (e.touches.length === 2) {
                                const dist = Math.hypot(
                                  e.touches[0].clientX - e.touches[1].clientX,
                                  e.touches[0].clientY - e.touches[1].clientY
                                );
                                touchStartDistRef.current = dist;
                                touchStartScaleRef.current = zoomScale;
                              } else if (e.touches.length === 1) {
                                const now = Date.now();
                                if (now - lastTapTimeRef.current < 300) {
                                  e.preventDefault();
                                  const nextScale = zoomScale > 1 ? 1 : 2.5;
                                  setZoomScale(nextScale);
                                  if (nextScale === 1) setZoomTranslate({ x: 0, y: 0 });
                                  lastTapTimeRef.current = 0;
                                } else {
                                  lastTapTimeRef.current = now;
                                }
                              }
                            }}
                            onTouchMove={(e) => {
                              if (e.touches.length === 2 && touchStartDistRef.current !== null) {
                                const dist = Math.hypot(
                                  e.touches[0].clientX - e.touches[1].clientX,
                                  e.touches[0].clientY - e.touches[1].clientY
                                );
                                const factor = dist / touchStartDistRef.current;
                                const nextScale = Math.min(Math.max(1, touchStartScaleRef.current * factor), 3.5);
                                setZoomScale(nextScale);
                              }
                            }}
                            onTouchEnd={() => {
                              touchStartDistRef.current = null;
                              if (zoomScale < 1.05) {
                                setZoomScale(1);
                                setZoomTranslate({ x: 0, y: 0 });
                              }
                            }}
                            onDragEnd={(e, info) => {
                              if (zoomScale > 1) {
                                setZoomTranslate((prev) => ({
                                  x: prev.x + info.offset.x,
                                  y: prev.y + info.offset.y,
                                }));
                                return;
                              }
                              const thresholdX = 40;
                              const thresholdY = 70;
                              const swipeX =
                                Math.abs(info.offset.x) > thresholdX ||
                                Math.abs(info.velocity.x) > 400;
                              const swipeY =
                                Math.abs(info.offset.y) > thresholdY ||
                                Math.abs(info.velocity.y) > 700;

                              // Y takes precedence if stronger
                              if (
                                swipeY &&
                                Math.abs(info.offset.y) > Math.abs(info.offset.x)
                              ) {
                                setIsLightboxOpen(false);
                                return;
                              }
                              // Horizontal swipe across album
                              if (swipeX) {
                                if (info.offset.x < 0) {
                                  goToNextPhoto();
                                } else {
                                  goToPrevPhoto();
                                }
                              }
                            }}
                            style={{
                              width: "100%",
                              height: "100%",
                              maxWidth: "100%",
                              maxHeight: "100%",
                              objectFit: lightboxFitMode,
                              imageRendering: "auto",
                              transform: `scale(${zoomScale}) translate(${zoomTranslate.x / zoomScale}px, ${zoomTranslate.y / zoomScale}px)`,
                              transition: zoomScale === 1 ? "none" : (touchStartDistRef.current ? "none" : "transform 0.15s ease-out"),
                            }}
                            className={`w-full h-full select-none shadow-2xl rounded-none sm:rounded-sm transform-gpu ${
                              lightboxFitMode === "cover" ? "object-cover" : "object-contain"
                            } ${
                              zoomScale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
                            }`}
                          />
                        </div>
                      );
                    })()}
                  </motion.div>
                </AnimatePresence>

                {/* Discrete Right Arrow for Desktop & Tablet */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNextPhoto();
                  }}
                  className={`hidden sm:flex absolute right-3 sm:right-6 p-2.5 sm:p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white active:scale-90 transition-all z-[65] cursor-pointer ${
                    showUIOverlay
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none"
                  }`}
                  title="Ảnh tiếp theo"
                  aria-label="Ảnh tiếp theo"
                >
                  <ChevronRight className="w-5 h-5 text-white/90" />
                </button>
              </div>

              {/* Minimal Luxury Float-Pill Caption Info */}
              {showUIOverlay && activeWorkSubPhotos[selectedIndex] && (
                <div className="absolute bottom-[68px] sm:bottom-24 inset-x-0 flex justify-center text-center pointer-events-none select-none z-[60] animate-fadeIn px-2 sm:px-3">
                  <div className="px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-black/75 backdrop-blur-md max-w-[95%] sm:max-w-xl shadow-lg border border-white/15 flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                      <p className="font-sans font-semibold text-[11px] sm:text-sm capitalize tracking-wide text-[#B5945B] truncate">
                        {activeWorkSubPhotos[selectedIndex].title}
                      </p>
                      {activeWorkSubPhotos[selectedIndex].desc && (
                        <>
                          <span className="text-white/30 hidden sm:inline">•</span>
                          <p className="text-[10px] sm:text-xs text-zinc-300 font-light truncate hidden sm:inline">
                            {activeWorkSubPhotos[selectedIndex].desc}
                          </p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pointer-events-auto">
                      {activePhotoAspect && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-medium bg-[#B5945B]/20 text-[#E5C17C] border border-[#B5945B]/30 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-[#B5945B]" />
                          <span>{activePhotoAspect}</span>
                          {activePhotoDimensions && (
                            <span className="text-white/60 hidden min-[540px]:inline">
                              ({activePhotoDimensions.width}×{activePhotoDimensions.height})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Premium Thumbnail Strip */}
              <div
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
                className={`absolute bottom-2 sm:bottom-6 inset-x-0 z-[60] flex justify-center transition-all duration-300 pointer-events-auto px-2 ${
                  showUIOverlay
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4 pointer-events-none"
                }`}
              >
                <div className="w-full max-w-[96%] sm:max-w-xl liquid-glass-dock border border-white/15 rounded-2xl sm:rounded-full px-3 py-2 shadow-2xl flex items-center justify-between gap-2">
                  {/* Autoplay Slideshow Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSlideshowActive((prev) => !prev);
                    }}
                    className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                      isSlideshowActive
                        ? "bg-[#B5945B] text-black shadow-md shadow-[#B5945B]/30"
                        : "bg-white/10 hover:bg-white/20 text-zinc-200"
                    }`}
                    title={isSlideshowActive ? "Dừng chiếu tự động" : "Tự động phát trình chiếu (Slideshow)"}
                  >
                    {isSlideshowActive ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Dừng</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span className="hidden sm:inline">Tự động</span>
                      </>
                    )}
                  </button>

                  {/* Scrollable Thumbnails of all photos in the album */}
                  <div
                    ref={thumbnailContainerRef}
                    className="flex items-center gap-2 overflow-x-auto hide-scrollbar scroll-smooth flex-1 px-1 py-0.5"
                  >
                    {activeWorkSubPhotos.map((sub, idx) => {
                      const isCurrent = selectedIndex === idx;
                      const rawThumbnailSrc = resolveImage(sub.src) || sub.src;
                      return (
                        <div
                          key={`sub-photo-${sub.src || idx}-${idx}`}
                          ref={isCurrent ? activeThumbnailRef : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSlideDirection(idx >= selectedIndex ? 1 : -1);
                            setSelectedIndex(idx);
                          }}
                          className={`shrink-0 transition-all cursor-pointer rounded-lg sm:rounded-xl overflow-hidden ${
                            isCurrent
                              ? "ring-2 ring-[#B5945B] scale-110 shadow-lg"
                              : "opacity-40 hover:opacity-90 hover:scale-105"
                          }`}
                        >
                          <img
                            src={rawThumbnailSrc}
                            alt={sub.alt || ""}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              const match = rawThumbnailSrc.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/) ||
                                            rawThumbnailSrc.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                              if (match && match[1]) {
                                e.currentTarget.src = `/api/proxy-image?id=${match[1]}&w=160`;
                              }
                            }}
                            className="w-9 h-9 sm:w-11 sm:h-11 object-cover"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Counter Badge */}
                  <span className="text-[11px] sm:text-xs text-zinc-300 font-semibold px-2.5 py-1 bg-white/5 rounded-full shrink-0 select-none">
                    {selectedIndex + 1}/{activeWorkSubPhotos.length}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} />
      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        title={confirmDialogState.title}
        message={confirmDialogState.message}
        onConfirm={confirmDialogState.onConfirm}
        onCancel={() => setConfirmDialogState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Freeze to Code Modal */}
      {freezeCodeModal.isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-[#121216] border border-white/15 shadow-2xl text-white overflow-hidden font-sans">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>Đóng Băng Dữ Liệu Vào Mã Nguồn (Freeze to Code)</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Dán đoạn code dưới đây vào file <code className="text-emerald-300 bg-white/5 px-1 py-0.5 rounded">src/data/contentData.ts</code> để khóa chết vào mã nguồn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFreezeCodeModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Code Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Mã nguồn hoàn chỉnh sẵn sàng sao chép:</span>
                <span className="text-emerald-400 font-semibold">
                  {freezeCodeModal.isCopied ? "✓ Đã sao chép vào bộ nhớ tạm!" : ""}
                </span>
              </div>
              <pre className="max-h-[55vh] overflow-auto p-4 bg-black/80 font-mono text-[11px] sm:text-xs text-amber-200/90 rounded-2xl border border-white/10 select-all whitespace-pre leading-relaxed">
                {freezeCodeModal.code}
              </pre>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/10 bg-black/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([freezeCodeModal.code], { type: "text/typescript;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "contentData.ts";
                  a.click();
                  URL.revokeObjectURL(a.href);
                  showToast("Đã tải file contentData.ts về máy!", "success");
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Tải file contentData.ts</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(freezeCodeModal.code);
                      setFreezeCodeModal((prev) => ({ ...prev, isCopied: true }));
                      showToast("Đã sao chép vào bộ nhớ tạm!", "success");
                    } catch (_) {}
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#DFB779] via-[#F4E1B5] to-[#DFB779] text-black font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>{freezeCodeModal.isCopied ? "Đã Sao Chép!" : "Sao Chép Toàn Bộ Code"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioShowcase;
