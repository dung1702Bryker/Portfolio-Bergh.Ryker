import React, { useState, useEffect } from "react";
import { Mail, CheckCircle2, AlertCircle, RefreshCw, Key, ShieldCheck, Send, ExternalLink, HelpCircle } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useToast } from "../../hooks/useToast";

interface EmailConfigData {
  targetEmail: string;
  gmailUser: string;
  gmailAppPassword?: string;
  smtpHost?: string;
  smtpPort?: string;
  hasStoredPassword?: boolean;
  googleOAuthConnected?: boolean;
}

export const EmailNotificationConfig: React.FC = () => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    channel?: string;
    message?: string;
  } | null>(null);

  const [targetEmail, setTargetEmail] = useState("nguyenducdung1702@gmail.com");
  const [gmailUser, setGmailUser] = useState("nguyenducdung1702@gmail.com");
  const [gmailPassword, setGmailPassword] = useState("");
  const [hasExistingPassword, setHasExistingPassword] = useState(false);
  const [googleOAuthConnected, setGoogleOAuthConnected] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        // 1. Check Google OAuth token in Firestore
        try {
          const tokenSnap = await getDoc(doc(db, "configs", "googleToken"));
          if (tokenSnap.exists()) {
            const data = tokenSnap.data();
            const ageMs = data?.updatedAt ? Date.now() - data.updatedAt : 0;
            if (data?.accessToken && ageMs < 3540 * 1000) {
              setGoogleOAuthConnected(true);
            }
          }
        } catch (_) {}

        // 2. Check stored email config
        try {
          const configSnap = await getDoc(doc(db, "configs", "email"));
          if (configSnap.exists()) {
            const data = configSnap.data();
            if (data.targetEmail) setTargetEmail(data.targetEmail);
            if (data.user) setGmailUser(data.user);
            if (data.pass) {
              setHasExistingPassword(true);
            }
          }
        } catch (_) {}
      } catch (err: any) {
        console.warn("Error loading email config:", err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updateData: Record<string, any> = {
        targetEmail: targetEmail.trim() || "nguyenducdung1702@gmail.com",
        user: gmailUser.trim() || "nguyenducdung1702@gmail.com",
        updatedAt: Date.now(),
      };

      if (gmailPassword.trim()) {
        updateData.pass = gmailPassword.trim().replace(/\s+/g, ""); // strip any pasted spaces from 16-char app pass
      }

      await setDoc(doc(db, "configs", "email"), updateData, { merge: true });
      if (gmailPassword.trim()) {
        setHasExistingPassword(true);
        setGmailPassword("");
      }
      showToast("Đã lưu cấu hình Gmail nhận thông báo thành công!", "success");
    } catch (err: any) {
      console.error("Save email config error:", err);
      showToast("Lỗi khi lưu cấu hình: " + (err.message || err), "error");
    } finally {
      setSaving(false);
    }
  };

  const [testingCustomer, setTestingCustomer] = useState(false);
  const [customerTestEmail, setCustomerTestEmail] = useState("");

  const handleTestCustomerEmail = async () => {
    try {
      setTestingCustomer(true);
      setTestResult(null);
      const res = await fetch("/api/test-customer-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: (customerTestEmail.trim() || targetEmail.trim() || "nguyenducdung1702@gmail.com"),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          channel: data.delivered,
          message: `Đã gửi mẫu thư Xác nhận đặt lịch tới khách hàng: ${data.target || customerTestEmail || targetEmail}!`,
        });
        showToast("Đã gửi thử thư xác nhận cho khách hàng thành công!", "success");
      } else {
        setTestResult({
          success: false,
          message: data.error || "Gửi thử nghiệm cho khách thất bại.",
        });
        showToast("Kiểm tra gửi email khách thất bại: " + (data.error || ""), "error");
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Lỗi mạng hoặc server",
      });
      showToast("Lỗi khi kiểm tra email khách: " + (err.message || err), "error");
    } finally {
      setTestingCustomer(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await fetch("/api/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmail: targetEmail.trim() || "nguyenducdung1702@gmail.com",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          channel: data.delivered,
          message: data.note || "Thư thử nghiệm đã được điều phối thành công!",
        });
        showToast("Đã kiểm tra luồng gửi Gmail thành công!", "success");
      } else {
        setTestResult({
          success: false,
          message: data.error || "Gửi thử nghiệm thất bại.",
        });
        showToast("Kiểm tra gửi email thất bại: " + (data.error || ""), "error");
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Lỗi mạng hoặc server",
      });
      showToast("Lỗi khi gọi kiểm tra email: " + (err.message || err), "error");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-3 text-[#B5945B]" />
        <span>Đang tải cấu hình thông báo...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Status: Direct Gmail SMTP */}
        <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Gmail Mật Khẩu Ứng Dụng
            </span>
            {hasExistingPassword ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div className="text-sm font-medium text-white">
            {hasExistingPassword ? "Đã cấu hình App Password" : "Chưa nhập mật khẩu"}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Gửi email trực tiếp từ tài khoản Gmail của Studio
          </p>
        </div>

        {/* Status: Google OAuth */}
        <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Google Workspace OAuth
            </span>
            {googleOAuthConnected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-zinc-500" />
            )}
          </div>
          <div className="text-sm font-medium text-white">
            {googleOAuthConnected ? "Đã liên kết tài khoản" : "Chưa đăng nhập Google"}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Tự động đồng bộ Lịch, Task và gửi qua Gmail API
          </p>
        </div>

        {/* Status: Web Push & Firestore Store */}
        <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Đồng bộ Đám Mây & Push
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-medium text-white">Đang hoạt động 24/7</div>
          <p className="text-[11px] text-zinc-400 mt-1">
            Lưu đơn vào Firestore & gửi Web Push chuông báo
          </p>
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="bg-zinc-900/50 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#B5945B]/10 rounded-lg text-[#B5945B]">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                Cấu Hình Gmail Nhận & Gửi Thông Báo Đặt Lịch
              </h3>
              <p className="text-xs text-zinc-400">
                Tự động gửi email thông báo khi có khách đặt lịch trên website
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="text-xs text-[#B5945B] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showGuide ? "Đóng hướng dẫn" : "Xem cách lấy Mật khẩu ứng dụng"}</span>
          </button>
        </div>

        {/* Step-by-step Guide toggle */}
        {showGuide && (
          <div className="bg-[#B5945B]/5 border border-[#B5945B]/20 rounded-xl p-4 text-xs text-zinc-300 space-y-2">
            <p className="font-semibold text-[#B5945B] flex items-center gap-1.5">
              <Key className="w-4 h-4" />
              Cách tạo Mật khẩu ứng dụng Gmail (16 ký tự) trong 1 phút:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-zinc-400 pl-1">
              <li>
                Truy cập trang Quản lý tài khoản Google:{" "}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#B5945B] hover:underline inline-flex items-center gap-0.5"
                >
                  myaccount.google.com/security <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Bật <strong>Xác minh 2 bước</strong> (nếu chưa bật).</li>
              <li>
                Tìm kiếm mục <strong>Mật khẩu ứng dụng</strong> (hoặc truy cập trực tiếp{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#B5945B] hover:underline inline-flex items-center gap-0.5"
                >
                  myaccount.google.com/apppasswords <ExternalLink className="w-3 h-3" />
                </a>
                ).
              </li>
              <li>Đặt tên ứng dụng (ví dụ: <code>Bergh.Ryker Studio</code>) và nhấn <strong>Tạo</strong>.</li>
              <li>Google sẽ cấp một mã 16 ký tự (ví dụ: <code>abcd efgh ijkl mnop</code>). Hãy sao chép và dán vào ô Mật khẩu bên dưới!</li>
            </ol>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Email */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Gmail Quản Trị Viên (Nhận thông báo đơn đặt lịch)
            </label>
            <input
              type="email"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              required
              placeholder="nguyenducdung1702@gmail.com"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#B5945B]"
            />
            <p className="text-[11px] text-zinc-400 mt-1">Mỗi khi có khách bấm gửi form đặt lịch, email sẽ gửi về địa chỉ này.</p>
          </div>

          {/* Gmail User */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Tài khoản Gmail gửi (Sender Gmail)
            </label>
            <input
              type="email"
              value={gmailUser}
              onChange={(e) => setGmailUser(e.target.value)}
              required
              placeholder="nguyenducdung1702@gmail.com"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#B5945B]"
            />
            <p className="text-[11px] text-zinc-400 mt-1">Email dùng để phát đi thông báo.</p>
          </div>

          {/* App Password */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>Mật khẩu ứng dụng Gmail (16 ký tự App Password)</span>
              {hasExistingPassword && (
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đã lưu mật khẩu ứng dụng
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={gmailPassword}
                onChange={(e) => setGmailPassword(e.target.value)}
                placeholder={hasExistingPassword ? "•••••••••••••••• (Nhập mới nếu muốn thay đổi)" : "Ví dụ: abcd efgh ijkl mnop"}
                className="w-full bg-black/50 border border-white/10 rounded-xl pl-3.5 pr-24 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#B5945B]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Mật khẩu ứng dụng bảo mật do Google cấp. Không phải mật khẩu đăng nhập tài khoản thông thường.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing || testingCustomer}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              {testing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#B5945B]" />
              ) : (
                <Send className="w-3.5 h-3.5 text-[#B5945B]" />
              )}
              <span>{testing ? "Đang gửi..." : "Gửi Thử Báo Quản Trị"}</span>
            </button>

            <button
              type="button"
              onClick={handleTestCustomerEmail}
              disabled={testing || testingCustomer}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#B5945B]/30 bg-[#B5945B]/10 hover:bg-[#B5945B]/20 text-[#B5945B] text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              {testingCustomer ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#B5945B]" />
              ) : (
                <Mail className="w-3.5 h-3.5 text-[#B5945B]" />
              )}
              <span>{testingCustomer ? "Đang gửi thư khách..." : "Gửi Thử Thư Xác Nhận Khách Hàng"}</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B5945B] hover:bg-[#c4a46a] text-black font-semibold text-xs transition cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>{saving ? "Đang lưu..." : "Lưu Cấu Hình Gmail"}</span>
          </button>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
              testResult.success
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                : "bg-red-500/10 border border-red-500/20 text-red-300"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            )}
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">
                {testResult.success ? "Gửi thử nghiệm thành công!" : "Lưu ý gửi thử nghiệm:"}
              </span>
              <p className="leading-relaxed">{testResult.message}</p>
              {testResult.channel && (
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-black/40 text-[10px] text-zinc-300">
                  Kênh gửi: {testResult.channel}
                </span>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
