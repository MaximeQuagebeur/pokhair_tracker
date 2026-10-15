// Regenerates build/icon.png (used by electron-builder for .icns/.ico/AppImage) from build/icon.svg,
// plus the PWA icons in public/icons (iOS requires an opaque apple-touch-icon).
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

await sharp('build/icon.svg', { density: 300 }).resize(1024, 1024).png().toFile('build/icon.png');
console.log('build/icon.png generated');

await mkdir('public/icons', { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await sharp('build/icon.svg', { density: 300 }).resize(size, size).flatten({ background: '#0f172a' }).png().toFile(`public/icons/${name}`);
  console.log(`public/icons/${name} generated`);
}
