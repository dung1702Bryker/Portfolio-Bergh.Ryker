import React, { useState, useEffect } from "react";
import {
  ProofingAlbum,
  subscribeProofingAlbums,
  updateProofingAlbum,
  deleteProofingAlbum,
} from "../../services/proofingService";
import { ShotpikDashboard } from "./ShotpikDashboard";
import { CreateProofingAlbumModal } from "./CreateProofingAlbumModal";
import { LocalFileFilterModal } from "../LocalFileFilterModal";
import { ShareProofingModal } from "../ShareProofingModal";

interface ProofingManagementTabProps {
  onOpenProofingView: (slugOrId: string) => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "warning") => void;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => void;
  onClose?: () => void;
}

export const ProofingManagementTab: React.FC<ProofingManagementTabProps> = ({
  onOpenProofingView,
  showToast,
  triggerConfirm,
  onClose,
}) => {
  const [albums, setAlbums] = useState<ProofingAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filterModalAlbum, setFilterModalAlbum] = useState<ProofingAlbum | null>(null);
  const [shareModalAlbum, setShareModalAlbum] = useState<ProofingAlbum | null>(null);

  // Real-time subscription to proofing albums
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeProofingAlbums((list) => {
      setAlbums(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleFilterSuccess = async () => {
    if (filterModalAlbum) {
      try {
        await updateProofingAlbum(filterModalAlbum.id, {
          pipelineStage: "raw_filtered",
          checklist: {
            rawFiltered: true,
            colorGraded: filterModalAlbum.checklist?.colorGraded || false,
            skinRetouched: filterModalAlbum.checklist?.skinRetouched || false,
            exported: filterModalAlbum.checklist?.exported || false,
            driveUploaded: filterModalAlbum.checklist?.driveUploaded || false,
          },
        });
        showToast("Đã lọc file thành công và cập nhật tiến độ!", "success");
      } catch (e) {
        console.warn("Could not auto-advance pipeline stage:", e);
      }
    }
  };

  return (
    <>
      {/* SHOTPIK STUDIO DASHBOARD WORKSPACE */}
      <ShotpikDashboard
        albums={albums}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenAlbum={(slugOrId) => onOpenProofingView(slugOrId)}
        onOpenFilterModal={(album) => setFilterModalAlbum(album)}
        onOpenShareModal={(album) => setShareModalAlbum(album)}
        onCloseDashboard={() => {
          if (onClose) {
            onClose();
          } else {
            // Default back to main admin overview if available
            window.location.hash = "#admin";
          }
        }}
        showToast={showToast}
        triggerConfirm={triggerConfirm}
      />

      {/* CREATE PROOFING ALBUM MODAL (CLONE HÌNH 1 & 2) */}
      <CreateProofingAlbumModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAlbumCreated={(newAlbum) => {
          showToast(`Đã tạo album "${newAlbum.title}" thành công!`, "success");
        }}
      />

      {/* LOCAL FILE FILTER MODAL (CLONE HÌNH 4 & 5 - DIRECT COPY, NO ZIP) */}
      {filterModalAlbum && (
        <LocalFileFilterModal
          isOpen={true}
          onClose={() => setFilterModalAlbum(null)}
          albumId={filterModalAlbum.id}
          albumTitle={filterModalAlbum.title}
          photos={filterModalAlbum.photos || []}
          tags={filterModalAlbum.tags || []}
          onFilterSuccess={handleFilterSuccess}
        />
      )}

      {/* SHARE MODAL WITH DUAL LINKS & QR CODES */}
      {shareModalAlbum && (
        <ShareProofingModal
          isOpen={true}
          onClose={() => setShareModalAlbum(null)}
          album={shareModalAlbum}
          showToast={showToast}
        />
      )}
    </>
  );
};
