import { useState, useMemo } from 'react';
import StatusBadge from '../shared/StatusBadge';
import { formatEventShort } from '../../utils/formatters';

export default function RefereePanel({ referees }) {
  const [sortKey, setSortKey] = useState('last_name');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedIds, setExpandedIds] = useState(new Set());

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

  const sorted = useMemo(() => {
    return referees.slice().sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [referees, sortKey, sortDir]);

  const totalAssignments = referees.reduce((sum, r) => sum + r.assignment_count, 0);
  const avgAssignments = referees.length > 0
    ? (totalAssignments / referees.length).toFixed(1)
    : 0;

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
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <th className="sortable" onClick={() => handleSort('last_name')}>
              Name{sortIndicator('last_name')}
            </th>
            <th className="sortable" onClick={() => handleSort('assignment_count')}>
              Assignments{sortIndicator('assignment_count')}
            </th>
            <th>Events</th>
            <th className="sortable" onClick={() => handleSort('status')}>
              Status{sortIndicator('status')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ref) => {
            const events = [...new Set(ref.assignments.map((a) => a.event))];
            return (
              <>
                <tr key={ref.id}>
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
                  <td><StatusBadge status={ref.status} /></td>
                </tr>
                {expandedIds.has(ref.id) && (
                  <tr key={`${ref.id}-exp`} className="expanded-row">
                    <td colSpan={5}>
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
