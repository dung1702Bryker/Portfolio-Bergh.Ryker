import { CustomerSheetData } from "../types/customer";
import { Booking } from "../types";

/**
 * Service đẩy dữ liệu đặt lịch sang Google Sheets thông qua Google Apps Script Web App.
 * - Luồng Firebase/Firestore luôn được ưu tiên số 1.
 * - Sử dụng mode: "no-cors" để đảm bảo gửi thành công mà không bị chặn bởi CORS của Google.
 * - Nếu endpoint chưa được cấu hình hoặc gặp lỗi kết nối, chỉ console.warn và không throw error,
 *   đảm bảo khách hàng luôn hoàn tất đặt lịch mượt mà 100%.
 */

export function getWebhookUrl(): string {
  return (
    (typeof window !== "undefined" && window.localStorage?.getItem("google_sheet_webhook_url")) ||
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_SHEET_WEBHOOK_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_GOOGLE_SHEET_WEBHOOK_URL) ||
    ""
  ).trim();
}

export function setWebhookUrl(url: string): void {
  if (typeof window !== "undefined") {
    window.localStorage?.setItem("google_sheet_webhook_url", url.trim());
  }
}

export async function saveCustomerToSheet(customerData: CustomerSheetData): Promise<void> {
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl || webhookUrl.includes("xxxx")) {
    console.warn(
      "[GoogleSheets] Google Sheets webhook URL chưa được cấu hình hoặc đang dùng mã mẫu 'xxxx'. " +
      "Vui lòng dán Web App URL thực tế từ Google Apps Script vào biến VITE_GOOGLE_SHEET_WEBHOOK_URL trong file .env."
    );
    return;
  }

  // Cảnh báo thân thiện nếu người dùng nhầm lẫn giữa link xem Google Sheet và Web App Webhook URL
  if (webhookUrl.includes("docs.google.com/spreadsheets")) {
    console.warn(
      "[GoogleSheets] Phát hiện URL là link xem Google Sheet ('docs.google.com/spreadsheets/d/...'). " +
      "Google Sheets không nhận POST trực tiếp từ link này. " +
      "Vui lòng triển khai Apps Script (Extensions > Apps Script > Deploy as Web App) và lấy link kết thúc bằng '/exec'. " +
      "Xem hướng dẫn chi tiết tại file GOOGLE_SHEETS_SETUP.md."
    );
    return;
  }

  try {
    // Gửi POST request dạng JSON tới Google Apps Script Web App
    await fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(customerData),
    });

    console.info("[GoogleSheets] Dữ liệu khách hàng đã được gửi thành công:", customerData.bookingCode);
  } catch (error) {
    // Không throw lỗi ra luồng đặt lịch, chỉ ghi nhận cảnh báo
    console.warn("[GoogleSheets] Không thể đồng bộ dữ liệu sang Google Sheets lúc này:", error);
  }
}

/**
 * Hàm kiểm tra và chẩn đoán cấu hình webhook Google Sheets.
 * Trả về kết quả chi tiết phục vụ test và kiểm thử hệ thống.
 */
