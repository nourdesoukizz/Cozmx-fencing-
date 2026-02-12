import { useState } from 'react';
import { api } from '../../api/client';

export default function DEBracket({ token }) {
  const [seedings, setSeedings] = useState('');
  const [bracketSet, setBracketSet] = useState(false);
  const [simResults, setSimResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState('');

  const handleSetBracket = async (e) => {
    e.preventDefault();
    setError('');

    const names = seedings.split('\n').map(s => s.trim()).filter(Boolean);
    if (names.length < 2) {
      setError('Enter at least 2 fencer names (one per line, in seed order).');
      return;
    }

    setLoading(true);
    try {
      await api.setCoachBracket(token, names);
      setBracketSet(true);
    } catch (err) {
      setError(err.message || 'Failed to set bracket.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setError('');
    try {
      const data = await api.getCoachSimulate(token, 10000);
      setSimResults(data);
    } catch (err) {
      setError(err.message || 'Simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="de-bracket-container">
      <h4 style={{ marginBottom: 12 }}>DE Bracket Simulator</h4>

      {!bracketSet ? (
        <form onSubmit={handleSetBracket}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
            Enter fencer names in seed order (one per line, seed 1 first):
          </p>
          <textarea
            className="search-input"
            style={{ width: '100%', minHeight: 160, fontFamily: 'monospace', resize: 'vertical' }}
            value={seedings}
            onChange={(e) => setSeedings(e.target.value)}
            placeholder={"Seed 1 name\nSeed 2 name\nSeed 3 name\n..."}
          />
          <button type="submit" className="upload-btn" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Setting bracket...' : 'Set Bracket'}
          </button>
        </form>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button className="upload-btn" onClick={handleSimulate} disabled={simulating}>
              {simulating ? 'Simulating...' : 'Run Monte Carlo (10,000 sims)'}
            </button>
            <button className="refresh-btn" onClick={() => { setBracketSet(false); setSimResults(null); }}>
              Reset Bracket
            </button>
          </div>

          {simResults && (
            <div className="de-sim-results">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
                {simResults.n_sims.toLocaleString()} simulations, bracket of {simResults.bracket_size}
              </p>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Fencer</th>
                    <th>Strength</th>
                    {simResults.rounds?.map(r => <th key={r}>{r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {simResults.results?.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td>{r.strength?.toFixed(2)}</td>
                      {simResults.rounds?.map(round => (
                        <td key={round}>
                          <span style={{
                            color: r[round] > 50 ? 'var(--green)' :
                                   r[round] > 20 ? 'var(--yellow)' : 'var(--text-muted)'
                          }}>
                            {r[round]?.toFixed(1)}%
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {error && <div className="bout-input-error">{error}</div>}
    </div>
  );
}
