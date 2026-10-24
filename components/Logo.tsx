import Link from 'next/link';

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" className="logo__mark">
      <rect width="36" height="36" rx="10" fill="#C9A45C" />
      <path
        d="M18 7.5 13.5 13h9zM11.5 13h13l1 3.5h-15zM12.5 16.5v11M23.5 16.5v11M16 27.5v-5.5h4v5.5M9.5 27.5h17"
        fill="none"
        stroke="#101C2C"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link className="logo" href="/" aria-label="Yatra Travels, home" onClick={onClick}>
      <LogoMark />
      <span className="logo__text">
        Yatra Travels<small>Tirupati pilgrim tours</small>
      </span>
    </Link>
  );
}
