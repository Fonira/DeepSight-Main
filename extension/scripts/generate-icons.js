/**
 * Icon Generator Script
 * Creates PNG icons from SVG for the Chrome extension
 * 
 * Run: node scripts/generate-icons.js
 * Requires: sharp (npm install sharp --save-dev)
 */

const fs = require('fs');
const path = require('path');

// SVG Icon template
const createSvgIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="url(#gradient)"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.3}" fill="none" stroke="white" stroke-width="${size * 0.05}"/>
  <path d="M ${size/2} ${size * 0.25} L ${size/2} ${size/2} L ${size * 0.65} ${size * 0.58}" 
        fill="none" stroke="white" stroke-width="${size * 0.05}" stroke-linecap="round"/>
</svg>
`;

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG files (can be converted to PNG manually or with sharp)
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const svg = createSvgIcon(size);
  const svgPath = path.join(iconsDir, `icon${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`Created: ${svgPath}`);
});

// If sharp is available, convert to PNG
try {
  const sharp = require('sharp');
  
  sizes.forEach(async (size) => {
    const svg = createSvgIcon(size);
    const pngPath = path.join(iconsDir, `icon${size}.png`);
    
    await sharp(Buffer.from(svg))
      .png()
      .toFile(pngPath);
    
    console.log(`Created PNG: ${pngPath}`);
  });
} catch (e) {
  console.log('\\n💡 To generate PNG icons, install sharp:');
  console.log('   npm install sharp --save-dev');
  console.log('   Then run this script again.\\n');
  console.log('For now, SVG icons have been created. You can convert them manually.');
}
