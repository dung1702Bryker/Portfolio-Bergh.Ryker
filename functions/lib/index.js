"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEmailAttempts = exports.scheduledOrphanCleanup = exports.notifyAdminOnNewChatbotBooking = exports.onBookingStatusUpdated = exports.onBookingCreated = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const firebase_functions_1 = require("firebase-functions");
const nodemailer = __importStar(require("nodemailer"));
// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
    admin.initializeApp();
}
/**
 * HTML Entity Escape to prevent XSS / HTML injection in emails
 */
function escapeHtml(str) {
    if (!str)
        return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
/**
 * Helper to retrieve email credentials from Firestore or process.env
 */
async function getEmailConfig() {
    const db = admin.firestore();
    let config = {
        targetEmail: process.env.ADMIN_EMAIL || "nguyenducdung1702@gmail.com",
        user: process.env.SMTP_USER || process.env.GMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD,
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        sendgridApiKey: process.env.SENDGRID_API_KEY,
    };
    try {
        const configSnap = await db.collection("configs").doc("email").get();
        if (configSnap.exists) {
            const data = configSnap.data();
            if (data.targetEmail)
                config.targetEmail = data.targetEmail;
            if (data.user)
                config.user = data.user;
            if (data.pass)
                config.pass = String(data.pass).trim().replace(/\s+/g, "");
            if (data.host)
                config.host = data.host;
            if (data.port)
                config.port = data.port;
            if (data.sendgridApiKey)
                config.sendgridApiKey = data.sendgridApiKey;
        }
    }
    catch (err) {
        firebase_functions_1.logger.warn("[Email Config] Error fetching configs/email:", err?.message || err);
    }
    return config;
}
/**
 * Generates high-fidelity HTML for customer confirmation email according to specifications:
 * - Brand: Bergh.Ryker Studio
 * - Title: [Bergh.Ryker Studio] Xác nhận đặt lịch chụp thành công – [Mã lịch]
 * - Customer greeting, booking code, concept, date, time, location
 * - Payment status (cọc đã nhận hoặc chưa cọc khi admin duyệt)
 * - Support contact & link
 * - Timezone: Asia/Ho_Chi_Minh
 */
function generateCustomerEmailHtml(data) {
    const safeClientName = escapeHtml(data.clientName);
    const safeConcept = escapeHtml(data.concept);
    const safeBookingId = escapeHtml(data.bookingId);
    const safeDateStr = escapeHtml(data.dateStr);
    const safeTimeSlot = escapeHtml(data.timeSlot);
    const safeCost = escapeHtml(data.cost || "Theo bảng giá hệ thống");
    const safeAddress = escapeHtml(data.address || "Studio / Địa điểm thỏa thuận");
    const safeNotes = escapeHtml(data.notes || "Không có");
    const paymentStatusBadge = data.hasConfirmedPayment
        ? `<span style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 12px;">ĐÃ THANH TOÁN CỌC</span>`
        : `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 12px;">CHƯA THANH TOÁN CỌC (ĐÃ ĐƯỢC ADMIN DUYỆT GIỮ CHỖ)</span>`;
    const depositDetailsHtml = data.hasConfirmedPayment
        ? `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600;">💵 Số tiền cọc đã nhận</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #34d399; font-size: 13px; font-weight: 700;">${Number(data.amountPaid || 400000).toLocaleString("vi-VN")} VNĐ</td>
      </tr>
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600;">⚖️ Số tiền còn lại (dự kiến)</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #f4f4f5; font-size: 13px;">Thanh toán vào ngày chụp</td>
      </tr>
    `
        : `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600;">💵 Mức cọc yêu cầu</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #fbbf24; font-size: 13px; font-weight: 600;">400.000 VNĐ (hoặc thanh toán theo thỏa thuận trực tiếp với Studio)</td>
      </tr>
    `;
    return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #09090b; color: #e4e4e7; border-radius: 16px; overflow: hidden; border: 1px solid #27272a;">
      <div style="background: linear-gradient(135deg, #18181b, #09090b); padding: 28px 32px; border-bottom: 1px solid #27272a; text-align: center;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #B5945B; font-weight: 700; display: block; margin-bottom: 8px;">Bergh.Ryker Photography Studio</span>
        <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">XÁC NHẬN ĐẶT LỊCH CHỤP THÀNH CÔNG</h1>
        <div style="display: inline-block; margin-top: 12px; background: rgba(181, 148, 91, 0.15); border: 1px solid #B5945B; padding: 6px 14px; border-radius: 999px;">
          <span style="color: #d4af37; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">LỊCH CHỤP ĐÃ ĐƯỢC XÁC NHẬN VÀ GIỮ CHỖ CHÍNH THỨC</span>
        </div>
      </div>
      <div style="padding: 28px 32px;">
        <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #d4d4d8;">
          Xin chào <strong>${safeClientName}</strong>,<br>
          Đơn đặt lịch chụp ảnh của bạn tại <strong>Bergh.Ryker Photography Studio</strong> đã được xác nhận thành công trên hệ thống. Dưới đây là thông tin chi tiết về lịch chụp của bạn:
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #121215; border-radius: 12px; overflow: hidden; border: 1px solid #27272a;">
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600; width: 38%;">🎟️ Mã đặt lịch</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #d4af37; font-size: 14px; font-weight: 800; font-family: monospace;">${safeBookingId}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600;">🎯 Gói / Loại hình chụp</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #f4f4f5; font-size: 13px; font-weight: 600;">${safeConcept}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600;">📅 Ngày chụp (Dự kiến)</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #f4f4f5; font-size: 13px; font-weight: 700;">${safeDateStr}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600;">⏰ Ca / Giờ chụp</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #f4f4f5; font-size: 13px;">${safeTimeSlot} (Giờ Hà Nội - GMT+7)</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600;">📍 Địa điểm chụp</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #f4f4f5; font-size: 13px;">${safeAddress}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600;">💳 Trạng thái thanh toán</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #f4f4f5; font-size: 13px;">${paymentStatusBadge}</td>
          </tr>
          ${depositDetailsHtml}
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #a1a1aa; font-size: 13px; font-weight: 600;">💰 Chi phí tạm tính</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #1f1f23; color: #d4af37; font-size: 13px; font-weight: 700;">${safeCost}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #a1a1aa; font-size: 13px; font-weight: 600;">💌 Ghi chú / Lời dặn</td>
            <td style="padding: 12px 16px; color: #d4d4d8; font-size: 13px;">${safeNotes}</td>
          </tr>
        </table>
        <div style="background: rgba(181, 148, 91, 0.08); border: 1px solid rgba(181, 148, 91, 0.25); border-radius: 12px; padding: 16px 20px; font-size: 13px; color: #d4d4d8; line-height: 1.6; margin-bottom: 16px;">
          📞 <strong>Hỗ trợ & Tra cứu:</strong> Nếu cần thay đổi thời gian hoặc cần hỗ trợ thêm, vui lòng liên hệ Hotline/Zalo: <strong style="color: #ffffff;">0365.266.204</strong> (Kèm mã đặt lịch: <strong>${safeBookingId}</strong>).<br>
          🔗 <strong>Xem chi tiết lịch trực tuyến:</strong> <a href="https://bergh-ryker.ai.studio/#S9" style="color: #d4af37; text-decoration: underline;">https://bergh-ryker.ai.studio/#S9</a>
        </div>
      </div>
      <div style="background: #121214; padding: 18px 32px; text-align: center; border-top: 1px solid #27272a; font-size: 12px; color: #71717a;">
        Bergh.Ryker Photography Studio • Hà Nội • Hotline & Zalo: <strong style="color: #ffffff;">0365.266.204</strong><br>
        Website: <a href="https://bergh-ryker.ai.studio/" style="color: #B5945B; text-decoration: none;">https://bergh-ryker.ai.studio/</a>
      </div>
    </div>
  `;
}
/**
 * Generates plain text version of customer confirmation email
 */
function generateCustomerEmailPlain(data) {
    const paymentStatus = data.hasConfirmedPayment
        ? `Đã thanh toán cọc thành công (Đã nhận: ${Number(data.amountPaid || 400000).toLocaleString("vi-VN")} VNĐ)`
        : `Chưa thanh toán cọc (Lịch chụp đã được Admin duyệt & xác nhận giữ chỗ)`;
    return `[Bergh.Ryker Studio] Xác nhận đặt lịch chụp thành công – ${data.bookingId}

Xin chào ${data.clientName},

Đơn đặt lịch chụp ảnh của bạn tại Bergh.Ryker Photography Studio đã được xác nhận thành công!

THÔNG TIN LỊCH CHỤP:
- Mã đặt lịch: ${data.bookingId}
- Gói / Loại hình chụp: ${data.concept}
- Ngày chụp: ${data.dateStr}
- Ca / Giờ chụp: ${data.timeSlot} (Giờ Hà Nội - GMT+7)
- Địa điểm: ${data.address || "Studio / Địa điểm thỏa thuận"}
- Trạng thái thanh toán: ${paymentStatus}
- Chi phí tạm tính: ${data.cost || "Theo bảng giá hệ thống"}
- Ghi chú: ${data.notes || "Không có"}

THÔNG TIN HỖ TRỢ:
Hotline & Zalo: 0365.266.204
Tra cứu & Xem lịch trực tuyến: https://bergh-ryker.ai.studio/#S9
Website: https://bergh-ryker.ai.studio/

Trân trọng,
Bergh.Ryker Photography Studio`;
}
/**
 * Universal dispatcher that sends email via SMTP and SendGrid, and records audit logs to email_logs
 */
async function dispatchEmail(options) {
    const config = await getEmailConfig();
    let delivered = false;
    let deliveryChannel = "";
    let providerMessageId = "";
    let lastError = "";
    firebase_functions_1.logger.info(`[Email Dispatch] Starting dispatch to ${options.recipientType} (${options.to}) for booking ${options.bookingId || "N/A"}`);
    // 1. Primary: Direct SMTP / Gmail App Password
    if (config.user && config.pass) {
        try {
            const cleanPass = String(config.pass).trim().replace(/\s+/g, "");
            const transporter = nodemailer.createTransport(config.host
                ? {
                    host: config.host,
                    port: parseInt(String(config.port || "587"), 10),
                    secure: process.env.SMTP_SECURE === "true",
                    auth: { user: config.user, pass: cleanPass },
                }
                : {
                    service: "gmail",
                    auth: { user: config.user, pass: cleanPass },
                });
            const info = await transporter.sendMail({
                from: `"Bergh.Ryker Studio" <${config.user}>`,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            });
            delivered = true;
            deliveryChannel = "smtp_gmail";
            providerMessageId = info.messageId || "";
            firebase_functions_1.logger.info(`[Email Dispatch] Successfully sent ${options.recipientType} email via SMTP to ${options.to}. MsgID: ${providerMessageId}`);
        }
        catch (smtpErr) {
            lastError = smtpErr?.message || String(smtpErr);
            firebase_functions_1.logger.error(`[Email Dispatch] SMTP dispatch failed for ${options.to}:`, lastError);
        }
    }
    else {
        lastError = `SMTP credentials not fully configured (user: ${Boolean(config.user)}, pass: ${Boolean(config.pass)})`;
        firebase_functions_1.logger.warn(`[Email Dispatch] ${lastError}`);
    }
    // 2. Secondary: SendGrid REST API (if sendgridApiKey is provided)
    if (!delivered && config.sendgridApiKey) {
        try {
            const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${config.sendgridApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    personalizations: [{ to: [{ email: options.to }] }],
                    from: { email: config.user || "no-reply@berghryker.vn", name: "Bergh.Ryker Studio" },
                    subject: options.subject,
                    content: [
                        { type: "text/plain", value: options.text },
                        { type: "text/html", value: options.html },
                    ],
                }),
            });
            if (sgRes.ok || sgRes.status === 202) {
                delivered = true;
                deliveryChannel = "sendgrid_api";
                providerMessageId = sgRes.headers.get("x-message-id") || "";
                firebase_functions_1.logger.info(`[Email Dispatch] Successfully sent ${options.recipientType} email via SendGrid to ${options.to}`);
            }
            else {
                const sgErrText = await sgRes.text();
                lastError = `SendGrid status ${sgRes.status}: ${sgErrText}`;
                firebase_functions_1.logger.error(`[Email Dispatch] SendGrid failed for ${options.to}:`, lastError);
            }
        }
        catch (sgEx) {
            lastError = sgEx?.message || String(sgEx);
            firebase_functions_1.logger.error(`[Email Dispatch] SendGrid exception for ${options.to}:`, lastError);
        }
    }
    // 3. Fallback queue in Firestore "mail" collection (Firebase Extension trigger)
    if (!delivered) {
        try {
            const db = admin.firestore();
            await db.collection("mail").add({
                to: options.to,
                message: {
                    subject: options.subject,
                    text: options.text,
                    html: options.html,
                },
                bookingRef: options.bookingId || null,
                recipientType: options.recipientType,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            firebase_functions_1.logger.info(`[Email Dispatch] Enqueued email to "mail" collection for ${options.to}`);
        }
        catch (extErr) {
            firebase_functions_1.logger.warn(`[Email Dispatch] Could not enqueue to mail collection:`, extErr?.message || extErr);
        }
    }
    // 4. Record attempt to email_logs collection for auditing & diagnostics
    try {
        const db = admin.firestore();
        const logId = "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        await db.collection("email_logs").doc(logId).set({
            id: logId,
            to: options.to,
            recipientType: options.recipientType,
            bookingId: options.bookingId || null,
            subject: options.subject,
            status: delivered ? "success" : "failed",
            channel: deliveryChannel || "none",
            providerMessageId: providerMessageId || null,
            error: delivered ? null : (lastError || "Failed to dispatch email"),
            triggerReason: options.triggerReason || null,
            timestamp: new Date().toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        firebase_functions_1.logger.info(`[Email Dispatch] Recorded dispatch attempt to email_logs (${delivered ? "success" : "failed"}) for ${options.to}`);
    }
    catch (logErr) {
        firebase_functions_1.logger.warn(`[Email Dispatch] Could not write to email_logs:`, logErr?.message || logErr);
    }
    return {
        success: delivered,
        channel: deliveryChannel || undefined,
        messageId: providerMessageId || undefined,
        error: delivered ? undefined : lastError || "Failed to dispatch email",
    };
}
/**
 * TRIGGER 1: onDocumentCreated("bookings/{bookingId}")
 * Triggers when a new booking request is created.
 * NOTE: As per specifications, customer confirmation email is NOT sent at this stage (booking is still pending).
 * Only sends new booking alert to Studio Admin.
 */
exports.onBookingCreated = (0, firestore_1.onDocumentCreated)("bookings/{bookingId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        firebase_functions_1.logger.warn("[onBookingCreated] No document snapshot provided.");
        return;
    }
    const bookingId = event.params.bookingId;
    const data = snapshot.data();
    firebase_functions_1.logger.info(`[onBookingCreated] New booking created: ${bookingId}`, {
        schoolName: data.schoolName,
        date: data.date,
        source: data.source || "website",
        email: data.email || data.customerEmail,
    });
    const clientName = data.schoolName || data.name || "Quý khách";
    const customerEmail = (data.email ||
        data.customerEmail ||
        data.clientEmail ||
        data.userEmail ||
        "").trim();
    const concept = data.conceptType || "Kỷ yếu / Sự kiện";
    const dateStr = data.date ? (data.date.includes("-") ? data.date.split("-").reverse().join("/") : data.date) : "Chưa chọn";
    const timeSlot = data.timeSlot || "Cả ngày";
    const cost = data.estimatedCost || data.totalCost || "";
    const address = data.address || "";
    const notes = data.notes || data.customRequest || "";
    const config = await getEmailConfig();
    const adminEmail = config.targetEmail || "nguyenducdung1702@gmail.com";
    // Dispatch alert notification ONLY to Studio Admin (Customer receives email ONLY when deposit confirmed OR admin approves)
    const adminSubject = `📸 Đơn Đặt Lịch Mới: ${clientName} - ${concept} (${dateStr})`;
    const adminPlain = `Hệ thống nhận được đơn đặt lịch mới!\n\nMã Booking: ${bookingId}\nKhách hàng / Trường: ${clientName}\nConcept: ${concept}\nNgày chụp: ${dateStr}\nCa chụp: ${timeSlot}\nSố lượng: ${data.classSize || "N/A"}\nEmail: ${customerEmail || "N/A"}\nLiên hệ: ${data.instagramOrZalo || data.phone || "N/A"}\nĐịa chỉ: ${address || "N/A"}\nGhi chú: ${notes || "N/A"}\nNguồn: ${data.source || "website"}\n\nLink quản trị: https://bergh-ryker.ai.studio/#S9`;
    const adminHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fff; padding: 24px; border-radius: 12px;">
        <h2 style="color: #B5945B; margin-top: 0;">📸 Đơn Đặt Lịch Mới Từ Hệ Thống</h2>
        <p><strong>Mã Ticket:</strong> ${bookingId}</p>
        <p><strong>Khách hàng / Trường:</strong> ${clientName}</p>
        <p><strong>Concept:</strong> ${concept}</p>
        <p><strong>Ngày chụp:</strong> ${dateStr} (${timeSlot})</p>
        <p><strong>Email khách:</strong> ${customerEmail || "Không có"}</p>
        <p><strong>Liên hệ (Zalo/IG):</strong> ${data.instagramOrZalo || data.phone || "Không có"}</p>
        <p><strong>Chi phí tạm tính:</strong> ${cost || "N/A"}</p>
        <p><strong>Ghi chú:</strong> ${notes || "Không có"}</p>
        <p><a href="https://bergh-ryker.ai.studio/#S9" style="display: inline-block; background: #B5945B; color: #000; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">Mở Trung Tâm Quản Trị</a></p>
      </div>
    `;
    await dispatchEmail({
        to: adminEmail,
        subject: adminSubject,
        text: adminPlain,
        html: adminHtml,
        bookingId,
        recipientType: "admin",
        triggerReason: "booking_created",
    });
});
/**
 * TRIGGER 2: onDocumentUpdated("bookings/{bookingId}")
 * Triggers when a booking satisfies EITHER:
 * 1. Khoản thanh toán cọc được xác minh thành công (hasConfirmedPayment === true).
 * 2. Admin duyệt lịch chụp thành công (status === "Đã duyệt" / "Chấp nhận").
 *
 * Implements strict idempotency: Each booking receives AT MOST 1 automatic confirmation email.
 */
exports.onBookingStatusUpdated = (0, firestore_1.onDocumentUpdated)("bookings/{bookingId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData) {
        return;
    }
    const bookingId = event.params.bookingId;
    const oldStatus = beforeData.status;
    const newStatus = afterData.status;
    // Check condition OR:
    // Cond 1: hasConfirmedPayment transitioned to true
    const isPaymentConfirmed = !beforeData.hasConfirmedPayment && Boolean(afterData.hasConfirmedPayment);
    // Cond 2: Admin approved booking
    const isAdminApproved = (newStatus === "Đã duyệt" || newStatus === "Chấp nhận") && (oldStatus !== "Đã duyệt" && oldStatus !== "Chấp nhận");
    if (!isPaymentConfirmed && !isAdminApproved) {
        return;
    }
    // IDEMPOTENCY CHECK: Do not send if already sent
    if (afterData.confirmationEmailSent === true || afterData.emailSent === true) {
        firebase_functions_1.logger.info(`[onBookingStatusUpdated] Booking ${bookingId} already has confirmationEmailSent: true. Skipping duplicate auto confirmation email.`);
        return;
    }
    const customerEmail = (afterData.email ||
        afterData.customerEmail ||
        afterData.clientEmail ||
        afterData.userEmail ||
        "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerEmail || !emailRegex.test(customerEmail)) {
        firebase_functions_1.logger.info(`[onBookingStatusUpdated] Booking ${bookingId} has no valid customer email (${customerEmail}). Skipping email.`);
        return;
    }
    const clientName = afterData.schoolName || afterData.name || "Quý khách";
    const concept = afterData.conceptType || "Kỷ yếu / Sự kiện";
    const dateStr = afterData.date ? (afterData.date.includes("-") ? afterData.date.split("-").reverse().join("/") : afterData.date) : "Chưa chọn";
    const timeSlot = afterData.timeSlot || "Cả ngày";
    const cost = afterData.estimatedCost || afterData.totalCost || "";
    const address = afterData.address || "";
    const notes = afterData.notes || "";
    const hasConfirmedPayment = Boolean(afterData.hasConfirmedPayment);
    const amountPaid = afterData.amountPaid || 0;
    const custSubject = `[Bergh.Ryker Studio] Xác nhận đặt lịch chụp thành công – ${bookingId}`;
    const custPlain = generateCustomerEmailPlain({
        bookingId,
        clientName,
        concept,
        dateStr,
        timeSlot,
        cost,
        address,
        notes,
        hasConfirmedPayment,
        amountPaid,
    });
    const custHtml = generateCustomerEmailHtml({
        bookingId,
        clientName,
        concept,
        dateStr,
        timeSlot,
        cost,
        address,
        notes,
        hasConfirmedPayment,
        amountPaid,
    });
    const triggerReason = isPaymentConfirmed ? "deposit_payment" : "admin_approval";
    firebase_functions_1.logger.info(`[onBookingStatusUpdated] Dispatching confirmation email for ${bookingId} to ${customerEmail} (Reason: ${triggerReason})`);
    const result = await dispatchEmail({
        to: customerEmail,
        subject: custSubject,
        text: custPlain,
        html: custHtml,
        bookingId,
        recipientType: "customer",
        triggerReason,
    });
    // Record confirmation email state in Firestore booking document
    try {
        const db = admin.firestore();
        if (result.success) {
            await db.collection("bookings").doc(bookingId).set({
                confirmationEmailSent: true,
                confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
                confirmationEmailChannel: result.channel || null,
                confirmationEmailMessageId: result.messageId || null,
                confirmationEmailStatus: "success",
                emailSent: true,
            }, { merge: true });
            firebase_functions_1.logger.info(`[onBookingStatusUpdated] Successfully marked confirmationEmailSent: true for booking ${bookingId}`);
        }
        else {
            await db.collection("bookings").doc(bookingId).set({
                confirmationEmailStatus: "failed",
                confirmationEmailError: result.error || "Unknown error",
                confirmationEmailAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            firebase_functions_1.logger.warn(`[onBookingStatusUpdated] Marked confirmationEmailStatus: failed for booking ${bookingId}`);
        }
    }
    catch (e) {
        firebase_functions_1.logger.warn(`[onBookingStatusUpdated] Could not record confirmation email status:`, e);
    }
});
// Backward-compatible alias for existing chatbot notification function
exports.notifyAdminOnNewChatbotBooking = exports.onBookingCreated;
/**
 * Scheduled Cloud Function to verify external deletions and orphan bookings
 */
exports.scheduledOrphanCleanup = (0, scheduler_1.onSchedule)({
    schedule: "0 2 * * *",
    timeZone: "Asia/Ho_Chi_Minh",
    memory: "256MiB",
    timeoutSeconds: 300,
}, async () => {
    const db = admin.firestore();
    try {
        const configDoc = await db.collection("configs").doc("googleToken").get();
        if (!configDoc.exists)
            return;
        const token = configDoc.data()?.accessToken;
        if (!token)
            return;
        const bookingsSnap = await db.collection("bookings").where("status", "==", "Đã duyệt").get();
        let changedCount = 0;
        for (const doc of bookingsSnap.docs) {
            const b = doc.data();
            let isRemovedExternally = false;
            if (!b.googleTaskId && !b.googleEventId)
                continue;
            if (b.googleTaskId) {
                try {
                    const tRes = await fetch(`https://www.googleapis.com/tasks/v1/lists/@default/tasks/${b.googleTaskId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (tRes.status === 404)
                        isRemovedExternally = true;
                }
                catch (e) { }
            }
            if (!isRemovedExternally && b.googleEventId) {
                try {
                    const eRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${b.googleEventId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (eRes.status === 404)
                        isRemovedExternally = true;
                }
                catch (e) { }
            }
            if (isRemovedExternally) {
                firebase_functions_1.logger.info(`Deleting orphaned booking ${doc.id}`);
                await doc.ref.delete();
                changedCount++;
                if (b.date) {
                    const otherSnap = await db.collection("bookings").where("date", "==", b.date).where("status", "!=", "Từ chối").get();
                    const others = otherSnap.docs.filter(d => d.id !== doc.id);
                    if (others.length === 0) {
                        await db.collection("availableDates").doc(b.date).set({ date: b.date, status: "available" }, { merge: true });
                    }
                }
            }
        }
        firebase_functions_1.logger.info(`Orphan cleanup finished. Removed ${changedCount} orphaned bookings.`);
    }
    catch (e) {
        firebase_functions_1.logger.error("Orphan Cleanup error", e);
    }
});
/**
 * Diagnostic Firebase Function: logEmailAttempts
 * Reads the email_logs Firestore collection and provides a diagnostic endpoint for the Admin panel
 * to view the last 10 failed email trigger attempts with their error messages.
 */
