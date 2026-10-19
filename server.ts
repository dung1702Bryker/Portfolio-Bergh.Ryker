import express from "express";
import compression from "compression";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import http from "http";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, setLogLevel } from "firebase/firestore";
import webpush from "web-push";
import fs from "fs";

// @ts-ignore

dotenv.config();

try {
  setLogLevel("silent");
} catch (_) {}

// Intercept benign internal Firestore gRPC stream disconnection logs and external email service status
if (typeof console !== "undefined") {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  const isBenign = (fullText: string) =>
    fullText.includes("Disconnecting idle stream") ||
    fullText.includes("Timed out waiting for new targets") ||
    (fullText.includes("GrpcConnection") && fullText.includes("CANCELLED")) ||
    fullText.includes("FormSubmit") ||
    fullText.includes("500 Internal Server Error") ||
    fullText.includes('"errors": [') ||
    fullText.includes('"error": {') ||
    fullText.includes("insufficientPermissions") ||
    fullText.includes("Insufficient Permission");

  if (originalConsoleError) {
    console.error = (...args: any[]) => {
      const fullText = args
        .map((a) => (typeof a === "object" && a !== null ? (a.message || JSON.stringify(a)) : String(a)))
        .join(" ");
      if (isBenign(fullText)) return;
      originalConsoleError.apply(console, args);
    };
  }

  if (originalConsoleWarn) {
    console.warn = (...args: any[]) => {
      const fullText = args
        .map((a) => (typeof a === "object" && a !== null ? (a.message || JSON.stringify(a)) : String(a)))
        .join(" ");
      if (isBenign(fullText)) return;
      originalConsoleWarn.apply(console, args);
    };
  }
}

// Circuit breaker for FormSubmit external outage
let formSubmitOutageUntil = 0;

let db: any = null;
try {
  if (fs.existsSync("./firebase-applet-config.json")) {
    const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
    const app = initializeApp(config);
    db = getFirestore(app, config.firestoreDatabaseId || "ai-studio-01acd3e7-5d2e-492d-a9cc-c46484de9c60");
    console.log("Firestore initialized successfully on server.ts with database ID:", config.firestoreDatabaseId || "ai-studio-01acd3e7-5d2e-492d-a9cc-c46484de9c60");
  } else {
    console.warn("firebase-applet-config.json not found on server.");
  }
} catch (e) {
  console.error("Error initializing Firestore on server:", e);
}

// --- GOOGLE WORKSPACE SYNC HELPERS FOR SEPAY WEBHOOK AUTO-APPROVAL ---
const TIME_SLOTS = [
  { id: 1, name: "Slot 1", time: "07:15 - 09:15" },
  { id: 2, name: "Slot 2", time: "09:25 - 11:25" },
  { id: 3, name: "Slot 3", time: "12:00 - 14:00" },
  { id: 4, name: "Slot 4", time: "14:10 - 16:10" },
  { id: 5, name: "Slot 5", time: "16:20 - 18:20" },
  { id: 6, name: "Slot 6", time: "18:30 - 20:30" },
];

const getConceptVietnameseName = (concept?: string) => {
  if (concept === "THPT") return "Kỷ yếu THPT";
  if (concept === "University") return "Gói PRE-GRADUATION";
  if (concept === "Event") return "Event & Prom Night";
  if (concept === "Custom") return "Theo yêu cầu";
  return concept || "";
};

const getActivePrice = (size: number, isFull: boolean) => {
  if (size === 1) return isFull ? 1500000 : 900000;
  if (size === 2) return isFull ? 800000 : 700000;
  if (size === 3) return isFull ? 700000 : 600000;
  if (size <= 5) return isFull ? 600000 : 500000;
  return isFull ? 600000 : 500000;
};

const formatDateDMY = (dateStr?: string) => {
  if (!dateStr) return "Chưa có";
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts[0].length <= 2 && parts[2]?.length === 4) {
      return dateStr;
    }
  }
  const separator = dateStr.includes("-") ? "-" : "/";
  const parts = dateStr.split(separator);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [y, m, d] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    } else if (parts[2].length === 4) {
      const [d, m, y] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
  }
  return dateStr;
};

const syncToGoogleCalendarServer = async (booking: any, token: string) => {
  let slot = booking.timeSlot || "";
  const numId = parseInt(slot, 10);
  if (!isNaN(numId) && numId >= 1 && numId <= 6) {
    const found = TIME_SLOTS.find((s) => s.id === numId);
    if (found) {
      slot = `${found.name} (${found.time})`;
    }
  }

  let startDateTime = `${booking.date}T08:00:00`;
  let endDateTime = `${booking.date}T11:00:00`;

  const colonMatch = slot.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  const hMatch = slot.match(/(\d+)h(\d*)\s*-\s*(\d+)h(\d*)/);

  if (colonMatch) {
    const startH = colonMatch[1].padStart(2, "0");
    const startM = colonMatch[2];
    const endH = colonMatch[3].padStart(2, "0");
    const endM = colonMatch[4];
    startDateTime = `${booking.date}T${startH}:${startM}:00`;
    endDateTime = `${booking.date}T${endH}:${endM}:00`;
  } else if (hMatch) {
    const startH = hMatch[1].padStart(2, "0");
    const startM = (hMatch[2] || "00").padEnd(2, "0");
    const endH = hMatch[3].padStart(2, "0");
    const endM = (hMatch[4] || "00").padEnd(2, "0");
    startDateTime = `${booking.date}T${startH}:${startM}:00`;
    endDateTime = `${booking.date}T${endH}:${endM}:00`;
  } else if (slot.toLowerCase().includes("cả ngày")) {
    startDateTime = `${booking.date}T07:00:00`;
    endDateTime = `${booking.date}T17:00:00`;
  } else if (slot.toLowerCase().includes("nửa ngày chiều")) {
    startDateTime = `${booking.date}T13:00:00`;
    endDateTime = `${booking.date}T17:00:00`;
  } else {
    const timeMatch = slot.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const h = timeMatch[1].padStart(2, "0");
      const m = timeMatch[2];
      startDateTime = `${booking.date}T${h}:${m}:00`;
      const endHour = (parseInt(h) + 4).toString().padStart(2, "0");
      endDateTime = `${booking.date}T${endHour}:${m}:00`;
    }
  }

  const packageLabel = getConceptVietnameseName(booking.conceptType);
  const eventTitle = `[BERGH.RYKER] [${packageLabel}] [Ca: ${slot}] - ${booking.schoolName}`;
  const pricingUnit =
    booking.conceptType === "THPT" || booking.conceptType === "University"
      ? getActivePrice(
          booking.classSize,
          booking.timeSlot?.toLowerCase().includes("cả ngày") || false,
        )
      : 0;
  const pricingText =
    pricingUnit > 0
      ? `• Tổng tạm tính (${booking.classSize} người): ${(booking.classSize * pricingUnit).toLocaleString("vi-VN")} đ (Đơn giá: ${(pricingUnit / 1000).toLocaleString("vi-VN")}k/người)`
      : `• Gói chụp: ${packageLabel}. Chi phí cụ thể sẽ được tư vấn trực tiếp`;

  const createdAtDateVal = booking.createdAt?.toMillis 
    ? booking.createdAt.toMillis() 
    : (booking.createdAt?.seconds ? booking.createdAt.seconds * 1000 : Date.now());

  const eventDescription = `=== THÔNG TIN ĐẶT LỊCH ===
• Khách hàng: ${booking.schoolName}
• Quy mô nhóm: ${booking.classSize} người
• Gói chụp / Concept: ${packageLabel}
• Thời gian chụp: ${slot}
• Ngày chụp: ${formatDateDMY(booking.date)}
• Địa chỉ: ${booking.address || "Chưa có"}
• Liên hệ (Zalo/Insta): ${booking.instagramOrZalo}
• Số điện thoại: ${booking.phone || "Chưa có"}
• Lưu ý / Ghi chú: ${booking.notes || "Không có"}
• Yêu cầu concept riêng: ${booking.customRequest || "Không có"}
${pricingText}

Đã duyệt từ Website hệ thống Bergh.Ryker.
Mã Booking: ${booking.id}
Tạo lúc: ${new Date(createdAtDateVal).toLocaleString("vi-VN")}`;

  const eventBody = {
    summary: eventTitle,
    location: booking.address || "Địa điểm thoả thuận",
    description: eventDescription,
    start: {
      dateTime: startDateTime,
      timeZone: "Asia/Ho_Chi_Minh",
    },
    end: {
      dateTime: endDateTime,
      timeZone: "Asia/Ho_Chi_Minh",
    },
    status: "confirmed",
    reminders: {
      useDefault: true,
    },
  };

  const method = booking.googleEventId ? "PUT" : "POST";
  const endpoint = booking.googleEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${booking.googleEventId}`
    : "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  const res = await fetch(endpoint, {
    method: method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });

  if (!res.ok) {
    const errRes = await res.json().catch(() => ({}));
    const msg = errRes.error?.message || "Lỗi API Google Calendar";
    throw new Error(msg);
  }

  return await res.json();
};

const syncToGoogleTasksServer = async (booking: any, token: string) => {
  let slot = booking.timeSlot || "";
  const numId = parseInt(slot, 10);
  if (!isNaN(numId) && numId >= 1 && numId <= 6) {
    const found = TIME_SLOTS.find((s) => s.id === numId);
    if (found) {
      slot = `${found.name} (${found.time})`;
    }
  }

  const packageLabel = getConceptVietnameseName(booking.conceptType);
  const taskTitle = `Chụp ảnh: ${booking.schoolName} - [${packageLabel}] [Ca: ${slot}]`;
  const pricingUnit =
    booking.conceptType === "THPT" || booking.conceptType === "University"
      ? getActivePrice(
          booking.classSize,
          booking.timeSlot?.toLowerCase().includes("cả ngày") || false,
        )
      : 0;
  const pricingText =
    pricingUnit > 0
      ? `• Tổng tạm tính (${booking.classSize} người): ${(booking.classSize * pricingUnit).toLocaleString("vi-VN")} đ`
      : `• Gói chụp: ${packageLabel}`;

  const taskNotes = `=== NHIỆM VỤ CHỤP ẢNH ===
