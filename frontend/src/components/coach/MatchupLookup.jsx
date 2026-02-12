import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function MatchupLookup({ token }) {
  const [fencerA, setFencerA] = useState('');
  const [fencerB, setFencerB] = useState('');
  const [names, setNames] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    api.getCoachFencerNames(token)
      .then(data => setNames(data.names || []))
      .catch(() => {});
  }, [token]);

  const handleLookup = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!fencerA.trim() || !fencerB.trim()) {
      setError('Both fencer names are required.');
      return;
    }

    setLoading(true);
    try {
      const data = await api.getCoachPairwise(token, fencerA.trim(), fencerB.trim());
      setResult(data);
    } catch (err) {
      setError(err.message || 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="matchup-container">
      <h4 style={{ marginBottom: 12 }}>Matchup Lookup</h4>
      <form onSubmit={handleLookup} className="matchup-form">
        <div className="matchup-inputs">
          <div className="matchup-field">
            <label>Fencer A</label>
            <input
              type="text"
              list="matchup-list-a"
              value={fencerA}
              onChange={(e) => setFencerA(e.target.value)}
              placeholder="Start typing name..."
              className="search-input"
            />
            <datalist id="matchup-list-a">
              {names.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div className="matchup-vs">vs</div>
          <div className="matchup-field">
            <label>Fencer B</label>
            <input
              type="text"
              list="matchup-list-b"
              value={fencerB}
              onChange={(e) => setFencerB(e.target.value)}
              placeholder="Start typing name..."
              className="search-input"
            />
            <datalist id="matchup-list-b">
              {names.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <button type="submit" className="upload-btn" disabled={loading} style={{ alignSelf: 'flex-end' }}>
            {loading ? 'Looking up...' : 'Compare'}
          </button>
        </div>
      </form>

      {error && <div className="bout-input-error">{error}</div>}

      {result && (
        <div className="matchup-result">
          {/* Probability bar */}
          <div className="matchup-prob-section">
            <div className="matchup-prob-labels">
              <span className="matchup-prob-name">{result.fencer_a}</span>
              <span className="matchup-prob-name">{result.fencer_b}</span>
            </div>
            <div className="matchup-prob-bar">
              <div
                className="matchup-prob-fill-a"
                style={{ width: `${result.prob_a * 100}%` }}
              >
                {(result.prob_a * 100).toFixed(1)}%
              </div>
              <div
                className="matchup-prob-fill-b"
                style={{ width: `${result.prob_b * 100}%` }}
              >
                {(result.prob_b * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Strength comparison */}
          <div className="matchup-stats">
            <div className="stat-card" style={{ flex: 1 }}>
              <div className="label">Strength A</div>
              <div className="value">{result.strength_a.toFixed(2)}</div>
            </div>
            <div className="stat-card" style={{ flex: 1 }}>
              <div className="label">Strength B</div>
              <div className="value">{result.strength_b.toFixed(2)}</div>
            </div>
          </div>

          {/* Head-to-head */}
          <div className="matchup-h2h">
            <h5>Head-to-Head Record</h5>
            {(result.h2h_a_wins + result.h2h_b_wins) > 0 ? (
              <>
                <p>{result.fencer_a}: {result.h2h_a_wins}W, {result.h2h_a_touches} touches</p>
                <p>{result.fencer_b}: {result.h2h_b_wins}W, {result.h2h_b_touches} touches</p>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No head-to-head bouts recorded.</p>
            )}
          </div>

          {/* Expected scores */}
          <div className="matchup-expected">
            <h5>Expected Score</h5>
            <p>In a 5-touch bout: <strong>{result.expected_score_5}</strong></p>
            <p>In a 15-touch bout: <strong>{result.expected_score_15}</strong></p>
          </div>
        </div>
      )}
    </div>
  );
}
