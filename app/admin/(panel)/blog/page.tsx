import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { PageTitle } from '@/components/admin/ui';
import { requireRole } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { createUserClient } from '@/lib/supabase/clients';

export const metadata: Metadata = { title: 'Blog posts' };

export default async function BlogAdmin() {
  await requireRole('admin');
  const db = await createUserClient();
  const { data } = await db.from('blog_posts').select('id, slug, title, category, published, published_at, updated_at').order('published_at', { ascending: false, nullsFirst: true });
  return (
    <>
      <PageTitle title="Blog posts" sub="Travel guides on /blog. Written in Markdown."
        actions={<Link className="btn btn--primary btn--sm" href="/admin/blog/new"><Icon name="plus" />New post</Link>} />
      <section className="card">
        <div className="table-wrap">
          <table className="table table--stack">
            <caption className="visually-hidden">Blog posts</caption>
            <thead><tr><th scope="col">Title</th><th scope="col">Category</th><th scope="col">Published</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {(data ?? []).map(p => (
                <tr key={p.id}>
                  <td><Link href={`/admin/blog/${p.id}`}><strong>{p.title}</strong></Link><br /><span className="text-muted mono">/blog/{p.slug}</span></td>
                  <td data-hide-sm>{p.category}</td>
                  <td>{p.published_at ? formatDate(p.published_at, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                  <td>{p.published ? <span className="badge badge--success">Published</span> : <span className="badge">Draft</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
