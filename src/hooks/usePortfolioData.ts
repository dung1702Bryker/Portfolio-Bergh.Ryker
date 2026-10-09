import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  runTransaction,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  db,
  handleFirestoreError,
  OperationType,
  isFirestoreQuotaExceeded,
  markFirestoreQuotaExceeded,
} from "../firebase";
import { validateUrl } from "../utils/validateUrl";
import { ImageResolutions, createResolutionsFromUrl } from "../utils/imageMapper";

export type AllowedCollection = "albums" | "prom_albums" | "freedom_albums";

export interface CustomPhoto {
  id?: string;
  src: string;
  resolutions?: ImageResolutions;
  thumbnail?: string;
  medium?: string;
  original?: string;
  alt: string;
  title: string;
  focal: string;
  iso: string;
  desc: string;
  galleryImages?: string[];
  order?: number;
  objectPosition?: string;
  imagePosition?: string;
  aspectRatio?: string;
  imageScale?: number;
}

export interface CustomCollection {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  driveLink: string;
  images: CustomPhoto[];
  coverImageSrc?: string;
  coverImageResolutions?: ImageResolutions;
  coverImagePosition?: string;
  order?: number;
  deletedAt?: Date | null;
  isHidden?: boolean;
}

export function formatDisplayName(text: string): string {
  if (!text) return "";
  let result = text;
  result = result.replace(/MELBOURNE POLYTECHNICH VIET NAM/gi, "Melbourne Polytechnic Vietnam");
  result = result.replace(/MELBOURNE POLYTECHNICH/gi, "Melbourne Polytechnic");
  result = result.replace(/POLYTECHNICH/gi, "Polytechnic");
  result = result.replace(/CONCEPT _ TỰ DO/gi, "Concept Tự Do");
  result = result.replace(/CONCEPT_TUDO/gi, "Concept Tự Do");
  return result;
}

