import type { Booking } from "../types";

export interface BookedInterval {
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  label: string;
  reason?: string;
  bookingId?: string;
  concept?: string;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  const h = parseInt(parts[0] || "0", 10);
  const m = parseInt(parts[1] || "0", 10);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 30-minute time options from 06:00 to 23:30
export const ALL_TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) {
  ALL_TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 23 || h === 23) {
    ALL_TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
  }
}

/**
 * Extracts start and end minutes from various time slot strings
 * Examples:
 * - "Từ 17:00 đến 22:00" -> 17:00 to 22:00
 * - "18:00 - 22:00" -> 18:00 to 22:00
 * - "Nửa ngày sáng (7h00 - 11h00)" -> 07:00 to 11:30
 * - "Nửa ngày chiều (13h00 - 17h00)" -> 13:00 to 17:30
 * - "Cả ngày (7h00 - 17h00)" -> 07:00 to 17:30
 * - "14:00" -> 14:00 to 18:00
 */
export function parseSlotStringToInterval(
  slotStr: string,
  conceptType?: string,
  startTimeProp?: string,
  endTimeProp?: string
): { start: number; end: number; label: string } | null {
  if (startTimeProp && endTimeProp) {
    const s = timeToMinutes(startTimeProp);
    const e = timeToMinutes(endTimeProp);
    if (e > s) {
      return { start: s, end: e, label: `${startTimeProp} - ${endTimeProp}` };
    }
  }

  const sLower = (slotStr || "").toLowerCase().trim();
  if (!sLower) return null;

  // Full day
  if (sLower.includes("cả ngày")) {
    return {
      start: 7 * 60, // 07:00
      end: 18 * 60,  // 18:00
      label: "Cả ngày (07:00 - 18:00)",
    };
  }

  // Morning shift
  if (sLower.includes("sáng") || sLower.includes("morning")) {
    return {
      start: 7 * 60,   // 07:00
      end: 11 * 60 + 30, // 11:30
      label: "Ca sáng (07:00 - 11:30)",
    };
  }

  // Afternoon shift
  if (sLower.includes("chiều") || sLower.includes("afternoon")) {
    return {
      start: 13 * 60, // 13:00
      end: 17 * 60 + 30, // 17:30
      label: "Ca chiều (13:00 - 17:30)",
    };
  }

  // Regex patterns: "17:00 - 22:00", "17h00 - 22h00", "Từ 17:00 đến 22:00", "18h-22h"
  const rangeMatch = sLower.match(
    /(?:từ\s*)?(\d{1,2})(?:[h:](\d{2}))?\s*(?:đến|-)\s*(\d{1,2})(?:[h:](\d{2}))?/
  );
  if (rangeMatch) {
    const startH = parseInt(rangeMatch[1], 10);
    const startM = parseInt(rangeMatch[2] || "0", 10);
    const endH = parseInt(rangeMatch[3], 10);
    const endM = parseInt(rangeMatch[4] || "0", 10);

    const s = startH * 60 + startM;
    const e = endH * 60 + endM;
    if (e > s) {
      return {
        start: s,
        end: e,
        label: `${minutesToTime(s)} - ${minutesToTime(e)}`,
      };
    }
  }

  // FAP slots mapping if matching Slot 1 - 7
  if (sLower.includes("slot 1")) return { start: 7 * 60 + 15, end: 9 * 60 + 15, label: "07:15 - 09:15" };
  if (sLower.includes("slot 2")) return { start: 9 * 60 + 25, end: 11 * 60 + 25, label: "09:25 - 11:25" };
  if (sLower.includes("slot 3")) return { start: 12 * 60, end: 14 * 60, label: "12:00 - 14:00" };
  if (sLower.includes("slot 4")) return { start: 14 * 60 + 10, end: 16 * 60 + 10, label: "14:10 - 16:10" };
  if (sLower.includes("slot 5")) return { start: 16 * 60 + 20, end: 18 * 60 + 20, label: "16:20 - 18:20" };
  if (sLower.includes("slot 6")) return { start: 18 * 60 + 30, end: 20 * 60 + 30, label: "18:30 - 20:30" };
  if (sLower.includes("slot 7")) return { start: 20 * 60 + 30, end: 22 * 60 + 30, label: "20:30 - 22:30" };

  // Single time (e.g. "18:00") -> default 4 hours duration
  const singleMatch = sLower.match(/(\d{1,2})[h:](\d{2})?/);
  if (singleMatch) {
    const sH = parseInt(singleMatch[1], 10);
    const sM = parseInt(singleMatch[2] || "0", 10);
    const s = sH * 60 + sM;
    const e = Math.min(23 * 60 + 30, s + 4 * 60);
    return {
      start: s,
      end: e,
      label: `${minutesToTime(s)} - ${minutesToTime(e)}`,
    };
  }

  return null;
}

