import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ROLES = [
  {
    key: 'bout_committee',
    title: 'Bout Committee',
    description: 'Full dashboard with venue map, pool progress, and referee management.',
    icon: '\u2694\uFE0F',
    route: '/dashboard',
    code: '1234',
  },
  {
    key: 'public',
    title: 'Public View',
    description: 'Live results and bracket updates. No code required.',
    icon: '\uD83D\uDCFA',
    route: '/public',
    code: null,
  },
  {
    key: 'coach',
    title: 'Coach',
    description: 'Track your fencers across pools and direct elimination.',
    icon: '\uD83D\uDCCB',
    route: '/coach',
    code: '5678',
  },
  {
    key: 'referee',
    title: 'Referee',
    description: 'View assignments, upload pool sheets, enter scores.',
    icon: '\uD83D\uDD14',
    route: '/referee',
    code: '9012',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-brand">
        <div className="brand-name">
          <h1>FenceFlow</h1>
          <span className="by-cozmx">by CozMx</span>
        </div>
        <p>Tournament Operations Platform</p>
      </div>

      <div className="role-grid">
        {ROLES.map((role) => (
          <RoleCard key={role.key} role={role} onNavigate={navigate} />
        ))}
      </div>
    </div>
  );
}

function RoleCard({ role, onNavigate }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const handleOpen = () => {
    if (!role.code) {
      sessionStorage.setItem(`role_${role.key}`, 'true');
      onNavigate(role.route);
      return;
    }
    setShowInput(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code === role.code) {
      sessionStorage.setItem(`role_${role.key}`, 'true');
      onNavigate(role.route);
    } else {
      setError(true);
      setTimeout(() => setError(false), 600);
    }
  };

  return (
    <div className="role-card" onClick={!showInput ? handleOpen : undefined}>
      <span className="role-card-icon">{role.icon}</span>
      <h3>{role.title}</h3>
      <p>{role.description}</p>

      {!role.code && <span className="open-tag">Open Access</span>}

      {role.code && !showInput && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Requires access code
        </span>
      )}

      {role.code && showInput && (
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
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
            />
            <button type="submit" className="code-submit-btn">Go</button>
          </div>
          {error && <div className="code-error">Invalid code</div>}
        </form>
      )}
    </div>
  );
}
