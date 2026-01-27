/**
 * Script to generate app icons from PNG source for Deep Sight Mobile
 *
 * Prerequisites:
 * npm install sharp
 *
 * Usage:
 * node scripts/generate-icons.cjs
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not installed. Please run: npm install sharp');
  process.exit(1);
}

const assetsDir = path.join(__dirname, '..', 'src', 'assets', 'images');
const sourceImage = path.join(assetsDir, 'icon-source.png');

const icons = [
  {
    output: 'icon.png',
    width: 1024,
    height: 1024,
  },
  {
    output: 'adaptive-icon.png',
    width: 1024,
    height: 1024,
  },
  {
    output: 'favicon.png',
    width: 48,
    height: 48,
  },
];

async function generateSplash() {
  console.log('Generating splash screen...');

  const splashWidth = 1284;
  const splashHeight = 2778;
  const logoSize = 400; // Size of logo in splash

  try {
    // Create splash screen with logo centered
    const logoBuffer = await sharp(sourceImage)
      .resize(logoSize, logoSize, { fit: 'cover', position: 'center' })
      .toBuffer();

    // Create dark background
    const splash = sharp({
      create: {
        width: splashWidth,
        height: splashHeight,
        channels: 4,
        background: { r: 10, g: 10, b: 11, alpha: 1 } // #0a0a0b
      }
    });

    // Composite logo onto background
    const outputPath = path.join(assetsDir, 'splash.png');
    await splash
      .composite([
        {
          input: logoBuffer,
          top: Math.floor((splashHeight - logoSize) / 2) - 100, // Slightly above center
          left: Math.floor((splashWidth - logoSize) / 2),
        }
      ])
      .png()
      .toFile(outputPath);

    console.log(`✅ Generated splash.png (${splashWidth}x${splashHeight})`);
  } catch (error) {
    console.error('❌ Error generating splash:', error.message);
  }
}

async function generateIcons() {
  console.log('🎨 Generating Deep Sight Mobile icons...\n');

  if (!fs.existsSync(sourceImage)) {
    console.error('❌ Source image not found:', sourceImage);
    console.log('   Please copy the logo source to: src/assets/images/icon-source.png');
    process.exit(1);
  }

  console.log('📁 Source:', sourceImage);
  console.log('');

  for (const icon of icons) {
    const outputPath = path.join(assetsDir, icon.output);

    try {
      await sharp(sourceImage)
        .resize(icon.width, icon.height, { fit: 'cover', position: 'center' })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated ${icon.output} (${icon.width}x${icon.height})`);
    } catch (error) {
      console.error(`❌ Error generating ${icon.output}:`, error.message);
    }
  }

  // Generate splash screen
  await generateSplash();

  console.log('\n✨ Icon generation complete!');
}

generateIcons();
