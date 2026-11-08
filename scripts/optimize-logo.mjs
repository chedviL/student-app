/**
 * optimize-logo.mjs
 * Builds small web versions of the 3.5MB source logo (src/assets/logo.png):
 *   src/assets/logo.webp        – used in the UI (max display ~200px, 2x for retina)
 *   public/favicon-64.png       – browser tab icon
 *   public/apple-touch-icon.png – home-screen icon
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const src = join(root, 'src/assets/logo.png');

await sharp(src).resize({ width: 400 }).webp({ quality: 85, alphaQuality: 90 }).toFile(join(root, 'src/assets/logo.webp'));
await sharp(src).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(join(root, 'public/favicon-64.png'));
await sharp(src).resize(180, 180, { fit: 'contain', background: '#ffffff' }).png({ compressionLevel: 9 }).toFile(join(root, 'public/apple-touch-icon.png'));
console.log('logo variants written');
