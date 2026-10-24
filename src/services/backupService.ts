import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db, cleanFirestoreData, isFirestoreQuotaExceeded, markFirestoreQuotaExceeded } from "../firebase";

export interface MasterBackupCollections {
  albums?: Array<{ id: string; [key: string]: any; photos?: any[] }>;
  prom_albums?: Array<{ id: string; [key: string]: any; photos?: any[] }>;
  freedom_albums?: Array<{ id: string; [key: string]: any; photos?: any[] }>;
  bookings?: any[];
  availableDates?: any[];
  slidesConfig?: any[];
  introConfig?: any;
  systemBackupVault?: any;
}

export interface MasterBackupPayload {
  version: "1.0";
  app: "Bergh.Ryker Studio";
  exportDate: string;
  timestamp: number;
  collections: MasterBackupCollections;
  summary: {
    totalAlbums: number;
    totalPhotos: number;
    totalBookings: number;
    totalAvailableDates: number;
    hasSlides: boolean;
    hasIntro: boolean;
  };
}

export interface SystemBackupVaultData {
  timestamp: number;
  updatedAtIso: string;
  trigger: string;
  slides?: any[];
  introConfig?: any;
  founderS7?: any;
  albumsSummary?: Array<{ collection: string; id: string; title: string; photoCount: number; coverImageSrc?: string }>;
  stats?: {
    totalAlbums: number;
    totalPhotos: number;
  };
}

const LOCAL_VAULT_KEY = "bergh_ryker_system_backup_vault";

// Debounce state for auto backup
let autoBackupTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingBackupData: Partial<SystemBackupVaultData> = {};

/**
 * Record an automated background backup into doc(db, 'appStore', 'systemBackupVault')
 * and local storage vault.
 */
export async function recordAutoBackup(
  trigger: string,
  extraData?: Partial<SystemBackupVaultData>
): Promise<void> {
  // Merge pending changes
  pendingBackupData = {
    ...pendingBackupData,
    ...extraData,
    trigger,
    timestamp: Date.now(),
    updatedAtIso: new Date().toISOString(),
  };

  // Extract founder S7 if slides are provided
  if (pendingBackupData.slides && Array.isArray(pendingBackupData.slides)) {
    const s7 = pendingBackupData.slides.find((s: any) => s.id === "S7");
    if (s7) {
      pendingBackupData.founderS7 = s7;
    }
  }

  // Save to local vault immediately as fail-safe
  try {
    localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(pendingBackupData));
  } catch (err) {
    console.warn("Could not save to local backup vault:", err);
  }

  // Debounce Firestore write by 2 seconds to prevent excessive writes
  if (autoBackupTimeout) {
    clearTimeout(autoBackupTimeout);
  }

  autoBackupTimeout = setTimeout(async () => {
    try {
      if (isFirestoreQuotaExceeded()) return;

      const payload = cleanFirestoreData({
        ...pendingBackupData,
        timestamp: Date.now(),
        updatedAtIso: new Date().toISOString(),
      });

      // Guard 900KB Firestore single document limit
      const jsonStr = JSON.stringify(payload);
      if (jsonStr.length < 900000) {
        await setDoc(doc(db, "appStore", "systemBackupVault"), payload, { merge: true });
      } else {
        console.warn(`[Vault] Payload too large for single doc (${jsonStr.length} bytes). Kept in local vault.`);
      }
    } catch (err: any) {
      if (err?.code === "resource-exhausted" || err?.message?.includes("Quota")) {
        markFirestoreQuotaExceeded();
      } else {
        console.warn("[Vault] Could not sync systemBackupVault to Firestore:", err);
      }
    }
  }, 2000);
}

/**
 * Get the latest system backup vault from Firestore or LocalStorage.
 */