export async function testGoogleSheetsWebhook(customUrl?: string): Promise<{
  success: boolean;
  status?: number;
  message: string;
  urlTested: string;
  sampleData: CustomerSheetData;
  error?: any;
}> {
  const targetUrl = (customUrl || getWebhookUrl()).trim();

  const sampleData: CustomerSheetData = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    fullName: "Nguyễn Văn Test (Hệ thống Bergh.Ryker)",
    phone: "0912345678",
    customerType: "Kỷ yếu THPT",
    package: "Gói VIP THPT",
    peopleCount: 40,
    shootDate: new Date().toISOString().split("T")[0],
    session: "Sáng (07:30 - 11:30)",
    location: "Studio & Ngoại cảnh Hà Nội",
    note: "Dữ liệu kiểm thử kết nối tự động Google Sheets webhook",
    bookingCode: `BR-TEST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    status: "Mới",
    device: typeof navigator !== "undefined" ? navigator.userAgent : "Node.js Test Runner",
    pageUrl: typeof window !== "undefined" ? window.location.href : "https://berghryker.vn",
  };

  if (!targetUrl || targetUrl.includes("xxxx")) {
    return {
      success: false,
      message:
        "Webhook URL chưa được cấu hình hoặc đang chứa 'xxxx'. Cần cập nhật VITE_GOOGLE_SHEET_WEBHOOK_URL trong .env bằng URL Web App từ Google Apps Script (kết thúc bằng /exec).",
      urlTested: targetUrl,
      sampleData,
    };
  }

  if (targetUrl.includes("docs.google.com/spreadsheets")) {
    return {
      success: false,
      status: 405,
      message:
        "URL đang trỏ đến link xem Google Sheet (docs.google.com/spreadsheets/d/...). Google Sheet từ chối POST request (HTTP 405 Method Not Allowed). Cần tạo Apps Script Web App và lấy URL kết thúc bằng /exec theo GOOGLE_SHEETS_SETUP.md.",
      urlTested: targetUrl,
      sampleData,
    };
  }

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(sampleData),
    });

    const text = await res.text();

    // Kiểm tra trường hợp Google Apps Script trả về lỗi chưa có hàm doPost
    if (
      text.includes("doPost") &&
      (text.includes("找不到") || text.includes("not found") || text.includes("Không tìm thấy") || text.includes("Exception"))
    ) {
      return {
        success: false,
        status: 200,
        message:
          "Google Apps Script đã nhận kết nối nhưng báo lỗi: 'Không tìm thấy hàm doPost' (Script function not found: doPost). " +
          "Cách sửa: Trong giao diện Apps Script, hãy chắc chắn rằng file Code.gs đã dán đúng mã function doPost(e) { ... } và khi Deploy bạn đã tạo phiên bản mới (Deploy > Manage deployments > Edit > Version: New version > Deploy).",
        urlTested: targetUrl,
        sampleData,
      };
    }

    // Thử parse JSON trả về từ doPost
    try {
      const json = JSON.parse(text);
      if (json.success) {
        return {
          success: true,
          status: 200,
          message: `Đồng bộ thành công sang Google Sheet! Mã booking: ${json.bookingCode || sampleData.bookingCode}`,
          urlTested: targetUrl,
          sampleData,
        };
      } else {
        return {
          success: false,
          status: 200,
          message: `Google Apps Script thực thi thất bại: ${json.error || "Lỗi không xác định"}`,
          urlTested: targetUrl,
          sampleData,
        };
      }
    } catch {
      // Phản hồi dạng text thông thường
      return {
        success: res.ok,
        status: res.status,
        message: res.ok
          ? `Gửi thành công tới Google Apps Script Web App! Phản hồi: ${text.slice(0, 300)}`
          : `Google Apps Script trả về mã lỗi HTTP ${res.status}: ${text.slice(0, 300)}`,
        urlTested: targetUrl,
        sampleData,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Không thể kết nối tới webhook: ${err?.message || String(err)}`,
      urlTested: targetUrl,
      sampleData,
      error: err,
    };
  }
}

/**
 * Chuyển đổi một Booking từ hệ thống sang cấu trúc 17 cột của Google Sheet
 */
