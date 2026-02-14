import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../api/client';

export default function FencerDetailCard({ fencer, token, onClose }) {
  const [detail, setDetail] = useState(null);
  const [trajectory, setTrajectory] = useState([]);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!fencer) return;
    setLoading(true);
    setInsight(null);
    setChatOpen(false);
    setChatMessages([]);

    const fencerId = fencer.id;
    const fencerName = fencer.name || `${fencer.first_name} ${fencer.last_name}`.trim();

    // Fetch detail and trajectory in parallel
    Promise.all([
      fencerId ? api.getCoachFencer(token, fencerId) : Promise.resolve(null),
      api.getCoachTrajectory(token, fencerName),
    ])
      .then(([detailData, trajData]) => {
        if (detailData) setDetail(detailData);
        setTrajectory(trajData?.trajectory || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [fencer, token]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const loadInsight = () => {
    const fencerId = detail?.id || fencer?.id;
    if (!fencerId || insightLoading) return;
    setInsightLoading(true);
    api.getCoachFencerInsight(token, fencerId)
      .then(data => { setInsight(data.insight); setInsightLoading(false); })
      .catch(() => { setInsight('Unable to load insight.'); setInsightLoading(false); });
  };

  const openChat = () => {
    setChatOpen(true);
    const fencerId = detail?.id || fencer?.id;
    if (fencerId) {
      api.getCoachChatHistory(token, fencerId)
        .then(data => setChatMessages(data.history || []))
        .catch(() => {});
    }
  };

  const sendChat = async () => {
    const fencerId = detail?.id || fencer?.id;
    if (!fencerId || !chatInput.trim() || chatSending) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatSending(true);

    // Optimistically add user message
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);

    try {
      const data = await api.sendCoachChat(token, fencerId, msg);
      setChatMessages(data.history || []);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get response.' }]);
    }
    setChatSending(false);
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  if (!fencer) return null;
  const d = detail || fencer;
  const name = d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim();

  // Mini trajectory chart data
  const chartData = trajectory.map((t, i) => ({
    index: i + 1,
    strength: t.strength,
    win_prob: t.win_prob,
    label: t.bout_label,
  }));

  return (
    <>
      <div className="strip-detail-overlay" onClick={onClose} />
      <div className="strip-detail-panel" style={{ width: 460 }}>
        <button className="strip-detail-close" onClick={onClose}>&times;</button>

        {loading ? (
          <div className="loading-container">Loading...</div>
        ) : (
          <>
            {/* Header */}
            <h3>{name}</h3>
            <div className="strip-detail-meta">
              <p>{d.club || 'No club'} &middot; {d.event}</p>
              <p>Rating: {d.rating || 'U'}</p>
            </div>

            {/* Strength / Rank / Win% cards */}
            <div className="strip-detail-section" style={{ marginBottom: 20 }}>
              <h4>Bradley-Terry Estimate</h4>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="label">Strength</div>
                  <div className="value">{d.strength?.toFixed(2) ?? '\u2014'}</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="label">Rank</div>
                  <div className="value">#{d.rank ?? '\u2014'}</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="label">Win%</div>
                  <div className="value">
                    <span className={`delta-badge ${
                      (d.win_prob ?? 0) > 10 ? 'delta-above' :
                      (d.win_prob ?? 0) > 3 ? 'delta-at' : 'delta-below'
                    }`}>
                      {d.win_prob?.toFixed(1) ?? '0'}%
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="label">Record</div>
                  <div className="value">{d.wins ?? 0}W-{d.losses ?? 0}L</div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="label">Touch Diff</div>
                  <div className="value" style={{
                    color: (d.td ?? 0) > 0 ? 'var(--green)' : (d.td ?? 0) < 0 ? 'var(--red)' : 'inherit'
                  }}>
                    {(d.td ?? 0) > 0 ? '+' : ''}{d.td ?? 0}
                  </div>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <div className="label">Prior</div>
                  <div className="value">{d.prior_strength?.toFixed(2) ?? d.strength?.toFixed(2) ?? '\u2014'}</div>
                </div>
              </div>
            </div>

            {/* Mini Trajectory Chart */}
            {chartData.length > 0 && (
              <div className="strip-detail-section" style={{ marginBottom: 20 }}>
                <h4>Strength Trajectory</h4>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <XAxis dataKey="index" stroke="var(--text-muted)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                      }}
                      labelFormatter={(val, payload) => payload?.[0]?.payload?.label || `Bout ${val}`}
                      formatter={(val) => [val.toFixed(2), 'Strength']}
                    />
                    <Line type="monotone" dataKey="strength" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Pool Summary */}
            {d.pool_summaries?.length > 0 && (
              <div className="strip-detail-section" style={{ marginBottom: 20 }}>
                <h4>Pool Results</h4>
                {d.pool_summaries.map((ps, i) => (
                  <div key={i} className="assignment-item" style={{ marginBottom: 8 }}>
                    <span className="pool-label">{ps.source}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13 }}>
                      {ps.victories}V/{ps.bouts}B &middot; TS {ps.ts} TR {ps.tr} &middot;
                      Ind {ps.indicator > 0 ? '+' : ''}{ps.indicator}
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
                        <td>
                          {b.opponent_name}
                          {b.is_upset && <span className="upset-badge">UPSET</span>}
                        </td>
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
            {d.has_bouts && (
              <div className="strip-detail-section" style={{ marginBottom: 20 }}>
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

            {/* Interactive Coach Chat */}
            {d.has_bouts && (
              <div className="strip-detail-section">
                <h4>Coach Chat (Opus 4.6)</h4>
                {!chatOpen ? (
                  <button
                    className="upload-btn"
                    onClick={openChat}
                    style={{ maxWidth: 260 }}
                  >
                    Ask AI about this fencer
                  </button>
                ) : (
                  <div style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}>
                    {/* Chat messages */}
                    <div style={{
                      maxHeight: 240,
                      overflowY: 'auto',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      background: 'var(--bg)',
                    }}>
                      {chatMessages.length === 0 && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 16 }}>
                          Ask questions like "What should they focus on for DE?" or "How do they compare to their likely opponent?"
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            padding: '8px 12px',
                            borderRadius: 12,
                            fontSize: 13,
                            lineHeight: 1.4,
                            background: msg.role === 'user'
                              ? '#3b82f6'
                              : 'var(--surface)',
                            color: msg.role === 'user'
                              ? '#fff'
                              : 'var(--text)',
                            border: msg.role === 'user'
                              ? 'none'
                              : '1px solid var(--border)',
                          }}
                        >
                          {msg.content}
                        </div>
                      ))}
                      {chatSending && (
                        <div style={{
                          alignSelf: 'flex-start',
                          padding: '8px 12px',
                          borderRadius: 12,
                          fontSize: 13,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                        }}>
                          Thinking...
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat input */}
                    <div style={{
                      display: 'flex',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--surface)',
                    }}>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleChatKeyDown}
                        placeholder="Ask about this fencer..."
                        disabled={chatSending}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: 'var(--text)',
                          fontSize: 13,
                        }}
                      />
                      <button
                        onClick={sendChat}
                        disabled={chatSending || !chatInput.trim()}
                        style={{
                          padding: '10px 16px',
                          background: 'none',
                          border: 'none',
                          color: chatInput.trim() ? '#3b82f6' : 'var(--text-muted)',
                          fontWeight: 600,
                          cursor: chatInput.trim() ? 'pointer' : 'default',
                          fontSize: 13,
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
