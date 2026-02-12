import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function BoutInput({ token, onBoutAdded }) {
  const [fencerA, setFencerA] = useState('');
  const [fencerB, setFencerB] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [names, setNames] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) return;
    api.getCoachFencerNames(token)
      .then(data => setNames(data.names || []))
      .catch(() => {});
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fencerA.trim() || !fencerB.trim()) {
      setError('Both fencer names are required.');
      return;
    }
    if (fencerA.trim().toLowerCase() === fencerB.trim().toLowerCase()) {
      setError('Fencers must be different.');
      return;
    }
    const sa = parseInt(scoreA, 10);
    const sb = parseInt(scoreB, 10);
    if (isNaN(sa) || isNaN(sb) || sa < 0 || sb < 0) {
      setError('Scores must be non-negative numbers.');
      return;
    }
    if (sa === sb) {
      setError('Scores cannot be equal (there must be a winner).');
      return;
    }

    setSubmitting(true);
    try {
      await api.addCoachBout(token, {
        fencer_a: fencerA.trim(),
        fencer_b: fencerB.trim(),
        score_a: sa,
        score_b: sb,
      });
      setSuccess(`Bout recorded: ${fencerA} ${sa}-${sb} ${fencerB}`);
      setFencerA('');
      setFencerB('');
      setScoreA('');
      setScoreB('');
      if (onBoutAdded) onBoutAdded();
    } catch (err) {
      setError(err.message || 'Failed to add bout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bout-input-container">
      <h4 style={{ marginBottom: 12 }}>Record a Bout</h4>
      <form onSubmit={handleSubmit} className="bout-input-form">
        <div className="bout-input-row">
          <div className="bout-input-field">
            <label>Fencer A</label>
            <input
              type="text"
              list="fencer-list-a"
              value={fencerA}
              onChange={(e) => setFencerA(e.target.value)}
              placeholder="Start typing name..."
              className="search-input"
            />
            <datalist id="fencer-list-a">
              {names.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div className="bout-input-score">
            <label>Score</label>
            <input
              type="number"
              min="0"
              max="15"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              className="search-input bout-score-input"
              placeholder="0"
            />
          </div>
          <div className="bout-input-vs">vs</div>
          <div className="bout-input-score">
            <label>Score</label>
            <input
              type="number"
              min="0"
              max="15"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              className="search-input bout-score-input"
              placeholder="0"
            />
          </div>
          <div className="bout-input-field">
            <label>Fencer B</label>
            <input
              type="text"
              list="fencer-list-b"
              value={fencerB}
              onChange={(e) => setFencerB(e.target.value)}
              placeholder="Start typing name..."
              className="search-input"
            />
            <datalist id="fencer-list-b">
              {names.map(n => <option key={n} value={n} />)}
            </datalist>
          </div>
        </div>
        <button type="submit" className="upload-btn" disabled={submitting} style={{ maxWidth: 200 }}>
          {submitting ? 'Recording...' : 'Record Bout'}
        </button>
      </form>
      {error && <div className="bout-input-error">{error}</div>}
      {success && <div className="bout-input-success">{success}</div>}
    </div>
  );
}
