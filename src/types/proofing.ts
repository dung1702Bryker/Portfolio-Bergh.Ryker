export interface ProofingPhotoComment {
  id: string;
  photoId?: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface ProofingPhoto {
  id: string;
  fileName: string;
  baseName: string; // e.g. "NDD03604"
  driveFileId?: string;
  url: string;
  thumbnailUrl?: string;
  originalUrl?: string;
  hdUrl?: string;
  subFolder?: string;
  isFavorite: boolean;
  isStarred: boolean;
  comments: ProofingPhotoComment[];
}

export interface ProofingSettings {
  allowComments?: boolean;
  enableWatermark?: boolean;
  watermarkText?: string;
  showNameCard?: boolean;
  passwordProtected?: boolean;
  password?: string;
  allowDownload?: boolean;
  limitSelection?: boolean;
  maxSelectionCount?: number;
  clientReminderEnabled?: boolean;
  clientReminderText?: string;
}

export type PipelineStage = 
  | 'new'               // 1. Mới tạo / Chờ khách chọn
  | 'client_submitted'  // 2. Khách đã chốt (Cần lọc RAW)
  | 'raw_filtered'      // 3. Đã lọc file / Đang Blend & Retouch
  | 'reviewing'         // 4. Chờ khách duyệt ảnh sửa
  | 'supplementary'     // 5. Chỉnh sửa bổ sung
  | 'delivered';        // 6. Đã bàn giao hoàn tất

export interface PipelineChecklist {
  rawFiltered: boolean;
  colorGraded: boolean;
  skinRetouched: boolean;
  exported: boolean;
  driveUploaded: boolean;
}

export interface ProofingAlbum {
  id: string;
  title: string;
  clientName: string;
  clientPhone?: string;
  bookingCode?: string;
  slug: string;
  tags: string[];
  isLocked: boolean;
  pipelineStage?: PipelineStage;
  dueDate?: string; // Hạn trả ảnh (ISO string or YYYY-MM-DD)
  checklist?: PipelineChecklist;
  finalDriveUrl?: string; // Link Drive ảnh hoàn thiện bàn giao
  photos: ProofingPhoto[];
  createdAt: string;
  updatedAt?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  coverImageFileId?: string;
  coverPhotoUrl?: string;
  passwordProtected?: boolean;
  password?: string;
  conceptName?: string;
  packageName?: string;
  clientSubmittedAt?: string;
  clientSubmitNotes?: string;
  
  // Settings support at root or inside settings
  settings?: ProofingSettings;
  clientReminderEnabled?: boolean;
  clientReminderText?: string;
  allowComments?: boolean;
  enableWatermark?: boolean;
  watermarkText?: string;
  showNameCard?: boolean;
  allowDownload?: boolean;
  limitSelection?: boolean;
  maxSelectionCount?: number;
}
