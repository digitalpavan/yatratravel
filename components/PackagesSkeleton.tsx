// Placeholder grid shown while the package list reads its filters from the URL.
export function PackagesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading packages">
      <div className="skeleton" style={{ height: 56, borderRadius: 999, marginBottom: 'var(--space-5)' }} />
      <div className="grid grid--3">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="card package-card" key={i} aria-hidden="true">
            <div className="skeleton" style={{ aspectRatio: '3 / 2', borderRadius: 0 }} />
            <div className="package-card__body">
              <div className="skeleton skeleton--title" />
              <div className="skeleton skeleton--text" style={{ width: '55%' }} />
              <div className="skeleton skeleton--text" />
              <div className="package-card__foot">
                <div className="skeleton" style={{ width: 90, height: 32 }} />
                <div className="skeleton" style={{ width: 120, height: 40, borderRadius: 999 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
