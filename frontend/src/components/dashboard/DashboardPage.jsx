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

  // WebSocket: auto-refresh on score events and event status changes
  useSocket(useCallback((msg) => {
    if (msg.type === 'submission_received') {
      addNotification('info', 'New Submission', `Pool ${msg.pool_id} score sheet uploaded`);
      fetchData();
    } else if (msg.type === 'scores_approved') {
      addNotification('success', 'Scores Approved', `Pool ${msg.pool_id} scores approved`);
      fetchData();
    } else if (msg.type === 'event_started') {
      addNotification('success', 'Event Started', `${msg.event} has been started`);
      fetchData();
    } else if (msg.type === 'event_stopped') {
      addNotification('info', 'Event Stopped', `${msg.event} has been stopped`);
      fetchData();
    }
  }, [addNotification, fetchData]));

  const handleStartEvent = async (eventName) => {
    try {
      await api.startEvent(eventName);
      addNotification('success', 'Event Started', `${eventName} is now active`);
      fetchData();
    } catch (err) {
      addNotification('error', 'Start Failed', err.message);
    }
  };

  const handleStopEvent = async (eventName) => {
    try {
      await api.stopEvent(eventName);
      addNotification('info', 'Event Stopped', `${eventName} has been stopped`);
      fetchData();
    } catch (err) {
      addNotification('error', 'Stop Failed', err.message);
    }
  };

  const handlePingReferees = async (eventName) => {
    try {
      const result = await api.pingReferees(eventName);
      const skipped = (result.details || []).filter(d => d.status === 'skipped_no_phone').length;
      addNotification(
        'success',
        'Referees Pinged',
        `Sent: ${result.sent_count}, Failed: ${result.failed_count}, No phone: ${skipped}`
      );
    } catch (err) {
      addNotification('error', 'Ping Failed', err.message);
    }
  };

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
          <div className="brand-name brand-name-sm">
            <h1>FenceFlow</h1>
            <span className="by-cozmx">by CozMx</span>
          </div>
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
                <div className="event-card-top">
                  <h3>{ev.name}</h3>
                  <span className={`event-status-tag ${ev.status === 'started' ? 'started' : ev.status === 'stopped' ? 'stopped' : 'not-started'}`}>
                    {ev.status === 'started' ? 'Started' : ev.status === 'stopped' ? 'Stopped' : 'Not Started'}
                  </span>
                </div>
                <p>{ev.fencer_count} fencers / {ev.pool_count} pools</p>
                <div className="event-card-actions">
                  {ev.status === 'not_started' && (
                    <button
                      className="start-event-btn"
                      onClick={() => handleStartEvent(ev.name)}
                    >
                      Start Event
                    </button>
                  )}
                  {ev.status === 'started' && (
                    <>
                      <button
                        className="stop-event-btn"
                        onClick={() => handleStopEvent(ev.name)}
                      >
                        Stop Event
                      </button>
                      <button
                        className="ping-referees-btn"
                        onClick={() => handlePingReferees(ev.name)}
                      >
                        Ping Referees
                      </button>
                    </>
                  )}
                  {ev.status === 'stopped' && (
                    <button
                      className="start-event-btn"
                      onClick={() => handleStartEvent(ev.name)}
                    >
                      Restart Event
                    </button>
                  )}
                </div>
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
        {activeTab === 'referees' && <RefereePanel referees={referees} addNotification={addNotification} />}
      </div>
    </div>
  );
}
