/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkroom: '#050505',    // 60% Deep Background (Darkroom Obsidian)
        graphite: '#111111',    // 30% Surface/Card (Matte Graphite)
        opticYellow: '#E2FF00', // Accent Focus Peaking Yellow
        cyanOptic: '#00D4FF',   // Accent Digital Lens Flare Cyan
      },
      fontFamily: {
        syne: ['"Plus Jakarta Sans"', 'sans-serif'],     // Primary Title
        manrope: ['"Plus Jakarta Sans"', 'sans-serif'] // Secondary Body/Numbers
      },
      boxShadow: {
        resting: '0px 24px 48px rgba(0, 0, 0, 0.7)', // 3D Depth layering
        glow: '0 0 20px rgba(226, 255, 0, 0.15)',    // Outer Glow / Focus Lock
      },
      borderRadius: {
        tech: '4px', // Hard geometric edges
      },
      borderColor: {
        metallic: 'rgba(255, 255, 255, 0.08)',
      },
      letterSpacing: {
        editorial: '-0.02em',
      }
    },
  },
  plugins: [],
}
