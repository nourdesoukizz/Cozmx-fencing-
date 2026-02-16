import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import useSocket from '../../hooks/useSocket';
import CoachAuth from './CoachAuth';
import FencerList from './FencerList';
import FencerDetailCard from './FencerDetailCard';
import TrajectoryChart from './TrajectoryChart';
import BoutFeed from './BoutFeed';
import BoutInput from './BoutInput';
import MatchupLookup from './MatchupLookup';
import DEBracket from './DEBracket';

const TABS = ['Dashboard', 'Bouts', 'Input', 'Matchup', 'Bracket'];

export default function CoachPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem('coach_token') || '');
  const [fencers, setFencers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFencer, setSelectedFencer] = useState(null);
  const [eventFilter, setEventFilter] = useState('');
  const [clubFilter, setClubFilter] = useState('');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [boutCount, setBoutCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [autoAuthDone, setAutoAuthDone] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('role_coach') !== 'true') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Auto-authenticate if coming from landing page (role_coach set) but no token yet
  useEffect(() => {
    if (token || autoAuthDone) return;
    if (sessionStorage.getItem('role_coach') === 'true') {
      setAutoAuthDone(true);
      api.coachAuth('5678')
        .then(data => {
          localStorage.setItem('coach_token', data.token);
          setToken(data.token);
        })
        .catch(() => {});
    }
  }, [token, autoAuthDone]);

  const fetchState = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getCoachState(token);
      setFencers(data.fencers || []);
      setBoutCount(data.bout_count || 0);
    } catch (err) {
      if (err.message.includes('401')) {
        localStorage.removeItem('coach_token');
        setToken('');
        setError('Session expired. Please re-authenticate.');
      } else {
        setError('Failed to load fencer data.');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchState();
  }, [token, fetchState]);

  const handleAuth = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('coach_token');
    setToken('');
    setFencers([]);
  };

  const handleBoutAdded = () => {
    setRefreshKey(k => k + 1);
    fetchState();
  };

  // Listen for WebSocket events that affect trajectory data
  useSocket(useCallback((msg) => {
    if (msg.type === 'scores_approved' || msg.type === 'event_stopped' || msg.type === 'de_bout_completed') {
      setRefreshKey(k => k + 1);
      fetchState();
    }
  }, [fetchState]));

  // Derive unique events and clubs for filter dropdowns
  const events = useMemo(() => {
    const set = new Set(fencers.map(f => f.event).filter(Boolean));
    return [...set].sort();
  }, [fencers]);

  const clubs = useMemo(() => {
    const set = new Set(fencers.map(f => f.club).filter(Boolean));
    return [...set].sort();
  }, [fencers]);

  const filteredFencers = useMemo(() => {
    let list = fencers;
    if (eventFilter) {
      list = list.filter(f => f.event === eventFilter);
    }
    if (clubFilter) {
      list = list.filter(f => f.club === clubFilter);
    }
    return list;
  }, [fencers, eventFilter, clubFilter]);

  // Show auth page if no token (but wait for auto-auth to finish first)
  if (!token) {
    if (!autoAuthDone) {
      return <div className="loading-container">Authenticating...</div>;
    }
    return <CoachAuth onAuth={handleAuth} />;
  }

  const withBouts = fencers.filter(f => f.has_bouts).length;

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <div className="app-header-left">
          <div className="brand-name brand-name-sm">
            <h1>FenceFlow</h1>
            <span className="by-cozmx">by CozMx</span>
          </div>
          <Link to="/" className="header-home-link">Home</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="refresh-btn" onClick={fetchState} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="header-home-link" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Sub-header with stats */}
      <div className="tournament-header">
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Coach Analytics — Bradley-Terry Engine</h2>
        <div className="referee-stats">
          <div className="stat-card">
            <div className="label">Fencers</div>
            <div className="value">{fencers.length}</div>
          </div>
          <div className="stat-card">
            <div className="label">With Bout Data</div>
            <div className="value">{withBouts}</div>
          </div>
          <div className="stat-card">
            <div className="label">Bouts</div>
            <div className="value">{boutCount}</div>
          </div>
          <div className="stat-card">
            <div className="label">Events</div>
            <div className="value">{events.length}</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="coach-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`coach-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Filters (visible on Dashboard tab) */}
      {activeTab === 'Dashboard' && (
        <div className="coach-filters">
          <select
            className="filter-select"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="">All Events</option>
            {events.map(ev => (
              <option key={ev} value={ev}>{ev}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={clubFilter}
            onChange={(e) => setClubFilter(e.target.value)}
          >
            <option value="">All Clubs</option>
            {clubs.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {/* Main content */}
      <div className="tab-content">
        {error && (
          <div className="error-container">
            <p>{error}</p>
            <button onClick={fetchState}>Retry</button>
          </div>
        )}

        {activeTab === 'Dashboard' && (
          <>
            <TrajectoryChart token={token} eventFilter={eventFilter} clubFilter={clubFilter} refreshKey={refreshKey} />
            {loading && !fencers.length ? (
              <div className="loading-container">Loading fencer data...</div>
            ) : (
              <FencerList
                fencers={filteredFencers}
                onSelectFencer={setSelectedFencer}
              />
            )}
          </>
        )}

        {activeTab === 'Bouts' && (
          <BoutFeed token={token} onRefresh={refreshKey} />
        )}

        {activeTab === 'Input' && (
          <>
            <BoutInput token={token} onBoutAdded={handleBoutAdded} />
            <div style={{ marginTop: 24 }}>
              <BoutFeed token={token} onRefresh={refreshKey} />
            </div>
          </>
        )}

        {activeTab === 'Matchup' && (
          <MatchupLookup token={token} />
        )}

        {activeTab === 'Bracket' && (
          <DEBracket token={token} />
        )}
      </div>

      {/* Detail panel */}
      {selectedFencer && (
        <FencerDetailCard
          fencer={selectedFencer}
          token={token}
          onClose={() => setSelectedFencer(null)}
        />
      )}
    </div>
  );
}