export function usePortfolioData(
  firestoreCollection: AllowedCollection,
  defaultSeeds?: CustomCollection[],
  isAdminGlobal?: boolean,
) {
  const cacheKey = `bergh_cached_portfolio_${firestoreCollection}`;
  const [collectionsData, setCollectionsData] = useState<CustomCollection[]>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return defaultSeeds && defaultSeeds.length > 0 ? defaultSeeds : [];
  });
  const [loading, setLoading] = useState(false);

  const photoUnsubsRef = useRef<{ [albumId: string]: () => void }>({});

  // Read albums and photos
  useEffect(() => {
    const albumsRef = collection(db, firestoreCollection);

    const unsubscribe = onSnapshot(
      albumsRef,
      async (snapshot) => {
        if (snapshot.empty) {
          if (isAdminGlobal && defaultSeeds && defaultSeeds.length > 0 && !isFirestoreQuotaExceeded()) {
            try {
              for (const defaultCol of defaultSeeds) {
                const albumRef = doc(db, firestoreCollection, defaultCol.id);
                const { images, ...albumMeta } = defaultCol;
                const coverSrc = defaultCol.coverImageSrc || (images && images[0]?.src) || null;
                await setDoc(albumRef, {
                  ...albumMeta,
                  coverImageSrc: coverSrc,
                });

                if (images && images.length > 0) {
                  const photosRef = collection(db, `${firestoreCollection}/${defaultCol.id}/photos`);
                  for (let i = 0; i < images.length; i++) {
                    const photoRef = doc(photosRef);
                    const p = images[i];
                    const pResolutions = p.resolutions || createResolutionsFromUrl(p.src);
                    await setDoc(photoRef, {
                      ...p,
                      resolutions: pResolutions,
                      thumbnail: p.thumbnail || pResolutions.thumbnail,
                      medium: p.medium || pResolutions.medium,
                      original: p.original || pResolutions.original,
                      order: i,
                    });
                  }
                }
              }
            } catch (e: any) {
              if (
                e?.code === "resource-exhausted" ||
                e?.message?.includes("Quota limit exceeded")
              ) {
                markFirestoreQuotaExceeded();
              } else {
                console.error("Error seeding default albums: ", e);
              }
            }
          }
          if (defaultSeeds && defaultSeeds.length > 0) {
            setCollectionsData(defaultSeeds);
          }
          setLoading(false);
          return;
        }

        const albumsMap = new Map<string, CustomCollection>();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.deletedAt) {
            const defaultMatch = defaultSeeds?.find((d) => d.id === docSnap.id);
            const docImages = Array.isArray(data.images) && data.images.length > 0
              ? data.images
              : (defaultMatch?.images || []);
            const coverSrc = (data.coverImageSrc && data.coverImageSrc.trim() !== "")
              ? data.coverImageSrc
              : (docImages && docImages[0]?.src) || defaultMatch?.coverImageSrc;
            albumsMap.set(docSnap.id, {
              id: docSnap.id,
              title: formatDisplayName(data.title || defaultMatch?.title || ""),
              subtitle: formatDisplayName(data.subtitle || defaultMatch?.subtitle || ""),
              body: formatDisplayName(data.body || defaultMatch?.body || ""),
              driveLink: data.driveLink || defaultMatch?.driveLink || "",
              coverImageSrc: coverSrc,
              coverImageResolutions:
                data.coverImageResolutions ||
                (coverSrc ? createResolutionsFromUrl(coverSrc) : undefined),
              coverImagePosition: data.coverImagePosition || defaultMatch?.coverImagePosition,
              order: data.order ?? defaultMatch?.order ?? 0,
              isHidden: data.isHidden === true,
              images: docImages,
            });
          }
        });

        const sortedAlbums = Array.from(albumsMap.values()).sort((a, b) => (a.order || 0) - (b.order || 0));

        setCollectionsData((prev) => {
          const newState = sortedAlbums.map((newCol) => {
            const existing = prev.find((p) => p.id === newCol.id);
            const preservedImages = existing && existing.images && existing.images.length > 0
              ? existing.images
              : newCol.images;
            const preservedCover =
              (newCol.coverImageSrc && newCol.coverImageSrc.trim() !== "")
                ? newCol.coverImageSrc
                : existing?.coverImageSrc || (preservedImages && preservedImages[0]?.src);
            return {
              ...newCol,
              images: preservedImages,
              coverImageSrc: preservedCover,
            };
          });
          return newState;
        });
        setLoading(false);

        // Cleanup stale listeners
        const activeIds = new Set(albumsMap.keys());
        Object.keys(photoUnsubsRef.current).forEach(id => {
          if (!activeIds.has(id)) {
            photoUnsubsRef.current[id]();
            delete photoUnsubsRef.current[id];
          }
        });

        // Setup new listeners
        albumsMap.forEach((album, albumId) => {
          if (!photoUnsubsRef.current[albumId]) {
            const photosRef = collection(db, `${firestoreCollection}/${albumId}/photos`);
            const q = query(photosRef, orderBy("order", "asc"));
            photoUnsubsRef.current[albumId] = onSnapshot(
              q,
              (photoSnap) => {
                const photos: CustomPhoto[] = [];
                photoSnap.forEach((pDoc) => {
                  const pData = pDoc.data();
                  const pResolutions =
                    pData.resolutions ||
                    createResolutionsFromUrl(pData.src || "");
                  photos.push({
                    id: pDoc.id,
                    ...pData,
                    resolutions: pResolutions,
                    thumbnail: pData.thumbnail || pResolutions.thumbnail || pData.src,
                    medium: pData.medium || pResolutions.medium || pData.src,
                    original: pData.original || pResolutions.original || pData.src,
                    title: formatDisplayName(pData.title || ""),
                    alt: formatDisplayName(pData.alt || ""),
                    desc: formatDisplayName(pData.desc || ""),
                  } as CustomPhoto);
                });
                setCollectionsData((prev) => {
                  const updated = prev.map((col) => {
                    if (col.id === albumId) {
                      const effectivePhotos = photos.length > 0
                        ? photos
                        : (col.images && col.images.length > 0 ? col.images : []);
                      const firstPhotoSrc = effectivePhotos.length > 0 ? effectivePhotos[0].src : undefined;
                      return {
                        ...col,
                        images: effectivePhotos,
                        coverImageSrc:
                          (col.coverImageSrc && col.coverImageSrc.trim() !== "")
                            ? col.coverImageSrc
                            : firstPhotoSrc,
                      };
                    }
                    return col;
                  });
                  try {
                    localStorage.setItem(cacheKey, JSON.stringify(updated));
                  } catch {}
                  return updated;
                });
              },
              (error: any) => {
                if (
                  error?.code === "resource-exhausted" ||
                  error?.message?.includes("Quota limit exceeded")
                ) {
                  markFirestoreQuotaExceeded();
                  return;
                }
                handleFirestoreError(error, OperationType.LIST, `${firestoreCollection}/${albumId}/photos`);
              }
            );
          }
        });
      },
      (error: any) => {
        if (
          error?.code === "resource-exhausted" ||
          error?.message?.includes("Quota limit exceeded")
        ) {
          markFirestoreQuotaExceeded();
          if (defaultSeeds && defaultSeeds.length > 0) {
            setCollectionsData((prev) => (prev.length > 0 ? prev : defaultSeeds));
          }
          setLoading(false);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, firestoreCollection);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      Object.values(photoUnsubsRef.current).forEach((unsub: any) => {
        if (typeof unsub === "function") unsub();
      });
      photoUnsubsRef.current = {};
    };
  }, [firestoreCollection]);

  // Fallback to default seeds if completely empty or missing images
  const resolvedCollections = useMemo(() => {
    if (loading) return [];
    if (collectionsData.length === 0) {
      return (defaultSeeds || []).map(col => ({
        ...col,
        title: formatDisplayName(col.title || ""),
        subtitle: formatDisplayName(col.subtitle || ""),
        body: formatDisplayName(col.body || ""),
        images: col.images.map(img => ({
          ...img,
          title: formatDisplayName(img.title || ""),
          alt: formatDisplayName(img.alt || ""),
          desc: formatDisplayName(img.desc || ""),
        }))
      }));
    }
    return collectionsData.map((col) => {
      if (!col.images || col.images.length === 0) {
        const matchedSeed = defaultSeeds?.find((s) => s.id === col.id);
        if (matchedSeed && matchedSeed.images && matchedSeed.images.length > 0) {
          return {
             ...col,
            images: matchedSeed.images.map((img) => ({
              ...img,
              title: formatDisplayName(img.title || ""),
              alt: formatDisplayName(img.alt || ""),
              desc: formatDisplayName(img.desc || ""),
            })),
          };
        }
      }
      return col;
    });
  }, [loading, collectionsData, defaultSeeds]);

  const addAlbum = async (
    newCol: Omit<CustomCollection, "images">,
    defaultImage: Omit<CustomPhoto, "id" | "order">,
  ) => {
    if (newCol.driveLink && !validateUrl(newCol.driveLink)) {
      throw new Error("Invalid URL for Drive Link");
    }

    const albumRef = doc(db, firestoreCollection, newCol.id);
    const coverImageSrc = newCol.coverImageSrc || defaultImage.src || "";
    const coverImageResolutions =
      newCol.coverImageResolutions ||
      (coverImageSrc ? createResolutionsFromUrl(coverImageSrc) : undefined);

    await setDoc(albumRef, {
      title: newCol.title,
      subtitle: newCol.subtitle,
      body: newCol.body,
      driveLink: newCol.driveLink,
      coverImageSrc,
      coverImageResolutions: coverImageResolutions || null,
      coverImagePosition: newCol.coverImagePosition || "center",
      photoCount: defaultImage.src ? 1 : 0,
    });

    if (defaultImage.src && validateUrl(defaultImage.src)) {
      const photoRef = doc(
        collection(db, `${firestoreCollection}/${newCol.id}/photos`),
      );
      const photoResolutions =
        defaultImage.resolutions ||
        createResolutionsFromUrl(defaultImage.src);
      await setDoc(photoRef, {
        ...defaultImage,
        resolutions: photoResolutions,
        thumbnail: defaultImage.thumbnail || photoResolutions.thumbnail,
        medium: defaultImage.medium || photoResolutions.medium,
        original: defaultImage.original || photoResolutions.original,
        order: 0,
      });
    }
  };

  const updateAlbumMeta = async (
    albumId: string,
    updates: Partial<CustomCollection>,
  ) => {
    if (updates.driveLink && !validateUrl(updates.driveLink)) {
      throw new Error("Invalid URL for Drive Link");
    }
    const albumRef = doc(db, firestoreCollection, albumId);

    // Attempting atomic update via runTransaction for meta
    await runTransaction(db, async (transaction) => {
      const sfDoc = await transaction.get(albumRef);
      if (!sfDoc.exists()) {
        throw new Error("Document does not exist!");
      }
      transaction.update(albumRef, updates);
    });
  };

  const addPhotos = async (
    albumId: string,
    photos: Omit<CustomPhoto, "id" | "order">[],
  ) => {
    // Use transaction to get highest order and add safely
    const albumRef = doc(db, firestoreCollection, albumId);
    const photosRef = collection(
      db,
      `${firestoreCollection}/${albumId}/photos`,
    );

    await runTransaction(db, async (transaction) => {
      // Read parent to ensure it exists
      const albumDoc = await transaction.get(albumRef);
      if (!albumDoc.exists()) {
        throw new Error("Album does not exist");
      }

      // This is a naive way to get max order in a transaction.
      // It's better to maintain a photoCount on the album doc for transaction safety.
      let photoCount = albumDoc.data()?.photoCount || 0;

      photos.forEach((photo, idx) => {
        if (!validateUrl(photo.src))
          throw new Error(`Invalid URL for photo: ${photo.src}`);
        const newPhotoRef = doc(photosRef);
        const photoResolutions =
          photo.resolutions ||
          createResolutionsFromUrl(photo.src);
        transaction.set(newPhotoRef, {
          ...photo,
          resolutions: photoResolutions,
          thumbnail: photo.thumbnail || photoResolutions.thumbnail,
          medium: photo.medium || photoResolutions.medium,
          original: photo.original || photoResolutions.original,
          order: photoCount + idx,
        });
      });

      // Update count
      transaction.update(albumRef, { photoCount: photoCount + photos.length });
    });
  };

  const deletePhoto = async (albumId: string, photoId: string) => {
    if (!photoId) return;
    const photoRef = doc(
      db,
      `${firestoreCollection}/${albumId}/photos/${photoId}`,
    );
    await deleteDoc(photoRef);
  };

  const updatePhoto = async (
    albumId: string,
    photoId: string,
    updates: Partial<CustomPhoto>,
  ) => {
    const photoRef = doc(
      db,
      `${firestoreCollection}/${albumId}/photos/${photoId}`,
    );
    await updateDoc(photoRef, updates);
  };

  const reorderPhoto = async (
    albumId: string,
    photo1: { id: string, order: number },
    photo2: { id: string, order: number }
  ) => {
    // using runTransaction to swap orders safely
    await runTransaction(db, async (transaction) => {
      const p1Ref = doc(db, `${firestoreCollection}/${albumId}/photos/${photo1.id}`);
      const p2Ref = doc(db, `${firestoreCollection}/${albumId}/photos/${photo2.id}`);
      transaction.update(p1Ref, { order: photo2.order });
      transaction.update(p2Ref, { order: photo1.order });
    });
  };

  const reorderAlbum = async (
    album1: { id: string, order: number },
    album2: { id: string, order: number }
  ) => {
    await runTransaction(db, async (transaction) => {
      const a1Ref = doc(db, firestoreCollection, album1.id);
      const a2Ref = doc(db, firestoreCollection, album2.id);
      transaction.update(a1Ref, { order: album2.order });
      transaction.update(a2Ref, { order: album1.order });
    });
  };

  const reorderAlbumsBatch = async (
    updates: { id: string; order: number }[]
  ) => {
    const batch = writeBatch(db);
    updates.forEach((update) => {
      const ref = doc(db, firestoreCollection, update.id);
      batch.update(ref, { order: update.order });
    });
    await batch.commit();
  };

  const softDeleteAlbum = async (albumId: string) => {
    const albumRef = doc(db, firestoreCollection, albumId);
    await updateDoc(albumRef, {
      deletedAt: serverTimestamp(),
    });
  };

  return {
    collectionsData: resolvedCollections,
    loading,
    addAlbum,
    updateAlbumMeta,
    addPhotos,
    deletePhoto,
    updatePhoto,
    reorderPhoto,
    reorderAlbum,
    reorderAlbumsBatch,
    softDeleteAlbum,
  };
}
