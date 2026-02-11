import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { formatRefereeName } from '../../utils/formatters';
import StatusBadge from '../shared/StatusBadge';
import PoolUpload from './PoolUpload';

export default function RefereePortal() {
  const navigate = useNavigate();
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingPool, setUploadingPool] = useState(null);

  useEffect(() => {
    if (sessionStorage.getItem('role_referee') !== 'true') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const fetchPools = useCallback(async () => {
    try {
      const data = await api.getPools();
      setPools(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  const getPoolStatus = (pool) => {
    if (pool.submission?.status === 'approved') return 'approved';
    if (pool.submission?.status === 'pending_review' || pool.submission?.status === 'ocr_failed') return 'pending_review';
    return 'needs_upload';
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending_review': return 'Submitted';
      case 'needs_upload': return 'Needs Upload';
      default: return status;
    }
  };

  const handleUploadComplete = () => {
    setUploadingPool(null);
    fetchPools();
  };

  if (loading) {
    return <div className="loading-container">Loading pools...</div>;
  }

  if (uploadingPool) {
    return (
      <PoolUpload
        pool={uploadingPool}
        onComplete={handleUploadComplete}
        onCancel={() => setUploadingPool(null)}
      />
    );
  }

  return (
    <div>
      <header className="app-header">
        <div className="app-header-left">
          <h1>Referee Portal</h1>
          <Link to="/" className="header-home-link">Home</Link>
        </div>
      </header>

      <div className="referee-portal-content">
        {error && <div className="error-container"><p>{error}</p></div>}

        <div className="referee-pool-grid">
          {pools.map((pool) => {
            const status = getPoolStatus(pool);
            return (
              <div key={pool.id} className={`referee-pool-card status-${status}`}>
                <div className="referee-pool-header">
                  <span className="pool-label">Pool {pool.pool_number}</span>
                  <StatusBadge status={status === 'needs_upload' ? 'pending' : status === 'pending_review' ? 'active' : 'completed'} />
                </div>
                <div className="referee-pool-meta">
                  <p>{pool.event}</p>
                  <p>Strip {pool.strip_number}</p>
                  <p>{pool.fencer_count} fencers</p>
                  <p>Ref: {formatRefereeName(pool.referee)}</p>
                </div>
                <div className="referee-pool-status">{getStatusLabel(status)}</div>
                {status === 'needs_upload' && (
                  <button
                    className="upload-btn"
                    onClick={() => setUploadingPool(pool)}
                  >
                    Upload Score Sheet
                  </button>
                )}
                {status === 'pending_review' && (
                  <div className="submitted-note">Awaiting committee review</div>
                )}
                {status === 'approved' && (
                  <div className="approved-note">Scores approved</div>
                )}
              </div>
            );
          })}
        </div>

        {pools.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
            No pools found.
          </p>
        )}
      </div>
    </div>
  );
}
