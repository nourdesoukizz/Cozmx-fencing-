import { useState, useMemo } from 'react';
import { formatRefereeName, formatFencerName } from '../../utils/formatters';
import StatusBadge from '../shared/StatusBadge';

const VENUE_LAYOUT = [
  {
    id: 'F',
    label: 'F-AREA',
    event: 'Y-14 Women Foil',
    strips: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'],
  },
  {
    id: 'D',
    label: 'D-AREA',
    event: 'Shared',
    strips: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'],
  },
  {
    id: 'C',
    label: 'C-AREA',
    event: 'Cadet Men Saber',
    strips: ['C3', 'C4', 'C5', 'C6'],
  },
];

export default function VenueMap({ pools }) {
  const [selectedPool, setSelectedPool] = useState(null);

  const stripMap = useMemo(() => {
    const map = {};
    pools.forEach((pool) => {
      const key = pool.strip_number?.trim().toUpperCase();
      if (key) map[key] = pool;
    });
    return map;
  }, [pools]);

  const handleStripClick = (stripId) => {
    const pool = stripMap[stripId];
    if (pool) setSelectedPool(pool);
  };

  const closeDetail = () => setSelectedPool(null);

  const getStatusClass = (pool) => {
    if (!pool) return 'empty';
    if (pool.submission?.status === 'approved') return 'completed';
    if (pool.submission?.status === 'pending_review' || pool.submission?.status === 'ocr_failed') return 'in-progress';
    return 'pending';
  };

  return (
    <div className="venue-floor">
      <div className="venue-floor-title">Venue Floor Plan</div>

      <div className="venue-floor-grid">
        {VENUE_LAYOUT.map((area) => (
          <div key={area.id} className="floor-area">
            <div className="floor-area-label">
              <span className="floor-area-name">{area.label}</span>
              <span className="floor-area-event">{area.event}</span>
            </div>
            <div className="floor-strips">
              {area.strips.map((stripId) => {
                const pool = stripMap[stripId];
                const status = getStatusClass(pool);
                return (
                  <div
                    key={stripId}
                    className={`floor-strip strip-${status}`}
                    onClick={() => handleStripClick(stripId)}
                    title={pool ? `Pool ${pool.pool_number} — ${formatRefereeName(pool.referee)}` : 'Empty strip'}
                  >
                    {/* The fencing strip surface */}
                    <div className="strip-surface">
                      {/* En-garde lines */}
                      <div className="strip-line strip-line-left" />
                      <div className="strip-line strip-line-center" />
                      <div className="strip-line strip-line-right" />
                    </div>

                    {/* Strip info overlay */}
                    <div className="strip-info">
                      <span className="strip-id">{stripId}</span>
                      {pool && (
                        <>
                          <span className="strip-pool">Pool {pool.pool_number}</span>
                          <span className="strip-ref">{formatRefereeName(pool.referee)}</span>
                          <span className="strip-fencers">{pool.fencer_count} fencers</span>
                        </>
                      )}
                      {!pool && <span className="strip-empty-label">Empty</span>}
                    </div>

                    {/* Status indicator dot */}
                    <div className={`strip-status-dot dot-${status}`} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="floor-legend">
        <div className="floor-legend-item">
          <span className="floor-legend-dot dot-completed" />
          <span>Scores Approved</span>
        </div>
        <div className="floor-legend-item">
          <span className="floor-legend-dot dot-in-progress" />
          <span>Pending Review</span>
        </div>
        <div className="floor-legend-item">
          <span className="floor-legend-dot dot-pending" />
          <span>Awaiting Upload</span>
        </div>
        <div className="floor-legend-item">
          <span className="floor-legend-dot dot-empty" />
          <span>Empty Strip</span>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedPool && (
        <>
          <div className="strip-detail-overlay" onClick={closeDetail} />
          <div className="strip-detail-panel">
            <button className="strip-detail-close" onClick={closeDetail}>&times;</button>
            <h3>{selectedPool.strip_number}</h3>
            <div className="strip-detail-meta">
              <p>Pool {selectedPool.pool_number} &middot; <StatusBadge status={selectedPool.status} /></p>
              <p>{selectedPool.event}</p>
              <p>Referee: {formatRefereeName(selectedPool.referee)}</p>
              <p>{selectedPool.fencer_count} fencers &middot; {selectedPool.bout_count} bouts</p>
            </div>
            <div className="strip-detail-section">
              <h4>Fencers</h4>
              <div className="strip-detail-fencer-list">
                {selectedPool.fencers?.length > 0 ? (
                  selectedPool.fencers.map((f, i) => (
                    <div key={i} className="strip-detail-fencer">
                      <span className="fencer-name">{formatFencerName(f)}</span>
                      {f.rating && <span className="fencer-rating">{f.rating}</span>}
                    </div>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    No fencer details available
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
