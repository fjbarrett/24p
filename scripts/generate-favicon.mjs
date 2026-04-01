import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const inputPath = "public/awesome-favicon.png";
const outputIcoPath = "public/favicon.ico";
const outputPreviewPngPath = "public/favicon-disk.png";
const outputFavicon16PngPath = "public/favicon-16.png";
const outputFavicon32PngPath = "public/favicon-32.png";
const outputAppleTouchIconPath = "public/apple-touch-icon.png";
const outputAndroidChrome192Path = "public/android-chrome-192x192.png";
const outputAndroidChrome512Path = "public/android-chrome-512x512.png";

const faviconContentScaleRaw = Number(process.env.FAVICON_CONTENT_SCALE ?? "0.78");
const faviconContentScale = Number.isFinite(faviconContentScaleRaw)
  ? Math.max(0.5, Math.min(1, faviconContentScaleRaw))
  : 0.78;

const pwaContentScaleRaw = Number(process.env.PWA_CONTENT_SCALE ?? "0.92");
const pwaContentScale = Number.isFinite(pwaContentScaleRaw)
  ? Math.max(0.7, Math.min(1, pwaContentScaleRaw))
  : 0.92;

function getPixel(raw, width, x, y) {
  const idx = (y * width + x) * 4;
  return [raw[idx], raw[idx + 1], raw[idx + 2], raw[idx + 3]];
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, value | 0));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = (sorted.length / 2) | 0;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function estimateBackgroundLuminance(raw, width, height) {
  const points = [
    [8, 8],
    [width - 9, 8],
    [8, height - 9],
    [width - 9, height - 9],
    [width / 2, 8],
    [width / 2, height - 9],
    [8, height / 2],
    [width - 9, height / 2],
  ];
  const lums = points.map(([x, y]) => {
    const [r, g, b] = getPixel(raw, width, clampInt(x, 0, width - 1), clampInt(y, 0, height - 1));
    return luminance(r, g, b);
  });
  return median(lums);
}

function findDiskCircle(raw, width, height) {
  const bgLum = estimateBackgroundLuminance(raw, width, height);

  const tryThresholds = [Math.max(bgLum + 65, 85), Math.max(bgLum + 45, 70), Math.max(bgLum + 30, 60)];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 512));

  for (const threshold of tryThresholds) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let count = 0;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const [r, g, b] = getPixel(raw, width, x, y);
        if (luminance(r, g, b) > threshold) {
          count += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (count < 2000) continue;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const radius = Math.min((maxX - minX) / 2, (maxY - minY) / 2);

    return { cx, cy, radius };
  }

  throw new Error("Failed to detect disk circle from luminance bounds.");
}

function applyCircularAlpha(raw, width, height, cx, cy, radius, featherPx = 2) {
  const out = Buffer.from(raw);

  const r0 = radius - featherPx;
  const r1 = radius + featherPx;
  const r0sq = r0 * r0;
  const r1sq = r1 * r1;

  for (let y = 0; y < height; y++) {
    const dy = y - cy;
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const d2 = dx * dx + dy * dy;
      const idx = (y * width + x) * 4;

      let a;
      if (d2 <= r0sq) {
        a = 255;
      } else if (d2 >= r1sq) {
        a = 0;
      } else {
        const d = Math.sqrt(d2);
        const t = (d - r0) / (r1 - r0);
        a = Math.round(255 * (1 - t));
      }

      out[idx + 3] = a;
    }
  }

  return out;
}

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

async function renderPaddedPng(base, size, contentScale) {
  const clampedScale = Math.max(0.5, Math.min(1, contentScale));
  const contentSize = Math.max(1, Math.round(size * clampedScale));
  const offset = Math.floor((size - contentSize) / 2);

  const content = await base
    .clone()
    .resize(contentSize, contentSize)
    .png({ compressionLevel: 9 })
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: content, left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const source = sharp(inputPath);
  const { data, info } = await source
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) throw new Error(`Expected 4 channels, got ${info.channels}`);

  const { cx, cy, radius: detectedRadius } = findDiskCircle(data, info.width, info.height);
  const radius = Math.max(1, detectedRadius - 2);
  const maskedRaw = applyCircularAlpha(data, info.width, info.height, cx, cy, radius, 2);

  const cropRadius = Math.min(radius * 1.001, Math.min(info.width, info.height) / 2 - 1);
  const cropSize = Math.max(1, Math.round(cropRadius * 2));
  const cropLeft = clampInt(Math.round(cx - cropSize / 2), 0, info.width - cropSize);
  const cropTop = clampInt(Math.round(cy - cropSize / 2), 0, info.height - cropSize);

  const masked = sharp(maskedRaw, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).extract({ left: cropLeft, top: cropTop, width: cropSize, height: cropSize });

  const icoSizes = [16, 32, 48, 64, 128, 256];
  const pngBuffersBySize = {};

  for (const size of icoSizes) {
    pngBuffersBySize[size] = await renderPaddedPng(masked, size, faviconContentScale);
  }

  const ico = buildIco(pngBuffersBySize);

  await writeFile(outputIcoPath, ico);
  await writeFile(
    outputFavicon16PngPath,
    await renderPaddedPng(masked, 16, faviconContentScale),
  );
  await writeFile(
    outputFavicon32PngPath,
    await renderPaddedPng(masked, 32, faviconContentScale),
  );
  await writeFile(
    outputAppleTouchIconPath,
    await renderPaddedPng(masked, 180, pwaContentScale),
  );
  await writeFile(
    outputAndroidChrome192Path,
    await renderPaddedPng(masked, 192, pwaContentScale),
  );
  await writeFile(
    outputAndroidChrome512Path,
    await renderPaddedPng(masked, 512, pwaContentScale),
  );
  await masked
    .clone()
    .resize(512, 512)
    .png({ compressionLevel: 9 })
    .toFile(outputPreviewPngPath);

  console.log(
    `Wrote ${outputIcoPath} (${ico.length} bytes), ${outputFavicon16PngPath}, ${outputFavicon32PngPath}, ${outputAppleTouchIconPath}, ${outputAndroidChrome192Path}, ${outputAndroidChrome512Path}, and ${outputPreviewPngPath}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
