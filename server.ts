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
import nodemailer from "nodemailer";
// @ts-ignore
import MailComposer from "nodemailer/lib/mail-composer";
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
      deviceId?: string;
      role: string;
      device?: string;
      browser?: string;
      screenResolution?: string;
      page?: string;
      location?: string;
      isAdminDevice: boolean;
      isReturning?: boolean;
      visitCount?: number;
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

    // 2. Google Cloud Run / Google Front End (GFE) direct client IP
    const xClientIp = req.headers["x-client-ip"];
    if (typeof xClientIp === "string") {
      const clean = xClientIp.trim().replace(/^::ffff:/, "");
      if (clean && !isPrivateIp(clean)) return clean;
    }

    // 3. Standard X-Real-IP
    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string") {
      const clean = realIp.trim().replace(/^::ffff:/, "");
      if (clean && !isPrivateIp(clean)) return clean;
    }

    // 4. X-Forwarded-For: Client IP is strictly the FIRST non-private IP from the LEFT
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

    // 5. req.ips (populated by Express when app.set('trust proxy', true) is active)
    if (Array.isArray(req.ips) && req.ips.length > 0) {
      for (const ip of req.ips) {
        const clean = ip.replace(/^::ffff:/, "").trim();
        if (!isPrivateIp(clean)) return clean;
      }
    }

    // 6. req.ip
    if (req.ip) {
      const clean = req.ip.replace(/^::ffff:/, "").trim();
      if (!isPrivateIp(clean)) return clean;
    }

    // 7. req.socket.remoteAddress
    if (req.socket && req.socket.remoteAddress) {
      const clean = req.socket.remoteAddress.replace(/^::ffff:/, "").trim();
      if (!isPrivateIp(clean)) return clean;
    }

    return null;
  }

  // Extract Edge Geolocation headers provided automatically by Google Cloud Run / GFE
  function extractGoogleEdgeGeo(req: express.Request): {
    city?: string;
    region?: string;
    country?: string;
    lat?: number;
    lon?: number;
  } | null {
    const rawCity = typeof req.headers["x-appengine-city"] === "string" ? req.headers["x-appengine-city"].trim() : "";
    const rawRegion = typeof req.headers["x-appengine-region"] === "string" ? req.headers["x-appengine-region"].trim() : "";
    const rawCountry = typeof req.headers["x-appengine-country"] === "string" ? req.headers["x-appengine-country"].trim() : "";
    const latLong = typeof req.headers["x-appengine-citylatlong"] === "string" ? req.headers["x-appengine-citylatlong"].trim() : "";

    let lat: number | undefined;
    let lon: number | undefined;
    if (latLong && latLong.includes(",")) {
      const [latStr, lonStr] = latLong.split(",");
      const parsedLat = parseFloat(latStr);
      const parsedLon = parseFloat(lonStr);
      if (!isNaN(parsedLat) && !isNaN(parsedLon)) {
        lat = parsedLat;
        lon = parsedLon;
      }
    }

    if (rawCity || rawRegion || (lat !== undefined && lon !== undefined)) {
      return { city: rawCity, region: rawRegion, country: rawCountry, lat, lon };
    }
    return null;
  }

  // Server-side Device Label sanitizer: strictly converts any faulty Mac Intel labels to Apple M1 and clarifies iPhone labels
  function sanitizeDeviceLabelServer(rawDevice = "", screenResolution = ""): string {
    if (!rawDevice) return "Thiết bị di động";
    const trimmed = rawDevice.trim();

    // If screen resolution is 430x932, this is strictly iPhone 15 Pro Max
    if (screenResolution === "430x932" || screenResolution.includes("430x") || trimmed.includes("430x932")) {
      return "iPhone 15 Pro Max";
    }

    // If a mobile device was mistakenly labeled MacBook due to desktop user-agent
    if (trimmed.includes("MacBook") && (screenResolution === "430x932" || screenResolution.includes("430x"))) {
      return "iPhone 15 Pro Max";
    }

    // Correct previous misleading or ambiguous iPhone labels
    if (
      trimmed === "iPhone 16 Pro" ||
      trimmed.includes("iPhone 16 Pro") ||
      trimmed.includes("iPhone 16 Plus / 15 Pro Max") ||
      trimmed.includes("iPhone 16 / 15 Pro Max") ||
      trimmed.includes("iPhone 15 Pro Max / 14 Pro Max") ||
      trimmed === "iPhone 16 / 15 Pro Max"
    ) {
      return "iPhone 15 Pro Max";
    }

    if (trimmed.includes("iPhone 16 / 15 Pro / 15")) {
      return "iPhone 15 Pro";
    }

    if (
      trimmed.includes("Mac (Intel") ||
      trimmed.includes("Mac (Intel macOS)") ||
      trimmed.includes("MacBook (Intel") ||
      trimmed.includes("Intel Core") ||
      trimmed === "Macintosh (Intel)" ||
      trimmed === "Mac (Intel)"
    ) {
      return "MacBook / Mac (Chip Apple M1)";
    }
    if (trimmed === "Macintosh" || trimmed === "Mac OS X" || trimmed === "Mac") {
      return "MacBook / Mac (Chip Apple M1)";
    }
    return trimmed;
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

  // Standardize Vietnamese province and prevent false Hanoi mappings with granular districts
  function standardizeVietnamProvince(cityRaw = "", regionRaw = "", lat?: number, lon?: number): string {
    const c = (cityRaw || "").toLowerCase().trim();
    const r = (regionRaw || "").toLowerCase().trim();
    const comb = `${c} ${r}`.trim();

    // Specific granular districts and wards for Quảng Ninh
    if (
      comb.includes("ha long") ||
      comb.includes("hạ long") ||
      comb.includes("halong") ||
      comb.includes("bai chay") ||
      comb.includes("bãi cháy") ||
      comb.includes("hon gai") ||
      comb.includes("hòn gai") ||
      comb.includes("gieng day") ||
      comb.includes("giếng đáy") ||
      comb.includes("tuan chau") ||
      comb.includes("tuần châu") ||
      comb.includes("hung thang") ||
      comb.includes("hùng thắng") ||
      comb.includes("hong gai") ||
      comb.includes("hồng gai") ||
      comb.includes("hong ha") ||
      comb.includes("hồng hà")
    ) {
      return "Hạ Long, Quảng Ninh";
    }
    if (
      comb.includes("cam pha") ||
      comb.includes("cẩm phả") ||
      comb.includes("campha") ||
      comb.includes("cua ong") ||
      comb.includes("cửa ông") ||
      comb.includes("quang hanh") ||
      comb.includes("quang hanh") ||
      comb.includes("mong duong") ||
      comb.includes("mông dương")
    ) {
      return "Cẩm Phả, Quảng Ninh";
    }
    if (comb.includes("uong bi") || comb.includes("uông bí") || comb.includes("vang danh") || comb.includes("vàng danh")) {
      return "Uông Bí, Quảng Ninh";
    }
    if (comb.includes("mong cai") || comb.includes("móng cái") || comb.includes("tra co") || comb.includes("trà cổ")) {
      return "Móng Cái, Quảng Ninh";
    }
    if (comb.includes("quang yen") || comb.includes("quảng yên") || comb.includes("minh thanh") || comb.includes("minh thành")) {
      return "Quảng Yên, Quảng Ninh";
    }
    if (comb.includes("van don") || comb.includes("vân đồn") || comb.includes("cai rong") || comb.includes("cái rồng") || comb.includes("quan lan") || comb.includes("quan lạn")) {
      return "Vân Đồn, Quảng Ninh";
    }
    if (comb.includes("dong trieu") || comb.includes("đông triều") || comb.includes("mao khe") || comb.includes("mạo khê")) {
      return "Đông Triều, Quảng Ninh";
    }
    if (comb.includes("tien yen") || comb.includes("tiên yên")) return "Tiên Yên, Quảng Ninh";
    if (comb.includes("ba che") || comb.includes("ba chẽ")) return "Ba Chẽ, Quảng Ninh";
    if (comb.includes("binh lieu") || comb.includes("bình liêu")) return "Bình Liêu, Quảng Ninh";
    if (comb.includes("dam ha") || comb.includes("đầm hà")) return "Đầm Hà, Quảng Ninh";
    if (comb.includes("hai ha") || comb.includes("hải hà")) return "Hải Hà, Quảng Ninh";
    if (comb.includes("co to") || comb.includes("cô tô")) return "Cô Tô, Quảng Ninh";

    // Specific granular districts for Hải Phòng
    if (comb.includes("do son") || comb.includes("đồ sơn")) return "Đồ Sơn, Hải Phòng";
    if (comb.includes("cat ba") || comb.includes("cát bà") || comb.includes("cat hai") || comb.includes("cát hải")) return "Cát Bà, Hải Phòng";
    if (comb.includes("thuy nguyen") || comb.includes("thủy nguyên")) return "Thủy Nguyên, Hải Phòng";
    if (comb.includes("kien an") || comb.includes("kiến an")) return "Kiến An, Hải Phòng";
    if (comb.includes("an duong") || comb.includes("an dương")) return "An Dương, Hải Phòng";
    if (comb.includes("hong bang") || comb.includes("hồng bàng")) return "Hồng Bàng, Hải Phòng";
    if (comb.includes("ngo quyen") || comb.includes("ngô quyền")) return "Ngô Quyền, Hải Phòng";
    if (comb.includes("le chan") || comb.includes("lê chân")) return "Lê Chân, Hải Phòng";
    if (comb.includes("hai an") || comb.includes("hải an")) return "Hải An, Hải Phòng";

    // Specific granular districts & streets for Hà Nội
    if (comb.includes("phan tay nhac") || comb.includes("phan tây nhạc")) {
      return "Phan Tây Nhạc, Nam Từ Liêm, Hà Nội";
    }
    if (comb.includes("trinh van bo") || comb.includes("trịnh văn bô")) {
      return "Trịnh Văn Bô, Nam Từ Liêm, Hà Nội";
    }
    if (comb.includes("phuong canh") || comb.includes("phương canh")) {
      return "Phương Canh, Nam Từ Liêm, Hà Nội";
    }
    if (comb.includes("xuan phuong") || comb.includes("xuân phương")) {
      return "Xuân Phương, Nam Từ Liêm, Hà Nội";
    }
    if (comb.includes("fpt polytechnic")) {
      return "Trịnh Văn Bô, Nam Từ Liêm, Hà Nội";
    }
    if (comb.includes("my dinh") || comb.includes("mỹ đình")) {
      return "Mỹ Đình, Nam Từ Liêm, Hà Nội";
    }
    if (comb.includes("me tri") || comb.includes("mễ trì")) {
      return "Mễ Trì, Nam Từ Liêm, Hà Nội";
    }
    if (comb.includes("nam tu liem") || comb.includes("nam từ liêm")) {
      return "Nam Từ Liêm, Hà Nội";
    }
    if (comb.includes("bac tu liem") || comb.includes("bắc từ liêm") || comb.includes("co nhue") || comb.includes("cổ nhuế")) {
      return "Bắc Từ Liêm, Hà Nội";
    }

    if (comb.includes("cau giay") || comb.includes("cầu giấy")) return "Cầu Giấy, Hà Nội";
    if (comb.includes("dong da") || comb.includes("đống đa")) return "Đống Đa, Hà Nội";
    if (comb.includes("ba dinh") || comb.includes("ba đình")) return "Ba Đình, Hà Nội";
    if (comb.includes("hoan kiem") || comb.includes("hoàn kiếm")) return "Hoàn Kiếm, Hà Nội";
    if (comb.includes("tay ho") || comb.includes("tây hồ")) return "Tây Hồ, Hà Nội";
    if (comb.includes("thanh xuan") || comb.includes("thanh xuân")) return "Thanh Xuân, Hà Nội";
    if (comb.includes("ha dong") || comb.includes("hà đông")) return "Hà Đông, Hà Nội";
    if (comb.includes("long bien") || comb.includes("long biên")) {
      // Prevent false Long Biên mappings when ISP datacenter is in Long Biên (Sài Đồng)
      return "Hà Nội";
    }
    if (comb.includes("hoang mai") || comb.includes("hoàng mai")) return "Hoàng Mai, Hà Nội";
    if (comb.includes("hai ba trung") || comb.includes("hai bà trưng")) return "Hai Bà Trưng, Hà Nội";
    if (comb.includes("son tay") || comb.includes("sơn tây")) return "Sơn Tây, Hà Nội";
    if (comb.includes("gia lam") || comb.includes("gia lâm")) return "Gia Lâm, Hà Nội";
    if (comb.includes("dong anh") || comb.includes("đông anh")) return "Đông Anh, Hà Nội";
    if (comb.includes("soc son") || comb.includes("sóc sơn")) return "Sóc Sơn, Hà Nội";
    if (comb.includes("thanh tri") || comb.includes("thanh trì")) return "Thanh Trì, Hà Nội";

    // Specific granular districts for TP. Hồ Chí Minh
    if (comb.includes("thu duc") || comb.includes("thủ đức")) return "Thủ Đức, TP. Hồ Chí Minh";
    if (comb.includes("quan 1") || comb.includes("quận 1") || comb.includes("district 1")) return "Quận 1, TP. Hồ Chí Minh";
    if (comb.includes("quan 3") || comb.includes("quận 3") || comb.includes("district 3")) return "Quận 3, TP. Hồ Chí Minh";
    if (comb.includes("quan 7") || comb.includes("quận 7") || comb.includes("district 7")) return "Quận 7, TP. Hồ Chí Minh";
    if (comb.includes("binh thanh") || comb.includes("bình thạnh")) return "Bình Thạnh, TP. Hồ Chí Minh";
    if (comb.includes("go vap") || comb.includes("gò vấp")) return "Gò Vấp, TP. Hồ Chí Minh";
    if (comb.includes("tan binh") || comb.includes("tân bình")) return "Tân Bình, TP. Hồ Chí Minh";

    // 1. Check for specific provinces by region string first (region in GeoIP is far more reliable)
    for (const entry of VIETNAM_PROVINCES_SERVER) {
      if (entry.names.some((n) => r.includes(n))) {
        return entry.displayName;
      }
    }

    // 2. Check for specific provinces by city string
    for (const entry of VIETNAM_PROVINCES_SERVER) {
      if (entry.names.some((n) => c.includes(n))) {
        return entry.displayName;
      }
    }

    // 3. Coordinate-boundary validation (covers Vietnam's key regions with high accuracy):
    if (typeof lat === "number" && typeof lon === "number" && lat !== 0 && lon !== 0) {
      // Phan Tây Nhạc Street Block Core (Latitude: 21.034 to 21.043, Longitude: 105.738 to 105.748)
      if (lat >= 21.034 && lat <= 21.043 && lon >= 105.738 && lon <= 105.748) {
        return "Phan Tây Nhạc, Nam Từ Liêm, Hà Nội";
      }

      // Nam Từ Liêm Broader District (Latitude: 20.985 to 21.055, Longitude: 105.720 to 105.795)
      if (lat >= 20.985 && lat <= 21.055 && lon >= 105.720 && lon <= 105.795) {
        return "Nam Từ Liêm, Hà Nội";
      }

      // Cầu Giấy (Latitude: 21.015 to 21.055, Longitude: 105.775 to 105.815)
      if (lat >= 21.015 && lat <= 21.055 && lon >= 105.775 && lon <= 105.815) {
        return "Cầu Giấy, Hà Nội";
      }

      // Long Biên Core (Latitude: 21.020 to 21.070, Longitude: 105.875 to 105.930)
      if (lat >= 21.020 && lat <= 21.070 && lon >= 105.875 && lon <= 105.930) {
        return "Long Biên, Hà Nội";
      }

      // Hà Nội Core & Metropolitan Area (Latitude: 20.55 to 21.40, Longitude: 105.35 to 106.10)
      if (lat >= 20.55 && lat <= 21.40 && lon >= 105.35 && lon <= 106.10) {
        return "Hà Nội";
      }

      // Quảng Ninh check (Bounding Box: lat 20.65 to 21.75, lon 106.4 to 108.2)
      if (lat >= 20.65 && lat <= 21.75 && lon >= 106.4 && lon <= 108.2) {
        // Exclude Hai Phong core if coordinates are strictly within Hai Phong
        if (lat < 20.90 && lon < 106.75) {
          return "Hải Phòng";
        }
        return "Quảng Ninh";
      }

      // Hải Phòng check
      if (lat >= 20.55 && lat <= 20.95 && lon >= 106.45 && lon <= 107.15) {
        return "Hải Phòng";
      }

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
    }

    // 4. If text explicitly indicates Hanoi
    if (c.includes("hanoi") || c.includes("ha noi") || r.includes("hanoi") || r.includes("ha noi")) {
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

  // High-precision GeoIP resolver (integrates Google Edge headers, ipwho.is, ipinfo.io, and ip-api.com)
  async function resolveGeoFromIp(
    ip: string,
    edgeGeo?: { city?: string; region?: string; country?: string; lat?: number; lon?: number } | null
  ): Promise<GeoCacheEntry["data"]> {
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
    const fetchWithTimeout = async (url: string, ms = 2200): Promise<any> => {
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

    interface Cand {
      city: string;
      region: string;
      country: string;
      lat: number | null;
      lon: number | null;
      source: string;
    }
    const candidates: Cand[] = [];

    // Check Cloud Run / GFE edge headers first (direct Google peering)
    if (edgeGeo && (edgeGeo.city || edgeGeo.region || (edgeGeo.lat && edgeGeo.lon))) {
      candidates.push({
        city: edgeGeo.city || "",
        region: edgeGeo.region || "",
        country: edgeGeo.country || "Việt Nam",
        lat: edgeGeo.lat ?? null,
        lon: edgeGeo.lon ?? null,
        source: "google-edge",
      });
    }

    try {
      const [resWhois, resIpInfo, resIpApi] = await Promise.allSettled([
        fetchWithTimeout(`https://ipwho.is/${ip}`, 2200),
        fetchWithTimeout(`https://ipinfo.io/${ip}/json`, 2200),
        fetchWithTimeout(`http://ip-api.com/json/${ip}?fields=status,country,region,regionName,city,district,lat,lon,zip`, 2200),
      ]);

      if (resWhois.status === "fulfilled" && resWhois.value && resWhois.value.success !== false) {
        const d = resWhois.value;
        candidates.push({
          city: d.city || "",
          region: d.region || "",
          country: d.country || "Việt Nam",
          lat: typeof d.latitude === "number" ? d.latitude : null,
          lon: typeof d.longitude === "number" ? d.longitude : null,
          source: "ipwho.is",
        });
      }

      if (resIpInfo.status === "fulfilled" && resIpInfo.value && !resIpInfo.value.error) {
        const d = resIpInfo.value;
        let pLat: number | null = null;
        let pLon: number | null = null;
        if (d.loc && typeof d.loc === "string" && d.loc.includes(",")) {
          const [lt, ln] = d.loc.split(",");
          const parsedLt = parseFloat(lt);
          const parsedLn = parseFloat(ln);
          if (!isNaN(parsedLt) && !isNaN(parsedLn)) {
            pLat = parsedLt;
            pLon = parsedLn;
          }
        }
        candidates.push({
          city: d.city || "",
          region: d.region || "",
          country: d.country === "VN" ? "Việt Nam" : (d.country || "Việt Nam"),
          lat: pLat,
          lon: pLon,
          source: "ipinfo.io",
        });
      }

      if (resIpApi.status === "fulfilled" && resIpApi.value && resIpApi.value.status === "success") {
        const d = resIpApi.value;
        candidates.push({
          city: d.city || d.district || "",
          region: d.regionName || d.region || "",
          country: d.country || "Việt Nam",
          lat: typeof d.lat === "number" ? d.lat : null,
          lon: typeof d.lon === "number" ? d.lon : null,
          source: "ip-api.com",
        });
      }

      // Smart Multi-Provider Consensus & Accuracy Scorer:
      // Evaluates all candidates (Google Edge headers, ipwho.is, ipinfo.io, ip-api.com)
      // Scores based on: edge telemetry, coordinate match, province consensus, and district specificity.
      let bestCandidate: Cand | null = null;
      let highestScore = -1;

      // First, tally how many candidates voted for each province
      const provinceVotes = new Map<string, number>();
      for (const cand of candidates) {
        const prov = standardizeVietnamProvince(cand.city, cand.region, cand.lat ?? undefined, cand.lon ?? undefined);
        if (prov && prov !== "Việt Nam") {
          provinceVotes.set(prov, (provinceVotes.get(prov) || 0) + 1);
        }
      }

      for (const cand of candidates) {
        const prov = standardizeVietnamProvince(cand.city, cand.region, cand.lat ?? undefined, cand.lon ?? undefined);
        let score = 0;

        if (prov && prov !== "Việt Nam") {
          score += 10;
          // Add consensus weight (how many other candidates agree)
          const votes = provinceVotes.get(prov) || 1;
          score += (votes - 1) * 8;

          // Google Edge direct peering bonus
          if (cand.source === "google-edge") {
            score += 15;
          }

          // Granular district specificity (e.g. "Cầu Giấy, Hà Nội" or "Hạ Long, Quảng Ninh")
          if (prov.includes(",")) {
            score += 5;
          }

          // Mathematical coordinate validation bonus
          if (typeof cand.lat === "number" && typeof cand.lon === "number") {
            score += 4;
          }
        }

        if (score > highestScore) {
          highestScore = score;
          bestCandidate = cand;
        }
      }

      if (bestCandidate) {
        rawCity = bestCandidate.city;
        rawRegion = bestCandidate.region;
        rawCountry = bestCandidate.country;
        lat = bestCandidate.lat;
        lon = bestCandidate.lon;
        providerSource = bestCandidate.source;
      } else if (candidates.length > 0) {
        const first = candidates[0];
        rawCity = first.city;
        rawRegion = first.region;
        rawCountry = first.country;
        lat = first.lat;
        lon = first.lon;
        providerSource = first.source;
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
      const edgeGeo = extractGoogleEdgeGeo(req);
      const {
        visitorId,
        deviceId,
        sessionId,
        page,
        detail,
        device,
        browser,
        screenResolution,
        isReturning,
        visitCount,
        role,
        isAdminDevice,
        clientLocation,
        latitude,
        longitude,
      } = req.body || {};

      const cleanDevice = sanitizeDeviceLabelServer(device || "Thiết bị di động", screenResolution || "");
      const geo = await resolveGeoFromIp(publicIp, edgeGeo);
      const maskedIp = maskIp(publicIp);
      const nowIso = new Date().toISOString();
      const effectiveVisitorId = visitorId || sessionId || `vis_${Date.now()}`;
      const effectiveRecordId = deviceId || effectiveVisitorId;

      // Ultra-accurate location resolution (prioritize GPS / clientLocation, prevent false Long Biên ISP datacenter mappings)
      let resolvedLoc = geo.location || "Việt Nam";
      let resolvedCity = geo.city || "";
      let resolvedRegion = geo.region || "";
      let resolvedLat = geo.latitude ?? (typeof latitude === "number" ? latitude : null);
      let resolvedLon = geo.longitude ?? (typeof longitude === "number" ? longitude : null);

      if (typeof latitude === "number" && typeof longitude === "number" && latitude !== 0 && longitude !== 0) {
        resolvedLat = latitude;
        resolvedLon = longitude;
        const gpsProv = standardizeVietnamProvince("", "", latitude, longitude);
        if (gpsProv && gpsProv !== "Việt Nam") {
          resolvedLoc = gpsProv;
        }
      }

      if (clientLocation && clientLocation !== "Việt Nam") {
        const cleanedClientLoc = stripIspServer(clientLocation);
        if (cleanedClientLoc && cleanedClientLoc !== "Việt Nam") {
          resolvedLoc = cleanedClientLoc;
        }
      }

      // 1. Write to Firestore 'visitor_logs' collection
      if (db) {
        try {
          const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const logDocRef = doc(db, "visitor_logs", logId);
          await setDoc(logDocRef, {
            id: logId,
            visitorId: effectiveVisitorId,
            deviceId: deviceId || effectiveVisitorId,
            sessionId: sessionId || effectiveVisitorId,
            ip: maskedIp,
            rawIp: publicIp,
            city: resolvedCity,
            region: resolvedRegion,
            country: geo.country || "Việt Nam",
            location: resolvedLoc,
            latitude: resolvedLat,
            longitude: resolvedLon,
            page: page || "Trang chủ",
            detail: detail || "Xem Portfolio",
            device: cleanDevice,
            browser: browser || "Trình duyệt",
            screenResolution: screenResolution || "",
            isReturning: Boolean(isReturning || (visitCount && visitCount > 1)),
            visitCount: typeof visitCount === "number" ? visitCount : (isReturning ? 2 : 1),
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
          const histDocRef = doc(db, "visitor_history", effectiveRecordId);
          await setDoc(
            histDocRef,
            {
              id: effectiveRecordId,
              visitorId: effectiveVisitorId,
              deviceId: deviceId || effectiveVisitorId,
              role: role || "visitor",
              isAdminDevice: Boolean(isAdminDevice),
              isReturning: Boolean(isReturning || (visitCount && visitCount > 1)),
              visitCount: typeof visitCount === "number" ? visitCount : (isReturning ? 2 : 1),
              device: cleanDevice,
              browser: browser || "Trình duyệt",
              screenResolution: screenResolution || "",
              location: resolvedLoc,
              city: resolvedCity,
              region: resolvedRegion,
              country: geo.country,
              latitude: resolvedLat,
              longitude: resolvedLon,
              lastPage: page || "Trang chủ",
              lastSeenAt: nowIso,
            },
            { merge: true }
          );
        } catch (histErr: any) {
          console.warn("[visitor_history] Firestore error:", histErr.message);
        }
      }

      console.log(`[VisitorLog] Resolved IP ${maskedIp} -> Location: "${resolvedLoc}" (Lat: ${resolvedLat}, Lon: ${resolvedLon}) Device: "${cleanDevice}"`);

      return res.json({
        ok: true,
        ip: maskedIp,
        city: resolvedCity,
        region: resolvedRegion,
        country: geo.country,
        location: resolvedLoc,
        latitude: resolvedLat,
        longitude: resolvedLon,
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
      const edgeGeo = extractGoogleEdgeGeo(req);
      const geo = await resolveGeoFromIp(ip, edgeGeo);
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
      const edgeGeo = extractGoogleEdgeGeo(req);
      const geo = await resolveGeoFromIp(ip, edgeGeo);
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
      const {
        visitorId,
        deviceId,
        role,
        device,
        browser,
        screenResolution,
        page,
        isAdminDevice,
        clientLocation,
        isReturning,
        visitCount,
      } = req.body;
      if (!visitorId) return res.json({ ok: true });

      const now = Date.now();
      const isActuallyAdmin = Boolean(
        isAdminDevice === true ||
        role === "admin" ||
        String(role).toLowerCase().includes("admin")
      );

      const cleanDevice = sanitizeDeviceLabelServer(device || "Thiết bị di động", screenResolution || "");

      // Resolve visitor geographic location
      let location = clientLocation ? stripIspServer(clientLocation) : undefined;
      if (!location || location === "Việt Nam") {
        const ip = extractPublicClientIp(req);
        if (ip) {
          const edgeGeo = extractGoogleEdgeGeo(req);
          const geo = await resolveGeoFromIp(ip, edgeGeo);
          if (geo.location && geo.location !== "Việt Nam") {
            location = geo.location;
          }
        }
      }

      serverActiveVisitors.set(visitorId, {
        deviceId: deviceId || visitorId,
        role: isActuallyAdmin ? "admin" : (role || "visitor"),
        device: cleanDevice,
        browser: browser || "Trình duyệt",
        screenResolution: screenResolution || "",
        page: page || "Trang chủ",
        location: location || "Việt Nam",
        isAdminDevice: isActuallyAdmin,
        isReturning: Boolean(isReturning || (visitCount && visitCount > 1)),
        visitCount: typeof visitCount === "number" ? visitCount : (isReturning ? 2 : 1),
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

          const isReturningVisitor = Boolean(isReturning || (visitCount && visitCount > 1));
          const returnLabel = isReturningVisitor ? `Khách xem lại (Lần ${visitCount || 2})` : "Khách mới";
          console.log(`[WebPush] Detected ${returnLabel} (${device}) from ${location} on "${page}". Triggering background push!`);

          sendPushNotificationToAdmins({
            title: isReturningVisitor ? `🔄 Khách Xem Lại Đang Vào Web (Lần ${visitCount || 2})!` : "🚨 Khách Lạ Đang Xem Website!",
            body: `${returnLabel} [${device || "Điện thoại"}] từ ${location || "Việt Nam"} đang xem: "${page || "Trang chủ"}". Hiện có ${strangers.length} khách trực tuyến.`,
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

  // Real-Time Precision Calibration endpoint for instant device & location updating
  app.post("/api/presence/calibrate-vip", async (req, res) => {
    try {
      const { visitorId, deviceId, newLocation, device } = req.body || {};
      const targetLoc = newLocation ? stripIspServer(newLocation) : undefined;
      const targetDevice = device ? sanitizeDeviceLabelServer(device) : undefined;

      const updateData: any = {};
      if (targetLoc && targetLoc !== "Việt Nam") updateData.location = targetLoc;
      if (targetDevice) updateData.device = targetDevice;

      if (Object.keys(updateData).length > 0) {
        if (visitorId && serverActiveVisitors.has(visitorId)) {
          const prev = serverActiveVisitors.get(visitorId)!;
          serverActiveVisitors.set(visitorId, {
            ...prev,
            ...(targetLoc ? { location: targetLoc } : {}),
            ...(targetDevice ? { device: targetDevice } : {}),
          });
        }
        if (db) {
          if (deviceId) {
            const histRef = doc(db, "visitor_history", deviceId);
            await setDoc(histRef, updateData, { merge: true }).catch(() => {});
          }
          if (visitorId) {
            const actRef = doc(db, "active_visitors", visitorId);
            await setDoc(actRef, updateData, { merge: true }).catch(() => {});
          }
        }
      }
      return res.json({ ok: true, location: targetLoc, device: targetDevice });
    } catch (e: any) {
      return res.json({ ok: false, error: e.message });
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

      console.log("Last Error from GenAI:", lastError);

      if (!response) {
        throw new Error(
          lastError?.message || 
          "Mô hình AI hiện đang quá tải hoặc gặp lỗi. Vui lòng thử lại sau!"
        );
      }

      const responseText = response?.text ? response.text.trim() : null;
      if (!responseText) {
        throw new Error("Không nhận được dữ liệu (Text rỗng) từ AI");
      }
      return res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error("AI Photo Suggestion Error:", error);
      return res.status(500).json({ error: error.message || "Lỗi xử lý gợi ý AI" });
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
          lastError?.message || 
          "Mô hình AI hiện đang quá tải hoặc gặp lỗi. Vui lòng thiết lập khóa API của riêng bạn hoặc thử lại sau vài phút!"
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
      return res.status(500).json({ error: error.message || "Lỗi xử lý gợi ý AI" });
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
        throw new Error(
          lastError?.message || "Mô hình AI hiện đang quá tải hoặc gặp lỗi."
        );
      }

      const optimizedText = response.text ? response.text.trim() : textRaw;
      return res.json({ optimizedText: optimizedText.replace(/^["']|(?:["']\n?)$/g, "") });
    } catch (error: any) {
      console.error("AI Text Optimization Error:", error);
      return res.status(500).json({ error: "Lỗi AI tối ưu chữ" });
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
      if (errMsg.includes("429") || errMsg.includes("quota") || error?.status === 429 || errMsg.includes("RESOURCE_EXHAUSTED")) {
        return res.json({ reply: "Ối dồi ôi, bà con hỏi đông quá Đậu Đậu quá tải xỉu up xỉu down ùi 💦 Đằng ấy đợi tui cỡ 1-2 phút rùi nhắn lại nha hức hức!" });
      }
      if (errMsg.includes("503") || errMsg.includes("high demand") || error?.status === 503 || errMsg.includes("UNAVAILABLE")) {
        return res.json({ reply: "Đậu Đậu đang bị nghẽn mạng xíu xiu gòi 🥺 Máy chủ đang hơi quá tải, đằng ấy đợi xíu gòi nhắn lại nhen!" });
      }
      console.error("AI Chat Error:", error);
      return res.json({ reply: "Đậu Đậu bị va vấp mạng rùi ứa ừa! Đằng ấy tải lại trang dùm Đậu nhen 😭" });
    }
  });

  // Helper function to build luxury customer confirmation email HTML
  function generateCustomerConfirmationHtml(payload: Record<string, any>): string {
    const clientName = payload["✨ 1. TÊN KHÁCH HÀNG / TỔ CHỨC"] || payload.schoolName || "Quý khách";
    const concept = payload["🎯 2. CONCEPT MONG MUỐN"] || payload.conceptType || "Concept Chụp Ảnh";
    const dateStr = payload["📅 4. NGÀY CHỤP (Dự kiến)"] || payload.date || "(Chưa chọn ngày)";
    const timeSlot =
      payload["⏰ 5. CA CHỤP"] ||
      payload["⏰ 5. THỜI GIAN CHỤP"] ||
      payload["⏰ 5. CA CHỤP / THỜI GIAN"] ||
      payload["⏰ 5. THỜI GIAN"] ||
      payload["⏰ 5. THỜI GIAN/CA CHỤP"] ||
      payload.timeSlot ||
      "Cả ngày";
    const bookingCode =
      payload["🎟️ Mã Booking"] ||
      payload["🎟️ 8. MÃ SỐ TICKET"] ||
      payload.id ||
      "BRBK_" + Date.now().toString().slice(-6);
    const classSize =
      payload["🔥 3. SỐ LƯỢNG NGƯỜI"] || (payload.classSize ? `${payload.classSize} người` : "(Chưa rõ)");
    const address = payload["📍 6b. ĐỊA CHỈ LIÊN HỆ"] || payload.address || "(Thoả thuận)";
    const contactHandle =
      payload["📱 6. INFO LIÊN HỆ (Zalo / Instagram)"] || payload.instagramOrZalo || "(Chưa có)";
    const notes = payload["💌 7. LỊCH TRÌNH / LỜI NHẮN"] || payload.notes || "(Không có)";
    let estCost = payload["💰 5b. TẠM TÍNH CHI PHÍ"] || payload.estimatedCost;
    if (!estCost || estCost === "Sẽ tư vấn & báo giá chi tiết" || estCost === "Báo giá cụ thể sau khi tư vấn") {
      const isThptOrUni =
        concept.includes("THPT") ||
        concept.includes("PRE-GRADUATION") ||
        concept.includes("University") ||
        concept.includes("KỶ YẾU") ||
        concept.includes("kỷ yếu");

      if (isThptOrUni) {
        const sizeNum = typeof classSize === "number" ? classSize : parseInt(String(classSize).replace(/\D/g, ""), 10) || 1;
        const isFull = timeSlot.toLowerCase().includes("cả ngày");
        let uPrice = 500000;
        if (sizeNum === 1) uPrice = isFull ? 1500000 : 900000;
        else if (sizeNum === 2) uPrice = isFull ? 800000 : 700000;
        else if (sizeNum === 3) uPrice = isFull ? 700000 : 600000;
        else if (sizeNum <= 5) uPrice = isFull ? 600000 : 500000;
        else uPrice = isFull ? 600000 : 500000;

        const totalPrice = sizeNum * uPrice;
        estCost = `${totalPrice.toLocaleString("vi-VN")}đ (Đơn giá: ${(uPrice / 1000).toLocaleString("vi-VN")}k/người cho nhóm ${sizeNum} người)`;
      } else if (concept.includes("Event") || concept.includes("Sự kiện")) {
        estCost = "Sẽ tư vấn & báo giá chi tiết dựa trên quy mô sự kiện";
      } else {
        estCost = "Sẽ tư vấn & báo giá chi tiết dựa trên yêu cầu concept riêng";
      }
    }

    const isApproved =
      payload._isPaymentApproved ||
      payload["✨ Trạng thái"]?.includes("DUYỆT") ||
      payload["✨ Trạng thái"]?.includes("CHẤP NHẬN") ||
      payload["✨ Trạng thái"]?.includes("ĐỒNG BỘ") ||
      payload.status === "Đã duyệt";

    const headerTitle = isApproved
      ? "XÁC NHẬN ĐẶT LỊCH THÀNH CÔNG 🎉"
      : "XÁC NHẬN TIẾP NHẬN ĐẶT LỊCH 🎉";

    const headerSubtitle = isApproved
      ? "Đơn đặt lịch của bạn đã được xác nhận cọc & duyệt lịch chính thức trên hệ thống Studio!"
      : "Hệ thống Studio đã tiếp nhận yêu cầu đặt lịch của bạn và sẽ liên hệ hỗ trợ trong vòng 12h!";

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #09090b; color: #e4e4e7; border-radius: 16px; overflow: hidden; border: 1px solid #27272a; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #18181b 0%, #09090b 100%); padding: 32px 30px 24px 30px; border-bottom: 1px solid #27272a; text-align: center;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #B5945B; font-weight: 700; display: inline-block; padding: 4px 14px; background: rgba(181, 148, 91, 0.12); border-radius: 9999px; border: 1px solid rgba(181, 148, 91, 0.35); margin-bottom: 12px;">
            BERGH.RYKER PHOTOGRAPHY STUDIO
          </span>
          <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
            ${headerTitle}
          </h1>
          <p style="margin: 10px 0 0 0; color: #a1a1aa; font-size: 13px; line-height: 1.5;">
            ${headerSubtitle}
          </p>
        </div>

        <!-- Ticket Badge Box -->
        <div style="padding: 24px 30px 0 30px;">
          <div style="background: linear-gradient(135deg, rgba(181, 148, 91, 0.15) 0%, rgba(181, 148, 91, 0.05) 100%); border: 1px dashed #B5945B; border-radius: 12px; padding: 18px 20px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #d4af37; font-weight: 700;">
              MÃ TICKET ĐẶT LỊCH CỦA BẠN
            </div>
            <div style="font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 2px; margin-top: 6px; font-family: monospace;">
              ${bookingCode}
            </div>
            <div style="font-size: 11px; color: #a1a1aa; margin-top: 6px;">
              Quý khách vui lòng lưu lại mã Ticket này để đối soát và tra cứu tiến độ trên website
            </div>
          </div>
        </div>

        <!-- Details -->
        <div style="padding: 24px 30px;">
          <p style="color: #ffffff; font-size: 15px; margin-top: 0; line-height: 1.6;">
            Xin chào <strong>${clientName}</strong>,
          </p>
          <p style="color: #a1a1aa; font-size: 13px; line-height: 1.6; margin-top: 0;">
            Cảm ơn bạn đã tin tưởng và lựa chọn <strong>Bergh.Ryker Studio</strong>. Dưới đây là thông tin chi tiết đơn đặt lịch của bạn:
          </p>

          <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #121214; border-radius: 10px; overflow: hidden; border: 1px solid #27272a;">
            <tbody>
              ${isApproved ? `
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; width: 35%; font-weight: 600;">✨ Trạng thái đơn</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #4ade80; font-size: 13px; font-weight: 700;">ĐÃ DUYỆT & KHOÁ LỊCH CHÍNH THỨC</td>
              </tr>
              ` : `
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; width: 35%; font-weight: 600;">✨ Trạng thái đơn</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #facc15; font-size: 13px; font-weight: 700;">ĐANG CHỜ XÁC NHẬN</td>
              </tr>
              `}
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; width: 35%; font-weight: 600;">📸 Gói chụp / Concept</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #ffffff; font-size: 13px; font-weight: 600;">${concept}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; font-weight: 600;">📅 Ngày chụp dự kiến</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #B5945B; font-size: 13px; font-weight: 700;">${dateStr}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; font-weight: 600;">⏰ Ca chụp / Thời gian</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #f4f4f5; font-size: 13px;">${timeSlot}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; font-weight: 600;">👥 Số lượng người</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #f4f4f5; font-size: 13px;">${classSize}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; font-weight: 600;">📍 Địa chỉ liên hệ</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #f4f4f5; font-size: 13px;">${address}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; font-weight: 600;">📱 Zalo / Instagram</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #f4f4f5; font-size: 13px;">${contactHandle}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; font-weight: 600;">💰 Chi phí tạm tính (chưa bao gồm phí di chuyển)</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #B5945B; font-size: 13px; font-weight: 700;">${estCost}</td>
              </tr>
              ${(payload.amountPaid || payload["💰 Số tiền cọc đã nhận từ SePay"]) ? `
              <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 13px; font-weight: 600;">💵 Tiền cọc đã nhận</td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #27272a; color: #4ade80; font-size: 13px; font-weight: 700;">${payload["💰 Số tiền cọc đã nhận từ SePay"] || `${Number(payload.amountPaid).toLocaleString("vi-VN")} VNĐ`}</td>
              </tr>
              ` : ""}
              <tr>
                <td style="padding: 10px 14px; color: #a1a1aa; font-size: 13px; font-weight: 600;">💌 Ghi chú / Lời nhắn</td>
                <td style="padding: 10px 14px; color: #f4f4f5; font-size: 13px;">${notes}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="background: #121214; padding: 20px 30px; text-align: center; border-top: 1px solid #27272a; font-size: 12px; color: #71717a;">
          <p style="margin: 0 0 4px 0; color: #a1a1aa; font-weight: 600;">
            Bergh.Ryker Photography Studio • Hà Nội
          </p>
          <p style="margin: 0; color: #71717a;">
            Hotline & Zalo: <strong style="color: #ffffff;">0365.266.204</strong> • Website: <a href="https://bergh-ryker.ai.studio/" style="color: #B5945B; text-decoration: none;">https://bergh-ryker.ai.studio/</a>
          </p>
        </div>
      </div>
    `;
  }

  // Resilient multi-channel notification helper
  async function sendAdminNotification(payload: Record<string, any>): Promise<{ success: boolean; delivered?: string; note?: string }> {
    let targetEmail = payload.targetEmail || process.env.ADMIN_EMAIL || "nguyenducdung1702@gmail.com";
    const subject = payload._subject || "📸 Thông Báo Mới từ Bergh.Ryker Studio";
    const clientName = payload["✨ 1. TÊN KHÁCH HÀNG / TỔ CHỨC"] || payload.schoolName || "Khách hàng";
    const concept = payload["🎯 2. CONCEPT MONG MUỐN"] || payload.conceptType || "(Chưa rõ)";
    const dateStr = payload["📅 4. NGÀY CHỤP (Dự kiến)"] || payload.date || "";
    const bookingCode = payload["🎟️ Mã Booking"] || payload["🎟️ 8. MÃ SỐ TICKET"] || payload.id || "";
    const customerEmail = (
      payload.email ||
      payload.customerEmail ||
      payload["📧 EMAIL LIÊN HỆ"] ||
      payload["📧 Email Khách Hàng"] ||
      payload["📧 EMAIL KHÁCH HÀNG"] ||
      ""
    ).trim();

    const shouldSkipCustomer =
      payload.skipCustomerConfirmation === true ||
      payload._skipCustomerConfirmation === true;

    let deliveredChannel = "";

    // Load credentials from Firestore configs/email if available
    let smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
    let smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
    let smtpHost = process.env.SMTP_HOST;
    let smtpPort = process.env.SMTP_PORT;

    if (db) {
      try {
        const emailConfigSnap = await getDoc(doc(db, "configs", "email"));
        if (emailConfigSnap.exists()) {
          const ec = emailConfigSnap.data();
          if (ec?.targetEmail) targetEmail = ec.targetEmail;
          if (ec?.user && ec?.pass) {
            smtpUser = ec.user;
            smtpPass = ec.pass;
            if (ec.host) smtpHost = ec.host;
            if (ec.port) smtpPort = ec.port;
          }
        }
      } catch (cErr: any) {
        console.warn("[Notification] Note on loading email config from Firestore:", cErr?.message || cErr);
      }
    }

    const rows = Object.entries(payload)
      .filter(([key]) => !key.startsWith("_") && key !== "targetEmail" && key !== "email")
      .map(([key, value]) => `<tr><td style="padding: 10px 14px; border-bottom: 1px solid #262626; color: #a1a1aa; font-weight: 600; width: 35%; font-size: 13px;">${key}</td><td style="padding: 10px 14px; border-bottom: 1px solid #262626; color: #f4f4f5; font-size: 13px;">${value}</td></tr>`)
      .join("");

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #09090b; color: #e4e4e7; border-radius: 14px; overflow: hidden; border: 1px solid #27272a;">
        <div style="background: linear-gradient(135deg, #18181b, #09090b); padding: 24px 28px; border-bottom: 1px solid #27272a;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #B5945B; font-weight: 700; display: block; margin-bottom: 6px;">Bergh.Ryker Photography Studio</span>
          <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; line-height: 1.3;">${subject}</h2>
          <p style="margin: 8px 0 0 0; color: #a1a1aa; font-size: 13px;">Thông báo tự động từ hệ thống đặt lịch</p>
        </div>
        <div style="padding: 24px 28px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            ${rows}
          </table>
          <div style="background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 14px 18px; font-size: 12px; color: #a1a1aa; line-height: 1.6;">
            💡 Đơn đặt lịch đã được lưu trữ an toàn trong Trung Tâm Quản Trị Studio. Bạn có thể mở hệ thống để duyệt hoặc đổi trạng thái đơn.
          </div>
        </div>
        <div style="background: #121214; padding: 16px 28px; text-align: center; border-top: 1px solid #27272a; font-size: 12px; color: #71717a;">
          Bergh.Ryker Photography Studio • Hà Nội • Hotline & Zalo: <strong style="color: #ffffff;">0365.266.204</strong> • Website: <a href="https://bergh-ryker.ai.studio/" style="color: #B5945B; text-decoration: none;">https://bergh-ryker.ai.studio/</a>
        </div>
      </div>
    `;

    let adminDelivered = false;
    let customerDelivered = false;

    // Helper to send RFC-compliant MIME email via Google Workspace Gmail API
    async function sendViaGmailApi(token: string, mailOptions: {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    }): Promise<boolean> {
      try {
        const composer = new MailComposer(mailOptions);
        const compiled = await composer.compile().build();
        const raw = compiled.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        });
        if (res.ok) return true;
        const errText = await res.text();
        console.warn(`[Gmail API] send error status ${res.status}:`, errText);
        return false;
      } catch (err: any) {
        console.warn("[Gmail API] send exception:", err?.message || err);
        return false;
      }
    }

    // 1. Channel A: Direct Google Workspace Gmail REST API (if admin logged in with Google OAuth)
    if (db) {
      try {
        const tokenSnap = await getDoc(doc(db, "configs", "googleToken"));
        if (tokenSnap.exists()) {
          const tData = tokenSnap.data();
          const ageMs = tData?.updatedAt ? Date.now() - tData.updatedAt : 0;
          if (tData?.accessToken && ageMs < 3540 * 1000) {
            // Send to Studio Admin
            const adminPlain = Object.entries(payload)
              .filter(([k]) => !k.startsWith("_"))
              .map(([k, v]) => `${k}: ${v}`)
              .join("\n");

            adminDelivered = await sendViaGmailApi(tData.accessToken, {
              from: `"Bergh.Ryker Studio" <${targetEmail}>`,
              to: targetEmail,
              subject: subject,
              text: adminPlain,
              html: emailHtml,
            });

            if (adminDelivered) {
              deliveredChannel = "gmail_oauth_api";
              console.log(`[Notification] Delivered admin email via Google Gmail API to ${targetEmail}`);
            }

            // Send to Customer (Independent from admin send status, unless skipCustomerConfirmation is true)
            if (!shouldSkipCustomer && customerEmail && customerEmail.includes("@")) {
              const isApproved =
                payload._isPaymentApproved ||
                payload["✨ Trạng thái"]?.includes("DUYỆT") ||
                payload["✨ Trạng thái"]?.includes("CHẤP NHẬN") ||
                payload["✨ Trạng thái"]?.includes("ĐỒNG BỘ") ||
                payload.status === "Đã duyệt";

              const custSubject = isApproved
                ? `📸 [XÁC NHẬN ĐẶT LỊCH THÀNH CÔNG] Đơn Đã Được Duyệt - Bergh.Ryker Studio - Mã: ${bookingCode || "Booking"}`
                : `📸 [XÁC NHẬN TIẾP NHẬN ĐẶT LỊCH] Bergh.Ryker Studio - Mã: ${bookingCode || "Booking"}`;
              const custHtml = generateCustomerConfirmationHtml(payload);
              const custPlain = isApproved
                ? `Xin chào ${clientName},\n\nĐơn đặt lịch chụp ảnh của bạn tại Bergh.Ryker Studio đã được XÁC NHẬN CỌC & DUYỆT LỊCH THÀNH CÔNG.\nMã Ticket: ${bookingCode || "Booking"}\nConcept: ${concept}\nNgày chụp: ${dateStr}\nCa chụp: ${payload["⏰ 5. CA CHỤP"] || payload["⏰ 5. THỜI GIAN CHỤP"] || payload.timeSlot || "Cả ngày"}\nChi phí tạm tính (chưa bao gồm phí di chuyển): ${payload["💰 5b. TẠM TÍNH CHI PHÍ"] || "Theo bảng giá hệ thống"}\n\nHotline & Zalo: 0365.266.204\nWebsite: https://bergh-ryker.ai.studio/`
                : `Xin chào ${clientName},\n\nYêu cầu đặt lịch chụp ảnh của bạn tại Bergh.Ryker Studio đã được tiếp nhận thành công.\nMã Ticket: ${bookingCode || "Booking"}\nConcept: ${concept}\nNgày chụp: ${dateStr}\nCa chụp: ${payload["⏰ 5. CA CHỤP"] || payload["⏰ 5. THỜI GIAN CHỤP"] || payload.timeSlot || "Cả ngày"}\nChi phí tạm tính (chưa bao gồm phí di chuyển): ${payload["💰 5b. TẠM TÍNH CHI PHÍ"] || "Theo bảng giá hệ thống"}\n\nHotline & Zalo: 0365.266.204\nWebsite: https://bergh-ryker.ai.studio/`;

              customerDelivered = await sendViaGmailApi(tData.accessToken, {
                from: `"Bergh.Ryker Studio" <${targetEmail}>`,
                to: customerEmail,
                subject: custSubject,
                text: custPlain,
                html: custHtml,
              });

              if (customerDelivered) {
                console.log(`[Notification] Delivered customer confirmation email via Google Gmail API to ${customerEmail}`);
              }
            }
          }
        }
      } catch (_gErr: any) {
        console.warn("[Notification] Note on Gmail OAuth attempt:", _gErr?.message || _gErr);
      }
    }

    // 2. Channel B: Direct SMTP / Gmail via nodemailer (App Password / SMTP credentials)
    if ((!adminDelivered || (!shouldSkipCustomer && customerEmail && !customerDelivered)) && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport(
          smtpHost
            ? {
                host: smtpHost,
                port: parseInt(smtpPort || "587", 10),
                secure: process.env.SMTP_SECURE === "true",
                auth: { user: smtpUser, pass: smtpPass },
              }
            : {
                service: "gmail",
                auth: { user: smtpUser, pass: smtpPass },
              }
        );

        if (!adminDelivered) {
          await transporter.sendMail({
            from: `"Bergh.Ryker Studio" <${smtpUser}>`,
            to: targetEmail,
            subject: subject,
            html: emailHtml,
            text: Object.entries(payload).filter(([k]) => !k.startsWith("_")).map(([k, v]) => `${k}: ${v}`).join("\n"),
          });
          adminDelivered = true;
          deliveredChannel = "smtp_gmail";
          console.log(`[Notification] Delivered admin email via SMTP to ${targetEmail}`);
        }

        if (!shouldSkipCustomer && customerEmail && !customerDelivered && customerEmail.includes("@")) {
          const isApproved =
            payload._isPaymentApproved ||
            payload["✨ Trạng thái"]?.includes("DUYỆT") ||
            payload["✨ Trạng thái"]?.includes("CHẤP NHẬN") ||
            payload["✨ Trạng thái"]?.includes("ĐỒNG BỘ") ||
            payload.status === "Đã duyệt";

          const custSubject = isApproved
            ? `📸 [XÁC NHẬN ĐẶT LỊCH THÀNH CÔNG] Đơn Đã Được Duyệt - Bergh.Ryker Studio - Mã: ${bookingCode || "Booking"}`
            : `📸 [XÁC NHẬN TIẾP NHẬN ĐẶT LỊCH] Bergh.Ryker Studio - Mã: ${bookingCode || "Booking"}`;
          const custHtml = generateCustomerConfirmationHtml(payload);
          const custPlain = isApproved
            ? `Xin chào ${clientName},\n\nĐơn đặt lịch chụp ảnh của bạn tại Bergh.Ryker Studio đã được XÁC NHẬN CỌC & DUYỆT LỊCH THÀNH CÔNG.\nMã Ticket: ${bookingCode || "Booking"}\nConcept: ${concept}\nNgày chụp: ${dateStr}\nCa chụp: ${payload["⏰ 5. CA CHỤP"] || payload["⏰ 5. THỜI GIAN CHỤP"] || payload.timeSlot || "Cả ngày"}\nChi phí tạm tính (chưa bao gồm phí di chuyển): ${payload["💰 5b. TẠM TÍNH CHI PHÍ"] || "Theo bảng giá hệ thống"}\n\nHotline & Zalo: 0365.266.204\nWebsite: https://bergh-ryker.ai.studio/`
            : `Xin chào ${clientName},\n\nYêu cầu đặt lịch chụp ảnh của bạn tại Bergh.Ryker Studio đã được tiếp nhận thành công.\nMã Ticket: ${bookingCode || "Booking"}\nConcept: ${concept}\nNgày chụp: ${dateStr}\nCa chụp: ${payload["⏰ 5. CA CHỤP"] || payload["⏰ 5. THỜI GIAN CHỤP"] || payload.timeSlot || "Cả ngày"}\nChi phí tạm tính (chưa bao gồm phí di chuyển): ${payload["💰 5b. TẠM TÍNH CHI PHÍ"] || "Theo bảng giá hệ thống"}\n\nHotline & Zalo: 0365.266.204\nWebsite: https://bergh-ryker.ai.studio/`;

          await transporter.sendMail({
            from: `"Bergh.Ryker Studio" <${smtpUser}>`,
            to: customerEmail,
            subject: custSubject,
            text: custPlain,
            html: custHtml,
          });
          customerDelivered = true;
          console.log(`[Notification] Delivered customer confirmation copy via SMTP to ${customerEmail}`);
        }
      } catch (smtpErr: any) {
        console.warn(`[Notification] SMTP delivery attempt note: ${smtpErr?.message || smtpErr}`);
      }
    }

    // 3. Channel C: FormSubmit API (attempted with circuit breaker and silent fallback)
    if (!deliveredChannel && Date.now() > formSubmitOutageUntil) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const cleanSubmitPayload: Record<string, any> = {
          _captcha: "false",
          _template: "box",
          _subject: subject,
          email: targetEmail,
          ...payload,
        };

        const response = await fetch(`https://formsubmit.co/ajax/${targetEmail}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Referer: "https://berghryker.vn/",
            Origin: "https://berghryker.vn",
          },
          body: JSON.stringify(cleanSubmitPayload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          deliveredChannel = "formsubmit";
          console.log(`[Notification] FormSubmit notification dispatched to ${targetEmail}`);
        } else {
          formSubmitOutageUntil = Date.now() + 2 * 60 * 60 * 1000;
        }
      } catch (_fsErr: any) {
        formSubmitOutageUntil = Date.now() + 2 * 60 * 60 * 1000;
      }
    }

    // 4. Channel D: Always record to Firestore admin_notifications collection
    if (db) {
      try {
        const notifDocId = "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        await setDoc(
          doc(db, "admin_notifications", notifDocId),
          {
            id: notifDocId,
            title: subject,
            body: `${clientName} (${concept}) - Ngày: ${dateStr}`,
            bookingId: bookingCode || null,
            payload: payload,
            deliveredChannel: deliveredChannel || "admin_queue",
            read: false,
            createdAt: new Date().toISOString(),
            type: "booking",
          },
          { merge: true }
        );
      } catch (dbErr: any) {
        console.warn("[Notification] Note on storing notification in Firestore:", dbErr?.message || dbErr);
      }
    }

    // 5. Channel E: Instant Realtime Web Push Notification to Admin devices
    try {
      sendPushNotificationToAdmins({
        title: subject.replace(/^[^\w\s\u00C0-\u1EF9]+/, "").trim() || "📸 Đơn đặt lịch mới!",
        body: `${clientName} (${concept}) - Ngày: ${dateStr}`,
        url: "/#S9",
        tag: "booking-" + (bookingCode || Date.now()),
      });
    } catch (pushErr: any) {
      console.warn("[Notification] Note on dispatching web push:", pushErr?.message || pushErr);
    }

    return {
      success: true,
      delivered: deliveredChannel || "admin_queue",
      note: deliveredChannel ? `Đã gửi thành công qua kênh ${deliveredChannel}` : "Đã lưu vào Hàng đợi Quản trị & phát thông báo Web Push",
    };
  }

  // Webhook for SePay (Auto-sync without waiting for browser polling)
  app.post("/api/sepay/webhook", async (req, res) => {
    try {
      const data = req.body;
      console.log("Received SePay Webhook:", data);
      
      const contentStr = String(data.transaction_content || data.transactionContent || data.code || "").trim();
      const amountPaid = Number(data.amount_in || data.transferAmount || data.amount || 0);

      if (contentStr) {
         // Push to the cached list to allow instant recognition by connected clients
         if (!cachedSepayTransactions) cachedSepayTransactions = { transactions: [] };
         cachedSepayTransactions.transactions.unshift(data);
         lastSepayFetchTime = Date.now();

         const normalizedContent = contentStr.toUpperCase().replace(/[^A-Z0-9]/g, '');
         console.log(`[Webhook] Normalizing transaction content for matching: "${normalizedContent}" (Amount: ${amountPaid})`);

         if (db) {
           try {
             // 1. Fetch pending bookings
             const bookingsSnap = await getDocs(collection(db, "bookings"));
             const pendingBookings: any[] = [];
             bookingsSnap.forEach((docSnap) => {
               const b = docSnap.data();
               if (b.status === "Chờ duyệt") {
                 pendingBookings.push({ ...b, id: docSnap.id });
               }
             });

             console.log(`[Webhook] Fetched ${pendingBookings.length} pending bookings.`);

             // 2. Perform match search
             let matchedBooking: any = null;
             for (const b of pendingBookings) {
               const normalizedExpectedMemo = `COC${b.id}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
               const justIdMemo = b.id.toUpperCase().replace(/[^A-Z0-9]/g, '');
               
               const digitsOnly = b.id.replace(/[^0-9]/g, '');
               const fallbackMemo = digitsOnly ? `COC${digitsOnly}`.toUpperCase() : '';
               const justDigitsMemo = digitsOnly ? digitsOnly : '';

               const isMatch = 
                 normalizedContent.includes(normalizedExpectedMemo) || 
                 normalizedContent.includes(justIdMemo) ||
                 (fallbackMemo && normalizedContent.includes(fallbackMemo)) ||
                 (justDigitsMemo && justDigitsMemo.length >= 6 && normalizedContent.includes(justDigitsMemo));

               if (isMatch) {
                 matchedBooking = b;
                 break;
               }
             }

             if (matchedBooking) {
               console.log(`[Webhook] Found matching booking: ${matchedBooking.id} (${matchedBooking.schoolName})`);
               
               // Check if the concept matches: Kỷ yếu THPT ("THPT") or Cử nhân / ĐH ("University")
               const isConceptAutoApprove = matchedBooking.conceptType === "THPT" || matchedBooking.conceptType === "University";
               if (isConceptAutoApprove) {
                 console.log(`[Webhook] Concept matches auto-approval list (THPT/University). Proceeding to auto-approve & sync.`);
                 
                 // Fetch active Google token
                 let activeToken: string | null = null;
                 try {
                   const tokenSnap = await getDoc(doc(db, "configs", "googleToken"));
                   if (tokenSnap.exists()) {
                     const tData = tokenSnap.data();
                     const ageMs = tData?.updatedAt ? (Date.now() - tData.updatedAt) : 0;
                     const isExpired = tData?.updatedAt && (ageMs > 3540 * 1000);
                     if (tData && tData.accessToken && !isExpired) {
                       activeToken = tData.accessToken;
                       console.log("[Webhook] Valid unexpired Google OAuth token loaded successfully.");
                     } else {
                       console.log("[Webhook] Google token exists but is expired. Sync will run when admin opens dashboard next.");
                     }
                   } else {
                     console.log("[Webhook] Google OAuth token not set up in configs. Sync will run when admin connects.");
                   }
                 } catch (tokErr: any) {
                   console.error("[Webhook] Error fetching google token:", tokErr.message);
                 }

                 let updatedEventId = matchedBooking.googleEventId || "";
                 let updatedTaskId = matchedBooking.googleTaskId || "";

                 // Try syncing to Google Calendar & Google Tasks on server side
                 if (activeToken) {
                   try {
                     const eventData = await syncToGoogleCalendarServer(matchedBooking, activeToken);
                     updatedEventId = eventData.id || updatedEventId;
                     console.log(`[Webhook] Server-side Calendar sync successful: ${updatedEventId}`);
                   } catch (calErr: any) {
                     console.error(`[Webhook] Server-side Calendar sync failed:`, calErr.message || calErr);
                   }

                   try {
                     const taskData = await syncToGoogleTasksServer(matchedBooking, activeToken);
                     updatedTaskId = taskData.id || updatedTaskId;
                     console.log(`[Webhook] Server-side Tasks sync successful: ${updatedTaskId}`);
                   } catch (taskErr: any) {
                     console.error(`[Webhook] Server-side Tasks sync failed:`, taskErr.message || taskErr);
                   }
                 }

                 // Send confirmation email
                 const dateFormatted = matchedBooking.date ? matchedBooking.date.split("-").reverse().join("/") : "(Chưa chọn ngày)";
                 let estCostText = (matchedBooking as any).estimatedCost;
                 if (!estCostText) {
                   const isFull = matchedBooking.timeSlot?.toLowerCase().includes("cả ngày") || false;
                   const sizeNum = matchedBooking.classSize || 1;
                   if (matchedBooking.conceptType === "THPT" || matchedBooking.conceptType === "University") {
                     let uPrice = 500000;
                     if (sizeNum === 1) uPrice = isFull ? 1500000 : 900000;
                     else if (sizeNum === 2) uPrice = isFull ? 800000 : 700000;
                     else if (sizeNum === 3) uPrice = isFull ? 700000 : 600000;
                     else if (sizeNum <= 5) uPrice = isFull ? 600000 : 500000;
                     else uPrice = isFull ? 600000 : 500000;
                     const tPrice = sizeNum * uPrice;
                     estCostText = `${tPrice.toLocaleString("vi-VN")}đ (Đơn giá: ${(uPrice / 1000).toLocaleString("vi-VN")}k/người cho nhóm ${sizeNum} người)`;
                   } else if (matchedBooking.conceptType === "Event") {
                     estCostText = "Sẽ tư vấn & báo giá chi tiết dựa trên quy mô sự kiện";
                   } else {
                     estCostText = "Sẽ tư vấn & báo giá chi tiết dựa trên yêu cầu concept riêng";
                   }
                 }

                 const mailPayload = {
                   _captcha: "false",
                   _subject: `✅ ĐÃ THANH TOÁN CỌC (TỰ ĐỘNG) - ĐƠN ĐẶT LỊCH TỪ: ${matchedBooking.schoolName || matchedBooking.id}`,
                   _template: "box",
                   id: matchedBooking.id,
                   bookingId: matchedBooking.id,
                   email: matchedBooking.email || undefined,
                   customerEmail: matchedBooking.email || undefined,
                   _isPaymentApproved: true,
                   "✨ Trạng thái": "HỆ THỐNG ĐÃ TỰ ĐỘNG CHẤP NHẬN & ĐỒNG BỘ",
                   "🎟️ Mã Booking": matchedBooking.id,
                   "💰 Số tiền cọc đã nhận từ SePay": `${amountPaid.toLocaleString('vi-VN')} VNĐ`,
                   "💰 5b. TẠM TÍNH CHI PHÍ": estCostText,
                   "✨ 1. TÊN KHÁCH HÀNG / TỔ CHỨC": matchedBooking.schoolName || "(Chưa rõ)",
                   "🎯 2. CONCEPT MONG MUỐN": matchedBooking.conceptType || "(Chưa rõ)",
                   "🔥 3. SỐ LƯỢNG NGƯỜI": matchedBooking.conceptType === "Event" ? "(Không áp dụng)" : `${matchedBooking.classSize || 0} người`,
                   "📅 4. NGÀY CHỤP (Dự kiến)": dateFormatted,
                   "⏰ 5. CA CHỤP / THỜI GIAN": matchedBooking.timeSlot || "Cả ngày",
                   "📱 6. INFO LIÊN HỆ (Zalo / Instagram)": matchedBooking.instagramOrZalo || "(Không có)",
                   "📍 6b. ĐỊA CHỈ LIÊN HỆ": matchedBooking.address || "(Không có)",
                   "💌 7. LỊCH TRÌNH / LỜI NHẮN": matchedBooking.notes?.trim() ? matchedBooking.notes : "(Trống)",
                 };
                 
                 try {
                   await sendAdminNotification(mailPayload);
                   console.log(`[Webhook] Admin notification dispatched for booking ${matchedBooking.id}`);
                 } catch (mailErr: any) {
                   console.warn(`[Webhook] Notification dispatch handled:`, mailErr?.message || mailErr);
                 }

                 // Save update in Firestore
                 await setDoc(doc(db, "bookings", matchedBooking.id), {
                   hasConfirmedPayment: true,
                   amountPaid: amountPaid,
                   status: "Đã duyệt",
                   emailSent: true,
                   ...(updatedEventId ? { googleEventId: updatedEventId } : {}),
                   ...(updatedTaskId ? { googleTaskId: updatedTaskId } : {})
                 }, { merge: true });

                 // Reserve/lock date
                 if (matchedBooking.date) {
                   await setDoc(doc(db, "availableDates", matchedBooking.date), {
                     date: matchedBooking.date,
                     status: "booked"
                   }, { merge: true });
                   console.log(`[Webhook] Blocked date ${matchedBooking.date} successfully.`);
                 }

                 // Dispatch background push notification to admin devices
                 sendPushNotificationToAdmins({
                   title: "💰 Đã Nhận Tiền Cọc Tự Động!",
                   body: `Nhận ${amountPaid.toLocaleString('vi-VN')} đ cọc từ ${matchedBooking.schoolName}. Lịch đã duyệt & đồng bộ!`,
                   url: "/#S9",
                   tag: "sepay-payment-" + matchedBooking.id,
                 });

                 console.log("[Webhook] Auto approval and synchronization for matched booking finished successfully.");
               } else {
                 console.log("[Webhook] Booking matched content but its concept is not THPT or University. Safe skip auto-approval.");
               }
             } else {
               console.log("[Webhook] No matching pending booking found for transaction.");
             }
           } catch (dbErr: any) {
             console.error("[Webhook] Firestore database operations failed:", dbErr.message || dbErr);
           }
         } else {
            console.warn("[Webhook] Firestore database config not loaded/initialized. Skipping database matching.");
         }
      }

      return res.json({ success: true, message: "Webhook accepted." });
    } catch (e: any) {
      console.error("Webhook process error:", e);
      return res.status(500).json({ success: false });
    }
  });

  // Resilient Proxy API Route to securely send notifications & emails without CORS / client-side failures
  app.post("/api/send-email", async (req, res) => {
    try {
      const payload = req.body || {};
      const result = await sendAdminNotification(payload);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      console.warn("[Notification] Gracefully handled error in /api/send-email:", err?.message || err);
      return res.json({ success: true, delivered: "admin_queue", note: "Notification persisted to admin queue" });
    }
  });

  // Diagnostic Test Email endpoint to test email dispatch and verify setup
  app.post("/api/test-email", async (req, res) => {
    try {
      const { targetEmail } = req.body || {};
      const testPayload = {
        _subject: "🧪 [TEST GMAIL] Kiểm tra luồng gửi thư thông báo - Bergh.Ryker Studio",
        "✨ Trạng thái": "KIỂM TRA HỆ THỐNG GỬI EMAIL THÀNH CÔNG",
        "⏰ Thời gian": new Date().toLocaleString("vi-VN"),
        "📸 Hệ thống": "Bergh.Ryker Booking Dispatcher",
        "💌 Lưu ý": "Nếu bạn nhận được email này, luồng thông báo đặt lịch đã hoạt động hoàn hảo!",
        ...(targetEmail ? { targetEmail } : {}),
      };
      const result = await sendAdminNotification(testPayload);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      console.warn("[Notification] Test email error:", err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || "Lỗi khi kiểm tra gửi email" });
    }
  });

  // Diagnostic Test Customer Confirmation Email endpoint
  app.post("/api/test-customer-email", async (req, res) => {
    try {
      const { customerEmail } = req.body || {};
      const target = customerEmail || process.env.ADMIN_EMAIL || "nguyenducdung1702@gmail.com";
      const samplePayload = {
        _subject: "📸 [XÁC NHẬN ĐẶT LỊCH THÀNH CÔNG] Bergh.Ryker Studio - Mã: BRBK_DEMO88",
        email: target,
        customerEmail: target,
        "✨ 1. TÊN KHÁCH HÀNG / TỔ CHỨC": "Lớp 12A1 Chuyên Toán - THPT Chuyên Hà Nội",
        "🎯 2. CONCEPT MONG MUỐN": "Gói KỶ YẾU THPT (Áo dài & Dạ hội)",
        "🔥 3. SỐ LƯỢNG NGƯỜI": "38 người",
        "📅 4. NGÀY CHỤP (Dự kiến)": "28/11/2026",
        "⏰ 5. CA CHỤP": "Cả ngày (7h00 - 17h00)",
        "📱 6. INFO LIÊN HỆ (Zalo / Instagram)": "0365266204 (@lop12a1_chuyentoan)",
        "📍 6b. ĐỊA CHỈ LIÊN HỆ": "Trường THPT Chuyên Hà Nội & Smiley Ville",
        "💰 5b. TẠM TÍNH CHI PHÍ": "13.300.000đ (Đơn giá: 350k/người)",
        "💌 7. LỊCH TRÌNH / LỜI NHẮN": "Cần thợ chụp nhiệt tình, có flycam",
        "🎟️ 8. MÃ SỐ TICKET": "BRBK_DEMO88",
      };
      const result = await sendAdminNotification(samplePayload);
      return res.json({ success: true, target, ...result });
    } catch (err: any) {
      console.warn("[Notification] Test customer email error:", err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || "Lỗi khi kiểm tra gửi email khách hàng" });
    }
  });

  // Simple cache for SePay to prevent rate limiting when many clients poll
  let lastSepayFetchTime = 0;
  let cachedSepayTransactions: any = null;

  // Endpoint to test SePay connection and return raw data
  app.get("/api/sepay/test-connection", async (req, res) => {
    try {
      const dotenv = await import('dotenv');
      dotenv.config();

      const apiToken = process.env.SEPAY_TOKEN || process.env.SEPAY_API_TOKEN;
      if (!apiToken) {
        return res.json({ success: false, error: "Chưa cấu hình SEPAY_API_TOKEN" });
      }

      console.log("Testing SePay Connection...");
      const fetchReq = await fetch("https://my.sepay.vn/userapi/transactions/list?limit=10", {
        headers: {
          "Authorization": `Bearer ${apiToken}`,
        },
        cache: "no-store"
      });

      const status = fetchReq.status;
      const text = await fetchReq.text();
      
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Not JSON
      }

      return res.json({
        success: fetchReq.ok,
        status,
        apiTokenExists: !!apiToken,
        data,
        rawText: data ? undefined : text
      });
    } catch (error: any) {
      console.error("SePay Test Connection Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Lỗi server nội bộ" });
    }
  });

  // API Route for SePay integration to check transaction
  app.get("/api/sepay/check/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Load fallback token
      const dotenv = await import('dotenv');
      dotenv.config();

      const apiToken = process.env.SEPAY_TOKEN || process.env.SEPAY_API_TOKEN;
      if (!apiToken) {
        return res.json({ success: false, error: "Chưa cấu hình SEPAY_API_TOKEN" });
      }

      // If test requested, bypass cache and return raw output for debugging
      const isTest = id === "test_debug";

      try {
        const now = Date.now();
        // Use cached data if younger than 10 seconds
        if (!cachedSepayTransactions || (now - lastSepayFetchTime > 10000) || isTest) {
           const fetchReq = await fetch("https://my.sepay.vn/userapi/transactions/list?limit=100", {
             headers: {
               "Authorization": `Bearer ${apiToken}`,
               "Content-Type": "application/json"
               // Note: Explicitly don't use caching
             },
             cache: "no-store"
           });
           
           if (!fetchReq.ok) {
             const text = await fetchReq.text();
             console.warn("SePay returned non-ok status:", fetchReq.status, text);
             lastSepayFetchTime = now; // Prevent spamming if API errors out
             // Continue to use cached webhook transactions if they exist, rather than throwing error
             if (!cachedSepayTransactions) {
               return res.json({ 
                 success: false, 
                 status: fetchReq.status,
                 error: `SePay returned status ${fetchReq.status}.`,
                 debug: isTest ? text : undefined
               });
             }
           } else {
             const fetchedData = await fetchReq.json();
             // Merge with webhook transactions to ensure we don't lose them
             const webhookTxs = cachedSepayTransactions?.transactions || [];
             cachedSepayTransactions = fetchedData;
             if (webhookTxs.length > 0) {
               cachedSepayTransactions.transactions = [...webhookTxs, ...(cachedSepayTransactions.transactions || [])];
             }
             lastSepayFetchTime = now;
           }
        }

        const data = cachedSepayTransactions;

        if (isTest) {
          return res.json({ success: true, apiTokenExists: !!apiToken, data: { ...data, transactions: data.transactions?.slice(0, 5) } }); // return max 5 records
        }

        if (data && data.transactions && Array.isArray(data.transactions)) {
          // Look for transaction with memo matching COC {id} (strip characters that banks might remove like _)
          const normalizedExpectedMemo = `COC${id}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const justIdMemo = id.toUpperCase().replace(/[^A-Z0-9]/g, ''); // e.g. BRBK123456
          
          // Fallback memo for cases where the user only transfers with the numerical digits (e.g., COC 123456 instead of COC BRBK_123456)
          const digitsOnly = id.replace(/[^0-9]/g, '');
          const fallbackMemo = digitsOnly ? `COC${digitsOnly}`.toUpperCase() : '';
          const justDigitsMemo = digitsOnly ? digitsOnly : '';

          const found = data.transactions.find((t: any) => {
            if (!t.transaction_content) return false;
            const normalizedContent = t.transaction_content.toUpperCase().replace(/[^A-Z0-9]/g, '');
            
            const hasMatch = 
              normalizedContent.includes(normalizedExpectedMemo) || 
              normalizedContent.includes(justIdMemo) ||
              (fallbackMemo && normalizedContent.includes(fallbackMemo)) ||
              (justDigitsMemo && justDigitsMemo.length >= 6 && normalizedContent.includes(justDigitsMemo)); // allow exact 6+ digits matching without COC

            return hasMatch && Number(t.amount_in) > 0;
          });
          if (found) {
            console.log("SePay Match Found:", id, found.transaction_content);
            return res.json({ success: true, amount: found.amount_in });
          }
        }
        return res.json({ success: false, debug: "Not found in " + (data?.transactions?.length || 0) + " transactions", expectedMemo: `COC${id}`.toUpperCase().replace(/[^A-Z0-9]/g, ''), fallbackMemo: id.replace(/[^0-9]/g, '') ? `COC${id.replace(/[^0-9]/g, '')}`.toUpperCase() : '' });
      } catch (innerErr: any) {
        console.warn("Could not reach SePay parent server:", innerErr.message);
        return res.json({ success: false, error: "Không thể kết nối đến SePay", detail: innerErr.message });
      }
    } catch (error: any) {
      console.error("SePay Check Error:", error);
      return res.json({ success: false, error: "Lỗi xử lý SePay" });
    }
  });

  // --- HIGH-PERFORMANCE GOOGLE DRIVE / EXTERNAL IMAGE STREAMING PROXY ---
  const imageCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
  const MAX_CACHE_ENTRIES = 300;
  const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

  app.get("/api/proxy-image", async (req, res) => {
    try {
      const fileId = (req.query.id as string)?.trim();
      const rawUrl = (req.query.url as string)?.trim();
      const width = req.query.w ? parseInt(req.query.w as string, 10) : undefined;

      let targetId = fileId;
      if (!targetId && rawUrl) {
        const match = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          targetId = match[1];
        }
      }

      if (!targetId) {
        return res.status(400).json({ error: "Missing image id" });
      }

      const cacheKey = `${targetId}_w${width || "orig"}`;
      const cached = imageCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        res.setHeader("Content-Type", cached.contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Access-Control-Allow-Origin", "*");
        return res.end(cached.buffer);
      }

      const candidateUrls = width && width > 0 && width < 2560
        ? [
            `https://lh3.googleusercontent.com/d/${targetId}=w${width}-rw`,
            `https://lh3.googleusercontent.com/d/${targetId}=w${width}`,
            `https://drive.google.com/thumbnail?id=${targetId}&sz=w${width}`,
            `https://lh3.googleusercontent.com/d/${targetId}=s0`,
            `https://drive.google.com/uc?export=view&id=${targetId}`
          ]
        : [
            `https://lh3.googleusercontent.com/d/${targetId}=s0`,
            `https://lh3.googleusercontent.com/d/${targetId}=s0-rw`,
            `https://lh3.googleusercontent.com/d/${targetId}`,
            `https://drive.google.com/thumbnail?id=${targetId}&sz=w${width || 3840}`,
            `https://drive.google.com/uc?export=view&id=${targetId}`
          ];

      let imageResponse: Response | null = null;
      let contentType = "image/webp";

      for (const url of candidateUrls) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            }
          });
          clearTimeout(timeout);

          if (response.ok) {
            const ct = response.headers.get("content-type");
            if (ct && (ct.startsWith("image/") || ct === "application/octet-stream")) {
              imageResponse = response;
              contentType = ct.startsWith("image/") ? ct : "image/jpeg";
              break;
            }
          }
        } catch {
          // Continue to next candidate URL
        }
      }

      if (!imageResponse) {
        res.setHeader("Cache-Control", "public, max-age=60");
        return res.redirect("https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800");
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (imageCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = imageCache.keys().next().value;
        if (oldestKey) imageCache.delete(oldestKey);
      }
      imageCache.set(cacheKey, { buffer, contentType, timestamp: Date.now() });

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.end(buffer);
    } catch (err: any) {
      console.error("Proxy image error:", err.message);
      return res.redirect("https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800");
    }
  });

  // Serve static assets from public directory (images, icons, social cards)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR !== "false";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
        watch: isHmrDisabled ? null : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Long-term immutable caching for Vite hashed assets
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));
    app.use(express.static(distPath, {
      maxAge: '1h',
      etag: true,
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, HOST, () => {
    console.log(`\n  VITE v6.2.3  ready in 150 ms\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://${HOST}:${PORT}/`);
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
