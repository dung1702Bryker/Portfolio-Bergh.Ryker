import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db, markFirestoreQuotaExceeded } from "../firebase";
import {
  AdminPushNotification,
  NotificationSettings,
  NotificationType,
} from "../types/notification";
import {
  playNotificationSound,
  sendBrowserPushNotification,
  requestBrowserNotificationPermission,
} from "../utils/notificationAudio";
import { useLivePresenceContext } from "./LivePresenceContext";
import { useAdminAuth } from "../hooks/useAdminAuth";
import {
  getPushStatus,
  subscribeAdminPushDevice,
  unsubscribeAdminPushDevice,
  requestTestLockscreenPush,
  PushStatus,
} from "../services/webPushService";
import { stripIspFromName } from "../services/geoService";

interface AdminNotificationContextValue {
  notifications: AdminPushNotification[];
  unreadCount: number;
  settings: NotificationSettings;
  activeBannerNotification: AdminPushNotification | null;
  isNotificationCenterOpen: boolean;
  setIsNotificationCenterOpen: (open: boolean) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  enableBrowserPush: () => Promise<boolean>;
  backgroundPushStatus: PushStatus;
  enableBackgroundPush: () => Promise<{ success: boolean; error?: string }>;
  disableBackgroundPush: () => Promise<boolean>;
  triggerLockscreenTest: (delaySeconds?: number) => Promise<{ success: boolean; message?: string }>;
  triggerTestNotification: (type: NotificationType) => void;
  dismissBanner: () => void;
  scrollToBookingSection: () => void;
  isAdmin: boolean;
}

const AdminNotificationContext = createContext<AdminNotificationContextValue | null>(null);

const STORAGE_KEY_NOTIFS = "admin_push_notifications_v2";
const STORAGE_KEY_SETTINGS = "admin_notification_settings_v2";

const DEFAULT_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  browserPushEnabled: true,
  spikeThreshold: 1, // Alert from 1+ real guest visitor
  strangerAlertEnabled: true, // Auto-alert when non-admin / stranger device visits
  backgroundPushActive: false,
};

