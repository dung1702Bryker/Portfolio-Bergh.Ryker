export interface ImageResolutions {
  thumbnail?: string;
  medium?: string;
  original?: string;
}

export interface ImageAsset {
  src: string;
  alt: string;
  type: string;
  objectPosition?: string;
  resolutions?: ImageResolutions;
  thumbnail?: string;
  medium?: string;
  original?: string;
}

export interface MetricItem {
  value: string;
  label: string;
  sub: string;
}

export interface WorkflowStep {
  step: string;
  title: string;
  desc: string;
}

export interface SlideSEO {
  title?: string;
  description?: string;
  keywords?: string;
}

export interface SlideCtaConfig {
  text?: string;
  target?: string;
}

export interface SlideData {
  id: string;
  layout: string;
  title: string;
  subtitle: string;
  body: string;
  highlights: string[];
  images: ImageAsset[];
  metrics?: MetricItem[];
  steps?: WorkflowStep[];
  seo?: SlideSEO;
  primaryCta?: SlideCtaConfig;
  secondaryCta?: SlideCtaConfig;
}

export interface Testimonial {
  id: string;
  content: string;
  author: string;
  role: string;
  status: "Chờ duyệt" | "Đã duyệt";
  createdAt: string;
  schoolName?: string;
  rating?: number;
  bookingId?: string;
}

export type PhotoEditingStatus = "pending" | "shooting_done" | "editing" | "reviewing" | "completed";

export interface Booking {
  id: string;
  bookingCode?: string; // Mã booking duy nhất dạng BR-YYYY-XXXX (ví dụ: BR-2026-0158)
  schoolName: string;
  classSize: number;
  date: string;
  timeSlot?: string;
  eventStartTime?: string; // e.g. "17:00"
  eventEndTime?: string; // e.g. "22:00"
  conceptType: "THPT" | "University" | "Event" | "Custom";
  instagramOrZalo: string;
  phone?: string;
  email?: string; // Giữ lại cho dữ liệu cũ (không sử dụng để gửi xác nhận)
  address?: string;
  notes?: string;
  customRequest?: string;
  status: "Chờ duyệt" | "Đã duyệt" | "Từ chối" | "Đã khoá lịch" | "Đang xử lý" | "Đã hoàn thành" | "confirmed" | "Đã xác nhận" | "Đã hủy";
  createdAt: any;
  confirmedAt?: any; // Thời điểm xác nhận
  confirmationLink?: string; // Đường dẫn xác nhận công khai /booking/[bookingCode]
  qrCodeUrl?: string; // QR code data URL (PNG)
  googleEventId?: string;
  googleTaskId?: string;
  source?: string;
  referralSource?: string;
  confirmationStatus?: "not_sent" | "link_created" | "viewed";
  hasConfirmedPayment?: boolean;
  amountPaid?: number;
  estimatedCost?: string;
  // Photo editing & deliverable progress
  editingStatus?: PhotoEditingStatus;
  editingProgress?: number; // 0 to 100
  rawPhotosUrl?: string; // Link file ảnh gốc preview
  finalPhotosUrl?: string; // Link tải toàn bộ ảnh đã hoàn thiện
  editingNotes?: string; // Lời nhắn tiến độ / ghi chú
  estimatedDeliveryDate?: string; // Ngày hẹn bàn giao ảnh
  editingUpdatedAt?: any; // Thời điểm cập nhật tiến độ
}

export interface SiteActivity {
  id: string;
  type: "booking_new" | "booking_status" | "chat_message" | "review_new" | "slot_update" | "system";
  title: string;
  description: string;
  timestamp: string | number;
  actor?: string;
  metadata?: Record<string, any>;
}

export interface EmailLog {
  id: string;
  recipient: string;
  subject: string;
  status: "success" | "failed";
  timestamp: string | number;
  error?: string;
  bookingId?: string;
}
