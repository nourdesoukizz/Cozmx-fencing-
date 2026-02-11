import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import useSocket from '../../hooks/useSocket';
import StatusBadge from '../shared/StatusBadge';
import StripBoard from './StripBoard';
import PoolProgress from './PoolProgress';
import RefereePanel from './RefereePanel';

const TABS = [
  { key: 'strips', label: 'Venue Map' },
  { key: 'pools', label: 'Pool Progress' },
  { key: 'referees', label: 'Referees' },
];

export default function DashboardPage() {
  const [tournament, setTournament] = useState(null);
  const [pools, setPools] = useState([]);
  const [referees, setReferees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('strips');
  const [refreshing, setRefreshing] = useState(false);

  const { addNotification } = useNotification();

  const fetchData = useCallback(async (showToast = false) => {
    try {
      const [tournamentData, poolsData, refereesData] = await Promise.all([
        api.getTournamentStatus(),
        api.getPools(),
        api.getReferees(),
      ]);
      setTournament(tournamentData);
      setPools(poolsData);
      setReferees(refereesData);
      setError(null);
      if (showToast) {
        addNotification('success', 'Data Refreshed', `${poolsData.length} pools, ${refereesData.length} referees loaded`);
      }
    } catch (err) {
      setError(err.message);
      addNotification('error', 'Load Failed', err.message);
    }
  }, [addNotification]);

  useEffect(() => {
    setLoading(true);
    fetchData(true).finally(() => setLoading(false));
  }, [fetchData]);

  // WebSocket: auto-refresh on score events
  useSocket(useCallback((msg) => {
    if (msg.type === 'submission_received') {
      addNotification('info', 'New Submission', `Pool ${msg.pool_id} score sheet uploaded`);
      fetchData();
    } else if (msg.type === 'scores_approved') {
      addNotification('success', 'Scores Approved', `Pool ${msg.pool_id} scores approved`);
      fetchData();
    }
  }, [addNotification, fetchData]));

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  if (loading) {
    return <div className="loading-container">Loading tournament data...</div>;
  }

  if (error && !tournament) {
    return (
      <div className="error-container">
        <p>Failed to load: {error}</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <header className="app-header">
        <div className="app-header-left">
          <h1>FenceFlow</h1>
          <Link to="/" className="header-home-link">Home</Link>
        </div>
        <button
          className={`refresh-btn ${refreshing ? 'loading' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      {/* Tournament Info */}
      {tournament && (
        <div className="tournament-header">
          <div className="tournament-title">
            <h2>{tournament.name}</h2>
            <span className="date">{tournament.date}</span>
            <StatusBadge status={tournament.status} />
          </div>

          <div className="event-cards">
            {tournament.events?.map((ev) => (
              <div key={ev.name} className="event-card">
                <h3>{ev.name}</h3>
                <p>{ev.fencer_count} fencers / {ev.pool_count} pools</p>
              </div>
            ))}
          </div>

          <div className="tournament-totals">
            <span>{tournament.totals?.fencers} fencers</span>
            <span>&middot; {tournament.totals?.pools} pools</span>
            <span>&middot; {tournament.totals?.referees} referees</span>
            <span>&middot; {tournament.totals?.events} events</span>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'strips' && <StripBoard pools={pools} />}
        {activeTab === 'pools' && <PoolProgress pools={pools} onRefresh={() => fetchData()} />}
        {activeTab === 'referees' && <RefereePanel referees={referees} />}
      </div>
    </div>
  );
}
