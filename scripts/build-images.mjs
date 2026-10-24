#!/usr/bin/env node
// Builds responsive images and the hero video from content/image-manifest.json.
//
//   npm run images            build everything that has a source file
//   npm run images:check      report missing sources and uncleared rights; exit 1 if any
//
// Options: --source <dir> (default assets/source)  --out <dir> (default public)  --force

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const CHECK = args.includes('--check');
const FORCE = args.includes('--force');
const SOURCE = path.resolve(root, opt('--source') || 'assets/source');
const OUT = path.resolve(root, opt('--out') || 'public');
const SOURCE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff'];
const VIDEO_EXT = ['.mp4', '.mov', '.m4v', '.webm'];

const manifest = JSON.parse(await fs.readFile(path.join(root, 'content/image-manifest.json'), 'utf8'));
const { quality } = manifest.defaults;

const findSource = (dir, id, exts) => exts.map(e => path.join(dir, id + e)).find(existsSync);
const ratio = aspect => { const [w, h] = aspect.split(':').map(Number); return h / w; };
const isStale = async (src, out) => FORCE || !existsSync(out) || (await fs.stat(src)).mtimeMs > (await fs.stat(out)).mtimeMs;
const rel = p => path.relative(root, p);
const publicUrl = p => '/' + path.relative(OUT, p).split(path.sep).join('/');

// ---------- Check ----------
const problems = [];
for (const img of manifest.images) {
  const src = findSource(path.join(SOURCE, img.category), img.id, SOURCE_EXT);
  if (!src) problems.push(`missing   ${img.category}/${img.id}  →  put it in ${rel(path.join(SOURCE, img.category))}/${img.id}.jpg`);
  if (img.rights?.status !== 'cleared') problems.push(`rights    ${img.category}/${img.id}  →  rights.status is "${img.rights?.status}"`);
}
for (const vid of manifest.videos) {
  if (!findSource(path.join(SOURCE, 'videos'), vid.id, VIDEO_EXT)) problems.push(`missing   videos/${vid.id}  →  optional; the poster image is used instead`);
  if (vid.rights?.status !== 'cleared') problems.push(`rights    videos/${vid.id}  →  rights.status is "${vid.rights?.status}"`);
}
if (CHECK) {
  console.log(problems.length ? problems.join('\n') : 'All assets present and cleared.');
  process.exit(problems.some(p => !p.includes('optional')) ? 1 : 0);
}

// ---------- Images ----------
const registry = {};
let built = 0, skipped = 0;

for (const img of manifest.images) {
  const src = findSource(path.join(SOURCE, img.category), img.id, SOURCE_EXT);
  if (!src) { skipped++; continue; }

  const dir = path.join(OUT, 'images', img.category);
  await fs.mkdir(dir, { recursive: true });
  const meta = await sharp(src).metadata();
  const srcWidth = meta.orientation >= 5 ? meta.height : meta.width; // EXIF 5–8 = rotated 90°
  const r = ratio(img.aspect);

  // Never upscale: drop widths larger than the source, but always keep at least one.
  let widths = img.widths.filter(w => w <= srcWidth);
  if (widths.length < img.widths.length) console.warn(`! ${img.id}: source is ${srcWidth}px wide; skipped ${img.widths.filter(w => w > srcWidth).join(', ')}px`);
  if (!widths.length) widths = [srcWidth];

  const entry = { alt: img.alt, aspect: img.aspect, loading: img.loading, width: widths.at(-1), height: Math.round(widths.at(-1) * r), srcset: {} };

  for (const fmt of manifest.defaults.formats) {
    entry.srcset[fmt] = [];
    for (const w of widths) {
      const file = path.join(dir, `${img.id}-${w}.${fmt}`);
      if (await isStale(src, file)) {
        await sharp(src).rotate()
          .resize(w, Math.round(w * r), { fit: 'cover', position: img.crop === 'attention' ? sharp.strategy.attention : img.crop })
          [fmt]({ quality: quality[fmt], effort: fmt === 'avif' ? 6 : 5 })
          .toFile(file);
        built++;
      }
      entry.srcset[fmt].push(`${publicUrl(file)} ${w}w`);
    }
    entry.srcset[fmt] = entry.srcset[fmt].join(', ');
  }

  // Canonical file at the path named in the asset plan (e.g. /images/hero/tirumala-hero.webp): ~1600px or the largest available.
  const canonicalW = widths.filter(w => w <= 1600).at(-1) ?? widths[0];
  const canonical = path.join(dir, `${img.id}.webp`);
  if (await isStale(src, canonical)) await fs.copyFile(path.join(dir, `${img.id}-${canonicalW}.webp`), canonical);
  entry.src = publicUrl(canonical);

  // Tiny blurred placeholder, inlined as a data URI (about 300 bytes).
  const lqip = await sharp(src).rotate().resize(16, Math.round(16 * r), { fit: 'cover' }).blur(1).webp({ quality: 40 }).toBuffer();
  entry.placeholder = `data:image/webp;base64,${lqip.toString('base64')}`;

  registry[img.id] = entry;
}

// ---------- Video ----------
const videos = {};
for (const vid of manifest.videos) {
  const src = findSource(path.join(SOURCE, 'videos'), vid.id, VIDEO_EXT);
  const poster = registry[vid.poster];
  if (!src) { if (poster) videos[vid.id] = { poster: poster.src, sources: [] }; continue; }

  let ffmpeg;
  try { ffmpeg = (await import('ffmpeg-static')).default; } catch { ffmpeg = 'ffmpeg'; }
  const dir = path.join(OUT, 'videos');
  await fs.mkdir(dir, { recursive: true });
  const variants = [
    { file: `${vid.id}.mp4`, height: 1080, crf: 26 },
    { file: `${vid.id}-720.mp4`, height: 720, crf: 28 },
  ];
  for (const v of variants) {
    const out = path.join(dir, v.file);
    if (!(await isStale(src, out))) continue;
    // H.264 for compatibility; no audio; trimmed; moov atom up front so playback starts before download completes.
    await run(ffmpeg, ['-y', '-i', src, '-t', String(vid.maxDurationSeconds), '-an',
      '-vf', `scale=-2:${v.height}:flags=lanczos,fps=30`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(v.crf),
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    built++;
  }
  // Poster from the first second of the video when there's no hero photo yet.
  let posterSrc = poster?.src;
  if (!posterSrc) {
    const frame = path.join(dir, `${vid.id}-poster.webp`);
    const png = path.join(dir, `${vid.id}-poster.png`);
    await run(ffmpeg, ['-y', '-ss', '1', '-i', src, '-frames:v', '1', png]);
    await sharp(png).resize(1920).webp({ quality: 75 }).toFile(frame);
    await fs.rm(png);
    posterSrc = publicUrl(frame);
  }
  videos[vid.id] = {
    poster: posterSrc,
    sources: [
      { src: publicUrl(path.join(dir, variants[1].file)), media: '(max-width: 1279px)', type: 'video/mp4' },
      { src: publicUrl(path.join(dir, variants[0].file)), type: 'video/mp4' },
    ],
  };
}

await fs.writeFile(path.join(OUT, 'images', 'images.json'), JSON.stringify({ images: registry, videos }, null, 2) + '\n');

console.log(`Built ${built} file(s). ${Object.keys(registry).length}/${manifest.images.length} images ready, ${skipped} waiting for a source file.`);
const uncleared = problems.filter(p => p.startsWith('rights'));
if (uncleared.length) console.log(`${uncleared.length} asset(s) not yet cleared for use. Run \`npm run images:check\` before launch.`);
