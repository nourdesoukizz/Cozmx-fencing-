import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function CoachPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem('role_coach') !== 'true') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="placeholder-page">
      <h2>Coach Portal</h2>
      <p>Fencer tracking and matchup analysis — coming soon.</p>
      <Link to="/" className="back-home-btn">Back to Home</Link>
    </div>
  );
}
