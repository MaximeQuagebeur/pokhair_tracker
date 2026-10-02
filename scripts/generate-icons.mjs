// Regenerates build/icon.png (used by electron-builder for .icns/.ico/AppImage) from build/icon.svg.
import sharp from 'sharp';

await sharp('build/icon.svg', { density: 300 }).resize(1024, 1024).png().toFile('build/icon.png');
console.log('build/icon.png generated');
