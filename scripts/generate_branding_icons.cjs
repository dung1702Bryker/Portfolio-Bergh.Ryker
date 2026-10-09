const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Generate SVG string for the signature logo
// Options:
// - theme: 'dark' (obsidian black bg with gold/white logo) or 'white' (pure white bg with black logo)
// - width, height: dimensions (e.g. 1200x630 for standard og, 1200x1200 for square og, 512x512 for pwa)
function createLogoSvg({ width, height, theme = 'dark', isSquare = true }) {
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#09090b' : '#ffffff';
  const textColor = isDark ? '#f4f4f5' : '#18181b';
  const accentColor = isDark ? '#c5a059' : '#18181b';
  const lineColor = isDark ? '#52525b' : '#27272a';
  const goldGradient = isDark ? `
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5deb3" />
      <stop offset="40%" stop-color="#dfb76c" />
      <stop offset="70%" stop-color="#c5a059" />
      <stop offset="100%" stop-color="#9a7b38" />
    </linearGradient>
    <radialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#c5a059" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#09090b" stop-opacity="0" />
    </radialGradient>
  ` : `
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#27272a" />
    </linearGradient>
  `;

  // Scale and center logic
  const scale = Math.min(width, height) / 512;
  const centerX = width / 2;
  const centerY = height / 2;

  // In the original 1.LOGO.png:
  // Center is roughly around (256, 256) in a 512x512 space:
  // "B E R G H" is at x: 90..230, y: 245
  // Horizontal line is at y: 262, from x: 105 to 405
  // Signature "Ryker" swoops from y: 175 down to y: 310 across x: 220..365
  // "RYKER STUDIO" is at x: 280..400, y: 282
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      ${goldGradient}
      <filter id="subtleShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="${isDark ? '0.4' : '0.08'}"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${width}" height="${height}" fill="${bgColor}" />
    ${isDark ? `<circle cx="${centerX}" cy="${centerY}" r="${Math.min(width, height) * 0.45}" fill="url(#ambientGlow)" />` : ''}

    <!-- Transformed Logo Group -->
    <g transform="translate(${centerX}, ${centerY}) scale(${scale * 0.95}) translate(-256, -256)" filter="url(#subtleShadow)">
      
      <!-- "B E R G H" text (clean modern spaced uppercase) -->
      <text 
        x="105" 
        y="250" 
        font-family="-apple-system, BlinkMacSystemFont, 'Montserrat', 'Helvetica Neue', 'Segoe UI', sans-serif" 
        font-size="25" 
        font-weight="300" 
        fill="${textColor}" 
        letter-spacing="9"
      >BERGH</text>

      <!-- Horizontal Divider Line -->
      <line 
        x1="110" 
        y1="264" 
        x2="400" 
        y2="264" 
        stroke="${lineColor}" 
        stroke-width="1.6" 
        stroke-linecap="round"
      />

      <!-- "RYKER STUDIO" subtitle text (below line, right aligned) -->
      <text 
        x="278" 
        y="287" 
        font-family="-apple-system, BlinkMacSystemFont, 'Montserrat', 'Helvetica Neue', 'Segoe UI', sans-serif" 
        font-size="12" 
        font-weight="400" 
        fill="${isDark ? '#d4d4d8' : '#3f3f46'}" 
        letter-spacing="4.5"
      >RYKER STUDIO</text>

      <!-- Artistic Handwritten Calligraphy Signature "Ryker" -->
      <!-- Smooth flowing strokes with variable pressure emulation -->
      <g fill="none" stroke="url(#goldGradient)" stroke-linecap="round" stroke-linejoin="round">
        
        <!-- Flourishing R: Top loop and sweeping stem -->
        <path 
          d="M 220 205 
             C 245 192, 290 182, 320 186
             C 310 198, 290 220, 240 282
             C 225 301, 216 308, 222 298
             C 230 284, 252 245, 275 200
             C 290 170, 310 188, 305 205
             C 300 222, 278 244, 256 250" 
          stroke-width="2.6"
        />

        <!-- Secondary upper decorative loop of R -->
        <path 
          d="M 230 200 
             C 260 190, 325 180, 324 195 
             C 322 210, 280 230, 260 248" 
          stroke-width="1.8" 
          opacity="0.9"
        />

        <!-- Downward descender and diagonal stroke connecting to 'y' -->
        <path 
          d="M 262 246 
             C 275 258, 288 275, 296 295
             C 298 300, 295 306, 290 306
             C 278 304, 264 280, 260 268
             C 255 252, 275 240, 288 244
             C 296 247, 304 256, 308 266" 
          stroke-width="2.2"
        />

        <!-- The 'y' loop plunging gracefully below the divider line -->
        <path 
          d="M 308 266 
             C 306 280, 298 318, 292 328
             C 285 338, 274 340, 272 332
             C 270 320, 290 288, 315 254" 
          stroke-width="2.2"
        />

        <!-- The ascender of 'k' -->
        <path 
          d="M 315 254 
             C 326 238, 342 210, 348 200
             C 352 194, 356 198, 350 212
             C 340 235, 332 258, 332 268
             C 336 260, 345 252, 354 254
             C 360 256, 354 268, 348 270" 
          stroke-width="2.0"
        />

        <!-- The 'e' and concluding 'r' stroke flourishing out -->
        <path 
          d="M 348 270 
             C 354 262, 362 258, 368 264
             C 372 268, 366 274, 360 274
             C 366 266, 376 258, 385 258
             C 392 258, 396 264, 402 260" 
          stroke-width="2.0"
        />

        <!-- Dynamic underline accent brush stroke -->
        <path 
          d="M 226 295 
             C 245 285, 270 262, 302 264
             C 325 266, 355 258, 370 248" 
          stroke-width="1.4"
          opacity="0.75"
        />
      </g>
    </g>
  </svg>
  `;
}

async function buildAll() {
  const publicDir = path.join(__dirname, '..', 'public');

  console.log('Generating SVG templates...');
  
  // 1. Dark theme SVGs
  const svgDark1200x630 = createLogoSvg({ width: 1200, height: 630, theme: 'dark', isSquare: false });
  const svgDarkSquare = createLogoSvg({ width: 1200, height: 1200, theme: 'dark', isSquare: true });
  const svgDark512 = createLogoSvg({ width: 512, height: 512, theme: 'dark', isSquare: true });

  // 2. White theme SVGs (clean version identical to 1.LOGO.png)
  const svgWhite1200x630 = createLogoSvg({ width: 1200, height: 630, theme: 'white', isSquare: false });
  const svgWhiteSquare = createLogoSvg({ width: 1200, height: 1200, theme: 'white', isSquare: true });

  // Save SVG
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgDark512);
  fs.writeFileSync(path.join(publicDir, 'logo-signature-dark.svg'), svgDarkSquare);
  fs.writeFileSync(path.join(publicDir, 'logo-signature-white.svg'), svgWhiteSquare);

  console.log('Rendering high-res PNGs with sharp...');

  // Standard OpenGraph 1200x630 (Facebook, Zalo, Twitter, LinkedIn)
  await sharp(Buffer.from(svgDark1200x630))
    .png({ quality: 95, compressionLevel: 8 })
    .toFile(path.join(publicDir, 'og-image.png'));
  console.log('✓ og-image.png (1200x630) created');

  // Square OpenGraph 1200x1200 (iMessage, Messenger square preview as in screenshot!)
  await sharp(Buffer.from(svgDarkSquare))
    .png({ quality: 95, compressionLevel: 8 })
    .toFile(path.join(publicDir, 'og-image-square.png'));
  console.log('✓ og-image-square.png (1200x1200) created');

  // White theme alternatives
  await sharp(Buffer.from(svgWhite1200x630))
    .png({ quality: 95, compressionLevel: 8 })
    .toFile(path.join(publicDir, 'og-image-white.png'));
  await sharp(Buffer.from(svgWhiteSquare))
    .png({ quality: 95, compressionLevel: 8 })
    .toFile(path.join(publicDir, 'og-image-square-white.png'));

  // Mobile App Icons (Apple Touch Icon & PWA Icons)
  // Apple Touch Icon (180x180)
  await sharp(Buffer.from(svgDarkSquare))
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png (180x180) updated');

  // PWA 192x192
  await sharp(Buffer.from(svgDarkSquare))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('✓ pwa-192x192.png (192x192) updated');

  // PWA 512x512
  await sharp(Buffer.from(svgDarkSquare))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('✓ pwa-512x512.png (512x512) updated');

  // PWA Maskable 512x512 (with safe inner padding)
  await sharp(Buffer.from(svgDarkSquare))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('✓ pwa-maskable-512x512.png (512x512) updated');

  // Favicon 64x64
  await sharp(Buffer.from(svgDarkSquare))
    .resize(64, 64)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  console.log('✓ favicon.png (64x64) updated');

  console.log('All branding assets generated successfully!');
}

buildAll().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
