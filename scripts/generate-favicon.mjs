/**
 * Generates flat, modern favicon assets for 24p.
 *
 * Design: dark navy rounded square (#111827) with bold white "24" numerals
 * and subtle film-strip perforations at top and bottom edges.
 *
 * Run: node scripts/generate-favicon.mjs
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const outputIcoPath = "public/favicon.ico";
const outputFavicon16PngPath = "public/favicon-16.png";
const outputFavicon32PngPath = "public/favicon-32.png";
const outputAppleTouchIconPath = "public/apple-touch-icon.png";
const outputAndroidChrome192Path = "public/android-chrome-192x192.png";
const outputAndroidChrome512Path = "public/android-chrome-512x512.png";
const outputSvgPath = "public/favicon.svg";

/**
 * Master SVG design — 512×512 canvas.
 *
 * Dark navy rounded square (#111827) with bold white "24" and subtle
 * film-strip perforations at the top and bottom edges.
 */
const MASTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <!-- Background -->
  <rect width="512" height="512" rx="104" fill="#111827"/>
  <!-- Top perforations (3 rectangles, centred) -->
  <rect x="140" y="36" width="44" height="32" rx="7" fill="white" opacity="0.35"/>
  <rect x="234" y="36" width="44" height="32" rx="7" fill="white" opacity="0.35"/>
  <rect x="328" y="36" width="44" height="32" rx="7" fill="white" opacity="0.35"/>
  <!-- Bottom perforations -->
  <rect x="140" y="444" width="44" height="32" rx="7" fill="white" opacity="0.35"/>
  <rect x="234" y="444" width="44" height="32" rx="7" fill="white" opacity="0.35"/>
  <rect x="328" y="444" width="44" height="32" rx="7" fill="white" opacity="0.35"/>
  <!-- "24" numeral -->
  <text
    x="256" y="352"
    font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
    font-weight="800"
    font-size="264"
    fill="white"
    text-anchor="middle"
    letter-spacing="-8"
  >24</text>
</svg>`;

function buildIco(pngBuffersBySize) {
  const sizes = Object.keys(pngBuffersBySize)
    .map((s) => Number(s))
    .sort((a, b) => a - b);
  const count = sizes.length;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const images = [];

  sizes.forEach((size, i) => {
    const png = pngBuffersBySize[size];
    const entryOffset = i * 16;
    dir.writeUInt8(size === 256 ? 0 : size, entryOffset + 0);
    dir.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    dir.writeUInt8(0, entryOffset + 2);
    dir.writeUInt8(0, entryOffset + 3);
    dir.writeUInt16LE(1, entryOffset + 4);
    dir.writeUInt16LE(32, entryOffset + 6);
    dir.writeUInt32LE(png.length, entryOffset + 8);
    dir.writeUInt32LE(offset, entryOffset + 12);
    images.push(png);
    offset += png.length;
  });

  return Buffer.concat([header, dir, ...images]);
}

async function renderAt(size) {
  return sharp(Buffer.from(MASTER_SVG))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const pngBuffersBySize = {};
  for (const size of icoSizes) {
    pngBuffersBySize[size] = await renderAt(size);
  }

  const ico = buildIco(pngBuffersBySize);
  await writeFile(outputIcoPath, ico);
  await writeFile(outputFavicon16PngPath, pngBuffersBySize[16]);
  await writeFile(outputFavicon32PngPath, pngBuffersBySize[32]);
  await writeFile(outputAppleTouchIconPath, await renderAt(180));
  await writeFile(outputAndroidChrome192Path, await renderAt(192));
  await writeFile(outputAndroidChrome512Path, await renderAt(512));
  await writeFile(outputSvgPath, Buffer.from(MASTER_SVG));

  console.log(
    `Wrote favicon.ico (${ico.length} bytes), favicon-16.png, favicon-32.png, apple-touch-icon.png, android-chrome-192x192.png, android-chrome-512x512.png, favicon.svg`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
