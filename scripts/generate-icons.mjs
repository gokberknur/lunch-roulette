import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const iconsDir = resolve(root, 'static/icons');

async function emit(svg, name, size, opts = {}) {
	const out = resolve(iconsDir, name);
	const pipeline = sharp(svg, { density: 600 }).resize(size, size, {
		fit: 'contain',
		background: opts.background ?? { r: 255, g: 107, b: 53, alpha: 1 }
	});
	await pipeline.png().toFile(out);
	console.log('wrote', out);
}

async function main() {
	await mkdir(iconsDir, { recursive: true });
	const svg = await readFile(resolve(iconsDir, 'icon.svg'));
	await emit(svg, 'icon-192.png', 192);
	await emit(svg, 'icon-512.png', 512);
	// Maskable icons need a safe zone — use the same SVG, the rect already provides padding.
	await emit(svg, 'icon-maskable-512.png', 512);
	await emit(svg, 'apple-touch-icon.png', 180);
	await emit(svg, 'favicon-32.png', 32);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
