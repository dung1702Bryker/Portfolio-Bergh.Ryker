import React, { useState, useRef, useEffect } from 'react';
import { Move } from 'lucide-react';

interface ImagePositionControlProps {
 src: string;
 value: string;
 onChange: (value: string) => void;
 onDragEnd?: (value: string) => void;
 aspectRatio?: string;
 label?: string;
 scale?: number;
}

export const ImagePositionControl: React.FC<ImagePositionControlProps> = ({
 src,
 value,
 onChange,
 onDragEnd,
 aspectRatio ="16/9",
 label ="Kéo để căn chỉnh khung hình",
 scale = 1.0
}) => {
 const containerRef = useRef<HTMLDivElement>(null);
 const [isDragging, setIsDragging] = useState(false);
 const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
 const [startPos, setStartPos] = useState({ x: 50, y: 50 });
 const [currentPos, setCurrentPos] = useState<string | null>(null);
 const [hovered, setHovered] = useState(false);
 
 const displayValue = currentPos ?? value ??"center";

 // Parse initial value (e.g.,"50% 50%","center","left top")
 useEffect(() => {
 if (!isDragging) {
 setCurrentPos(null); // Reset local override when done dragging
 const valToParse = value ||"center";
 if (valToParse ==="center") {
 setStartPos({ x: 50, y: 50 });
 } else if (valToParse.includes("%")) {
 const parts = valToParse.split("");
 const x = parseFloat(parts[0]) || 50;
 const y = parseFloat(parts[1]) || 50;
 setStartPos({ x, y });
 } else {
 // Map common text to percentages
 let x = 50, y = 50;
 if (valToParse.includes("left")) x = 0;
 if (valToParse.includes("right")) x = 100;
 if (valToParse.includes("top")) y = 0;
 if (valToParse.includes("bottom")) y = 100;
 setStartPos({ x, y });
 }
 }
 }, [value, isDragging]);

 const handlePointerDown = (e: React.PointerEvent) => {
 setIsDragging(true);
 setStartMouse({ x: e.clientX, y: e.clientY });
 e.currentTarget.setPointerCapture(e.pointerId);
 };

 const handlePointerMove = (e: React.PointerEvent) => {
 if (!isDragging || !containerRef.current) return;
 
 // Calculate difference
 const dx = e.clientX - startMouse.x;
 const dy = e.clientY - startMouse.y;
 
 const rect = containerRef.current.getBoundingClientRect();
 
 const sensitivityX = 100 / rect.width;
 const sensitivityY = 100 / rect.height;
 
 let newX = startPos.x - (dx * sensitivityX);
 let newY = startPos.y - (dy * sensitivityY);
 
 // Clamp between 0 and 100
 newX = Math.max(0, Math.min(100, newX));
 newY = Math.max(0, Math.min(100, newY));
 
 const newVal = `${newX.toFixed(1)}% ${newY.toFixed(1)}%`;
 setCurrentPos(newVal);
 onChange(newVal);
 };

 const handlePointerUp = (e: React.PointerEvent) => {
 if (isDragging) {
 setIsDragging(false);
 e.currentTarget.releasePointerCapture(e.pointerId);
 
 // Update start pos for next drag
 let finalVal = currentPos ?? value;
 if (finalVal.includes("%")) {
 const parts = finalVal.split("");
 const x = parseFloat(parts[0]) || 50;
 const y = parseFloat(parts[1]) || 50;
 setStartPos({ x, y });
 finalVal = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
 }
 
 if (onDragEnd) {
 onDragEnd(finalVal);
 }
 }
 };

 const handleReset = () => {
 setCurrentPos("center");
 onChange("center");
 if (onDragEnd) onDragEnd("center");
 };

 return (
 <div className="flex flex-col w-full group">
 <div 
 ref={containerRef}
 className={`relative w-full rounded-xl overflow-hidden border-2 transition-all ${isDragging ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'border-white/10 hover:border-white/10'} bg-zinc-950 cursor-move touch-none`}
 style={{ aspectRatio }}
 onPointerDown={handlePointerDown}
 onPointerMove={handlePointerMove}
 onPointerUp={handlePointerUp}
 onPointerCancel={handlePointerUp}
 onMouseEnter={() => setHovered(true)}
 onMouseLeave={() => setHovered(false)}
 >
 {src ? (
 <img 
 src={src} 
 alt="Position preview"
 draggable={false}
 className="w-full h-full object-cover pointer-events-none"
 style={{ objectPosition: displayValue, transform: `scale(${scale})` }}
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-white/5">
 <span className="text-zinc-600 text-[12px] uppercase font-sans">No Image</span>
 </div>
 )}
 
 {/* Helper Overlay */}
 <div className={`absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${isDragging || hovered ? 'opacity-100' : 'opacity-0'}`}>
 <div className={`w-12 h-12 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm border border-white/20 transition-transform ${isDragging ? 'scale-90 text-amber-500 border-amber-500/50' : 'scale-100 text-white'}`}>
 <Move className="w-6 h-6"/>
 </div>
 </div>
 
 {/* Grid lines to help positioning */}
 {(isDragging || hovered) && (
 <>
 <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20 pointer-events-none mix-blend-overlay"></div>
 <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20 pointer-events-none mix-blend-overlay"></div>
 <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20 pointer-events-none mix-blend-overlay"></div>
 <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20 pointer-events-none mix-blend-overlay"></div>
 </>
 )}

 <div className="absolute top-1 left-1 md:top-2 md:left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[11px] md:text-[11px] font-sans text-white/90 border border-white/10 flex gap-1 md:gap-2 pointer-events-none shadow-lg">
 <span>X: {startPos.x.toFixed(0)}%</span>
 <span className="opacity-50">|</span>
 <span>Y: {startPos.y.toFixed(0)}%</span>
 </div>
 </div>
 
 <div className="flex items-center justify-between px-1 mt-2">
 <span className="text-[11px] md:text-[12px] text-zinc-400 font-medium">
 {label}
 </span>
 <button 
 onClick={handleReset}
 className="text-amber-500 hover:text-amber-400 text-[11px] md:text-[12px] font-bold px-2 py-1 bg-amber-500/10 rounded transition-colors"
 type="button"
 >
 Reset (Giữa)
 </button>
 </div>
 </div>
 );
};

