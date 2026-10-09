import React, { useState, useEffect, useRef } from"react";
import { 
 X, 
 MessageSquare, 
 Send, 
 Users, 
 Search, 
 Pin, 
 Check, 
 Trash2, 
 ChevronLeft, 
 User, 
 ArrowDown, 
 Instagram, 
 AlertCircle, 
 RotateCw, 
 Sparkles,
 CheckCircle2,
 Calendar,
 Phone,
 MessageCircle,
 ExternalLink,
 ChevronDown,
 ChevronUp,
 Clock,
 Briefcase,
 LogOut
} from"lucide-react";
import { motion, AnimatePresence } from"motion/react";
import { 
 collection, 
 query, 
 orderBy, 
 onSnapshot, 
 doc, 
 deleteDoc, 
 updateDoc, 
 setDoc,
 Timestamp,
 getDocs,
 limit
} from"firebase/firestore";
import { db, handleFirestoreError, OperationType, auth } from"../firebase";

interface Conversation {
 id: string; // Customer UID
 customerName: string;
 customerContact: string;
 customerChannel:"Web"|"Zalo"|"Instagram"|"Facebook";
 lastMessage: string;
 lastMessageAt: any;
 unreadCountAdmin: number;
 unreadCountCustomer: number;
 status:"open"|"pending"|"resolved";
 pinned: boolean;
 relatedBookingId?: string;
}

interface Message {
 id: string;
 text: string;
 senderType:"admin"|"customer";
 senderId: string;
 createdAt: any;
 sendingStatus:"sending"|"sent"|"failed";
 readAt?: any;
 deliveredAt?: any;
}

type FilterType ="all"|"unread"|"pinned"|"unhandled"|"handled";

const QUICK_REPLIES = [
"Dạ Bergh.Ryker xin chào đằng ấy ạ! 📷✨",
"Concept kỉ yếu THPT trọn gói bên mình đang ưu đãi giảm 15% nạ!",
"Dạ đằng ấy nhắn cho tụi mình xin Zalo hoặc SĐT để tư vấn concept chi tiết nhất nha! 🌱",
"Studio bên mình ở Hà Nội và Hạ Long, hỗ trợ di chuyển tận nơi nạ.",
"Lịch chụp cuối tuần này bên mình còn trống 1 buổi chiều, đằng ấy muốn book không?",
"Dạ tụi mình đã ghi nhận thông tin, Admin sẽ liên hệ lại ngay nha!"
];

