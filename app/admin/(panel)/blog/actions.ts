'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/components/admin/ActionForm';
import { requireRole } from '@/lib/auth';
import { refreshPublicSite } from '@/lib/revalidate';
import { createUserClient } from '@/lib/supabase/clients';

const schema = z.object({
  id: z.union([z.literal(''), z.uuid()]),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'URL slug: lowercase letters, numbers and hyphens').max(100),
  title: z.string().trim().min(5, 'Add a title').max(120),
  description: z.string().trim().min(50, 'Add a summary of at least 50 characters (used in listings and search results)').max(170),
  body: z.string().trim().min(100, 'The article is too short').max(40_000),
  image: z.string().max(80).regex(/^(media:[0-9a-f-]{36}|[a-z0-9-]*)$/),
  image_alt: z.string().trim().max(200),
  category: z.string().trim().min(2).max(40),
  tags: z.array(z.string().max(40)).max(12),
  published: z.boolean(),
  published_at: z.union([z.literal(''), z.iso.date()]).transform(v => v || null),
  seo_title: z.string().trim().max(70),
  seo_description: z.string().trim().max(170),
}).refine(v => !v.image || v.image_alt, { path: ['image_alt'], message: 'Describe the cover image (alt text)' });

export async function savePost(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const parsed = schema.safeParse({
    ...Object.fromEntries(form),
    tags: String(form.get('tags') ?? '').split(',').map(t => t.trim()).filter(Boolean),
    published: form.get('published') === 'on',
  });
  if (!parsed.success) return { error: 'Please fix the highlighted details.', fields: Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message])) };
  const { id, ...row } = parsed.data;
  if (row.published && !row.published_at) row.published_at = new Date().toISOString().slice(0, 10);
  const db = await createUserClient();
  const saved = id ? await db.from('blog_posts').update(row).eq('id', id).select('id').single() : await db.from('blog_posts').insert(row).select('id').single();
  if (saved.error) return { error: saved.error.code === '23505' ? 'Another post already uses this URL slug.' : 'Could not save the post.' };
  refreshPublicSite('blog');
  if (!id) redirect(`/admin/blog/${saved.data.id}`);
  return { ok: row.published ? 'Saved and published.' : 'Saved as a draft.', at: Date.now() };
}

export async function deletePost(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole('admin');
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { error: 'Invalid request.' };
  const db = await createUserClient();
  const { error } = await db.from('blog_posts').delete().eq('id', id.data);
  if (error) return { error: 'Could not delete the post.' };
  refreshPublicSite('blog');
  redirect('/admin/blog');
}
