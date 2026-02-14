import { useState, useRef, useMemo, useCallback } from 'react';
import { api } from '../../api/client';
import { validateScoresClient, computeResultsClient, isCellProblematic } from '../../utils/scoreValidation';

// Phases: select_file → uploading → review → submitting → done
const PHASE = { SELECT_FILE: 'select_file', UPLOADING: 'uploading', REVIEW: 'review', SUBMITTING: 'submitting', DONE: 'done' };

export default function PoolUpload({ pool, onComplete, onCancel, eventStarted = true }) {
  const [phase, setPhase] = useState(PHASE.SELECT_FILE);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [ocrFailed, setOcrFailed] = useState(false);

  // Review state
  const [matrix, setMatrix] = useState([]);
  const [cellConfidence, setCellConfidence] = useState(null);

  const inputRef = useRef(null);
  const fencers = pool.fencers || [];
  const n = fencers.length;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setPhase(PHASE.UPLOADING);
    setError(null);
    try {
      const result = await api.uploadPoolPhoto(pool.id, file);
      const sub = result?.submission;
      if (sub?.status === 'ocr_failed') {
        setOcrFailed(true);
      }
      // Initialize editable matrix from OCR result
      const scores = Array.isArray(sub?.scores) && sub.scores.length > 0
        ? sub.scores.map((row) => [...row])
        : Array.from({ length: n }, () => Array(n).fill(null));
      setMatrix(scores);
      setCellConfidence(sub?.cell_confidence || null);
      setPhase(PHASE.REVIEW);
    } catch (err) {
      setError(err.message);
      setPhase(PHASE.SELECT_FILE);
    }
  };

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

  // Count problematic cells
  const problemCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix.length; j++) {
        if (i === j) continue;
        const conf = cellConfidence?.[i]?.[j] ?? null;
        if (isCellProblematic(i, j, matrix[i]?.[j], conf)) count++;
      }
    }
    return count;
  }, [matrix, cellConfidence]);

  const handleSubmitToCommittee = async () => {
    setPhase(PHASE.SUBMITTING);
    setError(null);
    try {
      await api.refereeEditScores(pool.id, matrix);
      setPhase(PHASE.DONE);
      setTimeout(() => onComplete(), 2000);
    } catch (err) {
      setError(err.message);
      setPhase(PHASE.REVIEW);
    }
  };

  return (
    <div className="upload-page">
      <header className="app-header">
        <div className="app-header-left">
          <h1>{phase === PHASE.REVIEW ? 'Review Scores' : 'Upload Score Sheet'}</h1>
        </div>
        {phase !== PHASE.DONE && (
          <button className="back-home-btn" onClick={onCancel}>Back to Pools</button>
        )}
      </header>

      <div className="upload-content">
        <div className="upload-pool-info">
          <h3>Pool {pool.pool_number} — {pool.event}</h3>
          <p>Strip {pool.strip_number} — {pool.fencer_count} fencers</p>
        </div>

        {!eventStarted ? (
          <div className="event-not-started-notice" style={{ marginTop: 24 }}>
            Event not started yet — uploads will be enabled when the bout committee starts this event.
          </div>
        ) : phase === PHASE.DONE ? (
          <div className="upload-success">
            <div className="success-icon">&#10003;</div>
            <p>Scores submitted successfully!</p>
            <p className="success-sub">Awaiting committee review.</p>
          </div>
        ) : phase === PHASE.REVIEW || phase === PHASE.SUBMITTING ? (
          <div className="referee-review-section">
            {ocrFailed && (
              <div className="ocr-failed-banner">
                OCR could not read this sheet — please enter scores manually below
              </div>
            )}

            <div className="referee-review-header">
              <h3>Verify & Edit Scores</h3>
              {problemCount > 0 && (
                <span className="attention-badge">
                  {problemCount} cell{problemCount !== 1 ? 's' : ''} need{problemCount === 1 ? 's' : ''} attention
                </span>
              )}
            </div>

            <div className="referee-review-grid">
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
                          const conf = cellConfidence?.[row]?.[col] ?? null;
                          const problematic = isCellProblematic(row, col, matrix[row]?.[col], conf);
                          return (
                            <td key={col} className={`edit-cell${problematic ? ' cell-low-confidence' : ''}`}>
                              <input
                                type="number"
                                inputMode="numeric"
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

            <div className="referee-review-actions">
              <button
                className={`submit-btn${phase === PHASE.SUBMITTING ? ' submitting' : ''}`}
                onClick={handleSubmitToCommittee}
                disabled={phase === PHASE.SUBMITTING}
              >
                {phase === PHASE.SUBMITTING ? 'Submitting...' : 'Submit to Committee'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="upload-area" onClick={() => inputRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="Score sheet preview" className="upload-preview" />
              ) : (
                <div className="upload-placeholder">
                  <div className="camera-icon">&#128247;</div>
                  <p>Tap to take photo or select image</p>
                  <p className="upload-hint">USFA pool score sheet</p>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            {error && <div className="upload-error">{error}</div>}

            <div className="upload-actions">
              {file && phase === PHASE.SELECT_FILE && (
                <button className="upload-btn primary" onClick={handleUpload}>
                  Upload & Process
                </button>
              )}
              {phase === PHASE.UPLOADING && (
                <div className="upload-progress">
                  <div className="spinner"></div>
                  <span>Processing with OCR...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
