import { useState, useMemo } from 'react';

const SORT_KEYS = ['name', 'club', 'rating', 'posterior_mean', 'performance_label', 'delta_value'];

export default function FencerList({ fencers, onSelectFencer }) {
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const filtered = useMemo(() => {
    let list = fencers || [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(f =>
        `${f.first_name} ${f.last_name}`.toLowerCase().includes(q) ||
        (f.club || '').toLowerCase().includes(q) ||
        (f.rating || '').toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case 'name':
          va = `${a.last_name} ${a.first_name}`.toLowerCase();
          vb = `${b.last_name} ${b.first_name}`.toLowerCase();
          break;
        case 'club':
          va = (a.club || '').toLowerCase();
          vb = (b.club || '').toLowerCase();
          break;
        case 'rating':
          va = (a.rating || '').toLowerCase();
          vb = (b.rating || '').toLowerCase();
          break;
        case 'posterior_mean':
          va = a.posterior_mean ?? 0;
          vb = b.posterior_mean ?? 0;
          break;
        case 'performance_label':
          va = a.performance_label || '';
          vb = b.performance_label || '';
          break;
        case 'delta_value':
          va = a.delta_value ?? 0;
          vb = b.delta_value ?? 0;
          break;
        default:
          va = '';
          vb = '';
      }

      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [fencers, search, sortKey, sortDir]);

  const rowClass = (f) => {
    if (!f.has_pool_data) return '';
    if (f.delta_label === 'Above rating') return 'fencer-row-above';
    if (f.delta_label === 'Below rating') return 'fencer-row-below';
    return '';
  };

  return (
    <div>
      <div className="pool-controls" style={{ marginBottom: 16 }}>
        <input
          className="search-input"
          type="text"
          placeholder="Search fencers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {filtered.length} fencer{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort('name')}>
              Name{sortIndicator('name')}
            </th>
            <th className="sortable" onClick={() => handleSort('club')}>
              Club{sortIndicator('club')}
            </th>
            <th className="sortable" onClick={() => handleSort('rating')}>
              Rating{sortIndicator('rating')}
            </th>
            <th className="sortable" onClick={() => handleSort('posterior_mean')}>
              Posterior{sortIndicator('posterior_mean')}
            </th>
            <th className="sortable" onClick={() => handleSort('performance_label')}>
              Level{sortIndicator('performance_label')}
            </th>
            <th className="sortable" onClick={() => handleSort('delta_value')}>
              Delta{sortIndicator('delta_value')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((f) => (
            <tr
              key={f.id}
              className={rowClass(f)}
              onClick={() => onSelectFencer(f)}
              style={{ cursor: 'pointer' }}
            >
              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {f.first_name} {f.last_name}
                {f.has_pool_data && (
                  <span className="delta-badge pool-data-badge">has pool data</span>
                )}
              </td>
              <td>{f.club || '\u2014'}</td>
              <td>{f.rating || 'U'}</td>
              <td>{f.posterior_mean?.toFixed(2) ?? '\u2014'}</td>
              <td>{f.performance_label || '\u2014'}</td>
              <td>
                {f.has_pool_data ? (
                  <span className={`delta-badge ${
                    f.delta_label === 'Above rating' ? 'delta-above' :
                    f.delta_label === 'Below rating' ? 'delta-below' : 'delta-at'
                  }`}>
                    {f.delta_value > 0 ? '+' : ''}{f.delta_value?.toFixed(2)} {f.delta_label}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
