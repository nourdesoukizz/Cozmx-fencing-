import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../api/client';
import { validateScoresClient, computeResultsClient, isCellProblematic } from '../../utils/scoreValidation';

export default function PoolReview({ pool, onClose }) {
  const [submission, setSubmission] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);
  const [showThinking, setShowThinking] = useState(false);

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

  const hasExtendedThinking = submission?.extended_thinking && (
    submission.corrections?.length > 0 || submission.thinking
  );
  const firstPassConf = submission?.first_pass_confidence;
  const finalConf = submission?.confidence;

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
                        const cellConf = submission?.cell_confidence?.[row]?.[col] ?? null;
                        const problematic = isCellProblematic(row, col, matrix[row]?.[col], cellConf);
                        return (
                          <td key={col} className={`edit-cell${problematic ? ' cell-low-confidence' : ''}`}>
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
                {hasExtendedThinking && firstPassConf != null && (
                  <span className="et-improved-tag">
                    improved from {Math.round(firstPassConf * 100)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Extended Thinking Section */}
        {hasExtendedThinking && (
          <div className="extended-thinking-section">
            <div className="et-header" onClick={() => setShowThinking(!showThinking)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="et-badge">Opus 4.6 Extended Thinking</span>
                {firstPassConf != null && finalConf != null && (
                  <span className="et-confidence-improvement">
                    {Math.round(firstPassConf * 100)}% → {Math.round(finalConf * 100)}%
                  </span>
                )}
              </div>
              <span className="et-toggle">{showThinking ? '−' : '+'}</span>
            </div>

            {showThinking && (
              <div className="et-body">
                {submission.corrections?.length > 0 && (
                  <div className="et-corrections">
                    <h4>Corrections Applied</h4>
                    {submission.corrections.map((c, i) => (
                      <div key={i} className="et-correction-item">
                        <strong>Cell [{c.row},{c.col}]:</strong> {c.old_value} → {c.new_value}
                        {c.reason && <span className="et-correction-reason"> — {c.reason}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {submission.thinking && (
                  <div className="et-thinking">
                    <h4>AI Reasoning Chain</h4>
                    <pre className="et-thinking-text">{submission.thinking}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
            {approving ? 'Saving...' : (submission?.status === 'approved' ? 'Save Changes' : 'Approve')}
          </button>
          <button className="reject-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
