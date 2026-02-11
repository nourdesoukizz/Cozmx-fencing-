import { useState, useMemo } from 'react';
import { formatRefereeName, formatFencerName, formatEventShort } from '../../utils/formatters';
import StatusBadge from '../shared/StatusBadge';

// Static venue layout: 3 areas with predefined strip positions
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

  // Build a lookup: strip_number -> pool data
  const stripMap = useMemo(() => {
    const map = {};
    pools.forEach((pool) => {
      const key = pool.strip_number?.trim().toUpperCase();
      if (key) map[key] = pool;
    });
    return map;
  }, [pools]);

  const handleTileClick = (stripId) => {
    const pool = stripMap[stripId];
    if (pool) setSelectedPool(pool);
  };

  const closeDetail = () => setSelectedPool(null);

  return (
    <div className="venue-map">
      {VENUE_LAYOUT.map((area) => (
        <div key={area.id} className="venue-area">
          <div className="venue-area-header">
            <span className="area-label">{area.label}</span>
            <span className="area-event">{area.event}</span>
          </div>
          <div className="venue-strip-row">
            {area.strips.map((stripId) => {
              const pool = stripMap[stripId];
              const status = pool?.status || 'empty';

              return (
                <div
                  key={stripId}
                  className={`venue-strip-tile status-${status}`}
                  onClick={() => handleTileClick(stripId)}
                  title={pool ? `Pool ${pool.pool_number} — ${formatRefereeName(pool.referee)}` : 'Empty'}
                >
                  <span className="tile-strip-label">{stripId}</span>
                  {pool && (
                    <>
                      <span className="tile-pool-label">Pool {pool.pool_number}</span>
                      <span className="tile-referee">{formatRefereeName(pool.referee)}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="venue-area" style={{ background: 'transparent', border: 'none' }}>
        <div className="venue-legend">
          <div className="venue-legend-item">
            <span className="venue-legend-dot completed" />
            <span>Completed</span>
          </div>
          <div className="venue-legend-item">
            <span className="venue-legend-dot in_progress" />
            <span>In Progress</span>
          </div>
          <div className="venue-legend-item">
            <span className="venue-legend-dot pending" />
            <span>Pending</span>
          </div>
          <div className="venue-legend-item">
            <span className="venue-legend-dot empty" />
            <span>Empty</span>
          </div>
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
