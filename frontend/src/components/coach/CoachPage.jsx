import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import CoachAuth from './CoachAuth';
import FencerList from './FencerList';
import FencerDetailCard from './FencerDetailCard';

export default function CoachPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem('coach_token') || '');
  const [fencers, setFencers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFencer, setSelectedFencer] = useState(null);
  const [eventFilter, setEventFilter] = useState('');
  const [clubFilter, setClubFilter] = useState('');

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
        .catch(() => {
          // Auto-auth failed, user will see the manual auth form
        });
    }
  }, [token, autoAuthDone]);

  useEffect(() => {
    if (!token) return;
    fetchFencers();
  }, [token]);

  const fetchFencers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getCoachFencers(token);
      setFencers(data.fencers || []);
    } catch (err) {
      if (err.message.includes('401')) {
        // Token expired or invalid
        localStorage.removeItem('coach_token');
        setToken('');
        setError('Session expired. Please re-authenticate.');
      } else {
        setError('Failed to load fencer data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('coach_token');
    setToken('');
    setFencers([]);
  };

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

  const poolDataCount = fencers.filter(f => f.has_pool_data).length;

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
          <button className="refresh-btn" onClick={fetchFencers} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="header-home-link" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Sub-header with stats */}
      <div className="tournament-header">
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Coach Analytics</h2>
        <div className="referee-stats">
          <div className="stat-card">
            <div className="label">Fencers</div>
            <div className="value">{fencers.length}</div>
          </div>
          <div className="stat-card">
            <div className="label">With Pool Data</div>
            <div className="value">{poolDataCount}</div>
          </div>
          <div className="stat-card">
            <div className="label">Events</div>
            <div className="value">{events.length}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
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

      {/* Main content */}
      <div className="tab-content">
        {error && (
          <div className="error-container">
            <p>{error}</p>
            <button onClick={fetchFencers}>Retry</button>
          </div>
        )}

        {loading && !fencers.length ? (
          <div className="loading-container">Loading fencer data...</div>
        ) : (
          <FencerList
            fencers={filteredFencers}
            onSelectFencer={setSelectedFencer}
          />
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
