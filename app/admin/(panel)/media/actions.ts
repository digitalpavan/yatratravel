'use server';

import crypto from 'node:crypto';
import sharp from 'sharp';
import { requireRole } from '@/lib/auth';
import { refreshPublicSite } from '@/lib/revalidate';
import { createUserClient } from '@/lib/supabase/clients';

const MAX_BYTES = 10 * 1024 * 1024;
const WIDTHS = [480, 800, 1200, 1600];

export type UploadResult = { ok: true; ref: string; src: string; alt: string } | { ok: false; error: string };

/**
 * Admin image upload: validates the file, strips metadata, converts to responsive WebP sizes and stores them in the
 * public "media" bucket. Storage policies also require the admin role, so this can't be bypassed from the browser.
 */
export async function uploadMedia(form: FormData): Promise<UploadResult> {
  const user = await requireRole('admin');
  const file = form.get('file');
  const alt = String(form.get('alt') ?? '').trim().slice(0, 200);
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose an image file.' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'Images must be 10 MB or smaller.' };
  if (!alt) return { ok: false, error: 'Describe the image (alt text) for visitors using screen readers.' };

  let input: Buffer;
  let meta: sharp.Metadata;
  try {
    input = Buffer.from(await file.arrayBuffer());
    meta = await sharp(input).metadata(); // rejects anything that isn't a real image, whatever its extension
    if (!['jpeg', 'png', 'webp', 'avif', 'heif', 'tiff'].includes(meta.format ?? '')) throw new Error('format');
  } catch {
    return { ok: false, error: 'That file is not a supported image (JPEG, PNG, WebP or AVIF).' };
  }
  const srcWidth = (meta.orientation ?? 1) >= 5 ? meta.height! : meta.width!;
  if (srcWidth < 800) return { ok: false, error: `This image is only ${srcWidth}px wide. Please upload one at least 1200px wide.` };

  const id = crypto.randomUUID();
  const db = await createUserClient();
  const widths = WIDTHS.filter(w => w <= srcWidth);
  const paths: string[] = [];
  const srcset: string[] = [];
  let height = 0;
  try {
    for (const w of widths) {
      const { data, info } = await sharp(input).rotate().resize({ width: w }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
      const path = `uploads/${id}-${w}.webp`;
      const { error } = await db.storage.from('media').upload(path, data, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
      if (error) throw new Error(error.message);
      paths.push(path);
      srcset.push(`${db.storage.from('media').getPublicUrl(path).data.publicUrl} ${w}w`);
      height = info.height;
    }
    const placeholder = `data:image/webp;base64,${(await sharp(input).rotate().resize(16).blur(1).webp({ quality: 40 }).toBuffer()).toString('base64')}`;
    const largest = widths.at(-1)!;
    const src = db.storage.from('media').getPublicUrl(paths.at(-1)!).data.publicUrl;
    const { error } = await db.from('media').insert({ id, alt, width: largest, height, src, srcset: srcset.join(', '), placeholder, storage_paths: paths, created_by: user.id });
    if (error) throw new Error(error.message);
    refreshPublicSite('media');
    return { ok: true, ref: `media:${id}`, src, alt };
  } catch (e) {
    if (paths.length) await db.storage.from('media').remove(paths);
    console.error('[media] upload failed', e);
    return { ok: false, error: 'Upload failed. Please try again.' };
  }
}
