/**
 * Web Push Service for registering device subscriptions
 * and receiving background notifications when app is closed / screen is off.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushStatus {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  subscriptionEndpoint?: string;
  isIOSWithoutPWA?: boolean;
}

/**
 * Check if running on iOS outside of standalone PWA mode
 */
export function isIOSDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export async function getPushStatus(): Promise<PushStatus> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return {
      isSupported: false,
      permission: "unsupported",
      isSubscribed: false,
      isIOSWithoutPWA: isIOSDevice() && !isStandalonePWA(),
    };
  }

  const permission = Notification.permission;
  const isIOSNoPWA = isIOSDevice() && !isStandalonePWA();

  try {
    // Quick check using getRegistration without hanging on .ready
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      // Race .ready with a 1.5s timeout
      reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500)),
      ]);
    }

    if (!reg || !reg.pushManager) {
      return {
        isSupported: true,
        permission,
        isSubscribed: false,
        isIOSWithoutPWA: isIOSNoPWA,
      };
    }

    const subscription = await reg.pushManager.getSubscription();

    return {
      isSupported: true,
      permission,
      isSubscribed: !!subscription,
      subscriptionEndpoint: subscription?.endpoint,
      isIOSWithoutPWA: isIOSNoPWA,
    };
  } catch (err) {
    console.warn("[WebPush] Error getting push status:", err);
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
      isIOSWithoutPWA: isIOSNoPWA,
    };
  }
}

export async function subscribeAdminPushDevice(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return {
      success: false,
      error:
        "Trình duyệt này không hỗ trợ Web Push. Vui lòng mở bằng Google Chrome, Microsoft Edge, hoặc Safari (iOS 16.4+).",
    };
  }

  // Apple iOS Requirement: Web Push ONLY works when added to Home Screen
  if (isIOSDevice() && !isStandalonePWA()) {
    return {
      success: false,
      error:
        "Trên iPhone/iPad (iOS): Apple yêu cầu bạn bấm nút Chia sẻ (Share) ở dưới cùng Safari > chọn 'Thêm vào MH chính (Add to Home Screen)', sau đó mở app từ màn hình chính để nhận thông báo đẩy.",
    };
  }

  try {
    // 1. Request notification permission (must be triggered by user click)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        success: false,
        error:
          "Quyền thông báo đã bị từ chối hoặc chặn. Vui lòng vào Cài đặt trình duyệt để Cho phép (Allow) thông báo.",
      };
    }

    // 2. Ensure Service Worker is registered and active
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register("/sw-push-handler.js");
      await navigator.serviceWorker.ready;
    }

    // 3. Get VAPID public key from backend
    const vapidRes = await fetch("/api/push/vapid-public-key");
    if (!vapidRes.ok) {
      throw new Error("Không thể lấy khóa VAPID từ máy chủ backend.");
    }
    const { publicKey } = await vapidRes.json();
    if (!publicKey) {
      throw new Error("Khóa VAPID máy chủ bị rỗng.");
    }

    // 4. Check existing subscription or subscribe new
    let subscription = await registration.pushManager.getSubscription();

    // Verify key match to avoid stale or incompatible subscriptions
    if (subscription) {
      try {
        const rawKey = subscription.options?.applicationServerKey;
        if (rawKey) {
          const currentKeyBase64 = btoa(
            String.fromCharCode(...new Uint8Array(rawKey))
          )
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
          const targetKeyClean = publicKey.replace(/=+$/, "");
          if (currentKeyBase64 !== targetKeyClean) {
            console.log(
              "[WebPush] Khóa VAPID cũ không khớp với máy chủ. Đang làm mới đăng ký..."
            );
            await subscription.unsubscribe();
            subscription = null;
          }
        }
      } catch (keyErr) {
        console.warn("[WebPush] Không thể kiểm tra khóa subscription:", keyErr);
      }
    }

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    // 5. Send subscription to server
    const saveRes = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!saveRes.ok) {
      throw new Error("Lỗi lưu đăng ký thông báo trên máy chủ.");
    }

    localStorage.setItem("fap_admin_push_subscribed", "true");
    console.log("[WebPush] Subscribed device successfully for background notifications!");
    return { success: true };
  } catch (err: any) {
    console.error("[WebPush] Subscription error:", err);
    return {
      success: false,
      error: err.message || "Lỗi không xác định khi đăng ký thông báo đẩy.",
    };
  }
}

export async function unsubscribeAdminPushDevice(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.ready;
    }
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }

    localStorage.removeItem("fap_admin_push_subscribed");
    return true;
  } catch (err) {
    console.warn("[WebPush] Error unsubscribing:", err);
    return false;
  }
}

export async function requestTestLockscreenPush(delaySeconds = 4): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delay: delaySeconds }),
    });

    const data = await res.json();
    return { success: data.success, message: data.message };
  } catch (err: any) {
    return { success: false, message: err.message || "Không thể kết nối đến máy chủ" };
  }
}
