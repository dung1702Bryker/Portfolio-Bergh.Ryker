import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, setLogLevel } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Silence internal Firestore SDK debug logs to prevent console pollution
try {
  setLogLevel("silent");
} catch (_) {}

// Intercept benign internal Firestore gRPC stream disconnection logs and auth warnings
if (typeof console !== "undefined" && console.error) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const fullText = args
      .map((a) => (typeof a === "object" && a !== null ? (a.message || JSON.stringify(a)) : String(a)))
      .join(" ");
    if (
      fullText.includes("Disconnecting idle stream") ||
      fullText.includes("Timed out waiting for new targets") ||
      (fullText.includes("GrpcConnection") && fullText.includes("CANCELLED")) ||
      fullText.includes('"errors": [') ||
      fullText.includes('"error": {') ||
      fullText.includes("insufficientPermissions") ||
      fullText.includes("Insufficient Permission")
    ) {
      // Benign internal Firestore transport stream disconnection when stream is idle
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without this line
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || "ai-studio-01acd3e7-5d2e-492d-a9cc-c46484de9c60");
export const auth = getAuth();

// --- Google Workspace Auth for Google Drive & Google Calendar ---
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive'); // Google Drive scope
provider.addScope('https://www.googleapis.com/auth/calendar'); // Google Calendar scope
provider.addScope('https://www.googleapis.com/auth/calendar.events'); // Google Calendar Events scope
provider.addScope('https://www.googleapis.com/auth/tasks'); // Google Tasks scope
provider.addScope('https://www.googleapis.com/auth/gmail.send'); // Gmail Send scope

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'configs', 'googleToken'), { accessToken: cachedAccessToken, updatedAt: Date.now() });
    } catch(e) { console.error('Could not save token for cloud function', e); }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (error.code !== "auth/popup-closed-by-user" && error.code !== "auth/cancelled-popup-request") {
      console.error('Sign in error:', error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};
// --- END Google Workspace Auth ---

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let quotaExceededMemory = false;
const QUOTA_EXCEEDED_STORAGE_KEY = "firestore_quota_exhausted_timestamp";

/**
 * Check if Firestore free daily write limit (20,000 writes/day) has been reached
 */
export function isFirestoreQuotaExceeded(): boolean {
  if (quotaExceededMemory) return true;
  try {
    const item = localStorage.getItem(QUOTA_EXCEEDED_STORAGE_KEY) || sessionStorage.getItem(QUOTA_EXCEEDED_STORAGE_KEY);
    if (item) {
      const timestamp = parseInt(item, 10);
      // Back off writes for 45 minutes once quota is exhausted
      if (Date.now() - timestamp < 45 * 60 * 1000) {
        quotaExceededMemory = true;
        return true;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * Mark Firestore quota as exceeded to prevent cascading retry storm & console spam
 */
export function markFirestoreQuotaExceeded(): void {
  if (!quotaExceededMemory) {
    quotaExceededMemory = true;
    console.warn(
      "[Firestore Quota Circuit Breaker] Free daily write quota reached (20,000 writes/day). Seamlessly pausing non-critical background writes (heartbeats/analytics) to prevent error backoff loops."
    );
  }
  try {
    const now = String(Date.now());
    localStorage.setItem(QUOTA_EXCEEDED_STORAGE_KEY, now);
    sessionStorage.setItem(QUOTA_EXCEEDED_STORAGE_KEY, now);
  } catch (_) {}
}

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason || "");
    const code = reason?.code || "";
    if (
      code === "resource-exhausted" ||
      msg.includes("Quota limit exceeded") ||
      msg.includes("Free daily write units")
    ) {
      markFirestoreQuotaExceeded();
      event.preventDefault();
      return;
    }
    if (
      code === "cancelled" ||
      code === 1 ||
      msg.includes("CANCELLED") ||
      msg.includes("Disconnecting idle stream") ||
      msg.includes("Timed out waiting for new targets")
    ) {
      // Benign stream cancellation from idle stream timeout
      event.preventDefault();
      return;
    }
  });
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code || "";

  // Ignore benign internal idle stream disconnection (Code: 1 Message: 1 CANCELLED: Disconnecting idle stream)
  if (
    errCode === "cancelled" ||
    errCode === 1 ||
    errMsg.includes("CANCELLED") ||
    errMsg.includes("Disconnecting idle stream") ||
    errMsg.includes("Timed out waiting for new targets")
  ) {
    return {
      error: "cancelled: idle stream disconnected",
      authInfo: {},
      operationType,
      path,
    };
  }

  // If daily free quota is exhausted, trip circuit breaker and avoid spamming console
  if (
    errCode === "resource-exhausted" ||
    errMsg.includes("Quota limit exceeded") ||
    errMsg.includes("Free daily write units")
  ) {
    markFirestoreQuotaExceeded();
    return {
      error: "resource-exhausted: Quota limit exceeded",
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path,
    };
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  // Return the error info instead of throwing it to avoid crashing the app asynchronously
  return errInfo;
}

async function testConnection() {
  try {
    // Validate Connection to Firestore
    if (!isFirestoreQuotaExceeded()) {
      await getDocFromServer(doc(db, "test", "connection"));
    }
  } catch (error: any) {
    if (
      error?.code === "resource-exhausted" ||
      error?.message?.includes("Quota limit exceeded")
    ) {
      markFirestoreQuotaExceeded();
      return;
    }
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

testConnection();
