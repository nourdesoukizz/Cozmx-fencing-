import { formatRefereeName } from '../../utils/formatters';
import StatusBadge from '../shared/StatusBadge';

export default function PoolTable({ pool, onClick, readOnly = false }) {
  const fencers = pool.fencers || [];
  const n = fencers.length;
  const scores = pool.submission?.scores;
  const results = pool.submission?.results;
  const isPending = pool.submission?.status === 'pending_review' || pool.submission?.status === 'ocr_failed';

  return (
    <div
      className={`pool-matrix-card ${isPending ? 'pending-glow' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : {}}
    >
      <div className="pool-matrix-header">
        <span className="pool-label">Pool {pool.pool_number}</span>
        <div className="pool-meta">
          <span>{pool.strip_number}</span>
          <span>{formatRefereeName(pool.referee)}</span>
          <StatusBadge status={pool.submission?.status === 'approved' ? 'completed' : (pool.submission?.status === 'pending_review' || pool.submission?.status === 'ocr_failed') ? 'active' : pool.status} />
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
                {scores && <th>V</th>}
                {scores && <th>TS</th>}
                {scores && <th>TR</th>}
                {scores && <th>Ind</th>}
                {scores && <th>Pl</th>}
              </tr>
            </thead>
            <tbody>
              {fencers.map((fencer, row) => {
                const result = results?.find((r) => r.last_name === fencer.last_name && r.first_name === fencer.first_name)
                  || results?.[row];
                return (
                  <tr key={row}>
                    <th className="row-header">
                      {fencer.last_name || `Fencer ${row + 1}`}
                    </th>
                    {fencers.map((_, col) => {
                      if (row === col) {
                        return <td key={col} className="diagonal"></td>;
                      }
                      if (scores && scores[row] && scores[row][col] != null) {
                        const val = scores[row][col];
                        const oppVal = scores[col]?.[row];
                        const isWin = oppVal != null && val > oppVal;
                        return (
                          <td key={col} className={`bout-cell ${isWin ? 'victory' : 'defeat'}`}>
                            {isWin ? `V${val}` : `D${val}`}
                          </td>
                        );
                      }
                      return <td key={col} className="bout-cell">&mdash;</td>;
                    })}
                    {scores && result && (
                      <>
                        <td className="result-cell">{result.V}</td>
                        <td className="result-cell">{result.TS}</td>
                        <td className="result-cell">{result.TR}</td>
                        <td className="result-cell">{result.indicator >= 0 ? `+${result.indicator}` : result.indicator}</td>
                        <td className="result-cell place">{result.place}</td>
                      </>
                    )}
                  </tr>
                );
              })}
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
