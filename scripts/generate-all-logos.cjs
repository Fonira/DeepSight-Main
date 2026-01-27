/**
 * Script to generate all logo sizes for Deep Sight
 *
 * Prerequisites:
 * npm install sharp
 *
 * Usage:
 * node scripts/generate-all-logos.cjs
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

const projectRoot = path.join(__dirname, '..');
const sourceLogo = path.join(projectRoot, 'frontend', 'public', 'new-logo-source.png');

// All logos to generate
const logos = [
  // Frontend main logos
  { output: 'frontend/public/logo.png', size: 512 },
  { output: 'frontend/public/logo-dark.png', size: 512 },
  { output: 'frontend/public/logo-dark-bg.png', size: 512 },
  { output: 'frontend/public/logo-deep-sight.png', size: 512 },

  // Favicons
  { output: 'frontend/public/favicon-16x16.png', size: 16 },
  { output: 'frontend/public/favicon-32x32.png', size: 32 },
  { output: 'frontend/public/favicon-48x48.png', size: 48 },

  // Apple touch icon
  { output: 'frontend/public/apple-touch-icon.png', size: 180 },

  // PWA icons
  { output: 'frontend/public/icons/icon-72x72.png', size: 72 },
  { output: 'frontend/public/icons/icon-96x96.png', size: 96 },
  { output: 'frontend/public/icons/icon-128x128.png', size: 128 },
  { output: 'frontend/public/icons/icon-144x144.png', size: 144 },
  { output: 'frontend/public/icons/icon-152x152.png', size: 152 },
  { output: 'frontend/public/icons/icon-192x192.png', size: 192 },
  { output: 'frontend/public/icons/icon-384x384.png', size: 384 },
  { output: 'frontend/public/icons/icon-512x512.png', size: 512 },

  // Backend
  { output: 'backend/static/logo.png', size: 512 },
  { output: 'backend/static/icon-512x512.png', size: 512 },
];

async function generateLogos() {
  console.log('🎨 Generating Deep Sight logos from new source...\n');

  if (!fs.existsSync(sourceLogo)) {
    console.error('❌ Source logo not found:', sourceLogo);
    process.exit(1);
  }

  console.log('📁 Source:', sourceLogo);
  console.log('');

  for (const logo of logos) {
    const outputPath = path.join(projectRoot, logo.output);
    const outputDir = path.dirname(outputPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      console.log(`📁 Creating directory: ${outputDir}`);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      await sharp(sourceLogo)
        .resize(logo.size, logo.size, {
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 100 })
        .toFile(outputPath);

      console.log(`✅ ${logo.output} (${logo.size}x${logo.size})`);
    } catch (error) {
      console.error(`❌ Error generating ${logo.output}:`, error.message);
    }
  }

  // Generate favicon.ico (multi-resolution)
  console.log('\n🔧 Generating favicon.ico...');
  try {
    const faviconPath = path.join(projectRoot, 'frontend', 'public', 'favicon.ico');
    await sharp(sourceLogo)
      .resize(32, 32, { fit: 'cover', position: 'center' })
      .png()
      .toFile(faviconPath);

    console.log('✅ favicon.ico generated (32x32 PNG)');
  } catch (error) {
    console.error('❌ Error generating favicon.ico:', error.message);
  }

  console.log('\n✨ Logo generation complete!');
}

// Generate Open Graph image
async function generateOGImage() {
  console.log('\n🖼️  Generating Open Graph image...');

  const ogWidth = 1200;
  const ogHeight = 630;
  const logoSize = 300;

  try {
    const logoBuffer = await sharp(sourceLogo)
      .resize(logoSize, logoSize, { fit: 'cover', position: 'center' })
      .toBuffer();

    // Create dark background with centered logo
    const ogImage = sharp({
      create: {
        width: ogWidth,
        height: ogHeight,
        channels: 4,
        background: { r: 10, g: 10, b: 11, alpha: 1 } // #0a0a0b
      }
    });

    const outputPath = path.join(projectRoot, 'backend', 'static', 'og-image.png');
    await ogImage
      .composite([
        {
          input: logoBuffer,
          top: Math.floor((ogHeight - logoSize) / 2),
          left: Math.floor((ogWidth - logoSize) / 2),
        }
      ])
      .png()
      .toFile(outputPath);

    console.log(`✅ og-image.png (${ogWidth}x${ogHeight})`);

    // Also copy to frontend
    const frontendOGPath = path.join(projectRoot, 'frontend', 'public', 'og-image.png');
    fs.copyFileSync(outputPath, frontendOGPath);
    console.log('✅ Copied og-image.png to frontend/public/');

  } catch (error) {
    console.error('❌ Error generating OG image:', error.message);
  }
}

generateLogos().then(() => generateOGImage()).catch(console.error);
