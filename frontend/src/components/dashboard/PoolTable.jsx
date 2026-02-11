import { formatRefereeName } from '../../utils/formatters';
import StatusBadge from '../shared/StatusBadge';

export default function PoolTable({ pool }) {
  const fencers = pool.fencers || [];
  const n = fencers.length;

  return (
    <div className="pool-matrix-card">
      <div className="pool-matrix-header">
        <span className="pool-label">Pool {pool.pool_number}</span>
        <div className="pool-meta">
          <span>{pool.strip_number}</span>
          <span>{formatRefereeName(pool.referee)}</span>
          <StatusBadge status={pool.status} />
        </div>
      </div>
      <div className="pool-matrix-body">
        {n > 0 ? (
          <table className="matrix-table">
            <thead>
              <tr>
                <th></th>
                {fencers.map((_, i) => (
                  <th key={i}>{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fencers.map((fencer, row) => (
                <tr key={row}>
                  <th className="row-header">
                    {fencer.last_name || `Fencer ${row + 1}`}
                  </th>
                  {fencers.map((_, col) => {
                    if (row === col) {
                      return <td key={col} className="diagonal"></td>;
                    }
                    return <td key={col} className="bout-cell">&mdash;</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>
            {pool.fencer_count} fencers &middot; {pool.bout_count} bouts (details not loaded)
          </div>
        )}
      </div>
    </div>
  );
}