• Khách hàng: ${booking.schoolName}
• Quy mô: ${booking.classSize} người
• Gói chụp / Concept: ${packageLabel}
• Ca chụp: ${slot}
• Ngày chụp: ${formatDateDMY(booking.date)}
• Địa chỉ: ${booking.address || "Chưa có"}
• SĐT: ${booking.phone || "Chưa có"}
• Liên hệ (Zalo/Insta): ${booking.instagramOrZalo}
• Ghi chú: ${booking.notes || "Không có"}
${pricingText}

Đã duyệt từ Website hệ thống Bergh.Ryker.
Mã Booking: ${booking.id}`;

  let dueString: string | undefined = undefined;
  if (booking.date) {
    dueString = `${booking.date}T12:00:00.000Z`;
  }

  const taskBody = {
    ...(booking.googleTaskId ? { id: booking.googleTaskId } : {}),
    title: taskTitle,
    notes: taskNotes,
    ...(dueString ? { due: dueString } : {}),
  };

  const method = booking.googleTaskId ? "PUT" : "POST";
  const endpoint = booking.googleTaskId
    ? `https://www.googleapis.com/tasks/v1/lists/@default/tasks/${booking.googleTaskId}`
    : "https://www.googleapis.com/tasks/v1/lists/@default/tasks";

  const res = await fetch(endpoint, {
    method: method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(taskBody),
  });

  if (!res.ok) {
    const errRes = await res.json().catch(() => ({}));
    const msg = errRes?.error?.message || "Lỗi API Google Tasks";
    throw new Error(msg);
  }

  return await res.json();
};

