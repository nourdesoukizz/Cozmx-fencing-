import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function FencerDetailCard({ fencer, token, onClose }) {
  const [detail, setDetail] = useState(null);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fencer) return;
    setLoading(true);
    api.getCoachFencer(token, fencer.id)
      .then(data => { setDetail(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [fencer, token]);

  const loadInsight = () => {
    if (!detail?.has_pool_data || insightLoading) return;
    setInsightLoading(true);
    api.getCoachFencerInsight(token, fencer.id)
      .then(data => { setInsight(data.insight); setInsightLoading(false); })
      .catch(() => { setInsight('Unable to load insight.'); setInsightLoading(false); });
  };

  if (!fencer) return null;
  const d = detail || fencer;

  const ciLow = d.credible_interval?.[0] ?? 0;
  const ciHigh = d.credible_interval?.[1] ?? 5;
  const ciLowPct = Math.max(0, Math.min(100, (ciLow / 5) * 100));
  const ciHighPct = Math.max(0, Math.min(100, (ciHigh / 5) * 100));
  const posteriorPct = Math.max(0, Math.min(100, ((d.posterior_mean ?? 0) / 5) * 100));

  return (
    <>
      <div className="strip-detail-overlay" onClick={onClose} />
      <div className="strip-detail-panel" style={{ width: 440 }}>
        <button className="strip-detail-close" onClick={onClose}>&times;</button>

        {loading ? (
          <div className="loading-container">Loading...</div>
        ) : (
          <>
            {/* Header */}
            <h3>{d.first_name} {d.last_name}</h3>
            <div className="strip-detail-meta">
              <p>{d.club || 'No club'} &middot; {d.event}</p>
              <p>Rating: {d.rating || 'U'}</p>
            </div>

            {/* Prior vs Posterior */}
            <div className="strip-detail-section" style={{ marginBottom: 20 }}>
              <h4>Skill Estimate</h4>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="label">Prior</div>
                  <div className="value">{d.prior_mean?.toFixed(2)}</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="label">Posterior</div>
                  <div className="value">{d.posterior_mean?.toFixed(2)}</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="label">Delta</div>
                  <div className="value">
                    <span className={`delta-badge ${
                      d.delta_label === 'Above rating' ? 'delta-above' :
                      d.delta_label === 'Below rating' ? 'delta-below' : 'delta-at'
                    }`}>
                      {d.delta_value > 0 ? '+' : ''}{d.delta_value?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="label" style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                {d.performance_label} &middot; {d.delta_label}
              </div>
            </div>

            {/* Confidence Interval Bar */}
            <div className="strip-detail-section" style={{ marginBottom: 20 }}>
              <h4>80% Confidence Interval</h4>
              <div className="confidence-bar-container">
                <div className="confidence-bar-track">
                  <div
                    className="confidence-bar-fill"
                    style={{ left: `${ciLowPct}%`, width: `${ciHighPct - ciLowPct}%` }}
                  />
                  <div
                    className="confidence-bar-marker"
                    style={{ left: `${posteriorPct}%` }}
                  />
                </div>
                <div className="confidence-bar-labels">
                  <span>0</span>
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                [{ciLow.toFixed(2)}, {ciHigh.toFixed(2)}]
              </div>
            </div>

            {/* Pool Summary */}
            {d.pool_summaries?.length > 0 && (
              <div className="strip-detail-section" style={{ marginBottom: 20 }}>
                <h4>Pool Results</h4>
                {d.pool_summaries.map((ps, i) => (
                  <div key={i} className="assignment-item" style={{ marginBottom: 8 }}>
                    <span className="pool-label">Pool {ps.pool_number}</span>
                    <span className="event-label">{ps.event}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13 }}>
                      {ps.victories}V/{ps.bouts}B &middot; TS {ps.ts} TR {ps.tr} &middot;
                      Ind {ps.indicator > 0 ? '+' : ''}{ps.indicator} &middot;
                      Place {ps.place}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Bout Breakdown */}
            {d.bout_details?.length > 0 && (
              <div className="strip-detail-section" style={{ marginBottom: 20 }}>
                <h4>Bout Breakdown</h4>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Opponent</th>
                      <th>Rating</th>
                      <th>Score</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.bout_details.map((b, i) => (
                      <tr key={i} className={`bout-row ${b.victory ? 'bout-win' : 'bout-loss'}`}>
                        <td>{b.opponent_name}</td>
                        <td>{b.opponent_rating || 'U'}</td>
                        <td>{b.my_score}-{b.opp_score}</td>
                        <td>
                          <span className={`status-badge ${b.victory ? 'completed' : 'issue'}`}>
                            {b.victory ? 'V' : 'D'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* AI Insight */}
            {d.has_pool_data && (
              <div className="strip-detail-section">
                <h4>AI Performance Insight</h4>
                {insight ? (
                  <div className="insight-box">{insight}</div>
                ) : (
                  <button
                    className="upload-btn"
                    onClick={loadInsight}
                    disabled={insightLoading}
                    style={{ maxWidth: 200 }}
                  >
                    {insightLoading ? 'Generating...' : 'Generate Insight'}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
