import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { Booking } from "../../types";
import {
  PUBLIC_BOOKING_BASE_URL,
  getPublicBookingBaseUrl,
  containsUnauthorizedDomainKeywords,
  ensureValidPublicBookingUrl,
  generateQrDataUrl,
  generateBookingCode,
} from "../../utils/bookingQr";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Globe,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface BookingDiagnosticPanelProps {
  showToast?: (message: string, type: "success" | "error" | "info") => void;
  onRefreshData?: () => void;
}

export const BookingDiagnosticPanel: React.FC<BookingDiagnosticPanelProps> = ({
  showToast,
  onRefreshData,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStats, setMigrationStats] = useState<{
    total: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeBaseUrl = getPublicBookingBaseUrl();
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "N/A";

  const fetchRecentBookings = async () => {
    try {
      setLoading(true);
      // Lấy 5 booking gần nhất để kiểm tra cấu hình domain
      const snap = await getDocs(collection(db, "bookings"));
      const all: Booking[] = [];
      snap.forEach((d) => {
        all.push({ id: d.id, ...(d.data() as any) });
      });

      // Sắp xếp ưu tiên các booking có confirmationLink hoặc ngày gần nhất
      all.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return timeB - timeA;
      });

      setRecentBookings(all.slice(0, 5));
    } catch (err: any) {
      console.warn("Could not fetch diagnostic bookings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecentBookings();
    }
  }, [isOpen]);

  /**
   * Chạy tiện ích Migration một lần:
   * Quét toàn bộ collection 'bookings' tại Firestore,
   * kiểm tra 'confirmationLink' và 'qrCodeUrl',
   * nếu chứa domain không hợp lệ (như aistudio, localhost, ais-dev-),
   * hoặc thiếu mã/link thì cập nhật lại dựa trên PUBLIC_BOOKING_BASE_URL.
   */
  const handleRunMigration = async () => {
    try {
      setIsMigrating(true);
      if (showToast) showToast("Đang quét và chuẩn hóa toàn bộ booking trong Firestore...", "info");

      const snap = await getDocs(collection(db, "bookings"));
      let updatedCount = 0;
      let skippedCount = 0;

      for (const d of snap.docs) {
        const data = d.data();
        const id = d.id;
        let code = (data.bookingCode || "").trim();
        const existingLink = (data.confirmationLink || "").trim();
        const existingQr = (data.qrCodeUrl || "").trim();

        const isBad =
          !existingLink ||
          containsUnauthorizedDomainKeywords(existingLink) ||
          !existingLink.startsWith(activeBaseUrl);

        const needsQr = !existingQr || isBad;
        const needsCode = !code;

        if (isBad || needsQr || needsCode) {
          if (!code) {
            code = generateBookingCode();
          }

          const sanitizedLink = ensureValidPublicBookingUrl(
            `${activeBaseUrl}/booking/${code}`,
            code
          );
          const newQrDataUrl = await generateQrDataUrl(sanitizedLink, 1200);

          const updates: Record<string, any> = {
            bookingCode: code,
            confirmationLink: sanitizedLink,
            qrCodeUrl: newQrDataUrl,
          };

          if (!data.confirmationStatus) {
            updates.confirmationStatus = "link_created";
          }

          await updateDoc(doc(db, "bookings", id), updates);
          updatedCount++;
        } else {
          skippedCount++;
        }
      }

      setMigrationStats({
        total: snap.size,
        updated: updatedCount,
        skipped: skippedCount,
      });

      await fetchRecentBookings();
      if (onRefreshData) onRefreshData();

      if (showToast) {
        showToast(
          `Đã hoàn tất chuẩn hóa! Cập nhật: ${updatedCount} booking, Chuẩn sẵn: ${skippedCount}.`,
          "success"
        );
      }
    } catch (err: any) {
      console.error("Migration failed:", err);
      if (showToast) {
        showToast("Lỗi di chuyển: " + (err.message || String(err)), "error");
      }
    } finally {
      setIsMigrating(false);
    }
  };

  const copyText = (text: string, id: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      if (showToast) showToast("Đã sao chép đường dẫn!", "success");
    }
  };

  return (
    <div className="border border-white/10 rounded-2xl bg-zinc-950/80 backdrop-blur-md overflow-hidden transition-all shadow-xl mb-4">
      {/* Header Bar */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 bg-zinc-900/60 hover:bg-zinc-900/90 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#B5945B]/15 border border-[#B5945B]/30 flex items-center justify-center text-[#B5945B]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide uppercase font-sans">
                Chẩn Đoán Domain & QR Booking
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Chính thức
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate max-w-[260px] sm:max-w-md">
              Base URL: <span className="text-zinc-200 font-mono">{activeBaseUrl}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-[11px] hidden sm:inline">
            {isOpen ? "Thu gọn" : "Xem chi tiết"}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Body Content (Collapsible) */}
      {isOpen && (
        <div className="p-4 space-y-4 border-t border-white/5">
          {/* Status Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <Globe className="w-3.5 h-3.5 text-[#B5945B]" />
                <span>PUBLIC_BOOKING_BASE_URL (Đang áp dụng)</span>
              </div>
              <div className="text-xs font-mono font-medium text-amber-200 break-all select-all">
                {activeBaseUrl}
              </div>
              <p className="text-[10px] text-zinc-500">
                Domain này được gắn cố định vào mã QR và link xác nhận để mở trực tiếp trên điện thoại/4G.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Môi trường hiện tại (Current Origin)</span>
              </div>
              <div className="text-xs font-mono font-medium text-zinc-300 break-all">
                {currentOrigin}
              </div>
              <p className="text-[10px] text-zinc-500">
                Hệ thống tự động ngăn chặn dev origin rò rỉ vào mã QR của khách hàng.
              </p>
            </div>
          </div>

          {/* Action: One-Click Migration Utility */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#B5945B]/10 to-amber-500/5 border border-[#B5945B]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#B5945B]" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Tiện ích Chuẩn Hóa Domain Toàn Bộ Booking (1 Lần)
                </h4>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Quét toàn bộ collection bookings, thay thế các domain lỗi (aistudio, localhost, ais-dev-) bằng domain chuẩn và sinh lại QR code PNG chất lượng cao.
              </p>
            </div>

            <button
              type="button"
              disabled={isMigrating}
              onClick={handleRunMigration}
              className="px-3.5 py-2 rounded-lg bg-[#B5945B] hover:bg-[#c4a46a] text-black text-xs font-bold font-sans uppercase tracking-wide flex items-center gap-2 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isMigrating ? "animate-spin" : ""}`} />
              {isMigrating ? "Đang chuẩn hóa..." : "Quét & Sửa Toàn Bộ"}
            </button>
          </div>

          {migrationStats && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Kết quả: Đã cập nhật <strong>{migrationStats.updated}</strong> booking | Bỏ qua (đã chuẩn): <strong>{migrationStats.skipped}</strong> / Tổng số: <strong>{migrationStats.total}</strong>.
              </span>
            </div>
          )}

          {/* 5 Most Recent Booking Links */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                5 Booking Gần Nhất & Trạng Thái Link
              </h4>
              <button
                type="button"
                onClick={fetchRecentBookings}
                className="text-[11px] text-[#B5945B] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                Làm mới
              </button>
            </div>

            {loading ? (
              <div className="p-4 text-center text-xs text-zinc-500">Đang kiểm tra booking...</div>
            ) : recentBookings.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">Chưa có booking nào.</div>
            ) : (
              <div className="space-y-2">
                {recentBookings.map((b) => {
                  const link = b.confirmationLink || "";
                  const isUnauthorized = containsUnauthorizedDomainKeywords(link);
                  const isMatching = link.startsWith(activeBaseUrl);

                  return (
                    <div
                      key={b.id}
                      className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white font-mono">
                            {b.bookingCode || b.id}
                          </span>
                          <span className="text-zinc-400 truncate max-w-[150px]">
                            {b.schoolName}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            ({b.date || "Chưa có ngày"})
                          </span>

                          {/* Domain Status Badge */}
                          {isUnauthorized ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> Domain cấm (Lỗi)
                            </span>
                          ) : isMatching ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Hợp lệ (Public)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              Chưa chuẩn
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-mono text-zinc-400 truncate mt-1">
                          {link || "(Chưa có link xác nhận)"}
                        </div>
                      </div>

                      {link && (
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => copyText(link, b.id)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                            title="Sao chép link"
                          >
                            {copiedId === b.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                            title="Mở kiểm tra trang xác nhận"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
