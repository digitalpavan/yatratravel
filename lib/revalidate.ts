import 'server-only';
import { revalidatePath, updateTag } from 'next/cache';
import { TAGS } from '@/lib/data';

/**
 * Call from admin server actions after saving public content. The data cache is expired immediately
 * (read-your-own-writes) and every public page is re-rendered on its next request.
 */
export function refreshPublicSite(...tags: (keyof typeof TAGS)[]) {
  for (const t of tags) updateTag(TAGS[t]);
  revalidatePath('/', 'layout');
}
