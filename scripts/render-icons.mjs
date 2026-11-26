import { copyFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const jobs = [
  ['design/icon.svg', 'public/icons/icon-512.png', 512],
  ['design/icon.svg', 'public/icons/icon-192.png', 192],
  ['design/icon.svg', 'public/icons/apple-touch-icon.png', 180],
  ['design/icon.svg', 'public/favicon-32.png', 32],
  ['design/icon-maskable.svg', 'public/icons/icon-maskable-512.png', 512],
];

await mkdir('public/icons', { recursive: true });
await copyFile('design/icon.svg', 'public/favicon.svg');

for (const [src, dest, size] of jobs) {
  await sharp(src, { density: 384 })
    .resize(size, size, { fit: 'fill' })
    .flatten({ background: '#111111' })
    .png({ compressionLevel: 9 })
    .toFile(dest);
}
