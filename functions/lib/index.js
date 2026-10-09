"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledOrphanCleanup = exports.scheduledBookingCleanup = exports.notifyAdminOnNewChatbotBooking = exports.handleNewChatbotBooking = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const firebase_functions_1 = require("firebase-functions");
// Initialize admin SDK if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}
/**
 * Actual logic to handle new chatbot bookings.
 */
const handleNewChatbotBooking = async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        return;
    }
    const data = snapshot.data();
    // Only process bookings that came from the chatbot
    if (data.source !== "chatbot") {
        firebase_functions_1.logger.info(`Booking ${event.params.bookingId} has source "${data.source}". Not a chatbot booking, skipping email.`);
        return;
    }
    const adminEmail = process.env.ADMIN_EMAIL || "berghryker2@gmail.com";
    firebase_functions_1.logger.info(`Processing new chatbot booking ${event.params.bookingId}. Scheduling email to ${adminEmail}...`);
    try {
        const db = admin.firestore();
        // format date to something readable
        const createdDate = data.createdAt
            ? (data.createdAt.toDate ? data.createdAt.toDate().toLocaleString("vi-VN") : data.createdAt.toString())
            : new Date().toLocaleString("vi-VN");
        const htmlBody = `
      <h2>Khách hàng mới đặt lịch qua Chatbot</h2>
      <p><strong>Mã Booking:</strong> ${event.params.bookingId}</p>
      <p><strong>Khách hàng / Tên trường:</strong> ${data.schoolName || 'N/A'}</p>
      <p><strong>Số lượng:</strong> ${data.classSize || 'N/A'}</p>
      <p><strong>Ngày chụp:</strong> ${data.date || 'N/A'}</p>
      <p><strong>Ca chụp:</strong> ${data.timeSlot || 'N/A'}</p>
      <p><strong>Gói / Concept:</strong> ${data.conceptType || 'N/A'}</p>
      <p><strong>Custom Request:</strong> ${data.customRequest || 'N/A'}</p>
      <p><strong>Liên hệ (IG/Zalo):</strong> ${data.instagramOrZalo || 'N/A'}</p>
      <p><strong>Số điện thoại:</strong> ${data.phone || 'N/A'}</p>
      <p><strong>Ghi chú:</strong> ${data.notes || 'N/A'}</p>
      <p><strong>Trạng thái:</strong> ${data.status || 'N/A'}</p>
      <p><strong>Nguồn:</strong> ${data.source}</p>
      <p><strong>Tạo lúc:</strong> ${createdDate}</p>
      <br />
      <p><a href="https://ais-pre-hfmviuhpqhhx673vbwoye2-841267057913.asia-east1.run.app/?admin=1&bookingId=${event.params.bookingId}" target="_blank">Mở booking trong Trung Tâm Quản Trị</a></p>
      <p>Link trực tiếp: https://ais-pre-hfmviuhpqhhx673vbwoye2-841267057913.asia-east1.run.app/?admin=1&bookingId=${event.params.bookingId}</p>
    `;
        const textBody = `
      Khách hàng mới đặt lịch qua Chatbot
      Mã Booking: ${event.params.bookingId}
      Khách hàng / Tên trường: ${data.schoolName || 'N/A'}
      Ngày chụp: ${data.date || 'N/A'}
      Liên hệ: ${data.instagramOrZalo || 'N/A'}
      
      Link mở trong hệ thống quản trị: https://ais-pre-hfmviuhpqhhx673vbwoye2-841267057913.asia-east1.run.app/?admin=1&bookingId=${event.params.bookingId}
    `;
        // Use the emailTasks collection for the "Trigger Email from Firestore" extension
        await db.collection("emailTasks").add({
            to: adminEmail,
            message: {
                subject: `[Chatbot] Booking mới: ${data.schoolName || 'Khách hàng'} - ${data.date || ''}`,
                text: textBody,
                html: htmlBody,
            },
            _bookingRef: event.params.bookingId // Reference ID for debugging
        });
        firebase_functions_1.logger.info(`Successfully scheduled email task for booking ${event.params.bookingId}`);
    }
    catch (error) {
        firebase_functions_1.logger.error(`Error scheduling email task for booking ${event.params.bookingId}:`, error);
        // Wait, we shouldn't throw error back since it stops here anyway, but just log it and the booking remains intact.
    }
};
exports.handleNewChatbotBooking = handleNewChatbotBooking;
/**
 * Trigger to send email notification for new chatbot bookings
 */
exports.notifyAdminOnNewChatbotBooking = (0, firestore_1.onDocumentCreated)("bookings/{bookingId}", exports.handleNewChatbotBooking);
/**
 * Parses a date string into a timestamp.
 * Supports Vietnamese DD/MM/YYYY format, ISO/SQL format (YYYY-MM-DD), and standard Date parsing.
 */
function parseBookingDate(dateStr) {
    if (!dateStr)
        return 0;
    const trimmed = dateStr.trim();
    // Try parsing direct ISO / standard format
    if (trimmed.includes("T") || (trimmed.includes("-") && trimmed.split("-")[0].length === 4)) {
        const parsed = Date.parse(trimmed);
        if (!isNaN(parsed))
            return parsed;
    }
    // Try parsing Vietnamese string DD/MM/YYYY
    const parts = trimmed.split("/");
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed in JS Date
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month, day).getTime();
        }
    }
    // Fallback to standard parsing
    const fallback = Date.parse(trimmed);
    return isNaN(fallback) ? 0 : fallback;
}
/**
 * Helper to get the 3-month retention threshold timestamp (90 days ago)
 */
