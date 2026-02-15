import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

const ACTION_BADGES = {
  auto_approve: { label: 'Auto-Approved', color: '#22c55e' },
  ping_referee: { label: 'Pinged Referee', color: '#3b82f6' },
  initial_ping: { label: 'Initial Ping', color: '#3b82f6' },
  auto_stop: { label: 'Event Completed', color: '#a855f7' },
  flag_for_review: { label: 'Needs Review', color: '#f97316' },
  agent_resumed: { label: 'Agent Enabled', color: '#22c55e' },
  agent_paused: { label: 'Agent Paused', color: '#6b7280' },
  config_changed: { label: 'Config Updated', color: '#6b7280' },
  tick_error: { label: 'Error', color: '#ef4444' },
  ai_reasoning: { label: 'AI Reasoning', color: '#8b5cf6' },
  generate_announcement: { label: 'Announcement', color: '#06b6d4' },
};

export default function AgentPanel({ addNotification }) {
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState({ entries: [], total: 0 });
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('log');
  const [toggling, setToggling] = useState(false);

  // Config form state
  const [configForm, setConfigForm] = useState({
    confidence_threshold: 90,
    ping_interval_minutes: 15,
    max_pings: 3,
    tick_interval_seconds: 30,
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const [expandedEntries, setExpandedEntries] = useState(new Set());

  const [logOffset, setLogOffset] = useState(0);
  const LOG_PAGE_SIZE = 50;

  const fetchAll = useCallback(async () => {
    try {
      const [statusData, logData, pendingData] = await Promise.all([
        api.getAgentStatus(),
        api.getAgentLog(LOG_PAGE_SIZE, 0),
        api.getAgentPending(),
      ]);
      setStatus(statusData);
      setLog(logData);
      setPending(pendingData);
      setLogOffset(0);
      if (statusData.config) {
        setConfigForm({
          confidence_threshold: Math.round((statusData.config.confidence_threshold || 0.9) * 100),
          ping_interval_minutes: statusData.config.ping_interval_minutes || 15,
          max_pings: statusData.config.max_pings || 3,
          tick_interval_seconds: statusData.config.tick_interval_seconds || 30,
        });
      }
    } catch (err) {
      addNotification('error', 'Agent Load Failed', err.message);
    }
  }, [addNotification]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  // Expose refresh for parent WebSocket handler
  useEffect(() => {
    window._agentPanelRefresh = fetchAll;
    return () => { delete window._agentPanelRefresh; };
  }, [fetchAll]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      if (status?.enabled) {
        await api.disableAgent();
        addNotification('info', 'Agent Paused', 'Tournament agent has been paused');
      } else {
        await api.enableAgent();
        addNotification('success', 'Agent Enabled', 'Tournament agent is now active');
      }
      await fetchAll();
    } catch (err) {
      addNotification('error', 'Toggle Failed', err.message);
    }
    setToggling(false);
  };

  const handleLoadMore = async () => {
    const newOffset = logOffset + LOG_PAGE_SIZE;
    try {
      const moreLog = await api.getAgentLog(LOG_PAGE_SIZE, newOffset);
      setLog((prev) => ({
        entries: [...prev.entries, ...moreLog.entries],
        total: moreLog.total,
      }));
      setLogOffset(newOffset);
    } catch (err) {
      addNotification('error', 'Load Failed', err.message);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.updateAgentConfig({
        confidence_threshold: configForm.confidence_threshold / 100,
        ping_interval_minutes: configForm.ping_interval_minutes,
        max_pings: configForm.max_pings,
        tick_interval_seconds: configForm.tick_interval_seconds,
      });
      addNotification('success', 'Config Saved', 'Agent configuration updated');
      await fetchAll();
    } catch (err) {
      addNotification('error', 'Config Failed', err.message);
    }
    setSavingConfig(false);
  };

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading agent status...</div>;
  }

  const isEnabled = status?.enabled;
  const isRunning = status?.running;

  return (
    <div>
      {/* Agent Status Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'var(--surface)', borderRadius: 8,
        marginBottom: 16, border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
            background: isEnabled ? '#22c55e' : '#6b7280',
          }} />
          <span style={{ fontWeight: 600 }}>
            Agent Status: {isEnabled ? 'Enabled' : 'Paused'}
          </span>
          {isRunning && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              (background task running)
            </span>
          )}
        </div>
        <button
          className={isEnabled ? 'stop-event-btn' : 'start-event-btn'}
          onClick={handleToggle}
          disabled={toggling}
          style={{ minWidth: 100 }}
        >
          {toggling ? '...' : isEnabled ? 'Pause Agent' : 'Enable Agent'}
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="tab-bar" style={{ marginBottom: 16, padding: '0 4px' }}>
        {[
          { key: 'log', label: 'Log', count: status?.log_count || 0 },
          { key: 'pending', label: 'Pending', count: pending.length },
          { key: 'config', label: 'Config', count: null },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${subTab === tab.key ? 'active' : ''}`}
            onClick={() => setSubTab(tab.key)}
            style={{ padding: '10px 14px', fontSize: 13 }}
          >
            {tab.label}
            {tab.count !== null && (
              <span style={{
                marginLeft: 6, padding: '1px 6px', borderRadius: 10,
                background: 'var(--bg-hover)', fontSize: 11, fontWeight: 700,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Activity Log */}
      {subTab === 'log' && (
        <div>
          {log.entries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
              No agent activity yet. Enable the agent and start an event to see actions here.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {log.entries.map((entry, i) => {
                const badge = ACTION_BADGES[entry.action] || { label: entry.action, color: '#6b7280' };
                const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
                const isReasoning = entry.action === 'ai_reasoning';
                const fullText = entry.reasoning || entry.message || entry.reason || JSON.stringify(entry);
                const isLong = isReasoning && fullText.length > 200;
                const isExpanded = expandedEntries.has(i);
                const displayText = isLong && !isExpanded ? fullText.slice(0, 200) + '...' : fullText;

                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px',
                      background: isReasoning ? 'var(--surface)' : 'var(--surface)',
                      borderRadius: 6,
                      border: isReasoning ? '1px solid #8b5cf640' : '1px solid var(--border)',
                      fontSize: 13,
                      cursor: isLong ? 'pointer' : 'default',
                    }}
                    onClick={isLong ? () => setExpandedEntries((prev) => {
                      const next = new Set(prev);
                      next.has(i) ? next.delete(i) : next.add(i);
                      return next;
                    }) : undefined}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ color: 'var(--text-muted)', minWidth: 70, flexShrink: 0 }}>{ts}</span>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        background: badge.color + '20', color: badge.color,
                        fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap',
                      }}>
                        {badge.label}
                      </span>
                      {!isReasoning && (
                        <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>
                          {entry.message || entry.reason || JSON.stringify(entry)}
                        </span>
                      )}
                      {isLong && (
                        <span style={{
                          marginLeft: 'auto', color: '#8b5cf6', fontSize: 11, flexShrink: 0,
                          fontWeight: 600,
                        }}>
                          {isExpanded ? 'Collapse' : 'Expand'}
                        </span>
                      )}
                    </div>
                    {isReasoning && (
                      <div style={{
                        marginLeft: 80, padding: '6px 10px', borderRadius: 4,
                        background: '#8b5cf610', color: 'var(--text)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        lineHeight: 1.5, fontSize: 12,
                        maxHeight: isExpanded ? 'none' : 'auto',
                      }}>
                        {displayText}
                      </div>
                    )}
                  </div>
                );
              })}
              {log.entries.length < log.total && (
                <button
                  onClick={handleLoadMore}
                  style={{
                    margin: '8px auto', padding: '6px 16px', background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                >
                  Load More ({log.total - log.entries.length} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pending Queue */}
      {subTab === 'pending' && (
        <div>
          {pending.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
              No pools pending review.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={thStyle}>Pool</th>
                  <th style={thStyle}>Event</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Conf.</th>
                  <th style={thStyle}>Issues</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.pool_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{p.pool_number}</td>
                    <td style={tdStyle}>{p.event}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                        background: p.status === 'ocr_failed' ? '#ef444420' : '#f9731620',
                        color: p.status === 'ocr_failed' ? '#ef4444' : '#f97316',
                      }}>
                        {p.status === 'ocr_failed' ? 'OCR Fail' : 'Review'}
                      </span>
                    </td>
                    <td style={tdStyle}>{Math.round(p.confidence * 100)}%</td>
                    <td style={tdStyle}>
                      {p.error_anomalies > 0 && (
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>{p.error_anomalies}E</span>
                      )}
                      {p.error_anomalies > 0 && p.anomaly_count > p.error_anomalies && '/'}
                      {p.anomaly_count > p.error_anomalies && (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {p.anomaly_count - p.error_anomalies}W
                        </span>
                      )}
                      {p.anomaly_count === 0 && <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Configuration */}
      {subTab === 'config' && (
        <div style={{
          padding: 20, background: 'var(--surface)',
          borderRadius: 8, border: '1px solid var(--border)',
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>OCR Confidence Threshold (%)</label>
            <input
              type="number" min={0} max={100}
              value={configForm.confidence_threshold}
              onChange={(e) => setConfigForm((p) => ({ ...p, confidence_threshold: Number(e.target.value) }))}
              style={inputStyle}
            />
            <small style={{ color: 'var(--text-muted)' }}>
              Submissions below this threshold will be flagged for manual review
            </small>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Ping Interval (minutes)</label>
            <input
              type="number" min={1}
              value={configForm.ping_interval_minutes}
              onChange={(e) => setConfigForm((p) => ({ ...p, ping_interval_minutes: Number(e.target.value) }))}
              style={inputStyle}
            />
            <small style={{ color: 'var(--text-muted)' }}>
              How often to re-ping referees who haven't submitted
            </small>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Max Pings per Referee</label>
            <input
              type="number" min={1}
              value={configForm.max_pings}
              onChange={(e) => setConfigForm((p) => ({ ...p, max_pings: Number(e.target.value) }))}
              style={inputStyle}
            />
            <small style={{ color: 'var(--text-muted)' }}>
              Stop re-pinging after this many reminders
            </small>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Tick Interval (seconds)</label>
            <input
              type="number" min={5}
              value={configForm.tick_interval_seconds}
              onChange={(e) => setConfigForm((p) => ({ ...p, tick_interval_seconds: Number(e.target.value) }))}
              style={inputStyle}
            />
            <small style={{ color: 'var(--text-muted)' }}>
              How often the agent checks for work
            </small>
          </div>
          <button
            className="start-event-btn"
            onClick={handleSaveConfig}
            disabled={savingConfig}
            style={{ width: '100%' }}
          >
            {savingConfig ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  );
}

const thStyle = {
  textAlign: 'left', padding: '8px 12px', fontSize: 12,
  fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
};

const tdStyle = {
  padding: '8px 12px', fontSize: 13,
};

const labelStyle = {
  display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4,
};

const inputStyle = {
  display: 'block', width: '100%', padding: '6px 10px', marginBottom: 4,
  border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)',
  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
};
