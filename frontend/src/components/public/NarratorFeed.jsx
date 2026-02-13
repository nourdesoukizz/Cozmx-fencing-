function timeAgo(isoString) {
  if (!isoString) return '';
  try {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return new Date(isoString).toLocaleDateString();
  } catch {
    return '';
  }
}

export default function NarratorFeed({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="no-data-message">
        No commentary yet. The narrator will start posting once events begin and pools are scored.
      </div>
    );
  }

  return (
    <div className="narrator-feed">
      {entries.map((entry) => (
        <div key={entry.id} className="narrator-card">
          <div className="narrator-card-text">{entry.text}</div>
          <div className="narrator-card-time">{timeAgo(entry.created_at)}</div>
        </div>
      ))}
    </div>
  );
}
