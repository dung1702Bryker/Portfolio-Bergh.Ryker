import React, { useState, useEffect, useMemo } from "react";
import {
  Heart,
  Star,
  MessageSquare,
  Lock,
  Unlock,
  Share2,
  Download,
  Filter,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  HardDrive,
  FileText,
  AlertCircle,
  Copy,
  Send,
  Eye,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  User,
  Calendar,
  Layers,
  Camera,
  Settings,
  List,
  Printer,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Info,
  Clock,
  HelpCircle,
  Bell,
  Moon,
  Sun,
  Users,
  Globe,
  ArrowUpDown,
  MoreVertical,
  CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ProofingAlbum,
  ProofingPhoto,
  ProofingPhotoComment,
  PipelineStage,
  subscribeSingleProofingAlbum,
  updateProofingAlbum,
  submitClientProofingSelection,
  extractBaseName,
  parseDriveFolderId,
  fetchDriveFolderImages,
} from "../services/proofingService";
import { Helmet } from "react-helmet-async";
import { LocalFileFilterModal } from "./LocalFileFilterModal";
import { ShareProofingModal } from "./ShareProofingModal";
import { ProofingImage, preloadLightboxImages } from "./ProofingImage";
import { GooglePickerButton } from "./GooglePickerButton";
import { safeLocalStorage } from "../utils/safeStorage";
import { getPublicBookingBaseUrl, getPublicUrl, OFFICIAL_PUBLIC_DOMAIN } from "../utils/bookingQr";
import { db } from "../firebase";
import { collection, doc, updateDoc, query, where, getDocs, onSnapshot } from "firebase/firestore";

/**
 * Cập nhật động thẻ Open Graph (OG) và Twitter Cards trong <head>
 * Cho xem trước preview card sắc nét và chuẩn xác trên Zalo, Messenger, Facebook
 */
