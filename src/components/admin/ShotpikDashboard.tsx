import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Search, 
  HelpCircle, 
  Bell, 
  Moon, 
  Sun, 
  ChevronLeft, 
  Grid3X3, 
  Kanban, 
  HardDrive, 
  Share2, 
  Trash2, 
  MoreVertical, 
  Heart, 
  MessageSquare, 
  Clock, 
  Eye, 
  Lock, 
  Sparkles, 
  RefreshCw 
} from "lucide-react";
import { 
  ProofingAlbum, 
  PipelineStage, 
  updateAlbumPipelineStage, 
  updateAlbumChecklist,
  deleteProofingAlbum 
} from "../../services/proofingService";

interface ShotpikDashboardProps {
  albums: ProofingAlbum[];
  onOpenCreateModal: () => void;
  onOpenAlbum: (slugOrId: string) => void;
  onOpenFilterModal: (album: ProofingAlbum) => void;
  onOpenShareModal: (album: ProofingAlbum) => void;
  onCloseDashboard: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  triggerConfirm?: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => void;
}

const PIPELINE_COLUMNS: { id: PipelineStage; title: string; color: string; badgeBg: string }[] = [
  { id: "new", title: "1. Mới tạo / Chờ khách chọn", color: "text-zinc-400", badgeBg: "bg-zinc-800 text-zinc-300 border border-white/10" },
  { id: "client_submitted", title: "2. Khách đã chốt (Cần lọc RAW)", color: "text-[#E57373]", badgeBg: "bg-red-950/60 text-red-400 border border-red-500/30" },
  { id: "raw_filtered", title: "3. Đã lọc file / Đang Blend & Retouch", color: "text-[#E2C792]", badgeBg: "bg-[#B5945B]/15 text-[#E2C792] border border-[#B5945B]/30" },
  { id: "reviewing", title: "4. Chờ khách duyệt ảnh sửa", color: "text-amber-400", badgeBg: "bg-amber-950/60 text-amber-300 border border-amber-500/30" },
  { id: "supplementary", title: "5. Chỉnh sửa bổ sung", color: "text-purple-400", badgeBg: "bg-purple-950/60 text-purple-300 border border-purple-500/30" },
  { id: "delivered", title: "6. Đã bàn giao hoàn tất", color: "text-emerald-400", badgeBg: "bg-emerald-950/60 text-emerald-300 border border-emerald-500/30" },
];

/**
 * Individual Album Card component managing its own image loading error state,
 * preventing any broken image icons or alt-text clash.
 */
