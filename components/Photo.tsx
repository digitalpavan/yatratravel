import { getImage, plannedImage, type ImageEntry } from '@/lib/images';

type Props = {
  id: string;
  /** Pre-resolved image (e.g. an upload from the dashboard). Falls back to looking up `id` in the asset registry. */
  entry?: ImageEntry | null;
  /** Art-directed alternative shown below 768px (e.g. a vertical hero). */
  mobileId?: string;
  sizes?: string;
  /** Above-the-fold images: eager + high fetch priority. Everything else lazy-loads. */
  priority?: boolean;
  /** Decorative images get empty alt text. */
  decorative?: boolean;
  alt?: string;
  className?: string;
};

/**
 * Responsive <picture> built from public/images/images.json (`npm run images`).
 * While a photo is still being sourced, it renders a branded placeholder with the same aspect ratio and alt text,
 * so layouts don't change when the real image arrives.
 */
export function Photo({ id, entry, mobileId, sizes = '100vw', priority = false, decorative = false, alt, className = '' }: Props) {
  const img = entry ?? getImage(id);
  const planned = plannedImage(id);
  const altText = decorative ? '' : (alt ?? img?.alt ?? planned.alt);
  const mobile = mobileId ? getImage(mobileId) : null;

  if (!img) {
    return (
      <div
        className={`photo photo--pending ${className}`}
        style={{ aspectRatio: planned.aspect.replace(':', ' / ') }}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : altText}
        aria-hidden={decorative || undefined}
        data-image-id={id}
      >
        {process.env.NODE_ENV !== 'production' && <span className="photo__pending-label">Photo pending: {id}</span>}
      </div>
    );
  }

  return (
    <picture className={`photo ${className}`} style={{ aspectRatio: `${img.width} / ${img.height}` }}>
      {mobile?.srcset.avif && <source media="(max-width: 767px)" type="image/avif" srcSet={mobile.srcset.avif} sizes="100vw" />}
      {mobile?.srcset.webp && <source media="(max-width: 767px)" type="image/webp" srcSet={mobile.srcset.webp} sizes="100vw" />}
      {img.srcset.avif && <source type="image/avif" srcSet={img.srcset.avif} sizes={sizes} />}
      {/* eslint-disable-next-line @next/next/no-img-element -- images are pre-optimised by scripts/build-images.mjs */}
      <img
        src={img.src}
        srcSet={img.srcset.webp}
        sizes={sizes}
        width={img.width}
        height={img.height}
        alt={altText}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        style={{ backgroundImage: `url(${img.placeholder})` }}
      />
    </picture>
  );
}
