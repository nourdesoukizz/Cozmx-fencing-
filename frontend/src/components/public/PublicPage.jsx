import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import useSocket from '../../hooks/useSocket';
import PoolTable from '../dashboard/PoolTable';
import AnnouncementBanner from './AnnouncementBanner';
import EventLeaderboard from './EventLeaderboard';
import FencerSearchPanel from './FencerSearchPanel';
import PaceTimeline from './PaceTimeline';
import NarratorFeed from './NarratorFeed';

export default function PublicPage() {
  const [pools, setPools] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [narratorFeed, setNarratorFeed] = useState([]);
  const [activeTab, setActiveTab] = useState('leaderboards');
  const [loading, setLoading] = useState(true);

  const fetchPools = useCallback(async () => {
    try {
      const data = await api.getPools();
      setPools(data);
    } catch {
      // silent fail for public view
    }
  }, []);

  const fetchTournament = useCallback(async () => {
    try {
      const data = await api.getTournamentStatus();
      setTournament(data);
    } catch {
      // silent fail
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const data = await api.getAnnouncements(10);
      setAnnouncements(data.announcements || []);
    } catch {
      // silent fail
    }
  }, []);

  const fetchNarrator = useCallback(async () => {
    try {
      const data = await api.getNarratorFeed(20);
      setNarratorFeed(data.entries || []);
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPools(), fetchTournament(), fetchAnnouncements(), fetchNarrator()])
      .finally(() => setLoading(false));
  }, [fetchPools, fetchTournament, fetchAnnouncements, fetchNarrator]);

  // WebSocket handlers
  useSocket(useCallback((msg) => {
    if (msg.type === 'scores_approved') {
      fetchPools();
      fetchNarrator();
    } else if (msg.type === 'event_started' || msg.type === 'event_stopped') {
      fetchTournament();
      fetchAnnouncements();
      fetchNarrator();
    } else if (msg.type === 'announcement_suggestion') {
      fetchAnnouncements();
    } else if (msg.type === 'narrator_update' && msg.entry) {
      setNarratorFeed((prev) => [msg.entry, ...prev]);
    }
  }, [fetchPools, fetchTournament, fetchAnnouncements, fetchNarrator]));

  // Compute event progress
  const events = tournament?.events || [];

  const eventProgress = useMemo(() => {
    return events.map((ev) => {
      const eventPools = pools.filter((p) => p.event === ev.name);
      const approvedCount = eventPools.filter(
        (p) => p.submission?.status === 'approved'
      ).length;
      const totalCount = eventPools.length;
      return {
        name: ev.name,
        status: ev.status || 'not_started',
        approved: approvedCount,
        total: totalCount,
        pct: totalCount > 0 ? (approvedCount / totalCount) * 100 : 0,
      };
    });
  }, [events, pools]);

  // Group approved pools by event for Pool Results tab
  const groupedByEvent = useMemo(() => {
    const approvedPools = pools.filter((p) => p.submission?.status === 'approved');
    const groups = {};
    approvedPools.forEach((p) => {
      if (!groups[p.event]) groups[p.event] = [];
      groups[p.event].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [pools]);

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

      {/* Announcement Banner */}
      <AnnouncementBanner announcements={announcements} />

      {/* Tournament Info + Progress Bars */}
      {eventProgress.length > 0 && (
        <div className="public-progress-section">
          {eventProgress.map((ev) => (
            <div key={ev.name} className="event-progress-item">
              <div className="event-progress-header">
                <span className="event-progress-name">
                  {ev.name}
                  {' '}
                  <span className={`event-status-tag ${ev.status === 'started' ? 'started' : ev.status === 'stopped' ? 'stopped' : 'not-started'}`}>
                    {ev.status === 'started' ? 'Live' : ev.status === 'stopped' ? 'Complete' : 'Upcoming'}
                  </span>
                </span>
                <span className="event-progress-count">
                  {ev.approved} of {ev.total} pools
                </span>
              </div>
              <div className="event-progress-bar">
                <div
                  className={`event-progress-fill ${ev.pct >= 100 ? 'complete' : 'in-progress'}`}
                  style={{ width: `${ev.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fencer Search */}
      <FencerSearchPanel pools={pools} />

      {/* Tab Bar */}
      <div className="public-tab-bar">
        <button
          className={`public-tab-btn ${activeTab === 'leaderboards' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboards')}
        >
          Leaderboards
        </button>
        <button
          className={`public-tab-btn ${activeTab === 'pools' ? 'active' : ''}`}
          onClick={() => setActiveTab('pools')}
        >
          Pool Results
        </button>
        <button
          className={`public-tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          Live Feed
        </button>
      </div>

      {/* Tab Content */}
      <div className="public-tab-content">
        {activeTab === 'leaderboards' && (
          <EventLeaderboard pools={pools} events={events} />
        )}

        {activeTab === 'pools' && (
          <>
            {groupedByEvent.length === 0 ? (
              <div className="no-data-message">
                No approved pool results yet. Results will appear here once scored.
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
          </>
        )}

        {activeTab === 'feed' && (
          <div className="live-feed-layout">
            <div className="live-feed-section">
              <h3>Timeline</h3>
              <PaceTimeline announcements={announcements} pools={pools} />
            </div>
            <div className="live-feed-section">
              <h3>Commentary</h3>
              <NarratorFeed entries={narratorFeed} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
