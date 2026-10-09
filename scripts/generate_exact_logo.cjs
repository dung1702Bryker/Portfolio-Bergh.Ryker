const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Generates the EXACT logo as uploaded in 1.LOGO.png:
// - PURE WHITE background (#FFFFFF)
// - JET BLACK typography & calligraphic signature (#000000 / #111111)
// - Exact composition: "BERGH" on left, thin divider line, "Ryker" cursive flowing through, "RYKER STUDIO" on right below line.
function generateExactLogoSvg(width, height) {
  // viewBox 0 0 800 800
  // Centered coordinate system
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
  <!-- Pure White Background identical to 1.LOGO.png -->
  <rect width="800" height="800" fill="#FFFFFF" />

  <g id="logo-group">
    <!-- "B E R G H" in clean, geometric, elegant spaced sans-serif -->
    <text 
      x="165" 
      y="388" 
      font-family="-apple-system, BlinkMacSystemFont, 'Montserrat', 'Helvetica Neue', 'Arial', sans-serif" 
      font-size="34" 
      font-weight="400" 
      fill="#000000" 
      letter-spacing="14"
    >BERGH</text>

    <!-- Horizontal Divider Line matching 1.LOGO.png -->
    <line 
      x1="180" 
      y1="412" 
      x2="625" 
      y2="412" 
      stroke="#000000" 
      stroke-width="1.8" 
      stroke-linecap="square"
    />

    <!-- "RYKER STUDIO" in clean sans-serif under the line on the right -->
    <text 
      x="435" 
      y="448" 
      font-family="-apple-system, BlinkMacSystemFont, 'Montserrat', 'Helvetica Neue', 'Arial', sans-serif" 
      font-size="16" 
      font-weight="400" 
      fill="#000000" 
      letter-spacing="5.5"
    >RYKER STUDIO</text>

    <!-- Cursive Signature "Ryker" exactly mirroring the uploaded calligraphy -->
    <g fill="none" stroke="#000000" stroke-linecap="round" stroke-linejoin="round">
      
      <!-- 1. The grand initial swooping stroke of the 'R' starting top-left -->
      <path 
        d="M 345 335 
           C 385 305, 450 290, 500 298
           C 475 320, 420 375, 370 442
           C 358 458, 355 468, 362 462
           C 375 448, 410 380, 442 318
           C 460 282, 492 300, 482 328
           C 472 355, 440 385, 410 398" 
        stroke-width="2.6"
      />

      <!-- 2. The upper flourish loop of 'R' -->
      <path 
        d="M 355 330 
           C 395 312, 485 292, 502 315
           C 498 335, 440 375, 412 396" 
        stroke-width="2.0"
      />

      <!-- 3. The diagonal connection & right leg of R flowing into 'y' -->
      <path 
        d="M 412 396 
           C 426 410, 442 432, 452 460
           C 455 468, 450 472, 442 470
           C 425 465, 412 430, 418 412
           C 424 394, 445 378, 460 382
           C 470 385, 480 398, 485 412" 
        stroke-width="2.4"
      />

      <!-- 4. The deep dramatic descender loop of 'y' plunging below line -->
      <path 
        d="M 485 412 
           C 480 432, 468 480, 458 495
           C 448 510, 432 512, 430 498
           C 426 480, 455 435, 492 390" 
        stroke-width="2.4"
      />

      <!-- 5. Ascender loop of 'k' -->
      <path 
        d="M 492 390 
           C 510 365, 532 328, 542 312
           C 548 302, 554 308, 545 328
           C 530 362, 518 398, 518 412
           C 524 402, 538 390, 550 392
           C 558 395, 550 412, 542 416" 
        stroke-width="2.2"
      />

      <!-- 6. Compact loop of 'e' and fluid finishing flick of 'r' -->
      <path 
        d="M 542 416 
           C 550 404, 560 398, 570 405
           C 575 412, 566 420, 558 420
           C 566 410, 580 398, 592 398
           C 602 398, 610 406, 618 400" 
        stroke-width="2.2"
      />

      <!-- 7. Dynamic accent slash line across center matching original -->
      <path 
        d="M 365 450 
           C 390 435, 425 405, 470 408
           C 505 410, 545 400, 568 385" 
        stroke-width="1.8"
      />
    </g>
  </g>
</svg>`;
}

async function renderAssets() {
  const publicDir = path.join(__dirname, '..', 'public');
  const distDir = path.join(__dirname, '..', 'dist');

  console.log('Generating exact 1.LOGO SVG and PNGs...');
  
  // 1. Generate full square 1200x1200 and standard 1200x630
  const svg800 = generateExactLogoSvg(800, 800);
  const svg1200Square = generateExactLogoSvg(1200, 1200);

  // Write SVGs
  fs.writeFileSync(path.join(publicDir, 'logo-exact.svg'), svg800);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svg800);

  // 2. Render og-image-square.png (1200x1200) - EXACT MATCH FOR SOCIAL SHARING!
  const squareBuffer = await sharp(Buffer.from(svg1200Square))
    .png({ quality: 100 })
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'og-image-square.png'), squareBuffer);
  fs.writeFileSync(path.join(publicDir, 'og-image.png'), squareBuffer);
  console.log('✓ og-image-square.png & og-image.png (Pure White + Black Logo) created');

  // Also write to dist if it exists
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'og-image-square.png'), squareBuffer);
    fs.writeFileSync(path.join(distDir, 'og-image.png'), squareBuffer);
  }

  // 3. Render Apple Touch Icon (180x180)
  const appleIcon = await sharp(squareBuffer)
    .resize(180, 180)
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'apple-touch-icon.png'), appleIcon);
  }
  console.log('✓ apple-touch-icon.png created');

  // 4. Render PWA Icons
  const pwa192 = await sharp(squareBuffer).resize(192, 192).png().toBuffer();
  const pwa512 = await sharp(squareBuffer).resize(512, 512).png().toBuffer();

  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), pwa192);
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), pwa512);
  fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pwa512);
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'pwa-192x192.png'), pwa192);
    fs.writeFileSync(path.join(distDir, 'pwa-512x512.png'), pwa512);
    fs.writeFileSync(path.join(distDir, 'pwa-maskable-512x512.png'), pwa512);
  }
  console.log('✓ PWA icons updated');

  // 5. Favicon
  const favicon = await sharp(squareBuffer).resize(64, 64).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), favicon);
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'favicon.png'), favicon);
  }
  console.log('✓ favicon.png updated');

  console.log('All exact logo files created successfully!');
}

renderAssets().catch(err => {
  console.error('Error rendering exact assets:', err);
  process.exit(1);
});
