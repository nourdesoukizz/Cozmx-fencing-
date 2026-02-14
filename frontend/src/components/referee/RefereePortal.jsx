import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { formatRefereeName } from '../../utils/formatters';
import useSocket from '../../hooks/useSocket';
import StatusBadge from '../shared/StatusBadge';
import PoolUpload from './PoolUpload';
import DEScoreForm from './DEScoreForm';

export default function RefereePortal() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [pools, setPools] = useState([]);
  const [referee, setReferee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadingPool, setUploadingPool] = useState(null);
  const [deBouts, setDeBouts] = useState([]);
  const [activeDEBout, setActiveDEBout] = useState(null);

  const isTokenMode = Boolean(token);

  useEffect(() => {
    if (!isTokenMode && sessionStorage.getItem('role_referee') !== 'true') {
      navigate('/', { replace: true });
    }
  }, [navigate, isTokenMode]);

  const fetchPools = useCallback(async () => {
    try {
      if (isTokenMode) {
        const data = await api.getRefereeByToken(token);
        setReferee(data.referee);
        setPools(data.pools);
        // Fetch DE bouts for this referee
        if (data.referee?.id) {
          try {
            const deData = await api.getRefereeDEBouts(data.referee.id);
            setDeBouts(deData.bouts || []);
          } catch {
            // DE bouts may not exist yet
          }
        }
      } else {
        const data = await api.getPools();
        setPools(data);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isTokenMode, token]);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  // WebSocket: listen for event_started to update UI live
  useSocket(useCallback((msg) => {
    if (msg.type === 'event_started' || msg.type === 'submission_received' || msg.type === 'scores_approved') {
      fetchPools();
    } else if (msg.type === 'de_referee_assigned' || msg.type === 'de_bout_completed') {
      fetchPools();
    }
  }, [fetchPools]));

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

  const isEventStarted = (pool) => {
    // In token mode, the backend attaches event_status to each pool
    if (isTokenMode) {
      return pool.event_status === 'started';
    }
    // In shared-code mode, assume started (backward compat)
    return true;
  };

  if (loading) {
    return <div className="loading-container">Loading pools...</div>;
  }

  if (activeDEBout) {
    return (
      <DEScoreForm
        bout={activeDEBout}
        eventName={activeDEBout.event}
        onComplete={() => { setActiveDEBout(null); fetchPools(); }}
        onCancel={() => setActiveDEBout(null)}
      />
    );
  }

  if (uploadingPool) {
    return (
      <PoolUpload
        pool={uploadingPool}
        onComplete={handleUploadComplete}
        onCancel={() => setUploadingPool(null)}
        eventStarted={isEventStarted(uploadingPool)}
      />
    );
  }

  const headerTitle = isTokenMode && referee
    ? `Referee Portal — ${referee.first_name} ${referee.last_name}`
    : 'Referee Portal';

  return (
    <div>
      <header className="app-header">
        <div className="app-header-left">
          <h1>{isTokenMode ? 'Referee Portal' : 'Referee Portal'}</h1>
          {!isTokenMode && <Link to="/" className="header-home-link">Home</Link>}
        </div>
      </header>

      {isTokenMode && referee && (
        <div className="referee-personal-header">
          <h2>{referee.first_name} {referee.last_name}</h2>
          <p>Your assigned pools are shown below</p>
        </div>
      )}

      <div className="referee-portal-content">
        {error && <div className="error-container"><p>{error}</p></div>}

        <div className="referee-pool-grid">
          {pools.map((pool) => {
            const status = getPoolStatus(pool);
            const eventStarted = isEventStarted(pool);
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
                {!eventStarted && (
                  <div className="event-not-started-notice">
                    Event not started yet — uploads will be enabled when the bout committee starts this event.
                  </div>
                )}
                <div className="referee-pool-status">{getStatusLabel(status)}</div>
                {status === 'needs_upload' && eventStarted && (
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

        {/* DE Bouts Section */}
        {deBouts.length > 0 && (
          <div>
            <div className="de-section-title">Your DE Bouts</div>
            {deBouts.map((bout) => (
              <div key={bout.bout_id} className="de-bout-card">
                <div className="bout-header">
                  <span className="bout-event">{bout.event}</span>
                  <span className="bout-round">{bout.round_name}</span>
                </div>
                <div className="de-bout-matchup">
                  <span className="seed-tag">#{bout.top_fencer?.seed} </span>
                  {bout.top_fencer?.first_name} {bout.top_fencer?.last_name}
                  {' vs '}
                  <span className="seed-tag">#{bout.bottom_fencer?.seed} </span>
                  {bout.bottom_fencer?.first_name} {bout.bottom_fencer?.last_name}
                </div>
                {bout.strip_number && (
                  <div className="bout-strip">Strip {bout.strip_number}</div>
                )}
                {bout.status === 'pending' && bout.top_fencer && bout.bottom_fencer ? (
                  <button className="report-btn" onClick={() => setActiveDEBout(bout)}>
                    Report Result
                  </button>
                ) : bout.status === 'completed' ? (
                  <div className="bout-completed-tag">
                    Completed {bout.top_score}-{bout.bottom_score}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
                    Waiting for fencers
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {pools.length === 0 && deBouts.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
            No pools found.
          </p>
        )}
      </div>
    </div>
  );
}