export const AdminNotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAdmin } = useAdminAuth();
  const { activeCount, activeVisitors, currentVisitorId } = useLivePresenceContext();

  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (_) {}
    return DEFAULT_SETTINGS;
  });

  const [notifications, setNotifications] = useState<AdminPushNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NOTIFS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, 50);
      }
    } catch (_) {}
    return [];
  });

  const [activeBannerNotification, setActiveBannerNotification] =
    useState<AdminPushNotification | null>(null);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>({
    isSupported: false,
    permission: "default",
    isSubscribed: false,
  });

  const bannerTimeoutRef = useRef<any>(null);
  const isInitialBookingsLoadRef = useRef(true);
  const knownBookingIdsRef = useRef<Set<string>>(new Set());

  // Spike & Stranger detection throttle refs
  const lastSpikeAlertTimeRef = useRef<number>(0);
  const lastSpikePeakCountRef = useRef<number>(0);
  const alertedStrangerIdsRef = useRef<Set<string>>(new Set());
  const lastStrangerAlertTimeRef = useRef<number>(0);

  // Check background push status periodically or when admin state changes
  useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;
    getPushStatus().then((status) => {
      if (isMounted) {
        setPushStatus(status);
        if (status.isSubscribed && !settings.backgroundPushActive) {
          updateSettings({ backgroundPushActive: true });
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isAdmin, settings.backgroundPushActive]);

  // If user is not admin or logs out, dismiss any active notification banner and modal
  useEffect(() => {
    if (!isAdmin) {
      setActiveBannerNotification(null);
      setIsNotificationCenterOpen(false);
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    }
  }, [isAdmin]);

  // Sync notifications to localStorage (only when admin)
  useEffect(() => {
    if (!isAdmin) return;
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifications.slice(0, 50)));
    } catch (_) {}
  }, [notifications, isAdmin]);

  // Sync settings to localStorage
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  // Request browser push permission (restricted to Admin)
  const enableBrowserPush = useCallback(async () => {
    if (!isAdmin) {
      console.warn("Chỉ Quản Trị Viên mới có quyền bật thông báo đẩy trình duyệt.");
      return false;
    }
    const granted = await requestBrowserNotificationPermission();
    updateSettings({ browserPushEnabled: granted });
    return granted;
  }, [isAdmin, updateSettings]);

  // Enable true background web push subscription (for lock screen & closed app)
  const enableBackgroundPush = useCallback(async () => {
    if (!isAdmin) {
      return { success: false, error: "Chỉ Quản Trị Viên mới có quyền kích hoạt." };
    }
    const res = await subscribeAdminPushDevice();
    if (res.success) {
      updateSettings({ backgroundPushActive: true, browserPushEnabled: true });
      const status = await getPushStatus();
      setPushStatus(status);
    }
    return res;
  }, [isAdmin, updateSettings]);

  // Disable background web push subscription
  const disableBackgroundPush = useCallback(async () => {
    const unsubscribed = await unsubscribeAdminPushDevice();
    updateSettings({ backgroundPushActive: false });
    const status = await getPushStatus();
    setPushStatus(status);
    return unsubscribed;
  }, [updateSettings]);

  // Test push to lock screen with delay
  const triggerLockscreenTest = useCallback(
    async (delaySeconds = 4) => {
      if (!isAdmin) {
        return { success: false, message: "Yêu cầu quyền Quản trị viên." };
      }
      return await requestTestLockscreenPush(delaySeconds);
    },
    [isAdmin]
  );

  // Push incoming notification with sound, banner, and browser alert (ONLY FOR ADMIN)
  const dispatchNotification = useCallback(
    (notifData: Omit<AdminPushNotification, "id" | "timestamp" | "read">) => {
      // STRICT CONSTRAINT: Only authenticated Admin receives notification chimes, banners, and push
      if (!isAdmin) {
        return;
      }

      const notif: AdminPushNotification = {
        ...notifData,
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };

      setNotifications((prev) => [notif, ...prev.slice(0, 49)]);

      // 1. Play sound chime ONLY if Admin and sound is enabled
      if (isAdmin && settings.soundEnabled) {
        playNotificationSound(
          notif.type === "new_booking"
            ? "booking"
            : notif.type === "stranger_visitor"
            ? "stranger"
            : "surge"
        );
      }

      // 2. Dispatch native browser push notification ONLY if Admin and enabled
      if (isAdmin && settings.browserPushEnabled) {
        sendBrowserPushNotification(notif.title, {
          body: notif.message,
          tag: notif.id,
          onClick: () => {
            window.focus();
            if (notif.type === "new_booking") {
              const el = document.getElementById("S9");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }
          },
        });
      }

      // 3. Show floating web push notification banner ONLY for Admin
      setActiveBannerNotification(notif);
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
      bannerTimeoutRef.current = setTimeout(() => {
        setActiveBannerNotification(null);
      }, 8500);
    },
    [isAdmin, settings]
  );

  const dismissBanner = useCallback(() => {
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    setActiveBannerNotification(null);
  }, []);

  // 1. Real-time Firestore Booking Listener for Admin alerts ONLY
  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    try {
      const bookingsCol = collection(db, "bookings");
      const q = query(bookingsCol, orderBy("createdAt", "desc"), limit(30));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isAdmin) return;

          if (isInitialBookingsLoadRef.current) {
            snapshot.docs.forEach((d) => knownBookingIdsRef.current.add(d.id));
            isInitialBookingsLoadRef.current = false;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const bookingId = change.doc.id;
              if (!knownBookingIdsRef.current.has(bookingId)) {
                knownBookingIdsRef.current.add(bookingId);
                const data = change.doc.data();

                const customerName =
                  data.customerName || data.name || data.schoolName || "Khách hàng";
                const schoolName = data.schoolName || "";
                const concept = data.conceptType || data.concept || "Kỷ yếu";
                const date = data.date || "Chờ chốt ngày";
                const phone = data.phoneNumber || data.instagramOrZalo || "";

                dispatchNotification({
                  type: "new_booking",
                  title: "📋 Đơn Đăng Ký Mới!",
                  message: `${customerName} (${schoolName ? schoolName + " - " : ""}${concept}) vừa gửi yêu cầu đặt lịch ngày ${date}.`,
                  metadata: {
                    bookingId,
                    customerName,
                    schoolName,
                    phone,
                    date,
                    conceptType: concept,
                  },
                });
              }
            }
          });
        },
        (err: any) => {
          if (
            err?.code === "resource-exhausted" ||
            err?.message?.includes("Quota limit exceeded") ||
            err?.message?.includes("Free daily write units")
          ) {
            markFirestoreQuotaExceeded();
            return;
          }
          if (
            err?.code === "cancelled" ||
            err?.code === 1 ||
            err?.message?.includes("CANCELLED") ||
            err?.message?.includes("Disconnecting idle stream") ||
            err?.message?.includes("Timed out waiting for new targets")
          ) {
            // Benign Firestore transport stream disconnection when stream is idle
            return;
          }
          console.warn("Bookings listener warning:", err);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (e) {
      console.warn("Could not initiate bookings listener:", e);
    }
  }, [isAdmin, dispatchNotification]);

  // 2. Real-time Stranger / Guest Detection (Khách thiết bị lạ không phải Admin)
  useEffect(() => {
    if (!isAdmin || !settings.strangerAlertEnabled) {
      return;
    }

    // STRICT FILTER: Exclude current user's session, admin roles, and admin devices
    const strangers = activeVisitors.filter(
      (v) =>
        v.id !== currentVisitorId &&
        v.role !== "admin" &&
        !v.isAdminDevice &&
        !v.visitorName.includes("👑") &&
        !v.visitorName.toLowerCase().includes("admin")
    );

    if (strangers.length > 0) {
      const now = Date.now();
      const timeSinceLast = (now - lastStrangerAlertTimeRef.current) / 1000;

      // Find any new stranger that hasn't been alerted yet
      const newStranger = strangers.find((s) => !alertedStrangerIdsRef.current.has(s.id));

      if (newStranger && timeSinceLast > 45) {
        alertedStrangerIdsRef.current.add(newStranger.id);
        lastStrangerAlertTimeRef.current = now;

        const dev = newStranger.device || "Thiết bị di động";
        const page = newStranger.currentPage || "Trang chủ Portfolio";
        const loc = stripIspFromName(newStranger.location || "Việt Nam");

        dispatchNotification({
          type: "stranger_visitor",
          title: "🚨 Khách Lạ Đang Xem Website!",
          message: `${dev} từ ${loc} vừa ghé thăm và đang xem "${page}". Hiện có ${strangers.length} khách trực tuyến.`,
          metadata: {
            visitorCount: strangers.length,
            popularPage: page,
            device: dev,
            browser: newStranger.browser,
            location: loc,
          },
        });
      }
    }
  }, [isAdmin, activeVisitors, currentVisitorId, settings.strangerAlertEnabled, dispatchNotification]);

  // 3. Real-time Live Visitors Surge / Traffic Spike Detection (Khách thật xem cùng lúc)
  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    // ONLY count real guest / stranger visitors - NEVER the admin's own viewing!
    const realGuests = activeVisitors.filter(
      (v) =>
        v.id !== currentVisitorId &&
        v.role !== "admin" &&
        !v.isAdminDevice &&
        !v.visitorName.includes("👑") &&
        !v.visitorName.toLowerCase().includes("admin")
    );

    // If no real guests are browsing (e.g. only admin viewing the site), NEVER notify!
    if (realGuests.length === 0) {
      lastSpikePeakCountRef.current = 0;
      return;
    }

    // Threshold can be set from 1+ real guests
    const threshold = Math.max(1, settings.spikeThreshold || 1);

    if (realGuests.length >= threshold) {
      const now = Date.now();
      const timeSinceLastSpike = (now - lastSpikeAlertTimeRef.current) / 1000;
      const isSubstantialJump = realGuests.length >= lastSpikePeakCountRef.current + 2;

      // Alert if cooldown elapsed (>120s) or count increased significantly
      if (timeSinceLastSpike > 120 || (isSubstantialJump && timeSinceLastSpike > 45)) {
        lastSpikeAlertTimeRef.current = now;
        lastSpikePeakCountRef.current = realGuests.length;

        const counts: Record<string, number> = {};
        realGuests.forEach((v) => {
          const page = v.currentPage || "Trang chủ";
          counts[page] = (counts[page] || 0) + 1;
        });

        let topPage = "Trang chủ";
        let maxCount = 0;
        Object.entries(counts).forEach(([page, c]) => {
          if (c > maxCount) {
            maxCount = c;
            topPage = page;
          }
        });

        const isSingleVisitor = realGuests.length === 1;

        dispatchNotification({
          type: "traffic_spike",
          title: isSingleVisitor ? "🔥 Có Khách Đang Xem Website!" : "🔥 Lượt Khách Xem Đang Tăng!",
          message: isSingleVisitor
            ? `Hiện có 1 khách đang xem website! Điểm nóng: "${topPage}".`
            : `Hiện đang có ${realGuests.length} khách đang xem website cùng lúc! Điểm nóng: "${topPage}" (${maxCount} người).`,
          metadata: {
            visitorCount: realGuests.length,
            popularPage: topPage,
          },
        });
      }
    } else if (realGuests.length < threshold) {
      lastSpikePeakCountRef.current = 0;
    }
  }, [isAdmin, activeVisitors, currentVisitorId, settings.spikeThreshold, dispatchNotification]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY_NOTIFS);
    } catch (_) {}
  }, []);

  const triggerTestNotification = useCallback(
    (type: NotificationType) => {
      if (!isAdmin) {
        console.warn("Chỉ Quản Trị Viên mới có quyền thử nghiệm chuông cảnh báo.");
        return;
      }
      if (type === "new_booking") {
        dispatchNotification({
          type: "new_booking",
          title: "📋 Đơn Đăng Ký Mới (Thử Nghiệm)",
          message:
            "Lớp 12A1 - THPT Chuyên Hà Nội Amsterdam vừa gửi đơn đặt lịch chụp Kỷ yếu Thanh Xuân ngày 28/05/2026.",
          metadata: {
            customerName: "Nguyễn Minh Anh",
            schoolName: "THPT Chuyên Hà Nội - Amsterdam",
            phone: "0988.123.456",
            date: "28/05/2026",
            conceptType: "THPT Chuyên Nghiệp",
          },
        });
      } else if (type === "stranger_visitor") {
        dispatchNotification({
          type: "stranger_visitor",
          title: "🚨 Khách Lạ Đang Xem Website! (Thử Nghiệm)",
          message:
            "Phát hiện thiết bị iPhone (iOS) từ Hà Nội đang xem album 'Kỷ Yếu Pre-Graduation'.",
          metadata: {
            visitorCount: 1,
            popularPage: "Pre-Graduation Album",
            device: "iPhone (iOS)",
            browser: "Apple Safari",
          },
        });
      } else {
        dispatchNotification({
          type: "traffic_spike",
          title: "🔥 Lượt Xem Đột Biến (Thử Nghiệm)",
          message:
            "Hệ thống ghi nhận 8 người xem cùng một lúc! Album đang hot: 'Kỷ Yếu Dạ Hội Prom Night 2026'.",
          metadata: {
            visitorCount: 8,
            popularPage: "Prom Night & Dạ Hội",
          },
        });
      }
    },
    [isAdmin, dispatchNotification]
  );

  const scrollToBookingSection = useCallback(() => {
    const el = document.getElementById("S9");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const safeNotifications = isAdmin ? notifications : [];
  const unreadCount = safeNotifications.filter((n) => !n.read).length;

  return (
    <AdminNotificationContext.Provider
      value={{
        notifications: safeNotifications,
        unreadCount,
        settings,
        activeBannerNotification: isAdmin ? activeBannerNotification : null,
        isNotificationCenterOpen: isAdmin ? isNotificationCenterOpen : false,
        setIsNotificationCenterOpen: (open: boolean) => {
          if (isAdmin) setIsNotificationCenterOpen(open);
        },
        markAsRead,
        markAllAsRead,
        clearNotifications,
        updateSettings,
        enableBrowserPush,
        backgroundPushStatus: pushStatus,
        enableBackgroundPush,
        disableBackgroundPush,
        triggerLockscreenTest,
        triggerTestNotification,
        dismissBanner,
        scrollToBookingSection,
        isAdmin,
      }}
    >
      {children}
    </AdminNotificationContext.Provider>
  );
};

export function useAdminNotification() {
  const context = useContext(AdminNotificationContext);
  if (!context) {
    throw new Error(
      "useAdminNotification must be used within an AdminNotificationProvider"
    );
  }
  return context;
}