const AlbumGridCard: React.FC<{
  album: ProofingAlbum;
  isDarkMode: boolean;
  onOpenAlbum: (slugOrId: string) => void;
  onOpenFilterModal: (album: ProofingAlbum) => void;
  onOpenShareModal: (album: ProofingAlbum) => void;
  onDeleteAlbum: (album: ProofingAlbum) => void;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
}> = ({
  album,
  isDarkMode,
  onOpenAlbum,
  onOpenFilterModal,
  onOpenShareModal,
  onDeleteAlbum,
  activeMenuId,
  setActiveMenuId,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const favCount = album.photos?.filter((p) => p.isFavorite).length || 0;
  const commentCount = album.photos?.filter((p) => p.comments && p.comments.length > 0).length || 0;
  const totalPhotos = album.photos?.length || 0;
  const isLocked = album.isLocked;

  // Resolve cover image with priority:
  // 1. Explicit coverPhotoUrl
  // 2. coverImageFileId thumbnail
  // 3. First photo in album.photos with driveFileId / thumbnailUrl / url
  const coverUrlCandidate = useMemo(() => {
    if (album.coverPhotoUrl && album.coverPhotoUrl.trim()) {
      return album.coverPhotoUrl.trim();
    }
    if (album.coverImageFileId && album.coverImageFileId.trim()) {
      return `https://drive.google.com/thumbnail?id=${album.coverImageFileId.trim()}&sz=w1000`;
    }
    if (album.photos && album.photos.length > 0) {
      const first = album.photos[0];
      if (first.driveFileId) {
        return `https://drive.google.com/thumbnail?id=${first.driveFileId}&sz=w1000`;
      }
      return first.thumbnailUrl || first.url || "";
    }
    return "";
  }, [album.coverPhotoUrl, album.coverImageFileId, album.photos]);

  const hasValidImage = Boolean(coverUrlCandidate) && !imgFailed;

  // Status badge styling
  let statusText = "ĐANG CHỌN";
  let badgeColor = "bg-sky-500/90 text-white";
  if (album.pipelineStage === "client_submitted" || isLocked) {
    statusText = "ĐÃ CHỐT";
    badgeColor = "bg-[#e03131]/95 text-white shadow-[0_0_12px_rgba(224,49,49,0.4)]";
  } else if (album.pipelineStage === "raw_filtered") {
    statusText = "ĐANG HẬU KỲ";
    badgeColor = "bg-[#B5945B]/90 text-black shadow-[0_0_12px_rgba(181,148,91,0.3)]";
  } else if (album.pipelineStage === "delivered") {
    statusText = "ĐÃ GIAO";
    badgeColor = "bg-emerald-600/90 text-white";
  }

  return (
    <div
      className={`aspect-[4/3] rounded-2xl overflow-hidden relative group cursor-pointer shadow-xl transition-all duration-300 flex flex-col justify-between border ${
        isDarkMode
          ? "bg-[#141418] border-white/10 hover:border-[#B5945B]/60 hover:shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
          : "bg-white border-slate-200 hover:border-[#B5945B]/60 hover:shadow-xl"
      }`}
      onClick={() => onOpenAlbum(album.slug || album.id)}
    >
      {/* Background: Cover Image or Luxury Studio Monogram (Never broken <img>) */}
      {hasValidImage ? (
        <img
          src={coverUrlCandidate}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1C1C22] via-[#121216] to-[#09090B] flex flex-col items-center justify-center p-4 select-none">
          <div className="w-14 h-14 rounded-full border border-[#B5945B]/30 bg-[#B5945B]/10 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(181,148,91,0.15)] group-hover:scale-110 transition-transform">
            <span className="font-serif text-[#E2C792] text-xl font-bold tracking-widest">BR</span>
          </div>
          <span className="text-[11px] tracking-[4px] uppercase text-[#E2C792] font-serif font-bold text-center block">
            BERGH Ryker STUDIO
          </span>
          <span className="text-[9px] text-zinc-500 tracking-wider uppercase mt-1 block">
            Proofing & Selection
          </span>
        </div>
      )}

      {/* Top Badges */}
      <div className="relative z-10 p-3.5 flex items-center justify-between gap-2 pointer-events-none">
        <span
          className={`text-[11px] uppercase font-bold tracking-wider px-3 py-1 rounded-full shadow backdrop-blur-md ${badgeColor}`}
        >
          {statusText}
        </span>

        {album.passwordProtected && (
          <span
            className="text-[11px] bg-black/70 backdrop-blur-md border border-white/15 px-2.5 py-1 rounded-full text-zinc-200 flex items-center gap-1 shadow"
            title="Album được bảo vệ bằng mật khẩu"
          >
            <Lock size={11} className="text-[#E2C792]" />
            <span>Mật khẩu</span>
          </span>
        )}
      </div>

      {/* Bottom Info Gradient Overlay */}
      <div className="relative z-10 inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent text-white">
        <h3 className="font-bold text-base truncate group-hover:text-[#E2C792] transition-colors leading-snug">
          {album.title}
        </h3>

        <div className="flex items-center gap-2 text-xs text-zinc-300 mt-1 truncate">
          <span className="truncate">{album.clientName}</span>
          {album.bookingCode && (
            <span className="font-mono text-[#B5945B] font-semibold text-[11px] bg-[#B5945B]/15 px-2 py-0.5 rounded-full border border-[#B5945B]/30 shrink-0">
              #{album.bookingCode}
            </span>
          )}
          <span className="text-zinc-500 shrink-0">
            • {album.createdAt ? new Date(album.createdAt).toLocaleDateString("vi-VN") : ""}
          </span>
        </div>

        {/* Bottom stats & Quick Action menu */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/15 text-xs">
          <div className="flex items-center gap-3">
            {totalPhotos === 0 ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-[#E2C792] font-semibold text-[10px] flex items-center gap-1.5 border border-amber-500/30">
                <RefreshCw size={11} className="text-[#B5945B]" />
                <span>0 ảnh • Cần quét Drive</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 font-semibold text-rose-400">
                <Heart size={14} className="fill-rose-400" />
                <span>
                  {favCount}/{totalPhotos}
                </span>
              </span>
            )}
            <span className="flex items-center gap-1 text-zinc-300">
              <MessageSquare size={14} className="text-zinc-400" />
              <span>{commentCount}</span>
            </span>
          </div>

          {/* Quick 3-dot Menu */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActiveMenuId(activeMenuId === album.id ? null : album.id)}
              className="p-1 hover:bg-white/20 text-zinc-300 hover:text-white rounded-full transition cursor-pointer"
              title="Tác vụ nhanh"
            >
              <MoreVertical size={16} />
            </button>

            {activeMenuId === album.id && (
              <div className="absolute right-0 bottom-full mb-2 w-52 bg-[#16161C]/95 backdrop-blur-xl text-zinc-200 rounded-2xl shadow-2xl border border-white/15 py-1.5 text-xs z-50 animate-fade-in divide-y divide-white/5">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      onOpenAlbum(album.slug || album.id);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/[0.08] hover:text-[#E2C792] flex items-center gap-2.5 font-medium transition cursor-pointer"
                  >
                    <Eye size={14} className="text-[#B5945B]" />
                    <span>Mở quản lý album</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      onOpenAlbum(album.slug || album.id);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/[0.08] hover:text-[#E2C792] flex items-center gap-2.5 font-medium transition cursor-pointer"
                  >
                    <RefreshCw size={14} className="text-[#E2C792]" />
                    <span>Quét & Đồng bộ Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      onOpenFilterModal(album);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/[0.08] hover:text-[#E2C792] flex items-center gap-2.5 font-medium transition cursor-pointer"
                  >
                    <HardDrive size={14} className="text-[#B5945B]" />
                    <span>Lọc file trên máy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      onOpenShareModal(album);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-white/[0.08] hover:text-[#E2C792] flex items-center gap-2.5 font-medium transition cursor-pointer"
                  >
                    <Share2 size={14} className="text-[#DFB779]" />
                    <span>Chia sẻ & Mã QR</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      onDeleteAlbum(album);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-red-950/60 text-red-400 flex items-center gap-2.5 font-medium transition cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Xóa album</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ShotpikDashboard: React.FC<ShotpikDashboardProps> = ({
  albums,
  onOpenCreateModal,
  onOpenAlbum,
  onOpenFilterModal,
  onOpenShareModal,
  onCloseDashboard,
  showToast,
  triggerConfirm,
}) => {
  // Dark Luxury Default
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "kanban">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "favorites">("newest");
  const [activeMenuAlbumId, setActiveMenuAlbumId] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Filtered and sorted albums
  const processedAlbums = useMemo(() => {
    let list = albums.filter((a) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.clientName.toLowerCase().includes(q) ||
        (a.bookingCode && a.bookingCode.toLowerCase().includes(q)) ||
        (a.slug && a.slug.toLowerCase().includes(q))
      );
    });

    if (sortBy === "newest") {
      list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    } else if (sortBy === "oldest") {
      list.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
    } else if (sortBy === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "favorites") {
      list.sort((a, b) => {
        const favA = a.photos?.filter((p) => p.isFavorite).length || 0;
        const favB = b.photos?.filter((p) => p.isFavorite).length || 0;
        return favB - favA;
      });
    }

    return list;
  }, [albums, searchQuery, sortBy]);

  // Statistics counters
  const totalAlbums = albums.length;
  const waitingSelectionCount = albums.filter(
    (a) => (!a.pipelineStage || a.pipelineStage === "new") && !a.isLocked
  ).length;
  const clientSubmittedCount = albums.filter(
    (a) => a.pipelineStage === "client_submitted" || a.isLocked
  ).length;
  const inProgressCount = albums.filter(
    (a) =>
      a.pipelineStage === "raw_filtered" ||
      a.pipelineStage === "reviewing" ||
      a.pipelineStage === "supplementary"
  ).length;
  const newEventsCount = clientSubmittedCount;

  // Handle stage change
  const handleStageChange = async (albumId: string, newStage: PipelineStage) => {
    try {
      await updateAlbumPipelineStage(albumId, newStage);
      showToast("Đã cập nhật tiến độ dự án!", "success");
    } catch (e) {
      showToast("Lỗi khi cập nhật trạng thái", "error");
    }
  };

  // Handle checklist item toggle
  const handleToggleChecklist = async (
    album: ProofingAlbum,
    key: keyof NonNullable<ProofingAlbum["checklist"]>
  ) => {
    const current = album.checklist || {
      rawFiltered: false,
      colorGraded: false,
      skinRetouched: false,
      exported: false,
      driveUploaded: false,
    };
    const updated = { ...current, [key]: !current[key] };
    try {
      await updateAlbumChecklist(album.id, updated);
      showToast("Đã cập nhật checklist hậu kỳ", "info");
    } catch (e) {
      showToast("Lỗi khi cập nhật checklist", "error");
    }
  };

  // Handle delete album
  const handleDeleteAlbum = (album: ProofingAlbum) => {
    const doDelete = async () => {
      try {
        await deleteProofingAlbum(album.id);
        showToast("Đã xóa album thành công.", "success");
      } catch (err) {
        showToast("Lỗi khi xóa album", "error");
      }
    };

    if (triggerConfirm) {
      triggerConfirm(
        "Xác nhận xóa Album",
        `Bạn có chắc chắn muốn xóa album "${album.title}" của khách hàng "${album.clientName}"?`,
        doDelete,
        undefined,
        "Xóa Vĩnh Viễn",
        "Hủy"
      );
    } else {
      if (window.confirm(`Xóa album "${album.title}"?`)) {
        doDelete();
      }
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 ${
        isDarkMode
          ? "bg-[#09090B] text-zinc-100 bg-[radial-gradient(ellipse_at_top,_rgba(181,148,91,0.08),_transparent_70%)]"
          : "bg-[#f8f9fa] text-slate-800"
      } overflow-y-auto font-sans text-left transition-colors`}
    >
      {/* 1. TOP HEADER BAR: LIQUID GLASS & CHAMPAGNE ACCENTS */}
      <nav
        className={`${
          isDarkMode
            ? "bg-[#0D0D10]/85 backdrop-blur-xl border-white/[0.08]"
            : "bg-white border-slate-200"
        } border-b px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-sm`}
      >
        {/* Left Side: Single Frosted Pill Back + Logo + Actions */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCloseDashboard}
              className="bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-zinc-300 px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              title="Về giao diện Quản trị chính"
            >
              <ChevronLeft size={16} />
              <span>Về Admin</span>
            </button>

            <h1 className="font-serif tracking-wider text-lg font-bold text-white ml-1 select-none">
              BERGH.RYKER
            </h1>
          </div>

          {/* + Tạo album (Champagne Gold Royal Pill) */}
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="bg-gradient-to-r from-[#B5945B] to-[#9A7B46] hover:brightness-110 text-black font-semibold px-4 py-1.5 rounded-full text-xs shadow-[0_0_20px_rgba(181,148,91,0.25)] transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} className="stroke-[3]" />
            <span>Tạo album</span>
          </button>

          {/* Nút chuyển chế độ xem: Kanban ⇄ Lưới (Liquid Glass viền vàng) */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "grid" ? "kanban" : "grid")}
            className="bg-white/[0.04] hover:bg-white/[0.08] border border-[#B5945B]/40 text-[#E2C792] font-medium px-4 py-1.5 rounded-full text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {viewMode === "grid" ? (
              <>
                <Kanban size={14} className="text-[#B5945B]" />
                <span className="hidden sm:inline">Bảng Tiến Độ Hậu Kỳ (Kanban)</span>
                <span className="sm:hidden">Tiến độ</span>
              </>
            ) : (
              <>
                <Grid3X3 size={14} className="text-[#B5945B]" />
                <span className="hidden sm:inline">Danh Sách Album</span>
                <span className="sm:hidden">Album</span>
              </>
            )}
          </button>
        </div>

        {/* Right Side: Help, Bell, VI, Dark/Light, Studio Brand */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="p-1.5 rounded-full text-zinc-400 hover:text-[#E2C792] hover:bg-white/[0.05] transition cursor-pointer"
            title="Trợ giúp quy trình"
          >
            <HelpCircle size={19} />
          </button>

          {/* Chuông thông báo có badge */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                showToast(
                  `Có ${clientSubmittedCount} album khách đã chốt cần lọc file RAW`,
                  "info"
                )
              }
              className="p-1.5 rounded-full text-zinc-400 hover:text-[#E2C792] hover:bg-white/[0.05] transition cursor-pointer"
              title="Thông báo sự kiện mới"
            >
              <Bell size={19} />
            </button>
            {newEventsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-red-500 to-[#e03131] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow animate-pulse">
                {newEventsCount}
              </span>
            )}
          </div>

          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-zinc-300">
            VI
          </span>

          {/* Dark / Light Toggle */}
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
            title={isDarkMode ? "Chuyển giao diện Sáng" : "Chuyển giao diện Dark Luxury"}
          >
            {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
          </button>

          {/* Huy hiệu Studio Admin màu Champagne Gold */}
          <span className="text-[#B5945B] font-semibold text-xs tracking-wide uppercase select-none hidden md:inline">
            BERGH.RYKER ADMIN
          </span>
        </div>
      </nav>

      {/* 2. SUB-TOOLBAR & METRICS BAR CHUẨN STUDIO CAO CẤP */}
      <div
        className={`px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm ${
          isDarkMode ? "bg-[#111115]/90 border-white/[0.06] text-zinc-300" : "bg-white border-slate-200 text-slate-700"
        } border-b backdrop-blur-md`}
      >
        {/* Left indicators */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Dropdown Sắp xếp */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">⇅ Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-semibold text-zinc-200 outline-none cursor-pointer"
            >
              <option value="newest" className="bg-[#181820] text-zinc-100">Mới nhất</option>
              <option value="oldest" className="bg-[#181820] text-zinc-100">Cũ nhất</option>
              <option value="title" className="bg-[#181820] text-zinc-100">Tên A-Z</option>
              <option value="favorites" className="bg-[#181820] text-zinc-100">Nhiều tim nhất</option>
            </select>
          </div>

          <span className="text-white/15">|</span>

          <span>
            Tổng số album đã tạo: <b className="text-white">{totalAlbums}</b>
          </span>
          <span className="hidden md:inline text-white/15">|</span>
          <span className="text-zinc-300">
            Đang chờ khách chọn: <b>{waitingSelectionCount}</b>
          </span>
          <span className="hidden md:inline text-white/15">|</span>
          <span className="text-[#E57373] font-semibold">
            Khách đã chốt (Cần lọc file): <b>{clientSubmittedCount}</b>
          </span>
          <span className="hidden md:inline text-white/15">|</span>
          <span className="text-[#B5945B] font-semibold">
            Đang hậu kỳ: <b>{inProgressCount}</b>
          </span>
        </div>

        {/* Right Search Input - Dark Glass Frame */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Tìm theo tên album, khách, mã booking..."
            className="w-full bg-black/40 border border-white/10 focus:border-[#B5945B] text-zinc-200 placeholder-zinc-500 rounded-xl px-4 py-1.5 text-xs sm:text-sm outline-none transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. CONTENT AREA: LƯỚI THẺ 4 CỘT HOẶC KANBAN 6 CỘT */}
      <div className="p-6">
        {viewMode === "grid" ? (
          /* ================= CHẾ ĐỘ 1: LƯỚI THẺ ALBUM 4 CỘT ================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* THẺ ĐẦU TIÊN CỐ ĐỊNH: Khung kính tối viền nét đứt Vàng Champagne */}
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="aspect-[4/3] bg-gradient-to-b from-white/[0.03] to-transparent border-2 border-dashed border-[#B5945B]/35 hover:border-[#B5945B] hover:bg-[#B5945B]/[0.04] rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group shadow-sm text-left"
            >
              <div className="w-12 h-12 rounded-full bg-[#B5945B]/15 text-[#B5945B] group-hover:scale-110 flex items-center justify-center text-2xl transition shadow-[0_0_15px_rgba(181,148,91,0.2)]">
                <Plus size={28} className="stroke-[2.5]" />
              </div>
              <span className="font-semibold text-white text-sm sm:text-base mt-3">
                Tạo album
              </span>
              <span className="text-zinc-400 text-xs mt-1 text-center px-4">
                Tự động quét Google Drive & Mã Booking
              </span>
            </button>

            {/* CÁC THẺ ALBUM TIẾP THEO */}
            {processedAlbums.map((album) => (
              <AlbumGridCard
                key={album.id}
                album={album}
                isDarkMode={isDarkMode}
                onOpenAlbum={onOpenAlbum}
                onOpenFilterModal={onOpenFilterModal}
                onOpenShareModal={onOpenShareModal}
                onDeleteAlbum={handleDeleteAlbum}
                activeMenuId={activeMenuAlbumId}
                setActiveMenuId={setActiveMenuAlbumId}
              />
            ))}
          </div>
        ) : (
          /* ================= CHẾ ĐỘ 2: BẢNG TIẾN ĐỘ HẬU KỲ (KANBAN PIPELINE 6 CỘT) ================= */
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 items-start pb-12">
            {PIPELINE_COLUMNS.map((col) => {
              const colAlbums = processedAlbums.filter((a) => {
                if (col.id === "new") {
                  return (!a.pipelineStage || a.pipelineStage === "new") && !a.isLocked;
                }
                if (col.id === "client_submitted") {
                  return (
                    a.pipelineStage === "client_submitted" ||
                    (a.isLocked &&
                      a.pipelineStage !== "raw_filtered" &&
                      a.pipelineStage !== "reviewing" &&
                      a.pipelineStage !== "supplementary" &&
                      a.pipelineStage !== "delivered")
                  );
                }
                return a.pipelineStage === col.id;
              });

              return (
                <div
                  key={col.id}
                  className={`rounded-2xl border p-3.5 min-h-[520px] flex flex-col justify-between ${
                    isDarkMode
                      ? "bg-[#121216]/90 border-white/[0.08] backdrop-blur-md"
                      : "bg-slate-100/80 border-slate-200"
                  }`}
                >
                  <div>
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
                      <h3 className={`font-bold text-xs uppercase tracking-tight truncate ${col.color}`}>
                        {col.title}
                      </h3>
                      <span className="w-5 h-5 rounded-full bg-white/[0.08] border border-white/10 text-[#E2C792] text-xs font-bold flex items-center justify-center shadow-xs">
                        {colAlbums.length}
                      </span>
                    </div>

                    {/* Column Cards */}
                    <div className="space-y-3">
                      {colAlbums.map((album) => {
                        const favCount = album.photos?.filter((p) => p.isFavorite).length || 0;
                        const maxLimit = album.maxSelectionCount || 35;
                        const checklist = album.checklist || {
                          rawFiltered: false,
                          colorGraded: false,
                          skinRetouched: false,
                          exported: false,
                          driveUploaded: false,
                        };

                        const completedSteps = Object.values(checklist).filter(Boolean).length;
                        const progressPercent = Math.round((completedSteps / 5) * 100);

                        return (
                          <div
                            key={album.id}
                            className={`p-3.5 rounded-xl border shadow-md transition-all ${
                              isDarkMode
                                ? "bg-[#181820] border-white/10 hover:border-[#B5945B]/50"
                                : "bg-white border-slate-200 hover:border-[#B5945B]/50"
                            }`}
                          >
                            {/* Card Top: Client & Booking Code */}
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4
                                  onClick={() => onOpenAlbum(album.slug || album.id)}
                                  className="font-bold text-sm text-zinc-100 hover:text-[#E2C792] transition cursor-pointer leading-tight"
                                >
                                  {album.clientName}
                                </h4>
                                <span className="text-[11px] text-zinc-400 truncate block mt-0.5">
                                  {album.title}
                                </span>
                              </div>

                              {album.bookingCode && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#B5945B]/15 text-[#E2C792] border border-[#B5945B]/30 shrink-0">
                                  #{album.bookingCode}
                                </span>
                              )}
                            </div>

                            {/* Favorites count & Due date */}
                            <div className="flex items-center justify-between text-xs mt-2.5 pt-2 border-t border-white/10 text-zinc-400">
                              <span className="font-semibold text-rose-400 flex items-center gap-1">
                                <Heart size={13} className="fill-rose-400" />
                                <span>
                                  {favCount}/{maxLimit} ảnh
                                </span>
                              </span>

                              <span className="text-[11px] flex items-center gap-1 text-zinc-400">
                                <Clock size={12} className="text-[#B5945B]" />
                                <span>{album.dueDate ? `Hạn: ${album.dueDate}` : "Chưa đặt hạn"}</span>
                              </span>
                            </div>

                            {/* Checklist Progress Bar */}
                            <div className="mt-2.5">
                              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-medium mb-1">
                                <span>Tiến độ hậu kỳ</span>
                                <span className="font-bold text-[#E2C792]">{progressPercent}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                                <div
                                  className="h-full bg-gradient-to-r from-[#B5945B] to-[#DFB779] transition-all duration-300"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>

                              {/* Interactive mini-checklist */}
                              <div className="grid grid-cols-5 gap-1 mt-2 text-[9px] text-center text-zinc-300 font-medium">
                                <button
                                  type="button"
                                  onClick={() => handleToggleChecklist(album, "rawFiltered")}
                                  className={`p-1 rounded cursor-pointer transition ${
                                    checklist.rawFiltered
                                      ? "bg-[#B5945B]/25 text-[#E2C792] font-bold border border-[#B5945B]/40"
                                      : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
                                  }`}
                                  title="Lọc RAW"
                                >
                                  Lọc
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleChecklist(album, "colorGraded")}
                                  className={`p-1 rounded cursor-pointer transition ${
                                    checklist.colorGraded
                                      ? "bg-[#B5945B]/25 text-[#E2C792] font-bold border border-[#B5945B]/40"
                                      : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
                                  }`}
                                  title="Blend Màu"
                                >
                                  Màu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleChecklist(album, "skinRetouched")}
                                  className={`p-1 rounded cursor-pointer transition ${
                                    checklist.skinRetouched
                                      ? "bg-[#B5945B]/25 text-[#E2C792] font-bold border border-[#B5945B]/40"
                                      : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
                                  }`}
                                  title="Retouch Da"
                                >
                                  Da
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleChecklist(album, "exported")}
                                  className={`p-1 rounded cursor-pointer transition ${
                                    checklist.exported
                                      ? "bg-[#B5945B]/25 text-[#E2C792] font-bold border border-[#B5945B]/40"
                                      : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
                                  }`}
                                  title="Xuất File"
                                >
                                  Xuất
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleChecklist(album, "driveUploaded")}
                                  className={`p-1 rounded cursor-pointer transition ${
                                    checklist.driveUploaded
                                      ? "bg-[#B5945B]/25 text-[#E2C792] font-bold border border-[#B5945B]/40"
                                      : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08]"
                                  }`}
                                  title="Lên Drive"
                                >
                                  Drive
                                </button>
                              </div>
                            </div>

                            {/* Action Buttons on Kanban Card */}
                            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-1.5">
                              {/* Nút Lọc File ngay trên Card */}
                              <button
                                type="button"
                                onClick={() => onOpenFilterModal(album)}
                                className="px-2.5 py-1 rounded-lg bg-[#B5945B]/15 hover:bg-[#B5945B]/25 text-[#E2C792] font-bold text-[11px] flex items-center gap-1 transition cursor-pointer border border-[#B5945B]/30"
                              >
                                <HardDrive size={13} />
                                <span>Lọc file</span>
                              </button>

                              {/* Chuyển cột Dropdown */}
                              <select
                                value={col.id}
                                onChange={(e) =>
                                  handleStageChange(album.id, e.target.value as PipelineStage)
                                }
                                className="text-[10px] font-semibold border border-white/10 rounded-lg px-2 py-1 outline-none cursor-pointer bg-black/60 text-zinc-200"
                              >
                                <option value="new" className="bg-[#181820]">Chờ chọn</option>
                                <option value="client_submitted" className="bg-[#181820]">Đã chốt</option>
                                <option value="raw_filtered" className="bg-[#181820]">Đang sửa</option>
                                <option value="reviewing" className="bg-[#181820]">Chờ duyệt</option>
                                <option value="supplementary" className="bg-[#181820]">Sửa thêm</option>
                                <option value="delivered" className="bg-[#181820]">Đã giao</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}

                      {colAlbums.length === 0 && (
                        <div className="py-10 text-center text-xs text-zinc-500 italic">
                          Chưa có dự án
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL TRỢ GIÚP WORKFLOW - DARK LUXURY */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#121216]/95 border border-[#B5945B]/40 text-zinc-100 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative backdrop-blur-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-base text-[#E2C792] flex items-center gap-2 font-serif">
                <Sparkles size={18} className="text-[#B5945B]" />
                <span>Quy trình Hậu kỳ Bergh.Ryker Studio</span>
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 mt-4 text-xs leading-relaxed text-zinc-300">
              <p>
                <b className="text-white">1. Tạo album:</b> Nhập Mã Booking hoặc chọn từ đơn đã duyệt để tự động điền tên khách, tên album và số ảnh gói.
              </p>
              <p>
                <b className="text-white">2. Khách chọn ảnh:</b> Gửi link hoặc mã QR cho khách chọn ảnh trên điện thoại/máy tính, thả tim ♡ và ghi chú 💬 chỉnh sửa chi tiết.
              </p>
              <p>
                <b className="text-white">3. Lọc file RAW trên máy tính:</b> Bấm nút <b>🌪️ Lọc file</b>, chọn thư mục chứa ảnh gốc và thư mục lưu (hoặc tự tạo DONE), trình duyệt copy trực tiếp các file khớp mã (kể cả .ARW, .CR3, .xmp, .JPG) với tốc độ cao mà không nén ZIP.
              </p>
              <p>
                <b className="text-white">4. Quản lý tiến độ:</b> Dùng chế độ Kanban 6 cột để theo dõi từ lúc nhận yêu cầu đến khi bàn giao link Drive cho khách.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/10 text-right">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#B5945B] to-[#9A7B46] text-black font-bold text-xs hover:brightness-110 transition cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
