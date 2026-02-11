import { Link } from 'react-router-dom';

export default function PublicPage() {
  return (
    <div className="placeholder-page">
      <h2>Public View</h2>
      <p>Live results and brackets — coming soon.</p>
      <Link to="/" className="back-home-btn">Back to Home</Link>
    </div>
  );
}
