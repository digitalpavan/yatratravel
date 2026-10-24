import 'server-only';
import manifest from '@/content/image-manifest.json';
import { getImage } from '@/lib/images';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ImageOption = { ref: string; label: string; thumb: string | null };

/** Choices for the image picker: Phase 3 assets (built or still pending) plus everything uploaded in the dashboard. */
export async function imageOptions(db: SupabaseClient): Promise<ImageOption[]> {
  const { data } = await db.from('media').select('id, alt, src, srcset').order('created_at', { ascending: false }).limit(200);
  const uploads = (data ?? []).map(m => ({ ref: `media:${m.id}`, label: m.alt || 'Uploaded image', thumb: (m.srcset as string).split(',')[0]?.trim().split(' ')[0] ?? m.src }));
  const assets = manifest.images.map(i => ({ ref: i.id, label: `${i.id}: ${i.alt}`, thumb: getImage(i.id)?.src ?? null }));
  return [...uploads, ...assets];
}
