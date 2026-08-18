/**
 * optimize-hero-images.mjs
 * Converts the large JPG hero images to WebP (max 1920px wide, quality 82).
 * Output goes to src/images/optimized/
 */

import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const INPUT_DIR  = join(__dirname, '../src/images');
const OUTPUT_DIR = join(__dirname, '../src/images/optimized');

const TARGET_WIDTH = 1920;   // px – carousel is never wider than this
const QUALITY      = 82;     // WebP quality (0-100); 82 gives excellent visual quality

await mkdir(OUTPUT_DIR, { recursive: true });

const files = (await readdir(INPUT_DIR))
  .filter(f => /^044A\d+\.(JPG|jpg|jpeg)$/i.test(f));

console.log(`Found ${files.length} hero images to optimize.\n`);

for (const file of files) {
  const inputPath  = join(INPUT_DIR, file);
  const outputName = basename(file, extname(file)) + '.webp';
  const outputPath = join(OUTPUT_DIR, outputName);

  const { size: sizeBefore } = await stat(inputPath);

  await sharp(inputPath)
    .rotate()                          // respect EXIF orientation
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(outputPath);

  const { size: sizeAfter } = await stat(outputPath);
  const reduction = (((sizeBefore - sizeAfter) / sizeBefore) * 100).toFixed(1);

  console.log(
    `${file.padEnd(16)} ${(sizeBefore / 1024 / 1024).toFixed(2)} MB  →  ` +
    `${outputName.padEnd(20)} ${(sizeAfter / 1024).toFixed(0)} KB  (-${reduction}%)`
  );
}

console.log('\nDone. Optimized images saved to src/images/optimized/');