export function updateOpenGraphTags(album: {
  title: string;
  clientName?: string;
  coverUrl?: string;
  coverPhotoUrl?: string;
  coverImageFileId?: string;
  slug?: string;
  id?: string;
  photos?: Array<{ id?: string; driveFileId?: string; url?: string; thumbnailUrl?: string; hdUrl?: string }>;
}) {
  if (typeof document === "undefined") return;

  // 1. Tiêu đề trang & Preview Card Title
  const pageTitle = `${album.title || "Album Chọn Ảnh"} - ${album.clientName || "Khách Hàng"} | Bergh.Ryker Studio`;
  document.title = pageTitle;

  // 2. Ảnh hiển thị trên Preview Card (Ưu tiên ảnh bìa album coverUrl, nếu thiếu thì fallback lấy ảnh đầu tiên trong mảng photos, hoặc Logo Studio)
  let previewImage = album.coverUrl || album.coverPhotoUrl;
  if (!previewImage && album.coverImageFileId) {
    previewImage = `https://drive.google.com/thumbnail?id=${album.coverImageFileId}&sz=w1200`;
  }
  // Fallback to the album's first photo if coverUrl is missing
  if (!previewImage && album.photos && album.photos.length > 0) {
    const validPhoto =
      album.photos.find((p) => {
        const fId =
          p.driveFileId ||
          (p.id && !p.id.startsWith("photo_") && !p.id.startsWith("blob:") ? p.id : "");
        return Boolean(
          fId ||
            (p.thumbnailUrl && p.thumbnailUrl.startsWith("http")) ||
            (p.url && p.url.startsWith("http")) ||
            (p.hdUrl && p.hdUrl.startsWith("http"))
        );
      }) || album.photos[0];

    if (validPhoto) {
      const fileId =
        validPhoto.driveFileId ||
        (validPhoto.id && !validPhoto.id.startsWith("photo_") && !validPhoto.id.startsWith("blob:")
          ? validPhoto.id
          : "");
      if (fileId) {
        previewImage = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
      } else if (validPhoto.thumbnailUrl && validPhoto.thumbnailUrl.startsWith("http")) {
        previewImage = validPhoto.thumbnailUrl;
      } else if (validPhoto.url && validPhoto.url.startsWith("http")) {
        previewImage = validPhoto.url;
      } else if (validPhoto.hdUrl && validPhoto.hdUrl.startsWith("http")) {
        previewImage = validPhoto.hdUrl;
      }
    }
  }

  // Fallback chuẩn nếu không tìm thấy ảnh (sử dụng ảnh OG chính thức của Studio trên domain public qua getPublicUrl)
  if (!previewImage) {
    previewImage = getPublicUrl("/og-image-square-white.png");
  } else if (previewImage.startsWith("/") || (!previewImage.startsWith("http://") && !previewImage.startsWith("https://"))) {
    previewImage = getPublicUrl(previewImage);
  } else if (
    previewImage.includes("usercontent.goog") ||
    previewImage.includes("aistudio.google.com") ||
    previewImage.includes("ais-dev-")
  ) {
    previewImage = getPublicUrl(previewImage);
  }

  const descriptionText = `Trang chọn ảnh & duyệt hậu kỳ chính thức của ${album.clientName || "Khách hàng"} - Bergh.Ryker Studio. Bấm để xem và chọn ảnh yêu thích!`;

  // Hàm helper cập nhật hoặc tạo mới thẻ meta
  const setMetaTag = (property: string, content: string, isName = false) => {
    const attr = isName ? "name" : "property";
    let tag = document.querySelector(`meta[${attr}="${property}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, property);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  };

  // Tạo URL công khai chính thức cho og:url qua getPublicUrl (Sử dụng domain public production, không bao giờ dùng proxy dev / usercontent.goog)
  const albumIdentifier = album.slug || album.id || "";
  const canonicalPublicUrl = albumIdentifier
    ? getPublicUrl(`?proofing=${encodeURIComponent(albumIdentifier)}`)
    : getPublicUrl("");

  // Cập nhật chuẩn Open Graph (cho Zalo, Facebook, Messenger)
  setMetaTag("og:title", pageTitle);
  setMetaTag("og:description", descriptionText);
  setMetaTag("og:image", previewImage);
  setMetaTag("og:image:secure_url", previewImage);
  setMetaTag("og:url", canonicalPublicUrl);
  setMetaTag("og:type", "website");
  setMetaTag("og:site_name", "BERGH.RYKER STUDIO");

  // Cập nhật chuẩn Twitter Card
  setMetaTag("twitter:card", "summary_large_image", true);
  setMetaTag("twitter:title", pageTitle, true);
  setMetaTag("twitter:description", descriptionText, true);
  setMetaTag("twitter:image", previewImage, true);
}

interface ProofingGalleryViewProps {
  albumSlugOrId: string;
  onNavigateHome: () => void;
  isAdmin?: boolean;
}

export const ProofingGalleryView: React.FC<ProofingGalleryViewProps> = ({
  albumSlugOrId,
  onNavigateHome,
  isAdmin = false,
}) => {
  const [album, setAlbum] = useState<ProofingAlbum | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Phát hiện trình duyệt nhúng iOS (Zalo, Messenger, Facebook)
  const [showInAppBrowserBanner, setShowInAppBrowserBanner] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined" && window.navigator) {
        const ua = window.navigator.userAgent || "";
        const isIOS =
          /iPad|iPhone|iPod/.test(ua) ||
          (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const isInApp = /Zalo|FBAN|FBAV|Messenger|Line|Instagram/i.test(ua);
        return isIOS && isInApp;
      }
    } catch (_) {}
    return false;
  });

  // Theme Mode: 100% Dark Luxury Bergh.Ryker
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  useEffect(() => {
    try {
      safeLocalStorage.setItem("shotpik_theme_single", "dark");
    } catch (_) {}
  }, []);

  const toggleTheme = () => {
    // Theme locked to Dark Luxury for brand consistency
    showToast("Phân hệ Proofing chuẩn mực Dark Luxury của Bergh.Ryker Studio");
  };

  // Password Protection state
  const [passwordInput, setPasswordInput] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  // Filter & Search states
  const [activeFilter, setActiveFilter] = useState<"all" | "favorites" | "starred" | "comments">("all");
  const [photoViewTab, setPhotoViewTab] = useState<"all" | "raw">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "favorites" | "starred" | "comments">("name-asc");
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Modals & Panels
  const [activePhotoForComments, setActivePhotoForComments] = useState<ProofingPhoto | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState<number | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isListViewModalOpen, setIsListViewModalOpen] = useState(false);
  const [isFaceRecognitionModalOpen, setIsFaceRecognitionModalOpen] = useState(false);
  const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [customCoverUrl, setCustomCoverUrl] = useState("");

  // Google Drive Sync Modal State
  const [isSyncDriveModalOpen, setIsSyncDriveModalOpen] = useState(false);
  const [syncDriveUrl, setSyncDriveUrl] = useState("");
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState("");
  const [preserveSelectionsOnSync, setPreserveSelectionsOnSync] = useState(true);

  // Lightbox Zoom State (1x, 2x, 3x)
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    title: "",
    clientName: "",
    clientPhone: "",
    limitSelection: false,
    maxSelectionCount: 35,
    enableWatermark: true,
    watermarkText: "BERGH.RYKER STUDIO",
    allowComments: true,
    allowDownload: false,
    passwordProtected: false,
    password: "",
    clientReminderEnabled: true,
    clientReminderText: "",
  });

  // Client submission states
  const [submitNotes, setSubmitNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Deadline Countdown Modal State
  const [showDeadlineModal, setShowDeadlineModal] = useState<boolean>(false);

  // Interactive Tour Guide State (5 steps)
  const [tourStep, setTourStep] = useState<number | null>(null);

  // 10s Grace Period Countdown State
  const [isGraceModalOpen, setIsGraceModalOpen] = useState(false);
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(10);
  const graceTimerRef = React.useRef<any>(null);

  useEffect(() => {
    if (album) {
      if (album.deadline || album.dueDate) {
        const dismissed = sessionStorage.getItem(`bergh_deadline_dismissed_${album.id}`);
        if (!dismissed) {
          setShowDeadlineModal(true);
        }
      }
      const seenTour = localStorage.getItem(`bergh_tour_seen_${album.id}`);
      if (!seenTour && !isViewOnly && !isAdmin) {
        setTourStep(1);
      }
    }
  }, [album, isViewOnly, isAdmin]);

  useEffect(() => {
    if (isGraceModalOpen) {
      setGraceSecondsLeft(10);
      graceTimerRef.current = setInterval(() => {
        setGraceSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(graceTimerRef.current);
            setIsGraceModalOpen(false);
            handleSubmitSelection();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (graceTimerRef.current) {
        clearInterval(graceTimerRef.current);
      }
    }
    return () => {
      if (graceTimerRef.current) {
        clearInterval(graceTimerRef.current);
      }
    };
  }, [isGraceModalOpen]);

  // View-Only mode when opened with ?mode=view
  const [isViewOnly] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const p = new URLSearchParams(window.location.search);
        return p.get("mode") === "view" || p.get("viewOnly") === "true";
      }
    } catch (_) {}
    return false;
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Subscribe to album in Firestore
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);

    const unsubscribe = subscribeSingleProofingAlbum(albumSlugOrId, (fetchedAlbum) => {
      setIsLoading(false);
      setIsRefreshing(false);
      if (fetchedAlbum) {
        setAlbum(fetchedAlbum);
        // Cập nhật động thẻ Open Graph & Tiêu đề ngay khi tải album thành công
        updateOpenGraphTags(fetchedAlbum);
        // Sync settings form
        setSettingsForm({
          title: fetchedAlbum.title || "",
          clientName: fetchedAlbum.clientName || "",
          clientPhone: fetchedAlbum.clientPhone || "",
          limitSelection: fetchedAlbum.limitSelection ?? fetchedAlbum.settings?.limitSelection ?? false,
          maxSelectionCount: fetchedAlbum.maxSelectionCount ?? fetchedAlbum.settings?.maxSelectionCount ?? 35,
          enableWatermark: fetchedAlbum.enableWatermark ?? fetchedAlbum.settings?.enableWatermark ?? true,
          watermarkText: fetchedAlbum.watermarkText || fetchedAlbum.settings?.watermarkText || "BERGH.RYKER STUDIO",
          allowComments: fetchedAlbum.allowComments ?? fetchedAlbum.settings?.allowComments ?? true,
          allowDownload: fetchedAlbum.allowDownload ?? fetchedAlbum.settings?.allowDownload ?? false,
          passwordProtected: fetchedAlbum.passwordProtected ?? fetchedAlbum.settings?.passwordProtected ?? false,
          password: fetchedAlbum.password || fetchedAlbum.settings?.password || "",
          clientReminderEnabled: fetchedAlbum.clientReminderEnabled ?? fetchedAlbum.settings?.clientReminderEnabled ?? true,
          clientReminderText: fetchedAlbum.clientReminderText || fetchedAlbum.settings?.clientReminderText || "",
        });

        // Check password session cache
        const isPasswordSet = fetchedAlbum.passwordProtected ?? fetchedAlbum.settings?.passwordProtected;
        const passVal = fetchedAlbum.password || fetchedAlbum.settings?.password;
        if (isPasswordSet && passVal) {
          const cachedPass = sessionStorage.getItem(`proof_pw_${fetchedAlbum.id}`);
          if (cachedPass === passVal || isAdmin) {
            setIsUnlocked(true);
          } else {
            setIsUnlocked(false);
          }
        } else {
          setIsUnlocked(true);
        }
      } else {
        setLoadError("Không tìm thấy album chọn ảnh hoặc đường dẫn không còn tồn tại.");
      }
    });

    return () => unsubscribe();
  }, [albumSlugOrId, isAdmin]);

  // Real-time synchronization with bookings collection for bidirectional sync
  useEffect(() => {
    if (!album?.bookingCode) return;
    const q = query(collection(db, "bookings"), where("bookingCode", "==", album.bookingCode));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const bData = snap.docs[0].data() as any;
        const status = bData.editingStatus;
        if (status) {
          let mappedStage: PipelineStage = album.pipelineStage;
          if (status === "pending" || status === "shooting_done") mappedStage = "new";
          else if (status === "editing") mappedStage = "client_submitted";
          else if (status === "reviewing") mappedStage = "raw_filtered";
          else if (status === "completed") mappedStage = "delivered";

          if (mappedStage !== album.pipelineStage) {
            setAlbum((prev) => (prev ? { ...prev, pipelineStage: mappedStage, isLocked: status !== "pending" && status !== "shooting_done" ? true : prev.isLocked } : null));
          }
        }
      }
    });
    return () => unsub();
  }, [album?.bookingCode]);

  // Đồng bộ lại thẻ OG mỗi khi dữ liệu album cập nhật
  useEffect(() => {
    if (album) {
      updateOpenGraphTags(album);
    }
  }, [album]);

  const handleUnlockWithPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!album) return;
    const passVal = album.password || album.settings?.password;
    if (passwordInput.trim() === passVal) {
      setIsUnlocked(true);
      setPasswordError(false);
      sessionStorage.setItem(`proof_pw_${album.id}`, passwordInput.trim());
      showToast("Mở khóa album thành công!");
    } else {
      setPasswordError(true);
    }
  };

  // Toggle Favorite (Heart)
  const handleToggleFavorite = async (photoId: string) => {
    if (!album) return;
    if (isViewOnly && !isAdmin) {
      showToast("Album đang ở chế độ xem (View-Only). Bạn không thể thay đổi danh sách chọn ảnh.");
      return;
    }
    if (album.isLocked && !isAdmin) {
      showToast("Album đã được chốt và khóa chọn ảnh.");
      return;
    }

    const currentFavoritesCount = album.photos.filter((p) => p.isFavorite).length;
    const target = album.photos.find((p) => p.id === photoId);
    if (!target) return;

    const willFavorite = !target.isFavorite;
    const limitEnabled = album.limitSelection ?? album.settings?.limitSelection;
    const maxLimit = album.maxSelectionCount ?? album.settings?.maxSelectionCount;

    // Check selection limit
    if (willFavorite && limitEnabled && maxLimit) {
      if (currentFavoritesCount >= maxLimit) {
        showToast(`Bạn chỉ được chọn tối đa ${maxLimit} ảnh theo gói chụp.`);
        return;
      }
    }

    const updatedPhotos = album.photos.map((p) =>
      p.id === photoId ? { ...p, isFavorite: willFavorite } : p
    );

    setAlbum({ ...album, photos: updatedPhotos });
    try {
      await updateProofingAlbum(album.id, { photos: updatedPhotos });
    } catch (err) {
      console.error("Update favorite error:", err);
    }
  };

  // Toggle Star
  const handleToggleStar = async (photoId: string) => {
    if (!album) return;
    if (isViewOnly && !isAdmin) {
      showToast("Album đang ở chế độ xem (View-Only).");
      return;
    }
    if (album.isLocked && !isAdmin) {
      showToast("Album đã được chốt và khóa chọn ảnh.");
      return;
    }

    const updatedPhotos = album.photos.map((p) =>
      p.id === photoId ? { ...p, isStarred: !p.isStarred } : p
    );

    setAlbum({ ...album, photos: updatedPhotos });
    try {
      await updateProofingAlbum(album.id, { photos: updatedPhotos });
    } catch (err) {
      console.error("Update star error:", err);
    }
  };

  // Add Comment on Photo
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!album || !activePhotoForComments || !commentInput.trim()) return;

    const newComment: ProofingPhotoComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      photoId: activePhotoForComments.id,
      author: commentAuthor.trim() || (isAdmin ? "Studio Admin" : album.clientName || "Khách hàng"),
      text: commentInput.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedPhotos = album.photos.map((p) => {
      if (p.id === activePhotoForComments.id) {
        const existingComments = p.comments || [];
        return {
          ...p,
          comments: [...existingComments, newComment],
        };
      }
      return p;
    });

    setAlbum({ ...album, photos: updatedPhotos });
    setActivePhotoForComments({
      ...activePhotoForComments,
      comments: [...(activePhotoForComments.comments || []), newComment],
    });
    setCommentInput("");

    try {
      await updateProofingAlbum(album.id, { photos: updatedPhotos });
      showToast("Đã lưu ghi chú chỉnh sửa cho ảnh này!");
    } catch (err) {
      console.error("Add comment error:", err);
    }
  };

  // Admin Toggle Lock Status
  const handleToggleLock = async () => {
    if (!album) return;
    const newLockState = !album.isLocked;
    try {
      await updateProofingAlbum(album.id, { isLocked: newLockState });
      showToast(newLockState ? "Đã khóa chốt album chọn ảnh." : "Đã mở khóa album cho khách.");
    } catch (err) {
      console.error("Toggle lock error:", err);
      showToast("Lỗi khi cập nhật trạng thái khóa.");
    }
  };

  // Real Google Drive Rescan & Sync directly to Firestore
  const handleSyncDrivePhotos = async (targetUrl?: string) => {
    if (!album) return;
    const urlToUse = (targetUrl !== undefined ? targetUrl : syncDriveUrl || album.driveFolderUrl || "").trim();
    if (!urlToUse) {
      setSyncDriveUrl(album.driveFolderUrl || "");
      setIsSyncDriveModalOpen(true);
      showToast("Vui lòng nhập hoặc chọn thư mục Google Drive để quét ảnh.");
      return;
    }

    const folderId = parseDriveFolderId(urlToUse);
    if (!folderId) {
      showToast("Không tìm thấy Folder ID hợp lệ từ đường dẫn Google Drive.");
      return;
    }

    setIsSyncingDrive(true);
    setIsRefreshing(true);
    setSyncStatusMsg("Đang kết nối Google Drive quét danh sách ảnh và thư mục con...");
    showToast("Đang quét toàn bộ ảnh từ Google Drive...");

    try {
      const fetchedPhotos = await fetchDriveFolderImages(folderId, null, (msg) => {
        setSyncStatusMsg(msg);
      });

      if (!fetchedPhotos || fetchedPhotos.length === 0) {
        showToast("Không tìm thấy file ảnh nào trong thư mục Google Drive này.");
        setSyncStatusMsg("Đã quét xong nhưng không tìm thấy file ảnh hợp lệ.");
        return;
      }

      // Merge with existing photo selections if requested to preserve client's hearts, stars, and comments
      let mergedPhotos: ProofingPhoto[] = fetchedPhotos;
      if (preserveSelectionsOnSync && album.photos && album.photos.length > 0) {
        const existingMap = new Map<string, ProofingPhoto>();
        album.photos.forEach((p) => {
          if (p.driveFileId) existingMap.set(p.driveFileId, p);
          if (p.fileName) existingMap.set(p.fileName, p);
          if (p.baseName) existingMap.set(p.baseName, p);
        });

        mergedPhotos = fetchedPhotos.map((np) => {
          const match =
            existingMap.get(np.driveFileId || "") ||
            existingMap.get(np.fileName) ||
            existingMap.get(np.baseName);
          if (match) {
            return {
              ...np,
              isFavorite: match.isFavorite,
              isStarred: match.isStarred,
              comments: match.comments || [],
            };
          }
          return np;
        });
      }

      // Save directly to Firestore
      await updateProofingAlbum(album.id, {
        photos: mergedPhotos,
        driveFolderUrl: urlToUse,
        driveFolderId: folderId,
      });

      setAlbum((prev) =>
        prev
          ? {
              ...prev,
              photos: mergedPhotos,
              driveFolderUrl: urlToUse,
              driveFolderId: folderId,
            }
          : null
      );
      showToast(`Đã đồng bộ thành công ${mergedPhotos.length} ảnh lên Firestore!`);
      setIsSyncDriveModalOpen(false);
    } catch (err: any) {
      console.error("Sync drive error:", err);
      showToast(`Lỗi quét ảnh: ${err.message || err}`);
      setSyncStatusMsg(`Lỗi: ${err.message || "Không thể đồng bộ"}`);
    } finally {
      setIsSyncingDrive(false);
      setIsRefreshing(false);
    }
  };

  // Admin Refresh Trigger
  const handleRefresh = async () => {
    if (album?.driveFolderUrl) {
      await handleSyncDrivePhotos(album.driveFolderUrl);
    } else {
      setSyncDriveUrl(album?.driveFolderUrl || "");
      setIsSyncDriveModalOpen(true);
    }
  };

  // Admin Set As Cover Photo
  const handleSelectCoverPhoto = async (coverUrl: string) => {
    if (!album || !coverUrl) return;
    try {
      await updateProofingAlbum(album.id, { coverPhotoUrl: coverUrl });
      setAlbum({ ...album, coverPhotoUrl: coverUrl });
      setIsCoverModalOpen(false);
      showToast("Đã cập nhật ảnh bìa album thành công!");
    } catch (err) {
      console.error("Update cover photo error:", err);
      showToast("Lỗi khi cập nhật ảnh bìa.");
    }
  };

  // Admin Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!album) return;
    try {
      const updates = {
        title: settingsForm.title.trim(),
        clientName: settingsForm.clientName.trim(),
        clientPhone: settingsForm.clientPhone.trim(),
        limitSelection: settingsForm.limitSelection,
        maxSelectionCount: Number(settingsForm.maxSelectionCount) || 35,
        enableWatermark: settingsForm.enableWatermark,
        watermarkText: settingsForm.watermarkText.trim() || "BERGH.RYKER STUDIO",
        allowComments: settingsForm.allowComments,
        allowDownload: settingsForm.allowDownload,
        passwordProtected: settingsForm.passwordProtected,
        password: settingsForm.password.trim(),
        clientReminderEnabled: settingsForm.clientReminderEnabled,
        clientReminderText: settingsForm.clientReminderText.trim(),
      };
      await updateProofingAlbum(album.id, updates);
      setAlbum({ ...album, ...updates });
      setIsSettingsModalOpen(false);
      showToast("Đã lưu tùy chỉnh album thành công!");
    } catch (err) {
      console.error("Save settings error:", err);
      showToast("Lỗi khi lưu tùy chỉnh album.");
    }
  };

  // Final Client Submit Selection
  const handleSubmitSelection = async () => {
    if (!album) return;
    setIsSubmitting(true);
    try {
      await submitClientProofingSelection(album.id, {
        photos: album.photos,
        notes: submitNotes || "",
        lockAfterSubmit: true,
      });
      setAlbum((prev) =>
        prev
          ? {
              ...prev,
              isLocked: true,
              pipelineStage: "client_submitted",
              clientSubmitNotes: submitNotes || "",
              clientSubmittedAt: new Date().toISOString(),
            }
          : null
      );
      setSubmitSuccess(true);
      showToast("Danh sách ảnh đã được gửi thành công đến Studio!");
      setTimeout(() => {
        setIsSubmitModalOpen(false);
      }, 1500);
    } catch (err: any) {
      console.error("Submit selection error:", err);
      showToast("Lỗi gửi dữ liệu: " + (err.message || "vui lòng thử lại."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // High-Fidelity Printable PDF Export Report
  const handleExportPDF = () => {
    if (!album) return;
    const favorites = album.photos.filter((p) => p.isFavorite);
    const commented = album.photos.filter((p) => p.comments && p.comments.length > 0);
    const dateStr = new Date().toLocaleDateString("vi-VN");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("Vui lòng cho phép mở cửa sổ popup để xuất báo cáo PDF.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Báo cáo chọn ảnh - ${album.title} - ${album.clientName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1a1a1a;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #B5945B;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 800;
            color: #B5945B;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .brand-sub {
            font-size: 11px;
            color: #495057;
            font-weight: 700;
            letter-spacing: 1px;
          }
          .meta-box {
            text-align: right;
            font-size: 12px;
            color: #555;
          }
          .summary-card {
            background: #fdfbf7;
            border: 1px solid #e6d7be;
            border-radius: 8px;
            padding: 14px 18px;
            margin-bottom: 24px;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
          }
          .stat-item {
            text-align: center;
          }
          .stat-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #777;
            font-weight: 700;
          }
          .stat-value {
            font-size: 18px;
            font-weight: 800;
            color: #B5945B;
            font-family: monospace;
          }
          .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #111;
            text-transform: uppercase;
            border-bottom: 1px solid #ddd;
            padding-bottom: 6px;
            margin-top: 24px;
            margin-bottom: 12px;
          }
          .file-list-box {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 12px 14px;
            font-family: monospace;
            font-size: 12px;
            line-height: 1.8;
            color: #212529;
            word-break: break-all;
          }
          .comments-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          .comments-table th, .comments-table td {
            border: 1px solid #dee2e6;
            padding: 8px 10px;
            text-align: left;
            font-size: 12px;
          }
          .comments-table th {
            background: #f1f3f5;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
            color: #495057;
          }
          .footer {
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #eee;
            text-align: center;
            font-size: 11px;
            color: #888;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">BERGH.RYKER STUDIO</div>
            <div class="brand-sub">BẢNG TIẾN ĐỘ HẬU KỲ & CHỌN ẢNH - BERGH.RYKER PROOFING</div>
            <div style="margin-top: 4px; font-size: 12px; color: #444;">
              <strong>Album:</strong> ${album.title} | <strong>Khách hàng:</strong> ${album.clientName} ${album.clientPhone ? `(${album.clientPhone})` : ""}
            </div>
          </div>
          <div class="meta-box">
            <div><strong>Ngày xuất:</strong> ${dateStr}</div>
            <div><strong>Trạng thái:</strong> ${album.isLocked ? "Đã khóa chốt" : "Đang chọn ảnh"}</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="stat-item">
            <div class="stat-label">Tổng số ảnh</div>
            <div class="stat-value">${album.photos.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Ảnh đã chọn</div>
            <div class="stat-value">${favorites.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Có ghi chú</div>
            <div class="stat-value">${commented.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Tiến độ</div>
            <div class="stat-value">${album.isLocked ? "Đã chốt" : "Đang chọn"}</div>
          </div>
        </div>

        <div class="section-title">DANH SÁCH MÃ FILE KHÁCH ĐÃ CHỌN (${favorites.length} ẢNH)</div>
        <div class="file-list-box">
          ${favorites.length > 0 ? favorites.map((p) => p.baseName || extractBaseName(p.fileName)).join(", ") : "Chưa có ảnh nào được chọn."}
        </div>

        ${commented.length > 0 ? `
          <div class="section-title">GHI CHÚ CHỈNH SỬA CHI TIẾT TỪNG ẢNH (${commented.length} ẢNH)</div>
          <table class="comments-table">
            <thead>
              <tr>
                <th style="width: 25%;">Mã file</th>
                <th style="width: 20%;">Người ghi chú</th>
                <th style="width: 55%;">Nội dung yêu cầu</th>
              </tr>
            </thead>
            <tbody>
              ${commented.map((p) => `
                <tr>
                  <td style="font-family: monospace; font-weight: bold;">${p.baseName || extractBaseName(p.fileName)}</td>
                  <td>${p.comments?.map((c) => c.author).join(", ") || "Khách"}</td>
                  <td>${p.comments?.map((c) => c.text).join("<br/>") || ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}

        <div class="footer">
          Bergh.Ryker Studio • Hệ Thống Lọc File Gốc Shotpik • Xuất lúc: ${new Date().toLocaleString("vi-VN")}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    showToast("Đã mở bản in/xuất PDF chuẩn!");
  };

  // Copy Quick List of Base Filenames
  const handleCopyBaseNamesList = () => {
    if (!album) return;
    const favorites = album.photos.filter((p) => p.isFavorite);
    const text = favorites.map((p) => p.baseName || extractBaseName(p.fileName)).join(", ");
    navigator.clipboard.writeText(text);
    setCopiedList(true);
    showToast("Đã sao chép danh sách mã file vào clipboard!");
    setTimeout(() => setCopiedList(false), 2000);
  };

  // Filtered & Sorted photos
  const filteredPhotos = useMemo(() => {
    if (!album) return [];
    let list = album.photos.filter((p) => {
      // Filter tab
      if (activeFilter === "favorites" && !p.isFavorite) return false;
      if (activeFilter === "starred" && !p.isStarred) return false;
      if (activeFilter === "comments" && (!p.comments || p.comments.length === 0)) return false;

      // Raw File tab filter (if in raw mode, filters to files containing RAW extensions or simulated raw tag)
      if (photoViewTab === "raw") {
        const f = (p.fileName || "").toUpperCase();
        const isRaw = f.endsWith(".CR2") || f.endsWith(".CR3") || f.endsWith(".NEF") || f.endsWith(".ARW") || f.endsWith(".DNG") || f.endsWith(".RAF") || p.subFolder?.toLowerCase().includes("raw");
        if (!isRaw) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const bName = (p.baseName || "").toLowerCase();
        const fName = (p.fileName || "").toLowerCase();
        if (!bName.includes(query) && !fName.includes(query)) return false;
      }
      return true;
    });

    // Sort order
    list = [...list].sort((a, b) => {
      if (sortBy === "name-asc") {
        return (a.fileName || "").localeCompare(b.fileName || "");
      }
      if (sortBy === "name-desc") {
        return (b.fileName || "").localeCompare(a.fileName || "");
      }
      if (sortBy === "favorites") {
        return (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0);
      }
      if (sortBy === "starred") {
        return (b.isStarred ? 1 : 0) - (a.isStarred ? 1 : 0);
      }
      if (sortBy === "comments") {
        const cA = a.comments?.length || 0;
        const cB = b.comments?.length || 0;
        return cB - cA;
      }
      return 0;
    });

    return list;
  }, [album, activeFilter, photoViewTab, searchQuery, sortBy]);

  // Counters
  const totalPhotosCount = album?.photos.length || 0;
  const favoritesCount = album?.photos.filter((p) => p.isFavorite).length || 0;
  const starredCount = album?.photos.filter((p) => p.isStarred).length || 0;
  const commentsCount = album?.photos.filter((p) => p.comments && p.comments.length > 0).length || 0;

  // 3. BỘ TẢI TRƯỚC "CỬA SỔ TRƯỢT 8 ẢNH" TRONG RAM (SLIDING-WINDOW MEMORY PRELOADER)
  useEffect(() => {
    if (lightboxPhotoIndex === null || !filteredPhotos || filteredPhotos.length === 0) return;
    preloadLightboxImages(filteredPhotos, lightboxPhotoIndex);
  }, [lightboxPhotoIndex, filteredPhotos]);

  // Keyboard navigation cho Lightbox (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (lightboxPhotoIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxPhotoIndex(null);
        setZoomLevel(1);
      } else if (e.key === "ArrowRight") {
        if (lightboxPhotoIndex < filteredPhotos.length - 1) {
          setLightboxPhotoIndex((prev) => (prev !== null ? prev + 1 : null));
          setZoomLevel(1);
        }
      } else if (e.key === "ArrowLeft") {
        if (lightboxPhotoIndex > 0) {
          setLightboxPhotoIndex((prev) => (prev !== null ? prev - 1 : null));
          setZoomLevel(1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxPhotoIndex, filteredPhotos.length]);

  // Workflow Stepper stages (5 steps pipeline)
  const workflowSteps = [
    { id: "step1", label: "1. Mới tạo", desc: "Đã nạp ảnh Drive" },
    { id: "step2", label: "2. Chờ khách chọn", desc: "Đang gửi link chọn" },
    { id: "step3", label: "3. Khách đã chốt", desc: "Đã khóa & cần lọc RAW" },
    { id: "step4", label: "4. Đang hậu kỳ", desc: "Blend màu, da & retouch" },
    { id: "step5", label: "5. Đã bàn giao", desc: "Hoàn tất bàn giao ảnh" },
  ];

  const currentStep = useMemo(() => {
    if (!album) return 1;
    if (album.pipelineStage === "delivered") return 5;
    if (album.pipelineStage === "raw_filtered" || album.pipelineStage === "reviewing" || album.pipelineStage === "supplementary") return 4;
    if (album.pipelineStage === "client_submitted" || album.isLocked || album.clientSubmittedAt) return 3;
    const favCount = album.photos?.filter((p) => p.isFavorite).length || 0;
    if (favCount > 0) return 2;
    return 1;
  }, [album]);

  const handleStepClick = async (stepNum: number) => {
    if (!isAdmin || !album) return;
    let targetStage: PipelineStage = "new";
    let lockState = album.isLocked;
    let newStatus = "pending";
    let newProgress = 10;

    if (stepNum === 1) {
      targetStage = "new";
      newStatus = "pending";
      newProgress = 10;
      lockState = false;
    } else if (stepNum === 2) {
      targetStage = "new";
      newStatus = "shooting_done";
      newProgress = 30;
      lockState = false;
    } else if (stepNum === 3) {
      targetStage = "client_submitted";
      lockState = true;
      newStatus = "editing";
      newProgress = 55;
    } else if (stepNum === 4) {
      targetStage = "raw_filtered";
      lockState = true;
      newStatus = "reviewing";
      newProgress = 80;
    } else if (stepNum === 5) {
      targetStage = "delivered";
      lockState = true;
      newStatus = "completed";
      newProgress = 100;
    }

    try {
      await updateProofingAlbum(album.id, {
        pipelineStage: targetStage,
        isLocked: lockState,
      });

      const bCode = album.bookingCode;
      if (bCode) {
        try {
          const q = query(collection(db, "bookings"), where("bookingCode", "==", bCode));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const bookingDocRef = doc(db, "bookings", snap.docs[0].id);
            await updateDoc(bookingDocRef, {
              editingStatus: newStatus,
              editingProgress: newProgress,
            });
          }
        } catch (e) {
          console.warn("Sync step to booking warning:", e);
        }
      }

      setAlbum((prev) => (prev ? { ...prev, pipelineStage: targetStage, isLocked: lockState } : null));
      showToast(`✅ Đã cập nhật tiến độ: Bước ${stepNum} - ${workflowSteps[stepNum - 1].label}`);
    } catch (err) {
      console.error("Update stage error:", err);
      showToast("Lỗi khi cập nhật bước tiến độ.");
    }
  };

  const currentCover = album?.coverPhotoUrl || (album?.photos && album.photos.length > 0 ? (album.photos[0].thumbnailUrl || album.photos[0].url) : "");
  const watermarkTextValue = album?.watermarkText || album?.settings?.watermarkText || "BERGH.RYKER STUDIO";
  const watermarkEnabled = album?.enableWatermark ?? album?.settings?.enableWatermark ?? true;
  const limitEnabled = album?.limitSelection ?? album?.settings?.limitSelection ?? false;
  const maxLimitCount = album?.maxSelectionCount ?? album?.settings?.maxSelectionCount ?? 35;
  const reminderEnabled = album?.clientReminderEnabled ?? album?.settings?.clientReminderEnabled ?? true;
  const reminderText = album?.clientReminderText || album?.settings?.clientReminderText || "";

  // Dynamic Open Graph metadata values for Social Sharing Cards (Zalo, Messenger, Facebook)
  const ogTitle = album
    ? `${album.title || "Album Chọn Ảnh"} - ${album.clientName || "Khách Hàng"} | Bergh.Ryker Studio`
    : "Bergh.Ryker Studio — Chọn Ảnh & Duyệt Album";
  const ogDesc = album
    ? `Trang chọn ảnh & duyệt hậu kỳ chính thức của ${album.clientName || "Khách hàng"} - Bergh.Ryker Studio. Bấm để xem và chọn ảnh yêu thích!`
    : "Trang chọn ảnh & duyệt hậu kỳ chính thức của Bergh.Ryker Studio.";
  const publicBaseDomain = getPublicBookingBaseUrl();
  const albumPublicUrl = album
    ? `${publicBaseDomain}/?proofing=${encodeURIComponent(album.slug || album.id)}`
    : publicBaseDomain;

  const ogImage = useMemo(() => {
    let img = album?.coverUrl || album?.coverPhotoUrl;
    if (!img && album?.coverImageFileId) {
      img = `https://drive.google.com/thumbnail?id=${album.coverImageFileId}&sz=w1200`;
    }
    // Fallback to the album's first photo if coverUrl is missing
    if (!img && album?.photos && album.photos.length > 0) {
      const validPhoto =
        album.photos.find((p) => {
          const fId =
            p.driveFileId ||
            (p.id && !p.id.startsWith("photo_") && !p.id.startsWith("blob:") ? p.id : "");
          return Boolean(
            fId ||
              (p.thumbnailUrl && p.thumbnailUrl.startsWith("http")) ||
              (p.url && p.url.startsWith("http")) ||
              (p.hdUrl && p.hdUrl.startsWith("http"))
          );
        }) || album.photos[0];

      if (validPhoto) {
        const fileId =
          validPhoto.driveFileId ||
          (validPhoto.id && !validPhoto.id.startsWith("photo_") && !validPhoto.id.startsWith("blob:")
            ? validPhoto.id
            : "");
        if (fileId) {
          img = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
        } else if (validPhoto.thumbnailUrl && validPhoto.thumbnailUrl.startsWith("http")) {
          img = validPhoto.thumbnailUrl;
        } else if (validPhoto.url && validPhoto.url.startsWith("http")) {
          img = validPhoto.url;
        } else if (validPhoto.hdUrl && validPhoto.hdUrl.startsWith("http")) {
          img = validPhoto.hdUrl;
        }
      }
    }
    return img || `${publicBaseDomain}/og-image-square-white.png`;
  }, [album, publicBaseDomain]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? "bg-slate-950 text-white" : "bg-[#f8f9fa] text-slate-800"} flex flex-col items-center justify-center p-6 text-center`}>
        <RefreshCw className="w-8 h-8 text-[#e03131] animate-spin mb-4" />
        <h2 className="text-lg font-bold tracking-wide">
          ĐANG TẢI ALBUM CHỌN ẢNH...
        </h2>
        <p className="text-xs text-slate-500 mt-1">Đồng bộ dữ liệu thời gian thực từ Studio</p>
      </div>
    );
  }

  // Error state
  if (loadError || !album) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#B5945B]/15 border border-[#B5945B]/30 flex items-center justify-center mb-4 text-[#E2C792]">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-white">Album Không Tồn Tại</h2>
        <p className="text-sm text-zinc-300 max-w-md mb-6">{loadError}</p>
        <button
          type="button"
          onClick={onNavigateHome}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
        >
          Quay về Trang Chủ
        </button>
      </div>
    );
  }

  // Password Lock Screen
  const isProtected = album.passwordProtected ?? album.settings?.passwordProtected;
  if (isProtected && !isUnlocked) {
    return (
      <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-[radial-gradient(ellipse_at_top,_rgba(181,148,91,0.08),_transparent_70%)] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#121216] border border-white/10 rounded-3xl p-8 text-center shadow-2xl relative z-10"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#B5945B]/15 text-[#E2C792] border border-[#B5945B]/30 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E2C792]">
            Bảo Mật Album
          </span>
          <h2 className="text-xl font-bold mt-1 mb-2 text-white">{album.title}</h2>
          <p className="text-xs text-zinc-300 mb-6">
            Album dành riêng cho khách hàng <strong className="text-white">{album.clientName}</strong>. Vui lòng nhập mật khẩu do Studio cung cấp để xem ảnh.
          </p>

          <form onSubmit={handleUnlockWithPassword} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError(false);
              }}
              placeholder="Nhập mật khẩu..."
              className="w-full px-4 py-3 bg-black/60 border border-white/15 focus:border-[#B5945B] text-white rounded-xl text-center text-sm outline-none transition-all tracking-widest font-mono"
              autoFocus
            />

            {passwordError && (
              <p className="text-xs text-rose-400 font-semibold">
                Mật khẩu không chính xác, vui lòng thử lại!
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(181,148,91,0.3)] cursor-pointer"
            >
              MỞ KHÓA XEM ALBUM
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Quay về Trang Chủ
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans selection:bg-[#B5945B] selection:text-black pb-36 relative text-left">
      <Helmet>
        <title>{ogTitle}</title>
        <meta name="description" content={ogDesc} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={albumPublicUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="BERGH.RYKER STUDIO" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>

      {/* Hiệu ứng ánh sáng nền tinh tế */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,_rgba(181,148,91,0.06),_transparent_70%)] pointer-events-none" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[999999] px-5 py-2.5 rounded-full bg-[#141418] text-[#E2C792] text-xs font-bold tracking-wide shadow-2xl backdrop-blur-xl flex items-center gap-2 border border-[#B5945B]/40"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#B5945B]" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 0. Thanh hướng dẫn iOS Zalo/Messenger in-app browser */}
      {showInAppBrowserBanner && (
        <div className="bg-gradient-to-r from-[#B5945B]/20 via-[#B5945B]/15 to-[#B5945B]/20 border-b border-[#B5945B]/30 px-4 py-2 text-xs text-zinc-100 flex items-center justify-between gap-3 shadow-md z-50 relative">
          <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">💡</span>
            <span className="leading-snug text-[11px] sm:text-xs">
              <strong className="text-[#E2C792]">Mẹo xem ảnh nét & nhanh nhất trên iPhone:</strong> Nếu trình duyệt chat làm chậm ảnh hoặc hiện thông báo kiểm tra cookie, bạn chỉ cần bấm nút <strong>[•••]</strong> ở góc trên bên phải và chọn <strong>"Mở bằng Safari / Trình duyệt ngoài"</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowInAppBrowserBanner(false)}
            className="p-1 rounded-lg bg-black/40 hover:bg-black/60 text-zinc-300 hover:text-white transition shrink-0 cursor-pointer"
            title="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. TOP HEADER (BERGH.RYKER DARK LUXURY TOP BAR) */}
      <header className="sticky top-0 z-30 w-full bg-[#0D0D10]/95 backdrop-blur-xl border-b border-white/[0.08] px-3 sm:px-6 py-2.5 sm:py-3.5 shadow-lg">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4 max-w-7xl mx-auto w-full">
          
          {/* BÊN TRÁI: NÚT QUAY LẠI */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  sessionStorage.setItem('bergh_admin_view', 'proofing_dashboard');
                  sessionStorage.setItem('bergh_intro_completed', 'true');
                  localStorage.setItem('bergh_intro_completed', 'true');
                  sessionStorage.removeItem('bergh_active_proofing_album');

                  const cleanUrl = new URL(window.location.href);
                  if (cleanUrl.searchParams.has('proofing') || cleanUrl.searchParams.has('album')) {
                    cleanUrl.searchParams.delete('proofing');
                    cleanUrl.searchParams.delete('album');
                    window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
                  }
                } catch (_) {}

                if (onNavigateHome) {
                  onNavigateHome();
                }
                window.dispatchEvent(new CustomEvent('bergh:open-proofing-dashboard'));
              }}
              className="flex items-center justify-center gap-1.5 shrink-0 h-9 px-2.5 sm:px-3.5 rounded-full bg-white/[0.06] hover:bg-white/10 active:scale-95 border border-white/10 text-zinc-200 transition cursor-pointer flex-shrink-0"
              title="Quay lại Bảng điều khiển"
            >
              <span className="text-base font-bold leading-none shrink-0">←</span>
              <span className="hidden md:inline text-xs font-medium whitespace-nowrap shrink-0">
                Bảng điều khiển
              </span>
            </button>
          </div>

          {/* Ở GIỮA: LOGO THƯƠNG HIỆU */}
          <div className="min-w-0 flex items-center justify-start gap-2 truncate">
            <span className="font-sans font-extrabold tracking-[0.22em] text-sm sm:text-base text-zinc-100 uppercase select-none truncate">
              BERGH<span className="text-[#B5945B]">.</span>RYKER
            </span>
            {album.isLocked && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#E2C792] bg-[#B5945B]/15 px-2 py-0.5 rounded-full border border-[#B5945B]/40 shrink-0">
                <Lock className="w-2.5 h-2.5 text-[#B5945B]" />
                ĐÃ CHỐT
              </span>
            )}
            {isViewOnly && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded-full border border-blue-500/30 shrink-0">
                <Eye className="w-2.5 h-2.5 text-blue-400" />
                Chỉ xem
              </span>
            )}
          </div>

          {/* BÊN PHẢI: CỤM TIỆN ÍCH (ACTIONS) */}
          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              className="w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer text-zinc-300 hover:text-white shrink-0 flex-shrink-0"
              title="Trợ giúp & Hướng dẫn"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => showToast("Đã cập nhật dữ liệu mới nhất từ Studio!")}
              className="relative w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center rounded-full text-zinc-300 hover:bg-white/[0.06] transition cursor-pointer shrink-0 flex-shrink-0"
              title="Thông báo"
            >
              <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              {favoritesCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B5945B] ring-2 ring-[#0D0D10]" />
              )}
            </button>

            <div className="px-2 py-1 rounded-md bg-white/[0.05] border border-white/10 text-[10px] sm:text-xs font-semibold text-zinc-300 shrink-0 flex-shrink-0">
              VI
            </div>

            <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-white/10 shrink-0 flex-shrink-0">
              <span className="font-bold text-xs text-[#E2C792] truncate max-w-[100px] tracking-wide uppercase">
                {isAdmin ? "ADMIN" : (album.clientName || "KHÁCH")}
              </span>
            </div>
          </div>

        </div>
      </header>

      {/* 2. HERO COVER BANNER & CLEAN ALBUM INFO CARD */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 mb-6 space-y-4">
        {/* Clean Cover Image Banner (Pristine photo, zero text overlay covering faces) */}
        <div className="bg-[#121216] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative h-[220px] sm:h-[300px] flex items-center justify-center">
          {currentCover ? (
            <img
              src={currentCover}
              alt={album.title}
              className="absolute inset-0 w-full h-full object-cover select-none"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#121214] via-[#1a1a1c] to-[#0a0a0c] text-center p-6">
              <div className="text-[11px] uppercase tracking-[0.3em] font-extrabold text-[#B5945B]">
                Studio Signature Cover
              </div>
              <h2 className="text-2xl sm:text-4xl font-sans font-black tracking-widest text-[#E5C17C] uppercase mt-1">
                BERGH<span className="text-[#B5945B]">.</span>RYKER STUDIO
              </h2>
            </div>
          )}

          {/* Pristine ambient vignette, zero text obstruction */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

          {/* Button: '📷 Thay đổi ảnh bìa' on Top-Right */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCoverModalOpen(true)}
              className="absolute top-4 right-4 z-20 px-3.5 py-1.5 bg-black/75 hover:bg-black/90 backdrop-blur-md text-zinc-100 border border-white/20 hover:border-[#B5945B] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-[#E2C792]" />
              <span>Thay đổi ảnh bìa</span>
            </button>
          )}
        </div>

        {/* Clean Album Info Card (Separated cleanly below the photo banner) */}
        <div className="bg-[#141418] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-[#B5945B]/15 border border-[#B5945B]/30 text-[#E2C792] px-3 py-1 rounded-full">
                BERGH.RYKER STUDIO PROOFING
              </span>
              <span className="text-xs text-zinc-300">
                Khách hàng: <strong className="text-white font-semibold">{album.clientName}</strong>
                {album.bookingCode ? (
                  <span className="ml-1.5 text-[#E2C792] font-mono font-bold">
                    (Mã: {album.bookingCode})
                  </span>
                ) : ""}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
              {album.title}
            </h1>
          </div>
        </div>
      </div>

      {/* 2.5 WORKFLOW TIMELINE / STEPPER (5 BƯỚC NỐI TIẾP NHAU) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6">
        <div className="bg-[#141418] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E2C792] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#B5945B]" />
                Tiến Độ Xử Lý Hậu Kỳ (Workflow Pipeline)
              </span>
              {album.dueDate && (
                <span className="text-[10px] text-zinc-300 bg-white/[0.04] border border-white/10 px-2.5 py-0.5 rounded-full">
                  Hạn trả ảnh: <strong className="text-[#E2C792]">{album.dueDate}</strong>
                </span>
              )}
            </div>
            {isAdmin ? (
              <span className="text-[11px] text-[#E2C792] hidden sm:inline">
                💡 Click vào bước để cập nhật trạng thái đơn hàng
              </span>
            ) : (
              <span className="text-[11px] text-[#E2C792] hidden sm:inline">
                💡 Trạng thái đơn hàng được cập nhật tự động theo thời gian thực
              </span>
            )}
          </div>

          {/* 5 Steps: Horizontal scroll on mobile to prevent text clipping, 5-col grid on desktop */}
          <div className="flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-5 gap-2.5 pb-1">
            {workflowSteps.map((step, idx) => {
              const stepNum = idx + 1;
              const isCurrent = currentStep === stepNum;
              const isCompleted = currentStep > stepNum;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => isAdmin && handleStepClick(stepNum)}
                  disabled={!isAdmin}
                  className={`relative flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left min-w-[170px] sm:min-w-0 shrink-0 sm:shrink ${
                    isAdmin ? "cursor-pointer active:scale-[0.98]" : "cursor-default"
                  } ${
                    isCurrent
                      ? "bg-[#B5945B] text-black font-bold shadow-[0_0_20px_rgba(181,148,91,0.4)] border-[#B5945B]"
                      : isCompleted
                      ? "bg-[#B5945B]/15 text-[#E2C792] border-[#B5945B]/40 hover:bg-[#B5945B]/25"
                      : "bg-white/[0.04] text-zinc-300 border-white/10 hover:border-[#B5945B]/60 hover:bg-[#B5945B]/[0.08] hover:text-white"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-extrabold ${
                      isCurrent
                        ? "bg-black text-[#E2C792]"
                        : isCompleted
                        ? "bg-[#B5945B] text-black"
                        : "bg-white/10 text-zinc-200"
                    }`}
                  >
                    {isCompleted ? "✓" : stepNum}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11px] leading-tight font-bold ${isCurrent ? "text-black" : "text-zinc-100"}`}>
                      {step.label}
                    </div>
                    <div
                      className={`text-[9px] leading-snug ${
                        isCurrent ? "text-black/80 font-medium" : "text-zinc-300"
                      }`}
                    >
                      {step.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {!isAdmin && (
            <div className="mt-2 text-[11px] text-[#E2C792]/90 sm:hidden flex items-center gap-1.5">
              <span>💡</span>
              <span>Trạng thái đơn hàng được cập nhật tự động theo thời gian thực</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. STATS & 12 ACTION BUTTONS ROW (LIQUID GLASS ACTION BAR) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6">
        <div className="bg-[#141418] border border-white/10 rounded-2xl p-2.5 sm:p-3 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 overflow-x-auto">
          {/* Left: 4 Clickable Stats Counters */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Total */}
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === "all"
                  ? "bg-white/15 text-white border-white/30 shadow-xs font-bold"
                  : "bg-white/[0.04] text-zinc-200 border-white/10 hover:bg-white/[0.08]"
              }`}
            >
              <span>🖼️</span>
              <span>{totalPhotosCount}</span>
            </button>

            {/* Starred */}
            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === "starred" ? "all" : "starred")}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === "starred"
                  ? "bg-amber-400 text-black border-amber-400 shadow-xs font-bold"
                  : "bg-white/[0.04] text-amber-300 border-white/10 hover:bg-amber-400/10"
              }`}
            >
              <span>⭐</span>
              <span>{starredCount}</span>
            </button>

            {/* Favorites */}
            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === "favorites" ? "all" : "favorites")}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === "favorites"
                  ? "bg-[#B5945B] text-black border-[#B5945B] shadow-[0_0_12px_rgba(181,148,91,0.35)] font-bold"
                  : "bg-white/[0.04] text-[#E2C792] border-white/10 hover:bg-[#B5945B]/15"
              }`}
            >
              <span>♡</span>
              <span>{favoritesCount}</span>
            </button>

            {/* Comments */}
            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === "comments" ? "all" : "comments")}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeFilter === "comments"
                  ? "bg-blue-600 text-white border-blue-500 shadow-xs font-bold"
                  : "bg-white/[0.04] text-blue-300 border-white/10 hover:bg-blue-500/10"
              }`}
            >
              <span>💬</span>
              <span>{commentsCount}</span>
            </button>
          </div>

          {/* Right: The 12 Action Buttons (Liquid Glass) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
            {/* 1. Chia sẻ */}
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Chia sẻ link & mã QR cho khách chọn"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Chia sẻ</span>
            </button>

            {/* 2. Quét lại Drive */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setSyncDriveUrl(album.driveFolderUrl || "");
                  setIsSyncDriveModalOpen(true);
                }}
                disabled={isRefreshing}
                className="px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Quét lại & Đồng bộ ảnh từ Google Drive"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Quét lại Drive</span>
              </button>
            )}

            {/* 3. Khoá / Mở khoá */}
            {isAdmin && (
              <button
                type="button"
                onClick={handleToggleLock}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                  album.isLocked
                    ? "bg-[#B5945B]/15 text-[#E2C792] border-[#B5945B]/40 hover:bg-[#B5945B]/25 font-bold"
                    : "bg-white/[0.03] hover:bg-white/[0.08] text-zinc-200 hover:text-white border-white/10"
                }`}
                title={album.isLocked ? "Mở khóa cho khách sửa chọn ảnh" : "Khóa chốt album"}
              >
                {album.isLocked ? <Lock className="w-3.5 h-3.5 text-[#B5945B]" /> : <Unlock className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{album.isLocked ? "Đã khóa" : "Khoá"}</span>
              </button>
            )}

            {/* 4. Lọc file */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-[#B5945B]/15 hover:bg-[#B5945B]/25 border border-[#B5945B]/40 text-[#E2C792] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="Lọc file RAW / JPG trên máy tính qua createWritable()"
              >
                <HardDrive className="w-3.5 h-3.5 text-[#E2C792]" />
                <span>Lọc file</span>
              </button>
            )}



            {/* 11. Tải xuống */}
            <button
              type="button"
              onClick={() => {
                if (favoritesCount === 0) {
                  showToast("Chưa có ảnh nào được chọn để sao chép danh sách.");
                  return;
                }
                handleCopyBaseNamesList();
              }}
              className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-zinc-200 hover:text-white text-xs transition-all cursor-pointer shadow-xs"
              title="Sao chép danh sách mã ảnh để xuất file"
            >
              <Download className="w-3.5 h-3.5 text-zinc-200" />
            </button>

            {/* 12. Tuỳ chỉnh */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-zinc-200 hover:text-white text-xs transition-all cursor-pointer shadow-xs"
                title="Cài đặt cấu hình album"
              >
                <Settings className="w-3.5 h-3.5 text-zinc-200" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. CLIENT REMINDER BANNER */}
      {reminderEnabled && reminderText && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6">
          <div className="bg-[#141418]/90 border border-white/10 rounded-2xl p-5 shadow-xl flex items-start gap-3.5">
            <Sparkles className="w-5 h-5 text-[#B5945B] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-[#E2C792] uppercase tracking-wider mb-2 flex items-center gap-2">
                Lời nhắn từ Studio:
              </h4>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {reminderText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. TABS (TẤT CẢ & RAW FILE) + SEARCH BAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
          {/* Tabs: Tất cả & Raw File */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPhotoViewTab("all")}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                photoViewTab === "all"
                  ? "bg-gradient-to-r from-[#B5945B] to-[#9A7B46] text-black shadow-[0_0_15px_rgba(181,148,91,0.25)]"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white border border-white/10 font-medium"
              }`}
            >
              Tất cả ({totalPhotosCount})
            </button>

            <button
              type="button"
              onClick={() => setPhotoViewTab("raw")}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                photoViewTab === "raw"
                  ? "bg-gradient-to-r from-[#B5945B] to-[#9A7B46] text-black shadow-[0_0_15px_rgba(181,148,91,0.25)]"
                  : "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white border border-white/10 font-medium"
              }`}
            >
              <span>Raw File</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative min-w-[240px] sm:w-80">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã file (vd: NDD03604)..."
              className="w-full pl-9 pr-9 py-2 bg-black/60 border border-white/15 focus:border-[#B5945B] text-white placeholder:text-zinc-400 rounded-xl text-xs outline-none transition-all font-mono shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6. PHOTO GRID (THẺ ẢNH MÃ FILE RÕ RÀNG, TIM, SAO, GHI CHÚ, ĐẶT LÀM ẢNH BÌA) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
        {filteredPhotos.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-[#121216] border border-white/10 rounded-2xl p-8">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] mx-auto flex items-center justify-center text-[#E2C792]">
              <HardDrive className="w-7 h-7 text-[#B5945B]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                {album.photos.length === 0
                  ? "Album chưa có ảnh nào từ Google Drive (Tổng ảnh: 0)"
                  : "Không tìm thấy ảnh nào khớp với bộ lọc hiện tại"}
              </h3>
              <p className="text-xs text-zinc-300 max-w-md mx-auto">
                {album.photos.length === 0
                  ? "Thư mục Google Drive chưa được quét hoặc danh sách ảnh chưa nạp. Nhấn nút bên dưới để quét toàn bộ ảnh gốc và các thư mục con ngay lập tức."
                  : "Thử chuyển bộ lọc sang 'Tất cả' hoặc nhập từ khóa tìm kiếm khác."}
              </p>
            </div>

            {album.photos.length === 0 ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSyncDriveUrl(album.driveFolderUrl || "");
                    setIsSyncDriveModalOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 text-black text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-black" />
                  <span>🔄 Quét & Đồng bộ ảnh từ Google Drive ngay</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter("all");
                  setPhotoViewTab("all");
                  setSearchQuery("");
                }}
                className="text-xs text-[#E2C792] font-bold hover:underline cursor-pointer"
              >
                Xem lại tất cả ảnh ({totalPhotosCount})
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredPhotos.map((photo, index) => {
              const hasComments = photo.comments && photo.comments.length > 0;
              const isFav = photo.isFavorite;
              const isStar = photo.isStarred;
              const isCover = currentCover === (photo.thumbnailUrl || photo.url);

              return (
                <div
                  key={photo.id || index}
                  style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "300px",
                  }}
                  className={`group relative rounded-2xl overflow-hidden bg-[#121216] border transition-all duration-200 flex flex-col shadow-lg ${
                    isFav
                      ? "ring-2 ring-[#B5945B] border-[#B5945B]"
                      : "border-white/10 hover:border-[#B5945B]/40"
                  }`}
                >
                  {/* Photo container */}
                  <div
                    className="relative aspect-[3/4] bg-black/60 overflow-hidden cursor-pointer"
                    onClick={() => {
                      setLightboxPhotoIndex(index);
                      setZoomLevel(1);
                    }}
                  >
                    <ProofingImage
                      photo={photo}
                      viewMode="grid"
                      alt={photo.fileName}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102 select-none"
                    />

                    {/* Watermark overlay if enabled */}
                    {watermarkEnabled && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center rotate-[-30deg] opacity-25 select-none">
                        <span className="text-[#E2C792] text-xs sm:text-sm font-extrabold tracking-widest uppercase border border-[#B5945B]/40 px-3 py-1 bg-black/50 backdrop-blur-xs">
                          {watermarkTextValue}
                        </span>
                      </div>
                    )}

                    {/* Top status badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10 pointer-events-none">
                      {isFav && (
                        <span className="p-1 rounded-full bg-[#B5945B] text-black shadow-xs">
                          <Heart className="w-3 h-3 fill-black" />
                        </span>
                      )}
                      {isStar && (
                        <span className="p-1 rounded-full bg-amber-400 text-black shadow-xs">
                          <Star className="w-3 h-3 fill-black" />
                        </span>
                      )}
                      {hasComments && (
                        <span className="p-1 rounded-full bg-blue-500 text-white shadow-xs">
                          <MessageSquare className="w-3 h-3 fill-white" />
                        </span>
                      )}
                      {isCover && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-black/80 text-[#E2C792] border border-[#B5945B]/40">
                          Ảnh bìa
                        </span>
                      )}
                    </div>

                    {/* Zoom preview icon on hover */}
                    <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Card bottom bar */}
                  <div className="p-2 sm:p-2.5 flex items-center justify-between gap-1 border-t border-white/[0.08] bg-[#141418]">
                    <span
                      className="text-[11px] font-mono font-semibold truncate cursor-pointer text-zinc-200 hover:text-[#E2C792]"
                      title={photo.fileName}
                      onClick={() => setLightboxPhotoIndex(index)}
                    >
                      {photo.baseName || extractBaseName(photo.fileName)}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Heart (Select) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(photo.id);
                        }}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          isFav
                            ? "bg-[#B5945B] text-black shadow-xs font-bold"
                            : "hover:bg-white/[0.08] text-zinc-300 hover:text-[#E2C792]"
                        }`}
                        title={isFav ? "Bỏ chọn ảnh" : "Chọn ảnh này"}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-black" : ""}`} />
                      </button>

                      {/* Star (Review) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStar(photo.id);
                        }}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          isStar
                            ? "bg-amber-400 text-black shadow-xs"
                            : "hover:bg-white/[0.08] text-zinc-300 hover:text-amber-400"
                        }`}
                        title="Đánh dấu chú ý"
                      >
                        <Star className={`w-3.5 h-3.5 ${isStar ? "fill-black" : ""}`} />
                      </button>

                      {/* Comment (Notes) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePhotoForComments(photo);
                        }}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer relative ${
                          hasComments
                            ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                            : "hover:bg-white/[0.08] text-zinc-300 hover:text-blue-400"
                        }`}
                        title="Ghi chú chỉnh sửa ảnh"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {hasComments && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center">
                            {photo.comments?.length}
                          </span>
                        )}
                      </button>

                      {/* Set as Cover Photo (Admin only) */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCoverPhoto(photo.thumbnailUrl || photo.url);
                          }}
                          className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                            isCover
                              ? "bg-[#B5945B] text-black"
                              : "hover:bg-white/[0.08] text-zinc-300 hover:text-white"
                          }`}
                          title="Đặt làm ảnh bìa album"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. BOTTOM CLIENT FLOATING ACTION BAR */}
      <div className="fixed bottom-4 inset-x-4 md:inset-x-8 z-40 bg-[#121216]/95 backdrop-blur-2xl border border-[#B5945B]/40 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B5945B] animate-pulse shadow-[0_0_8px_rgba(181,148,91,0.8)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
              Tiến độ chọn ảnh:
            </span>
          </div>
          <div className="text-sm font-bold flex items-center gap-1.5">
            <span className="font-mono text-[#E2C792] text-base font-extrabold">{favoritesCount}</span>
            {limitEnabled && maxLimitCount ? (
              <span className="text-zinc-300 font-mono">/ {maxLimitCount} ảnh</span>
            ) : (
              <span className="text-zinc-300 font-normal">ảnh đã chọn</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isViewOnly ? (
            <div className="text-xs font-bold text-blue-300 bg-blue-500/15 px-4 py-2.5 rounded-xl border border-blue-500/30 flex items-center gap-2 shadow-sm">
              <Eye className="w-4 h-4 text-blue-400" />
              <span>Chế độ xem album (View-Only)</span>
            </div>
          ) : album.isLocked ? (
            <div className="text-xs font-bold text-[#E2C792] bg-[#B5945B]/15 px-4 py-2.5 rounded-xl border border-[#B5945B]/40 flex items-center gap-2 shadow-sm">
              <Lock className="w-4 h-4 text-[#B5945B]" />
              <span>Danh sách đã được chốt và gửi đến Studio</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsGraceModalOpen(true)}
              disabled={favoritesCount === 0}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(181,148,91,0.3)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4 fill-black" />
              <span>Gửi studio chốt ảnh ({favoritesCount} ảnh)</span>
            </button>
          )}
        </div>
      </div>

      {/* MODAL 1: THAY ĐỔI ẢNH BÌA */}
      <AnimatePresence>
        {isCoverModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative text-left max-h-[88vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <Camera className="w-5 h-5 text-[#e03131]" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Thay đổi ảnh bìa Album
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCoverModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Option A: Enter Custom Image URL */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Nhập liên kết ảnh bìa trực tiếp:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={customCoverUrl}
                      onChange={(e) => setCustomCoverUrl(e.target.value)}
                      placeholder="https://example.com/cover.jpg"
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs outline-none"
                    />
                    <button
                      type="button"
                      disabled={!customCoverUrl.trim()}
                      onClick={() => handleSelectCoverPhoto(customCoverUrl.trim())}
                      className="px-4 py-2 bg-[#e03131] hover:bg-[#c92a2a] disabled:opacity-40 text-white font-bold text-xs rounded-xl"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>

                {/* Option B: Choose from album photos */}
                <div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Hoặc chọn nhanh từ danh sách ảnh trong album ({album.photos.length} ảnh):
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {album.photos.map((p, idx) => {
                      const img = p.thumbnailUrl || p.url;
                      const isCurrent = currentCover === img;
                      return (
                        <div
                          key={p.id || idx}
                          onClick={() => handleSelectCoverPhoto(img)}
                          className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                            isCurrent
                              ? "border-[#e03131] ring-2 ring-red-300"
                              : "border-transparent hover:border-slate-400"
                          }`}
                        >
                          <ProofingImage
                            photo={p}
                            viewMode="grid"
                            alt={p.fileName}
                            className="w-full h-full object-cover"
                          />
                          {isCurrent && (
                            <div className="absolute top-1 right-1 p-1 rounded-full bg-[#e03131] text-white">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ALBUM SETTINGS MODAL */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative text-left max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <Settings className="w-5 h-5 text-[#e03131]" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Tùy chỉnh cấu hình Album
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Basic info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tên Album</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.title}
                      onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tên Khách Hàng</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.clientName}
                      onChange={(e) => setSettingsForm({ ...settingsForm, clientName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>

                {/* Selection Limit Toggle */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white">Giới hạn số lượng ảnh được chọn</div>
                      <div className="text-[11px] text-slate-500">Khách không thể chọn vượt quá số ảnh gói hợp đồng</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.limitSelection}
                      onChange={(e) => setSettingsForm({ ...settingsForm, limitSelection: e.target.checked })}
                      className="w-4 h-4 accent-[#e03131] cursor-pointer"
                    />
                  </div>
                  {settingsForm.limitSelection && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-slate-600 dark:text-slate-400">Số lượng ảnh tối đa:</span>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={settingsForm.maxSelectionCount}
                        onChange={(e) => setSettingsForm({ ...settingsForm, maxSelectionCount: Number(e.target.value) })}
                        className="w-20 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs outline-none font-mono"
                      />
                      <span className="text-xs text-slate-500">ảnh</span>
                    </div>
                  )}
                </div>

                {/* Watermark Toggle */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white">Watermark bảo vệ bản quyền</div>
                      <div className="text-[11px] text-slate-500">Chèn chữ ký Studio chéo màn hình chống chụp ảnh màn hình</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.enableWatermark}
                      onChange={(e) => setSettingsForm({ ...settingsForm, enableWatermark: e.target.checked })}
                      className="w-4 h-4 accent-[#e03131] cursor-pointer"
                    />
                  </div>
                  {settingsForm.enableWatermark && (
                    <input
                      type="text"
                      value={settingsForm.watermarkText}
                      onChange={(e) => setSettingsForm({ ...settingsForm, watermarkText: e.target.value })}
                      placeholder="Nội dung watermark"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs outline-none font-mono"
                    />
                  )}
                </div>

                {/* Password Protection */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white">Đặt mật khẩu bảo vệ</div>
                      <div className="text-[11px] text-slate-500">Chỉ khách có mật khẩu mới xem được ảnh</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.passwordProtected}
                      onChange={(e) => setSettingsForm({ ...settingsForm, passwordProtected: e.target.checked })}
                      className="w-4 h-4 accent-[#e03131] cursor-pointer"
                    />
                  </div>
                  {settingsForm.passwordProtected && (
                    <input
                      type="text"
                      value={settingsForm.password}
                      onChange={(e) => setSettingsForm({ ...settingsForm, password: e.target.value })}
                      placeholder="Nhập mật khẩu album"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs outline-none font-mono"
                    />
                  )}
                </div>

                {/* Reminder Text */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-white">Lời nhắc hướng dẫn khách hàng</div>
                      <div className="text-[11px] text-slate-500">Hiển thị khung thông báo trên đầu album</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsForm.clientReminderEnabled}
                      onChange={(e) => setSettingsForm({ ...settingsForm, clientReminderEnabled: e.target.checked })}
                      className="w-4 h-4 accent-[#e03131] cursor-pointer"
                    />
                  </div>
                  {settingsForm.clientReminderEnabled && (
                    <textarea
                      rows={2}
                      value={settingsForm.clientReminderText}
                      onChange={(e) => setSettingsForm({ ...settingsForm, clientReminderText: e.target.value })}
                      placeholder="Nội dung lời nhắn cho khách hàng..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs outline-none resize-none"
                    />
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs text-slate-600 dark:text-slate-300"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#e03131] hover:bg-[#c92a2a] text-white font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Lưu cài đặt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: QUICK LIST VIEW MODAL */}
      <AnimatePresence>
        {isListViewModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <List className="w-5 h-5 text-[#e03131]" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Danh Sách Mã Ảnh Đã Chọn ({favoritesCount} ảnh)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsListViewModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <textarea
                  readOnly
                  rows={6}
                  value={album.photos
                    .filter((p) => p.isFavorite)
                    .map((p) => p.baseName || extractBaseName(p.fileName))
                    .join(", ")}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono outline-none resize-none select-all"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500">
                    Ngăn cách bởi dấu phẩy, dùng để dán vào bộ lọc máy tính hoặc Lightroom.
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyBaseNamesList}
                    className="px-4 py-2 rounded-xl bg-[#e03131] hover:bg-[#c92a2a] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedList ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedList ? "Đã chép!" : "Sao chép"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: COMMENT / RETOUCH NOTES MODAL */}
      <AnimatePresence>
        {activePhotoForComments && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative text-left"
            >
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <ProofingImage
                      photo={activePhotoForComments}
                      viewMode="grid"
                      alt={activePhotoForComments.fileName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                      {activePhotoForComments.baseName || activePhotoForComments.fileName}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Ghi chú yêu cầu chỉnh sửa cho ảnh này
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePhotoForComments(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Comments History */}
              <div className="space-y-2.5 max-h-48 overflow-y-auto mb-4 pr-1">
                {(!activePhotoForComments.comments || activePhotoForComments.comments.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-3 text-center">
                    Chưa có ghi chú nào cho ảnh này.
                  </p>
                ) : (
                  activePhotoForComments.comments.map((comm) => (
                    <div
                      key={comm.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#e03131]">{comm.author}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(comm.createdAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {comm.text}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <input
                  type="text"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  placeholder={`Tên người ghi chú (Mặc định: ${album.clientName})`}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs outline-none"
                />

                <textarea
                  rows={3}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Ví dụ: Bóp eo nhẹ, xóa người đi bộ đằng sau, chỉnh tone màu vintage ấm..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl text-xs outline-none resize-none"
                  autoFocus
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActivePhotoForComments(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs text-slate-600 dark:text-slate-300"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={!commentInput.trim()}
                    className="px-5 py-2 rounded-xl bg-[#e03131] hover:bg-[#c92a2a] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Lưu ghi chú
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: CONFIRM SUBMIT SELECTION */}
      <AnimatePresence>
        {isSubmitModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#121216] border border-white/10 rounded-2xl p-6 shadow-2xl text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#B5945B]/15 text-[#E2C792] border border-[#B5945B]/30 flex items-center justify-center mb-4">
                <Send className="w-5 h-5 fill-[#B5945B]" />
              </div>

              <h3 className="text-base font-bold text-white">
                Xác Nhận & Gửi Danh Sách Ảnh
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Bạn đang chuẩn bị chốt danh sách gồm{" "}
                <strong className="text-[#E2C792] font-mono">{favoritesCount} ảnh</strong> cho Studio
                Bergh.Ryker. Sau khi gửi, Studio sẽ nhận thông báo để tiến hành lọc file gốc và chỉnh sửa.
              </p>

              <div className="my-4 space-y-1.5">
                <label className="text-[11px] font-bold text-[#E2C792] uppercase tracking-wider">
                  Ghi chú tổng thể gửi đến Studio (Không bắt buộc):
                </label>
                <textarea
                  rows={3}
                  value={submitNotes}
                  onChange={(e) => setSubmitNotes(e.target.value)}
                  placeholder="Ví dụ: Em đã chọn xong ảnh rồi ạ, studio ưu tiên giúp em ảnh bìa trước nhé..."
                  className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 focus:border-[#B5945B] text-zinc-200 placeholder:text-zinc-500 rounded-xl text-xs outline-none resize-none"
                />
              </div>

              {submitSuccess && (
                <div className="p-3 rounded-xl bg-[#B5945B]/15 text-[#E2C792] border border-[#B5945B]/30 text-xs font-semibold flex items-center gap-2 mb-4">
                  <Check className="w-4 h-4 text-[#B5945B]" />
                  <span>Đã gửi danh sách thành công!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-zinc-300 transition"
                >
                  Kiểm tra lại
                </button>
                <button
                  type="button"
                  onClick={handleSubmitSelection}
                  disabled={isSubmitting || submitSuccess}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 disabled:opacity-40 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_15px_rgba(181,148,91,0.25)]"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-black" />
                  )}
                  <span>Chốt & Gửi Danh Sách</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 6: FULLSCREEN LIGHTBOX (ORIGINAL FULL-RESOLUTION STREAM & RETINA ZOOM) */}
      <AnimatePresence>
        {lightboxPhotoIndex !== null && filteredPhotos[lightboxPhotoIndex] && (
          <div className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 select-none">
            {/* Top Bar */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-zinc-300 font-bold">
                  {filteredPhotos[lightboxPhotoIndex].fileName} ({lightboxPhotoIndex + 1} /{" "}
                  {filteredPhotos.length})
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#B5945B]/20 text-[#E5C17C] border border-[#B5945B]/40 shadow-xs">
                  <Sparkles className="w-3 h-3 text-[#E5C17C]" />
                  <span>✨ Chất lượng Ảnh Gốc (Original HD)</span>
                </span>
              </div>

              {/* Zoom Controls & Close */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white/10 rounded-xl p-0.5 border border-white/10 text-xs text-white">
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      zoomLevel === 1 ? "bg-white text-slate-900" : "hover:bg-white/10 text-zinc-300"
                    }`}
                    title="Kích thước vừa khung"
                  >
                    1x
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(2)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      zoomLevel === 2 ? "bg-white text-slate-900" : "hover:bg-white/10 text-zinc-300"
                    }`}
                    title="Phóng to 200%"
                  >
                    2x
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(3)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      zoomLevel === 3 ? "bg-white text-slate-900" : "hover:bg-white/10 text-zinc-300"
                    }`}
                    title="Soi nét 300% (Original HD)"
                  >
                    3x
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLightboxPhotoIndex(null);
                    setZoomLevel(1);
                  }}
                  className="p-2 rounded-full text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Central Photo with Zoom & 100% Original Uncompressed stream */}
            <div className={`relative flex-1 flex items-center justify-center p-2 overflow-auto ${zoomLevel > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}>
              <div
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "center center",
                  transition: "transform 0.25s ease-out",
                }}
                className="max-h-[82vh] max-w-[92vw] flex items-center justify-center"
              >
                <ProofingImage
                  photo={filteredPhotos[lightboxPhotoIndex]}
                  viewMode="lightbox"
                  zoomLevel={zoomLevel}
                  alt={filteredPhotos[lightboxPhotoIndex].fileName}
                  className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
                />
              </div>

              {/* Watermark in lightbox if enabled */}
              {watermarkEnabled && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center rotate-[-30deg] opacity-20">
                  <span className="text-white text-base sm:text-2xl font-black tracking-widest uppercase border-2 border-white/40 px-6 py-2">
                    {watermarkTextValue}
                  </span>
                </div>
              )}

              {/* Prev / Next buttons */}
              {lightboxPhotoIndex > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setLightboxPhotoIndex(lightboxPhotoIndex - 1);
                    setZoomLevel(1);
                  }}
                  className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer z-20"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {lightboxPhotoIndex < filteredPhotos.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setLightboxPhotoIndex(lightboxPhotoIndex + 1);
                    setZoomLevel(1);
                  }}
                  className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer z-20"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Bottom Actions inside Lightbox */}
            <div className="flex items-center justify-center gap-3 z-10 py-2">
              <button
                type="button"
                onClick={() => handleToggleFavorite(filteredPhotos[lightboxPhotoIndex].id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  filteredPhotos[lightboxPhotoIndex].isFavorite
                    ? "bg-[#e03131] text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${
                    filteredPhotos[lightboxPhotoIndex].isFavorite ? "fill-white" : ""
                  }`}
                />
                <span>
                  {filteredPhotos[lightboxPhotoIndex].isFavorite ? "Đã chọn" : "Chọn ảnh này"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleStar(filteredPhotos[lightboxPhotoIndex].id)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  filteredPhotos[lightboxPhotoIndex].isStarred
                    ? "bg-amber-400 text-slate-950"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title="Đánh dấu"
              >
                <Star
                  className={`w-4 h-4 ${
                    filteredPhotos[lightboxPhotoIndex].isStarred ? "fill-slate-950" : ""
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => setActivePhotoForComments(filteredPhotos[lightboxPhotoIndex])}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ghi chú</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectCoverPhoto(filteredPhotos[lightboxPhotoIndex].thumbnailUrl || filteredPhotos[lightboxPhotoIndex].url);
                    setLightboxPhotoIndex(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#E5C17C]" />
                  <span>Đặt làm ảnh bìa</span>
                </button>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 7: FACE RECOGNITION (NHẬN DIỆN KHUÔN MẶT) */}
      <AnimatePresence>
        {isFaceRecognitionModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Nhận Diện Khuôn Mặt (AI Face Clustering)
                    </h3>
                    <p className="text-xs text-slate-500">Tự động gom nhóm ảnh theo từng người / học sinh</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFaceRecognitionModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Hệ thống AI quét toàn bộ <strong>{album.photos.length} ảnh</strong> trong album và tự động phân cụm khuôn mặt để khách hàng hoặc phụ huynh học sinh chỉ cần chụp selfie là có thể tìm ngay toàn bộ ảnh có mặt mình.
                </p>
                <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl space-y-1.5">
                  <div className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Tính năng đã sẵn sàng trên cấu hình Album
                  </div>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400">
                    Khách hàng mở link album sẽ có tùy chọn <strong>"Tìm ảnh theo khuôn mặt"</strong> trực tiếp trên điện thoại mà không cần tìm thủ công từng ảnh.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsFaceRecognitionModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#e03131] hover:bg-[#c92a2a] text-white font-bold text-xs"
                >
                  Đã hiểu
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 8: TẠO WEBSITE LANDING PAGE */}
      <AnimatePresence>
        {isWebsiteModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Tạo Website Giới Thiệu Album
                    </h3>
                    <p className="text-xs text-slate-500">Trang web độc lập dạng Portfolio cá nhân</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWebsiteModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p>
                  Đường dẫn công khai cho khách hàng và đối tác xem bộ ảnh với giao diện tràn viền sang trọng:
                </p>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-[11px] break-all select-all flex items-center justify-between gap-2">
                  <span>{getPublicUrl(`/albums/${album.slug || album.id}`)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(getPublicUrl(`/albums/${album.slug || album.id}`));
                      showToast("Đã chép link website!");
                    }}
                    className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0"
                    title="Sao chép"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
                <a
                  href={`/albums/${album.slug || album.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center gap-1.5"
                >
                  <span>Mở xem trang web</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 9: LỊCH SỬ THAO TÁC (HISTORY) */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Lịch Sử Thao Tác & Tiến Độ
                    </h3>
                    <p className="text-xs text-slate-500">Mốc thời gian album: {album.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white">Tạo Album Chọn Ảnh</div>
                    <div className="text-slate-500 text-[11px]">
                      {album.createdAt ? new Date(album.createdAt).toLocaleString("vi-VN") : "Khởi tạo thành công"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white">Đồng bộ Google Drive</div>
                    <div className="text-slate-500 text-[11px]">Đã nạp {album.photos.length} ảnh vào hệ thống</div>
                  </div>
                </div>

                {favoritesCount > 0 && (
                  <div className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-[#e03131] mt-1.5 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">Khách hàng chọn ảnh</div>
                      <div className="text-slate-500 text-[11px]">Đã chọn {favoritesCount} ảnh</div>
                    </div>
                  </div>
                )}

                {album.isLocked && (
                  <div className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">Khóa chốt album</div>
                      <div className="text-slate-500 text-[11px]">Đã hoàn tất chọn ảnh và khóa sửa đổi</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 10: TRỢ GIÚP & HƯỚNG DẪN */}
      <AnimatePresence>
        {isHelpModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-[#e03131] flex items-center justify-center">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Hướng Dẫn Quản Lý Album
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpModalOpen(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <strong>1. Lọc File Trên Máy Tính:</strong> Bấm nút <code>🌪️ Lọc file</code> để chọn thư mục ổ cứng chứa file RAW. Trình duyệt sẽ tự động copy trực tiếp các file ảnh khách chọn vào thư mục <code>DONE</code> trên ổ cứng.
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <strong>2. Chia sẻ cho khách:</strong> Bấm nút <code>🔗 Chia sẻ</code> để lấy link chọn ảnh (có mã PIN bảo mật nếu cài đặt).
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <strong>3. Xuất PDF:</strong> Bấm nút <code>📄 Tải PDF</code> để in báo cáo bàn giao kèm danh sách mã ảnh và toàn bộ ghi chú chỉnh sửa của khách.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsHelpModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-[#e03131] hover:bg-[#c92a2a] text-white font-bold text-xs"
                >
                  Đã hiểu
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LOCAL RAW / JPG FILE FILTER MODAL (PHÂN HỆ D - SHOTPIK FILE FILTER) */}
      <LocalFileFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        albumId={album.id}
        albumTitle={album.title}
        photos={album.photos}
        tags={album.tags}
        onFilterSuccess={() => {
          showToast("Đã lọc file thành công sang thư mục đích!");
        }}
      />

      {/* SHARE MODAL WITH DUAL LINKS & QR CODES */}
      <ShareProofingModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        album={album}
        showToast={showToast}
      />

      {/* MODAL 10: QUÉT & ĐỒNG BỘ ẢNH TỪ GOOGLE DRIVE */}
      <AnimatePresence>
        {isSyncDriveModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-[#e03131] flex items-center justify-center">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Quét & Đồng Bộ Ảnh Từ Google Drive
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Tự động quét các thư mục con (JPG, RAW, Edited) & lưu lên Firestore
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSyncDriveModalOpen(false)}
                  disabled={isSyncingDrive}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 pt-4 text-xs">
                {/* Input Link Google Drive */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <span>Đường dẫn thư mục Google Drive</span>
                      <span title="Dán link thư mục Google Drive đã cấp quyền xem cho bất kỳ ai" className="cursor-help text-slate-400">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    </label>
                    <GooglePickerButton
                      mode="folders"
                      size="sm"
                      buttonText="📁 Chọn từ Drive"
                      className="!py-0.5 !px-2 !text-[11px] !font-bold !bg-emerald-50 !text-emerald-700 !border-emerald-300 hover:!bg-emerald-100 !rounded-lg"
                      onSelect={(url) => setSyncDriveUrl(url)}
                    />
                  </div>
                  <input
                    type="url"
                    value={syncDriveUrl}
                    onChange={(e) => setSyncDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/1ABCxyz..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-[#e03131] rounded-xl outline-none font-mono text-slate-800 dark:text-slate-200"
                  />
                </div>

                {/* Preserve selections checkbox */}
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={preserveSelectionsOnSync}
                    onChange={(e) => setPreserveSelectionsOnSync(e.target.checked)}
                    className="w-4 h-4 text-[#e03131] rounded accent-[#e03131]"
                  />
                  <span>Giữ lại ảnh khách đã chọn (❤️ Yêu thích, ⭐ Sao, 💬 Ghi chú)</span>
                </label>

                {/* Status message */}
                {syncStatusMsg && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                    {isSyncingDrive && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#e03131]" />}
                    <span>{syncStatusMsg}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsSyncDriveModalOpen(false)}
                  disabled={isSyncingDrive}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncDrivePhotos()}
                  disabled={isSyncingDrive || !syncDriveUrl.trim()}
                  className="px-5 py-2 rounded-xl bg-[#e03131] hover:bg-[#c92a2a] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isSyncingDrive ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang quét Drive...</span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Bắt đầu quét & Lưu Firestore</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. DEADLINE COUNTDOWN MODAL */}
      <AnimatePresence>
        {showDeadlineModal && album && (album.deadline || album.dueDate) && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#121216] border border-[#B5945B]/40 rounded-3xl p-6 text-center shadow-2xl relative"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#B5945B]/15 text-[#E2C792] border border-[#B5945B]/30 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#E2C792]">
                Thông Báo Thời Hạn
              </span>
              <h3 className="text-xl font-bold mt-1 mb-2 text-white">⏰ Sắp hết hạn chọn ảnh</h3>
              <p className="text-xs text-zinc-300 leading-relaxed mb-6">
                Hạn chót chọn ảnh là <strong className="text-[#E2C792]">{album.deadline || album.dueDate}</strong>. Chọn xong nhớ bấm nút &apos;Hoàn tất&apos;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowDeadlineModal(false);
                  try {
                    sessionStorage.setItem(`bergh_deadline_dismissed_${album.id}`, 'true');
                  } catch (_) {}
                }}
                className="w-full py-3 bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(181,148,91,0.3)] cursor-pointer"
              >
                Tôi biết rồi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. INTERACTIVE TOUR GUIDE 5 STEPS */}
      <AnimatePresence>
        {tourStep !== null && album && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#121216] border border-[#B5945B]/40 rounded-3xl p-6 text-left shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#B5945B]" />
                  <span className="text-xs font-bold text-[#E2C792] uppercase tracking-wider">
                    Hướng dẫn sử dụng ({tourStep}/5)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTourStep(null);
                    try {
                      localStorage.setItem(`bergh_tour_seen_${album.id}`, 'true');
                    } catch (_) {}
                  }}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Bỏ qua hướng dẫn
                </button>
              </div>

              <div className="space-y-2 mb-6">
                <h4 className="text-sm font-bold text-white">
                  {tourStep === 1 && "Bước 1/5: Xem ảnh chi tiết"}
                  {tourStep === 2 && "Bước 2/5: Chọn ảnh yêu thích"}
                  {tourStep === 3 && "Bước 3/5: Kiểm tra số lượng"}
                  {tourStep === 4 && "Bước 4/5: Gửi cho photographer"}
                  {tourStep === 5 && "Bước 5/5: Xác nhận trước khi gửi"}
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {tourStep === 1 && "Xem ảnh to (Vuốt hoặc bấm phím mũi tên để xem chi tiết)."}
                  {tourStep === 2 && "Thích ảnh nào bấm biểu tượng trái tim ♡ để chọn."}
                  {tourStep === 3 && "Chọn xong số lượng thì bấm nút Hoàn tất ở góc trên."}
                  {tourStep === 4 && "Gửi kết quả cho photographer để tiến hành hậu kỳ."}
                  {tourStep === 5 && "Cân nhắc kỹ trước khi gửi, hoặc bấm xem lại."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={tourStep === 1}
                  onClick={() => setTourStep((prev) => (prev !== null && prev > 1 ? prev - 1 : 1))}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs text-zinc-300 transition cursor-pointer"
                >
                  Quay lại
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (tourStep < 5) {
                      setTourStep((prev) => (prev !== null ? prev + 1 : 1));
                    } else {
                      setTourStep(null);
                      try {
                        localStorage.setItem(`bergh_tour_seen_${album.id}`, 'true');
                      } catch (_) {}
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
                >
                  {tourStep === 5 ? "Hoàn thành" : "Tiếp"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. 10-SECOND GRACE PERIOD COUNTDOWN MODAL */}
      <AnimatePresence>
        {isGraceModalOpen && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#121216] border border-[#B5945B]/50 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 h-1 bg-gradient-to-r from-[#B5945B] to-[#E2C792] transition-all duration-1000"
                style={{ width: `${(graceSecondsLeft / 10) * 100}%` }}
              />

              <div className="w-16 h-16 mx-auto rounded-full bg-[#B5945B]/15 text-[#E2C792] border border-[#B5945B]/40 flex items-center justify-center mb-4">
                <span className="text-2xl font-black font-mono text-[#E2C792]">
                  {graceSecondsLeft}
                </span>
              </div>

              <span className="text-[10px] uppercase font-bold tracking-widest text-[#E2C792]">
                An Toàn Chốt Đơn
              </span>
              <h3 className="text-xl font-bold mt-1 mb-2 text-white">
                Kết quả sẽ được gửi sau {graceSecondsLeft} giây
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed mb-6">
                Bạn có thể bấm hủy bất cứ lúc nào nếu muốn kiểm tra lại danh sách ảnh đã chọn.
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsGraceModalOpen(false);
                  }}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/20 cursor-pointer shadow-md"
                >
                  Huỷ, tôi muốn chọn tiếp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
