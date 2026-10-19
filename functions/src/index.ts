import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

// Initialize admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Actual logic to handle new chatbot bookings.
 */
export const handleNewChatbotBooking = async (event: any) => {
  const snapshot = event.data;
  if (!snapshot) {
    return;
  }

  const data = snapshot.data();
  
  // Only process bookings that came from the chatbot
  if (data.source !== "chatbot") {
    return;
  }

  logger.info(`New chatbot booking received: ${event.params.bookingId} (${data.schoolName || "N/A"}).`);
};

/**
 * Trigger on new chatbot booking document creation
 */
export const notifyAdminOnNewChatbotBooking = onDocumentCreated(
  "bookings/{bookingId}",
  handleNewChatbotBooking
);

/**
 * Parses a date string into a timestamp.
 * Supports Vietnamese DD/MM/YYYY format, ISO/SQL format (YYYY-MM-DD), and standard Date parsing.
 */
function parseBookingDate(dateStr: string): number {
  if (!dateStr) return 0;
  
  const trimmed = dateStr.trim();
  
  // Try parsing direct ISO / standard format
  if (trimmed.includes("T") || (trimmed.includes("-") && trimmed.split("-")[0].length === 4)) {
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return parsed;
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
function getRetentionCutoffDate(): number {
  const retentionDays = 90;
  return Date.now() - retentionDays * 24 * 60 * 60 * 1000;
}

/**
 * Cleanup expired bookings that are older than 90 days.
 */
async function cleanupExpiredBookings(): Promise<{
  scanned: number;
  deleted: number;
  errors: number;
  bypass: number;
}> {
  const db = admin.firestore();
  const cutoffTimestamp = getRetentionCutoffDate();
  const formatCutoffDate = new Date(cutoffTimestamp).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  logger.info(`Starting scheduled cleanup. Booking cutoff date is: ${formatCutoffDate}`);

  let scanned = 0;
  let deleted = 0;
  let errors = 0;
  let bypass = 0;

  const bookingsRef = db.collection("bookings");
  const snapshot = await bookingsRef.get();

  scanned = snapshot.size;
  logger.info(`Found ${scanned} total bookings to evaluate.`);

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
          logger.info(`Booking ${doc.id} has associated Google Calendar Event: ${data.googleCalendarEventId}`);
        }
        if (data.googleTaskId) {
          logger.info(`Booking ${doc.id} has associated Google Task: ${data.googleTaskId}`);
        }

        // Add delete operation to batch
        batch.delete(doc.ref);
        deleted++;
        batchCount++;

        // Commit batch when it reaches the 500 limit
        if (batchCount === 550 || batchCount === 500) {
          await batch.commit();
          logger.info(`Successfully committed batch of 500 bookings deletion.`);
          batch = db.batch();
          batchCount = 0;
        }
      } catch (err) {
        logger.error(`Failed to stage deletion for booking document ${doc.id}:`, err);
        errors++;
      }
    } else {
      bypass++;
    }
  }

  // Commit any remaining deletes in the final batch
  if (batchCount > 0) {
    try {
      await batch.commit();
      logger.info(`Committed final batch of ${batchCount} deletions.`);
    } catch (err) {
      logger.error(`Failed to commit final batch:`, err);
      errors += batchCount;
      deleted -= batchCount;
    }
  }

  logger.info("Cleanup completed.", { scanned, deleted, errors, bypass });
  return { scanned, deleted, errors, bypass };
}

/**
 * Scheduled Cloud Function to cleanup old bookings daily at 02:00 AM (Hanoi Timezone)
 */
export const scheduledBookingCleanup = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Asia/Ho_Chi_Minh",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async (event: any) => {
    logger.info(`Scheduled booking cleanup triggered by schedule event.`);
    try {
      const summary = await cleanupExpiredBookings();
      logger.info("Scheduled booking cleanup summary results:", summary);
    } catch (error) {
      logger.error("Fatal error occurred in scheduledBookingCleanup:", error);
    }
  }
);

/**
 * Scheduled Cloud Function to verify external deletions and orphan bookings
 */
export const scheduledOrphanCleanup = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "Asia/Ho_Chi_Minh",
    memory: "256MiB",
    timeoutSeconds: 300,
  },
  async (event: any) => {
    logger.info("Scheduled orphan cleanup triggered.");
    const db = admin.firestore();
    
    try {
        const configDoc = await db.collection("configs").doc("googleToken").get();
        if (!configDoc.exists) {
          logger.warn("No Google Token configured. Skipping orphan sync.");
          return;
        }
        const token = configDoc.data()?.accessToken;
        if (!token) return;

        logger.info("Found token, checking bookings...");
        const bookingsSnap = await db.collection("bookings").where("status", "==", "Đã duyệt").get();
        let changedCount = 0;

        for (const doc of bookingsSnap.docs) {
          const b = doc.data();
          let isRemovedExternally = false;
          
          if (!b.googleTaskId && !b.googleEventId) continue;

          if (b.googleTaskId) {
            try {
              const tRes = await fetch(`https://www.googleapis.com/tasks/v1/lists/@default/tasks/${b.googleTaskId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (tRes.status === 404) {
                isRemovedExternally = true;
              } else if (tRes.ok) {
                const tData = await tRes.json();
                if (tData.deleted) {
                  isRemovedExternally = true;
                }
              }
            } catch (e) {}
          }

          if (!isRemovedExternally && b.googleEventId) {
            try {
              const eRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${b.googleEventId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (eRes.status === 404) {
                isRemovedExternally = true;
              } else if (eRes.ok) {
                const eData = await eRes.json();
                if (eData.status === "cancelled") {
                  isRemovedExternally = true;
                }
              }
            } catch (e) {}
          }

          if (isRemovedExternally) {
            logger.info(`Deleting orphaned booking ${doc.id} externally deleted.`);
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
        
        logger.info(`Orphan cleanup finished. Removed ${changedCount} orphaned bookings.`);
    } catch(e) {
        logger.error("Orphan Cleanup error", e);
    }
  }
);
