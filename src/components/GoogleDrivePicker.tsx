import React, { useState, useEffect } from"react";
import { HardDrive, Loader2, Image as ImageIcon, Link as LinkIcon, CheckSquare } from"lucide-react";
import { initAuth, googleSignIn, getAccessToken } from"../firebase";

interface DriveFile {
 id: string;
 name: string;
 mimeType: string;
 thumbnailLink?: string;
 webViewLink: string;
 webContentLink?: string;
}

interface GoogleDrivePickerProps {
 onSelectUrls: (urls: string[]) => void;
}

export const GoogleDrivePicker: React.FC<GoogleDrivePickerProps> = ({ onSelectUrls }) => {
 const [token, setToken] = useState<string | null>(null);
 const [files, setFiles] = useState<DriveFile[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

 useEffect(() => {
 const fetchToken = async () => {
 const t = await getAccessToken();
 if (t) setToken(t);
 };
 initAuth((_, t) => setToken(t));
 fetchToken();
 }, []);

 const handleLogin = async () => {
 try {
 const result = await googleSignIn();
 if (result) setToken(result.accessToken);
 } catch (err: any) {
 if (err.code !=="auth/popup-closed-by-user") {
 console.error("Login failed:", err);
 }
 }
 };

 const fetchRecentImages = async () => {
 if (!token) return;
 setIsLoading(true);
 try {
 // Search for images
 const q ="mimeType contains 'image/' and trashed = false";
 const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink)&pageSize=20&orderBy=modifiedTime desc`, {
 headers: { Authorization: `Bearer ${token}` },
 });
 if (res.ok) {
 const data = await res.json();
 setFiles(data.files || []);
 }
 } catch (err) {
 console.error("Failed to fetch from Drive:", err);
 } finally {
 setIsLoading(false);
 }
 };

 useEffect(() => {
 if (token) {
 fetchRecentImages();
 }
 }, [token]);

 const toggleSelect = (id: string) => {
 const newSet = new Set(selectedIds);
 if (newSet.has(id)) newSet.delete(id);
 else newSet.add(id);
 setSelectedIds(newSet);
 };

 const handleImport = () => {
 const urls: string[] = [];
 selectedIds.forEach((id) => {
 const f = files.find(file => file.id === id);
 if (f && f.webContentLink) {
 urls.push(f.webContentLink);
 } else if (f) {
 // Fallback to a custom google drive direct link if webContentLink is missing for some reason
 urls.push(`https://drive.google.com/uc?export=view&id=${f.id}`);
 }
 });

 if (urls.length > 0) {
 onSelectUrls(urls);
 setSelectedIds(new Set());
 }
 };

 if (!token) {
 return (
 <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/50 border border-white/5 rounded-xl border-dashed">
 <HardDrive className="w-8 h-8 text-emerald-400 mb-3"/>
 <p className="text-xs text-zinc-400 text-center mb-4 max-w-[200px]">Đăng nhập Google để truy cập ảnh trực tiếp từ Drive.</p>
 <button
 onClick={handleLogin}
 className="px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-bold rounded-lg transition"
 >
 Đăng nhập Workspace
 </button>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <HardDrive className="w-4 h-4 text-emerald-500"/>
 <h4 className="text-xs font-bold text-zinc-200">Ảnh gần đây từ Drive</h4>
 </div>
 <button onClick={fetchRecentImages} className="text-[12px] text-zinc-400 hover:text-white transition">
 Làm mới
 </button>
 </div>

 {isLoading ? (
 <div className="flex justify-center p-8">
 <Loader2 className="w-6 h-6 text-emerald-500 animate-spin"/>
 </div>
 ) : files.length === 0 ? (
 <div className="p-8 text-center text-xs text-zinc-500 bg-black/20 rounded-xl">
 Không tìm thấy hình ảnh nào trong Drive.
 </div>
 ) : (
 <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1 cs-scroll">
 {files.map((f, fIdx) => (
 <div 
 key={`gdrive-file-${f.id || 'f'}-${fIdx}`} 
 onClick={() => toggleSelect(f.id)}
 className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer bg-zinc-800 border-2 transition-all ${selectedIds.has(f.id) ? 'border-emerald-500' : 'border-transparent hover:border-white/20'}`}
 >
 {f.thumbnailLink ? (
 <img src={f.thumbnailLink} alt={f.name} className="w-full h-full object-cover"referrerPolicy="no-referrer"/>
 ) : (
 <div className="w-full h-full flex flex-col items-center justify-center p-2">
 <ImageIcon className="w-6 h-6 text-zinc-500 mb-1"/>
 <span className="text-[11px] text-zinc-400 text-center line-clamp-2">{f.name}</span>
 </div>
 )}
 {selectedIds.has(f.id) && (
 <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
 <CheckSquare className="w-6 h-6 text-emerald-400"/>
 </div>
 )}
 </div>
 ))}
 </div>
 )}

 {selectedIds.size > 0 && (
 <div className="flex items-center justify-between bg-emerald-900/30 p-3 rounded-lg border border-emerald-500/30">
 <span className="text-xs text-emerald-100 font-bold">Đã chọn {selectedIds.size} ảnh</span>
 <button 
 onClick={handleImport}
 className="px-4 py-1.5 bg-emerald-500 text-black text-xs font-bold rounded-md hover:bg-emerald-400 transition"
 >
 Thêm vào Album
 </button>
 </div>
 )}
 </div>
 );
};
