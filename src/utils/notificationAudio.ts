/**
 * Web Audio API synthesizer for crisp, dependable in-browser chimes
 * without external audio file dependencies.
 */
export function playNotificationSound(type: "booking" | "surge" | "stranger" = "booking") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "booking") {
      // Pleasant double bell: 587.33Hz (D5) -> 880Hz (A5)
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.12);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === "stranger") {
      // Alert radar chime: 523.25Hz (C5) -> 783.99Hz (G5) -> 1046.5Hz (C6)
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.08);
      osc.frequency.setValueAtTime(1046.5, now + 0.18);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      // Noticeable 3-tone chime for traffic surge: 440Hz -> 659.25Hz -> 880Hz
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(880, now + 0.2);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.start(now);
      osc.stop(now + 0.55);
    }
  } catch (err) {
    console.warn("Could not play notification audio chime:", err);
  }
}

/**
 * Request HTML5 Desktop/Mobile Push Notification permission
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  try {
    if (Notification.permission === "granted") {
      return true;
    }
    if (Notification.permission !== "denied") {
      const res = await Notification.requestPermission();
      return res === "granted";
    }
    return false;
  } catch (e) {
    console.warn("Error requesting notification permission:", e);
    return false;
  }
}

/**
 * Dispatch native system push notification when tab is in background or active
 */
export function sendBrowserPushNotification(
  title: string,
  options?: NotificationOptions & { onClick?: () => void }
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      const n = new Notification(title, {
        icon: "/pwa-192x192.png",
        badge: "/apple-touch-icon.png",
        ...options,
      });

      n.onclick = () => {
        window.focus();
        if (options?.onClick) {
          options.onClick();
        }
        n.close();
      };
    }
  } catch (e) {
    console.warn("Failed to dispatch browser push notification:", e);
  }
}
