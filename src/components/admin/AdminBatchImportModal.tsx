import React, { useState, useEffect } from "react";
import {
  X as XIcon,
  FileSpreadsheet,
  Upload,
  Calendar,
  Sparkles,
  Check,
  AlertCircle,
  RefreshCw,
  Phone,
  User,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { Booking } from "../../types";
import { syncAllBookingsToSheet } from "../../services/googleSheetsService";

interface AdminBatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  googleToken: string | null;
  googleSignIn: () => Promise<any>;
  onBookingsUpdated?: () => void;
  existingBookings?: Booking[];
}

export interface EditableCustomerRow {
  selected: boolean;
  id?: string;
  fullName: string;
  phone: string;
  date: string;
  conceptType: "THPT" | "University" | "Event" | "Custom";
  session: string;
  location: string;
  note: string;
  status: "Mới" | "Đã cọc" | "Đã chụp" | "Đang sửa" | "Đã bàn giao" | "Hủy";
  classSize: number;
}

// Hàm chuẩn hóa & trích xuất số điện thoại (hỗ trợ cả dấu cách, chấm, gạch ngang, +84)
export function extractCleanPhone(str: string): string {
  if (!str) return "";
  // Tìm chuỗi chứa dạng số điện thoại Việt Nam
  const cleaned = str.replace(/[^\d+]/g, " ");
  const matchWithCode = cleaned.match(/(?:\+84|0)\s*(?:[1-9]\d{8,9})/);
  if (matchWithCode) {
    const p = matchWithCode[0].replace(/\s+/g, "");
    return p.startsWith("+84") ? "0" + p.slice(3) : p;
  }
  const matchSimple = str.match(/(0\d{9,10}|\+84\d{9,10})/);
  if (matchSimple) {
    const p = matchSimple[1];
    return p.startsWith("+84") ? "0" + p.slice(3) : p;
  }
  return "";
}

