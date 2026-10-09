import React, { useEffect, useState } from "react";
import { motion } from "motion/react";

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  shape: "circle" | "square" | "triangle";
  duration: number;
  delay: number;
}

export const SubtleConfetti: React.FC = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = [
      "#10b981", // Emerald 500
      "#34d399", // Emerald 400
      "#a7f3d0", // Emerald 200
      "#B5945B", // Gold/Bronze Accent
      "#FBBF24", // Amber 400
      "#ffffff", // White
      "#fbbf24", // Yellow
    ];
    const shapes: ("circle" | "square" | "triangle")[] = ["circle", "square", "triangle"];

    const generated: Particle[] = Array.from({ length: 70 }).map((_, i) => {
      // Angle for a nice radial burst (wider upwards and sidewards)
      // Math.random() * Math.PI * 1.5 - Math.PI * 1.25 gives a broad upward/outward cone
      const angle = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7; // angles going mostly upwards and sideways
      const distance = 100 + Math.random() * 250;
      
      return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        rotation: Math.random() * 360,
        scale: 0.4 + Math.random() * 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        duration: 1.8 + Math.random() * 1.6,
        delay: Math.random() * 0.15,
      };
    });

    setParticles(generated);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50 flex items-center justify-center">
      {particles.map((p, pIdx) => {
        let borderRadius = "0px";
        const width = p.shape === "circle" ? "8px" : "10px";
        const height = p.shape === "circle" ? "8px" : "6px";
        if (p.shape === "circle") {
          borderRadius = "9999px";
        }

        return (
          <motion.div
            key={`confetti-${p.id}-${pIdx}`}
            initial={{ x: 0, y: 100, scale: 0, rotate: 0, opacity: 1 }}
            animate={{
              x: p.x,
              y: p.y + 120, // simulate fall / gravity pull 
              scale: [0, p.scale, p.scale * 0.5, 0],
              rotate: p.rotation * 4,
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: p.duration,
              ease: "easeOut",
              delay: p.delay,
            }}
            className="absolute bottom-1/2 left-1/2 -ml-1"
            style={{
              width,
              height,
              backgroundColor: p.shape !== "triangle" ? p.color : "transparent",
              borderRadius,
              borderLeft: p.shape === "triangle" ? "5px solid transparent" : undefined,
              borderRight: p.shape === "triangle" ? "5px solid transparent" : undefined,
              borderBottom: p.shape === "triangle" ? `10px solid ${p.color}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
};
