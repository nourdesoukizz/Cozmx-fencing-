import { useState, useMemo } from 'react';
import { api } from '../../api/client';
import StatusBadge from '../shared/StatusBadge';
import { formatEventShort } from '../../utils/formatters';

export default function RefereePanel({ referees, addNotification }) {
  const [sortKey, setSortKey] = useState('last_name');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [pingMenuId, setPingMenuId] = useState(null);
  const [customMsgId, setCustomMsgId] = useState(null);
  const [customText, setCustomText] = useState('');
  const [pinging, setPinging] = useState(false);
  const [copyingLinkId, setCopyingLinkId] = useState(null);

  // New state for filters, selection, batch ping
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [eventFilter, setEventFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [batchPingOpen, setBatchPingOpen] = useState(false);
  const [batchPinging, setBatchPinging] = useState(false);
  const [batchCustomText, setBatchCustomText] = useState('');
  const [batchCustomOpen, setBatchCustomOpen] = useState(false);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePing = async (refereeId, messageType, customMessage = '') => {
    setPinging(true);
    try {
      await api.pingReferee(refereeId, messageType, customMessage);
      if (addNotification) addNotification('success', 'Ping Sent', 'Telegram message sent successfully');
    } catch (err) {
      if (addNotification) addNotification('error', 'Ping Failed', err.message);
    } finally {
      setPinging(false);
      setPingMenuId(null);
      setCustomMsgId(null);
      setCustomText('');
    }
  };

  const handleCopyLink = async (refereeId) => {
    setCopyingLinkId(refereeId);
    try {
      const data = await api.getTelegramLink(refereeId);
      if (data.telegram_link) {
        await navigator.clipboard.writeText(data.telegram_link);
        if (addNotification) addNotification('success', 'Link Copied', 'Telegram registration link copied to clipboard');
      } else {
        if (addNotification) addNotification('error', 'No Link', 'Telegram bot username not configured on the server');
      }
    } catch (err) {
      if (addNotification) addNotification('error', 'Copy Failed', err.message);
    } finally {
      setCopyingLinkId(null);
    }
  };

  // Batch ping handler
  const handleBatchPing = async (messageType, customMessage = '') => {
    setBatchPinging(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await api.batchPingReferees(ids, messageType, customMessage);
      const parts = [];
      if (result.sent_count > 0) parts.push(`${result.sent_count} sent`);
      if (result.skipped_count > 0) parts.push(`${result.skipped_count} skipped (unregistered)`);
      if (result.failed_count > 0) parts.push(`${result.failed_count} failed`);
      const summary = parts.join(', ');
      if (result.failed_count > 0) {
        if (addNotification) addNotification('warning', 'Batch Ping Partial', summary);
      } else {
        if (addNotification) addNotification('success', 'Batch Ping Sent', summary);
      }
    } catch (err) {
      if (addNotification) addNotification('error', 'Batch Ping Failed', err.message);
    } finally {
      setBatchPinging(false);
      setBatchPingOpen(false);
      setBatchCustomOpen(false);
      setBatchCustomText('');
    }
  };

  // All unique events across referees
  const allEvents = useMemo(() => {
    const evSet = new Set();
    referees.forEach((r) => r.assignments.forEach((a) => evSet.add(a.event)));
    return Array.from(evSet).sort();
  }, [referees]);

  // Filtered referees
  const filtered = useMemo(() => {
    return referees.filter((r) => {
      if (eventFilter) {
        const hasEvent = r.assignments.some((a) => a.event === eventFilter);
        if (!hasEvent) return false;
      }
      if (nameFilter) {
        const q = nameFilter.toLowerCase();
        const matchName =
          (r.first_name || '').toLowerCase().includes(q) ||
          (r.last_name || '').toLowerCase().includes(q);
        if (!matchName) return false;
      }
      return true;
    });
  }, [referees, eventFilter, nameFilter]);

  // Sorted (of filtered)
  const sorted = useMemo(() => {
    return filtered.slice().sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  // Selection helpers
  const filteredIds = useMemo(() => new Set(sorted.map((r) => r.id)), [sorted]);
  const allVisibleSelected = sorted.length > 0 && sorted.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      // Deselect all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sorted.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      // Select all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        sorted.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBatchPingOpen(false);
    setBatchCustomOpen(false);
    setBatchCustomText('');
  };

  const totalAssignments = referees.reduce((sum, r) => sum + r.assignment_count, 0);
  const avgAssignments = referees.length > 0
    ? (totalAssignments / referees.length).toFixed(1)
    : 0;
  const registeredCount = referees.filter((r) => r.telegram_registered).length;

  return (
    <div>
      <div className="referee-stats">
        <div className="stat-card">
          <div className="label">Total Referees</div>
          <div className="value">{referees.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Assignments</div>
          <div className="value">{totalAssignments}</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg per Referee</div>
          <div className="value">{avgAssignments}</div>
        </div>
        <div className="stat-card">
          <div className="label">Telegram Registered</div>
          <div className="value">{registeredCount} / {referees.length}</div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        marginBottom: 12,
        flexWrap: 'wrap',
      }}>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-color, #d1d5db)',
            background: 'var(--bg-secondary, #fff)',
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
        >
          <option value="">All Events</option>
          {allEvents.map((ev) => (
            <option key={ev} value={ev}>{formatEventShort(ev)}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search referees..."
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-color, #d1d5db)',
            background: 'var(--bg-secondary, #fff)',
            color: 'var(--text-primary)',
            fontSize: 13,
            minWidth: 180,
          }}
        />
        {(eventFilter || nameFilter) && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Showing {sorted.length} of {referees.length} referees
          </span>
        )}
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          marginBottom: 12,
          background: 'var(--info-bg, #dbeafe)',
          borderRadius: 6,
          fontSize: 13,
          flexWrap: 'wrap',
          position: 'relative',
        }}>
          <span style={{ fontWeight: 600 }}>{selectedIds.size} referee{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button
            onClick={() => { setBatchPingOpen(!batchPingOpen); setBatchCustomOpen(false); setBatchCustomText(''); }}
            disabled={batchPinging}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: 'none',
              background: 'var(--accent, #2563eb)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {batchPinging ? 'Sending...' : 'Ping Selected'}
          </button>
          <button
            onClick={clearSelection}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid var(--border-color, #d1d5db)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Clear Selection
          </button>
          {batchPingOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 80,
              zIndex: 20,
              background: 'var(--bg-secondary, #fff)',
              border: '1px solid var(--border-color, #d1d5db)',
              borderRadius: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              marginTop: 4,
              minWidth: 200,
            }}>
              <button className="ping-menu-item" onClick={() => handleBatchPing('report_to_captain')}>
                Report to Captain
              </button>
              <button className="ping-menu-item" onClick={() => handleBatchPing('pool_sheet_reminder')}>
                Pool Sheet Reminder
              </button>
              <button className="ping-menu-item" onClick={() => setBatchCustomOpen(!batchCustomOpen)}>
                Custom Message
              </button>
              {batchCustomOpen && (
                <div className="ping-custom-input">
                  <input
                    type="text"
                    placeholder="Type message..."
                    value={batchCustomText}
                    onChange={(e) => setBatchCustomText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && batchCustomText.trim()) handleBatchPing('custom', batchCustomText); }}
                  />
                  <button
                    className="ping-custom-send"
                    onClick={() => { if (batchCustomText.trim()) handleBatchPing('custom', batchCustomText); }}
                    disabled={!batchCustomText.trim()}
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                title="Select all visible referees"
                style={{ cursor: 'pointer' }}
              />
            </th>
            <th style={{ width: 32 }}></th>
            <th className="sortable" onClick={() => handleSort('last_name')}>
              Name{sortIndicator('last_name')}
            </th>
            <th className="sortable" onClick={() => handleSort('assignment_count')}>
              Assignments{sortIndicator('assignment_count')}
            </th>
            <th>Events</th>
            <th>Telegram</th>
            <th className="sortable" onClick={() => handleSort('status')}>
              Status{sortIndicator('status')}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ref) => {
            const events = [...new Set(ref.assignments.map((a) => a.event))];
            return (
              <>
                <tr key={ref.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(ref.id)}
                      onChange={() => toggleSelect(ref.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <button
                      className="expand-btn"
                      onClick={() => toggleExpand(ref.id)}
                    >
                      {expandedIds.has(ref.id) ? '\u25BC' : '\u25B6'}
                    </button>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {ref.last_name}, {ref.first_name}
                  </td>
                  <td>{ref.assignment_count}</td>
                  <td>
                    {events.map((ev) => (
                      <span
                        key={ev}
                        style={{
                          display: 'inline-block',
                          marginRight: 6,
                          padding: '1px 6px',
                          background: 'var(--bg-primary)',
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {formatEventShort(ev)}
                      </span>
                    ))}
                  </td>
                  <td>
                    {ref.telegram_registered ? (
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        background: 'var(--success-bg, #dcfce7)',
                        color: 'var(--success-text, #166534)',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        Registered
                      </span>
                    ) : (
                      <button
                        className="copy-link-btn"
                        onClick={() => handleCopyLink(ref.id)}
                        disabled={copyingLinkId === ref.id}
                        style={{
                          padding: '2px 8px',
                          background: 'var(--warning-bg, #fef3c7)',
                          color: 'var(--warning-text, #92400e)',
                          border: '1px solid var(--warning-border, #fbbf24)',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {copyingLinkId === ref.id ? 'Copying...' : 'Copy Link'}
                      </button>
                    )}
                  </td>
                  <td><StatusBadge status={ref.status} /></td>
                  <td style={{ position: 'relative' }}>
                    <button
                      className="ping-ref-btn"
                      onClick={(e) => { e.stopPropagation(); setPingMenuId(pingMenuId === ref.id ? null : ref.id); setCustomMsgId(null); setCustomText(''); }}
                      disabled={pinging || !ref.telegram_registered}
                      title={!ref.telegram_registered ? 'Referee must register with Telegram bot first' : ''}
                    >
                      Ping
                    </button>
                    {pingMenuId === ref.id && (
                      <div className="ping-menu">
                        <button className="ping-menu-item" onClick={() => handlePing(ref.id, 'report_to_captain')}>
                          Report to Captain
                        </button>
                        <button className="ping-menu-item" onClick={() => handlePing(ref.id, 'pool_sheet_reminder')}>
                          Pool Sheet Reminder
                        </button>
                        <button className="ping-menu-item" onClick={() => setCustomMsgId(customMsgId === ref.id ? null : ref.id)}>
                          Custom Message
                        </button>
                        {customMsgId === ref.id && (
                          <div className="ping-custom-input">
                            <input
                              type="text"
                              placeholder="Type message..."
                              value={customText}
                              onChange={(e) => setCustomText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && customText.trim()) handlePing(ref.id, 'custom', customText); }}
                            />
                            <button
                              className="ping-custom-send"
                              onClick={() => { if (customText.trim()) handlePing(ref.id, 'custom', customText); }}
                              disabled={!customText.trim()}
                            >
                              Send
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {expandedIds.has(ref.id) && (
                  <tr key={`${ref.id}-exp`} className="expanded-row">
                    <td colSpan={8}>
                      <div className="assignment-list">
                        {ref.assignments.map((a, i) => (
                          <div key={i} className="assignment-item">
                            <span className="pool-label">Pool {a.pool_number}</span>
                            <span className="strip-label">Strip {a.strip_number}</span>
                            <span className="event-label">{a.event}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
