import Link from 'next/link';
import { Icon } from '@/components/Icon';

export default function NotFound() {
  return (
    <div className="container container--narrow section">
      <div className="empty-state">
        <span className="empty-state__icon"><Icon name="route" size={28} /></span>
        <h1 className="h4">We couldn't find that page</h1>
        <p>The link may be old, or the page may have moved. Try our packages or get in touch.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link className="btn btn--primary" href="/packages">Browse packages</Link>
          <Link className="btn btn--outline" href="/contact">Contact us</Link>
        </div>
      </div>
    </div>
  );
}