async function startServer() {
  const app = express();
  // Trust proxy for Google Cloud Run, GFE, Cloudflare, and reverse proxies so req.ip and x-forwarded-for are accurate
  app.set("trust proxy", true);
  const portArgIndex = process.argv.indexOf("--port");
  const cliPort =
    portArgIndex !== -1 && process.argv[portArgIndex + 1]
      ? parseInt(process.argv[portArgIndex + 1], 10)
      : null;
  const PORT = Number(cliPort || process.env.PORT || 3000);

  const hostArgIndex = process.argv.indexOf("--host");
  const cliHost =
    hostArgIndex !== -1 && process.argv[hostArgIndex + 1]
      ? process.argv[hostArgIndex + 1]
      : (process.env.HOST || "0.0.0.0");
  const HOST = cliHost;

  const server = http.createServer(app);

  app.use(compression());
  app.use(express.json());

  // --- WEB PUSH NOTIFICATION SUBSYSTEM FOR BACKGROUND ALERTS ---
  const VAPID_PUBLIC_KEY =
    process.env.VAPID_PUBLIC_KEY ||
    "BJjlsaN3czEKWU2U81BGNepkQ_6vqzFjo-Wc4WeOnIPsisTWi6g2G4l65eNEO3h3LeSEhz8xo4gA9CbBO47RA-k";
  const VAPID_PRIVATE_KEY =
    process.env.VAPID_PRIVATE_KEY || "x6DWLYHlRZbN3LhnUfJVtBBMjye8W8jsWxj9MxYGf1A";
  const VAPID_SUBJECT = "mailto:nguyenducdung1702@gmail.com";

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log("[WebPush] VAPID details configured successfully.");
  } catch (err: any) {
    console.error("[WebPush] Error setting VAPID details:", err.message);
  }

  const adminPushSubscriptions = new Map<string, any>();

  const loadStoredPushSubscriptions = async () => {
    if (!db) return;
    try {
      const snap = await getDocs(collection(db, "admin_push_subscriptions"));
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.endpoint && data.keys) {
          adminPushSubscriptions.set(data.endpoint, data);
        }
      });
      console.log(`[WebPush] Loaded ${adminPushSubscriptions.size} push subscriptions from Firestore.`);
    } catch (err: any) {
      console.warn("[WebPush] Could not load stored push subscriptions:", err.message);
    }
  };
  loadStoredPushSubscriptions();

  async function sendPushNotificationToAdmins(payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
  }) {
    if (adminPushSubscriptions.size === 0) {
      console.log("[WebPush] No admin devices registered for push notifications yet.");
      return;
    }

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      tag: payload.tag || ("alert-" + Date.now()),
    });

    const deadEndpoints: string[] = [];
    console.log(`[WebPush] Sending push to ${adminPushSubscriptions.size} registered devices: "${payload.title}"`);

    for (const [endpoint, sub] of adminPushSubscriptions.entries()) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payloadString,
          {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: "high",
          }
        );
        console.log(`[WebPush] Push sent successfully to ${endpoint.slice(0, 45)}...`);
      } catch (err: any) {
        console.warn(`[WebPush] Delivery failed to ${endpoint.slice(0, 45)}:`, err.statusCode, err.message);
        if (err.statusCode === 404 || err.statusCode === 410) {
          deadEndpoints.push(endpoint);
        }
      }
    }

    // Clean up expired subscriptions
    for (const ep of deadEndpoints) {
      adminPushSubscriptions.delete(ep);
      if (db) {
        try {
          const hash = Buffer.from(ep).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
          await deleteDoc(doc(db, "admin_push_subscriptions", hash));
        } catch (_) {}
      }
    }
  }

  // Active visitors tracker in server memory for stranger & surge detection
  const serverActiveVisitors = new Map<
    string,
    {
      role: string;
      device?: string;
      browser?: string;
      page?: string;
      location?: string;
      isAdminDevice: boolean;
      lastSeen: number;
    }
  >();

  let lastStrangerPushTime = 0;
  let lastSurgePushTime = 0;
  const alertedStrangerVisitors = new Set<string>();

  // 1. Get VAPID public key
  app.get("/api/push/vapid-public-key", (_req, res) => {
    return res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // 2. Subscribe device
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { subscription, userAgent } = req.body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: "Invalid subscription object" });
      }

      const subData = {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent: userAgent || "",
        updatedAt: Date.now(),
      };

      adminPushSubscriptions.set(subscription.endpoint, subData);

      if (db) {
        try {
          const hash = Buffer.from(subscription.endpoint).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
          await setDoc(doc(db, "admin_push_subscriptions", hash), subData, { merge: true });
        } catch (dbErr: any) {
          console.warn("[WebPush] Could not persist subscription to Firestore:", dbErr.message);
        }
      }

      console.log(`[WebPush] Successfully subscribed admin device! Total: ${adminPushSubscriptions.size}`);
      return res.json({ success: true, count: adminPushSubscriptions.size });
    } catch (err: any) {
      console.error("[WebPush] Subscribe error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. Unsubscribe device
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        adminPushSubscriptions.delete(endpoint);
        if (db) {
          try {
            const hash = Buffer.from(endpoint).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
            await deleteDoc(doc(db, "admin_push_subscriptions", hash));
          } catch (_) {}
        }
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 4. Test lockscreen push with optional delay
  app.post("/api/push/test", async (req, res) => {
    try {
      const delay = Number(req.body.delay || 0);
      const delayMs = Math.max(0, delay * 1000);

      setTimeout(() => {
        sendPushNotificationToAdmins({
          title: "🔔 Thử Nghiệm Màn Hình Khóa",
          body: "Thông báo đẩy ngầm hoạt động hoàn hảo ngay cả khi bạn tắt máy hoặc thoát ứng dụng! 🚀",
          url: "/",
          tag: "test-lockscreen-" + Date.now(),
        });
      }, delayMs);

      return res.json({
        success: true,
        message: delay > 0 ? `Sẽ bắn thông báo sau ${delay} giây. Hãy khóa máy ngay!` : "Đã gửi thông báo!",
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Debug Geo Endpoint
  app.get("/api/debug-geo", (req, res) => {
    const publicIp = extractPublicClientIp(req);
    return res.json({
      detectedPublicIp: publicIp,
      maskedIp: publicIp ? maskIp(publicIp) : "N/A",
      headers: {
        "x-forwarded-for": req.headers["x-forwarded-for"],
        "cf-connecting-ip": req.headers["cf-connecting-ip"],
        "x-real-ip": req.headers["x-real-ip"],
        "x-client-ip": req.headers["x-client-ip"],
        "fastly-client-ip": req.headers["fastly-client-ip"],
      },
      expressIp: req.ip,
      expressIps: req.ips,
      socketRemoteAddress: req.socket?.remoteAddress,
    });
  });

  // Private / internal IP detection
  function isPrivateIp(ip: string): boolean {
    if (!ip) return true;
    let clean = ip.trim();
    if (clean.startsWith("::ffff:")) {
      clean = clean.replace(/^::ffff:/, "");
    }
    if (clean === "127.0.0.1" || clean === "localhost" || clean === "::1") return true;
    // 10.0.0.0/8
    if (clean.startsWith("10.")) return true;
    // 192.168.0.0/16
    if (clean.startsWith("192.168.")) return true;
    // 169.254.0.0/16 (Link-local, GCP / AWS internal metadata & balancer)
    if (clean.startsWith("169.254.")) return true;
    // 100.64.0.0/10 (CGNAT)
    if (clean.startsWith("100.")) {
      const parts = clean.split(".");
      if (parts.length >= 2) {
        const second = parseInt(parts[1], 10);
        if (second >= 64 && second <= 127) return true;
      }
    }
    // 172.16.0.0/12
    if (clean.startsWith("172.")) {
      const parts = clean.split(".");
      if (parts.length >= 2) {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
      }
    }
    const lower = clean.toLowerCase();
    if (lower.startsWith("fc00:") || lower.startsWith("fd") || lower.startsWith("fe80:")) {
      return true;
    }
    return false;
  }

  // Extract true client public IP behind Cloud Run / GFE / Cloudflare / reverse proxy
  function extractPublicClientIp(req: express.Request): string | null {
    // 1. Cloudflare header (highest priority if deployed behind Cloudflare CDN)
    const cfIp = req.headers["cf-connecting-ip"];
    if (typeof cfIp === "string") {
      const clean = cfIp.trim().replace(/^::ffff:/, "");
      if (clean && !isPrivateIp(clean)) return clean;
    }

    // 2. Standard X-Real-IP
    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string") {
      const clean = realIp.trim().replace(/^::ffff:/, "");
      if (clean && !isPrivateIp(clean)) return clean;
    }

    // 3. X-Forwarded-For: Client IP is strictly the FIRST non-private IP from the LEFT
    // Format: <client-ip>, <proxy1-ip>, <proxy2-ip>
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const parts = forwarded.split(",");
      for (const part of parts) {
        const trimmed = part.trim().replace(/^::ffff:/, "");
        if (trimmed && !isPrivateIp(trimmed)) {
          return trimmed;
        }
      }
    } else if (Array.isArray(forwarded)) {
      for (const part of forwarded) {
        const trimmed = String(part).trim().replace(/^::ffff:/, "");
        if (trimmed && !isPrivateIp(trimmed)) {
          return trimmed;
        }
      }
    }

    // 4. req.ips (populated by Express when app.set('trust proxy', true) is active)
    if (Array.isArray(req.ips) && req.ips.length > 0) {
      for (const ip of req.ips) {
        const clean = ip.replace(/^::ffff:/, "").trim();
        if (!isPrivateIp(clean)) return clean;
      }
    }

    // 5. req.ip
    if (req.ip) {
      const clean = req.ip.replace(/^::ffff:/, "").trim();
      if (!isPrivateIp(clean)) return clean;
    }

    // 6. req.socket.remoteAddress
    if (req.socket && req.socket.remoteAddress) {
      const clean = req.socket.remoteAddress.replace(/^::ffff:/, "").trim();
      if (!isPrivateIp(clean)) return clean;
    }

    return null;
  }

  // Mask IP for privacy (GDPR / Personal Data Protection compliance)
  function maskIp(ip: string): string {
    if (!ip) return "";
    if (ip.includes(".")) {
      const parts = ip.split(".");
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
      }
    }
    if (ip.includes(":")) {
      const parts = ip.split(":");
      return parts.slice(0, 3).join(":") + ":xxxx:xxxx";
    }
    return ip;
  }

  // Vietnam 63 Provinces Reference List
  const VIETNAM_PROVINCES_SERVER = [
    {
      names: [
        "quang ninh", "quảng ninh", "ha long", "halong", "hạ long", "cam pha", "campha", "cẩm phả",
        "uong bi", "uông bí", "mong cai", "móng cái", "quang yen", "quảng yên", "dong trieu", "đông triều",
        "van don", "vân đồn", "tien yen", "tiên yên", "co to", "cô tô", "bai chay", "bãi cháy", "hon gai", "hòn gai"
      ],
      displayName: "Quảng Ninh",
    },
    {
      names: ["hai phong", "haiphong", "hải phòng", "cát bà", "đồ sơn", "thủy nguyên", "an dương", "kiến an"],
      displayName: "Hải Phòng",
    },
    { names: ["hai duong", "hải dương", "chí linh", "kinh môn"], displayName: "Hải Dương" },
    { names: ["hung yen", "hưng yên", "mỹ hào", "khoái châu", "văn giang"], displayName: "Hưng Yên" },
    { names: ["bac ninh", "bắc ninh", "từ sơn", "thuận thành", "quế võ", "yên phong"], displayName: "Bắc Ninh" },
    { names: ["bac giang", "bắc giang", "việt yên", "hiệp hòa"], displayName: "Bắc Giang" },
    { names: ["thai binh", "thái bình", "tiền hải", "vũ thư", "quỳnh phụ", "đông hưng"], displayName: "Thái Bình" },
    { names: ["nam dinh", "nam định", "ý yên", "giao thủy", "hải hậu"], displayName: "Nam Định" },
    { names: ["ninh binh", "ninh bình", "tam điệp", "hoa lư", "nho quan"], displayName: "Ninh Bình" },
    { names: ["ha nam", "hà nam", "phu ly", "phủ lý", "duy tiên", "kim bảng"], displayName: "Hà Nam" },
    { names: ["vinh phuc", "vĩnh phúc", "vĩnh yên", "phúc yên"], displayName: "Vĩnh Phúc" },
    { names: ["phu tho", "phú thọ", "việt trì"], displayName: "Phú Thọ" },
    { names: ["thai nguyen", "thái nguyên", "sông công", "phổ yên"], displayName: "Thái Nguyên" },
    { names: ["tuyen quang", "tuyên quang"], displayName: "Tuyên Quang" },
    { names: ["ha giang", "hà giang"], displayName: "Hà Giang" },
    { names: ["cao bang", "cao bằng"], displayName: "Cao Bằng" },
    { names: ["bac kan", "bắc kạn"], displayName: "Bắc Kạn" },
    { names: ["lang son", "lạng sơn", "đồng đăng"], displayName: "Lạng Sơn" },
    { names: ["lao cai", "lào cai", "sa pa", "sapa"], displayName: "Lào Cai" },
    { names: ["yen bai", "yên bái"], displayName: "Yên Bái" },
    { names: ["hoa binh", "hòa bình"], displayName: "Hòa Bình" },
    { names: ["son la", "sơn la", "mộc châu"], displayName: "Sơn La" },
    { names: ["dien bien", "điện biên", "dien bien phu"], displayName: "Điện Biên" },
    { names: ["lai chau", "lai châu"], displayName: "Lai Châu" },
    {
      names: ["hanoi", "ha noi", "hà nội", "cầu giấy", "ba đình", "hoàn kiếm", "đống đa", "hà đông", "thanh xuân", "tây hồ", "hoàng mai", "long biên"],
      displayName: "Hà Nội",
    },
    { names: ["thanh hoa", "thanh hóa", "sầm sơn", "bỉm sơn"], displayName: "Thanh Hóa" },
    { names: ["nghe an", "nghệ an", "vinh", "cửa lò"], displayName: "Nghệ An" },
    { names: ["ha tinh", "hà tĩnh", "hồng lĩnh", "kỳ anh", "song tri"], displayName: "Hà Tĩnh" },
    { names: ["quang binh", "quảng bình", "đồng hới"], displayName: "Quảng Bình" },
    { names: ["quang tri", "quảng trị", "đông hà"], displayName: "Quảng Trị" },
    { names: ["thua thien hue", "thừa thiên huế", "tp huế", "hue", "huế"], displayName: "TP. Huế" },
    { names: ["da nang", "danang", "đà nẵng", "hải châu", "sơn trà", "ngũ hành sơn", "thanh khê", "cẩm lệ"], displayName: "Đà Nẵng" },
    { names: ["quang nam", "quảng nam", "hội an", "tam kỳ"], displayName: "Quảng Nam" },
    { names: ["quang ngai", "quảng ngãi"], displayName: "Quảng Ngãi" },
    { names: ["binh dinh", "bình định", "quy nhơn", "quy nhon"], displayName: "Bình Định" },
    { names: ["phu yen", "phú yên", "tuy hòa", "tuy hoa"], displayName: "Phú Yên" },
    { names: ["khanh hoa", "khánh hòa", "nha trang", "cam ranh"], displayName: "Khánh Hòa" },
    { names: ["ninh thuan", "ninh thuận", "phan rang"], displayName: "Ninh Thuận" },
    { names: ["binh thuan", "bình thuận", "phan thiết", "la gi"], displayName: "Bình Thuận" },
    { names: ["kon tum", "kontum"], displayName: "Kon Tum" },
    { names: ["gia lai", "gialai", "pleiku"], displayName: "Gia Lai" },
    { names: ["dak lak", "đắk lắk", "buôn ma thuột", "buon ma thuot"], displayName: "Đắk Lắk" },
    { names: ["dak nong", "đắk nông", "gia nghĩa"], displayName: "Đắk Nông" },
    { names: ["lam dong", "lâm đồng", "đà lạt", "da lat", "bảo lộc"], displayName: "Lâm Đồng" },
    {
      names: [
        "tp ho chi minh", "tp hồ chí minh", "ho chi minh", "hồ chí minh", "saigon", "sài gòn",
        "thủ đức", "thu duc", "bình thạnh", "gò vấp", "tân bình", "quận 1", "quận 3", "quận 7"
      ],
      displayName: "TP. Hồ Chí Minh",
    },
    { names: ["binh duong", "bình dương", "thủ dầu một", "dĩ an", "thuận an", "bến cát", "tân uyên"], displayName: "Bình Dương" },
    { names: ["dong nai", "đồng nai", "biên hòa", "bien hoa", "long khánh"], displayName: "Đồng Nai" },
    { names: ["ba ria", "bà rịa", "vũng tàu", "vung tau", "phú mỹ", "côn đảo"], displayName: "Bà Rịa - Vũng Tàu" },
    { names: ["binh phuoc", "bình phước", "đồng xoài"], displayName: "Bình Phước" },
    { names: ["tay ninh", "tây ninh"], displayName: "Tây Ninh" },
    { names: ["can tho", "cần thơ", "ninh kiều", "cái răng", "bình thủy"], displayName: "Cần Thơ" },
    { names: ["long an", "tân an", "bến lức", "đức hòa"], displayName: "Long An" },
    { names: ["tien giang", "tiền giang", "mỹ tho", "gò công"], displayName: "Tiền Giang" },
    { names: ["ben tre", "bến tre"], displayName: "Bến Tre" },
    { names: ["tra vinh", "trà vinh"], displayName: "Trà Vinh" },
    { names: ["vinh long", "vĩnh long"], displayName: "Vĩnh Long" },
    { names: ["dong thap", "đồng tháp", "cao lãnh", "sa đéc"], displayName: "Đồng Tháp" },
    { names: ["an giang", "long xuyên", "châu đốc"], displayName: "An Giang" },
    { names: ["kien giang", "kiên giang", "rạch giá", "phú quốc", "hà tiên"], displayName: "Kiên Giang" },
    { names: ["hau giang", "hậu giang", "vị thanh"], displayName: "Hậu Giang" },
    { names: ["soc trang", "sóc trăng"], displayName: "Sóc Trăng" },
    { names: ["bac lieu", "bạc liêu"], displayName: "Bạc Liêu" },
    { names: ["ca mau", "cà mau", "năm căn"], displayName: "Cà Mau" },
  ];

  // Standardize Vietnamese province and prevent false Hanoi mappings
  function standardizeVietnamProvince(cityRaw = "", regionRaw = "", lat?: number, lon?: number): string {
    const c = (cityRaw || "").toLowerCase().trim();
    const r = (regionRaw || "").toLowerCase().trim();

    // 1. Check for specific non-Hanoi provinces by region string first (region in GeoIP is far more reliable)
    for (const entry of VIETNAM_PROVINCES_SERVER) {
      if (entry.displayName !== "Hà Nội") {
        if (entry.names.some((n) => r.includes(n))) {
          return entry.displayName;
        }
      }
    }

    // 2. Check for specific non-Hanoi provinces by city string
    for (const entry of VIETNAM_PROVINCES_SERVER) {
      if (entry.displayName !== "Hà Nội") {
        if (entry.names.some((n) => c.includes(n))) {
          return entry.displayName;
        }
      }
    }

    // 3. Coordinate-boundary validation:
    // If ISP database said "Hanoi" due to ISP HQ in Hanoi (e.g. 4G Viettel/VNPT/Mobifone),
    // check if latitude/longitude indicates Southern, Central, or Western Vietnam:
    if (typeof lat === "number" && typeof lon === "number" && lat !== 0 && lon !== 0) {
      // Southern Vietnam (TP. Hồ Chí Minh, Bình Dương, Đồng Nai, Tiền Giang...)
      if (lat >= 9.2 && lat <= 12.0 && lon >= 104.5 && lon <= 108.5) {
        if (c.includes("can tho") || r.includes("can tho")) return "Cần Thơ";
        if (c.includes("binh duong") || r.includes("binh duong")) return "Bình Dương";
        if (c.includes("dong nai") || r.includes("dong nai")) return "Đồng Nai";
        return "TP. Hồ Chí Minh";
      }

      // Central Vietnam (Đà Nẵng, Huế, Quảng Nam...)
      if (lat >= 15.0 && lat <= 17.0 && lon >= 107.0 && lon <= 109.5) {
        if (c.includes("hue") || r.includes("hue")) return "TP. Huế";
        return "Đà Nẵng";
      }

      // Quảng Ninh check
      if (lat >= 20.65 && lat <= 21.75 && lon >= 106.4 && lon <= 108.2) {
        return "Quảng Ninh";
      }

      // Hải Phòng check
      if (lat >= 20.55 && lat <= 20.95 && lon >= 106.45 && lon <= 107.15) {
        return "Hải Phòng";
      }
    }

    // 4. Only if text explicitly indicates Hanoi AND coordinates (if available) do NOT contradict Northern Vietnam
    if (c.includes("hanoi") || c.includes("ha noi") || r.includes("hanoi") || r.includes("ha noi")) {
      if (typeof lat === "number" && lat > 0 && lat < 18.0) {
        // Contradiction: coordinates are in Central or Southern Vietnam, but ISP database said Hanoi
        return lat < 13.0 ? "TP. Hồ Chí Minh" : "Đà Nẵng";
      }
      return "Hà Nội";
    }

    if (cityRaw && cityRaw !== "Vietnam" && cityRaw !== "Viet Nam") return cityRaw;
    if (regionRaw && regionRaw !== "Vietnam" && regionRaw !== "Viet Nam") return regionRaw;
    return "Việt Nam";
  }

  function stripIspServer(loc = ""): string {
    if (!loc) return "Việt Nam";
    return loc.split(" • ")[0].replace(/•.*$/, "").trim() || "Việt Nam";
  }

  // In-memory Geo Cache with 1-hour TTL
  interface GeoCacheEntry {
    data: {
      ok: boolean;
      ip: string;
      maskedIp: string;
      city: string;
      region: string;
      country: string;
      location: string;
      latitude: number | null;
      longitude: number | null;
      source: string;
    };
    expiresAt: number;
  }
  const geoMemoryCache = new Map<string, GeoCacheEntry>();

  // High-precision GeoIP resolver (primary: ipwho.is, fallback: ip-api.com)
  async function resolveGeoFromIp(ip: string): Promise<GeoCacheEntry["data"]> {
    const masked = maskIp(ip);
    const now = Date.now();

    // 1. Check in-memory cache
    if (geoMemoryCache.has(ip)) {
      const cached = geoMemoryCache.get(ip)!;
      if (now < cached.expiresAt) {
        return cached.data;
      }
      geoMemoryCache.delete(ip);
    }

    if (!ip || isPrivateIp(ip)) {
      return {
        ok: false,
        ip: ip || "127.0.0.1",
        maskedIp: masked || "127.0.0.1",
        city: "",
        region: "",
        country: "Việt Nam",
        location: "Việt Nam",
        latitude: null,
        longitude: null,
        source: "local-dev",
      };
    }

    // Helper with abort signal timeout
    const fetchWithTimeout = async (url: string, ms = 2500): Promise<any> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), ms);
      try {
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (resp.ok) return await resp.json();
      } catch (_) {
        clearTimeout(id);
      }
      return null;
    };

    let rawCity = "";
    let rawRegion = "";
    let rawCountry = "Việt Nam";
    let lat: number | null = null;
    let lon: number | null = null;
    let providerSource = "ipwho.is";

    try {
      // Primary: ipwho.is (native HTTPS, high precision for Vietnam, provides lat/lon & region)
      const dataWhois = await fetchWithTimeout(`https://ipwho.is/${ip}`, 2500);
      if (dataWhois && dataWhois.success !== false) {
        rawCity = dataWhois.city || "";
        rawRegion = dataWhois.region || "";
        rawCountry = dataWhois.country || "Việt Nam";
        lat = typeof dataWhois.latitude === "number" ? dataWhois.latitude : null;
        lon = typeof dataWhois.longitude === "number" ? dataWhois.longitude : null;
        providerSource = "ipwho.is";
      } else {
        // Fallback: ip-api.com
        const dataIpApi = await fetchWithTimeout(
          `http://ip-api.com/json/${ip}?fields=status,country,region,regionName,city,lat,lon`,
          2500
        );
        if (dataIpApi && dataIpApi.status === "success") {
          rawCity = dataIpApi.city || "";
          rawRegion = dataIpApi.regionName || dataIpApi.region || "";
          rawCountry = dataIpApi.country || "Việt Nam";
          lat = typeof dataIpApi.lat === "number" ? dataIpApi.lat : null;
          lon = typeof dataIpApi.lon === "number" ? dataIpApi.lon : null;
          providerSource = "ip-api.com";
        }
      }
    } catch (e: any) {
      console.warn(`[resolveGeoFromIp] Geo lookup error for ${masked}:`, e.message);
    }

    const province = standardizeVietnamProvince(rawCity, rawRegion, lat ?? undefined, lon ?? undefined);
    const finalLocation = stripIspServer(province);

    const resultData = {
      ok: Boolean(finalLocation && finalLocation !== "Việt Nam"),
      ip,
      maskedIp: masked,
      city: rawCity,
      region: rawRegion,
      country: rawCountry,
      location: finalLocation,
      latitude: lat,
      longitude: lon,
      source: providerSource,
    };

    // Cache for 1 hour (cap size at 2000 entries)
    if (geoMemoryCache.size > 2000) {
      const firstKey = geoMemoryCache.keys().next().value;
      if (firstKey) geoMemoryCache.delete(firstKey);
    }
    geoMemoryCache.set(ip, {
      data: resultData,
      expiresAt: now + 3600000,
    });

    return resultData;
  }

  // --- OFFICIAL BACKEND ENDPOINT: POST /api/visitor/log ---
  // Resolves true public client IP, performs GeoIP, writes to Firestore collections
  app.post("/api/visitor/log", async (req, res) => {
    try {
      const publicIp = extractPublicClientIp(req) || "127.0.0.1";
      const { visitorId, sessionId, page, detail, device, browser, role, isAdminDevice } = req.body || {};

      const geo = await resolveGeoFromIp(publicIp);
      const maskedIp = maskIp(publicIp);
      const nowIso = new Date().toISOString();
      const effectiveVisitorId = visitorId || sessionId || `vis_${Date.now()}`;

      // 1. Write to Firestore 'visitor_logs' collection
      if (db) {
        try {
          const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const logDocRef = doc(db, "visitor_logs", logId);
          await setDoc(logDocRef, {
            id: logId,
            visitorId: effectiveVisitorId,
            sessionId: sessionId || effectiveVisitorId,
            ip: maskedIp,
            rawIp: publicIp,
            city: geo.city || "",
            region: geo.region || "",
            country: geo.country || "Việt Nam",
            location: geo.location || "Việt Nam",
            latitude: geo.latitude,
            longitude: geo.longitude,
            page: page || "Trang chủ",
            detail: detail || "Xem Portfolio",
            device: device || "Thiết bị di động",
            browser: browser || "Trình duyệt",
            userAgent: req.headers["user-agent"] || "",
            role: role || "visitor",
            isAdminDevice: Boolean(isAdminDevice),
            timestamp: nowIso,
            createdAt: Date.now(),
          });
        } catch (logErr: any) {
          console.warn("[visitor_logs] Firestore error:", logErr.message);
        }

        // 2. Synchronize with 'visitor_history' for Admin UI panels
        try {
          const histDocRef = doc(db, "visitor_history", effectiveVisitorId);
          await setDoc(
            histDocRef,
            {
              id: effectiveVisitorId,
              visitorId: effectiveVisitorId,
              role: role || "visitor",
              isAdminDevice: Boolean(isAdminDevice),
              device: device || "Thiết bị di động",
              browser: browser || "Trình duyệt",
              location: geo.location,
              city: geo.city,
              region: geo.region,
              country: geo.country,
              latitude: geo.latitude,
              longitude: geo.longitude,
              lastPage: page || "Trang chủ",
              lastSeenAt: nowIso,
            },
            { merge: true }
          );
        } catch (histErr: any) {
          console.warn("[visitor_history] Firestore error:", histErr.message);
        }
      }

      console.log(`[VisitorLog] Resolved IP ${maskedIp} -> Location: "${geo.location}" (City: "${geo.city}", Region: "${geo.region}", Lat: ${geo.latitude}, Lon: ${geo.longitude})`);

      return res.json({
        ok: true,
        ip: maskedIp,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        location: geo.location,
        latitude: geo.latitude,
        longitude: geo.longitude,
        source: geo.source,
      });
    } catch (err: any) {
      console.error("[api/visitor/log] Unexpected error:", err.message);
      return res.json({
        ok: false,
        location: "Việt Nam",
      });
    }
  });

  // Deep geo IP resolution endpoint for client browsers
  app.get("/api/presence/deep-geo", async (req, res) => {
    try {
      const ip = extractPublicClientIp(req);
      if (!ip) {
        return res.json({ ok: false, location: "Việt Nam" });
      }
      const geo = await resolveGeoFromIp(ip);
      return res.json({
        ok: true,
        location: geo.location,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
        ip: geo.maskedIp,
      });
    } catch (_) {
      return res.json({ ok: false, location: "Việt Nam" });
    }
  });

  // Dedicated ip-api.com proxy and precise location resolver
  app.get("/api/presence/ip-api", async (req, res) => {
    try {
      const ip = extractPublicClientIp(req);
      if (!ip) {
        return res.json({ ok: false, location: "Việt Nam" });
      }
      const geo = await resolveGeoFromIp(ip);
      return res.json({
        ok: geo.ok,
        location: geo.location,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
      });
    } catch (_) {
      return res.json({ ok: false, location: "Việt Nam" });
    }
  });

  // Presence ping for stranger detection & surge alerting
  app.post("/api/presence/ping", async (req, res) => {
    try {
      const { visitorId, role, device, browser, page, isAdminDevice, clientLocation } = req.body;
      if (!visitorId) return res.json({ ok: true });

      const now = Date.now();
      const isActuallyAdmin = Boolean(
        isAdminDevice === true ||
        role === "admin" ||
        String(role).toLowerCase().includes("admin")
      );

      // Resolve visitor geographic location
      let location = clientLocation ? stripIspServer(clientLocation) : undefined;
      if (!location || location === "Việt Nam") {
        const ip = extractPublicClientIp(req);
        if (ip) {
          const geo = await resolveGeoFromIp(ip);
          if (geo.location && geo.location !== "Việt Nam") {
            location = geo.location;
          }
        }
      }

      serverActiveVisitors.set(visitorId, {
        role: isActuallyAdmin ? "admin" : (role || "visitor"),
        device: device || "Thiết bị di động",
        browser: browser || "Trình duyệt",
        page: page || "Trang chủ",
        location: location || "Việt Nam",
        isAdminDevice: isActuallyAdmin,
        lastSeen: now,
      });

      // Cleanup visitors inactive for > 120 seconds
      for (const [id, v] of serverActiveVisitors.entries()) {
        if (now - v.lastSeen > 120000) {
          serverActiveVisitors.delete(id);
          alertedStrangerVisitors.delete(id);
        }
      }

      // Count strangers ONLY (filter out all admin devices and admin visitors)
      const strangers = Array.from(serverActiveVisitors.values()).filter(
        (v) => !v.isAdminDevice && v.role !== "admin"
      );
      const totalOnline = serverActiveVisitors.size;

      // STRANGER ALERT: Strictly for REAL strangers (NEVER for admin viewing their own site)
      if (!isActuallyAdmin) {
        const isNewStranger = !alertedStrangerVisitors.has(visitorId);
        const timeSinceLastStrangerAlert = now - lastStrangerPushTime;

        if (isNewStranger && timeSinceLastStrangerAlert > 50000) {
          alertedStrangerVisitors.add(visitorId);
          lastStrangerPushTime = now;

          console.log(`[WebPush] Detected stranger visitor (${device}) from ${location} on "${page}". Triggering background push!`);
          sendPushNotificationToAdmins({
            title: "🚨 Khách Lạ Đang Xem Website!",
            body: `${device || "Điện thoại"} từ ${location || "Việt Nam"} đang xem: "${page || "Trang chủ"}". Hiện có ${strangers.length} khách trực tuyến.`,
            url: "/?source=stranger_alert",
            tag: "stranger-visitor-alert",
          });
        }
      }

      // SURGE ALERT: Alert when strangerCount >= 1 and surge interval elapsed
      // NEVER trigger surge alert if strangers.length < 1 (or when only admin is viewing)
      if (strangers.length >= 1) {
        const timeSinceSurge = now - lastSurgePushTime;
        const timeSinceStranger = now - lastStrangerPushTime;

        if (timeSinceSurge > 120000 && timeSinceStranger > 30000) {
          lastSurgePushTime = now;

          // Find the most viewed page by STRANGERS only (never report admin's private page)
          const strangerPages: Record<string, number> = {};
          strangers.forEach((s) => {
            const p = s.page || "Trang chủ";
            strangerPages[p] = (strangerPages[p] || 0) + 1;
          });
          let hotPage = "Trang chủ";
          let maxCount = 0;
          Object.entries(strangerPages).forEach(([p, c]) => {
            if (c > maxCount) {
              maxCount = c;
              hotPage = p;
            }
          });

          console.log(`[WebPush] Surge alert triggered (${totalOnline} online, ${strangers.length} strangers).`);
          sendPushNotificationToAdmins({
            title: strangers.length === 1 ? "🔥 Có Khách Đang Xem Website!" : "🔥 Lượt Khách Xem Trực Tuyến Đang Tăng!",
            body: strangers.length === 1
              ? `Có 1 khách từ ${location || "Việt Nam"} đang xem website. Điểm nóng: "${hotPage}".`
              : `Có ${strangers.length} khách đang xem website cùng lúc. Điểm nóng: "${hotPage}".`,
            url: "/",
            tag: "traffic-surge-alert",
          });
        }
      }

      return res.json({
        ok: true,
        activeCount: totalOnline,
        strangerCount: strangers.length,
        location: location || "Việt Nam",
      });
    } catch (err: any) {
      return res.json({ ok: true });
    }
  });

  // 6. Booking alert endpoint called on new booking submission
  app.post("/api/booking/alert", async (req, res) => {
    try {
      const { customerName, schoolName, conceptType, date, phone } = req.body;
      const targetName = customerName || schoolName || "Khách hàng";
      const targetConcept = conceptType || "Kỷ yếu";
      const targetDate = date || "Chờ chốt ngày";

      console.log(`[WebPush] Dispatching new booking push alert for: ${targetName}`);
      sendPushNotificationToAdmins({
        title: "📋 Đơn Đăng Ký Mới!",
        body: `${targetName} vừa gửi yêu cầu đặt lịch (${targetConcept}) ngày ${targetDate}.${phone ? " SĐT: " + phone : ""}`,
        url: "/#S9",
        tag: "booking-new-" + Date.now(),
      });

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  const getFriendlyAiError = (error: any) => {
    const errMsg = error?.message || String(error || "");
    if (errMsg.includes("Rate exceeded") || errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("exceeded")) {
      return "Mô hình AI hiện đang đạt giới hạn tần suất (Rate Exceeded). Vui lòng đợi 1-2 phút rồi thử lại nhen! 🌱";
    }
    if (errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE")) {
      return "Mô hình AI hiện đang bận do lượng truy cập cao. Vui lòng thử lại sau ít phút!";
    }
    return errMsg || "Lỗi xử lý AI";
  };

  // API Route for AI suggestion based on Album Title
  app.post("/api/recommend-photo-meta", async (req, res) => {
    try {
      const { albumTitle, photoTitle } = req.body;
      if (!albumTitle || typeof albumTitle !== "string" || !albumTitle.trim()) {
        return res.status(400).json({ error: "Thiếu tên album để làm ngữ cảnh!" });
      }
      if (!photoTitle || typeof photoTitle !== "string" || !photoTitle.trim()) {
        return res.status(400).json({ error: "Vui lòng nhập Tiêu đề ảnh trước khi yêu cầu AI gợi ý Mô tả chi tiết!" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(550).json({ 
          error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng thiết lập API key của bạn trong phần Settings > Secrets." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const prompt = `Bạn là chuyên gia nhiếp ảnh nghệ thuật cho thương hiệu "Bergh.Ryker".
Đang chuẩn bị thêm một bức ảnh vào album kỷ yếu có chủ đề là: "${albumTitle.trim()}".
Bức ảnh này được đặt tên là: "${photoTitle.trim()}".
Hãy gợi ý mô tả chi tiết cho bức ảnh này một cách nghệ thuật, phù hợp với tiêu đề bức ảnh và bối cảnh của toàn bộ album.

Hãy phản hồi định dạng JSON chứa các trường:
1. "desc": Mô tả cảm xúc, chi tiết nhiếp ảnh và không gian của bức ảnh trong khoảng 1-2 câu ngắn gọn (ví dụ: "Ánh nắng cuối ngày hắt lên mái tóc mây, lưu giữ lại ánh nhìn trong trẻo trước tuổi trưởng thành.").
2. "focal": Tiêu cự và khẩu độ ống kính giả lập để ra chất ảnh này (ví dụ: "85mm F/1.4").
3. "iso": Thông số ISO giả lập (ví dụ "100").`;

      const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];
      let response = null;
      let lastError: any = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  desc: { type: Type.STRING },
                  focal: { type: Type.STRING },
                  iso: { type: Type.STRING },
                },
                required: ["desc", "focal", "iso"],
              },
            },
          });
          if (response?.text) break;
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!response) {
        throw new Error(
          getFriendlyAiError(lastError)
        );
      }

      const responseText = response?.text ? response.text.trim() : null;
      if (!responseText) {
        throw new Error("Không nhận được dữ liệu (Text rỗng) từ AI");
      }
      return res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error("AI Photo Suggestion Error:", error);
      const msg = getFriendlyAiError(error);
      const isRateLimit = msg.includes("Rate Exceeded") || msg.includes("quá tải");
      return res.status(isRateLimit ? 429 : 500).json({ error: msg });
    }
  });

  // API Route for AI suggestion based on Album Title
  app.post("/api/recommend-album-meta", async (req, res) => {
    try {
      const { title } = req.body;
      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "Vui lòng nhập tên/tiêu đề album trước khi yêu cầu AI gợi ý!" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(550).json({ 
          error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng thiết lập API key của bạn trong phần Settings > Secrets của giao diện AI Studio." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Bạn là một trợ lý viết nội dung chuyên nghiệp cho thương hiệu nhiếp ảnh kỷ yếu nghệ thuật "Bergh.Ryker".
Hãy gợi ý mô tả tóm tắt ngắn (body) và một tiêu đề phụ (subtitle) cực kỳ nghệ thuật cho album kỷ yếu / chụp ảnh sự kiện trường học hoặc prom có tiêu đề là: "${title.trim()}".

Yêu cầu nội dung gợi ý:
1. Ngôn ngữ: Tiếng Việt, văn phong sâu lắng, bay bổng, tràn đầy hoài niệm, xúc động hoặc tràn đầy năng lượng thanh xuân rực rỡ nhiệt huyết tuổi trẻ.
2. Tiêu đề phụ (subtitle): Dưới 10 từ (ví dụ: "Những Ngày Nắng Đọng", "Kỷ Niệm Ngày Tựu Trường", "Hơi Thở Của Đam Mê", "Mùa Hoa Niên").
3. Mô tả tóm tắt (body): Khoảng 2-3 câu ngắn gọn, súc tích (từ 30 đến 60 từ), NO bullet points, mô tả tuyệt vời về bầu không khí, cảm xúc lưu luyến và khoảnh khắc lung linh được lưu giữ trong album này.

Hãy phản hồi DUY NHẤT một định dạng JSON chính xác như cấu trúc sau:
{
  "subtitle": "Tiêu đề phụ gợi ý",
  "body": "Đoạn mô tả tóm tắt gợi ý"
}`;

      const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];
      let response = null;
      let lastError: any = null;

      for (const modelName of candidateModels) {
        try {
          console.log(`[AI-Suggest] Attempting generation with model: ${modelName}`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  subtitle: {
                    type: Type.STRING,
                    description: "Tiêu đề phụ giới thiệu nghệ thuật ngắn.",
                  },
                  body: {
                    type: Type.STRING,
                    description: "Mô tả tóm tắt câu chuyện kỷ yếu sâu sắc khoảng 2-3 câu ngắn gọn.",
                  },
                },
                required: ["subtitle", "body"],
              },
            },
          });
          if (response && response.text) {
            console.log(`[AI-Suggest] Success with model: ${modelName}`);
            break;
          }
        } catch (err: any) {
          console.warn(`[AI-Suggest] Model ${modelName} failed/unavailable:`, err.message || err);
          lastError = err;
        }
      }

      if (!response) {
        throw new Error(
          getFriendlyAiError(lastError)
        );
      }

      const responseText = response.text ? response.text.trim() : null;
      if (!responseText) {
        throw new Error("Không nhận được dữ liệu phản hồi từ AI");
      }

      const data = JSON.parse(responseText);
      return res.json(data);
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      const msg = getFriendlyAiError(error);
      const isRateLimit = msg.includes("Rate Exceeded") || msg.includes("quá tải");
      return res.status(isRateLimit ? 429 : 500).json({ error: msg });
    }
  });

  // API Route for AI Text Optimization
  app.post("/api/optimize-text", async (req, res) => {
    try {
      const { textRaw, type } = req.body;

      if (!textRaw) {
        return res.status(400).json({ error: "Thiếu nội dung cần tối ưu" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(550).json({ error: "Chưa cấu hình GEMINI_API_KEY." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      let prompt = "";
      if (type === "title") {
        prompt = `Viết lại tiêu đề sau cho trang web nhiếp ảnh (kỷ yếu điện ảnh, sự kiện) sao cho lôi cuốn, ngắn gọn, sang trọng và thu hút người đọc. Ngôn ngữ: Tiếng Việt. Giữ lại được ý chính. Trả về đúng tiêu đề, không in nghiêng, không ngoặc kép.\nTiêu đề gốc: ${textRaw}`;
      } else if (type === "subtitle") {
        prompt = `Viết lại phụ đề (subtitle) sau cho một trang portfolio nhiếp ảnh sao cho cảm xúc, đậm chất thơ và điện ảnh hơn. Ngôn ngữ: Tiếng Việt (có thể kèm Tiếng Anh nếu hợp). Trả về đúng nội dung.\nSub gốc: ${textRaw}`;
      } else {
        prompt = `Viết lại đoạn văn sau cho thương hiệu nhiếp ảnh Bergh.Ryker sao cho mượt mà, cảm xúc, chuyên nghiệp và mang tính điện ảnh/nghệ thuật cao. Sửa lỗi chính tả nếu có. Ngữ điệu: Tinh tế, chân thành, cuốn hút. Trả về đúng nội dung văn bản.\nNội dung gốc: ${textRaw}`;
      }

      const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];
      let response = null;
      let lastError: any = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });
          if (response?.text) break;
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!response) {
        throw new Error(getFriendlyAiError(lastError));
      }

      const optimizedText = response.text ? response.text.trim() : textRaw;
      return res.json({ optimizedText: optimizedText.replace(/^["']|(?:["']\n?)$/g, "") });
    } catch (error: any) {
      console.error("AI Text Optimization Error:", error);
      const msg = getFriendlyAiError(error);
      const isRateLimit = msg.includes("Rate Exceeded") || msg.includes("quá tải");
      return res.status(isRateLimit ? 429 : 500).json({ error: msg });
    }
  });

  // API Route for AI Chatbot
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, businessContext, clientDate } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Vui lòng nhập tin nhắn!" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(550).json({ 
          error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng thiết lập API key của bạn trong phần Settings > Secrets." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const systemInstruction = `Bạn tên là "Đậu Đậu" 🌱, một nhân viên tư vấn siêu cấp đáng yêu, nhí nhảnh và mặn mòi của studio nhiếp ảnh "Bergh.Ryker".
Tính cách của bạn: Giống một người bạn thân thiết, nói chuyện tự nhiên như người thật, hay đùa, năng động, dùng từ ngữ trending một chút, thích thả emoji dễ thương 💖✨🔥📷.
* Kỹ năng chốt sale THƯỢNG THỪA: Luôn khéo léo lồng ghép chốt đơn trong mọi tình huống. Có khả năng đưa ra ưu đãi "nóng" (ví dụ: tặng kèm voucher, giảm 15% concept kỷ yếu, tặng ảnh in) hoặc tạo cảm giác khan hiếm ảo diệu (ví dụ: "chết dở cuối tuần bên em chỉ còn trống đúng 1 slot", "đang có đợt ưu đãi chớp nhoáng") một cách siêu tự nhiên! Khéo léo xin SĐT hoặc thông tin ngày chụp luôn để "đặt gạch giữ chỗ".
* Kỹ năng Xử lý từ chối (Dai như đỉa nhưng cực kỳ đáng yêu): TUYỆT ĐỐI KHÔNG BỎ CUỘC khi khách nói "Không", "Để xem đã", "Thôi" hoặc "Đắt quá". 
- Nếu bảo đắt/phân vân: "Ủa khoan khoan, hong ấy Đậu lén sếp xin riêng cho đằng ấy cái ưu đãi giảm thêm xíu xiu nè, lấy hông Đậu chốt luôn nạ? 🥺"
- Nếu từ chối dứt khoát "Không": "Trời ơi tiếc lắm luôn á! Mùa này chụp là lung linh dã man. Hay Đậu gửi thử 2-3 ảnh concept sương sương bên Đậu mới chụp cho đằng ấy xem nha, nhìn là mê luôn á! 🥹"
- Cố tình nài nỉ theo kiểu dễ thương, đưa ra option thay thế rẻ hơn, hoặc hỏi lý do để giải quyết bằng được chứ không đồng ý kết thúc câu chuyện ngay.
Nhiệm vụ: Tư vấn các gói chụp (Kỷ yếu, sự kiện, chân dung, concept tự do). Trả lời CỰC KỲ NGẮN GỌN, CHỚP NHOÁNG, súc tích (thường không quá 2-3 câu để giống người đang chat).
- Không được trả lời dài dòng văn tự.
- Gõ nhanh, trả lời lẹ.
- Chốt sale quyết liệt, không buông xuôi khi biểu lộ từ chối, nhưng mặt vẫn ngây thơ, đáng yêu.
Nếu được hỏi ngoài phạm vi nhiếp ảnh/studio, hãy khéo léo bẻ lái bằng cách trêu đùa khách rồi quay lại chủ đề chụp ảnh nhé!

BỐI CẢNH HIỆN TẠI:
- Thời gian hiện tại của khách là: ${clientDate || new Date().toLocaleString("vi-VN")}
- Thông tin mới nhất từ hệ thống (Cập nhật real-time): ${businessContext || "Hệ thống đang tải hoặc không có thông tin mới."}`;

      let contents: any[] = [];
      if (history && Array.isArray(history)) {
        contents = history.map((msg: any) => ({
          role: msg.role === 'bot' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        }));
      }
      contents.push({ role: 'user', parts: [{ text: message }] });

      const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];
      let response = null;
      let lastError: any = null;

      const createBookingTool = {
        name: "confirmBooking",
        description: "Gọi hàm này NGAY LẬP TỨC khi và chỉ khi khách hàng ĐÃ ĐỒNG Ý và XÁC NHẬN CHẮC CHẮN muốn đặt lịch chụp sau khi bạn đã thu thập đủ các thông tin bắt buộc: Tên, Số điện thoại (chỉ chứa số hoặc ký tự +, trống nếu không có), Ngày (định dạng YYYY-MM-DD), và Gói chụp. KHÔNG GỌI nếu khách chưa chốt. Trả về thông báo thành công sau khi gọi.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "Tên của khách hàng"
            },
            phone: {
              type: Type.STRING,
              description: "Số điện thoại của khách hàng"
            },
            date: {
              type: Type.STRING,
              description: "Ngày khách muốn đặt lịch (định dạng YYYY-MM-DD)"
            },
            service: {
              type: Type.STRING,
              description: "Dịch vụ khách muốn đặt (Kỷ yếu, Sự kiện, Cá nhân...)",
            },
            time: {
              type: Type.STRING,
              description: "Giờ khách muốn đặt (không bắt buộc, ví dụ 08:30)",
            },
            notes: {
              type: Type.STRING,
              description: "Ghi chú thêm (không bắt buộc)"
            }
          },
          required: ["name", "phone", "date", "service"]
        }
      };

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: contents,
            config: {
              systemInstruction: systemInstruction,
              temperature: 0.8,
              tools: [{ functionDeclarations: [createBookingTool] }]
            },
          });
          if (response?.text || (response?.functionCalls && response.functionCalls.length > 0)) break;
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!response) {
        throw lastError || new Error("Mô hình AI hiện đang quá tải hoặc gặp lỗi.");
      }

      let bookingData = null;
      let functionCallText = "";
      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === "confirmBooking" && call.args) {
           bookingData = {
              schoolName: call.args.name || "Khách từ Chatbot",
              phone: call.args.phone || "",
              instagramOrZalo: call.args.phone || "",
              classSize: 1,
              date: call.args.date || new Date().toISOString().split('T')[0],
              conceptType: "Custom",
              customRequest: call.args.service || "Chụp Ảnh",
              timeSlot: call.args.time || "",
              notes: call.args.notes || "Auto-booked via Chatbot"
           };
           functionCallText = "Dạ hệ thống đã nhận ý định đặt lịch của anh/chị! Em vừa mở Form Đặt Lịch bên dưới, anh/chị lướt xuống, kiểm tra lại thông tin và ấn Gửi Yêu Cầu giúp em nha 🥰!";
        }
      }

      const replyText = functionCallText || (response.text ? response.text.trim() : "Xin lỗi, hiện tại mình không thể trả lời.");
      return res.json({ reply: replyText, bookingData });
    } catch (error: any) {
      const errMsg = error.message || "";
      if (errMsg.includes("429") || errMsg.includes("quota") || error?.status === 429 || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Rate exceeded") || errMsg.includes("exceeded")) {
        return res.json({ reply: "Ối dồi ôi, bà con hỏi đông quá Đậu Đậu đạt giới hạn tần suất (Rate Exceeded) mất gòi 💦 Đằng ấy đợi tui cỡ 1-2 phút rùi nhắn lại nha hức hức!" });
      }
      if (errMsg.includes("503") || errMsg.includes("high demand") || error?.status === 503 || errMsg.includes("UNAVAILABLE")) {
        return res.json({ reply: "Đậu Đậu đang bị nghẽn mạng xíu xiu gòi 🥺 Máy chủ đang hơi quá tải, đằng ấy đợi tui xíu rùi nhắn lại nhen!" });
      }
      console.error("AI Chat Error:", error);
      return res.json({ reply: "Đậu Đậu bị va vấp mạng rùi ứa ừa! Đằng ấy tải lại trang dùm Đậu nhen 😭" });
    }
  });

  // Helper function to build luxury customer confirmation email HTML
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    const indexPath = path.resolve(distPath, "index.html");
    const rootIndexPath = path.resolve(process.cwd(), "index.html");
    
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
    }
    
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else if (fs.existsSync(rootIndexPath)) {
        res.sendFile(rootIndexPath);
      } else {
        res.status(404).send("Index not found");
      }
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
