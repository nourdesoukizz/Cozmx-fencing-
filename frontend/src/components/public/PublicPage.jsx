import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import useSocket from '../../hooks/useSocket';
import PoolTable from '../dashboard/PoolTable';

export default function PublicPage() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPools = useCallback(async () => {
    try {
      const data = await api.getPools();
      setPools(data);
    } catch {
      // silent fail for public view
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // Live updates via WebSocket
  useSocket(useCallback((msg) => {
    if (msg.type === 'scores_approved') {
      fetchPools();
    }
  }, [fetchPools]));

  const approvedPools = useMemo(
    () => pools.filter((p) => p.submission?.status === 'approved'),
    [pools]
  );

  const groupedByEvent = useMemo(() => {
    const groups = {};
    approvedPools.forEach((p) => {
      if (!groups[p.event]) groups[p.event] = [];
      groups[p.event].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [approvedPools]);

  if (loading) {
    return <div className="loading-container">Loading results...</div>;
  }

  return (
    <div>
      <header className="app-header">
        <div className="app-header-left">
          <div className="brand-name brand-name-sm">
            <h1>FenceFlow — Live Results</h1>
            <span className="by-cozmx">by CozMx</span>
          </div>
          <Link to="/" className="header-home-link">Home</Link>
        </div>
      </header>

      <div className="public-content">
        {groupedByEvent.length === 0 ? (
          <div className="public-empty">
            <h2>No results yet</h2>
            <p>Pool results will appear here once approved by the bout committee.</p>
          </div>
        ) : (
          groupedByEvent.map(([event, eventPools]) => (
            <div key={event} className="pool-event-group">
              <h3>{event}</h3>
              <div className="progress-summary">
                <span>{eventPools.length} pools scored</span>
              </div>
              <div className="pool-matrix-grid">
                {eventPools
                  .sort((a, b) => a.pool_number - b.pool_number)
                  .map((pool) => (
                    <PoolTable key={pool.id} pool={pool} readOnly />
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