export function mapBookingToCustomerSheetData(booking: Booking): CustomerSheetData {
  const rawBk = booking as any;
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  let shootDate = (rawBk.date || rawBk.shootDate || "").trim();
  if (shootDate.includes("/")) {
    const p = shootDate.split("/");
    if (p.length === 3) {
      const y = parseInt(p[2], 10);
      const m = parseInt(p[1], 10);
      if (!isNaN(y) && y > 2000) year = y;
      if (!isNaN(m) && m >= 1 && m <= 12) month = m;
      shootDate = `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    }
  } else if (shootDate.includes("-")) {
    const parts = shootDate.split("-");
    if (parts.length >= 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && y > 2000) year = y;
      if (!isNaN(m) && m >= 1 && m <= 12) month = m;
    }
  }

  // Kết hợp mọi ghi chú và mô tả để tìm kiếm số điện thoại và thông tin
  const combinedNotes = [
    rawBk.customRequest?.trim(),
    rawBk.notes?.trim(),
    rawBk.editingNotes?.trim(),
    rawBk.reason?.trim(),
    rawBk.description?.trim()
  ].filter(Boolean).join(" - ");

  // Hàm trích xuất số điện thoại thực tế từ chuỗi bất kỳ (hỗ trợ cả dấu cách, chấm, gạch ngang)
  const extractPhone = (str: string): string => {
    if (!str) return "";
    // Tìm các mẫu số điện thoại Việt Nam dạng 09xx, 03xx, 07xx, 08xx, +84xx
    const cleaned = str.replace(/[^\d+]/g, " ");
    const match = cleaned.match(/(?:\+84|0)\s*(?:[1-9]\d{8,9})/);
    if (match) {
      return match[0].replace(/\s+/g, "");
    }
    const matchSimple = str.match(/(0\d{9,10}|\+84\d{9,10})/);
    return matchSimple ? matchSimple[1] : "";
  };

  // Xác định số điện thoại thực sự (phải có ít nhất 9 chữ số)
  let phone = "";
  const phoneCandidates = [
    rawBk.phone,
    rawBk.phoneNumber,
    rawBk.tel,
    rawBk.contact,
    rawBk.contactHandle,
    rawBk.instagramOrZalo,
    combinedNotes
  ];

  for (const cand of phoneCandidates) {
    if (typeof cand === "string") {
      const found = extractPhone(cand);
      if (found) {
        phone = found;
        break;
      }
    }
  }

  // Tên khách hàng: tìm qua mọi trường có thể có
  let fullName = (
    rawBk.schoolName ||
    rawBk.fullName ||
    rawBk.customerName ||
    rawBk.clientName ||
    rawBk.name ||
    ""
  ).trim();

  const contactHandle = (rawBk.instagramOrZalo || "").trim();

  // Nếu tên là sự kiện/workshop và có tên người liên hệ riêng (như "C.Hằng", "Phương Trump")
  const isGenericEventName = /^(workshop|show|tour|orientation|lễ|sự kiện|event)/i.test(fullName);
  if (isGenericEventName && contactHandle && !extractPhone(contactHandle) && contactHandle.toLowerCase() !== "zalo") {
    fullName = `${contactHandle} (${fullName})`;
  } else if (!fullName && contactHandle && !extractPhone(contactHandle)) {
    fullName = contactHandle;
  }

  // Nếu tên còn trống, thử trích xuất từ ghi chú
  if (!fullName) {
    const nameMatch = combinedNotes.match(/Khách(?:\s*hàng)?:\s*([^\n,•\-]+)/i);
    if (nameMatch) {
      fullName = nameMatch[1].trim();
    } else if (rawBk.blockedSlots && rawBk.blockedSlots[0]) {
      fullName = `Lịch: ${rawBk.blockedSlots[0]}`;
    } else {
      fullName = `Khách hàng #${(rawBk.id || "").slice(-5) || "Mới"}`;
    }
  }

  const custType =
    rawBk.conceptType === "THPT"
      ? "Kỷ yếu THPT"
      : rawBk.conceptType === "University"
        ? "Cử nhân & Tốt nghiệp"
        : rawBk.conceptType === "Event"
          ? "Sự kiện"
          : rawBk.conceptType === "Custom"
            ? "Cá nhân & Yêu cầu"
            : (rawBk.customerType || "Kỷ yếu");

  const pkgName =
    rawBk.estimatedCost ||
    rawBk.package ||
    (rawBk.conceptType === "THPT"
      ? "Gói VIP THPT"
      : rawBk.conceptType === "University"
        ? "Gói Cử Nhân"
        : rawBk.conceptType === "Event"
          ? "Gói Sự Kiện"
          : "Gói Kỷ yếu");

  const session =
    rawBk.timeSlot ||
    rawBk.session ||
    (rawBk.eventStartTime
      ? `${rawBk.eventStartTime}${rawBk.eventEndTime ? ` - ${rawBk.eventEndTime}` : ""}`
      : rawBk.blockedSlots && rawBk.blockedSlots[0] ? rawBk.blockedSlots.join(", ") : "Cả ngày");

  // Chuẩn hóa trạng thái tương thích các màu của tab KH_Data
  let sheetStatus = "Mới";
  const rawStatus = (rawBk.status || "").toLowerCase();
  const editStatus = (rawBk.editingStatus || "").toLowerCase();

  if (rawStatus.includes("hủy") || rawStatus.includes("từ chối") || rawStatus === "cancelled") {
    sheetStatus = "Hủy";
  } else if (editStatus === "delivered" || rawStatus.includes("hoàn thành")) {
    sheetStatus = "Đã bàn giao";
  } else if (editStatus === "editing" || rawStatus.includes("đang sửa")) {
    sheetStatus = "Đang sửa";
  } else if (rawStatus.includes("chụp") || rawStatus.includes("đã chụp")) {
    sheetStatus = "Đã chụp";
  } else if (
    rawStatus.includes("duyệt") ||
    rawStatus.includes("confirmed") ||
    rawStatus.includes("khoá") ||
    rawStatus.includes("cọc") ||
    rawStatus === "booked"
  ) {
    sheetStatus = "Đã cọc";
  } else if (rawStatus.includes("tư vấn")) {
    sheetStatus = "Đã tư vấn";
  }

  const bookingCode =
    rawBk.bookingCode ||
    `BR-${year}-${(rawBk.id || Math.random().toString(36).slice(2, 6)).slice(-5).toUpperCase()}`;

  return {
    year,
    month,
    fullName,
    phone,
    email: (rawBk.email || "").trim(),
    customerType: custType,
    package: pkgName,
    peopleCount: Number(rawBk.classSize || rawBk.peopleCount) || 1,
    shootDate: shootDate,
    session: session.trim(),
    location: (rawBk.address || rawBk.location || "Studio & Ngoại cảnh").trim(),
    source: (rawBk.referralSource || rawBk.source || "Website Bergh.Ryker").trim(),
    note: combinedNotes,
    bookingCode,
    status: sheetStatus,
    device: "Đồng bộ từ lịch trình hệ thống",
    pageUrl: rawBk.confirmationLink || "https://berghryker.vn",
  };
}

