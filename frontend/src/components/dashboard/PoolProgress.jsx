import { useState, useMemo } from 'react';
import PoolTable from './PoolTable';
import PoolReview from './PoolReview';

export default function PoolProgress({ pools, onRefresh }) {
  const [search, setSearch] = useState('');
  const [reviewPool, setReviewPool] = useState(null);

  const pendingCount = useMemo(
    () => pools.filter((p) => p.submission?.status === 'pending_review' || p.submission?.status === 'ocr_failed').length,
    [pools]
  );

  const filteredPools = useMemo(() => {
    if (!search.trim()) return pools;
    const q = search.toLowerCase();
    return pools.filter((p) => {
      if (p.event.toLowerCase().includes(q)) return true;
      if (String(p.pool_number).includes(q)) return true;
      if (p.strip_number.toLowerCase().includes(q)) return true;
      const refName = `${p.referee?.last_name} ${p.referee?.first_name}`.toLowerCase();
      if (refName.includes(q)) return true;
      if (p.fencers?.some((f) => `${f.last_name} ${f.first_name}`.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [pools, search]);

  const groupedByEvent = useMemo(() => {
    const groups = {};
    filteredPools.forEach((p) => {
      if (!groups[p.event]) groups[p.event] = [];
      groups[p.event].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPools]);

  const handlePoolClick = (pool) => {
    if (pool.submission?.status === 'pending_review' || pool.submission?.status === 'ocr_failed' || pool.submission?.status === 'approved') {
      setReviewPool(pool);
    }
  };

  const handleReviewClose = () => {
    setReviewPool(null);
    if (onRefresh) onRefresh();
  };

  return (
    <div>
      <div className="pool-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Search pools, fencers, referees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {pendingCount > 0 && (
          <div className="pending-badge">
            {pendingCount} pending review
          </div>
        )}
      </div>

      {groupedByEvent.map(([event, eventPools]) => {
        const approved = eventPools.filter((p) => p.submission?.status === 'approved').length;
        const pending = eventPools.filter((p) => p.submission?.status === 'pending_review' || p.submission?.status === 'ocr_failed').length;
        const pct = eventPools.length > 0 ? Math.round((approved / eventPools.length) * 100) : 0;

        return (
          <div key={event} className="pool-event-group">
            <h3>
              {event}
              {pending > 0 && <span className="event-pending-count">{pending} pending</span>}
            </h3>
            <div className="progress-summary">
              <span>{eventPools.length} pools</span>
              <span>{approved} scored</span>
              <span>{pct}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>

            <div className="pool-matrix-grid">
              {eventPools
                .sort((a, b) => a.pool_number - b.pool_number)
                .map((pool) => (
                  <PoolTable
                    key={pool.id}
                    pool={pool}
                    onClick={pool.submission?.status === 'pending_review' || pool.submission?.status === 'ocr_failed' || pool.submission?.status === 'approved' ? () => handlePoolClick(pool) : undefined}
                  />
                ))}
            </div>
          </div>
        );
      })}

      {groupedByEvent.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
          No pools match your search.
        </p>
      )}

      {reviewPool && (
        <PoolReview pool={reviewPool} onClose={handleReviewClose} />
      )}
    </div>
  );
}
