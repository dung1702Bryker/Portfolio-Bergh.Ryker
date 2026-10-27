import React, { useState, useEffect } from "react";
import { X, ExternalLink, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { ProofingPhoto, extractBaseName } from "../services/proofingService";

interface LocalFileFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId?: string;
  albumTitle?: string;
  photos: ProofingPhoto[];
  tags?: string[];
  onFilterSuccess?: () => void;
}

type FilterOption = "custom" | "favorites" | "comments" | "tags";
type ExtensionOption = "all" | "raw" | "jpg";

export const LocalFileFilterModal: React.FC<LocalFileFilterModalProps> = ({
  isOpen,
  onClose,
  albumId,
  albumTitle = "Album Khách",
  photos = [],
  tags = [],
  onFilterSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"local" | "drive">("local");
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("favorites");
  const [fileNamesInput, setFileNamesInput] = useState<string>("");
  const [selectedExtension, setSelectedExtension] = useState<ExtensionOption>("all");

  // File System Access Handles
  const [sourceDirHandle, setSourceDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [sourceDirName, setSourceDirName] = useState<string>("");
  const [destDirHandle, setDestDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [destDirName, setDestDirName] = useState<string>("");

  // Running & Security States
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [securityBlocked, setSecurityBlocked] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Auto-populate textarea based on selected radio
  useEffect(() => {
    if (selectedFilter === "favorites") {
      const favList = photos
        .filter((p) => p.isFavorite)
        .map((p) => p.baseName || extractBaseName(p.fileName))
        .filter(Boolean);
      // Deduplicate
      const unique = Array.from(new Set(favList));
      setFileNamesInput(unique.join(","));
    } else if (selectedFilter === "comments") {
      const commentList = photos
        .filter((p) => p.comments && p.comments.length > 0)
        .map((p) => p.baseName || extractBaseName(p.fileName))
        .filter(Boolean);
      const unique = Array.from(new Set(commentList));
      setFileNamesInput(unique.join(","));
    } else if (selectedFilter === "tags") {
      if (tags && tags.length > 0) {
        setFileNamesInput(tags.join(","));
      } else {
        setFileNamesInput("");
      }
    }
  }, [selectedFilter, photos, tags]);

  if (!isOpen) return null;

  // Open standalone browser tab to bypass iframe security blocks
  const handleOpenNewTab = () => {
    if (typeof window !== "undefined") {
      window.open(window.location.href, "_blank", "noopener,noreferrer");
    }
  };

  // Helper to test if a file extension matches user selection
  const isExtensionMatched = (fileName: string): boolean => {
    const lower = fileName.toLowerCase();
    if (selectedExtension === "all") return true;
    if (selectedExtension === "raw") {
      return (
        lower.endsWith(".arw") ||
        lower.endsWith(".cr2") ||
        lower.endsWith(".cr3") ||
        lower.endsWith(".nef") ||
        lower.endsWith(".raf") ||
        lower.endsWith(".dng") ||
        lower.endsWith(".xmp")
      );
    }
    if (selectedExtension === "jpg") {
      return (
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".heic")
      );
    }
    return true;
  };

  // Helper to extract clean base name without extension
  const getFileBaseName = (fileName: string): string => {
    if (!fileName) return "";
    const clean = fileName.split(/[/\\]/).pop() || fileName;
    const base = clean.replace(/\.[^/.]+$/, "").trim().toUpperCase();
    return base.startsWith("_") ? base.substring(1) : base;
  };

  // 1. Pick Source Directory
  const handlePickSourceDirectory = async () => {
    setSecurityBlocked(false);
    setStatusMessage("");
    setIsSuccess(false);

    try {
      if (typeof (window as any).showDirectoryPicker !== "function") {
        throw new Error("Trình duyệt không hỗ trợ File System Access API.");
      }
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });
      if (dirHandle) {
        setSourceDirHandle(dirHandle);
        setSourceDirName(dirHandle.name);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return; // User canceled
      console.warn("Source directory picker error:", err);
      if (err.name === "SecurityError" || String(err).includes("Cross origin") || String(err).includes("iframe")) {
        setSecurityBlocked(true);
      } else {
        alert("Không thể mở chọn thư mục: " + (err.message || err));
      }
    }
  };

  // 2. Pick Destination Directory
  const handlePickDestDirectory = async () => {
    setSecurityBlocked(false);
    setStatusMessage("");
    setIsSuccess(false);

    try {
      if (typeof (window as any).showDirectoryPicker !== "function") {
        throw new Error("Trình duyệt không hỗ trợ File System Access API.");
      }
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });
      if (dirHandle) {
        setDestDirHandle(dirHandle);
        setDestDirName(dirHandle.name);
      }
    } catch (err: any) {
      if (err.name === "AbortError") return; // User canceled
      console.warn("Destination directory picker error:", err);
      if (err.name === "SecurityError" || String(err).includes("Cross origin") || String(err).includes("iframe")) {
        setSecurityBlocked(true);
      } else {
        alert("Không thể mở chọn thư mục: " + (err.message || err));
      }
    }
  };

  // Recursive scan directory to find all matching files
  const scanDirectoryRecursive = async (
    dir: FileSystemDirectoryHandle,
    targetSet: Set<string>,
    matchedFiles: FileSystemFileHandle[],
    depth = 0
  ) => {
    if (depth > 10) return;
    try {
      // @ts-ignore
      for await (const entry of dir.values()) {
        if (entry.kind === "file") {
          const fileBase = getFileBaseName(entry.name);
          if (targetSet.has(fileBase) && isExtensionMatched(entry.name)) {
            matchedFiles.push(entry as FileSystemFileHandle);
          }
        } else if (entry.kind === "directory" && entry.name !== "DONE" && entry.name !== destDirName) {
          await scanDirectoryRecursive(entry as FileSystemDirectoryHandle, targetSet, matchedFiles, depth + 1);
        }
      }
    } catch (e) {
      console.warn("Error scanning folder level:", e);
    }
  };

  // 3. Start Filtering & Direct Copy via createWritable()
  const handleStartFiltering = async () => {
    if (!fileNamesInput.trim()) {
      alert("Vui lòng nhập hoặc chọn danh sách mã file cần lọc.");
      return;
    }

    if (!sourceDirHandle) {
      alert("Vui lòng chọn thư mục chứa ảnh cần lọc trước khi bấm bắt đầu.");
      handlePickSourceDirectory();
      return;
    }

    // Parse target base names
    const targetBaseNames = fileNamesInput
      .split(/[,\s\n]+/)
      .map((s) => s.replace(/\.[^/.]+$/, "").trim().toUpperCase())
      .filter((s) => s.length > 0);

    const targetSet = new Set<string>(targetBaseNames);

    if (targetSet.size === 0) {
      alert("Danh sách mã file lọc đang trống.");
      return;
    }

    setIsProcessing(true);
    setIsSuccess(false);
    setStatusMessage("Đang quét thư mục tìm file khớp...");

    try {
      // Step A: Determine destination directory (use picked or auto-create 'DONE' inside source)
      let targetDir: FileSystemDirectoryHandle;
      if (destDirHandle) {
        targetDir = destDirHandle;
      } else {
        targetDir = await sourceDirHandle.getDirectoryHandle("DONE", { create: true });
        setDestDirName("DONE (Tự tạo)");
      }

      // Step B: Recursively scan source folder
      const matchedFileHandles: FileSystemFileHandle[] = [];
      await scanDirectoryRecursive(sourceDirHandle, targetSet, matchedFileHandles);

      if (matchedFileHandles.length === 0) {
        setStatusMessage(`Không tìm thấy file nào khớp với ${targetSet.size} mã ảnh trong thư mục nguồn.`);
        setIsProcessing(false);
        return;
      }

      // Step C: Copy directly using createWritable() - NO ZIP
      let copiedCount = 0;
      const total = matchedFileHandles.length;

      for (let i = 0; i < total; i++) {
        const fileHandle = matchedFileHandles[i];
        setStatusMessage(`Đang tạo thư mục & lọc file, vui lòng chờ... (Đã chép ${copiedCount}/${total} file)`);

        const fileData = await fileHandle.getFile();
        const outHandle = await targetDir.getFileHandle(fileData.name, { create: true });
        // @ts-ignore
        const writable = await outHandle.createWritable();
        await writable.write(fileData);
        await writable.close();

        copiedCount++;
      }

      // Completed
      setStatusMessage("Sao chép file thành công");
      setIsSuccess(true);
      if (onFilterSuccess) {
        onFilterSuccess();
      }
    } catch (err: any) {
      console.error("Filter copy error:", err);
      if (err.name === "SecurityError" || String(err).includes("Cross origin") || String(err).includes("iframe")) {
        setSecurityBlocked(true);
        setStatusMessage("Trình duyệt chặn ghi trực tiếp ổ cứng trong khung iframe xem trước.");
      } else {
        setStatusMessage("Lỗi trong quá trình sao chép: " + (err.message || err));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy textarea contents
  const handleCopyText = () => {
    if (!fileNamesInput) return;
    navigator.clipboard.writeText(fileNamesInput);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-[#121216]/95 backdrop-blur-2xl border border-white/10 text-zinc-100 rounded-2xl shadow-2xl w-full max-w-[540px] p-6 relative font-sans text-left overflow-hidden box-border">
        {/* Header: Title & Close Button */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <h2 className="text-[#E2C792] text-xl font-bold font-serif tracking-tight">
            Lọc ảnh trên máy tính
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2 Tabs: Lọc từ máy (active) & Lọc từ Drive */}
        <div className="flex items-center gap-6 mt-3 border-b border-white/10 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("local")}
            className={`pb-2.5 font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "local"
                ? "text-[#E2C792] border-b-2 border-[#B5945B]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Lọc từ máy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("drive")}
            className={`pb-2.5 font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "drive"
                ? "text-[#E2C792] border-b-2 border-[#B5945B]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Lọc từ Drive
          </button>
        </div>

        {/* Iframe Security Notice Banner if blocked */}
        {securityBlocked && (
          <div className="mt-3.5 p-3 rounded-xl bg-amber-950/50 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold leading-relaxed">
                ⚠️ Khung xem trước AI Studio chặn quyền ghi ổ cứng của Chrome.
              </p>
              <button
                type="button"
                onClick={handleOpenNewTab}
                className="mt-1.5 inline-flex items-center gap-1 px-3 py-1 bg-[#B5945B] hover:brightness-110 text-black rounded-lg font-bold text-[11px] transition cursor-pointer"
              >
                <ExternalLink size={12} />
                <span>Mở trang ở Tab Chrome Mới để copy trực tiếp</span>
              </button>
            </div>
          </div>
        )}

        {/* Radio Filter Selector */}
        <div className="mt-4">
          <label className="text-xs text-zinc-400 block mb-2 font-medium">
            Vui lòng chọn mục bạn muốn lọc:
          </label>
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-300">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="filterCategory"
                checked={selectedFilter === "custom"}
                onChange={() => setSelectedFilter("custom")}
                className="w-4 h-4 accent-[#B5945B] cursor-pointer"
              />
              <span>Tự nhập...</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-white">
              <input
                type="radio"
                name="filterCategory"
                checked={selectedFilter === "favorites"}
                onChange={() => setSelectedFilter("favorites")}
                className="w-4 h-4 accent-[#B5945B] cursor-pointer"
              />
              <span className="text-[#E2C792]">Ảnh yêu thích</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="filterCategory"
                checked={selectedFilter === "comments"}
                onChange={() => setSelectedFilter("comments")}
                className="w-4 h-4 accent-[#B5945B] cursor-pointer"
              />
              <span>Ảnh có bình luận</span>
            </label>

            <label
              className={`inline-flex items-center gap-2 ${
                tags && tags.length > 0 ? "cursor-pointer" : "opacity-40 cursor-not-allowed"
              }`}
            >
              <input
                type="radio"
                name="filterCategory"
                disabled={!tags || tags.length === 0}
                checked={selectedFilter === "tags"}
                onChange={() => setSelectedFilter("tags")}
                className="w-4 h-4 accent-[#B5945B]"
              />
              <span>Ảnh có tag</span>
            </label>
          </div>
        </div>

        {/* Textarea displaying file names */}
        <div className="mt-3 relative">
          <textarea
            rows={4}
            value={fileNamesInput}
            onChange={(e) => {
              setSelectedFilter("custom");
              setFileNamesInput(e.target.value);
            }}
            placeholder="Nhập tên file ảnh cần lọc (cách nhau bởi dấu phẩy, ví dụ: NDD03604, NDD03605...)"
            className="w-full bg-black/50 border border-white/10 focus:border-[#B5945B] text-zinc-200 placeholder-zinc-500 rounded-xl p-3 h-[120px] text-sm font-mono leading-relaxed outline-none resize-none transition"
          />
          {copiedNotification && (
            <span className="absolute top-2 right-2 text-[11px] bg-[#B5945B] text-black font-bold px-2 py-0.5 rounded shadow">
              Đã sao chép!
            </span>
          )}
        </div>

        {/* 3 Aligned Control Rows */}
        <div className="mt-4 space-y-3 text-sm">
          {/* Row 1: Định dạng file muốn lọc */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <span className="text-zinc-300 font-medium">Định dạng file muốn lọc</span>
            <select
              value={selectedExtension}
              onChange={(e) => setSelectedExtension(e.target.value as ExtensionOption)}
              className="w-full sm:w-[200px] min-w-0 border border-[#B5945B]/50 bg-[#1A1A20] text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#181820]">All</option>
              <option value="raw" className="bg-[#181820]">RAW (.ARW, .CR2, .CR3, .NEF, .RAF, .DNG)</option>
              <option value="jpg" className="bg-[#181820]">JPG / PNG</option>
            </select>
          </div>

          {/* Row 2: Chọn thư mục chứa ảnh cần lọc */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <span className="text-zinc-300 font-medium">Chọn thư mục chứa ảnh cần lọc</span>
            <button
              type="button"
              onClick={handlePickSourceDirectory}
              title={sourceDirName ? `Thư mục nguồn: ${sourceDirName}` : "Chọn thư mục nguồn"}
              className="w-full sm:w-[200px] min-w-0 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-white/15 hover:border-[#B5945B]/60 text-zinc-200 font-medium py-2 px-3 rounded-xl transition truncate cursor-pointer text-sm shadow-sm"
            >
              {sourceDirName ? `Nguồn: ${sourceDirName}` : "Chọn thư mục"}
            </button>
          </div>

          {/* Row 3: Chọn thư mục chứa ảnh sau khi lọc */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
            <span className="text-zinc-300 font-medium">Chọn thư mục chứa ảnh sau khi lọc</span>
            <button
              type="button"
              onClick={handlePickDestDirectory}
              title={destDirName ? `Thư mục đích: ${destDirName}` : "Chọn thư mục đích (Mặc định tạo thư mục DONE)"}
              className="w-full sm:w-[200px] min-w-0 bg-gradient-to-r from-zinc-800 to-zinc-900 border border-white/15 hover:border-[#B5945B]/60 text-zinc-200 font-medium py-2 px-3 rounded-xl transition truncate cursor-pointer text-sm shadow-sm"
            >
              {destDirName ? `Đích: ${destDirName}` : "Chọn thư mục"}
            </button>
          </div>
        </div>

        {/* Primary Action Button: Bắt đầu lọc */}
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleStartFiltering}
            className="bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 disabled:opacity-50 text-black font-bold px-8 py-2.5 rounded-xl shadow-[0_0_20px_rgba(181,148,91,0.25)] transition inline-flex items-center justify-center gap-2 cursor-pointer text-sm"
          >
            {isProcessing && <RefreshCw size={16} className="animate-spin text-black" />}
            <span>Bắt đầu lọc</span>
          </button>

          {/* Status Message */}
          {statusMessage && (
            <p
              className={`text-sm text-center mt-2.5 ${
                isSuccess
                  ? "text-[#E2C792] font-semibold"
                  : isProcessing
                  ? "text-amber-300"
                  : "text-zinc-400"
              }`}
            >
              {statusMessage}
            </p>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-5 pt-3 border-t border-white/10 text-center">
          <p className="text-[12px] text-zinc-500">
            Tính năng này chỉ hoạt động tốt nhất trên trình duyệt Chrome và Edge
          </p>
        </div>
      </div>
    </div>
  );
};
