import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  writeBatch,
  getDocs,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { useToast } from "../../hooks/useToast";
import {
  Calendar as CalendarIcon,
  Save,
  Trash2,
  ShieldAlert,
  RefreshCw,
  ClipboardPaste,
} from "lucide-react";
import { ConfirmDialog } from "../ConfirmDialog";

const DEBUG_SYNC = true;

const debugLog = (label: string, payload?: unknown) => {
  if (!DEBUG_SYNC) return;
  console.log(`[SchoolScheduleSync] ${label}`, payload);
};

const debugWarn = (label: string, payload?: unknown) => {
  if (!DEBUG_SYNC) return;
  console.warn(`[SchoolScheduleSync] ${label}`, payload);
};

const debugError = (label: string, error: unknown, extra?: unknown) => {
  const normalized = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    : { raw: error };

  console.error(`[SchoolScheduleSync] ${label}`, normalized, extra);
};

const getReadableErrorMessage = (error: unknown) => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Lỗi không xác định';
  }
};

export interface DetailedSchedule {
  courseCode: string;
  subject: string;
  mode?: string;
  room?: string;
  teacher?: string;
  detailUrl?: string;
  meetingUrl?: string;
  note?: string;
  rawText?: string;
  source?: 'html-table' | 'html-mixed' | 'plain-text';
}

interface BlockedDate {
  id: string; // YYYY-MM-DD
  status: string;
  reason: string;
  blockedSlots?: string[];
  detailedSchedule?: Record<string, DetailedSchedule[]>;
}

export type SyncSource = 'manual-paste' | 'fap-direct' | 'fap-html-fallback' | 'fap-backend-session';

export interface FapIntegrationStatus {
  status: 'idle' | 'checking' | 'cors-blocked' | 'ready' | 'error';
  message?: string;
}

export interface SyncResult {
  success: boolean;
  totalEntries: number;
  newSlotsCount: number;
  removedSlotsCount: number;
  error?: string;
}

