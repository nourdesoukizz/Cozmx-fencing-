import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function BoutFeed({ token, onRefresh }) {
  const [bouts, setBouts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchBouts = () => {
    if (!token) return;
    setLoading(true);
    api.getCoachBouts(token)
      .then(data => { setBouts(data.bouts || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchBouts(); }, [token, onRefresh]);

  if (loading && !bouts.length) return <div className="loading-container">Loading bouts...</div>;
  if (!bouts.length) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>No bouts recorded yet.</div>;

  return (
    <div className="bout-feed">
      <h4 style={{ marginBottom: 12 }}>Bout History ({bouts.length} bouts)</h4>
      <div className="bout-feed-list">
        {bouts.map((b) => {
          const winnerIsA = b.score_a > b.score_b;
          return (
            <div key={b.bout_index} className="bout-feed-card">
              <div className="bout-feed-header">
                <span className="bout-feed-index">#{b.bout_index}</span>
                <span className="bout-feed-source">{b.source}</span>
              </div>
              <div className="bout-feed-matchup">
                <span className={`bout-feed-fencer ${winnerIsA ? 'winner' : ''}`}>
                  {b.fencer_a}
                </span>
                <span className="bout-feed-score">
                  <span className={winnerIsA ? 'score-win' : 'score-loss'}>{b.score_a}</span>
                  {' - '}
                  <span className={!winnerIsA ? 'score-win' : 'score-loss'}>{b.score_b}</span>
                </span>
                <span className={`bout-feed-fencer ${!winnerIsA ? 'winner' : ''}`}>
                  {b.fencer_b}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
