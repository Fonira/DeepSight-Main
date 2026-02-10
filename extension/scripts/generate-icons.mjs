/**
 * Generate PNG icons from SVG source for Chrome Extension manifest.
 * Usage: node scripts/generate-icons.mjs
 * Requires: npm install --save-dev sharp
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '..', 'icons');

// Use the 128px SVG as source (highest detail)
const svgSource = readFileSync(resolve(iconsDir, 'icon128.svg'));

const sizes = [16, 32, 48, 128];

async function generateIcons() {
  for (const size of sizes) {
    await sharp(svgSource)
      .resize(size, size)
      .png()
      .toFile(resolve(iconsDir, `icon${size}.png`));
    console.log(`Generated icon${size}.png`);
  }
  console.log('All icons generated successfully.');
}

generateIcons().catch(console.error);
