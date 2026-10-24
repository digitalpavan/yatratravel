import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { ImagePicker } from '@/components/admin/ImagePicker';
import { CountedInput } from '@/components/admin/ListEditors';
import { PageTitle } from '@/components/admin/ui';
import { imageOptions } from '@/lib/admin-images';
import { requireRole } from '@/lib/auth';
import { createUserClient } from '@/lib/supabase/clients';
import { uploadMedia } from '../../media/actions';
import { deletePost, savePost } from '../actions';

export const metadata: Metadata = { title: 'Edit post' };

export default async function PostEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('admin');
  const { id } = await params;
  const isNew = id === 'new';
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await createUserClient();
  const [res, images] = await Promise.all([isNew ? Promise.resolve({ data: null }) : db.from('blog_posts').select('*').eq('id', id).maybeSingle(), imageOptions(db)]);
  if (!isNew && !res.data) notFound();
  const p = res.data ?? { slug: '', title: '', description: '', body: '', image: '', image_alt: '', category: 'Travel guide', tags: [], published: false, published_at: '', seo_title: '', seo_description: '' };

  return (
    <>
      <PageTitle back={{ href: '/admin/blog', label: 'Blog posts' }} title={isNew ? 'New post' : p.title}
        actions={!isNew && p.published && <Link className="btn btn--outline btn--sm" href={`/blog/${p.slug}`} target="_blank">View on website</Link>} />
      <ActionForm action={savePost} className="stack-lg">
        <input type="hidden" name="id" value={isNew ? '' : id} />
        <section className="card card--pad form-grid form-grid--2">
          <div className="field span-all"><label className="label" htmlFor="title">Title</label><input className="input" id="title" name="title" defaultValue={p.title} required maxLength={120} /></div>
          <div className="field"><label className="label" htmlFor="slug">URL slug</label><input className="input" id="slug" name="slug" defaultValue={p.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></div>
          <div className="field"><label className="label" htmlFor="category">Category</label><input className="input" id="category" name="category" defaultValue={p.category} /></div>
          <div className="span-all"><CountedInput id="description" name="description" label="Summary (listings and search results)" max={170} defaultValue={p.description} multiline /></div>
          <div className="field span-all">
            <label className="label" htmlFor="body">Article (Markdown)</label>
            <textarea className="textarea textarea--code" id="body" name="body" defaultValue={p.body} rows={24} />
            <p className="hint">## Heading, **bold**, - bullet list, [link text](/packages). Don't state ticket prices, exact timings or anything you can't verify; link to TTD's official site instead.</p>
          </div>
          <div className="field"><label className="label" htmlFor="tags">Tags (comma separated)</label><input className="input" id="tags" name="tags" defaultValue={(p.tags as string[]).join(', ')} /></div>
          <div className="field"><label className="label" htmlFor="published_at">Publish date</label><input className="input" id="published_at" name="published_at" type="date" defaultValue={p.published_at ?? ''} /></div>
        </section>
        <section className="card card--pad stack">
          <ImagePicker name="image" label="Cover image" value={p.image} options={images} upload={uploadMedia} />
          <div className="field"><label className="label" htmlFor="image_alt">Cover image description (alt text)</label><input className="input" id="image_alt" name="image_alt" defaultValue={p.image_alt} maxLength={200} /></div>
        </section>
        <section className="card card--pad stack">
          <h2 className="h4">Search engines (SEO)</h2>
          <CountedInput id="seo_title" name="seo_title" label="SEO title (optional)" max={70} defaultValue={p.seo_title} />
          <CountedInput id="seo_description" name="seo_description" label="Meta description (optional, defaults to the summary)" max={170} defaultValue={p.seo_description} multiline />
        </section>
        <section className="card card--pad sticky-save">
          <label className="check"><input type="checkbox" name="published" defaultChecked={p.published} /> <strong>Published</strong></label>
          <SubmitButton variant="primary">Save post</SubmitButton>
        </section>
      </ActionForm>
      {!isNew && (
        <ActionForm action={deletePost} confirm="Delete this post permanently?" className="card card--pad danger-zone">
          <input type="hidden" name="id" value={id} />
          <SubmitButton size="sm" variant="danger">Delete post</SubmitButton>
        </ActionForm>
      )}
    </>
  );
}
