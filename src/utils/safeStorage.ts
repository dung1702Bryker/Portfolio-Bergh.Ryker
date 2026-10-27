/**
 * Safe Storage Wrapper for iOS Safari, WebViews (Zalo, Messenger, Facebook), and Private Browsing.
 * Prevents DOMException SecurityError when cookies or storage are blocked by browser security.
 */

const inMemoryStorage = new Map<string, string>();

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (_) {}
    return inMemoryStorage.get(key) ?? null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (_) {}
    inMemoryStorage.set(key, value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (_) {}
    inMemoryStorage.delete(key);
  },

  clear: (): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (_) {}
    inMemoryStorage.clear();
  },
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch (_) {}
    return inMemoryStorage.get(`session_${key}`) ?? null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        return;
      }
    } catch (_) {}
    inMemoryStorage.set(`session_${key}`, value);
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
        return;
      }
    } catch (_) {}
    inMemoryStorage.delete(`session_${key}`);
  },

  clear: (): void => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        window.sessionStorage.clear();
      }
    } catch (_) {}
  },
};

export const safeStorage = {
  local: safeLocalStorage,
  session: safeSessionStorage,
};

export default safeLocalStorage;
