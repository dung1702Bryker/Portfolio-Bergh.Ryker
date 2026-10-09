import { useCallback, useSyncExternalStore } from "react";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  title?: string;
  createdAt: number;
}

let toastsStore: ToastItem[] = [];
const listeners = new Set<() => void>();
const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function dismissToast(id: string) {
  if (timerMap.has(id)) {
    clearTimeout(timerMap.get(id)!);
    timerMap.delete(id);
  }
  toastsStore = toastsStore.filter((t) => t.id !== id);
  notify();
}

export function dismissAllToasts() {
  timerMap.forEach((timer) => clearTimeout(timer));
  timerMap.clear();
  toastsStore = [];
  notify();
}

export function showToast(
  message: string,
  type: ToastType = "info",
  options?: number | { duration?: number; title?: string }
): string {
  const duration =
    typeof options === "number"
      ? options
      : options?.duration ?? (type === "error" ? 5500 : type === "warning" ? 5000 : 4000);
  const title = typeof options === "object" ? options?.title : undefined;
  const id = Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);

  // Maximum 5 concurrent toasts to maintain screen cleanliness
  if (toastsStore.length >= 5) {
    const oldest = toastsStore[0];
    if (oldest) {
      dismissToast(oldest.id);
    }
  }

  const newToast: ToastItem = {
    id,
    message,
    type,
    duration,
    title,
    createdAt: Date.now(),
  };

  toastsStore = [...toastsStore, newToast];
  notify();

  if (duration > 0 && type !== "loading") {
    const timer = setTimeout(() => {
      dismissToast(id);
    }, duration);
    timerMap.set(id, timer);
  }

  return id;
}

export const toast = {
  show: showToast,
  success: (message: string, duration?: number, title?: string) =>
    showToast(message, "success", { duration, title }),
  error: (message: string, duration?: number, title?: string) =>
    showToast(message, "error", { duration, title }),
  warning: (message: string, duration?: number, title?: string) =>
    showToast(message, "warning", { duration, title }),
  info: (message: string, duration?: number, title?: string) =>
    showToast(message, "info", { duration, title }),
  loading: (message: string, duration?: number, title?: string) =>
    showToast(message, "loading", { duration, title }),
  dismiss: dismissToast,
  dismissAll: dismissAllToasts,
};

export function useToast() {
  const toasts = useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => toastsStore,
    () => []
  );

  const boundShowToast = useCallback(
    (
      message: string,
      type: ToastType = "info",
      options?: number | { duration?: number; title?: string }
    ) => {
      return showToast(message, type, options);
    },
    []
  );

  const boundDismissToast = useCallback((id: string) => {
    dismissToast(id);
  }, []);

  return {
    toasts,
    showToast: boundShowToast,
    dismissToast: boundDismissToast,
    toast,
  };
}
