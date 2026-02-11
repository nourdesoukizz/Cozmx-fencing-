import { capitalize } from '../../utils/formatters';

export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge ${status || ''}`}>
      {capitalize(status)}
    </span>
  );
}
