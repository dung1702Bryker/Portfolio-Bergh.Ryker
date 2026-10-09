import React, { useState, useRef, useEffect } from"react";
import { MessageCircle, X, Send, Loader2, Bot } from"lucide-react";
import { motion, AnimatePresence } from"motion/react";
import { db, auth, handleFirestoreError, OperationType } from"../firebase";
import { onAuthStateChanged } from"firebase/auth";
import { 
 doc, 
 getDoc, 
 setDoc, 
 updateDoc, 
 collection, 
 addDoc, 
 query,
 orderBy,
 onSnapshot,
 Timestamp,
 increment,
 serverTimestamp
} from"firebase/firestore";

interface Message {
 id?: string;
 text: string;
 senderType:"admin"|"customer";
 senderId: string;
 createdAt: any;
 sendingStatus:"sending"|"sent"|"failed";
}

export const Chatbot = () => {
 const [isOpen, setIsOpen] = useState(false);
 const [customerName, setCustomerName] = useState(() => localStorage.getItem("bergh_customer_name") ||"");
 const [hasEnteredName, setHasEnteredName] = useState(() => !!localStorage.getItem("bergh_customer_name"));
 const [currentUser, setCurrentUser] = useState<any>(null);
 
 const [deviceSessionId] = useState(() => {
 let id = localStorage.getItem("bergh_chat_session_id");
 if (!id) {
 id ="session_"+ Date.now() +"_"+ Math.random().toString(36).substring(2, 9);
 localStorage.setItem("bergh_chat_session_id", id);
 }
 return id;
 });

 const getChatId = () => currentUser?.uid || deviceSessionId;

 const initialWelcomeMsg: Message = { 
 id:"welcome_msg",
 text:"Helô đằng ấy nha! Mình là Đậu Đậu 🌱, trùm tư vấn kiêm chúa tể tám chuyện của Bergh.Ryker đây! Đằng ấy muốn nháy concept mặn mòi cỡ nào nè? Kể Đậu nghe thuiii ✨📷", 
 senderType:"admin", 
 senderId:"bot", 
 createdAt: new Date(), 
 sendingStatus:"sent"
 };

 const [firestoreMessages, setFirestoreMessages] = useState<Message[]>([]);
 const [localOptimistic, setLocalOptimistic] = useState<Message[]>([]);
  const [businessContext, setBusinessContext] = useState<string | null>(null);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(true);
  const [isContextLoading, setIsContextLoading] = useState(true);
 
 const [input, setInput] = useState("");
 const [isLoading, setIsLoading] = useState(false);
 const messagesEndRef = useRef<HTMLDivElement>(null);
 const chatScrollContainerRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 const unsubConfig = onSnapshot(doc(db, "appStore", "chatbotConfig"), (docSnap) => {
 if (docSnap.exists()) {
 setBusinessContext(docSnap.data().knowledge || "");
 } else {
 setBusinessContext("");
 }
 setIsContextLoading(false);
 }, (err) => {
 console.error("Context load error", err);
 setBusinessContext("");
 setIsContextLoading(false);
 });
 return () => unsubConfig();
 }, []);

 
  useEffect(() => {
    const q = query(collection(db, "availableDates"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const booked: string[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === "booked" || data.status === "unavailable") {
          booked.push(data.date || doc.id);
        }
      });
      setBookedDates(booked);
      setIsAvailabilityLoading(false);
    }, (err) => { console.error(err); setIsAvailabilityLoading(false); });
    return () => unsubscribe();
  }, []);


  useEffect(() => {
 const unsubscribe = onAuthStateChanged(auth, async (user) => {
 setCurrentUser(user || null);
 });
 return () => unsubscribe();
 }, []);

 useEffect(() => {
 if (!hasEnteredName) return;
 const conversationId = getChatId();
 if (!conversationId) return;

 const q = query(
 collection(db,"chat_sessions", conversationId,"messages"),
 orderBy("createdAt","asc")
 );
 const unsubscribe = onSnapshot(
 q, 
 (snapshot) => {
 const msgs: Message[] = [];
 snapshot.forEach((doc) => {
 const d = doc.data();
 msgs.push({
 id: doc.id,
 text: d.text ||"",
 senderType: d.senderType ||"customer",
 senderId: d.senderId ||"",
 createdAt: d.createdAt,
 sendingStatus: d.sendingStatus ||"sent"
 });
 });
 
 // Remove optimistic matches
 setLocalOptimistic(prev => {
 return prev.filter(p => !msgs.some(m => m.id === p.id));
 });
 
 setFirestoreMessages(msgs);
 
 // Clear unread customer counts when viewing
 if (isOpen) {
 updateDoc(doc(db,"chat_sessions", conversationId), {
 unreadCountCustomer: 0
 }).catch(() => {});
 }
 },
 (error) => {
 handleFirestoreError(error, OperationType.LIST, `chat_sessions/${conversationId}/messages`);
 }
 );
 return () => unsubscribe();
 }, [currentUser, hasEnteredName]); // Removed isOpen to keep syncing in background

 // Clear unreads when opening
 useEffect(() => {
 if (isOpen && hasEnteredName) {
 const conversationId = getChatId();
 updateDoc(doc(db,"chat_sessions", conversationId), {
 unreadCountCustomer: 0
 }).catch(() => {});
 }
 }, [isOpen, hasEnteredName]);

 const scrollToBottom = () => {
 if (chatScrollContainerRef.current) {
 chatScrollContainerRef.current.scrollTop = chatScrollContainerRef.current.scrollHeight;
 }
 };

 useEffect(() => {
 scrollToBottom();
 }, [firestoreMessages, localOptimistic, isLoading, isOpen]);

 const handleNameSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 const trimmed = customerName.trim();
 if (trimmed) {
 localStorage.setItem("bergh_customer_name", trimmed);
 setHasEnteredName(true);
 
 const welcomeId ="temp_"+ Date.now();
 const welcome: Message = { 
 id: welcomeId,
 text: `Chào ${trimmed}! nha! Đằng ấy cần Đậu giúp gì nè? 🌱`, 
 senderType:"admin", 
 senderId:"bot", 
 createdAt: Timestamp.now(), 
 sendingStatus:"sending"
 };
 setLocalOptimistic([welcome]);

 const conversationId = getChatId();
 if (conversationId) {
 try {
 const conversationRef = doc(db,"chat_sessions", conversationId);
 const conversationDoc = await getDoc(conversationRef);
 const now = Timestamp.now();

 if (!conversationDoc.exists()) {
 await setDoc(conversationRef, {
 customerName: trimmed,
 customerContact:"Web Visitor",
 customerChannel:"Web",
 lastMessage: welcome.text,
 lastMessageAt: now,
 unreadCountAdmin: 0,
 unreadCountCustomer: 1,
 status:"open",
 pinned: false
 });
 } else {
 await updateDoc(conversationRef, {
 customerName: trimmed
 });
 }
 
 await setDoc(doc(collection(db,"chat_sessions", conversationId,"messages"), welcomeId), {
 text: welcome.text,
 senderType:"admin",
 senderId:"bot",
 createdAt: now,
 sendingStatus:"sent"
 });
 } catch (err) {
 console.error("Failed to provision conversation profile:", err);
 }
 }
 }
 };

 const currentRenderingList = firestoreMessages.length === 0 && !hasEnteredName
 ? [initialWelcomeMsg]
 : [...firestoreMessages, ...localOptimistic];

 const handleSend = async (quickReplyText?: string | React.MouseEvent) => {
 const conversationId = getChatId();
 const userMessageText = typeof quickReplyText === 'string' ? quickReplyText.trim() : input.trim();
 
 if (!userMessageText || isLoading || !conversationId) return;
 
 if (isContextLoading) {
 setLocalOptimistic(prev => [
 ...prev, 
 { 
 id:"err_"+ Date.now(),
 text:"Hệ thống đang đồng bộ dữ liệu siêu cấp! Đằng ấy đợi xíu gòi nhắn lại nhen! 🌱", 
 senderType:"admin", 
 senderId:"bot", 
 createdAt: Timestamp.now(), 
 sendingStatus:"sent"
 }
 ]);
 return;
 }

 setIsLoading(true);
 if (typeof quickReplyText !== 'string') setInput("");

 const tempId ="temp_"+ Date.now();
 const userMsgObj: Message = { 
 id: tempId,
 text: userMessageText, 
 senderType:"customer", 
 senderId: conversationId, 
 createdAt: Timestamp.now(), 
 sendingStatus:"sending"
 };
 
 setLocalOptimistic(prev => [...prev, userMsgObj]);

 try {
 const now = Timestamp.now();
 const conversationRef = doc(db,"chat_sessions", conversationId);
 const conversationDoc = await getDoc(conversationRef);

 if (!conversationDoc.exists()) {
 await setDoc(conversationRef, {
 customerName: customerName ||"Guest",
 customerContact:"Web Visitor",
 customerChannel:"Web",
 lastMessage: userMessageText,
 lastMessageAt: now,
 unreadCountAdmin: 1,
 unreadCountCustomer: 0,
 status:"open",
 pinned: false
 });
 } else {
 await updateDoc(conversationRef, {
 lastMessage: userMessageText,
 lastMessageAt: now,
 unreadCountAdmin: increment(1),
 status:"open"
 });
 }

  await setDoc(doc(collection(db,"chat_sessions", conversationId,"messages"), tempId), {
  text: userMessageText,
  senderType:"customer",
  senderId: conversationId,
  createdAt: now,
  sendingStatus:"sent"
  });
 } catch (err: any) {
 console.error("Failed to save customer message to Firestore:", err);
 }

 try {
 const historyContext = currentRenderingList.map(m => ({ 
 role: m.senderType ==="admin"?"bot"as const :"user"as const, 
 content: m.text 
 }));

 const response = await fetch("/api/chat", {
 method:"POST",
 headers: { 
"Content-Type":"application/json",
"Accept":"application/json"
 },
 body: JSON.stringify({ 
        message: userMessageText, 
        history: historyContext, 
        businessContext: (businessContext || "") + "\n\n[TÌNH TRẠNG LỊCH CHỤP: " + (isAvailabilityLoading ? "Đang kết nối hệ thống để kiểm tra lịch trống. Hãy báo là đang chờ xác nhận từ hệ thống, chưa thể trả lời ngay." : ("LỊCH ĐÃ KÍN:" + (bookedDates.length > 0 ? bookedDates.join(", ") : "Không có ngày nào bị kín") + ". BẮT BUỘC BÁO HẾT CHỖ NẾU KHÁCH CHỌN NGÀY KÍN. CÁC NGÀY KHÁC ĐỀU TRỐNG")) + "]", 
        clientDate: new Date().toLocaleString() 
      })
 });

 let data;
 const responseText = await response.text();
 try {
 data = JSON.parse(responseText);
 } catch (e) {
 throw new Error("Lỗi máy chủ! Vui lòng thử lại sau xíu nhen. 🌱");
 }
 
 if (!response.ok) {
 throw new Error(data.error ||"Gặp lỗi khi gửi tin nhắn");
 }

 const botReplyText = data.reply;
 const botTempId ="bot_"+ Date.now();
 const botMsgObj: Message = {
 id: botTempId,
 text: botReplyText,
 senderType:"admin",
 senderId:"bot",
 createdAt: Timestamp.now(),
 sendingStatus:"sending"
 };

 setLocalOptimistic(prev => [...prev, botMsgObj]);

 try {
 const nowReply = Timestamp.now();
 const conversationRef = doc(db,"chat_sessions", conversationId);
 
 await updateDoc(conversationRef, {
 lastMessage: botReplyText,
 lastMessageAt: nowReply,
 unreadCountCustomer: isOpen ? 0 : increment(1)
 });
 
 await setDoc(doc(collection(db,"chat_sessions", conversationId,"messages"), botTempId), {
 text: botReplyText,
 senderType:"admin",
 senderId:"bot",
 createdAt: nowReply,
 sendingStatus:"sent"
      });

      if (data.bookingData) {
        // Open the booking form and prefill data
        window.dispatchEvent(new CustomEvent('openBookingForm', {
          detail: {
            source: 'chatbot',
            prefill: data.bookingData
          }
        }));

        setTimeout(() => {
          setIsOpen(false); // Close chatbot to avoid blocking the form on mobile
          setTimeout(() => {
            const formElement = document.getElementById('booking-contact-section');
            if (formElement) {
              const yOffset = -24; 
              const y = formElement.getBoundingClientRect().top + window.scrollY + yOffset;
              window.scrollTo({ top: y, behavior: 'smooth' });
              
              formElement.style.transition = 'all 0.4s ease-out';
              formElement.style.boxShadow = '0 0 0 2px #B5945B, 0 0 30px rgba(181,148,91,0.15)';
              setTimeout(() => {
                formElement.style.boxShadow = 'none';
              }, 4000);
            }
          }, 300); // Wait for chatbot close animation and form expand animation
        }, 100);
      }

    } catch (err: any) {
 console.error("Failed to save bot chatbot reply to Firestore:", err);
 }
 } catch (error: any) {
 console.error("Chat error:", error);
 const errReplyText = error.message ||"Gặp lỗi khi gửi tin nhắn ứa ừa!";
 setLocalOptimistic(prev => [
 ...prev, 
 { 
 id:"err_"+ Date.now(),
 text: errReplyText, 
 senderType:"admin", 
 senderId:"bot", 
 createdAt: Timestamp.now(), 
 sendingStatus:"sent"
 }
 ]);
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <>
 <motion.button
 id="chatbot-trigger-floating"
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 whileHover={{ scale: 1.05 }}
 whileTap={{ scale: 0.95 }}
 onClick={() => setIsOpen(!isOpen)}
 className="fixed bottom-[max(14px,env(safe-area-inset-bottom))] right-3 sm:right-6 z-[70] w-11 h-11 sm:w-13 sm:h-13 rounded-full liquid-glass-btn border-[#B5945B]/40 text-[#B5945B] hover:text-white shadow-2xl flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95"
 aria-label="Trợ lý tư vấn AI"
 title="Trợ lý tư vấn AI (Bấm để trò chuyện)"
 >
 {isOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6"/> : <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6"/>}
 </motion.button>

 <AnimatePresence>
 {isOpen && (
 <motion.div
 id="chatbot-client-box"
 initial={{ opacity: 0, y: 20, scale: 0.9 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 20, scale: 0.9 }}
 transition={{ duration: 0.2 }}
 className="fixed bottom-[calc(4.5rem+max(16px,env(safe-area-inset-bottom)))] sm:bottom-[calc(5.5rem+max(24px,env(safe-area-inset-bottom)))] right-4 sm:right-6 w-[calc(100vw-32px)] max-w-[360px] liquid-glass-dark liquid-glass border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-[70] origin-bottom-right"
 style={{ height:"min(500px, calc(100vh - 120px))"}}
 >
 <div className="liquid-glass-header p-4 border-b border-white/10 flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-[#B5945B]/10 border border-[#B5945B]/30 flex items-center justify-center text-[#B5945B]">
 <Bot className="w-6 h-6"/>
 </div>
 <div className="flex-1 flex flex-col justify-center leading-tight">
 <h3 className="font-sans font-bold text-sm tracking-wide text-white uppercase flex items-center gap-2">
 Đậu Đậu <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px] font-sans leading-none py-1 px-1.5 rounded uppercase font-medium tracking-wide hidden sm:inline-block">Online</span>
 </h3>
 <p className="text-[11px] text-zinc-400 font-sans tracking-wide mt-1">
 Sẵn sàng giải đáp
 </p>
 </div>
 </div>

 <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 font-sans bg-[#0a0a0a] scrollbar-thin">
 {!hasEnteredName ? (
 <div className="flex flex-col h-full items-center justify-center space-y-4">
 <div className="w-16 h-16 rounded-full bg-[#B5945B]/10 border border-[#B5945B]/30 flex items-center justify-center text-[#B5945B] mb-2">
 <MessageCircle className="w-8 h-8"/>
 </div>
 <div className="text-center">
 <h4 className="text-white font-sans font-bold tracking-wide mb-1 text-sm">CHÀO ĐẰNG ẤY NHA!</h4>
 <p className="text-zinc-400 text-xs font-sans mt-2">Dạ cho Đậu xin tên của đằng ấy để xưng hô cho dễ nha! 🌱</p>
 </div>
 <form onSubmit={handleNameSubmit} className="w-full max-w-[240px] space-y-3 mt-2">
 <input 
 type="text"
 value={customerName}
 onChange={(e) => setCustomerName(e.target.value)}
 placeholder="Bấm vào đây nhập tên nạ..."
 className="w-full bg-zinc-900 border border-white/10 text-zinc-200 text-[16px] sm:text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#B5945B]/50 transition-colors text-center shadow-sm"
 autoFocus
 />
 <button 
 type="submit"
 disabled={!customerName.trim()}
 className="w-full py-2.5 bg-[#B5945B] hover:bg-[#CBAA71] disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 rounded-xl transition-colors font-medium uppercase tracking-wide flex items-center justify-center gap-2 text-[11px] cursor-pointer shadow-md shadow-[#B5945B]/10 font-sans"
 >
 Bắt đầu chat thui <Send className="w-3.5 h-3.5"/>
 </button>
 </form>
 </div>
 ) : (
 <>
 {currentRenderingList.map((msg, idx) => {
 const isUser = msg.senderType ==="customer";
 return (
 <div key={`chatbot-msg-${msg.id || idx}-${idx}`} className={`flex ${isUser ?"justify-end":"justify-start"}`}>
 <div className={`max-w-[80%] rounded-2xl p-3 text-[13px] ${isUser ?"bg-[#B5945B] text-zinc-950 font-medium":"bg-zinc-900 border border-white/5 text-zinc-300"} whitespace-pre-wrap leading-relaxed break-words shadow-sm`}>
 {msg.text}
 {msg.sendingStatus ==="sending"&& <div className="text-[11px] opacity-60 mt-1 uppercase font-sans tracking-wide">Đang gửi...</div>}
 </div>
 </div>
 );
 })}
 {isLoading && (
 <div className="flex justify-start">
 <div className="bg-zinc-900 border border-white/5 rounded-2xl py-2.5 px-3 flex items-center gap-2 shadow-sm">
 <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B5945B]"/>
 <span className="text-[11px] text-zinc-400 font-sans">Đậu Đậu đang gõ...</span>
 </div>
 </div>
 )}
 
 {/* Quick Replies */}
 {currentRenderingList.length > 0 && currentRenderingList[currentRenderingList.length - 1].senderType === "admin" && !isLoading && (
 <div className="flex flex-wrap gap-2 mt-2 justify-start">
 {["Xem gói chụp", "Xem lịch trống", "Liên hệ"].map((reply, rIdx) => (
 <button
 key={`qr-${reply}-${rIdx}`}
 onClick={() => handleSend(reply)}
 className="px-3 py-1.5 text-[11px] font-sans font-medium text-[#B5945B] border border-[#B5945B]/30 hover:bg-[#B5945B]/10 rounded-full transition-colors whitespace-nowrap"
 >
 {reply}
 </button>
 ))}
 </div>
 )}
 
 <div ref={messagesEndRef} />
 </>
 )}
 </div>

 <div className="px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-zinc-950 border-t border-white/5 shrink-0 z-20">
 <div className="relative flex items-center border border-white/10 rounded-full bg-zinc-900 focus-within:border-[#B5945B]/40 transition-colors shadow-inner overflow-hidden pr-1 h-11">
 <input
 type="text"
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
 if (e.key ==="Enter"&& !e.nativeEvent.isComposing) {
 e.preventDefault();
 handleSend();
 }
 }}
 disabled={!hasEnteredName || isLoading}
 placeholder={hasEnteredName ?"Nhập tin nhắn...":"Vui lòng nhập tên trước..."}
 className="flex-1 bg-transparent text-zinc-200 text-[16px] sm:text-[13px] pl-4 h-full py-2.5 focus:outline-none disabled:opacity-50 font-sans"
 />
 <button 
 onClick={handleSend}
 disabled={!input.trim() || isLoading || !hasEnteredName}
 className="w-8 h-8 mr-1 bg-[#B5945B] hover:bg-[#CBAA71] text-zinc-950 rounded-full transition-colors disabled:bg-zinc-800 disabled:text-zinc-600 cursor-pointer flex items-center justify-center shrink-0"
 >
 <Send className="w-4 h-4 translate-x-[1px]"/>
 </button>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </>
 );
};
