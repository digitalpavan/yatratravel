import Link from 'next/link';

// The business's logo badge (TTD yatra Tours & Travel), cut to its gold ring with a transparent surround so it sits
// on the dark header, the transparent header over photos and the footer alike. The original is in
// assets/source/branding/; favicon-64.png, apple-touch-icon.png and yatra-logo.png (search engines) are made from it.
export function LogoMark({ size = 60 }: { size?: number }) {
  return (
    <img className="logo__mark" src="/images/branding/logo-badge-128.webp" srcSet="/images/branding/logo-badge-128.webp 128w, /images/branding/logo-badge-256.webp 256w"
      sizes={`${size}px`} width={size} height={size} alt="" decoding="async" />
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link className="logo" href="/" aria-label="Yatra Travels, home" onClick={onClick}>
      <LogoMark />
      <span className="logo__text">
        Yatra <span className="logo__accent">Travels</span><small>Tirupati pilgrim tours</small>
      </span>
    </Link>
  );
}