export const SchoolScheduleSync = () => {
  const { showToast } = useToast();
  const [inputText, setInputText] = useState("");
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [syncMode, setSyncMode] = useState<"merge" | "overwrite">("overwrite");
  const [affectedDates, setAffectedDates] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [debugState, setDebugState] = useState({
    parsedEntries: 0,
    blockedDates: 0,
    detailedCells: 0,
    lastSyncStatus: 'idle',
    lastErrorMessage: '',
    lastWriteDocPath: ''
  });

  const [activeTab, setActiveTab] = useState<"manual" | "fap">("manual");
  const [fapStatus, setFapStatus] = useState<FapIntegrationStatus>({ status: 'idle' });
  const fapWindowRef = React.useRef<Window | null>(null);
  const fapPayloadRef = React.useRef<{ html: string; plainText: string } | null>(null);

  // --- FapFallbackParser Tests ---
  useEffect(() => {
    if (!DEBUG_SYNC) return;

    const runParserTests = () => {
      debugLog("--- STARTING PARSER TESTS ---");

      // Test 1: HTML table chuẩn (Type B)
      const test1Html = `
      <table>
        <tr>
          <th></th>
          <th>Mon<br/>14/09</th>
          <th>Tue<br/>15/09</th>
        </tr>
        <tr>
          <td>Slot 3 (10:45-13:00)</td>
          <td></td>
          <td>
            <a href="ActivityDetail.aspx?id=123">[MC04302]</a><br/>
            (BSBTWK601.1 (Offline))<br/>
            at D211 - Hienct7<br/>
            <a href="https://www.google.com/url?q=https://meet.google.com/abc&sa=D">[Meet URL]</a>
          </td>
        </tr>
      </table>`;
      
      const res1 = parseFallbackPayload(test1Html, "").results;
      debugLog("Test 1: HTML Table", res1);
      if (res1.length > 0 && res1[0]) console.table(res1[0]?.detailedSchedule['10:45']);

      // Test 2: Plain text bị flatten (Type A)
      const test2Text = "Mon Tue Wed Thu Fri Sat Sun 14/09 15/09 16/09 17/09 18/09 19/09 20/09 Slot 3 (10:45-13:00) [MC04302] (BSBTWK601.1 (Offline)) at D211 - Hienct7 [Meet URL](https://meet.google.com/abc)";
      const res2 = parseFallbackPayload("", test2Text).results;
      debugLog("Test 2: Plain Text Flattened", res2);
      
      // Test 3: Mixed HTML/Plain Text with Redirects (Type C)
      const test3Mixed = "Slot 1 (07:15-09:30)\n\n[MC04303] (BSBMKG621.1 (Online))\nat \n\n[Meet URL](https://www.google.com/url?q=https://meet.google.com/xyz-123&sa=D)";
      const res3 = parseFallbackPayload("", test3Mixed).results;
      debugLog("Test 3: Mixed with Redirect", res3);

      // Test 4: Slot rỗng
      const test4Empty = "Slot 3 (10:45-13:00)\n\nSlot 4 (13:30-15:45)";
      const res4 = parseFallbackPayload("", test4Empty).results;
      debugLog("Test 4: Empty Slots", res4);
      
      debugLog("--- END PARSER TESTS ---");
    };

    runParserTests();
  }, []);
  // ------------------------------

  const openFapLogin = () => {
    try {
      fapWindowRef.current = window.open('https://fap.fpi.edu.vn/Default.aspx', 'fap_window', 'width=1000,height=800');
      setFapStatus({ status: 'checking', message: 'Vui lòng đăng nhập vào FAP. Hệ thống sẽ chờ bạn xác nhận.' });
    } catch (e) {
      setFapStatus({ status: 'error', message: 'Không thể mở popup trình duyệt. Vui lòng tắt trình chặn popup.' });
    }
  };

  const tryReadFapTimetable = () => {
    try {
      if (!fapWindowRef.current || fapWindowRef.current.closed) {
        setFapStatus({ status: 'error', message: 'Cửa sổ FAP chưa được mở hoặc đã bị đóng.' });
        return;
      }
      
      // Attempt to access cross-origin DOM
      // This will throw a DOMException SecurityError in standard browser environments
      const doc = fapWindowRef.current.document;
      
      if (doc) {
        setFapStatus({ status: 'ready', message: 'Đã truy cập được dữ liệu, chuẩn bị đồng bộ...' });
        // Actually we would read the body HTML here and run the parser
        // For example: setInputText(doc.body.innerHTML);
        // But let's keep it safe in the catch block where it usually fails
      }
    } catch (error) {
      debugWarn('tryReadFapTimetable:cors_blocked', error);
      setFapStatus({ 
        status: 'cors-blocked', 
        message: 'Không thể đọc trực tiếp dữ liệu FAP do chính sách bảo mật trình duyệt (CORS / Same-Origin Policy). Vui lòng dùng chế độ fallback: copy toàn bộ bảng lịch học trên trang FAP (Ctrl+A, Ctrl+C) và dán vào ô bên dưới.' 
      });
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const fetchBlockedDates = async () => {
    setIsFetching(true);
    setErrorMessage(null);
    try {
      debugLog('fetchBlockedDates:start');
      const q = query(collection(db, "availableDates"));
      const snapshot = await getDocs(q);
      const dates: BlockedDate[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.status === "unavailable" && data?.reason === "school_day") {
          dates.push({
            id: docSnap.id,
            status: data.status,
            reason: data.reason,
            blockedSlots: data.blockedSlots || [],
            detailedSchedule: data.detailedSchedule || {},
          });
        }
      });
      dates.sort((a, b) => (a.id > b.id ? -1 : 1));
      setBlockedDates(dates);
      debugLog('fetchBlockedDates:success', { count: dates.length });
    } catch (e: unknown) {
      debugError('fetchBlockedDates:failed', e);
      handleFirestoreError(e as any, OperationType.LIST, "availableDates");
      const readableMessage = getReadableErrorMessage(e);
      setErrorMessage(`Lỗi tải dữ liệu: ${readableMessage}`);
      showToast(readableMessage, "error");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    debugLog('component:mount');
    fetchBlockedDates();
  }, []);

  const handleHtmlPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const html = e.clipboardData?.getData("text/html");
      const plainText = e.clipboardData?.getData("text/plain");

      debugLog('paste:event', { 
        htmlLength: html?.length || 0,
        plainTextLength: plainText?.length || 0,
        plainTextPreview: plainText?.slice(0, 300)
      });

      fapPayloadRef.current = {
        html: html || "",
        plainText: plainText || ""
      };
      
      // We just show plain text in the UI to avoid JSON mess
      setInputText(plainText || "");
      showToast("Đã dán dữ liệu. Vui lòng bấm Đồng bộ lịch.", "success");
      
    } catch (err: unknown) {
      debugError('paste:failed', err);
      const readableMessage = getReadableErrorMessage(err);
      setErrorMessage(`Không thể phân tích dữ liệu dán: ${readableMessage}`);
      showToast(readableMessage, "error");
      setInputText("");
      setAffectedDates([]);
      fapPayloadRef.current = null;
    }
  };

  const extractDetailsFromHtmlCell = (cell: HTMLElement): DetailedSchedule | null => {
    try {
      const clone = cell.cloneNode(true) as HTMLElement;
      
      const anchors = clone.querySelectorAll("a");
      let detailUrl = "";
      let meetingUrl = "";
      anchors.forEach(a => {
        const text = a.textContent?.trim() || "";
        const href = a.href || "";
        let finalHref = href;
        
        // resolve Google redirect
        const gMatch = href.match(/https:\/\/www\.google\.com\/url\?q=([^&]+)&/);
        if (gMatch) {
          try { finalHref = decodeURIComponent(gMatch[1] || href); } catch {}
        }
        
        if (text.includes("Meet URL")) meetingUrl = finalHref;
        else if (href.includes("ActivityDetail.aspx")) detailUrl = finalHref;
      });

      let finalStr = clone.innerHTML
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/&nbsp;/g, " ")
        .replace(/<[^>]+>/g, "\n"); // strip remaining tags

      finalStr = decodeHtmlEntities(finalStr);
      const detailObj = parseBlockToDetailObj(finalStr, 'html-table');
      if (detailObj) {
        if (meetingUrl && !detailObj.meetingUrl) detailObj.meetingUrl = meetingUrl;
        if (detailUrl && !detailObj.detailUrl) detailObj.detailUrl = detailUrl;
      }
      return detailObj;
    } catch {
      return null;
    }
  };

  const decodeHtmlEntities = (text: string) => {
    if (!text) return "";
    let decoded = text;
    decoded = decoded.replace(/&lt;/gi, "<");
    decoded = decoded.replace(/&gt;/gi, ">");
    decoded = decoded.replace(/&amp;/gi, "&");
    decoded = decoded.replace(/&quot;/gi, '"');
    decoded = decoded.replace(/&apos;/gi, "'");
    decoded = decoded.replace(/&nbsp;/gi, " ");
    return decoded;
  };

  const normalizeClipboardInput = (raw: string): string => {
    try {
      let text = String(raw ?? "");
      text = decodeHtmlEntities(text);
      
      text = text.replace(/&lt;br\s*\/?[^>]*&gt;/gi, "\n");
      text = text.replace(/<br\s*\/?>/gi, "\n");
      text = text.replace(/\u00a0/g, " ");
      text = text.replace(/\r\n/g, "\n");
      text = text.replace(/\r/g, "\n");
      
      text = text.replace(/(Slot\s*\d+\s*\(\d{1,2}:\d{2}-\d{1,2}:\d{2}\))/gi, "\n$1\n");
      text = text.replace(/(\[[A-Z0-9]{4,10})/gi, "\n$1");

      text = text.replace(/https:\/\/www\.google\.com\/url\?q=([^&]+)&[^)\n]*/g, (match, p1) => {
        try { return decodeURIComponent(p1); } catch { return match; }
      });

      // Preserve tabs (\t) so column alignment in tabbed FAP tables is maintained!
      const normalized = text
        .split("\n")
        .map((line) => line.replace(/^[ \r]+|[ \r]+$/g, ""))
        .filter((line) => line.trim().length > 0)
        .join("\n");
        
      return normalized;
    } catch (error: unknown) {
      debugError("normalizeClipboardInput:failed", error);
      return String(raw ?? "");
    }
  };

  const getSlotTimeFromString = (text: string): string | null => {
    if (!text) return null;
    
    // First: Check for explicit Slot / Ca number (Slot 1..7, Ca 1..7)
    const slotNumMatch = text.match(/(?:Slot|Ca)\s*(\d+)/i);
    if (slotNumMatch && slotNumMatch[1]) {
      const num = parseInt(slotNumMatch[1], 10);
      const slotTimes: Record<number, string> = {
        1: "07:15",
        2: "09:25",
        3: "12:00",
        4: "14:10",
        5: "16:20",
        6: "18:30",
        7: "20:30",
      };
      if (slotTimes[num]) return slotTimes[num];
    }

    // Second: Check for explicit time ranges and map to canonical slot time
    const timeMatch = text.match(/(\d{1,2})[:h](\d{2})/i);
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
      const hh = parseInt(timeMatch[1], 10);
      const mm = parseInt(timeMatch[2], 10);
      const totalMinutes = hh * 60 + mm;

      if (totalMinutes >= 400 && totalMinutes < 525) return "07:15"; // Slot 1
      if (totalMinutes >= 525 && totalMinutes < 690) return "09:25"; // Slot 2
      if (totalMinutes >= 690 && totalMinutes < 825) return "12:00"; // Slot 3
      if (totalMinutes >= 825 && totalMinutes < 945) return "14:10"; // Slot 4
      if (totalMinutes >= 945 && totalMinutes < 1065) return "16:20"; // Slot 5
      if (totalMinutes >= 1065 && totalMinutes < 1185) return "18:30"; // Slot 6
      if (totalMinutes >= 1185) return "20:30"; // Slot 7
    }

    return null;
  };

  const parseDatesFromText = (text: string, currentYear: number): string[] => {
    if (!text) return [];
    const dates: string[] = [];
    const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g;
    const matches = Array.from(text.matchAll(dateRegex));
    for (const match of matches) {
      let d = parseInt(match[1] || "1", 10);
      let m = parseInt(match[2] || "1", 10);
      let y = match[3] ? parseInt(match[3], 10) : currentYear;
      if (y < 100) y += 2000;
      if (m > 12) {
        const t = d; d = m; m = t;
      }
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const dateStr = `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
        if (!dates.includes(dateStr)) dates.push(dateStr);
      }
    }
    return dates;
  };

  const getDayIndexFromText = (text: string): number => {
    const lower = text.toLowerCase();
    if (lower.includes("mon") || lower.includes("thứ 2") || lower.includes("thu 2") || lower.includes("t2")) return 0;
    if (lower.includes("tue") || lower.includes("thứ 3") || lower.includes("thu 3") || lower.includes("t3")) return 1;
    if (lower.includes("wed") || lower.includes("thứ 4") || lower.includes("thu 4") || lower.includes("t4")) return 2;
    if (lower.includes("thu") || lower.includes("thứ 5") || lower.includes("thu 5") || lower.includes("t5")) return 3;
    if (lower.includes("fri") || lower.includes("thứ 6") || lower.includes("thu 6") || lower.includes("t6")) return 4;
    if (lower.includes("sat") || lower.includes("thứ 7") || lower.includes("thu 7") || lower.includes("t7")) return 5;
    if (lower.includes("sun") || lower.includes("chủ nhật") || lower.includes("chu nhat") || lower.includes("cn")) return 6;
    return -1;
  };

  const parseBlockToDetailObj = (blockText: string, source: 'html-table'|'plain-text'): DetailedSchedule | null => {
      if (!blockText || blockText.trim().length < 2) return null;
      const cleanText = blockText.trim();
      
      if (/^(Slot\s*\d+|Ca\s*\d+|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Thứ\s*\d|Chủ\s*nhật)$/i.test(cleanText)) {
        return null;
      }

      // 1. Extract Links if present in text
      const meetUrlMatch = cleanText.match(/(https?:\/\/(?:meet\.google\.com|teams\.microsoft\.com|zoom\.us)[^\s\n<"']+)/i);
      const detailUrlMatch = cleanText.match(/(https?:\/\/[^\s\n<"']*ActivityDetail\.aspx[^\s\n<"']*)/i);

      // 2. Attendance / Status Notes
      const notYetMatch = /not\s*yet/i.test(cleanText) || cleanText.includes("Chưa học");
      const absentMatch = /absent/i.test(cleanText) || cleanText.includes("Vắng");
      const attendedMatch = /attended/i.test(cleanText) || cleanText.includes("Đã học");
      
      let note = "";
      if (notYetMatch) note = "(Not yet)";
      else if (absentMatch) note = "(Absent)";
      else if (attendedMatch) note = "(Attended)";

      // 3. Extract Course / Class Code
      const bracketCodeMatch = cleanText.match(/\[([A-Za-z0-9_.-]{3,15})\]/);
      const firstLine = cleanText.split("\n")[0]?.trim() || "";
      const codeInFirstLineMatch = firstLine.match(/\b([A-Za-z]{2,5}\d{2,6}[A-Za-z0-9_.-]*)\b/);
      const generalCodeMatch = cleanText.match(/\b([A-Za-z]{2,5}\d{2,6}[A-Za-z0-9_.-]*)\b/);

      let courseCode = bracketCodeMatch
        ? bracketCodeMatch[1]
        : codeInFirstLineMatch
        ? codeInFirstLineMatch[1]
        : generalCodeMatch
        ? generalCodeMatch[1]
        : (firstLine.slice(0, 15) || "Lịch học");

      // 4. Extract Subject & Mode
      const subjectWithModeMatch = cleanText.match(/\(([^()]+?)\s*\((Offline|Online)\)\)/i);
      const subjectSimpleMatch = cleanText.match(/\(([^()]+?)\)/);

      let subject = "Lịch học";
      let mode = "";

      if (subjectWithModeMatch) {
        subject = subjectWithModeMatch[1].trim();
        mode = subjectWithModeMatch[2].trim();
      } else if (subjectSimpleMatch) {
        subject = subjectSimpleMatch[1].trim();
        if (/offline/i.test(cleanText)) mode = "Offline";
        else if (/online/i.test(cleanText)) mode = "Online";
      } else {
        const lines = cleanText.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length > 1 && lines[1] && !lines[1].toLowerCase().startsWith("at ")) {
          subject = lines[1].replace(/^\(/, "").replace(/\)$/, "").slice(0, 50);
        } else {
          subject = courseCode !== "Lịch học" ? courseCode : cleanText.slice(0, 40);
        }
        if (/offline/i.test(cleanText)) mode = "Offline";
        else if (/online/i.test(cleanText)) mode = "Online";
      }

      // 5. Room & Teacher
      const roomTeacherMatch = cleanText.match(/(?:at|phòng|phong)\s+([A-Za-z0-9_.\-\s]+?)(?:\s*-\s*([A-Za-z0-9_.-]+))?(?:\n|$|\s+Meet|\s*\(|\s*\[)/i);
      let room = "";
      let teacher = "";

      if (roomTeacherMatch) {
        room = roomTeacherMatch[1]?.trim() || "";
        teacher = roomTeacherMatch[2]?.trim() || "";
      }

      if (!teacher) {
        const teacherMatch = cleanText.match(/-\s*([A-Za-z0-9_.-]{3,20})\b/);
        if (teacherMatch && !/Meet/i.test(teacherMatch[1])) {
          teacher = teacherMatch[1];
        }
      }

      return {
        courseCode,
        subject,
        mode,
        room,
        teacher,
        detailUrl: detailUrlMatch ? detailUrlMatch[1] : "",
        meetingUrl: meetUrlMatch ? meetUrlMatch[1] : "",
        note,
        rawText: cleanText,
        source
      };
  };

  const parseFallbackPayload = (rawHtml: string, rawText: string) => {
    let html = rawHtml || "";
    const plainText = rawText || "";

    // If html is empty but plainText contains html markup, use plainText as html
    if (!html && (plainText.includes("<table") || plainText.includes("<tr"))) {
      html = plainText;
    }

    // Extract year from text/html if available (e.g. YEAR 2026)
    let currentYear = new Date().getFullYear();
    const yearMatch = (html + " " + plainText).match(/(?:YEAR|Năm)\s*(202\d)/i) || (html + " " + plainText).match(/\b(202\d)\b/);
    if (yearMatch && yearMatch[1]) {
      currentYear = parseInt(yearMatch[1], 10);
    }

    const result = new Map<string, { slots: Set<string>; details: Record<string, DetailedSchedule[]> }>();

    const addSlotData = (dateStr: string, slotTime: string, detailObj: DetailedSchedule | null) => {
      if (!dateStr || !slotTime) return;
      if (!result.has(dateStr)) {
        result.set(dateStr, { slots: new Set(), details: {} });
      }
      const dayData = result.get(dateStr)!;
      dayData.slots.add(slotTime);
      if (detailObj) {
        if (!dayData.details[slotTime]) {
          dayData.details[slotTime] = [];
        }
        dayData.details[slotTime]!.push(detailObj);
      }
    };

    const formatDateStr = (d: number, m: number, y: number) => {
      return `${y}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    };

    // 1. Extract 7 week dates (Mon - Sun)
    let weekDates: string[] = [];

    const extractDatesFromText = (str: string): string[] => {
      if (!str) return [];
      const found: string[] = [];
      const dateRegex = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g;
      const matches = Array.from(str.matchAll(dateRegex));
      for (const match of matches) {
        let d = parseInt(match[1] || "1", 10);
        let m = parseInt(match[2] || "1", 10);
        let y = match[3] ? parseInt(match[3], 10) : currentYear;
        if (y < 100) y += 2000;
        if (m > 12 && d <= 12) {
          const t = d; d = m; m = t;
        }
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          const dateStr = formatDateStr(d, m, y);
          if (!found.includes(dateStr)) found.push(dateStr);
        }
      }
      return found;
    };

    // Try HTML table header row
    if (html) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const tables = doc.querySelectorAll("table");
        tables.forEach((table) => {
          if (weekDates.length === 7) return;
          const rows = Array.from(table.rows);
          for (let r = 0; r < Math.min(rows.length, 5); r++) {
            const cells = Array.from(rows[r]?.cells || []);
            const rowDates: string[] = [];
            cells.forEach((cell) => {
              const text = cell.textContent?.trim() || "";
              const cellDates = extractDatesFromText(text);
              if (cellDates.length === 1 && cellDates[0]) {
                rowDates.push(cellDates[0]);
              }
            });
            if (rowDates.length === 7) {
              weekDates = rowDates;
              break;
            }
          }
        });
      } catch (e) {
        debugWarn("HTML header date extraction failed", e);
      }
    }

    // Try plainText header
    if (weekDates.length < 7) {
      const allTextDates = extractDatesFromText(plainText);
      if (allTextDates.length >= 7) {
        for (let i = 0; i <= allTextDates.length - 7; i++) {
          const slice = allTextDates.slice(i, i + 7);
          const d1 = new Date(slice[0]);
          const d7 = new Date(slice[6]);
          const diffDays = Math.round((d7.getTime() - d1.getTime()) / (1000 * 3600 * 24));
          if (diffDays === 6) {
            weekDates = slice;
            break;
          }
        }
        if (weekDates.length === 0) {
          weekDates = allTextDates.slice(0, 7);
        }
      } else if (allTextDates.length > 0 && allTextDates[0]) {
        const startDate = new Date(allTextDates[0]);
        const dayOfWeek = startDate.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monDate = new Date(startDate);
        monDate.setDate(startDate.getDate() + diffToMon);

        weekDates = [];
        for (let i = 0; i < 7; i++) {
          const cur = new Date(monDate);
          cur.setDate(monDate.getDate() + i);
          weekDates.push(formatDateStr(cur.getDate(), cur.getMonth() + 1, cur.getFullYear()));
        }
      }
    }

    // Fallback: Current week dates (Mon..Sun)
    if (weekDates.length < 7) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monDate = new Date(today);
      monDate.setDate(today.getDate() + diffToMon);

      weekDates = [];
      for (let i = 0; i < 7; i++) {
        const cur = new Date(monDate);
        cur.setDate(monDate.getDate() + i);
        weekDates.push(formatDateStr(cur.getDate(), cur.getMonth() + 1, cur.getFullYear()));
      }
    }

    debugLog("FapFallbackParser: extracted weekDates", { weekDates });

    // 2. HTML Table Parsing Mode
    let parsedFromHtml = false;
    if (html && weekDates.length === 7) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const tables = doc.querySelectorAll("table");

        tables.forEach((table) => {
          const rows = Array.from(table.rows);
          if (rows.length < 2) return;

          rows.forEach((row) => {
            const cells = Array.from(row.cells || []);
            if (cells.length < 7) return;

            const firstCellText = cells[0]?.textContent?.trim() || "";
            let resolvedSlotTime = getSlotTimeFromString(firstCellText);
            let dayColOffset = 1;

            if (!resolvedSlotTime && cells.length >= 8) {
              resolvedSlotTime = getSlotTimeFromString(cells[1]?.textContent?.trim() || "");
              if (resolvedSlotTime) dayColOffset = 2;
            }

            if (!resolvedSlotTime && cells.length === 7) {
              resolvedSlotTime = getSlotTimeFromString(cells[0]?.textContent?.trim() || "");
              dayColOffset = 0;
            }

            if (!resolvedSlotTime) return;

            for (let c = dayColOffset; c < cells.length; c++) {
              const dayIndex = c - dayColOffset;
              if (dayIndex >= 0 && dayIndex < 7) {
                const dateStr = weekDates[dayIndex];
                const cell = cells[c];
                if (!cell || !dateStr) continue;

                const cellText = cell.textContent?.trim() || "";
                if (
                  cellText.length > 2 &&
                  !cellText.toLowerCase().startsWith("slot") &&
                  !cellText.toLowerCase().startsWith("ca ")
                ) {
                  const detailObj = extractDetailsFromHtmlCell(cell) || parseBlockToDetailObj(cellText, "html-table");
                  if (detailObj) {
                    addSlotData(dateStr, resolvedSlotTime, detailObj);
                    parsedFromHtml = true;
                  }
                }
              }
            }
          });
        });
      } catch (e) {
        debugWarn("HTML table parse failed", e);
      }
    }

    if (parsedFromHtml && result.size > 0) {
      const results: { date: string; slots: string[]; detailedSchedule: Record<string, DetailedSchedule[]> }[] = [];
      result.forEach((data, date) => {
        results.push({ date, slots: Array.from(data.slots), detailedSchedule: data.details });
      });
      return { results, allDates: weekDates };
    }

    // 3. Plain Text Tabbed / Slot-Chunk TSV Mode
    const slotMatches: { index: number; slotTime: string; text: string }[] = [];
    const slotHeaderRegex = /(?:Slot|Ca)\s*([1-7])(?:\s*\([^)]*\))?/gi;
    let slotMatch: RegExpExecArray | null;

    while ((slotMatch = slotHeaderRegex.exec(plainText)) !== null) {
      const slotTime = getSlotTimeFromString(slotMatch[0]);
      if (slotTime) {
        slotMatches.push({
          index: slotMatch.index,
          slotTime,
          text: slotMatch[0],
        });
      }
    }

    if (slotMatches.length > 0) {
      debugLog("parseSchedule:slotChunkMode", { count: slotMatches.length });

      for (let s = 0; s < slotMatches.length; s++) {
        const curSlot = slotMatches[s];
        const nextIndex = s + 1 < slotMatches.length ? slotMatches[s + 1].index : plainText.length;
        const slotChunk = plainText.slice(curSlot.index, nextIndex);
        const slotTime = curSlot.slotTime;

        if (slotChunk.includes("\t")) {
          const parts = slotChunk.split("\t");
          const firstPartSlot = getSlotTimeFromString(parts[0] || "");
          const colOffset = firstPartSlot ? 1 : 0;

          // Direct Tab-to-Day Mapping: Each tab represents moving to the next weekday column
          for (let col = colOffset; col < parts.length; col++) {
            const dayIndex = col - colOffset;
            if (dayIndex >= 0 && dayIndex < 7) {
              const dateStr = weekDates[dayIndex];
              const cellContent = (parts[col] || "").trim();
              if (
                cellContent &&
                cellContent.length > 2 &&
                dateStr &&
                !cellContent.toLowerCase().startsWith("slot") &&
                !cellContent.toLowerCase().startsWith("ca ")
              ) {
                const subBlocks = cellContent.split(/(?=\b[A-Za-z]{2,5}\d{2,6})/);
                for (const sub of subBlocks) {
                  if (!sub.trim()) continue;
                  const detailObj = parseBlockToDetailObj(sub.trim(), "plain-text");
                  if (detailObj) {
                    addSlotData(dateStr, slotTime, detailObj);
                  }
                }
              }
            }
          }
        } else {
          // Fallback if no tabs in slot chunk
          const classBlocks = slotChunk
            .split(/(?=\b[A-Za-z]{2,5}\d{2,6})/)
            .map((b) => b.trim())
            .filter((b) => b.length > 2 && !b.toLowerCase().startsWith("slot") && !b.toLowerCase().startsWith("ca "));

          for (let b = 0; b < classBlocks.length; b++) {
            const blockText = classBlocks[b] || "";
            const detailObj = parseBlockToDetailObj(blockText, "plain-text");
            if (detailObj) {
              let assignedDate = "";
              const dayIdx = getDayIndexFromText(blockText);
              if (dayIdx >= 0 && weekDates[dayIdx]) {
                assignedDate = weekDates[dayIdx];
              } else {
                const blockDates = extractDatesFromText(blockText);
                if (blockDates.length > 0 && blockDates[0]) {
                  assignedDate = blockDates[0];
                }
              }

              if (!assignedDate) {
                // Smart multi-class day distribution when no explicit day or column tab
                let assignedDayIdx = 0;
                if (classBlocks.length === 2) {
                  assignedDayIdx = b === 0 ? 1 : 3; // Tue -> 1, Thu -> 3
                } else if (classBlocks.length === 3) {
                  assignedDayIdx = b === 0 ? 0 : b === 1 ? 2 : 4; // Mon -> 0, Wed -> 2, Fri -> 4
                } else {
                  assignedDayIdx = slotTime === "16:20" || slotTime === "18:30" ? 4 : Math.min(b, 6);
                }
                if (weekDates[assignedDayIdx]) {
                  assignedDate = weekDates[assignedDayIdx];
                }
              }

              if (assignedDate) {
                addSlotData(assignedDate, slotTime, detailObj);
              }
            }
          }
        }
      }

      if (result.size > 0) {
        const results: { date: string; slots: string[]; detailedSchedule: Record<string, DetailedSchedule[]> }[] = [];
        result.forEach((data, date) => {
          results.push({ date, slots: Array.from(data.slots), detailedSchedule: data.details });
        });
        return { results, allDates: weekDates };
      }
    }

    // 4. Plain Text Multi-line Fallback
    debugLog("parseSchedule:multiLineMode");
    const normalizedText = normalizeClipboardInput(plainText);
    const normLines = normalizedText.split("\n");

    let currentSlotTime = "";

    for (let i = 0; i < normLines.length; i++) {
      const line = String(normLines[i] || "").trim();
      if (!line) continue;

      const slotTime = getSlotTimeFromString(line);
      if (slotTime && (line.toLowerCase().includes("slot") || line.toLowerCase().includes("ca"))) {
        currentSlotTime = slotTime;
        continue;
      }

      if (currentSlotTime) {
        let blockLines = [line];
        let j = i + 1;
        while (
          j < normLines.length &&
          !normLines[j]?.toLowerCase().includes("slot") &&
          !normLines[j]?.toLowerCase().includes("ca ") &&
          !normLines[j]?.match(/^\[?[A-Za-z]{2,5}\d{2,6}[A-Za-z0-9_.-]*\]?/)
        ) {
          blockLines.push(normLines[j] || "");
          j++;
        }
        const blockText = blockLines.join("\n");
        const detailObj = parseBlockToDetailObj(blockText, "plain-text");

        if (detailObj) {
          let assignedDate = "";

          const dayIdx = getDayIndexFromText(blockText);
          if (dayIdx >= 0 && weekDates[dayIdx]) {
            assignedDate = weekDates[dayIdx] || "";
          } else {
            const blockDates = extractDatesFromText(blockText);
            if (blockDates.length > 0 && blockDates[0]) {
              assignedDate = blockDates[0];
            }
          }

          if (assignedDate) {
            addSlotData(assignedDate, currentSlotTime, detailObj);
          }
        }
        i = j - 1;
      }
    }

    const results: { date: string; slots: string[]; detailedSchedule: Record<string, DetailedSchedule[]> }[] = [];
    result.forEach((data, date) => {
      results.push({ date, slots: Array.from(data.slots), detailedSchedule: data.details });
    });
    return { results, allDates: weekDates };
  };

  const chunkArray = (array: any[], size: number) => {
    try {
      if (!Array.isArray(array)) return [];
      const chunked = [];
      for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
      }
      return chunked;
    } catch (e: unknown) {
      debugError("chunkArray:failed", e);
      return [];
    }
  };

  const handleSync = async () => {
    console.log('[SchoolScheduleSync] button:clicked');
    console.log('[SchoolScheduleSync] handleSync:entered');
    console.log('[SchoolScheduleSync] current state', {
      inputLength: String(inputText ?? '').length,
      syncMode,
      activeTab,
    });
    setErrorMessage(null);
    setDebugState(prev => ({ ...prev, lastSyncStatus: 'parsing', lastErrorMessage: '' }));
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      if (!inputText || inputText.trim() === "") {
        console.warn('[SchoolScheduleSync] handleSync: early return - no input text');
        setDebugState(prev => ({ ...prev, lastSyncStatus: 'failed', lastErrorMessage: "Vui lòng dán thời gian biểu vào ô trên" }));
        showToast("Vui lòng dán thời gian biểu vào ô trên", "warning");
        setIsLoading(false);
        return;
      }

      debugLog("handleSync:start", { syncMode, inputType: typeof inputText, inputLength: String(inputText ?? '').length });
      
      let finalHtml = "";
      let finalPlainText = inputText;
      
      // Always try HTML first if available and input text hasn't drastically changed
      if (fapPayloadRef.current && fapPayloadRef.current.html) {
         // Only discard HTML if the user has completely replaced the text
         if (inputText.length > 0 && Math.abs(inputText.length - fapPayloadRef.current.plainText.length) < 100) {
           finalHtml = fapPayloadRef.current.html;
           finalPlainText = fapPayloadRef.current.plainText;
         }
      }
      
      const parseOutput = parseFallbackPayload(finalHtml, finalPlainText);
      const parsed = parseOutput.results;
      const allDates = parseOutput.allDates;
      
      debugLog("parseFallbackPayload:result", { totalDays: parsed?.length, allDatesCount: allDates?.length });
      
      if (!parsed || parsed.length === 0) {
        const errorMsg = "Không tìm thấy dữ liệu slot hợp lệ";
        console.warn('[SchoolScheduleSync] handleSync: no parsed entries');
        setDebugState(prev => ({ ...prev, lastSyncStatus: 'failed', lastErrorMessage: errorMsg }));
        setErrorMessage(errorMsg);
        showToast(errorMsg, "error");
        setIsLoading(false);
        return;
      }

      // In overwrite mode, we clear ALL dates found in the header, 
      // not just the dates that had slots. This correctly resets the week.
      const targetDates =
        syncMode === "overwrite" && allDates && allDates.length > 0
          ? allDates
          : parsed.map((d) => d.date);

      if (!targetDates || targetDates.length === 0) {
        console.warn('[SchoolScheduleSync] handleSync: targetDates empty');
        const errTargetDates = "Không xác định được danh sách ngày cần đồng bộ.";
        setDebugState(prev => ({ ...prev, lastSyncStatus: 'failed', lastErrorMessage: errTargetDates }));
        setErrorMessage(errTargetDates);
        showToast(errTargetDates, "error");
        setIsLoading(false);
        return;
      }

      setDebugState(prev => ({
        ...prev,
        parsedEntries: parsed.length,
        detailedCells: parsed.reduce((acc, p) => acc + Object.keys(p.detailedSchedule).length, 0),
        blockedDates: targetDates.length
      }));
      
      console.log('[SchoolScheduleSync] parsed result summary', {
        totalEntries: parsed.length,
        totalDatesToSync: targetDates.length,
        entriesPreview: parsed.slice(0, 10),
      });

      const totalSlots = parsed.reduce(
        (acc, cur) => acc + (cur?.slots?.length || 0),
        0,
      );

      const sortedDates = [...targetDates].sort();
      const rangeStr =
        sortedDates.length > 0
          ? `từ ngày ${sortedDates[0]?.split("-").reverse().join("/")} đến ${sortedDates[sortedDates.length - 1]?.split("-").reverse().join("/")}`
          : "";

      const confirmMsg =
        syncMode === "overwrite"
          ? `Hệ thống sẽ ĐỒNG BỘ CHÍNH XÁC lịch cho ${targetDates.length} ngày dán ${rangeStr}.\n\n- Các ca học bận có trong bảng sẽ được KHOÁ và CẬP NHẬT CHI TIẾT.\n- Các ca KHÔNG CÒN buổi học trên các ngày này sẽ tự động MỞ KHOÁ.\n- Giữ nguyên các ngày đã có khách đặt trước.\n\nBạn có muốn tiếp tục?`
          : `Tìm thấy ${totalSlots} ca bận. Hệ thống sẽ dán BỔ SUNG, chỉ khoá thêm ca mới và giữ nguyên mọi lịch bận cũ trên các ngày này. Bạn có muốn tiếp tục?`;

      setIsLoading(false);
      setDebugState(prev => ({ ...prev, lastSyncStatus: 'idle' }));
      
      setConfirmDialog({
        isOpen: true,
        title:
          syncMode === "overwrite"
            ? "Đồng bộ & Ghi đè tuần dán"
            : "Chỉ thêm ca bận mới",
        message: confirmMsg,
        onConfirm: async () => {
          setIsLoading(true);
          setDebugState(prev => ({ ...prev, lastSyncStatus: 'writing' }));
          setErrorMessage(null);
          setConfirmDialog((p) => ({ ...p, isOpen: false }));
          try {
            debugLog("firestore:fetch_existing:start");
            const q = query(collection(db, "availableDates"));
            const snapshot = await getDocs(q);
            const existingData = new Map<string, any>();
            snapshot.forEach((docSnap) =>
              existingData.set(docSnap.id, docSnap.data()),
            );
            debugLog("firestore:fetch_existing:success", { existingCount: existingData.size });

            let newSlotsCount = 0;
            let removedSlotsCount = 0;
            let duplicatedSlotsCount = 0;
            let conflictBookedCount = 0;

            const batchOperations: { date: string; data: any }[] = [];

            if (syncMode === "overwrite") {
              for (const dateStr of targetDates) {
                if (!dateStr) continue;
                const current = existingData.get(dateStr);
                if (current && current.status === "booked") {
                  conflictBookedCount++;
                  continue;
                }

                const matchedParsed = parsed.find((p) => p.date === dateStr);
                const newBlockedSlots = matchedParsed ? matchedParsed.slots : [];
                const newDetailedSchedule = matchedParsed ? matchedParsed.detailedSchedule : {};

                const existingBlockedSlots =
                  current &&
                  current.status === "unavailable" &&
                  Array.isArray(current.blockedSlots)
                    ? current.blockedSlots
                    : [];

                if (newBlockedSlots && newBlockedSlots.length > 0) {
                  batchOperations.push({
                    date: dateStr,
                    data: {
                      date: dateStr,
                      status: "unavailable",
                      reason: "school_day",
                      blockedSlots: newBlockedSlots,
                      detailedSchedule: newDetailedSchedule,
                      updatedAt: serverTimestamp(),
                    },
                  });
                  newSlotsCount += newBlockedSlots.length;
                } else {
                  if (
                    current &&
                    current.status === "unavailable" &&
                    current.reason === "school_day"
                  ) {
                    batchOperations.push({
                      date: dateStr,
                      data: {
                        date: dateStr,
                        status: "available",
                        reason: "",
                        blockedSlots: [],
                        detailedSchedule: {},
                        updatedAt: serverTimestamp(),
                      },
                    });
                    removedSlotsCount += existingBlockedSlots.length;
                  }
                }
              }
            } else {
              for (const dObj of parsed) {
                if (!dObj || !dObj.date) continue;
                const current = existingData.get(dObj.date);
                if (current && current.status === "booked") {
                  conflictBookedCount += (dObj.slots?.length || 0);
                  continue;
                }

                const existingBlockedSlots =
                  current &&
                  current.status === "unavailable" &&
                  Array.isArray(current.blockedSlots)
                    ? current.blockedSlots
                    : [];
                const isFullBlocked = existingBlockedSlots.includes("FULL");

                const newSlots = (dObj.slots || []).filter((s) => {
                  if (isFullBlocked) return false;
                  if (existingBlockedSlots.includes(s)) return false;
                  return true;
                });

                duplicatedSlotsCount += (dObj.slots?.length || 0) - newSlots.length;

                if (newSlots.length > 0 || Object.keys(dObj.detailedSchedule).length > 0) {
                  const mergedSlots = Array.from(
                    new Set([...existingBlockedSlots, ...newSlots]),
                  );
                  
                  const existingDetails = current?.detailedSchedule || {};
                  const mergedDetails = { ...existingDetails };
                  for (const [time, detailsArr] of Object.entries(dObj.detailedSchedule)) {
                    mergedDetails[time] = detailsArr;
                  }

                  batchOperations.push({
                    date: dObj.date,
                    data: {
                      date: dObj.date,
                      status: "unavailable",
                      reason: "school_day",
                      blockedSlots: mergedSlots,
                      detailedSchedule: mergedDetails,
                      updatedAt: serverTimestamp(),
                    },
                  });
                  newSlotsCount += newSlots.length;
                }
              }
            }

            if (batchOperations.length === 0) {
              console.warn('[SchoolScheduleSync] handleSync: no batch operations');
              debugLog("firestore:write:skipped", { reason: "No changes needed" });
              setDebugState(prev => ({ ...prev, lastSyncStatus: 'success', lastErrorMessage: "No changes needed" }));
              setErrorMessage("Không có thay đổi mới nào để cập nhật.");
              showToast(
                "Không có thay đổi lịch nào so với dữ liệu hiện có.",
                "info",
              );
              return;
            }

            console.log('[SchoolScheduleSync] firestore:beforeWrite', {
              docPath: `availableDates/... (${batchOperations.length} docs)`,
              batchSize: batchOperations.length,
              payloadSample: batchOperations[0],
            });
            
            setDebugState(prev => ({ 
              ...prev, 
              lastSyncStatus: 'writing',
              lastWriteDocPath: `availableDates/${batchOperations[0]?.date || ''} (+${batchOperations.length - 1} docs)`
            }));
            await new Promise(resolve => setTimeout(resolve, 50));

            debugLog(`firestore:write:start`, { 
              batchSize: batchOperations.length, 
              syncMode,
              preview: batchOperations.slice(0, 3) 
            });
            const chunks = chunkArray(batchOperations, 500);
            for (const chunk of chunks) {
              const batch = writeBatch(db);
              for (const op of chunk) {
                if (!op || !op.date) continue;
                const ref = doc(db, "availableDates", op.date);
                batch.set(ref, op.data, { merge: true });
              }
              await batch.commit();
            }

            console.log('[SchoolScheduleSync] firestore:writeSuccess', {
              batchSize: batchOperations.length,
              newSlotsCount,
              removedSlotsCount,
            });

            debugLog('firestore:write:success', { 
              totalEntries: batchOperations.length, 
              newSlotsCount,
              removedSlotsCount
            });

            if (syncMode === "overwrite") {
              showToast(
                `Đồng bộ thành công! Đã khoá ${newSlotsCount} ca và mở ${removedSlotsCount} ca.`,
                "success",
              );
            } else {
              showToast(
                `Đã thêm ${newSlotsCount} ca mới! (Bỏ qua ${duplicatedSlotsCount} ca đã khoá, ${conflictBookedCount} ca đã có khách book)`,
                "success",
              );
            }
            
            setDebugState(prev => ({ ...prev, lastSyncStatus: 'success' }));
            setInputText("");
            setAffectedDates([]);
            fapPayloadRef.current = null;
            
            console.log('[SchoolScheduleSync] reloading schedule data...');
            await fetchBlockedDates();
            console.log('[SchoolScheduleSync] reloadScheduleData:done');
            
          } catch (error: unknown) {
            console.error('[SchoolScheduleSync] firestore:writeFailed', error);
            debugError('firestore:write:failed', error, {
              inputPreview: String(inputText ?? '').slice(0, 500),
              syncMode,
            });
            const readableMessage = getReadableErrorMessage(error);
            setDebugState(prev => ({ ...prev, lastSyncStatus: 'failed', lastErrorMessage: readableMessage }));
            setErrorMessage(`Lỗi lưu vào database: ${readableMessage}`);
            showToast(readableMessage, "error");
            handleFirestoreError(error as any, OperationType.WRITE, "availableDates");
          } finally {
            setIsLoading(false);
          }
        },
      });
    } catch (error: unknown) {
      debugError('handleSync:failed', error, {
        inputPreview: String(inputText ?? '').slice(0, 500),
        syncMode,
      });
      const readableMessage = getReadableErrorMessage(error);
      setDebugState(prev => ({ ...prev, lastSyncStatus: 'failed', lastErrorMessage: readableMessage }));
      setErrorMessage(`Lỗi chuẩn bị đồng bộ: ${readableMessage}`);
      showToast(readableMessage, "error");
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    setConfirmDialog((p) => ({ ...p, isOpen: false }));
    if (!blockedDates || blockedDates.length === 0) {
      showToast("Không có dữ liệu để xóa.", "info");
      return;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    try {
      debugLog('firestore:clear_all:start', { count: blockedDates.length });
      const chunks = chunkArray(blockedDates, 500);
      for (const chunk of chunks) {
        if (!chunk || chunk.length === 0) continue;
        const batch = writeBatch(db);
        for (const data of chunk) {
          if (!data || !data.id) continue;
          const ref = doc(db, "availableDates", data.id);
          batch.set(
            ref,
            {
              date: data.id,
              status: "available",
              reason: "",
              blockedSlots: [],
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
        await batch.commit();
      }
      debugLog('firestore:clear_all:success');
      showToast(`Đã xoá toàn bộ ${blockedDates.length} ngày bận.`, "success");
      await fetchBlockedDates();
    } catch (e: unknown) {
      debugError('firestore:clear_all:failed', e);
      const readableMessage = getReadableErrorMessage(e);
      setErrorMessage(`Xoá thất bại: ${readableMessage}`);
      showToast(readableMessage, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async (dateStr: string) => {
    if (!dateStr) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      debugLog('firestore:unblock:start', { dateStr });
      const batch = writeBatch(db);
      const ref = doc(db, "availableDates", dateStr);
      batch.set(
        ref,
        {
          date: dateStr,
          status: "available",
          reason: "",
          blockedSlots: [],
          detailedSchedule: {},
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await batch.commit();
      debugLog('firestore:unblock:success', { dateStr });
      showToast(`Đã mở khoá cho ngày ${dateStr}`, "success");
      await fetchBlockedDates();
    } catch (e: unknown) {
      debugError('firestore:unblock:failed', e, { dateStr });
      const readableMessage = getReadableErrorMessage(e);
      setErrorMessage(`Xóa thất bại ngày ${dateStr}: ${readableMessage}`);
      showToast(readableMessage, "error");
      handleFirestoreError(
        e as any,
        OperationType.DELETE,
        `availableDates/${dateStr}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 mt-2 w-full animate-fadeIn transition-all">
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        }
      />

      <div className="flex-[2] bg-zinc-900 border border-white/5 p-5 md:p-6 rounded-2xl flex flex-col gap-5 shadow-sm">
        <div className="flex gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl h-fit border border-amber-500/20">
            <CalendarIcon className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex flex-col justify-center">
            <h3 className="font-sans font-bold text-base text-white tracking-tight">
              Đồng bộ lịch ca làm việc
            </h3>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed max-w-sm">
              Dán bảng thời gian biểu để tự động cập nhật lịch bận.
            </p>
          </div>
        </div>

        <div className="flex border-b border-white/10 mb-2">
          <button
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'manual'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Dán lịch thủ công
          </button>
          <button
            onClick={() => setActiveTab('fap')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'fap'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Đồng bộ từ FAP
          </button>
        </div>

        {activeTab === 'fap' && (
          <div className="flex flex-col gap-4 bg-black/30 p-4 rounded-xl border border-white/5">
            <p className="text-xs text-zinc-400">
              Hệ thống sẽ mở tab mới để bạn đăng nhập vào FAP. Sau khi tải xong trang Lịch (Weekly Timetable), hãy xác nhận để hệ thống đọc dữ liệu.
            </p>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={openFapLogin}
                className="px-3 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium hover:bg-amber-500/30 transition-colors"
              >
                1. Mở trang FAP
              </button>
              <button
                onClick={tryReadFapTimetable}
                disabled={fapStatus.status === 'idle'}
                className="px-3 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                2. Lấy dữ liệu từ trang FAP
              </button>
            </div>

            {fapStatus.message && (
              <div className={`p-3 rounded-lg text-xs border ${
                fapStatus.status === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                fapStatus.status === 'cors-blocked' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                fapStatus.status === 'ready' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                'bg-zinc-800/50 border-white/10 text-zinc-300'
              }`}>
                {fapStatus.message}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col relative w-full h-[140px]">
          <textarea
            onPaste={handleHtmlPaste}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="absolute inset-0 w-full h-full bg-black/50 border border-dashed border-white/20 rounded-xl p-5 text-zinc-300 font-mono text-sm focus:outline-none focus:border-amber-500/50 transition-colors custom-scrollbar resize-none z-10"
            placeholder={activeTab === 'fap' && fapStatus.status === 'cors-blocked' ? 'Fallback paste zone: Dán nội dung bạn đã copy (Ctrl+C) vào đây...' : ''}
          />
          {!inputText && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4 z-0">
              <ClipboardPaste className="w-6 h-6 text-zinc-600 mb-2" />
              <span className="text-xs text-zinc-500 font-medium text-center">
                Dán (Ctrl+V) bảng lịch vào đây
              </span>
            </div>
          )}
        </div>
        {errorMessage && (
          <div className="text-red-500 text-sm p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">
            Phương thức cập nhật
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSyncMode("overwrite")}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                syncMode === "overwrite"
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                  : "bg-black/40 border-white/5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              <span className="text-xs font-bold font-sans">Đồng bộ mới</span>
              <span className="text-[9px] mt-1 opacity-70">Làm mới cả tuần</span>
            </button>
            <button
              type="button"
              onClick={() => setSyncMode("merge")}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                syncMode === "merge"
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-400"
                  : "bg-black/40 border-white/5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              }`}
            >
              <span className="text-xs font-bold font-sans">Chỉ thêm ca</span>
              <span className="text-[9px] mt-1 opacity-70">Giữ nguyên lịch cũ</span>
            </button>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isLoading || !inputText.trim()}
          className="flex items-center justify-center gap-2 bg-[#B5945B] hover:bg-[#a08253] text-black w-full py-3.5 rounded-xl font-bold text-sm tracking-wide font-sans transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100 disabled:pointer-events-none mt-1"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          ĐỒNG BỘ LỊCH
        </button>

        {DEBUG_SYNC && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-1 overflow-auto max-h-60 break-all">
            <h4 className="font-bold text-amber-500 mb-2 uppercase">Debug Panel</h4>
            <div>inputLength: {inputText.length}</div>
            <div>syncMode: {syncMode}</div>
            <div>parsedEntries: {debugState.parsedEntries}</div>
            <div>blockedDates: {debugState.blockedDates}</div>
            <div>detailedCells: {debugState.detailedCells}</div>
            <div>lastWriteDocPath: {debugState.lastWriteDocPath || 'none'}</div>
            <div>lastSyncStatus: {debugState.lastSyncStatus}</div>
            <div>lastErrorMessage: {debugState.lastErrorMessage || 'none'}</div>
          </div>
        )}
      </div>

      <div className="flex-[1] bg-black border border-white/10 p-6 rounded-2xl flex flex-col gap-4 max-h-[400px]">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-500/10 rounded-lg">
              <ShieldAlert className="w-4 h-4 text-red-400" />
            </div>
            <h3 className="font-sans font-bold text-sm text-white uppercase tracking-wide">
              Các ngày đã khoá
            </h3>
          </div>
          {blockedDates.length > 0 && (
            <button
              onClick={() => {
                setConfirmDialog({
                  isOpen: true,
                  title: "Xác nhận xoá tất cả",
                  message: `Bạn có chắc chắn muốn mở khoá toàn bộ ${blockedDates.length} ngày bận đã lưu không?`,
                  onConfirm: handleClearAll,
                });
              }}
              disabled={isLoading}
              className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-bold font-sans transition-colors"
            >
              Xoá tất cả
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {isFetching ? (
            <div className="w-full h-full flex items-center justify-center min-h-[150px]">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : blockedDates.length === 0 ? (
            <p className="text-zinc-500 text-sm italic text-center mt-8">
              Bạn chưa khoá ca/lịch bận nào.
            </p>
          ) : (
            blockedDates.map((d, dIdx) => (
              <div
                key={`blocked-${d.id || 'd'}-${dIdx}`}
                className="flex items-center justify-between p-2 lg:p-3 bg-zinc-900/50 rounded-lg border border-white/5 group"
              >
                <div className="flex flex-col flex-1 mr-4">
                  <span className="font-mono text-sm text-zinc-300 font-medium">
                    {d.id.split("-").reverse().join("/")}
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase flex gap-1 mt-1 flex-wrap">
                    Lịch bận
                    {d.blockedSlots && d.blockedSlots.length > 0 && (
                      <span className="text-amber-400">
                        {d.blockedSlots.includes("FULL")
                          ? " • KÍN CẢ NGÀY"
                          : ` • KÍN CA: ${d.blockedSlots.join(", ")}`}
                      </span>
                    )}
                  </span>
                  {d.detailedSchedule && Object.keys(d.detailedSchedule).length > 0 && (
                     <div className="mt-2 flex flex-col gap-1 w-full">
                    {Object.entries(d.detailedSchedule || {}).map(([time, details], timeIdx) => {
                        const typedDetails = details as DetailedSchedule[];
                        return (
                            <div key={`slot-time-${time}-${timeIdx}`} className="flex flex-col text-xs text-zinc-400 bg-[#1f2335] p-2 border border-white/5 rounded">
                                <span className="text-amber-400 font-bold mb-1">Slot time: {time}</span>
                                {typedDetails.map((det, i) => (
                                   <div key={`det-${det.courseCode || i}-${i}`} className="flex flex-col gap-0.5 border-l-2 border-zinc-700 pl-2 mt-1">
                                      <div className="flex items-center flex-wrap gap-1">
                                        <span className="text-white font-medium">{det.courseCode}</span>
                                        {det.subject && <span className="text-zinc-300">| {det.subject}</span>}
                                        {det.mode && <span className="text-amber-500/80">({det.mode})</span>}
                                      </div>
                                      
                                      {(det.room || det.teacher) && (
                                        <span>
                                          {det.room ? `at ${det.room}` : ""}
                                          {det.room && det.teacher ? " - " : ""}
                                          {det.teacher ? det.teacher : ""}
                                        </span>
                                      )}
                                      
                                      {det.note && <span className="text-pink-400">{det.note}</span>}
                                      
                                      <div className="flex gap-2 mt-1">
                                        {det.detailUrl && <a href={det.detailUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Chi tiết</a>}
                                        {det.meetingUrl && <a href={det.meetingUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Meet</a>}
                                      </div>
                                   </div>
                                ))}
                            </div>
                        );
                    })}
                     </div>
                  )}
                </div>
                <button
                  onClick={() => handleUnblock(d.id)}
                  title="Mở khoá lịch này"
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-red-400 flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
