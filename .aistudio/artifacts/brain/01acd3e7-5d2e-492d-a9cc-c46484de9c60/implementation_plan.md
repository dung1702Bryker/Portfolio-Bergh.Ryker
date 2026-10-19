# Kế Hoạch Giai Đoạn 1: Dọn Sạch Toàn Bộ Email Xác Nhận

Dọn sạch triệt để mọi thành phần UI, backend logic, template, trạng thái và API liên quan đến việc gửi email xác nhận đặt lịch cho khách hàng trên toàn bộ hệ thống Bergh.Ryker, chuẩn bị nền tảng an toàn cho Giai đoạn 2 (Mã QR xác nhận).

## User Review & Critical Decisions

> [!IMPORTANT]
> **Nguyên tắc an toàn dữ liệu:**
> - **Không xóa dữ liệu email cũ trong Firestore**: Các booking cũ có chứa trường `email` hoặc `customerEmail` sẽ được giữ nguyên vẹn trong cơ sở dữ liệu.
> - **Ẩn trường email khỏi UI**: Form đặt lịch phía khách hàng sẽ không còn ô nhập email; form và card quản trị sẽ loại bỏ hiển thị email và các thao tác gửi thư.
> - **Chuyển đổi trạng thái trung lập**: Trường `emailSent` sẽ được thay thế bằng `confirmationStatus` với các giá trị trung lập (`"not_sent"`, `"link_created"`, `"viewed"`), hoàn toàn không chứa từ khóa "email".

---

## 1. Tổng Hợp Các Vị Trí Cần Xử Lý Trong Toàn Bộ Codebase

### A. Giao diện (UI)
1. **Form đặt lịch khách hàng (`src/components/BookingContactForm.tsx`)**:
   - Ô nhập email khách hàng (`<input type="email" placeholder="email@example.com" ...>`) và nhãn biểu tượng Mail (dòng ~2635-2651).
   - Khung thông báo gửi email xác nhận sau khi tạo đơn hoặc thanh toán thành công (dòng ~2780-2809: *"Đã tự động gửi Gmail xác nhận đặt lịch..."*).
   - Banner *"Cổng Đồng Bộ Quản Trị Viên (Email Phê Duyệt)"* (dòng ~2183) đổi tên thành *"Cổng Đồng Bộ Quản Trị Viên"*.
2. **Bảng điều khiển quản trị (`src/components/AdminDashboard.tsx`)**:
   - Tab điều hướng `"GMAIL"` / `"email_config"` (dòng ~143-152) và component render `<EmailNotificationConfig />` (dòng ~156).
   - Kiểm tra các thẻ booking card để đảm bảo không hiển thị nút hoặc trạng thái liên quan đến email.
3. **Màn hình cấu hình email (`src/components/admin/EmailNotificationConfig.tsx`)**:
   - Toàn bộ giao diện cấu hình SMTP/Gmail App Password, nút "Gửi Thử Thư Xác Nhận Khách Hàng", và test mail sẽ được gỡ khỏi menu quản trị.

### B. Logic & Backend
1. **Frontend Dispatch Logic (`src/components/BookingContactForm.tsx`)**:
   - Logic gọi `fetch("/api/send-email")` khi submit booking mới (dòng ~1549-1608).
   - Logic gọi `fetch("/api/send-email")` khi admin bấm duyệt đơn (dòng ~799-827).
   - Logic tự động gửi email xác nhận khi SePay báo nộp cọc thành công (dòng ~1948-1992 và dòng ~2076-2119).
2. **Server & Endpoints (`server.ts`)**:
   - Hàm `generateCustomerConfirmationHtml()` (dòng ~2419-2591) tạo template HTML thư gửi khách.
   - Các nhánh gửi email cho khách qua Gmail OAuth API và Nodemailer SMTP trong `sendAdminNotification()` (dòng ~2728-2756, dòng ~2794-2819).
   - Endpoint `/api/send-email`, `/api/test-email`, `/api/test-customer-email` (dòng ~3112-3170).
   - Webhook SePay (dòng ~3011-3062) gọi gửi email xác nhận và gán `emailSent: true`.
   - Các import thừa: `nodemailer`, `nodemailer/lib/mail-composer`.
3. **Firebase Cloud Functions (`functions/src/index.ts`)**:
   - Hàm `notifyAdminOnNewChatbotBooking` và `handleNewChatbotBooking` đẩy task vào collection `emailTasks` (dòng ~11-93).
4. **Google Workspace OAuth Scopes (`src/firebase.ts`)**:
   - Quyền gửi Gmail `provider.addScope('https://www.googleapis.com/auth/gmail.send')` (dòng 65). Giữ nguyên các quyền cần thiết khác cho Lịch & Drive (`calendar`, `calendar.events`, `tasks`, `drive`).

### C. Dữ liệu & Database Schema
1. **Model Types (`src/types.ts`)**:
   - `Booking.emailSent?: boolean` -> thay thế bằng `confirmationStatus?: "not_sent" | "link_created" | "viewed"`.
   - `Booking.email?: string` giữ lại ở dạng optional để tương thích ngược dữ liệu cũ.
2. **Firestore Blueprint & Rules (`firebase-blueprint.json`, `firestore.rules`)**:
   - Bổ sung `confirmationStatus` vào schema Booking. Loại bỏ các tham chiếu đến trạng thái email cũ.

---

