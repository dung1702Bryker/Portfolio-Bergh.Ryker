import { useState, useEffect } from "react";
import { auth } from "../firebase";
import {
  onAuthStateChanged,
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { safeLocalStorage, safeSessionStorage } from "../utils/safeStorage";

const ADMIN_EMAILS = ["nguyenducdung1702@gmail.com", "berghryker2@gmail.com"];

export const isAuthorizedAdmin = (claims: any, email?: string | null) => {
  return claims?.admin === true || (email && ADMIN_EMAILS.includes(email));
};

export function isStoredAdminDevice(): boolean {
  try {
    return (
      safeLocalStorage.getItem("admin_device_verified") === "true" ||
      safeSessionStorage.getItem("admin_logged_in") === "true"
    );
  } catch (_) {
    return false;
  }
}

// Kiểm tra xem trang có đang ở chế độ công khai cho khách hàng (chọn ảnh hoặc xem vé booking) hay không
export function checkIsPublicCustomerRoute(): boolean {
  try {
    if (typeof window !== "undefined") {
      const s = window.location.search || "";
      const p = window.location.pathname || "";
      const h = window.location.hash || "";
      return (
        s.includes("proofing=") ||
        s.includes("proof=") ||
        s.includes("album_proof=") ||
        s.includes("album=") ||
        s.includes("booking=") ||
        s.includes("bookingCode=") ||
        s.includes("bookingId=") ||
        s.includes("code=") ||
        p.startsWith("/proofing/") ||
        p.startsWith("/albums/") ||
        p.startsWith("/booking/") ||
        h.includes("/proofing/") ||
        h.includes("/albums/") ||
        h.includes("/booking/")
      );
    }
  } catch (_) {}
  return false;
}

export function useAdminAuth(disabled?: boolean) {
  const isBypassed = Boolean(disabled || checkIsPublicCustomerRoute());
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    if (isBypassed) return false;
    return isStoredAdminDevice();
  });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isBypassed);

  useEffect(() => {
    // KHÔNG khởi tạo Firebase Auth hoặc onAuthStateChanged trên trang công khai của khách
    if (isBypassed) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      if (currUser) {
        try {
          // Force refresh to ensure we have the latest claims
          const token = await currUser.getIdTokenResult(true);
          if (isAuthorizedAdmin(token.claims, currUser.email)) {
            setIsAdmin(true);
            setUser(currUser);
            try {
              safeLocalStorage.setItem("admin_device_verified", "true");
              if (currUser.email) safeLocalStorage.setItem("admin_email", currUser.email);
            } catch (_) {}
          } else {
            setIsAdmin(false);
            setUser(null);
            try {
              safeLocalStorage.removeItem("admin_device_verified");
              safeLocalStorage.removeItem("admin_email");
            } catch (_) {}
          }
        } catch (error: any) {
          if (error.code !== "auth/network-request-failed") {
            console.error("Error getting token result", error);
          }
          setIsAdmin(false);
          setUser(null);
        }
      } else {
        setIsAdmin(false);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);

      // Force refresh to ensure we get the latest token logic
      const token = await result.user.getIdTokenResult(true);
      if (!isAuthorizedAdmin(token.claims, result.user.email)) {
        await auth.signOut();
        throw new Error(
          "Tài khoản này không có quyền truy cập quản trị! Yêu cầu phân quyền Admin.",
        );
      }
      setIsAdmin(true);
      setUser(result.user);
      try {
        safeLocalStorage.setItem("admin_device_verified", "true");
        if (result.user.email) safeLocalStorage.setItem("admin_email", result.user.email);
      } catch (_) {}
      return { success: true };
    } catch (err: any) {
      if (
        err?.code === "auth/popup-closed-by-user" ||
        err?.code === "auth/cancelled-popup-request" ||
        err?.code === "auth/popup-blocked" ||
        err?.message?.includes("popup")
      ) {
        return { cancelled: true };
      }
      throw err;
    }
  };

  const loginWithEmailPassword = async (email: string, pass: string) => {
    const trimmedEmail = email.trim();
    const result = await signInWithEmailAndPassword(auth, trimmedEmail, pass);
    const token = await result.user.getIdTokenResult(true);
    
    if (!isAuthorizedAdmin(token.claims, result.user.email)) {
      await auth.signOut();
      throw new Error(
        "Tài khoản này không có quyền truy cập quản trị! Yêu cầu phân quyền Admin.",
      );
    }
    setIsAdmin(true);
    setUser(result.user);
    try {
      safeLocalStorage.setItem("admin_device_verified", "true");
      if (result.user.email) safeLocalStorage.setItem("admin_email", result.user.email);
    } catch (_) {}
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    setIsAdmin(false);
    setUser(null);
    try {
      safeLocalStorage.removeItem("admin_device_verified");
      safeLocalStorage.removeItem("admin_email");
    } catch (_) {}
  };

  return { isAdmin, user, loading, login, loginWithEmailPassword, logout };
}