function getRetentionCutoffDate() {
    const retentionDays = 90;
    return Date.now() - retentionDays * 24 * 60 * 60 * 1000;
}
/**
 * Cleanup expired bookings that are older than 90 days.
 */
async function cleanupExpiredBookings() {
    const db = admin.firestore();
    const cutoffTimestamp = getRetentionCutoffDate();
    const formatCutoffDate = new Date(cutoffTimestamp).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
    firebase_functions_1.logger.info(`Starting scheduled cleanup. Booking cutoff date is: ${formatCutoffDate}`);
    let scanned = 0;
    let deleted = 0;
    let errors = 0;
    let bypass = 0;
    const bookingsRef = db.collection("bookings");
    const snapshot = await bookingsRef.get();
    scanned = snapshot.size;
    firebase_functions_1.logger.info(`Found ${scanned} total bookings to evaluate.`);
    // Write batch to perform atomic deletions (up to 500 per batch)
    let batch = db.batch();
    let batchCount = 0;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        // Prefer shootDate / bookingDate field "date", fallback to "createdAt"
        const dateStr = data.date || data.createdAt;
        if (!dateStr) {
            bypass++;
            continue;
        }
        const bookingTimestamp = parseBookingDate(dateStr);
        // Check if the booking date falls older than 90 days (cutoff timestamp)
        if (bookingTimestamp > 0 && bookingTimestamp < cutoffTimestamp) {
            try {
                // Log calendar event or task reference IDs before deletion
                if (data.googleCalendarEventId) {
                    firebase_functions_1.logger.info(`Booking ${doc.id} has associated Google Calendar Event: ${data.googleCalendarEventId}`);
                }
                if (data.googleTaskId) {
                    firebase_functions_1.logger.info(`Booking ${doc.id} has associated Google Task: ${data.googleTaskId}`);
                }
                // Add delete operation to batch
                batch.delete(doc.ref);
                deleted++;
                batchCount++;
                // Commit batch when it reaches the 500 limit
                if (batchCount === 550 || batchCount === 500) {
                    await batch.commit();
                    firebase_functions_1.logger.info(`Successfully committed batch of 500 bookings deletion.`);
                    batch = db.batch();
                    batchCount = 0;
                }
            }
            catch (err) {
                firebase_functions_1.logger.error(`Failed to stage deletion for booking document ${doc.id}:`, err);
                errors++;
            }
        }
        else {
            bypass++;
        }
    }
    // Commit any remaining deletes in the final batch
    if (batchCount > 0) {
        try {
            await batch.commit();
            firebase_functions_1.logger.info(`Committed final batch of ${batchCount} deletions.`);
        }
        catch (err) {
            firebase_functions_1.logger.error(`Failed to commit final batch:`, err);
            errors += batchCount;
            deleted -= batchCount;
        }
    }
    firebase_functions_1.logger.info("Cleanup completed.", { scanned, deleted, errors, bypass });
    return { scanned, deleted, errors, bypass };
}
/**
 * Scheduled Cloud Function to cleanup old bookings daily at 02:00 AM (Hanoi Timezone)
 */
exports.scheduledBookingCleanup = (0, scheduler_1.onSchedule)({
    schedule: "0 2 * * *",
    timeZone: "Asia/Ho_Chi_Minh",
    memory: "256MiB",
    timeoutSeconds: 300,
}, async (event) => {
    firebase_functions_1.logger.info(`Scheduled booking cleanup triggered by schedule event.`);
    try {
        const summary = await cleanupExpiredBookings();
        firebase_functions_1.logger.info("Scheduled booking cleanup summary results:", summary);
    }
    catch (error) {
        firebase_functions_1.logger.error("Fatal error occurred in scheduledBookingCleanup:", error);
    }
});
/**
 * Scheduled Cloud Function to verify external deletions and orphan bookings
 */
exports.scheduledOrphanCleanup = (0, scheduler_1.onSchedule)({
    schedule: "0 2 * * *",
    timeZone: "Asia/Ho_Chi_Minh",
    memory: "256MiB",
    timeoutSeconds: 300,
}, async (event) => {
    firebase_functions_1.logger.info("Scheduled orphan cleanup triggered.");
    const db = admin.firestore();
    try {
        const configDoc = await db.collection("configs").doc("googleToken").get();
        if (!configDoc.exists) {
            firebase_functions_1.logger.warn("No Google Token configured. Skipping orphan sync.");
            return;
        }
        const token = configDoc.data()?.accessToken;
        if (!token)
            return;
        firebase_functions_1.logger.info("Found token, checking bookings...");
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
                    if (tRes.status === 404) {
                        isRemovedExternally = true;
                    }
                    else if (tRes.ok) {
                        const tData = await tRes.json();
                        if (tData.deleted) {
                            isRemovedExternally = true;
                        }
                    }
                }
                catch (e) { }
            }
            if (!isRemovedExternally && b.googleEventId) {
                try {
                    const eRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${b.googleEventId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (eRes.status === 404) {
                        isRemovedExternally = true;
                    }
                    else if (eRes.ok) {
                        const eData = await eRes.json();
                        if (eData.status === "cancelled") {
                            isRemovedExternally = true;
                        }
                    }
                }
                catch (e) { }
            }
            if (isRemovedExternally) {
                firebase_functions_1.logger.info(`Deleting orphaned booking ${doc.id} externally deleted.`);
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
//# sourceMappingURL=index.js.map