/**
 * Gathers all booked intervals for a specific date from both bookings and availableDates
 */
export function getBookedIntervalsForDate(
  dateStr: string,
  bookings: Booking[],
  availableDates: Record<string, any>
): BookedInterval[] {
  if (!dateStr) return [];
  const intervals: BookedInterval[] = [];

  // 1. From bookings collection
  const activeBookingsOnDate = bookings.filter(
    (b) => b.date === dateStr && b.status !== "Từ chối"
  );

  for (const b of activeBookingsOnDate) {
    const parsed = parseSlotStringToInterval(
      b.timeSlot || "",
      b.conceptType,
      b.eventStartTime,
      b.eventEndTime
    );

    if (parsed) {
      intervals.push({
        startMinutes: parsed.start,
        endMinutes: parsed.end,
        startTime: minutesToTime(parsed.start),
        endTime: minutesToTime(parsed.end),
        label: parsed.label,
        reason: `${b.schoolName || "Đơn đặt"} (${b.conceptType || "Sự kiện"})`,
        bookingId: b.id,
        concept: b.conceptType,
      });
    }
  }

  // 2. From availableDates collection
  const dateConfig = availableDates[dateStr];
  if (dateConfig) {
    // If date is fully locked/booked and no specific blockedSlots given
    if (
      (dateConfig.status === "booked" || dateConfig.status === "unavailable") &&
      (!dateConfig.blockedSlots || dateConfig.blockedSlots.length === 0)
    ) {
      intervals.push({
        startMinutes: 6 * 60,  // 06:00
        endMinutes: 23 * 60 + 30, // 23:30
        startTime: "06:00",
        endTime: "23:30",
        label: "Cả ngày kín lịch",
        reason: dateConfig.reason || "Studio đã khoá lịch cả ngày",
      });
    } else if (Array.isArray(dateConfig.blockedSlots)) {
      for (const slotItem of dateConfig.blockedSlots) {
        const parsed = parseSlotStringToInterval(slotItem);
        if (parsed) {
          intervals.push({
            startMinutes: parsed.start,
            endMinutes: parsed.end,
            startTime: minutesToTime(parsed.start),
            endTime: minutesToTime(parsed.end),
            label: parsed.label,
            reason: dateConfig.reason || "Lịch bận cố định",
          });
        }
      }
    }
  }

  // Sort intervals by startMinutes
  intervals.sort((a, b) => a.startMinutes - b.startMinutes);

  // Merge identical or overlapping booked intervals for cleaner display
  const merged: BookedInterval[] = [];
  for (const intv of intervals) {
    if (merged.length === 0) {
      merged.push({ ...intv });
    } else {
      const prev = merged[merged.length - 1];
      if (intv.startMinutes <= prev.endMinutes) {
        // Overlap -> extend
        prev.endMinutes = Math.max(prev.endMinutes, intv.endMinutes);
        prev.endTime = minutesToTime(prev.endMinutes);
        prev.label = `${prev.startTime} - ${prev.endTime}`;
        if (intv.reason && !prev.reason?.includes(intv.reason)) {
          prev.reason = `${prev.reason || "Đã kín lịch"}, ${intv.reason}`;
        }
      } else {
        merged.push({ ...intv });
      }
    }
  }

  return merged;
}

/**
 * Checks if a specific minute is inside any booked interval
 */
export function isMinuteBooked(minute: number, bookedIntervals: BookedInterval[]): boolean {
  return bookedIntervals.some(
    (intv) => minute >= intv.startMinutes && minute < intv.endMinutes
  );
}

/**
 * Checks if a proposed range [startMins, endMins] overlaps any booked interval
 */
export function isRangeOverlapping(
  startMins: number,
  endMins: number,
  bookedIntervals: BookedInterval[]
): BookedInterval | null {
  for (const intv of bookedIntervals) {
    // Overlap condition: start < intv.end AND end > intv.start
    if (startMins < intv.endMinutes && endMins > intv.startMinutes) {
      return intv;
    }
  }
  return null;
}
