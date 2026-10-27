import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, getAccessToken, googleSignIn } from "../firebase";
import firebaseConfig from "../../firebase-applet-config.json";
import { 
  ProofingAlbum as ProofingAlbumType, 
  ProofingPhoto as ProofingPhotoType, 
  ProofingPhotoComment as ProofingPhotoCommentType,
  PipelineStage,
  PipelineChecklist
} from "../types/proofing";

export type ProofingAlbum = ProofingAlbumType;
export type ProofingPhoto = ProofingPhotoType;
export type ProofingPhotoComment = ProofingPhotoCommentType;
export type { PipelineStage, PipelineChecklist };

const COLLECTION_NAME = "proofing_albums";

export const extractBaseName = (fileName: string): string => {
  if (!fileName) return "";
  const nameOnly = fileName.split(/[/\\]/).pop() || fileName;
  const base = nameOnly.split(".")[0];
  return base.startsWith("_") ? base.substring(1).trim().toUpperCase() : base.trim().toUpperCase();
};

export const getDriveDirectImageUrl = (fileId: string): string => {
  return `https://lh3.googleusercontent.com/d/${fileId}=s2048`;
};

export const getDriveGridImageUrl = (fileId: string): string => {
  return `https://lh3.googleusercontent.com/d/${fileId}=s2048`;
};

export const getDriveOriginalImageUrl = (fileId: string): string => {
  return `https://lh3.googleusercontent.com/d/${fileId}=s0`;
};

export const getDriveFallbackUrl = (fileId: string, size = 2048): string => {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
};

export const getDriveExportViewUrl = (fileId: string): string => {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
};

export const parseDriveFolderId = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) return dMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
};

/**
 * Recursively cleans and removes any keys or array items with `undefined` values,
 * ensuring Firestore never encounters `Unsupported field value: undefined`.
 */
