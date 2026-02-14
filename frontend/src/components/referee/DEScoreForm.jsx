import { useState, useMemo } from 'react';
import { api } from '../../api/client';
import SignatureCanvas from './SignatureCanvas';

export default function DEScoreForm({ bout, eventName, onComplete, onCancel }) {
  const [topScore, setTopScore] = useState('');
  const [bottomScore, setBottomScore] = useState('');
  const [refSig, setRefSig] = useState(null);
  const [winnerSig, setWinnerSig] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const top = bout.top_fencer || {};
  const bottom = bout.bottom_fencer || {};

  const scoreValidation = useMemo(() => {
    const t = parseInt(topScore, 10);
    const b = parseInt(bottomScore, 10);
    if (topScore === '' || bottomScore === '') return { valid: false, message: '' };
    if (isNaN(t) || isNaN(b)) return { valid: false, message: 'Enter valid numbers' };
    if (t === b) return { valid: false, message: 'Scores cannot be equal' };
    if ((t === 15 && b >= 0 && b <= 14) || (b === 15 && t >= 0 && t <= 14)) {
      return { valid: true, message: 'Scores valid' };
    }
    return { valid: false, message: 'One score must be 15, other 0-14' };
  }, [topScore, bottomScore]);

  const winnerName = useMemo(() => {
    if (!scoreValidation.valid) return '';
    const t = parseInt(topScore, 10);
    const winner = t === 15 ? top : bottom;
    return `${winner.first_name} ${winner.last_name}`;
  }, [scoreValidation.valid, topScore, top, bottom]);

  const canSubmit = scoreValidation.valid && refSig && winnerSig && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.reportDEBout(eventName, {
        bout_id: bout.bout_id,
        top_score: parseInt(topScore, 10),
        bottom_score: parseInt(bottomScore, 10),
        referee_signature: refSig,
        winner_signature: winnerSig,
      });
      onComplete();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="de-score-form">
      <h2>{eventName}</h2>
      <div className="round-label">{bout.round_name || 'DE Bout'}</div>

      <div className="de-matchup">
        <div className="de-fencer-card">
          <div className="seed-number">{top.seed || '?'}</div>
          <div className="fencer-name">{top.first_name} {top.last_name}</div>
        </div>
        <div className="de-fencer-card">
          <div className="seed-number">{bottom.seed || '?'}</div>
          <div className="fencer-name">{bottom.first_name} {bottom.last_name}</div>
        </div>
      </div>

      <div className="de-score-inputs">
        <div className="score-group">
          <label>{top.last_name}</label>
          <input
            type="number"
            min="0"
            max="15"
            value={topScore}
            onChange={(e) => setTopScore(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <div className="score-dash">—</div>
        <div className="score-group">
          <label>{bottom.last_name}</label>
          <input
            type="number"
            min="0"
            max="15"
            value={bottomScore}
            onChange={(e) => setBottomScore(e.target.value)}
            inputMode="numeric"
          />
        </div>
      </div>

      <div className={`de-score-validation ${scoreValidation.valid ? 'valid' : scoreValidation.message ? 'error' : ''}`}>
        {scoreValidation.message}
      </div>

      <div className="de-signature-section">
        <SignatureCanvas
          label="Referee Signature"
          onSign={setRefSig}
          onClear={() => setRefSig(null)}
          disabled={!scoreValidation.valid}
        />
      </div>

      {scoreValidation.valid && refSig && (
        <div className="de-signature-section">
          <div className="sig-instruction">
            Hand the device to the winning fencer: {winnerName}
          </div>
          <SignatureCanvas
            label={`${winnerName} — Winner Signature`}
            onSign={setWinnerSig}
            onClear={() => setWinnerSig(null)}
          />
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--red)', textAlign: 'center', marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="de-form-actions">
        <button className="cancel-btn" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button className="submit-btn" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? 'Submitting...' : 'Submit Result'}
        </button>
      </div>
    </div>
  );
}