## 2. Kế Hoạch Triển Khai Chi Tiết Từng Bước (Zero-Downtime)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   GIAI ĐOẠN 1: DỌN SẠCH EMAIL                          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   [BƯỚC 1: BACKEND]         [BƯỚC 2: CLIENT LOGIC]    [BƯỚC 3: UI & GIAO DIỆN]
   - Vô hiệu hóa email       - Xóa fetch send-email    - Ẩn input email ở Form
     trong SePay webhook       khi tạo/duyệt đơn       - Gỡ tab GMAIL ở Admin
   - Bỏ template HTML khách  - Cập nhật trạng thái     - Xóa các banner/thông
   - Bỏ /api/test-customer     sang confirmationStatus   báo Gmail xác nhận
   - Gỡ scope gmail.send                               - Chuẩn hóa text hiển thị
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   │
                                   ▼
                       [BƯỚC 4: SCHEMA & TYPES]
                       - types.ts: confirmationStatus
                       - Giữ an toàn dữ liệu cũ
                                   │
                                   ▼
                       [BƯỚC 5: KIỂM THỬ TOÀN DIỆN]
                       - Test Tạo booking mới
                       - Test Duyệt booking
                       - Test Hủy/Xóa booking
                       - Build & Lint check (0 errors)
```

### Bước 1: Vô hiệu hóa Backend & Endpoint gửi email (`server.ts`, `functions/src/index.ts`, `src/firebase.ts`)
1. Trong `server.ts`:
   - Xóa hàm sinh HTML thư xác nhận khách hàng `generateCustomerConfirmationHtml`.
   - Trong `sendAdminNotification`: loại bỏ nhánh gửi thư khách hàng (`customerDelivered`, `sendViaGmailApi` tới `customerEmail`, `transporter.sendMail` tới `customerEmail`).
   - Trong SePay webhook: xóa lời gọi gửi mail xác nhận, thay thế `emailSent: true` bằng `confirmationStatus: "not_sent"`.
   - Vô hiệu hóa endpoint `/api/test-customer-email` và dọn `/api/send-email` không nhận payload email khách.
   - Gỡ bỏ import `nodemailer` và `MailComposer`.
2. Trong `src/firebase.ts`:
   - Gỡ bỏ scope `https://www.googleapis.com/auth/gmail.send`.
3. Trong `functions/src/index.ts`:
   - Vô hiệu hóa trigger `notifyAdminOnNewChatbotBooking` gửi vào `emailTasks`.

### Bước 2: Cập nhật Kiểu Dữ Liệu & Schema (`src/types.ts`, `firebase-blueprint.json`)
1. Cập nhật `src/types.ts`:
   - Thêm `confirmationStatus?: "not_sent" | "link_created" | "viewed";`
   - Loại bỏ `emailSent?: boolean;`
   - Giữ nguyên `email?: string;` dưới dạng ghi chú dữ liệu cũ.
2. Cập nhật `firebase-blueprint.json`: Thêm trường `confirmationStatus` cho entity `Booking`.

### Bước 3: Dọn sạch Logic & Giao diện Form Booking (`src/components/BookingContactForm.tsx`)
1. Xóa state `customerEmail` và ô input nhập email tại form đặt lịch.
2. Loại bỏ các lời gọi `fetch("/api/send-email", ...)` khi khách gửi đơn và khi admin duyệt đơn.
3. Trong logic xử lý SePay client-side: cập nhật trạng thái đơn thành `confirmationStatus: "not_sent"` thay cho `emailSent: true`.
4. Gỡ bỏ khối hiển thị thông báo đã gửi/sẽ gửi Gmail xác nhận cho khách hàng (`submittedData?.customerEmail`).
5. Đổi tên thông báo quản trị thành `"Cổng Đồng Bộ Quản Trị Viên"`.

### Bước 4: Dọn sạch Giao diện Bảng Quản Trị (`src/components/AdminDashboard.tsx`)
1. Xóa tab `"GMAIL"` khỏi danh sách tab quản trị (chỉ giữ LỊCH TRÌNH, TIN NHẮN, CA LÀM, SLOT).
2. Xóa import và khối hiển thị `<EmailNotificationConfig />`.
3. Kiểm tra booking card list: đảm bảo thông tin liên hệ và trạng thái hiển thị chuẩn, không phụ thuộc vào email.

### Bước 5: Kiểm tra và Đánh giá (Verification)
1. Chạy `compile_applet` và `lint_applet` để xác nhận không còn lỗi cú pháp hay import thừa.
2. Kiểm tra các luồng nghiệp vụ:
   - Tạo booking mới trên form -> lưu Firestore thành công, không gửi email, không có lỗi mạng.
   - Admin duyệt booking -> đổi trạng thái thành công, đồng bộ Google Calendar/Tasks bình thường.
   - Admin hủy/từ chối booking -> hoạt động chính xác.
   - Dữ liệu booking cũ trong Firestore vẫn nguyên vẹn.

---

## 3. Báo Cáo Sau Khi Thực Hiện
Sau khi thực hiện Giai đoạn 1, hệ thống sẽ báo cáo chi tiết các tệp đã chỉnh sửa, danh sách hàm/trường bị xóa, và chờ người dùng xác nhận "Hoàn thành Giai đoạn 1" trước khi chuyển sang triển khai Giai đoạn 2 (Mã QR xác nhận đặt lịch).