export const AdminBatchImportModal: React.FC<AdminBatchImportModalProps> = ({
  isOpen,
  onClose,
  showToast,
  googleToken,
  googleSignIn,
  onBookingsUpdated,
  existingBookings = [],
}) => {
  const [activeTab, setActiveTab] = useState<"gcalendar" | "paste" | "existing">("gcalendar");
  const [pasteText, setPasteText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<EditableCustomerRow[]>([]);
  const [pastedRows, setPastedRows] = useState<EditableCustomerRow[]>([]);
  const [existingEditable, setExistingEditable] = useState<EditableCustomerRow[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarYearRange, setCalendarYearRange] = useState<"all" | "2026" | "2025" | "2027">("all");
  const [hideSchoolClasses, setHideSchoolClasses] = useState(true);

  // Khởi tạo tab "existing" từ danh sách booking hiện có trong hệ thống
  useEffect(() => {
    if (existingBookings && existingBookings.length > 0) {
      const mapped = existingBookings.map((b) => {
        const raw = b as any;
        const p = extractCleanPhone(b.phone || b.instagramOrZalo || b.notes || "");
        return {
          selected: true,
          id: b.id,
          fullName: b.schoolName || "Khách hàng",
          phone: p || (b.phone && !b.phone.includes("***") ? b.phone : ""),
          date: b.date || new Date().toISOString().split("T")[0],
          conceptType: b.conceptType || "THPT",
          session: b.timeSlot || "Sáng (07:30 - 11:30)",
          location: b.address || "Studio & Ngoại cảnh",
          note: b.notes || "",
          status: (b.status === "Đã hoàn thành" ? "Đã bàn giao" : b.status === "Đã hủy" ? "Hủy" : "Đã cọc") as any,
          classSize: b.classSize || 1,
        };
      });
      setExistingEditable(mapped);
    }
  }, [existingBookings]);

  if (!isOpen) return null;

  // Phân tích văn bản dán từ Excel / Sheets / Messenger
  const parseRowsFromText = (text: string): EditableCustomerRow[] => {
    if (!text.trim()) return [];
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const results: EditableCustomerRow[] = [];

    for (const line of lines) {
      // Bỏ qua dòng tiêu đề nếu người dùng copy cả header
      if (
        line.toLowerCase().includes("họ và tên") ||
        line.toLowerCase().includes("họ tên") ||
        line.toLowerCase().includes("số điện thoại") ||
        line.toLowerCase().includes("phone")
      ) {
        continue;
      }

      // Hỗ trợ phân cách bằng Tab (\t), Phẩy (,), Chấm phẩy (;), hoặc Gạch đứng (|)
      let cols: string[] = [];
      if (line.includes("\t")) {
        cols = line.split("\t");
      } else if (line.includes("|")) {
        cols = line.split("|");
      } else if (line.includes(";")) {
        cols = line.split(";");
      } else if (line.includes(",")) {
        cols = line.split(",");
      } else {
        cols = [line];
      }

      cols = cols.map((c) => c.trim());

      let fullName = cols[0] || "Khách hàng cũ";
      let phone = "";
      let date = "";
      let concept: "THPT" | "University" | "Event" | "Custom" = "THPT";
      let session = "Sáng (07:30 - 11:30)";
      let location = "Studio & Ngoại cảnh";
      let note = "";
      let status: "Mới" | "Đã cọc" | "Đã chụp" | "Đang sửa" | "Đã bàn giao" | "Hủy" = "Đã cọc";

      // Quét các cột để tự động nhận diện Số điện thoại & Ngày tháng
      for (let i = 1; i < cols.length; i++) {
        const val = cols[i];
        if (!val) continue;

        // Nhận diện Số điện thoại (9-11 số)
        const foundPhone = extractCleanPhone(val);
        if (foundPhone && !phone) {
          phone = foundPhone;
          continue;
        }

        // Nhận diện Ngày chụp (YYYY-MM-DD hoặc DD/MM/YYYY)
        if (val.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
          date = val;
          continue;
        } else if (val.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          const p = val.split("/");
          date = `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
          continue;
        }

        // Nhận diện Gói / Concept
        const lower = val.toLowerCase();
        if (lower.includes("kỷ yếu") || lower.includes("thpt") || lower.includes("cấp 3")) {
          concept = "THPT";
        } else if (lower.includes("tốt nghiệp") || lower.includes("cử nhân") || lower.includes("đại học")) {
          concept = "University";
        } else if (lower.includes("sự kiện") || lower.includes("event") || lower.includes("prom")) {
          concept = "Event";
        } else if (lower.includes("cá nhân") || lower.includes("chân dung") || lower.includes("profile")) {
          concept = "Custom";
        }

        // Nhận diện Trạng thái
        if (lower.includes("bàn giao") || lower.includes("hoàn thành")) {
          status = "Đã bàn giao";
        } else if (lower.includes("chụp")) {
          status = "Đã chụp";
        } else if (lower.includes("sửa") || lower.includes("đang sửa")) {
          status = "Đang sửa";
        } else if (lower.includes("hủy") || lower.includes("cancel")) {
          status = "Hủy";
        } else if (lower.includes("cọc") || lower.includes("duyệt")) {
          status = "Đã cọc";
        }

        // Địa chỉ hoặc ghi chú
        if (i === 4 || lower.includes("hà nội") || lower.includes("trường") || lower.includes("phố")) {
          location = val;
        } else if (i > 2 && !note) {
          note = val;
        }
      }

      // Nếu cột 1 là số điện thoại và tên ở cột 2
      if (fullName.match(/^0\d{9,10}$/) && !phone) {
        phone = fullName;
        fullName = cols[1] || "Khách hàng cũ";
      }

      if (!date) {
        date = new Date().toISOString().split("T")[0];
      }

      results.push({
        selected: true,
        fullName,
        phone,
        date,
        conceptType: concept,
        session,
        location,
        note,
        status,
        classSize: 1,
      });
    }

    return results;
  };

  const handlePasteChange = (text: string) => {
    setPasteText(text);
    setPastedRows(parseRowsFromText(text));
  };

  // Quét sự kiện từ Google Calendar
  const handleFetchFromGoogleCalendar = async () => {
    try {
      setIsLoadingCalendar(true);
      let token = googleToken;
      if (!token) {
        const res = await googleSignIn();
        if (res && res.accessToken) {
          token = res.accessToken;
        } else {
          showToast("Chưa cấp quyền Google Calendar.", "error");
          setIsLoadingCalendar(false);
          return;
        }
      }

      showToast("Đang quét sự kiện lịch trình từ Google Calendar...", "info");
      
      let minDate = "2024-01-01T00:00:00Z";
      let maxDate = "2028-01-01T00:00:00Z";
      if (calendarYearRange === "2026") {
        minDate = "2026-01-01T00:00:00Z";
        maxDate = "2026-12-31T23:59:59Z";
      } else if (calendarYearRange === "2025") {
        minDate = "2025-01-01T00:00:00Z";
        maxDate = "2025-12-31T23:59:59Z";
      } else if (calendarYearRange === "2027") {
        minDate = "2027-01-01T00:00:00Z";
        maxDate = "2027-12-31T23:59:59Z";
      }

      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=250&orderBy=startTime&singleEvents=true&timeMin=${minDate}&timeMax=${maxDate}`;
      const gRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!gRes.ok) {
        throw new Error(`Google Calendar API trả về lỗi: HTTP ${gRes.status}`);
      }

      const gData = await gRes.json();
      const items = gData.items || [];
      const parsed: EditableCustomerRow[] = [];

      for (const ev of items) {
        const title = ev.summary || "";
        const desc = ev.description || "";
        const start = ev.start?.dateTime || ev.start?.date || "";
        const dateStr = start.split("T")[0] || "";

        // Bỏ qua các ca học cá nhân / thời khóa biểu nếu bật lọc
        const combinedText = `${title} ${desc}`.toLowerCase();
        if (
          hideSchoolClasses &&
          (combinedText.includes("bsbmkg") ||
            combinedText.includes("bsbldr") ||
            combinedText.includes("bsbtwk") ||
            combinedText.includes("mc04302") ||
            combinedText.includes("at d211") ||
            combinedText.includes("fpi.edu.vn") ||
            combinedText.includes("school_day"))
        ) {
          continue;
        }

        // 1. Trích xuất họ tên khách hàng
        let name = "";
        const nameInDescMatch = desc.match(/Khách(?:\s*hàng)?:\s*([^\n•\r]+)/i);
        if (nameInDescMatch) {
          name = nameInDescMatch[1].trim();
        } else if (title.includes("Chụp ảnh:")) {
          name = title.replace("Chụp ảnh:", "").split("-")[0].trim();
        } else if (title.includes("Lịch chụp:")) {
          name = title.replace("Lịch chụp:", "").split("-")[0].trim();
        } else if (title.includes("-")) {
          name = title.split("-").pop()?.trim() || "";
        } else {
          name = title.replace(/\[.*?\]/g, "").trim() || "Khách lịch trình";
        }

        // 2. Trích xuất số điện thoại
        let phone = "";
        const phoneInDescMatch =
          desc.match(/Số\s*điện\s*thoại\s*:\s*([^\n•\r]+)/i) ||
          desc.match(/SĐT\s*:\s*([^\n•\r]+)/i) ||
          desc.match(/Phone\s*:\s*([^\n•\r]+)/i) ||
          desc.match(/Liên\s*hệ\s*:\s*([^\n•\r]+)/i);

        if (phoneInDescMatch) {
          phone = extractCleanPhone(phoneInDescMatch[1]);
        }

        if (!phone) {
          phone = extractCleanPhone(`${title} ${desc}`);
        }

        // 3. Concept / Gói chụp
        let concept: "THPT" | "University" | "Event" | "Custom" = "THPT";
        if (combinedText.includes("tốt nghiệp") || combinedText.includes("cử nhân") || combinedText.includes("đại học")) {
          concept = "University";
        } else if (combinedText.includes("sự kiện") || combinedText.includes("event") || combinedText.includes("prom") || combinedText.includes("workshop")) {
          concept = "Event";
        } else if (combinedText.includes("cá nhân") || combinedText.includes("chân dung") || combinedText.includes("profile")) {
          concept = "Custom";
        }

        parsed.push({
          selected: true,
          fullName: name || "Khách hàng cũ",
          phone: phone,
          date: dateStr,
          conceptType: concept,
          session: "Theo lịch Google Calendar",
          location: ev.location || "Studio & Ngoại cảnh",
          note: desc.slice(0, 150),
          status: "Đã cọc",
          classSize: 1,
        });
      }

      setCalendarEvents(parsed);
      const withPhone = parsed.filter((p) => Boolean(p.phone)).length;
      showToast(
        `Đã tìm thấy ${parsed.length} lịch trình từ Google Calendar (trong đó ${withPhone} sự kiện có sẵn SĐT)!`,
        "success"
      );
    } catch (err: any) {
      console.error("Calendar fetch error:", err);
      showToast(`Lỗi quét Calendar: ${err?.message || err}`, "error");
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  // Lưu và đồng bộ dữ liệu vào Firestore + Google Sheets
  const handleSaveAndSync = async (rows: EditableCustomerRow[], sourceLabel: string) => {
    const selectedRows = rows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      showToast("Chưa chọn dòng khách hàng nào để đẩy lên Sheet.", "error");
      return;
    }

    setIsProcessing(true);
    showToast(`Đang chuẩn bị lưu & đẩy ${selectedRows.length} khách hàng lên Google Sheet...`, "info");

    try {
      const createdBookings: Booking[] = [];

      for (const item of selectedRows) {
        const id = item.id || `OLD_${item.date.replace(/-/g, "")}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const yr = item.date ? item.date.slice(0, 4) : "2026";
        const bookingCode = `BR-${yr}-${id.slice(-4)}`;

        const bk: Booking = {
          id,
          bookingCode,
          schoolName: item.fullName.trim(),
          phone: item.phone.trim(),
          instagramOrZalo: item.phone.trim() || item.fullName.trim(),
          date: item.date,
          timeSlot: item.session,
          conceptType: item.conceptType,
          classSize: item.classSize || 1,
          address: item.location,
          notes: item.note || `Nhập từ ${sourceLabel}`,
          status: item.status === "Đã bàn giao" ? "Đã hoàn thành" : item.status === "Hủy" ? "Đã hủy" : "Đã duyệt",
          source: sourceLabel,
          createdAt: new Date().toISOString(),
        };

        // 1. Lưu hoặc cập nhật vào Firestore bookings collection
        await setDoc(doc(db, "bookings", id), bk, { merge: true });

        // 2. Đồng thời đánh dấu ngày trong availableDates để lịch không bị trống
        if (item.date) {
          await setDoc(
            doc(db, "availableDates", item.date),
            { date: item.date, status: "booked", schoolName: item.fullName, phone: item.phone },
            { merge: true }
          );
        }

        createdBookings.push(bk);
      }

      // 3. Đẩy đồng loạt sang Google Sheet tab KH_Data
      showToast(`Đang đẩy ${createdBookings.length} khách hàng lên tab KH_Data của Google Sheet...`, "info");
      const sheetResult = await syncAllBookingsToSheet(createdBookings);

      if (sheetResult.success) {
        showToast(
          `🎉 Thành công! Đã đẩy ${sheetResult.synced}/${sheetResult.total} khách hàng lên Google Sheet tab KH_Data!`,
          "success"
        );
        if (onBookingsUpdated) onBookingsUpdated();
        onClose();
      } else {
        showToast(
          `Đã lưu vào hệ thống, nhưng Google Sheet trả về lỗi: ${sheetResult.error}`,
          "error"
        );
      }
    } catch (err: any) {
      console.error("Save & Sync error:", err);
      showToast(`Lỗi đồng bộ: ${err?.message || err}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentList =
    activeTab === "gcalendar"
      ? calendarEvents
      : activeTab === "paste"
        ? pastedRows
        : existingEditable;

  const updateCurrentRow = (index: number, field: keyof EditableCustomerRow, value: any) => {
    if (activeTab === "gcalendar") {
      setCalendarEvents((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    } else if (activeTab === "paste") {
      setPastedRows((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    } else {
      setExistingEditable((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    const updater = (list: EditableCustomerRow[]) => list.map((r) => ({ ...r, selected: checked }));
    if (activeTab === "gcalendar") setCalendarEvents(updater);
    else if (activeTab === "paste") setPastedRows(updater);
    else setExistingEditable(updater);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md">
      <div className="bg-[#0e1015] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1F3A5F] border border-[#2F6FED]/40 flex items-center justify-center text-[#E5C17C] shrink-0 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="text-base sm:text-lg font-sans font-bold text-white flex items-center gap-2">
                <span>Đồng Bộ Lịch Trình Khách Hàng Cũ & SĐT Lên Sheet</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                  Tự động 100%
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Quét Google Calendar hoặc Dán Excel để bổ sung đầy đủ Số điện thoại & Họ tên vào tab KH_Data Google Sheet.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex flex-wrap border-b border-white/10 bg-zinc-900/40 px-3 sm:px-6 pt-2 gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("gcalendar")}
            className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-sans font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "gcalendar"
                ? "border-[#E5C17C] text-[#E5C17C] bg-white/[0.03]"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>📅 Quét từ Google Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-sans font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "paste"
                ? "border-[#E5C17C] text-[#E5C17C] bg-white/[0.03]"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>📋 Copy & Dán Excel / Tin nhắn</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("existing")}
            className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-sans font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "existing"
                ? "border-[#E5C17C] text-[#E5C17C] bg-white/[0.03]"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>👥 Bổ sung SĐT khách hiện có ({existingEditable.length})</span>
          </button>
        </div>

        {/* TAB BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-left">
          {/* TAB 1: GOOGLE CALENDAR */}
          {activeTab === "gcalendar" && (
            <div className="space-y-4">
              <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-4 text-xs text-zinc-300 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#E5C17C] flex items-center gap-1.5 text-sm">
                      <Calendar className="w-4 h-4" />
                      Quét toàn bộ lịch trình khách hàng từ Google Calendar:
                    </p>
                    <p className="text-zinc-400 mt-1">
                      Hệ thống tự động đọc lịch Google, tìm tên khách và bóc tách số điện thoại từ tiêu đề và nội dung sự kiện.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={calendarYearRange}
                      onChange={(e) => setCalendarYearRange(e.target.value as any)}
                      className="bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="all">Toàn bộ (2024 - 2027)</option>
                      <option value="2026">Chỉ năm 2026</option>
                      <option value="2025">Chỉ năm 2025</option>
                      <option value="2027">Chỉ năm 2027</option>
                    </select>

                    <button
                      type="button"
                      disabled={isLoadingCalendar}
                      onClick={handleFetchFromGoogleCalendar}
                      className="px-3.5 py-1.5 rounded-lg bg-[#2F6FED] hover:bg-[#1F4E79] text-white font-semibold flex items-center gap-1.5 cursor-pointer transition-colors text-xs disabled:opacity-50 shadow-md"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCalendar ? "animate-spin" : ""}`} />
                      <span>{isLoadingCalendar ? "Đang quét..." : "Quét Lịch Ngay"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-white/5 text-[11px] text-zinc-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideSchoolClasses}
                      onChange={(e) => setHideSchoolClasses(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 accent-[#E5C17C]"
                    />
                    <span>Tự động lọc bỏ các ca học/thời khóa biểu trường (chỉ giữ lại lịch chụp ảnh & khách hàng)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COPY & PASTE FROM EXCEL / SHEETS */}
          {activeTab === "paste" && (
            <div className="space-y-4">
              <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-3.5 text-xs text-zinc-300 space-y-2">
                <p className="font-semibold text-[#E5C17C] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Dán nhanh danh sách khách hàng cũ từ Excel hoặc Google Sheets:
                </p>
                <p>
                  Bạn hãy mở file Excel hoặc Google Sheet cũ của bạn, bôi đen các cột (Họ tên, SĐT, Ngày chụp, Gói...) rồi dán thẳng vào ô bên dưới. Hệ thống tự động phân tách cột:
                </p>
                <code className="block p-2 bg-black/50 rounded border border-white/5 text-[#E5C17C] font-mono text-[11px] select-all">
                  Nguyễn Văn An | 0987654321 | 2026-11-20 | Kỷ yếu | Hà Nội<br />
                  Chị Mai Anh | 0912345678 | 2026-10-25 | Tốt nghiệp | ĐH Kinh Tế<br />
                  Lớp 12A1 THPT Chu Văn An | 0905123456 | 2026-12-05 | Kỷ yếu
                </code>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Dán nội dung tại đây:
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => handlePasteChange(e.target.value)}
                  placeholder="Dán các hàng dữ liệu từ Excel / Google Sheets vào đây..."
                  rows={5}
                  className="w-full bg-zinc-900/90 border border-white/15 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-[#E5C17C]/60 transition-colors font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 3: EXISTING BOOKINGS MISSING PHONE */}
          {activeTab === "existing" && (
            <div className="space-y-4">
              <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-3.5 text-xs text-zinc-300 space-y-1.5">
                <p className="font-semibold text-[#E5C17C] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Bổ sung số điện thoại cho các lịch trình hiện có trong hệ thống:
                </p>
                <p>
                  Dưới đây là các đơn đặt lịch và lịch chụp hiện có trong hệ thống của bạn. Những khách hàng chưa có số điện thoại sẽ được đánh dấu cảnh báo màu vàng. Bạn có thể <strong>gõ trực tiếp số điện thoại vào ô input</strong> bên dưới rồi bấm nút Đẩy lên Sheet!
                </p>
              </div>
            </div>
          )}

          {/* TABLE OF PARSED / EDITABLE ROWS */}
          {currentList.length > 0 && (
            <div className="space-y-2 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-zinc-300">
                    <input
                      type="checkbox"
                      checked={currentList.length > 0 && currentList.every((r) => r.selected)}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="rounded bg-black/40 border-white/20 accent-[#E5C17C]"
                    />
                    <span>Chọn tất cả ({currentList.filter((r) => r.selected).length}/{currentList.length})</span>
                  </label>

                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {currentList.filter((r) => Boolean(r.phone)).length} có SĐT
                  </span>
                  {currentList.some((r) => !r.phone) && (
                    <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {currentList.filter((r) => !r.phone).length} chưa có SĐT
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-zinc-400 italic">
                  💡 Bạn có thể chỉnh sửa trực tiếp Họ tên & Số điện thoại ngay trên bảng trước khi đẩy
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto overscroll-contain border border-white/10 rounded-xl overflow-hidden bg-black/50">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#1F3A5F] text-white sticky top-0 font-semibold z-10">
                    <tr>
                      <th className="p-2 border-b border-white/10 w-8 text-center">✓</th>
                      <th className="p-2 border-b border-white/10 w-10">STT</th>
                      <th className="p-2 border-b border-white/10 min-w-[180px]">Họ và tên khách hàng</th>
                      <th className="p-2 border-b border-white/10 min-w-[140px]">Số điện thoại</th>
                      <th className="p-2 border-b border-white/10 w-28">Ngày chụp</th>
                      <th className="p-2 border-b border-white/10 w-24">Gói chụp</th>
                      <th className="p-2 border-b border-white/10 min-w-[140px]">Địa điểm / Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {currentList.map((row, idx) => {
                      const hasPhone = Boolean(row.phone);
                      return (
                        <tr
                          key={`row-${idx}`}
                          className={`transition-colors ${
                            row.selected ? "bg-white/[0.02]" : "opacity-40 bg-black/40"
                          } hover:bg-white/[0.05]`}
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => updateCurrentRow(idx, "selected", e.target.checked)}
                              className="rounded bg-black/40 border-white/20 accent-[#E5C17C] cursor-pointer"
                            />
                          </td>
                          <td className="p-2 text-zinc-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.fullName}
                              onChange={(e) => updateCurrentRow(idx, "fullName", e.target.value)}
                              placeholder="Họ và tên khách"
                              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-white font-semibold text-xs focus:outline-none focus:border-[#E5C17C]"
                            />
                          </td>
                          <td className="p-2">
                            <div className="relative">
                              <input
                                type="text"
                                value={row.phone}
                                onChange={(e) => updateCurrentRow(idx, "phone", e.target.value)}
                                placeholder="Gõ số điện thoại..."
                                className={`w-full bg-zinc-900 border rounded px-2 py-1 font-mono text-xs focus:outline-none ${
                                  hasPhone
                                    ? "border-emerald-500/40 text-[#E5C17C] font-semibold"
                                    : "border-amber-500/60 text-amber-200 placeholder:text-zinc-600 bg-amber-950/20"
                                }`}
                              />
                              {!hasPhone && (
                                <span className="absolute right-2 top-1.5 text-[9px] text-amber-400 font-semibold pointer-events-none">
                                  Thiếu SĐT
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.date}
                              onChange={(e) => updateCurrentRow(idx, "date", e.target.value)}
                              placeholder="YYYY-MM-DD"
                              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-zinc-300 font-mono text-xs focus:outline-none focus:border-[#E5C17C]"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={row.conceptType}
                              onChange={(e) => updateCurrentRow(idx, "conceptType", e.target.value as any)}
                              className="w-full bg-zinc-900 border border-white/10 rounded px-1.5 py-1 text-zinc-300 text-xs focus:outline-none cursor-pointer"
                            >
                              <option value="THPT">Kỷ yếu THPT</option>
                              <option value="University">Tốt nghiệp</option>
                              <option value="Event">Sự kiện</option>
                              <option value="Custom">Cá nhân</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.location || row.note}
                              onChange={(e) => updateCurrentRow(idx, "location", e.target.value)}
                              placeholder="Địa chỉ / Ghi chú..."
                              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-zinc-400 text-xs focus:outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentList.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-400 border border-dashed border-white/10 rounded-2xl p-6 bg-black/20">
              {activeTab === "gcalendar" ? (
                <>
                  <Calendar className="w-10 h-10 text-zinc-500 mb-2" />
                  <p className="font-semibold text-zinc-300">Chưa quét dữ liệu từ Google Calendar</p>
                  <p className="text-xs text-zinc-500 max-w-sm mt-1">
                    Bấm nút <strong>"Quét Lịch Ngay"</strong> ở góc trên để hệ thống tự động tải toàn bộ lịch chụp và số điện thoại khách hàng cũ của bạn.
                  </p>
                </>
              ) : activeTab === "paste" ? (
                <>
                  <Upload className="w-10 h-10 text-zinc-500 mb-2" />
                  <p className="font-semibold text-zinc-300">Chưa có dữ liệu dán</p>
                  <p className="text-xs text-zinc-500 max-w-sm mt-1">
                    Hãy copy các dòng từ file Excel hoặc Sheets của bạn rồi dán vào ô văn bản phía trên.
                  </p>
                </>
              ) : (
                <>
                  <User className="w-10 h-10 text-zinc-500 mb-2" />
                  <p className="font-semibold text-zinc-300">Không có lịch trình nào trong hệ thống</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center"
          >
            Đóng
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isProcessing || currentList.filter((r) => r.selected).length === 0}
              onClick={() =>
                handleSaveAndSync(
                  currentList,
                  activeTab === "gcalendar"
                    ? "google_calendar"
                    : activeTab === "paste"
                      ? "excel_paste"
                      : "existing_update"
                )
              }
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#B5945B] via-[#E5C17C] to-[#B5945B] hover:opacity-95 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-[#B5945B]/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
              <span>
                {isProcessing
                  ? "Đang lưu & đẩy lên Google Sheet..."
                  : `🚀 Lưu & Đẩy ${
                      currentList.filter((r) => r.selected).length > 0
                        ? `${currentList.filter((r) => r.selected).length} Khách`
                        : ""
                    } Lên Google Sheet (KH_Data)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