export const cleanFirestoreData = <T>(obj: T): T => {
  if (obj === undefined) {
    return null as unknown as T;
  }
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !(value instanceof Date)) {
        result[key] = cleanFirestoreData(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
};

/**
 * Ensures every photo and comment object conforms to strict defined structures,
 * eliminating any possibility of `undefined` field values reaching Firestore.
 */
export const sanitizeProofingPhotos = (photos: (ProofingPhoto | any)[]): ProofingPhoto[] => {
  if (!Array.isArray(photos)) return [];
  return photos
    .filter((p) => p && typeof p === "object")
    .map((p) => {
      const fileId = p.driveFileId || p.id || "";
      const fileName = p.fileName || "photo.jpg";
      const baseName = p.baseName || extractBaseName(fileName);
      const url = p.url || (fileId ? getDriveGridImageUrl(fileId) : "");

      const comments = Array.isArray(p.comments)
        ? p.comments
            .filter((c: any) => c && typeof c === "object")
            .map((c: any) => ({
              id: String(c.id || `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
              photoId: String(c.photoId || p.id || fileId || ""),
              author: String(c.author || "Khách hàng"),
              text: String(c.text || ""),
              createdAt: String(c.createdAt || new Date().toISOString()),
            }))
        : [];

      return {
        id: String(p.id || fileId || `photo_${Date.now()}`),
        fileName: String(fileName),
        baseName: String(baseName),
        driveFileId: String(fileId),
        url: String(url),
        thumbnailUrl: String(p.thumbnailUrl || url),
        originalUrl: String(p.originalUrl || (fileId ? getDriveOriginalImageUrl(fileId) : url)),
        hdUrl: String(p.hdUrl || (fileId ? getDriveFallbackUrl(fileId, 4096) : url)),
        subFolder: String(p.subFolder || ""),
        isFavorite: Boolean(p.isFavorite),
        isStarred: Boolean(p.isStarred),
        comments,
      };
    });
};

export const createProofingAlbum = async (album: Omit<ProofingAlbum, "id" | "createdAt" | "photos"> & { photos?: ProofingPhoto[] }) => {
  const initialChecklist: PipelineChecklist = {
    rawFiltered: false,
    colorGraded: false,
    skinRetouched: false,
    exported: false,
    driveUploaded: false
  };

  const rawPayload = {
    ...album,
    title: album.title || "",
    clientName: album.clientName || "",
    clientPhone: album.clientPhone || "",
    bookingCode: album.bookingCode || "",
    slug: album.slug || "",
    tags: album.tags || [],
    driveFolderUrl: album.driveFolderUrl || "",
    driveFolderId: album.driveFolderId || "",
    finalDriveUrl: album.finalDriveUrl || "",
    createdAt: new Date().toISOString(),
    photos: sanitizeProofingPhotos(album.photos || []),
    isLocked: album.isLocked || false,
    pipelineStage: album.pipelineStage || 'new',
    checklist: album.checklist || initialChecklist,
    dueDate: album.dueDate || "",
    passwordProtected: !!album.passwordProtected,
    password: album.password || "",
    clientReminderEnabled: !!album.clientReminderEnabled,
    clientReminderText: album.clientReminderText || "",
    allowComments: album.allowComments !== undefined ? album.allowComments : true,
    enableWatermark: album.enableWatermark !== undefined ? album.enableWatermark : false,
    watermarkText: album.watermarkText || "BERGH RYKER STUDIO",
    showNameCard: !!album.showNameCard,
    allowDownload: !!album.allowDownload,
    limitSelection: !!album.limitSelection,
    maxSelectionCount: Number(album.maxSelectionCount) || 35,
  };

  const cleanedPayload = cleanFirestoreData(rawPayload);

  return await addDoc(collection(db, COLLECTION_NAME), cleanedPayload);
};

export const subscribeProofingAlbums = (callback: (albums: ProofingAlbum[]) => void) => {
  const colRef = collection(db, COLLECTION_NAME);
  return onSnapshot(colRef, (snapshot) => {
    const albums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProofingAlbum));
    albums.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    callback(albums);
  }, (err) => {
    console.error("Error subscribing proofing albums:", err);
    callback([]);
  });
};

export const subscribeSingleProofingAlbum = (idOrSlug: string, callback: (album: ProofingAlbum | null) => void) => {
  if (!idOrSlug) {
    callback(null);
    return () => {};
  }
  const clean = idOrSlug.trim();
  
  // Try direct document ID lookup first
  const docRef = doc(db, COLLECTION_NAME, clean);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as ProofingAlbum);
    } else {
      // Query by slug fallback
      const q = query(collection(db, COLLECTION_NAME), where("slug", "==", clean));
      getDocs(q).then((querySnap) => {
        if (!querySnap.empty) {
          const d = querySnap.docs[0];
          callback({ id: d.id, ...d.data() } as ProofingAlbum);
        } else {
          // Query by bookingCode fallback
          const bq = query(collection(db, COLLECTION_NAME), where("bookingCode", "==", clean));
          getDocs(bq).then((bSnap) => {
            if (!bSnap.empty) {
              const d = bSnap.docs[0];
              callback({ id: d.id, ...d.data() } as ProofingAlbum);
            } else {
              callback(null);
            }
          }).catch(() => callback(null));
        }
      }).catch((e) => {
        console.warn("Slug query warning:", e);
        callback(null);
      });
    }
  }, (err) => {
    const q = query(collection(db, COLLECTION_NAME), where("slug", "==", clean));
    getDocs(q).then((querySnap) => {
      if (!querySnap.empty) {
        const d = querySnap.docs[0];
        callback({ id: d.id, ...d.data() } as ProofingAlbum);
      } else {
        callback(null);
      }
    }).catch(() => callback(null));
  });
};

export const submitClientProofingSelection = async (
  albumId: string, 
  payload: {
    photos: ProofingPhoto[];
    notes?: string;
    lockAfterSubmit?: boolean;
  }
) => {
  if (!albumId) {
    throw new Error("ID album không hợp lệ khi gửi chọn ảnh");
  }
  const now = new Date().toISOString();
  const safePhotos = sanitizeProofingPhotos(payload.photos || []);
  const safeNotes = typeof payload.notes === "string" ? payload.notes : "";
  const safeLock = payload.lockAfterSubmit !== undefined ? Boolean(payload.lockAfterSubmit) : true;

  const updatePayload = cleanFirestoreData({
    photos: safePhotos,
    clientSubmitNotes: safeNotes,
    clientSubmittedAt: now,
    isLocked: safeLock,
    pipelineStage: 'client_submitted' as PipelineStage,
    updatedAt: now,
  });

  await updateDoc(doc(db, COLLECTION_NAME, albumId), updatePayload);

  // Ghi nhận thông báo cho Admin
  try {
    const favoriteCount = safePhotos.filter((p) => p.isFavorite).length;
    await addDoc(
      collection(db, "admin_notifications"),
      cleanFirestoreData({
        title: "Khách hàng đã chốt chọn ảnh",
        message: `Khách đã chọn ${favoriteCount} ảnh và gửi yêu cầu chỉnh sửa.`,
        albumId,
        type: "proofing_selection",
        createdAt: now,
        read: false,
      })
    );
  } catch (err) {
    console.warn("Could not log admin notification:", err);
  }
};

export const updateProofingAlbum = async (id: string, data: Partial<ProofingAlbum>) => {
  if (!id) {
    throw new Error("ID album không hợp lệ khi cập nhật");
  }
  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = { ...data, updatedAt: now };
  if (data.photos) {
    updatePayload.photos = sanitizeProofingPhotos(data.photos);
  }
  const cleaned = cleanFirestoreData(updatePayload);
  await updateDoc(doc(db, COLLECTION_NAME, id), cleaned);
};

export const updateAlbumPipelineStage = async (id: string, stage: PipelineStage) => {
  if (!id) return;
  const now = new Date().toISOString();
  const cleaned = cleanFirestoreData({
    pipelineStage: stage,
    updatedAt: now,
  });
  await updateDoc(doc(db, COLLECTION_NAME, id), cleaned);
};

export const updateAlbumChecklist = async (id: string, checklist: Partial<PipelineChecklist>) => {
  if (!id) return;
  const now = new Date().toISOString();
  const docRef = doc(db, COLLECTION_NAME, id);
  const cleaned = cleanFirestoreData({
    checklist,
    updatedAt: now,
  });
  await updateDoc(docRef, cleaned);
};

export const deleteProofingAlbum = async (id: string) => {
  if (!id) {
    throw new Error("ID album không hợp lệ");
  }
  await deleteDoc(doc(db, COLLECTION_NAME, id));
};

/**
 * Quét file từ Google Drive qua Google Drive v3 API (nếu có accessToken)
 */
/**
 * Multi-Strategy Recursive Google Drive Folder Scanner:
 * 1. Automatic token resolution (OAuth token with auto-sign-in fallback or API key)
 * 2. Recursive subfolder traversal (e.g. JPG, Edited, RAW, Selections)
 * 3. Pagination support (all > 1000 items)
 * 4. High-resolution (Retina 2K & 100% Original Uncompressed) URL generation
 */
export const fetchDriveFolderImages = async (
  folderIdOrUrl: string,
  providedToken?: string | null,
  onProgress?: (message: string, count: number) => void
): Promise<ProofingPhoto[]> => {
  const folderId = parseDriveFolderId(folderIdOrUrl);
  if (!folderId) {
    throw new Error("Không thể tìm thấy Folder ID hợp lệ từ đường dẫn Google Drive.");
  }

  // 1. Resolve Access Token
  let token = providedToken || (await getAccessToken());
  if (!token) {
    try {
      const signResult = await googleSignIn();
      token = signResult?.accessToken || null;
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        console.warn("Google sign-in attempt warning:", err);
      }
    }
  }

  const apiKey = (import.meta as any).env?.VITE_GOOGLE_API_KEY || (firebaseConfig as any)?.apiKey || "";

  if (!token && !apiKey) {
    throw new Error("Cần đăng nhập Google hoặc cung cấp API Key để quét tệp từ Google Drive");
  }

  const folderQueue: { id: string; path: string }[] = [{ id: folderId, path: "" }];
  const visitedFolders = new Set<string>();
  const allPhotos: ProofingPhoto[] = [];

  let folderCount = 0;
  const maxFoldersToScan = 50;

  while (folderQueue.length > 0 && folderCount < maxFoldersToScan) {
    const current = folderQueue.shift()!;
    if (visitedFolders.has(current.id)) continue;
    visitedFolders.add(current.id);
    folderCount++;

    const folderLabel = current.path ? `thư mục "${current.path}"` : "thư mục gốc";
    if (onProgress) {
      onProgress(`Đang quét ${folderLabel}... (đã nhận diện ${allPhotos.length} ảnh)`, allPhotos.length);
    }

    let pageToken = "";
    const queryParam = encodeURIComponent(`'${current.id}' in parents and trashed = false`);
    const fields = encodeURIComponent(
      "nextPageToken, files(id, name, mimeType, size, thumbnailLink, webContentLink, imageMediaMetadata)"
    );

    do {
      let url = `https://www.googleapis.com/drive/v3/files?q=${queryParam}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=name`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }
      if (!token && apiKey) {
        url += `&key=${encodeURIComponent(apiKey)}`;
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(url, { headers });

      if (!res.ok) {
        // If 401 unauthorized, attempt one-time token refresh via login
        if (res.status === 401 && !providedToken) {
          try {
            const signResult = await googleSignIn();
            if (signResult?.accessToken) {
              token = signResult.accessToken;
              headers["Authorization"] = `Bearer ${token}`;
              const retryRes = await fetch(url, { headers });
              if (retryRes.ok) {
                const data = await retryRes.json();
                const files = data.files || [];
                processFiles(files, current.path, folderQueue, allPhotos);
                pageToken = data.nextPageToken || "";
                continue;
              }
            }
          } catch (_) {}
        }

        const errText = await res.text();
        console.warn(`Drive query error for folder ${current.id}: ${errText}`);
        break;
      }

      const data = await res.json();
      const files = data.files || [];
      processFiles(files, current.path, folderQueue, allPhotos);

      if (onProgress) {
        onProgress(`Đang xử lý ${folderLabel}... (đã tìm thấy ${allPhotos.length} ảnh)`, allPhotos.length);
      }

      pageToken = data.nextPageToken || "";
    } while (pageToken);
  }

  // Sort natural by fileName (e.g. NDD03604, NDD03605...)
  allPhotos.sort((a, b) =>
    a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: "base" })
  );

  if (onProgress) {
    onProgress(`Hoàn tất! Tổng cộng ${allPhotos.length} ảnh đã được nạp.`, allPhotos.length);
  }

  return allPhotos;
};

// Helper to filter and classify files from Google Drive
function processFiles(
  files: any[],
  currentPath: string,
  folderQueue: { id: string; path: string }[],
  allPhotos: ProofingPhoto[]
) {
  for (const f of files) {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      const nextPath = currentPath ? `${currentPath}/${f.name}` : f.name;
      folderQueue.push({ id: f.id, path: nextPath });
      continue;
    }

    const isImage =
      (f.mimeType && f.mimeType.startsWith("image/")) ||
      /\.(jpe?g|png|webp|heic|raw|cr2|cr3|nef|arw|dng|tif|tiff)$/i.test(f.name);

    if (isImage) {
      const base = extractBaseName(f.name);
      allPhotos.push({
        id: f.id,
        driveFileId: f.id,
        fileName: f.name,
        baseName: base,
        subFolder: currentPath || "",
        url: getDriveGridImageUrl(f.id),
        thumbnailUrl: getDriveGridImageUrl(f.id),
        originalUrl: getDriveOriginalImageUrl(f.id),
        hdUrl: getDriveFallbackUrl(f.id, 4096),
        isFavorite: false,
        isStarred: false,
        comments: [],
      });
    }
  }
}
