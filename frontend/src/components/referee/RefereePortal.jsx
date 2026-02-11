import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function RefereePortal() {
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem('role_referee') !== 'true') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="placeholder-page">
      <h2>Referee Portal</h2>
      <p>Pool sheet upload and score entry — coming soon.</p>
      <Link to="/" className="back-home-btn">Back to Home</Link>
    </div>
  );
}
