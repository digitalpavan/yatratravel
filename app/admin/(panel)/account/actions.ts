'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import sharp from 'sharp';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { requireRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';

const MAX_BYTES = 5 * 1024 * 1024;
const SIZE = 256;

/** Own name, phone and job title. Runs as the signed-in person, so RLS, the profile guard and the audit log all apply. */
export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole('staff');
  const parsed = z.object({
    full_name: z.string().trim().min(2, 'Enter your name').max(80),
    phone: z.string().trim().max(20).refine(p => p === '' || /^\+?[\d\s-]{7,20}$/.test(p), 'Enter a valid phone number'),
    job_title: z.string().trim().max(60, 'Keep the job title under 60 characters'),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const db = await createUserClient();
  const { error } = await db.from('profiles').update(parsed.data).eq('id', user.id);
  if (error) return { error: 'Could not save your details.' };
  revalidatePath('/admin', 'layout');
  return { ok: 'Your details are saved.', at: Date.now() };
}

/**
 * Profile photo: checked to be a real image, cropped square, metadata stripped and stored as a small WebP in the
 * person's own folder of the public "avatars" bucket. Storage policies only allow writing to your own folder.
 */
export async function uploadAvatar(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireRole('staff');
  const file = form.get('photo');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a photo to upload.' };
  if (file.size > MAX_BYTES) return { error: 'Photos must be 5 MB or smaller.' };

  let data: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input).metadata();
    if (!['jpeg', 'png', 'webp', 'avif', 'heif'].includes(meta.format ?? '')) throw new Error('format');
    data = await sharp(input).rotate().resize(SIZE, SIZE, { fit: 'cover', position: 'attention' }).webp({ quality: 82 }).toBuffer();
  } catch {
    return { error: 'That file is not a supported image (JPEG, PNG, WebP or HEIC).' };
  }

  const db = await createUserClient();
  const bucket = db.storage.from('avatars');
  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const upload = await bucket.upload(path, data, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (upload.error) return { error: 'Upload failed. Please try again.' };
  const url = bucket.getPublicUrl(path).data.publicUrl;
  const { error } = await db.from('profiles').update({ avatar_url: url }).eq('id', user.id);
  if (error) {
    await bucket.remove([path]);
    return { error: 'Upload failed. Please try again.' };
  }
  await removeOldAvatars(user.id, path);
  revalidatePath('/admin', 'layout');
  return { ok: 'Your photo is updated.', at: Date.now() };
}

export async function removeAvatar(_: ActionState): Promise<ActionState> {
  const user = await requireRole('staff');
  const db = await createUserClient();
  const { error } = await db.from('profiles').update({ avatar_url: '' }).eq('id', user.id);
  if (error) return { error: 'Could not remove your photo.' };
  await removeOldAvatars(user.id);
  revalidatePath('/admin', 'layout');
  return { ok: 'Your photo is removed.', at: Date.now() };
}

/** Old photos are deleted so each person keeps one file at most. */
async function removeOldAvatars(userId: string, keep?: string) {
  const bucket = (await createUserClient()).storage.from('avatars');
  const { data } = await bucket.list(userId);
  const old = (data ?? []).map(f => `${userId}/${f.name}`).filter(p => p !== keep);
  if (old.length) await bucket.remove(old);
}