export const AdminLiveChat = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
 const [conversations, setConversations] = useState<Conversation[]>([]);
 const [activeId, setActiveId] = useState<string | null>(null);
 const [activeMessages, setActiveMessages] = useState<Message[]>([]);
 
 // Realtime Pagination and Loading thresholds
 const [messageLimit, setMessageLimit] = useState<number>(30);
 const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true);
 
 const [optimisticMessages, setOptimisticMessages] = useState<Record<string, Message[]>>({});
 const [unreadCount, setUnreadCount] = useState(0);
 const [replyText, setReplyText] = useState("");
 const [drafts, setDrafts] = useState<Record<string, string>>({});
 const [sendError, setSendError] = useState("");
 
 // Search and Filters
 const [searchQuery, setSearchQuery] = useState("");
 const [activeFilter, setActiveFilter] = useState<FilterType>("all");
 
 // Profile Editor States
 const [isEditingContact, setIsEditingContact] = useState(false);
 const [contactNameInput, setContactNameInput] = useState("");
 const [contactContactInput, setContactContactInput] = useState("");
 const [contactChannel, setContactChannel] = useState<"Web"|"Zalo"|"Instagram"|"Facebook">("Web");
 const [relatedBookingIdInput, setRelatedBookingIdInput] = useState("");
 
 // Scrolling indicators
 const [isScrolledUp, setIsScrolledUp] = useState(false);
 const [showQuickReplies, setShowQuickReplies] = useState(true);
 
 // Custom Sleek Dialog Confirm Delete
 const [isConfirmOpen, setIsConfirmOpen] = useState(false);
 const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);

 const chatContainerRef = useRef<HTMLDivElement>(null);
 const textareaRef = useRef<HTMLTextAreaElement>(null);

 // 1. Listen to all conversations in Firestore (Realtime dashboard list)
 useEffect(() => {
 const q = query(collection(db,"chat_sessions"), orderBy("lastMessageAt","desc"));
 const unsubscribe = onSnapshot(
 q, 
 (snapshot) => {
 const loaded: Conversation[] = [];
 snapshot.forEach((doc) => {
 const data = doc.data();
 loaded.push({
 id: doc.id,
 customerName: data.customerName || `Khách ${doc.id.slice(0, 4)}`,
 customerContact: data.customerContact ||"",
 customerChannel: data.customerChannel ||"Web",
 lastMessage: data.lastMessage ||"",
 lastMessageAt: data.lastMessageAt,
 unreadCountAdmin: data.unreadCountAdmin || 0,
 unreadCountCustomer: data.unreadCountCustomer || 0,
 status: data.status ||"open",
 pinned: data.pinned || false,
 relatedBookingId: data.relatedBookingId ||""
 });
 });
 setConversations(loaded);

 // Aggregate admin unread counts for general notification badge
 const totalUnread = loaded.reduce((sum, c) => sum + (c.unreadCountAdmin || 0), 0);
 setUnreadCount(totalUnread);
 },
 (error) => {
 handleFirestoreError(error, OperationType.LIST,"chat_sessions");
 }
 );

 return () => unsubscribe();
 }, []);

 // 2. Reset loading limit when switching threads
 useEffect(() => {
 setMessageLimit(30);
 setHasMoreMessages(true);
 setIsScrolledUp(false);
 // Auto scroll down immediately when opening a conversation
 setTimeout(() => {
 scrollToBottom("auto");
 }, 120);
 }, [activeId]);

 // 3. Listen to active conversation messages in Firestore (Realtime messaging logs) with reactive limit
 useEffect(() => {
 if (!activeId) {
 setActiveMessages([]);
 setHasMoreMessages(false);
 return;
 }

 setIsEditingContact(false);

 // Query descending from newest messages up to current pagination threshold
 const q = query(
 collection(db,"chat_sessions", activeId,"messages"),
 orderBy("createdAt","desc"),
 limit(messageLimit)
 );

 const unsubscribe = onSnapshot(
 q, 
 (snapshot) => {
 const loadedMsg: Message[] = [];
 snapshot.forEach((doc) => {
 const data = doc.data();
 loadedMsg.push({
 id: doc.id,
 text: data.text ||"",
 senderType: data.senderType ||"customer",
 senderId: data.senderId ||"",
 createdAt: data.createdAt,
 sendingStatus: data.sendingStatus ||"sent",
 readAt: data.readAt,
 deliveredAt: data.deliveredAt
 });
 });

 // Store internally as ascending order for correct chronological visual presentation
 setActiveMessages(loadedMsg.reverse());

 // Decide if there are more older messages to load
 if (snapshot.docs.length < messageLimit) {
 setHasMoreMessages(false);
 } else {
 setHasMoreMessages(true);
 }
 },
 (error) => {
 handleFirestoreError(error, OperationType.LIST, `chat_sessions/${activeId}/messages`);
 }
 );

 return () => unsubscribe();
 }, [activeId, messageLimit]);

 // 3b. Sync input profiles to active conversation details when activeId or conversations update
 useEffect(() => {
 if (!activeId) return;
 const current = conversations.find(c => c.id === activeId);
 if (current) {
 setContactNameInput(current.customerName);
 setContactContactInput(current.customerContact);
 setContactChannel(current.customerChannel);
 setRelatedBookingIdInput(current.relatedBookingId ||"");
 }
 }, [activeId, conversations]);

 // 4. Clear unread count for admin when thread becomes active
 useEffect(() => {
 if (activeId) {
 const activeObj = conversations.find(c => c.id === activeId);
 if (activeObj && activeObj.unreadCountAdmin > 0) {
 const ref = doc(db,"chat_sessions", activeId);
 updateDoc(ref, {
 unreadCountAdmin: 0
 }).catch(err => console.error("Failed to clear unread counts on Firestore:", err));
 }
 }
 }, [activeId, conversations]);

 const handleReplyTextChange = (val: string) => {
 setReplyText(val);
 if (activeId) {
 setDrafts(prev => ({ ...prev, [activeId]: val }));
 }
 };

 // Restore draft when switching conversation
 useEffect(() => {
 setSendError("");
 if (activeId) {
 setReplyText(drafts[activeId] ||"");
 } else {
 setReplyText("");
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [activeId]);

 // 6. Handle input heights resize natively
 useEffect(() => {
 if (textareaRef.current) {
 textareaRef.current.style.height ="auto";
 textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
 }
 }, [replyText]);

 // 7. Scroll tracking and containment
 const handleScroll = () => {
 if (!chatContainerRef.current) return;
 const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
 // Consider scrolled up if scrolled more than 100px from the bottom
 const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
 setIsScrolledUp(!isAtBottom);
 };

 const scrollToBottom = (behavior:"smooth"|"auto"="smooth") => {
 if (chatContainerRef.current) {
 chatContainerRef.current.scrollTo({
 top: chatContainerRef.current.scrollHeight,
 behavior
 });
 setIsScrolledUp(false);
 }
 };

 // 8. Auto-scroll containment to verify if we should keep focus at bottom or respect scroll-up
 useEffect(() => {
 if (!isScrolledUp) {
 const timer = setTimeout(() => {
 scrollToBottom("auto");
 }, 50);
 return () => clearTimeout(timer);
 }
 }, [activeMessages, optimisticMessages, activeId]);

 // 9. Client modification handlers: Pinned, resolved status, update profiling, delete Thread
 const handleTogglePin = async (cid: string, currentPin: boolean, e: React.MouseEvent) => {
 e.stopPropagation();
 try {
 await updateDoc(doc(db,"chat_sessions", cid), {
 pinned: !currentPin
 });
 } catch (err) {
 console.error("Failed to pin conversation:", err);
 }
 };

 const handleToggleHandled = async (cid: string, currentStatus:"open"|"pending"|"resolved", e: React.MouseEvent) => {
 e.stopPropagation();
 try {
 const newStatus = currentStatus ==="resolved"?"open":"resolved";
 await updateDoc(doc(db,"chat_sessions", cid), {
 status: newStatus
 });
 } catch (err) {
 console.error("Failed to change status:", err);
 }
 };

 const handleSaveContactInfo = async () => {
 if (!activeId) return;
 try {
 await updateDoc(doc(db,"chat_sessions", activeId), {
 customerName: contactNameInput,
 customerContact: contactContactInput,
 customerChannel: contactChannel,
 relatedBookingId: relatedBookingIdInput ||""
 });
 setIsEditingContact(false);
 } catch (err) {
 console.error("Failed to update profile info:", err);
 }
 };

 const openConfirmDelete = (id: string, e: React.MouseEvent) => {
 e.stopPropagation();
 setConversationToDelete(id);
 setIsConfirmOpen(true);
 };

 const handleConfirmDelete = async () => {
 if (!conversationToDelete) return;
 try {
 // Clean up messages subcollection safely
 const msgsCollection = collection(db,"chat_sessions", conversationToDelete,"messages");
 const msgsSnapshot = await getDocs(msgsCollection);
 for (const mDoc of msgsSnapshot.docs) {
 await deleteDoc(mDoc.ref);
 }
 // Delete top thread document
 await deleteDoc(doc(db,"chat_sessions", conversationToDelete));
 
 if (activeId === conversationToDelete) {
 setActiveId(null);
 }
 } catch (err) {
 console.error("Failed to delete records:", err);
 } finally {
 setIsConfirmOpen(false);
 setConversationToDelete(null);
 }
 };

 const [isSending, setIsSending] = useState(false);

 // 10. Sending response dispatch (Handles Optimistic UI rendering & Retries)
 const handleReply = async (textToSend?: string, retryId?: string) => {
 if (isSending) return;
 const rawText = textToSend !== undefined ? textToSend : replyText;
 if (!rawText.trim() || !activeId) return;
 
 setIsSending(true);
 const text = rawText.trim();
 if (textToSend === undefined) {
 setReplyText("");
 setDrafts(prev => ({ ...prev, [activeId]:""}));
 }

 const tempId = retryId ||"temp_"+ Date.now();

 const optimisticMsg: Message = {
 id: tempId,
 text: text,
 senderType:"admin",
 senderId:"admin",
 createdAt: Timestamp.now(),
 sendingStatus:"sending"
 };

 setOptimisticMessages(prev => {
 const list = prev[activeId] || [];
 const filtered = retryId ? list.filter(m => m.id !== retryId) : list;
 return {
 ...prev,
 [activeId]: [...filtered, optimisticMsg]
 };
 });

 try {
 const now = Timestamp.now();
 const conversationRef = doc(db,"chat_sessions", activeId);
 
 await updateDoc(conversationRef, {
 lastMessage: text,
 lastMessageAt: now,
 lastMessageSender:"admin",
 unreadCountAdmin: 0
 });
 
 const newDocRef = doc(collection(db,"chat_sessions", activeId,"messages"), tempId);
 await setDoc(newDocRef, {
 text: text,
 senderType:"admin",
 senderId:"admin",
 createdAt: now,
 sendingStatus:"sent",
 deliveredAt: now
 });

 // Erase reference inside local temporary optimistic dictionary once synchronized on Firestore
 setOptimisticMessages(prev => {
 const list = prev[activeId] || [];
 return {
 ...prev,
 [activeId]: list.filter(m => m.id !== tempId)
 };
 });
 setSendError("");
 } catch (err) {
 console.error("Failed to post admin reply:", err);
 
 // Remove failed message from local optimistics mapping
 setOptimisticMessages(prev => {
 const list = prev[activeId] || [];
 return {
 ...prev,
 [activeId]: list.filter(m => m.id !== tempId)
 };
 });
 
 // Restore text to composer for draft preservation
 handleReplyTextChange(text);
 setSendError("Lắp mạng chập chờn. Nội dung chưa gửi được lưu lại an toàn nhé!");
 } finally {
 setIsSending(false);
 }
 };

 // Keyboard handlers
 const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
 if (e.key ==="Enter"&& !e.shiftKey) {
 if (e.nativeEvent.isComposing) return;
 e.preventDefault();
 handleReply();
 }
 };

 // Visual channel rendering helpers
 const formatTimestamp = (ts: any) => {
 if (!ts) return"";
 const date = typeof ts.toDate ==="function"? ts.toDate() : new Date(ts);
 const now = new Date();
 
 if (date.toDateString() === now.toDateString()) {
 return date.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' });
 }
 return date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit' });
 };

 const getChannelIcon = (ch?: string) => {
 switch (ch) {
 case"Instagram":
 return <Instagram className="w-3.5 h-3.5 text-pink-400 shrink-0"/>;
 case"Zalo":
 return <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded font-bold leading-none uppercase shrink-0">Zalo</span>;
 case"Facebook":
 return <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.5 rounded font-bold leading-none uppercase shrink-0">Fb</span>;
 default:
 return <MessageCircle className="w-3.5 h-3.5 text-amber-500 shrink-0"/>;
 }
 };

 // Merges the server records and optimistic state (anti-duplicate)
 const getMergedMessages = () => {
 if (!activeId) return [];
 const serverMsgs = activeMessages;
 const pending = optimisticMessages[activeId] || [];
 
 const unmatchedPending = pending.filter(
 p => !serverMsgs.some(s => s.id === p.id)
 );

 return [...serverMsgs, ...unmatchedPending];
 };

 const mergedList = getMergedMessages();

 // Search filtering logic integration
 const filteredConversations = conversations.filter(c => {
 const searchLower = searchQuery.toLowerCase();
 const name = c.customerName || `Khách ${c.id.slice(0, 4)}`;
 const matchesSearch = 
 name.toLowerCase().includes(searchLower) ||
 (c.customerContact ||"").toLowerCase().includes(searchLower) ||
 c.id.toLowerCase().includes(searchLower) ||
 (c.lastMessage ||"").toLowerCase().includes(searchLower) ||
 (c.relatedBookingId ||"").toLowerCase().includes(searchLower);

 if (!matchesSearch) return false;

 switch (activeFilter) {
 case"unread":
 return (c.unreadCountAdmin || 0) > 0;
 case"pinned":
 return c.pinned === true;
 case"handled":
 return c.status ==="resolved";
 case"unhandled":
 return c.status !=="resolved";
 default:
 return true;
 }
 });

 return (
 <>
 {/* Main Container */}
 <AnimatePresence>
 {isOpen && (
 <motion.div
 id="admin-live-chat-panel"
 initial={{ opacity: 0, y: 30, scale: 0.95 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 30, scale: 0.95 }}
 transition={{ duration: 0.25, ease:"easeOut"}}
 className="w-full h-full bg-transparent flex flex-col relative text-zinc-100 font-sans"
 >
 {/* Header branding block */}
 <header className={`bg-zinc-950 pl-5 pr-4 py-3 md:py-4 pt-[max(16px,env(safe-area-inset-top))] md:pt-4 border-b border-white/5 flex items-center justify-between shrink-0 min-h-[44px] transition-all relative z-20 ${activeId !== null ?"max-md:hidden":"block"}`}>
 <div className="flex items-center gap-3 5">
 <div className="w-10 h-10 rounded-full bg-[#B5945B]/10 border border-[#B5945B]/30 flex items-center justify-center text-[#B5945B] shadow-sm">
 <MessageSquare className="w-4 h-4 ml-0.5"/>
 </div>
 <div className="flex flex-col justify-center">
 <h3 className="font-sans font-bold text-[13px] tracking-wide text-white flex items-center gap-2 uppercase">
 Quản trị Chat
 <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px] font-sans leading-none py-1 px-1.5 rounded uppercase font-medium tracking-wide hidden sm:inline-block">
 Online
 </span>
 </h3>
 <p className="text-[11px] text-zinc-400 font-sans tracking-wide uppercase mt-1 flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"/>
 Đồng bộ đám mây
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button 
 onClick={onClose}
 className="pr-4 pl-3 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-400 hover:text-red-300 transition-all cursor-pointer min-h-[44px] flex items-center justify-center border border-red-500/20 shrink-0 gap-1.5 shadow-sm shadow-red-500/5"
 title="Đóng bảng chat"
 >
 <X className="w-4 h-4 shrink-0"/>
 <span className="text-[11px] font-sans font-medium uppercase tracking-wide hidden sm:block">Đóng</span>
 </button>
 </div>
 </header>

 {/* Layout Panels split view */}
 <div className="flex flex-1 overflow-hidden relative min-h-0 bg-transparent">
 
 {/* LEFT COLUMN: Pinned at left or full width on mobile if no activeId */}
 <div className={`w-full md:w-[320px] shrink-0 flex flex-col min-h-0 border-r border-white/10 bg-zinc-950 transition-all z-10 ${activeId !== null ?"hidden md:flex":"flex"}`}>
 
 {/* Search inboxes */}
 <div className="p-4 border-b border-white/5 flex flex-col gap-3 bg-zinc-950/50">
 <div className="relative">
 <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"/>
 <input 
 type="text"
 placeholder="Tìm tên, SĐT, Instagram, Booking..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full bg-zinc-900 border border-white/5 text-zinc-200 text-xs rounded-2xl pl-10 pr-9 py-3 focus:outline-none focus:border-[#B5945B]/40 focus:bg-zinc-950 transition-colors placeholder:text-zinc-500 text-left"
 />
 {searchQuery && (
 <button 
 onClick={() => setSearchQuery("")}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
 >
 <X className="w-4 h-4"/>
 </button>
 )}
 </div>
 
 {/* Status filtering tabs */}
 <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
 {[
 { id:"all", label:"Tất cả"},
 { id:"unread", label:"Chưa đọc"},
 { id:"unhandled", label:"Chờ rep"},
 { id:"handled", label:"Đã xong"},
 { id:"pinned", label:"Đã ghim"}
 ].map((filter, fIdx) => {
 const isActive = activeFilter === filter.id;
 return (
 <button
 key={`chat-filter-${filter.id}-${fIdx}`}
 onClick={() => setActiveFilter(filter.id as FilterType)}
 className={`text-[11px] font-sans font-bold tracking-wide uppercase px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer min-h-[34px] ${
 isActive 
 ? 'bg-[#B5945B] text-zinc-950 shadow-md shadow-[#B5945B]/10' 
 : 'bg-white/5 hover:bg-white/10 text-zinc-400'
 }`}
 >
 {filter.label}
 </button>
 );
 })}
 </div>
 </div>

 {/* Scroller */}
 <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
 {filteredConversations.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 opacity-40 text-center px-4">
 <MessageSquare className="w-8 h-8 text-zinc-650 mb-3"/>
 <p className="text-zinc-400 text-xs font-bold font-sans uppercase tracking-wide">Không tìm thấy cuộc trò chuyện</p>
 <p className="text-[12px] text-zinc-550 mt-1">Vui lòng thử đổi từ khóa tìm kiếm hoặc bộ lọc</p>
 </div>
 ) : (
 filteredConversations.map((conversation, convIdx) => {
 const isSelected = activeId === conversation.id;
 const hasUnread = (conversation.unreadCountAdmin || 0) > 0;
 const displayName = conversation.customerName;
 const firstChar = displayName.charAt(0).toUpperCase();
 const avatarColors: Record<string, string> = {
 A:"bg-red-500/10 text-red-400 border border-red-500/20", 
 B:"bg-orange-500/10 text-orange-400 border border-orange-500/20", 
 C:"bg-yellow-500/10 text-yellow-400 border border-yellow-500/20", 
 D:"bg-green-500/10 text-green-400 border border-green-500/20",
 E:"bg-teal-500/10 text-teal-400 border border-teal-500/20", 
 F:"bg-blue-500/10 text-blue-400 border border-blue-500/20",
 G:"bg-indigo-500/10 text-indigo-400 border border-indigo-500/20", 
 H:"bg-purple-500/10 text-purple-400 border border-purple-500/20"
 };
 const avatarStyle = avatarColors[firstChar] ||"bg-[#B5945B]/10 text-[#B5945B] border border-[#B5945B]/20";

 return (
 <div
 key={`conv-${conversation.id || 'conv'}-${convIdx}`}
 onClick={() => setActiveId(conversation.id)}
 className={`group w-full text-left p-3.5 rounded-2xl transition-all border duration-200 flex items-start gap-3 cursor-pointer ${
 isSelected 
 ? 'bg-zinc-900 border-[#B5945B]/40 shadow-lg' 
 : 'hover:bg-zinc-900/60 border-transparent'
 }`}
 >
 {/* Avatar block */}
 <div className={`w-10 h-10 rounded-full ${avatarStyle} flex items-center justify-center font-bold text-xs shrink-0 select-none`}>
 {firstChar}
 </div>

 {/* Client details info */}
 <div className="flex-1 min-w-0 pr-1">
 <div className="flex items-baseline justify-between gap-1.5">
 <h4 className={`text-xs font-bold truncate flex items-center gap-1.5 ${isSelected ? 'text-[#B5945B]' : 'text-zinc-200'}`}>
 {displayName}
 <span className="shrink-0">{getChannelIcon(conversation.customerChannel)}</span>
 </h4>
 {conversation.lastMessageAt && (
 <span className="text-[9px] font-sans text-zinc-500 font-semibold shrink-0">
 {formatTimestamp(conversation.lastMessageAt)}
 </span>
 )}
 </div>
 
 {drafts[conversation.id] ? (
 <p className="text-[11px] truncate mt-1.5 leading-tight text-amber-500 font-medium italic">
 Nháp: {drafts[conversation.id]}
 </p>
 ) : (
 <p className={`text-[11px] truncate mt-1.5 leading-tight ${hasUnread ? 'text-zinc-100 font-bold' : 'text-zinc-550'}`}>
 {conversation.lastMessage ||"Mới bắt đầu cuộc trò chuyện..."}
 </p>
 )}
 
 {/* Row Tags */}
 <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
 {conversation.pinned && (
 <span className="text-[7.5px] font-sans bg-amber-500/15 text-amber-500 border border-[#B5945B]/10 rounded px-1.5 py-0.5 font-bold leading-none uppercase">
 Ghim
 </span>
 )}
 {conversation.status ==="resolved"? (
 <span className="text-[7.5px] font-sans bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md px-1.5 py-0.5 font-bold leading-none uppercase">
 Xử lý xong
 </span>
 ) : (
 <span className="text-[7.5px] font-sans bg-amber-600/10 text-amber-400 border border-amber-600/20 rounded-md px-1.5 py-0.5 font-bold leading-none uppercase">
 Cần Rep
 </span>
 )}
 {conversation.relatedBookingId && (
 <span className="text-[7.5px] font-sans bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md px-1.5 py-0.5 font-bold leading-none uppercase truncate max-w-[80px]">
 ID: {conversation.relatedBookingId.slice(-6)}
 </span>
 )}
 </div>
 </div>

 {/* Pin option + Unread bubble */}
 <div className="flex flex-col items-end gap-3 justify-between self-stretch shrink-0">
 <button
 onClick={(e) => handleTogglePin(conversation.id, conversation.pinned || false, e)}
 className="text-zinc-600 hover:text-[#B5945B] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1 rounded hover:bg-zinc-800"
 title="Ghim cuộc trò chuyện"
 >
 <Pin className={`w-3.5 h-3.5 ${conversation.pinned ?"fill-[#B5945B] text-[#B5945B] opacity-100":""}`} />
 </button>
 
 {hasUnread && (
 <span className="bg-emerald-500 text-emerald-950 font-bold text-[11px] w-5 h-5 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.4)] shrink-0">
 {conversation.unreadCountAdmin}
 </span>
 )}
 </div>
 </div>
 );
 })
 )}
 </div>
 </div>

 {/* RIGHT COLUMN: ACTIVE THREAD LOG PANES */}
 <div className={`flex-1 flex flex-col min-h-0 bg-zinc-900 z-20 transition-all ${activeId === null ?"hidden md:flex":"flex"}`}>
 {!activeId ? (
 <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-zinc-950">
 <MessageSquare className="w-8 h-8 text-white/5 mb-3"/>
 <h3 className="text-white font-bold font-sans tracking-wide text-xs uppercase mb-2">QUẢN TRỊ TRUNG TÂM</h3>
 <p className="text-zinc-500 text-[11px] max-w-[280px] font-sans">
 Chọn một cuộc hội thoại từ hộp thư để hỗ trợ khách hàng nhanh chóng.
 </p>
 </div>
 ) : (
 (() => {
 const activeSession = conversations.find(c => c.id === activeId);
 const displayName = activeSession?.customerName || `Khách ${activeId.slice(0, 4)}`;
 
 return (
 <>
 {/* Subheader action controls */}
 <div className="px-3 sm:px-4 py-2 border-b border-white/5 bg-zinc-950 flex justify-between items-center shrink-0 shadow-sm z-30 min-h-[56px]">
 <div className="flex items-center gap-3 w-full shadow-none min-w-0">
 {/* Back button on mobile viewports */}
 <button
 onClick={() => setActiveId(null)}
 className="md:hidden p-2 -ml-1.5 hover:bg-white/5 rounded-xl text-zinc-300 hover:text-white shrink-0 cursor-pointer flex items-center justify-center transition-all"
 title="Quay lại danh sách chat"
 >
 <ChevronLeft className="w-6 h-6 shrink-0"/>
 </button>

 {/* Main Chat Profile Badge */}
 <div className="flex items-center gap-3 min-w-0 flex-1">
 <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/5 hidden sm:flex items-center justify-center shrink-0 text-zinc-300 font-medium uppercase text-xs">
 {displayName.charAt(0)}
 </div>
 <div className="flex flex-col min-w-0 flex-1">
 <h4 className="text-[14px] font-bold text-white truncate flex items-center gap-1.5">
 {displayName}
 {activeSession && getChannelIcon(activeSession.customerChannel)}
 </h4>
 {activeSession?.customerContact ? (
 <p className="text-[11px] text-zinc-500 truncate font-sans">{activeSession.customerContact}</p>
 ) : (
 <p className="text-[11px] text-zinc-600 truncate italic font-sans">Chưa cung cấp liên lạc</p>
 )}
 </div>
 </div>
 
 {/* Quick Toolbar icons list - simplified */}
 <div className="flex items-center gap-1 sm:gap-2 shrink-0">
 <button
 onClick={(e) => handleToggleHandled(activeId, activeSession?.status ||"open", e)}
 className={`p-2 rounded-xl transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
 activeSession?.status ==="resolved"
 ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' 
 : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
 }`}
 title={activeSession?.status ==="resolved"?"Đã xử lý xong":"Đánh dấu đã xử lý"}
 >
 <CheckCircle2 className="w-4 h-4"/>
 </button>

 <button
 onClick={() => setIsEditingContact(!isEditingContact)}
 className={`p-2 rounded-xl transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
 isEditingContact 
 ? 'text-[#B5945B] bg-[#B5945B]/10 hover:bg-[#B5945B]/20' 
 : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
 }`}
 title="Sửa thông tin khách hàng"
 >
 <User className="w-4 h-4"/>
 </button>
 </div>
 </div>
 </div>

 {/* Guest profile detail drawers */}
 <AnimatePresence>
 {isEditingContact && (
 <motion.div
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height:"auto"}}
 exit={{ opacity: 0, height: 0 }}
 className="px-5 py-4 bg-zinc-900/90 border-b border-white/5 overflow-hidden text-xs flex flex-col gap-3 z-20 shadow-lg"
 >
 <div className="flex items-center justify-between">
 <h5 className="font-bold text-[#B5945B] uppercase tracking-wide text-[12px] font-sans">Quản lý profile</h5>
 <span className="text-[11px] text-zinc-500">ID: {activeId}</span>
 </div>
 
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="text-[11px] text-zinc-450 font-medium block mb-1">Tên khách hàng</label>
 <input 
 type="text"
 value={contactNameInput}
 onChange={(e) => setContactNameInput(e.target.value)}
 placeholder="Họ tên đằng ấy..."
 className="w-full bg-zinc-950 border border-white/5 text-zinc-200 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#B5945B]/30"
 />
 </div>
 <div>
 <label className="text-[11px] text-zinc-450 font-medium block mb-1">Liên lạc (Zalo/SĐT/FB)</label>
 <input 
 type="text"
 value={contactContactInput}
 onChange={(e) => setContactContactInput(e.target.value)}
 placeholder="Điện thoại hoặc Link..."
 className="w-full bg-zinc-950 border border-white/5 text-zinc-200 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#B5945B]/30"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="text-[11px] text-zinc-450 font-medium block mb-1">ID Booking đặt lịch (Liên kết)</label>
 <input 
 type="text"
 value={relatedBookingIdInput}
 onChange={(e) => setRelatedBookingIdInput(e.target.value)}
 placeholder="ID trên Firebase Booking..."
 className="w-full bg-zinc-950 border border-white/5 text-zinc-200 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#B5945B]/30 font-sans"
 />
 </div>
 <div>
 <label className="text-[11px] text-zinc-450 font-medium block mb-1">Nguồn hội thoại</label>
 <select
 value={contactChannel}
 onChange={(e) => setContactChannel(e.target.value as any)}
 className="w-full bg-zinc-950 border border-white/5 text-zinc-200 px-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#B5945B]/30 cursor-pointer"
 >
 <option value="Web">Website Messenger</option>
 <option value="Zalo">Zalo Direct (Offline)</option>
 <option value="Instagram">Instagram Direct (Offline)</option>
 <option value="Facebook">Facebook Messenger (Offline)</option>
 </select>
 </div>
 </div>

 <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
 <button
 type="button"
 onClick={() => setIsEditingContact(false)}
 className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-xl text-[12px] uppercase font-medium tracking-wide"
 >
 Huỷ bớt
 </button>
 <button
 type="button"
 onClick={handleSaveContactInfo}
 className="px-4 py-2 bg-[#B5945B] text-zinc-950 font-bold rounded-xl text-[12px] uppercase tracking-wide hover:bg-amber-500 transition-all cursor-pointer shadow-md shadow-amber-500/10 min-h-[32px]"
 >
 Cập nhật Profile
 </button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Interactive message chat logs */}
 <div 
 ref={chatContainerRef}
 onScroll={handleScroll}
 className="flex-1 overflow-y-auto p-4 space-y-4 relative scrollbar-thin scroll-smooth bg-zinc-900"
 >
 {/* Pagination loading more trigger */}
 {hasMoreMessages && (
 <div className="flex justify-center pb-4 pt-1">
 <button
 type="button"
 onClick={() => setMessageLimit(prev => prev + 30)}
 className="px-4 py-2 bg-zinc-900 border border-white/5 hover:border-white/10 rounded-full text-[11px] font-medium text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
 >
 <Clock className="w-3.5 h-3.5"/>
 <span>Xem tin nhắn cũ</span>
 </button>
 </div>
 )}

 {mergedList.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-20 text-center px-4 w-full h-full opacity-60 mix-blend-screen select-none">
 <MessageSquare className="w-10 h-10 text-white/20 mb-4"/>
 <h4 className="text-zinc-300 font-sans text-sm font-medium uppercase tracking-wide mb-1">Khung chat trống</h4>
 <p className="text-zinc-500 text-[11px] font-sans italic max-w-[200px] leading-relaxed">Gửi tin nhắn hướng dẫn và tư vấn để bắt đầu câu chuyện cùng khách hàng.</p>
 </div>
 ) : (
 mergedList.map((msg, idx) => {
 const isAdminRole = msg.senderType ==="admin";
 const bubbleSenderLabel = isAdminRole ?"Bergh.Ryker Admin": displayName;
 const isSending = msg.sendingStatus ==="sending";
 const isFailed = msg.sendingStatus ==="failed";

 return (
 <div 
 key={`msg-${msg.id || 'msg'}-${idx}`} 
 className={`flex flex-col gap-1 w-full max-w-[85%] ${isAdminRole ? 'ml-auto items-end' : 'mr-auto items-start'}`}
 >
 {/* Timestamps tags */}
 <div className="flex items-baseline gap-1.5 px-1.5 select-none opacity-60">
 <span className={`text-[11px] font-bold tracking-wide flex gap-1 items-center ${
 isAdminRole ? 'text-zinc-400' : 'text-zinc-500'
 }`}>
 {bubbleSenderLabel}
 </span>
 <span className="text-[11px] text-zinc-600">
 {formatTimestamp(msg.createdAt)}
 </span>
 </div>

 {/* Speech rendering */}
 <div className="flex items-center gap-2 group max-w-full">
 <div className={`text-[13px] px-4 py-2.5 rounded-2xl leading-relaxed whitespace-pre-wrap select-text break-words shadow-sm font-sans ${
 isAdminRole 
 ? isFailed 
 ? 'bg-rose-500/10 text-rose-200 border border-rose-500/30 rounded-tr-sm'
 : isSending 
 ? 'bg-zinc-800 text-zinc-400 rounded-tr-sm border border-transparent'
 : 'bg-[#B5945B] text-black font-medium rounded-tr-sm' 
 : 'bg-zinc-800 border border-white/5 text-zinc-100 rounded-tl-sm'
 }`}>
 {msg.text}
 </div>

 {/* Retry buttons for failed dispatches */}
 {isFailed && (
 <button 
 onClick={() => handleReply(msg.text, msg.id)}
 className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-rose-500/20"
 title="Gửi thất bại. Nhấn để thử gửi lại."
 >
 <RotateCw className="w-4 h-4 text-rose-300"/>
 </button>
 )}
 </div>

 {/* Realtime indicators */}
 {isAdminRole && (isSending || isFailed) && (
 <div className="text-[11px] text-zinc-500 px-1 select-none flex items-center gap-1 font-medium">
 {isSending ?"Đang gửi...":"Thất bại"}
 </div>
 )}
 </div>
 );
 })
 )}

 {/* Float Jump Button helper */}
 <AnimatePresence>
 {isScrolledUp && (
 <motion.button
 initial={{ opacity: 0, y: 15 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 15 }}
 onClick={() => scrollToBottom()}
 className="absolute bottom-5 right-5 z-20 px-4 py-2.5 rounded-full bg-[#B5945B] hover:bg-amber-500 text-zinc-950 font-bold text-[12px] shadow-lg flex items-center gap-1.5 cursor-pointer uppercase tracking-wide min-h-[40px] shadow-[#B5945B]/10 max-md:py-3 max-md:px-5"
 >
 <ArrowDown className="w-3.5 h-3.5 animate-bounce"/>
 TIN MỚI NHẤT
 </motion.button>
 )}
 </AnimatePresence>
 </div>

 {/* Composer & Quick Replies */}
 <div className="bg-[#0a0a0a] shrink-0 border-t border-white/5 relative z-30 pt-1 pb-[max(12px,env(safe-area-inset-bottom))] px-3 md:px-4">
 <AnimatePresence>
 {showQuickReplies && (
 <motion.div 
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height:"auto"}}
 exit={{ opacity: 0, height: 0 }}
 className="w-full"
 >
 <div className="flex gap-2 overflow-x-auto py-2 scrollbar-none mask-fade-edges-x">
 {QUICK_REPLIES.map((reply, i) => (
 <button
 key={`admin-quick-reply-${i}`}
 type="button"
 onClick={() => {
 handleReplyTextChange(reply);
 scrollToBottom();
 setShowQuickReplies(false);
 }}
 className="text-[12px] font-sans px-4 py-2 rounded-full border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-all whitespace-nowrap shrink-0 snap-start cursor-pointer"
 >
 {reply.length > 40 ? reply.slice(0, 40) +"...": reply}
 </button>
 ))}
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 <div className="pt-2 pb-2">
 {sendError && (
 <div className="mb-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] rounded flex items-center justify-between gap-2">
 <span className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5"/> {sendError}</span>
 <button onClick={() => setSendError("")}><X className="w-4 h-4 hover:text-white transition-colors cursor-pointer"/></button>
 </div>
 )}
 
 <form 
 onSubmit={(e) => { e.preventDefault(); handleReply(); }}
 className="relative flex items-end gap-2 w-full"
 >
 <button
 type="button"
 onClick={() => setShowQuickReplies(!showQuickReplies)}
 className={`p-2 rounded-full shrink-0 h-10 w-10 flex items-center justify-center transition-all border cursor-pointer ${
 showQuickReplies ? 'bg-[#B5945B]/10 text-[#B5945B] border-[#B5945B]' : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
 }`}
 title="Gợi ý trả lời"
 >
 <Sparkles className="w-4 h-4"/>
 </button>

 <div className="flex-1 min-w-0 bg-zinc-900 border border-white/10 rounded-2xl focus-within:border-[#B5945B]/40 transition-colors flex items-end overflow-hidden p-1 shadow-inner">
 <textarea
 ref={textareaRef}
 rows={1}
 value={replyText}
 onChange={(e) => handleReplyTextChange(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder="Nhập tin nhắn (Enter để gửi)..."
 className="flex-1 bg-transparent text-zinc-100 text-[14px] pl-3 pr-2 py-2.5 focus:outline-none resize-none overflow-y-auto leading-relaxed max-h-[120px] scrollbar-none font-sans"
 />
 
 <button
 type="submit"
 disabled={isSending || !replyText.trim()}
 className="m-0.5 p-1.5 bg-[#B5945B] hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 rounded-xl transition-all cursor-pointer shrink-0 w-[36px] h-[36px] flex items-center justify-center self-end shadow-md"
 >
 {isSending ? (
 <RotateCw className="w-4 h-4 animate-spin text-zinc-900"/>
 ) : (
 <Send className="w-4 h-4 translate-x-[1px]"/>
 )}
 </button>
 </div>
 </form>
 </div>
 </div>
 </>
 );
 })()
 )}
 </div>

 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Premium Confirm Modal */}
 <AnimatePresence>
 {isConfirmOpen && (
 <div key="admin-live-chat-confirm-modal" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-sm px-4">
 <motion.div
 initial={{ scale: 0.95, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.95, opacity: 0 }}
 className="bg-zinc-950 border border-rose-500/20 rounded-3xl max-w-sm w-full p-6 text-center shadow-lg overflow-hidden font-sans"
 >
 <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20 mr-auto ml-auto">
 <AlertCircle className="w-6 h-6 animate-pulse"/>
 </div>

 <h4 className="text-white font-bold font-sans tracking-wide text-sm uppercase">XÓA CUỘC TRÒ CHUYỆN</h4>
 <p className="text-zinc-400 text-xs mt-3 leading-relaxed">
 Đằng ấy có chắc muốn xóa cuộc trò chuyện này vĩnh viễn chứ? Mọi tin nhắn sẽ bị xóa sạch khỏi cơ sở dữ liệu và không thể hoàn phục.
 </p>

 <div className="flex gap-3 mt-6">
 <button
 onClick={() => {
 setIsConfirmOpen(false);
 setConversationToDelete(null);
 }}
 className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[44px]"
 >
 Huỷ bỏ
 </button>
 <button
 onClick={handleConfirmDelete}
 className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[44px]"
 >
 Xác nhận xóa
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 </>
 );
};
