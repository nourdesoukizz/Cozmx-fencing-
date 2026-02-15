import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../../api/client';

const COLORS = [
  '#22c55e', '#3b82f6', '#ef4444', '#eab308', '#f97316',
  '#a855f7', '#ec4899', '#06b6d4', '#84cc16', '#f43f5e',
  '#8b5cf6', '#14b8a6', '#d946ef', '#fb923c', '#0ea5e9',
];

export default function TrajectoryChart({ token, eventFilter, clubFilter }) {
  const [trajectory, setTrajectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hiddenFencers, setHiddenFencers] = useState(new Set());
  const [topN, setTopN] = useState('all');
  const [legendSearch, setLegendSearch] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.getCoachTrajectory(token)
      .then(data => { setTrajectory(data.trajectory || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  // Get all fencer names that appear in trajectory
  const fencerNames = useMemo(() => {
    const names = new Set();
    for (const snap of trajectory) {
      for (const name of Object.keys(snap.win_probs || {})) {
        names.add(name);
      }
    }
    return [...names].sort();
  }, [trajectory]);

  // Transform trajectory into recharts format
  const chartData = useMemo(() => {
    return trajectory.map((snap, i) => {
      const point = { index: i + 1, label: snap.bout_label || `Bout ${snap.bout_index}` };
      for (const name of fencerNames) {
        if (!hiddenFencers.has(name)) {
          point[name] = snap.win_probs?.[name] ?? null;
        }
      }
      return point;
    });
  }, [trajectory, fencerNames, hiddenFencers]);

  // Filter fencers with actual data (win_prob > 0 in last snapshot)
  const activeFencers = useMemo(() => {
    if (!trajectory.length) return [];
    const last = trajectory[trajectory.length - 1];
    return fencerNames
      .filter(n => (last.win_probs?.[n] ?? 0) > 0.1)
      .sort((a, b) => (last.win_probs?.[b] ?? 0) - (last.win_probs?.[a] ?? 0));
  }, [trajectory, fencerNames]);

  // Apply topN + search filters on top of activeFencers
  const filteredFencers = useMemo(() => {
    let list = activeFencers;
    if (topN !== 'all') {
      list = list.slice(0, parseInt(topN, 10));
    }
    if (legendSearch.trim()) {
      const q = legendSearch.toLowerCase();
      list = list.filter(n => n.toLowerCase().includes(q));
    }
    return list;
  }, [activeFencers, topN, legendSearch]);

  const toggleFencer = (name) => {
    setHiddenFencers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (loading) return <div className="loading-container">Loading trajectory...</div>;
  if (!trajectory.length) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>No trajectory data yet. Bouts need to be recorded first.</div>;

  return (
    <div className="trajectory-chart-container">
      <h4 style={{ marginBottom: 12 }}>Win Probability Trajectory</h4>
      <div className="trajectory-filters">
        <select
          className="filter-select"
          value={topN}
          onChange={(e) => setTopN(e.target.value)}
        >
          <option value="5">Top 5</option>
          <option value="10">Top 10</option>
          <option value="all">All</option>
        </select>
        <input
          className="search-input"
          type="text"
          placeholder="Search fencer..."
          value={legendSearch}
          onChange={(e) => setLegendSearch(e.target.value)}
          style={{ width: 180 }}
        />
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <XAxis
            dataKey="index"
            stroke="var(--text-muted)"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            label={{ value: 'Bout #', position: 'insideBottom', offset: -2, fill: 'var(--text-muted)' }}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            label={{ value: 'Win %', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)' }}
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
            }}
            labelFormatter={(val, payload) => {
              if (payload && payload[0]) return payload[0]?.payload?.label || `Bout ${val}`;
              return `Bout ${val}`;
            }}
            formatter={(val, name) => [`${val.toFixed(1)}%`, name]}
          />
          {filteredFencers.filter(n => !hiddenFencers.has(n)).map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="trajectory-legend">
        {filteredFencers.map((name, i) => (
          <button
            key={name}
            className={`trajectory-legend-item ${hiddenFencers.has(name) ? 'hidden' : ''}`}
            onClick={() => toggleFencer(name)}
          >
            <span
              className="trajectory-legend-dot"
              style={{ background: hiddenFencers.has(name) ? 'var(--text-muted)' : COLORS[i % COLORS.length] }}
            />
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
