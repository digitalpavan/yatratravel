import registryFile from '@/public/images/images.json';
import manifest from '@/content/image-manifest.json';

export type ImageEntry = {
  src: string;
  alt: string;
  aspect: string;
  width: number;
  height: number;
  placeholder: string;
  srcset: { avif?: string; webp?: string };
};

type Registry = { images: Record<string, ImageEntry>; videos: Record<string, { poster: string; sources: { src: string; media?: string; type: string }[] }> };
const registry = registryFile as unknown as Registry;
const planned = new Map(manifest.images.map(i => [i.id, i]));

/** A built image (from `npm run images`), or null while the photo is still being sourced. */
export function getImage(id: string): ImageEntry | null {
  return registry.images[id] ?? null;
}

/** Alt text and aspect ratio come from the manifest even before the photo exists. */
export function plannedImage(id: string): { alt: string; aspect: string } {
  const p = planned.get(id);
  return { alt: p?.alt ?? '', aspect: p?.aspect ?? '3:2' };
}

export function getVideo(id: string) {
  return registry.videos[id] ?? null;
}
