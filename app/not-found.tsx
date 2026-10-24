import Link from 'next/link';

// Fallback for URLs that match no route at all (pages inside the site use app/(site)/not-found.tsx).
export default function NotFound() {
  return (
    <main className="container container--narrow section">
      <div className="empty-state">
        <h1 className="h4">We couldn't find that page</h1>
        <p>The link may be old, or the page may have moved.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link className="btn btn--primary" href="/">Go to the homepage</Link>
          <Link className="btn btn--outline" href="/packages">Browse packages</Link>
        </div>
      </div>
    </main>
  );
}
