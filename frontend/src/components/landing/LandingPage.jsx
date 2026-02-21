import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ROLES = [
  {
    key: 'bout_committee',
    title: 'Bout Committee',
    description: 'Full dashboard with venue map, pool progress, and referee management.',
    icon: '\u2694\uFE0F',
    route: '/dashboard',
    code: '1234',
    color: 'var(--blue)',
    colorRaw: '59,130,246',
  },
  {
    key: 'public',
    title: 'Public View',
    description: 'Live results and bracket updates. No code required.',
    icon: '\uD83D\uDCFA',
    route: '/public',
    code: null,
    color: 'var(--green)',
    colorRaw: '34,197,94',
  },
  {
    key: 'coach',
    title: 'Coach',
    description: 'Track your fencers across pools and direct elimination.',
    icon: '\uD83D\uDCCB',
    route: '/coach',
    code: '5678',
    color: 'var(--orange)',
    colorRaw: '249,115,22',
  },
  {
    key: 'referee',
    title: 'Referee',
    description: 'View assignments, upload pool sheets, enter scores.',
    icon: '\uD83D\uDD14',
    route: '/referee',
    code: '9012',
    color: 'var(--yellow)',
    colorRaw: '234,179,8',
  },
];

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function LandingPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState(null);

  const handleVideoLoaded = () => {
    const v = videoRef.current;
    if (v) v.currentTime = 1;
  };

  const handleVideoLoop = () => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = 1;
      v.play();
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset demo? This clears Pool 4, DE bracket, and coach analytics.')) return;
    setResetting(true);
    setResetMsg(null);
    try {
      const resp = await fetch(`${API_BASE}/api/tournament/demo/reset`, { method: 'POST' });
      const data = await resp.json();
      if (data.success) {
        setResetMsg({ type: 'success', text: data.message });
      } else {
        setResetMsg({ type: 'error', text: data.detail || 'Reset failed' });
      }
    } catch (err) {
      setResetMsg({ type: 'error', text: `Reset failed: ${err.message}` });
    }
    setResetting(false);
    setTimeout(() => setResetMsg(null), 3000);
  };

  return (
    <div className="landing-page">
      <video
        ref={videoRef}
        className="landing-bg-video"
        autoPlay
        loop
        muted
        playsInline
        onLoadedMetadata={handleVideoLoaded}
        onEnded={handleVideoLoop}
      >
        <source src="/video/fence-video.mp4" type="video/mp4" />
      </video>

      <div className="landing-brand">
        <div className="brand-name">
          <h1>FenceFlow</h1>
          <span className="by-cozmx">by CozMx</span>
        </div>
        <p>Tournament Operations Platform</p>
      </div>

      <div className="role-grid">
        {ROLES.map((role, index) => (
          <RoleCard key={role.key} role={role} index={index} onNavigate={navigate} />
        ))}
      </div>

      <div className="landing-footer">
        Powered by Opus 4.6
      </div>

      <div className="demo-reset-area">
        <button
          className="demo-reset-btn"
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? 'Resetting...' : 'Reset Demo'}
        </button>
        {resetMsg && (
          <span className={`demo-reset-msg ${resetMsg.type}`}>{resetMsg.text}</span>
        )}
      </div>
    </div>
  );
}

function RoleCard({ role, index, onNavigate }) {
  const handleOpen = () => {
    sessionStorage.setItem(`role_${role.key}`, 'true');
    onNavigate(role.route);
  };

  return (
    <div
      className="role-card"
      style={{
        '--role-color': role.color,
        '--role-rgb': role.colorRaw,
        animationDelay: `${index * 80}ms`,
      }}
      onClick={handleOpen}
    >
      <div className="role-card-icon-wrap">
        <span className="role-card-icon">{role.icon}</span>
      </div>
      <h3>{role.title}</h3>
      <p>{role.description}</p>

      {!role.code && <span className="open-tag">Open Access</span>}

      {role.code && (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Requires access code
        </span>
      )}
    </div>
  );
}