export async function getSystemBackupVault(): Promise<SystemBackupVaultData | null> {
  // 1. Try reading from Firestore
  try {
    if (!isFirestoreQuotaExceeded()) {
      const snap = await getDoc(doc(db, "appStore", "systemBackupVault"));
      if (snap.exists()) {
        const data = snap.data() as SystemBackupVaultData;
        if (data && (data.slides || data.founderS7 || data.albumsSummary)) {
          // Update local cache
          try {
            localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(data));
          } catch (_) {}
          return data;
        }
      }
    }
  } catch (err: any) {
    if (err?.code === "resource-exhausted" || err?.message?.includes("Quota")) {
      markFirestoreQuotaExceeded();
    }
  }

  // 2. Fallback to LocalStorage vault
  try {
    const raw = localStorage.getItem(LOCAL_VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as SystemBackupVaultData;
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Fetch all albums and their nested 'photos' subcollections for a given collection name.
 */
async function fetchCollectionWithPhotos(collectionName: "albums" | "prom_albums" | "freedom_albums") {
  const result: Array<{ id: string; [key: string]: any; photos: any[] }> = [];
  try {
    const albumsSnap = await getDocs(collection(db, collectionName));
    for (const albumDoc of albumsSnap.docs) {
      const albumData = { id: albumDoc.id, ...albumDoc.data() } as any;
      const photos: any[] = [];
      try {
        const photosSnap = await getDocs(collection(db, collectionName, albumDoc.id, "photos"));
        for (const pDoc of photosSnap.docs) {
          photos.push({ id: pDoc.id, ...pDoc.data() });
        }
      } catch (pErr) {
        console.warn(`Could not read photos for ${collectionName}/${albumDoc.id}:`, pErr);
      }
      albumData.photos = photos;
      result.push(albumData);
    }
  } catch (err) {
    console.warn(`Could not fetch collection ${collectionName}:`, err);
  }
  return result;
}

/**
 * Nút 1: Gom toàn bộ dữ liệu thật hiện có từ Firestore và tải xuống file JSON
 */
export async function exportMasterBackupJSON(): Promise<{
  filename: string;
  summary: MasterBackupPayload["summary"];
  data: MasterBackupPayload;
}> {
  let totalPhotos = 0;

  // 1. Fetch photo albums & photos
  const [albums, prom_albums, freedom_albums] = await Promise.all([
    fetchCollectionWithPhotos("albums"),
    fetchCollectionWithPhotos("prom_albums"),
    fetchCollectionWithPhotos("freedom_albums"),
  ]);

  totalPhotos += albums.reduce((acc, a) => acc + (a.photos?.length || 0), 0);
  totalPhotos += prom_albums.reduce((acc, a) => acc + (a.photos?.length || 0), 0);
  totalPhotos += freedom_albums.reduce((acc, a) => acc + (a.photos?.length || 0), 0);

  // 2. Fetch slidesConfig
  let slidesConfig: any[] = [];
  try {
    const slidesSnap = await getDoc(doc(db, "appStore", "slidesConfig"));
    if (slidesSnap.exists()) {
      slidesConfig = slidesSnap.data()?.slides || [];
    }
  } catch (e) {
    console.warn("Could not read slidesConfig:", e);
  }

  // 3. Fetch introConfig
  let introConfig: any = null;
  try {
    const introSnap = await getDoc(doc(db, "configs", "introConfig"));
    if (introSnap.exists()) {
      introConfig = introSnap.data();
    } else {
      const altSnap = await getDoc(doc(db, "appStore", "introConfig"));
      if (altSnap.exists()) introConfig = altSnap.data();
    }
  } catch (e) {
    console.warn("Could not read introConfig:", e);
  }

  // 4. Fetch bookings
  const bookings: any[] = [];
  try {
    const bookingsSnap = await getDocs(collection(db, "bookings"));
    bookingsSnap.forEach((bDoc) => {
      bookings.push({ id: bDoc.id, ...bDoc.data() });
    });
  } catch (e) {
    console.warn("Could not read bookings:", e);
  }

  // 5. Fetch availableDates
  const availableDates: any[] = [];
  try {
    const datesSnap = await getDocs(collection(db, "availableDates"));
    datesSnap.forEach((dDoc) => {
      availableDates.push({ id: dDoc.id, ...dDoc.data() });
    });
  } catch (e) {
    console.warn("Could not read availableDates:", e);
  }

  // 6. Fetch vault snapshot
  let systemBackupVault: any = null;
  try {
    const vaultSnap = await getDoc(doc(db, "appStore", "systemBackupVault"));
    if (vaultSnap.exists()) {
      systemBackupVault = vaultSnap.data();
    }
  } catch (_) {}

  const summary = {
    totalAlbums: albums.length + prom_albums.length + freedom_albums.length,
    totalPhotos,
    totalBookings: bookings.length,
    totalAvailableDates: availableDates.length,
    hasSlides: slidesConfig.length > 0,
    hasIntro: !!introConfig,
  };

  const payload: MasterBackupPayload = {
    version: "1.0",
    app: "Bergh.Ryker Studio",
    exportDate: new Date().toISOString(),
    timestamp: Date.now(),
    collections: {
      albums,
      prom_albums,
      freedom_albums,
      bookings,
      availableDates,
      slidesConfig,
      introConfig,
      systemBackupVault,
    },
    summary,
  };

  // Format file name: bergh-ryker-backup-YYYY-MM-DD.json
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `bergh-ryker-backup-${dateStr}.json`;

  // Trigger download
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  // Also update local and cloud vault
  await recordAutoBackup("manual_master_export", {
    slides: slidesConfig,
    introConfig,
    stats: {
      totalAlbums: summary.totalAlbums,
      totalPhotos: summary.totalPhotos,
    },
  });

  return { filename, summary, data: payload };
}

/**
 * Nút 2: Khôi phục toàn bộ dữ liệu từ file backup JSON vào Cloud Firestore
 */
export async function importMasterBackupJSON(
  jsonContent: string,
  onProgress?: (msg: string, percent: number) => void
): Promise<{
  restoredAlbums: number;
  restoredPhotos: number;
  restoredBookings: number;
  restoredDates: number;
  restoredSlides: number;
}> {
  const parsed = JSON.parse(jsonContent);

  // Support both direct MasterBackupPayload and loose collection exports
  const collections: MasterBackupCollections = parsed.collections || parsed;

  let restoredAlbums = 0;
  let restoredPhotos = 0;
  let restoredBookings = 0;
  let restoredDates = 0;
  let restoredSlides = 0;

  onProgress?.("Bắt đầu khôi phục dữ liệu...", 5);

  // 1. Restore slidesConfig
  if (collections.slidesConfig && Array.isArray(collections.slidesConfig) && collections.slidesConfig.length > 0) {
    onProgress?.("Đang khôi phục cấu hình Slides & ảnh Founder S7...", 15);
    try {
      await setDoc(doc(db, "appStore", "slidesConfig"), {
        slides: collections.slidesConfig,
      });
      restoredSlides = collections.slidesConfig.length;
    } catch (e) {
      console.error("Lỗi khôi phục slidesConfig:", e);
    }
  }

  // 2. Restore introConfig
  if (collections.introConfig) {
    onProgress?.("Đang khôi phục Cinematic Intro...", 25);
    try {
      const cleanIntro = cleanFirestoreData(collections.introConfig);
      await setDoc(doc(db, "configs", "introConfig"), cleanIntro, { merge: true });
      await setDoc(doc(db, "appStore", "introConfig"), cleanIntro, { merge: true });
    } catch (e) {
      console.error("Lỗi khôi phục introConfig:", e);
    }
  }

  // Helper to restore album collection
  const restoreAlbumCollection = async (
    collectionName: "albums" | "prom_albums" | "freedom_albums",
    albumsList?: any[]
  ) => {
    if (!albumsList || !Array.isArray(albumsList)) return;
    for (const item of albumsList) {
      const { id, photos, ...albumMeta } = item;
      const albumId = id || `album-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const albumRef = doc(db, collectionName, albumId);

      // Clean meta and write
      const cleanMeta = cleanFirestoreData({
        ...albumMeta,
        id: albumId,
        photoCount: Array.isArray(photos) ? photos.length : albumMeta.photoCount || 0,
      });
      await setDoc(albumRef, cleanMeta);
      restoredAlbums++;

      // Write photos subcollection
      if (Array.isArray(photos)) {
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const photoId = photo.id || `photo-${i}-${Date.now()}`;
          const photoRef = doc(db, collectionName, albumId, "photos", photoId);
          await setDoc(photoRef, cleanFirestoreData({
            ...photo,
            id: photoId,
            order: photo.order !== undefined ? photo.order : i,
          }));
          restoredPhotos++;
        }
      }
    }
  };

  // 3. Restore albums
  onProgress?.("Đang khôi phục Album Kỷ yếu học sinh (albums)...", 40);
  await restoreAlbumCollection("albums", collections.albums);

  // 4. Restore prom_albums
  onProgress?.("Đang khôi phục Album Sự kiện & Prom (prom_albums)...", 60);
  await restoreAlbumCollection("prom_albums", collections.prom_albums);

  // 5. Restore freedom_albums
  onProgress?.("Đang khôi phục Album Cá nhân & Nghệ thuật (freedom_albums)...", 75);
  await restoreAlbumCollection("freedom_albums", collections.freedom_albums);

  // 6. Restore bookings
  if (collections.bookings && Array.isArray(collections.bookings)) {
    onProgress?.("Đang khôi phục danh sách lịch đặt (bookings)...", 85);
    for (const b of collections.bookings) {
      if (b.id) {
        try {
          await setDoc(doc(db, "bookings", b.id), cleanFirestoreData(b));
          restoredBookings++;
        } catch (e) {
          console.warn(`Lỗi phục hồi booking ${b.id}:`, e);
        }
      }
    }
  }

  // 7. Restore availableDates
  if (collections.availableDates && Array.isArray(collections.availableDates)) {
    onProgress?.("Đang khôi phục trạng thái ngày (availableDates)...", 92);
    for (const d of collections.availableDates) {
      const dateId = d.id || d.date;
      if (dateId) {
        try {
          await setDoc(doc(db, "availableDates", dateId), cleanFirestoreData(d));
          restoredDates++;
        } catch (e) {
          console.warn(`Lỗi phục hồi date ${dateId}:`, e);
        }
      }
    }
  }

  // 8. Update system backup vault
  onProgress?.("Cập nhật chốt chặn System Backup Vault...", 98);
  await recordAutoBackup("manual_master_import", {
    slides: collections.slidesConfig,
    introConfig: collections.introConfig,
    stats: {
      totalAlbums: restoredAlbums,
      totalPhotos: restoredPhotos,
    },
  });

  onProgress?.("Hoàn tất khôi phục 100%!", 100);

  return {
    restoredAlbums,
    restoredPhotos,
    restoredBookings,
    restoredDates,
    restoredSlides,
  };
}

/**
 * Nút 4: Tạo đoạn code chuẩn TypeScript / JSON của toàn bộ ảnh và album hiện tại
 * để có thể dán thẳng vào src/data/contentData.ts để khóa chết vào mã nguồn.
 */
export async function generateContentDataCode(currentSlides?: any[]): Promise<string> {
  // 1. Gather all collections
  const [albums, prom_albums, freedom_albums] = await Promise.all([
    fetchCollectionWithPhotos("albums"),
    fetchCollectionWithPhotos("prom_albums"),
    fetchCollectionWithPhotos("freedom_albums"),
  ]);

  // 2. Gather slides
  let slides = currentSlides;
  if (!slides || slides.length === 0) {
    try {
      const slidesSnap = await getDoc(doc(db, "appStore", "slidesConfig"));
      if (slidesSnap.exists()) {
        slides = slidesSnap.data()?.slides;
      }
    } catch (_) {}
  }

  const exportPayload = {
    slides: slides || [],
    portfolioCollections: {
      albums,
      prom_albums,
      freedom_albums,
    },
    exportedAt: new Date().toISOString(),
  };

  const codeString = `// ============================================================================
// DỮ LIỆU GỐC ĐƯỢC ĐÓNG BĂNG TỪ FIRESTORE (FREEZE TO CODE)
// Được xuất lúc: ${new Date().toLocaleString("vi-VN")}
// Dán toàn bộ nội dung dưới đây vào: src/data/contentData.ts
// ============================================================================

export const contentData = ${JSON.stringify(exportPayload, null, 2)};

export default contentData;
`;

  return codeString;
}
