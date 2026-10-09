import React from"react";
import { motion, AnimatePresence } from"motion/react";
import { AlertTriangle, X } from"lucide-react";

interface ConfirmDialogProps {
 isOpen: boolean;
 title: string;
 message: string;
 onConfirm: () => void;
 onCancel: () => void;
 confirmText?: string;
 cancelText?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
 isOpen,
 title,
 message,
 onConfirm,
 onCancel,
 confirmText ="Xác nhận",
 cancelText ="Huỷ",
}) => {
 return (
 <AnimatePresence>
 {isOpen && (
 <div key="confirm-dialog-wrapper" className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="absolute inset-0 bg-black/60 backdrop-blur-sm"
 onClick={onCancel}
 />
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 10 }}
 className="relative bg-[#101012] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-lg"
 >
 <div className="flex justify-between items-start mb-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
 <AlertTriangle className="w-6 h-6"/>
 </div>
 <h3 className="text-lg font-bold text-white font-sans">
 {title}
 </h3>
 </div>
 <button
 onClick={onCancel}
 className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
 >
 <X className="w-5 h-5"/>
 </button>
 </div>

 <p className="text-sm text-gray-400 mb-6 font-manrope leading-relaxed">
 {message}
 </p>

 <div className="flex items-center justify-end gap-3 font-sans">
 <button
 onClick={onCancel}
 className="px-4 py-2 hover:bg-white/5 rounded-xl text-gray-400 text-[11px] font-sans font-medium uppercase tracking-wide transition-colors"
 >
 {cancelText}
 </button>
 <button
 onClick={() => {
 onConfirm();
 onCancel(); // Close after confirm
 }}
 className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[11px] font-sans font-medium uppercase tracking-wide transition-colors shadow-md"
 >
 {confirmText}
 </button>
 </div>
 </motion.div>
 </div>
 )}
 </AnimatePresence>
 );
};
