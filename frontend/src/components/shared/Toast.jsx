export default function Toast({ notifications, onClose }) {
  if (!notifications.length) return null;

  return (
    <div className="toast-container">
      {notifications.map((n) => (
        <div key={n.id} className={`toast ${n.type} ${n.removing ? 'removing' : ''}`}>
          <div className="toast-header">
            <span className="toast-title">{n.title}</span>
            <button className="toast-close" onClick={() => onClose(n.id)}>
              &times;
            </button>
          </div>
          {n.message && <div className="toast-message">{n.message}</div>}
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  );
}