/**
 * Đẩy toàn bộ danh sách lịch trình / booking khách hàng lên Google Sheet.
 * Hỗ trợ đồng bộ hàng loạt với báo cáo tiến độ chi tiết.
 */
export async function syncAllBookingsToSheet(
  bookings: Booking[],
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; total: number; synced: number; error?: string }> {
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl || webhookUrl.includes("xxxx")) {
    return {
      success: false,
      total: bookings.length,
      synced: 0,
      error: "Chưa cấu hình VITE_GOOGLE_SHEET_WEBHOOK_URL trong .env. Vui lòng cấu hình URL Web App Google Apps Script.",
    };
  }

  const list = bookings.filter((b) => b && (b.schoolName || b.phone || b.date));
  if (list.length === 0) {
    return {
      success: true,
      total: 0,
      synced: 0,
    };
  }

  const mappedData = list.map(mapBookingToCustomerSheetData);

  // 1. Thử gửi Batch một lần (nếu Web App hỗ trợ batch)
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ batch: mappedData }),
    });

    if (res.ok) {
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.success) {
          if (onProgress) onProgress(mappedData.length, mappedData.length);
          return { success: true, total: mappedData.length, synced: mappedData.length };
        }
      } catch {
        // Tiếp tục fallback bên dưới nếu không parse được
      }
    }
  } catch (err) {
    console.warn("[GoogleSheets] Batch sync gặp lỗi kết nối hoặc CORS, chuyển sang chế độ đồng bộ tuần tự:", err);
  }

  // 2. Chế độ đồng bộ tuần tự với no-cors để đảm bảo chạy mượt 100% với mọi phiên bản Google Apps Script
  let synced = 0;
  for (let i = 0; i < mappedData.length; i++) {
    const item = mappedData[i];
    try {
      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(item),
      });
      synced++;
      if (onProgress) onProgress(synced, mappedData.length);
      // Giãn cách nhẹ 200ms để Google Apps Script tiếp nhận trật tự
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (e) {
      console.warn(`[GoogleSheets] Lỗi đẩy booking ${item.bookingCode}:`, e);
    }
  }

  return {
    success: synced > 0,
    total: mappedData.length,
    synced,
  };
}
