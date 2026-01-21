/**
 * Script to generate app icons from SVG sources
 *
 * This script converts SVG files to PNG with the required dimensions for iOS and Android.
 *
 * Prerequisites:
 * npm install sharp
 *
 * Usage:
 * node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not installed. Please run: npm install sharp');
  console.log('\nAlternatively, you can convert SVGs manually using online tools:');
  console.log('1. https://cloudconvert.com/svg-to-png');
  console.log('2. https://svgtopng.com/');
  console.log('\nRequired files:');
  console.log('- icon.png: 1024x1024');
  console.log('- splash.png: 1284x2778');
  console.log('- adaptive-icon.png: 1024x1024');
  console.log('- favicon.png: 48x48');
  process.exit(0);
}

const assetsDir = path.join(__dirname, '..', 'src', 'assets', 'images');

const icons = [
  {
    input: 'icon.svg',
    output: 'icon.png',
    width: 1024,
    height: 1024,
  },
  {
    input: 'splash.svg',
    output: 'splash.png',
    width: 1284,
    height: 2778,
  },
  {
    input: 'adaptive-icon.svg',
    output: 'adaptive-icon.png',
    width: 1024,
    height: 1024,
  },
  {
    input: 'icon.svg',
    output: 'favicon.png',
    width: 48,
    height: 48,
  },
];

async function generateIcons() {
  console.log('Generating icons...\n');

  for (const icon of icons) {
    const inputPath = path.join(assetsDir, icon.input);
    const outputPath = path.join(assetsDir, icon.output);

    if (!fs.existsSync(inputPath)) {
      console.log(`⚠️  Skipping ${icon.input} - file not found`);
      continue;
    }

    try {
      await sharp(inputPath)
        .resize(icon.width, icon.height)
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated ${icon.output} (${icon.width}x${icon.height})`);
    } catch (error) {
      console.error(`❌ Error generating ${icon.output}:`, error.message);
    }
  }

  console.log('\n✨ Icon generation complete!');
}

generateIcons();