exports.logEmailAttempts = (0, https_1.onRequest)({
    cors: true,
}, async (req, res) => {
    try {
        const db = admin.firestore();
        const logsRef = db.collection("email_logs");
        // Attempt ordered query with limit 10
        let failedDocs = [];
        try {
            const failedQuery = logsRef
                .where("status", "==", "failed")
                .orderBy("createdAt", "desc")
                .limit(10);
            const snapshot = await failedQuery.get();
            failedDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        }
        catch (queryErr) {
            // Fallback for missing index or initial setup: fetch recent logs and filter in-memory
            firebase_functions_1.logger.warn("[logEmailAttempts] Query fallback without composite index:", queryErr?.message || queryErr);
            const recentSnap = await logsRef.limit(50).get();
            failedDocs = recentSnap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((d) => d.status === "failed")
                .sort((a, b) => {
                const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
                const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
                return timeB - timeA;
            })
                .slice(0, 10);
        }
        return res.json({
            success: true,
            count: failedDocs.length,
            failedAttempts: failedDocs,
            retrievedAt: new Date().toISOString(),
        });
    }
    catch (err) {
        firebase_functions_1.logger.error("[logEmailAttempts] Error reading email_logs:", err);
        return res.status(500).json({
            success: false,
            error: err?.message || "Failed to retrieve email logs",
        });
    }
});
//# sourceMappingURL=index.js.map