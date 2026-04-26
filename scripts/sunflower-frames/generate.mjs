import puppeteer from "puppeteer";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const ASSETS = path.join(ROOT, "assets/ambient");

const FRAME_SIZE = 256;
const FRAMES = 24;
const GRID_COLS = 6;
const GRID_ROWS = 4;
const SHEET_W = FRAME_SIZE * GRID_COLS;
const SHEET_H = FRAME_SIZE * GRID_ROWS;
const READY_TIMEOUT_MS = 10000;

async function renderScene(scenePath, outputName) {
  console.log(`[render] ${scenePath}`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-web-security",
      "--enable-webgl",
      "--use-gl=angle",
    ],
  });
  let frames;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: FRAME_SIZE, height: FRAME_SIZE });
    await page.goto(`file://${scenePath}`);
    await page.waitForFunction(() => window.READY === true, {
      timeout: READY_TIMEOUT_MS,
    });

    frames = [];
    for (let i = 0; i < FRAMES; i++) {
      const rotationY = (i / FRAMES) * Math.PI * 2;
      await page.evaluate((rot) => window.renderFrame(rot), rotationY);
      const buf = await page.screenshot({
        type: "png",
        omitBackground: true,
        clip: { x: 0, y: 0, width: FRAME_SIZE, height: FRAME_SIZE },
      });
      frames.push(buf);
      process.stdout.write(`\r  frame ${i + 1}/${FRAMES}`);
    }
    process.stdout.write("\n");
  } finally {
    await browser.close();
  }

  const compositeOps = [];
  for (let i = 0; i < FRAMES; i++) {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    compositeOps.push({
      input: frames[i],
      left: col * FRAME_SIZE,
      top: row * FRAME_SIZE,
    });
  }

  const out = path.join(ASSETS, outputName);
  await sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeOps)
    .webp({ quality: 85, lossless: false, alphaQuality: 90 })
    .toFile(out);

  const stats = await fs.stat(out);
  console.log(`[done] ${outputName}: ${(stats.size / 1024).toFixed(1)} KB`);
}

async function main() {
  await fs.mkdir(ASSETS, { recursive: true });
  await renderScene(
    path.join(__dirname, "scene-day.html"),
    "sunflower-day.webp",
  );
  await renderScene(
    path.join(__dirname, "scene-night.html"),
    "sunflower-night.webp",
  );
  console.log("[all done]");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
