import React, { useState, useEffect } from "react";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Search,
  Filter,
  Copy,
  Clock,
  ExternalLink,
  ShieldAlert,
  Inbox,
  User,
  ArrowRight
} from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../../firebase";
import { EmailLog } from "../../types";
import { useToast } from "../../hooks/useToast";

export const EmailLogsManager: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "failed" | "success" | "customer">("all");
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  // Load email logs via realtime onSnapshot with fallback to API
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    const fetchViaApi = async () => {
      try {
        const res = await fetch("/api/email-logs");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.logs) && isMounted) {
            setLogs(data.logs);
          }
        }
      } catch (e) {
        console.warn("[EmailLogs] API fetch fallback error:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    try {
      if (db) {
        const q = query(collection(db, "email_logs"), orderBy("createdAt", "desc"), limit(100));
        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const list: EmailLog[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...docSnap.data() } as EmailLog);
            });
            if (isMounted) {
              setLogs(list);
              setLoading(false);
            }
          },
          (err) => {
            console.warn("[EmailLogs] Realtime listener error, switching to API:", err);
            fetchViaApi();
          }
        );
      } else {
        fetchViaApi();
      }
    } catch (_) {
      fetchViaApi();
    }

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/email-logs");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          setLogs(data.logs);
          showToast("Đã làm mới nhật ký email thành công!", "info");
        }
      }
    } catch (err: any) {
      showToast("Lỗi làm mới: " + (err.message || err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async (log: EmailLog) => {
    if (!log.recipient || !log.recipient.includes("@")) {
      showToast("Địa chỉ email người nhận không hợp lệ!", "warning");
      return;
    }

    try {
      setResendingId(log.id);
      const res = await fetch("/api/email-logs/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: log.id,
          bookingId: log.bookingId || "",
          recipient: log.recipient,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`Đã gửi lại thành công thư xác nhận tới: ${log.recipient}!`, "success");
        // Optimistically update or re-fetch
        handleRefresh();
      } else {
        showToast("Lỗi gửi lại thư: " + (data.error || "Không thể gửi thư"), "error");
      }
    } catch (err: any) {
      showToast("Lỗi mạng khi gửi lại thư: " + (err.message || err), "error");
    } finally {
      setResendingId(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      showToast(`Đã sao chép ${label}!`, "info");
    } catch (_) {}
  };

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    // Search match
    const s = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      l.recipient?.toLowerCase().includes(s) ||
      l.bookingId?.toLowerCase().includes(s) ||
      l.subject?.toLowerCase().includes(s) ||
      l.clientName?.toLowerCase().includes(s);

    if (!matchSearch) return false;

    // Status filter
    if (filterStatus === "failed") return l.status === "failed";
    if (filterStatus === "success") return l.status === "success";
    if (filterStatus === "customer") {
      return (
        l.type === "customer_confirmation" ||
        l.type === "customer_approval" ||
        l.type === "manual_resend"
      );
    }
    return true;
  });

  // Calculate statistics
  const totalCount = logs.length;
  const successCount = logs.filter((l) => l.status === "success").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;

  const formatLogTime = (dateStr?: string) => {
    if (!dateStr) return "--:--";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (_) {
      return dateStr;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "customer_confirmation":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium">Khách Hàng (Đặt Lịch)</span>;
      case "customer_approval":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">Khách Hàng (Duyệt/Cọc)</span>;
      case "manual_resend":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">Gửi Lại Thủ Công</span>;
      case "admin_alert":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium">Báo Cáo Admin</span>;
      case "diagnostic_test":
        return <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-500/15 text-zinc-300 border border-zinc-500/30 font-medium">Kiểm Tra Kỹ Thuật</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-white font-medium">{type}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-zinc-400 text-xs font-semibold flex items-center justify-between">
            <span>Tổng Email Phát Đi</span>
            <Mail className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl font-bold text-white mt-2 font-mono">{totalCount}</div>
          <p className="text-[10px] text-zinc-400 mt-1">Lịch sử toàn bộ lượt gửi</p>
        </div>

        <div className="bg-zinc-900/60 border border-emerald-500/10 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-emerald-400 text-xs font-semibold flex items-center justify-between">
            <span>Đã Gửi Thành Công</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-300 mt-2 font-mono">{successCount}</div>
          <p className="text-[10px] text-zinc-400 mt-1">Máy chủ Google xác nhận 250 OK</p>
        </div>

        <div className="bg-zinc-900/60 border border-red-500/10 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-red-400 text-xs font-semibold flex items-center justify-between">
            <span>Thất Bại (Cần Gửi Lại)</span>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-xl font-bold text-red-300 mt-2 font-mono">{failedCount}</div>
          <p className="text-[10px] text-zinc-400 mt-1">Có thể bấm "Gửi Lại" tức thì</p>
        </div>

        <div className="bg-zinc-900/60 border border-[#B5945B]/20 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[#E5C17C] text-xs font-semibold flex items-center justify-between">
            <span>Tỷ Lệ Chuyển Giao</span>
            <ShieldAlert className="w-4 h-4 text-[#B5945B]" />
          </div>
          <div className="text-xl font-bold text-[#E5C17C] mt-2 font-mono">{successRate}%</div>
          <p className="text-[10px] text-zinc-400 mt-1">Hệ thống Gmail SMTP bảo mật</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo email người nhận, mã ticket đơn, tên khách..."
            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#B5945B]"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              filterStatus === "all"
                ? "bg-[#B5945B] text-black font-bold"
                : "bg-white/5 hover:bg-white/10 text-zinc-300"
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("failed")}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
              filterStatus === "failed"
                ? "bg-red-500 text-white font-bold"
                : "bg-white/5 hover:bg-white/10 text-red-300"
            }`}
          >
            <span>Thất bại ({failedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("customer")}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              filterStatus === "customer"
                ? "bg-purple-600 text-white font-bold"
                : "bg-white/5 hover:bg-white/10 text-purple-300"
            }`}
          >
            Gửi Khách Hàng
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("success")}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              filterStatus === "success"
                ? "bg-emerald-600 text-white font-bold"
                : "bg-white/5 hover:bg-white/10 text-emerald-300"
            }`}
          >
            Thành công ({successCount})
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer ml-1"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#B5945B]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#B5945B]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Nhật Ký Chuyển Giao Email (Outgoing Email Audit Trail)
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">
            Hiển thị {filteredLogs.length} / {logs.length} bản ghi
          </span>
        </div>

        {loading && logs.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#B5945B]" />
            <span className="text-xs">Đang tải nhật ký email từ máy chủ...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
            <Inbox className="w-8 h-8 text-zinc-500" />
            <span className="text-xs">Không tìm thấy bản ghi email nào phù hợp với bộ lọc.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-black/40 text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Người nhận (Recipient)</th>
                  <th className="py-3 px-4">Loại thư</th>
                  <th className="py-3 px-4">Mã Đơn / Khách Hàng</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredLogs.map((log) => {
                  const isResending = resendingId === log.id;
                  const isSuccess = log.status === "success";

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Time */}
                      <td className="py-3 px-4 text-zinc-400 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span>{formatLogTime(log.createdAt)}</span>
                        </div>
                      </td>

                      {/* Recipient */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-white font-medium break-all select-all">
                            {log.recipient}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(log.recipient, "email")}
                            className="text-zinc-500 hover:text-white transition opacity-0 group-hover:opacity-100 p-0.5"
                            title="Sao chép email"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        {log.subject && (
                          <div className="text-[11px] text-zinc-400 truncate max-w-[280px] mt-0.5" title={log.subject}>
                            {log.subject}
                          </div>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getTypeBadge(log.type)}
                      </td>

                      {/* Booking Info */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.bookingId ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-[#E5C17C] font-semibold text-[11px]">
                              {log.bookingId}
                            </span>
                            {log.clientName && (
                              <span className="text-[11px] text-zinc-300 truncate max-w-[150px]">
                                {log.clientName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">Hệ thống</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isSuccess ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã Gửi Thành Công</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30 cursor-pointer"
                            title={log.error || "Lỗi khi chuyển phát thư"}
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>Thất Bại</span>
                          </span>
                        )}
                        {log.channel && (
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                            {log.channel}
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Resend button */}
                          <button
                            type="button"
                            onClick={() => handleResendEmail(log)}
                            disabled={isResending}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                              !isSuccess
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20"
                                : "bg-[#B5945B]/15 hover:bg-[#B5945B]/25 text-[#E5C17C] border border-[#B5945B]/30"
                            } disabled:opacity-50`}
                            title="Gửi lại email này ngay lập tức cho khách hàng"
                          >
                            {isResending ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            <span>{isResending ? "Đang gửi..." : "Gửi Lại (Resend)"}</span>
                          </button>

                          {/* Detail button */}
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer text-[11px]"
                            title="Xem chi tiết log"
                          >
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-950 border border-white/15 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#B5945B]" />
                <h4 className="text-sm font-bold text-white">Chi Tiết Bản Ghi Email</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-zinc-400 hover:text-white transition cursor-pointer text-xs"
              >
                ✕ Đóng
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">ID Bản Ghi:</span>
                <span className="font-mono text-zinc-300">{selectedLog.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Thời Điểm Gửi:</span>
                <span className="font-mono text-white">{formatLogTime(selectedLog.createdAt)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Người Nhận:</span>
                <span className="font-mono text-[#E5C17C] font-semibold">{selectedLog.recipient}</span>
              </div>
              {selectedLog.bookingId && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Mã Booking:</span>
                  <span className="font-mono text-white">{selectedLog.bookingId}</span>
                </div>
              )}
              {selectedLog.clientName && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Tên Khách Hàng:</span>
                  <span className="text-white">{selectedLog.clientName}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-zinc-400">Trạng Thái:</span>
                <span className={selectedLog.status === "success" ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                  {selectedLog.status === "success" ? "Đã giao thành công (250 OK)" : "Thất bại"}
                </span>
              </div>
              {selectedLog.channel && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Kênh Phân Phối:</span>
                  <span className="font-mono text-zinc-300">{selectedLog.channel}</span>
                </div>
              )}
              {selectedLog.messageId && (
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Message ID:</span>
                  <span className="font-mono text-zinc-400 text-[11px] truncate max-w-[260px]">{selectedLog.messageId}</span>
                </div>
              )}
              {selectedLog.error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 space-y-1">
                  <span className="font-semibold block">Chi tiết lỗi máy chủ:</span>
                  <p className="font-mono text-[11px] leading-relaxed break-words">{selectedLog.error}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setSelectedLog(null);
                  handleResendEmail(selectedLog);
                }}
                disabled={resendingId === selectedLog.id}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#B5945B] hover:bg-[#c4a46a] text-black font-bold text-xs transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Gửi Lại Cho Người Nhận Này</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
