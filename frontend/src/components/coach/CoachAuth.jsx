import { useState } from 'react';
import { api } from '../../api/client';

export default function CoachAuth({ onAuth }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 4) {
      setError('Enter a 4-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.coachAuth(code);
      localStorage.setItem('coach_token', data.token);
      onAuth(data.token);
    } catch (err) {
      setError('Invalid access code');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="coach-auth-page">
      <div className="coach-auth-card">
        <h2>Coach Portal</h2>
        <p>Enter your 4-digit access code to view fencer analytics.</p>
        <form onSubmit={handleSubmit}>
          <div className="code-input-row">
            <input
              className={`code-input ${error ? 'error' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              autoFocus
              disabled={loading}
            />
            <button type="submit" className="code-submit-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Enter'}
            </button>
          </div>
          {error && <div className="code-error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
