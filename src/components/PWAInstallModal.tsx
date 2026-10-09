import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Smartphone,
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  X,
  Bell,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  Volume2,
} from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";
import { useAdminNotification } from "../context/AdminNotificationContext";

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, deferredPrompt, isInstalled, isIOS, isStandalone, promptInstall } =
    usePWAInstall();
  const { enableBrowserPush, settings, triggerTestNotification, isAdmin } = useAdminNotification();

  const [activePlatform, setActivePlatform] = useState<"ios" | "android">(
    isIOS ? "ios" : "android"
  );
  const [hasPrompted, setHasPrompted] = useState(false);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      const res = await promptInstall();
      if (res) {
        setHasPrompted(true);
      }
    }
  };

  const handleEnablePush = async () => {
    await enableBrowserPush();
  };

  if (!isOpen || !isAdmin) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="bg-zinc-950 border border-[#B5945B]/40 rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden text-left relative"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#B5945B]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between relative z-10 shrink-0 bg-zinc-900/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E5C07B] to-[#8C6D37] p-0.5 shadow-lg shrink-0">
                <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-[#B5945B]" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-white text-base sm:text-lg tracking-tight">
                  Cài Đặt App Nhận Cảnh Báo Khi Tắt Màn Hình
                </h3>
                <p className="text-xs text-zinc-400">
                  Nhận chuông & thông báo đẩy trên điện thoại khi khóa máy (PWA)
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Platform Tab Switcher */}
          <div className="px-4 sm:px-5 py-3 border-b border-white/10 bg-zinc-900/40 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5 text-xs w-full sm:w-auto">
              <button
                onClick={() => setActivePlatform("ios")}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activePlatform === "ios"
                    ? "bg-[#B5945B] text-zinc-950 shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>🍎 iPhone (iOS)</span>
              </button>
              <button
                onClick={() => setActivePlatform("android")}
                className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activePlatform === "android"
                    ? "bg-[#B5945B] text-zinc-950 shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>🤖 Android (Chrome)</span>
              </button>
            </div>

            {isStandalone && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đang chạy ở chế độ App
              </span>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs leading-relaxed custom-scrollbar">
            {/* Core Principle Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200/90 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-semibold mb-0.5">
                  Tại sao phải cài vào Màn hình chính?
                </strong>
                Hệ điều hành điện thoại (cả Apple iOS và Google Android) chỉ cho phép các ứng dụng đã được thêm vào Màn hình chính chạy ngầm dịch vụ Service Worker để phát chuông và đẩy thông báo ra màn hình khóa khi bạn tắt màn hình.
              </div>
            </div>

            {/* iOS Guide */}
            {activePlatform === "ios" && (
              <div className="space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span>Các bước cài đặt trên iPhone (iOS 16.4 trở lên):</span>
                </h4>

                <div className="space-y-2.5">
                  {/* Step 1 */}
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-zinc-800 text-[#B5945B] font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <span className="font-bold text-white block">
                        Mở trang web bằng Safari
                      </span>
                      <span className="text-zinc-400">
                        Đảm bảo bạn đang mở liên kết trên trình duyệt Safari chính thức của Apple (không mở trong cửa sổ con của Zalo hay Messenger).
                      </span>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-zinc-800 text-[#B5945B] font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        Bấm nút Chia sẻ <Share className="w-3.5 h-3.5 text-sky-400 inline" />
                      </span>
                      <span className="text-zinc-400">
                        Nút biểu tượng hình ô vuông có mũi tên hướng lên ở thanh công cụ dưới đáy màn hình Safari.
                      </span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5 flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-zinc-800 text-[#B5945B] font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </div>
                    <div>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        Chọn &ldquo;Thêm vào Màn hình chính&rdquo; <PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline" />
                      </span>
                      <span className="text-zinc-400">
                        Cuộn xuống danh sách hành động và bấm vào <strong>&ldquo;Thêm vào MH chính&rdquo; (Add to Home Screen)</strong>, sau đó bấm nút <strong>&ldquo;Thêm&rdquo; (Add)</strong> ở góc trên bên phải.
                      </span>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="p-3 rounded-2xl bg-zinc-900/80 border border-[#B5945B]/30 flex items-start gap-3 bg-[#B5945B]/5">
                    <div className="w-7 h-7 rounded-xl bg-[#B5945B] text-zinc-950 font-bold flex items-center justify-center shrink-0 text-xs">
                      4
                    </div>
                    <div>
                      <span className="font-bold text-white flex items-center gap-1.5">
                        Mở App và Bấm &ldquo;Bật Thông Báo&rdquo; <Bell className="w-3.5 h-3.5 text-[#B5945B] inline" />
                      </span>
                      <span className="text-zinc-300">
                        Nhấn vào biểu tượng <strong>BERGH.RYKER</strong> trên màn hình chính của iPhone, sau đó chọn <strong>Cho phép (Allow)</strong> khi hệ thống hỏi quyền thông báo. Xong!
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Android Guide */}
            {activePlatform === "android" && (
              <div className="space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span>Cài đặt trên điện thoại Android (Samsung, Xiaomi, Oppo...):</span>
                </h4>

                {deferredPrompt ? (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-zinc-900 border border-emerald-500/30 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-lg">
                      <Download className="w-6 h-6 animate-bounce" />
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">
                        Điện thoại của bạn đã sẵn sàng cài đặt!
                      </h5>
                      <p className="text-zinc-400 text-xs mt-1">
                        Bấm nút bên dưới để tải và đưa BERGH.RYKER lên màn hình chính với 1 chạm.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Cài Đặt App Lên Màn Hình Ngay</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-zinc-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                        1
                      </div>
                      <div>
                        <span className="font-bold text-white">Mở bằng Google Chrome hoặc Cốc Cốc</span>
                        <p className="text-zinc-400">
                          Mở trang web trực tiếp trên trình duyệt điện thoại Android.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-zinc-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                        2
                      </div>
                      <div>
                        <span className="font-bold text-white">Bấm menu 3 chấm (Góc trên bên phải)</span>
                        <p className="text-zinc-400">
                          Chọn <strong>&ldquo;Cài đặt ứng dụng&rdquo;</strong> hoặc <strong>&ldquo;Thêm vào Màn hình chính&rdquo;</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-zinc-900/80 border border-white/5 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-xl bg-zinc-800 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                        3
                      </div>
                      <div>
                        <span className="font-bold text-white">Bật Thông Báo</span>
                        <p className="text-zinc-400">
                          Mở app vừa tải về từ màn hình chính, nhấn <strong>Cho phép thông báo</strong> khi được hỏi.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Push Status Card */}
            <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-[#B5945B]" />
                  Trạng thái quyền thông báo:
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                    settings.browserPushEnabled
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-zinc-800 text-zinc-400 border border-white/10"
                  }`}
                >
                  {settings.browserPushEnabled ? "Đã cấp quyền" : "Chưa bật"}
                </span>
              </div>

              {!settings.browserPushEnabled ? (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  className="w-full py-2 px-3 rounded-xl bg-[#B5945B] hover:bg-[#c5a46a] text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Bấm Để Cấp Quyền Thông Báo Đẩy</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => triggerTestNotification("new_booking")}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold text-[11px] border border-white/10 transition-colors cursor-pointer"
                  >
                    Thử chuông đơn mới
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerTestNotification("traffic_spike")}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-300 font-semibold text-[11px] border border-amber-500/20 transition-colors cursor-pointer"
                  >
                    Thử cảnh báo xem
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400 shrink-0">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-[#B5945B]" />
              <span>Chuẩn Progressive Web App (PWA)</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
