import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import useSocket from '../../hooks/useSocket';
import StatusBadge from '../shared/StatusBadge';
import StripBoard from './StripBoard';
import PoolProgress from './PoolProgress';
import RefereePanel from './RefereePanel';
import AgentPanel from './AgentPanel';
import AnnouncerPanel from './AnnouncerPanel';
import DEManagement from './DEManagement';
import NarratorFeed from '../public/NarratorFeed';

const TABS = [
  { key: 'strips', label: 'Venue Map' },
  { key: 'pools', label: 'Pool Progress' },
  { key: 'referees', label: 'Referees' },
  { key: 'de', label: 'Direct Elimination' },
];

export default function DashboardPage() {
  const [tournament, setTournament] = useState(null);
  const [pools, setPools] = useState([]);
  const [referees, setReferees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('strips');
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('agent');
  const sidebarTabRef = useRef('agent');
  const [sidebarNotifications, setSidebarNotifications] = useState({ agent: false, announcer: false, commentary: false });
  const [narratorFeed, setNarratorFeed] = useState([]);
  const [streamingEntries, setStreamingEntries] = useState({});

  const { addNotification } = useNotification();

  const handleSidebarTab = (tab) => {
    setSidebarTab(tab);
    sidebarTabRef.current = tab;
    setSidebarNotifications((prev) => ({ ...prev, [tab]: false }));
  };

  const fetchNarrator = useCallback(async () => {
    try {
      const data = await api.getNarratorFeed(20);
      setNarratorFeed(data.entries || []);
    } catch {
      // silent fail
    }
  }, []);

  const fetchData = useCallback(async (showToast = false) => {
    try {
      const [tournamentData, poolsData, refereesData] = await Promise.all([
        api.getTournamentStatus(),
        api.getPools(),
        api.getReferees(),
        fetchNarrator(),
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
  }, [addNotification, fetchNarrator]);

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
      fetchNarrator();
    } else if (msg.type === 'event_started') {
      addNotification('success', 'Event Started', `${msg.event} has been started`);
      fetchData();
      fetchNarrator();
    } else if (msg.type === 'event_stopped') {
      addNotification('info', 'Event Stopped', `${msg.event} has been stopped`);
      fetchData();
      fetchNarrator();
    } else if (msg.type === 'agent_action') {
      const entry = msg.entry || {};
      if (entry.action === 'auto_approve') {
        addNotification('success', 'Agent Auto-Approved', entry.message || `Pool auto-approved`);
        fetchData();
      } else if (entry.action === 'auto_stop') {
        addNotification('info', 'Agent Completed Event', entry.message || `Event auto-stopped`);
        fetchData();
      } else if (entry.action === 'flag_for_review') {
        addNotification('warning', 'Needs Review', entry.message || entry.reason || 'Pool flagged');
      }
      // Refresh agent panel if it's mounted
      if (window._agentPanelRefresh) window._agentPanelRefresh();
      setSidebarNotifications((prev) => prev.agent ? prev : { ...prev, agent: sidebarTabRef.current !== 'agent' });
    } else if (msg.type === 'announcement_suggestion') {
      addNotification('info', 'New Announcement', 'A new announcement suggestion is ready');
      if (window._announcerPanelRefresh) window._announcerPanelRefresh();
      setSidebarNotifications((prev) => prev.announcer ? prev : { ...prev, announcer: sidebarTabRef.current !== 'announcer' });
    } else if (msg.type === 'narrator_update' && msg.entry) {
      setStreamingEntries((prev) => {
        const next = { ...prev };
        delete next[msg.entry.id];
        return next;
      });
      setNarratorFeed((prev) => [msg.entry, ...prev]);
      setSidebarNotifications((prev) => prev.commentary ? prev : { ...prev, commentary: sidebarTabRef.current !== 'commentary' });
    } else if (msg.type === 'narrator_stream_start') {
      setStreamingEntries((prev) => ({
        ...prev,
        [msg.entry_id]: { text: '', done: false },
      }));
    } else if (msg.type === 'narrator_stream_token') {
      setStreamingEntries((prev) => ({
        ...prev,
        [msg.entry_id]: {
          text: (prev[msg.entry_id]?.text || '') + msg.token,
          done: false,
        },
      }));
    } else if (msg.type === 'narrator_stream_end') {
      setStreamingEntries((prev) => ({
        ...prev,
        [msg.entry_id]: { ...prev[msg.entry_id], done: true },
      }));
    } else if (msg.type === 'de_bracket_created') {
      addNotification('success', 'DE Bracket Created', `${msg.event} bracket created`);
      fetchData();
    } else if (msg.type === 'de_bout_completed') {
      addNotification('info', 'DE Bout Completed', `${msg.winner} wins ${msg.score} in ${msg.round_name}`);
      fetchData();
    } else if (msg.type === 'de_bracket_completed') {
      addNotification('success', 'DE Complete', `${msg.event} champion: ${msg.champion}`);
      fetchData();
    }
  }, [addNotification, fetchData, fetchNarrator]));

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
      const skipped = result.skipped_count || 0;
      addNotification(
        'success',
        'Referees Pinged',
        `Sent: ${result.sent_count}, Failed: ${result.failed_count}, Not registered: ${skipped}`
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

      <div className="dashboard-body">
        <div className="dashboard-main">
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
            {activeTab === 'de' && <DEManagement pools={pools} referees={referees} addNotification={addNotification} onRefresh={() => fetchData()} />}
          </div>
        </div>

        <aside className="agent-sidebar">
          <div className="sidebar-tab-bar">
            {[
              { key: 'agent', label: 'Agent' },
              { key: 'announcer', label: 'Announcer' },
              { key: 'commentary', label: 'Commentary' },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`sidebar-tab-btn ${sidebarTab === tab.key ? 'active' : ''}`}
                onClick={() => handleSidebarTab(tab.key)}
              >
                {tab.label}
                {sidebarNotifications[tab.key] && <span className="sidebar-tab-dot" />}
              </button>
            ))}
          </div>
          <div className="sidebar-tab-content">
            {sidebarTab === 'agent' && <AgentPanel addNotification={addNotification} />}
            {sidebarTab === 'announcer' && <AnnouncerPanel addNotification={addNotification} />}
            {sidebarTab === 'commentary' && <NarratorFeed entries={narratorFeed} streamingEntries={streamingEntries} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
