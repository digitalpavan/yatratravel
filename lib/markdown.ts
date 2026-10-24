import 'server-only';
import { marked } from 'marked';

/**
 * Blog posts are written by admins in the dashboard, so they're trusted, but raw HTML is still stripped
 * so a pasted embed or script can't run on the public site.
 */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return html
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|iframe|object|embed)[^>]*\/?>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/href="javascript:[^"]*"/gi, 'href="#"');
}
