import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../api/client';

function validateScoresClient(matrix, fencers) {
  const anomalies = [];
  const n = matrix.length;
  if (n === 0) return [{ level: 'error', message: 'Empty score matrix' }];

  const tsArr = [];
  const trArr = [];
  for (let i = 0; i < n; i++) {
    let ts = 0, tr = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (matrix[i][j] != null) ts += matrix[i][j];
      if (matrix[j][i] != null) tr += matrix[j][i];
    }
    tsArr.push(ts);
    trArr.push(tr);
  }

  const indSum = tsArr.reduce((a, v, i) => a + (v - trArr[i]), 0);
  if (indSum !== 0) {
    anomalies.push({ level: 'error', message: `Indicator sum is ${indSum}, should be 0` });
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const val = matrix[i][j];
      if (val != null && (val < 0 || val > 5)) {
        const name = fencers[i]?.last_name || `Fencer ${i + 1}`;
        anomalies.push({ level: 'error', message: `${name} vs opponent ${j + 1}: score ${val} out of 0-5 range` });
      }
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = matrix[i][j], b = matrix[j][i];
      if (a != null && b != null) {
        if (a !== 5 && b !== 5) {
          const fa = fencers[i]?.last_name || `Fencer ${i + 1}`;
          const fb = fencers[j]?.last_name || `Fencer ${j + 1}`;
          anomalies.push({ level: 'warning', message: `${fa} (${a}) vs ${fb} (${b}): neither scored 5` });
        }
        if (a === b) {
          const fa = fencers[i]?.last_name || `Fencer ${i + 1}`;
          const fb = fencers[j]?.last_name || `Fencer ${j + 1}`;
          anomalies.push({ level: 'error', message: `${fa} vs ${fb}: tied at ${a}-${b}` });
        }
      }
    }
  }

  return anomalies;
}

function computeResultsClient(matrix, fencers) {
  const n = matrix.length;
  const results = [];
  for (let i = 0; i < n; i++) {
    let v = 0, ts = 0, tr = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const sf = matrix[i][j], sa = matrix[j][i];
      if (sf != null) ts += sf;
      if (sa != null) tr += sa;
      if (sf != null && sa != null && sf > sa) v++;
    }
    results.push({
      last_name: fencers[i]?.last_name || `Fencer ${i + 1}`,
      first_name: fencers[i]?.first_name || '',
      V: v, TS: ts, TR: tr, indicator: ts - tr, place: 0,
    });
  }
  results.sort((a, b) => b.V - a.V || b.indicator - a.indicator || b.TS - a.TS);
  results.forEach((r, i) => { r.place = i + 1; });
  return results;
}

export default function PoolReview({ pool, onClose }) {
  const [submission, setSubmission] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);

  const fencers = pool.fencers || [];
  const n = fencers.length;

  useEffect(() => {
    (async () => {
      try {
        const sub = await api.getSubmission(pool.id);
        setSubmission(sub);
        const grid = Array.isArray(sub.scores) && sub.scores.length > 0
          ? sub.scores.map((row) => [...row])
          : Array.from({ length: pool.fencers?.length || 0 }, () =>
              Array(pool.fencers?.length || 0).fill(null)
            );
        setMatrix(grid);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [pool.id]);

  const handleCellChange = useCallback((row, col, value) => {
    setMatrix((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = value === '' ? null : Math.max(0, Math.min(5, parseInt(value, 10) || 0));
      return next;
    });
  }, []);

  const anomalies = useMemo(() => validateScoresClient(matrix, fencers), [matrix, fencers]);
  const results = useMemo(() => computeResultsClient(matrix, fencers), [matrix, fencers]);
  const hasErrors = anomalies.some((a) => a.level === 'error');

  const handleApprove = async () => {
    if (hasErrors) return;
    setApproving(true);
    setError(null);
    try {
      await api.approveScores(pool.id, matrix);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="review-overlay" onClick={onClose}>
        <div className="review-panel" onClick={(e) => e.stopPropagation()}>
          <div className="loading-container">Loading submission...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-overlay" onClick={onClose}>
      <div className="review-panel" onClick={(e) => e.stopPropagation()}>
        <button className="review-close" onClick={onClose}>&times;</button>
        <h2>Review Pool {pool.pool_number} — {pool.event}</h2>

        {submission?.status === 'ocr_failed' && (
          <div className="ocr-failed-banner">
            OCR could not read this sheet — please enter scores manually
          </div>
        )}

        <div className="review-layout">
          {/* Left: Original photo */}
          <div className="review-photo">
            {submission?.photo_path ? (
              <img src={`/api/${submission.photo_path}`} alt="Score sheet" />
            ) : (
              <div className="no-photo">No photo available</div>
            )}
          </div>

          {/* Right: Editable grid */}
          <div className="review-grid">
            <table className="matrix-table editable">
              <thead>
                <tr>
                  <th></th>
                  {fencers.map((_, i) => <th key={i}>{i + 1}</th>)}
                  <th>V</th>
                  <th>TS</th>
                  <th>TR</th>
                  <th>Ind</th>
                  <th>Pl</th>
                </tr>
              </thead>
              <tbody>
                {fencers.map((fencer, row) => {
                  const r = results.find(
                    (res) => res.last_name === fencer.last_name && res.first_name === fencer.first_name
                  ) || results[row];
                  return (
                    <tr key={row}>
                      <th className="row-header">{fencer.last_name || `Fencer ${row + 1}`}</th>
                      {fencers.map((_, col) => {
                        if (row === col) {
                          return <td key={col} className="diagonal"></td>;
                        }
                        return (
                          <td key={col} className="edit-cell">
                            <input
                              type="number"
                              min={0}
                              max={5}
                              value={matrix[row]?.[col] ?? ''}
                              onChange={(e) => handleCellChange(row, col, e.target.value)}
                            />
                          </td>
                        );
                      })}
                      {r && (
                        <>
                          <td className="result-cell">{r.V}</td>
                          <td className="result-cell">{r.TS}</td>
                          <td className="result-cell">{r.TR}</td>
                          <td className="result-cell">{r.indicator >= 0 ? `+${r.indicator}` : r.indicator}</td>
                          <td className="result-cell place">{r.place}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {submission?.confidence != null && (
              <div className="confidence-bar">
                OCR Confidence: {Math.round(submission.confidence * 100)}%
              </div>
            )}
          </div>
        </div>

        {/* Anomalies */}
        {anomalies.length > 0 && (
          <div className="review-anomalies">
            <h4>Anomalies</h4>
            {anomalies.map((a, i) => (
              <div key={i} className={`anomaly-pill ${a.level}`}>
                {a.message}
              </div>
            ))}
          </div>
        )}

        {error && <div className="upload-error">{error}</div>}

        {/* Actions */}
        <div className="review-actions">
          <button
            className="approve-btn"
            onClick={handleApprove}
            disabled={hasErrors || approving}
          >
            {approving ? 'Approving...' : 'Approve'}
          </button>
          <button className="reject-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
