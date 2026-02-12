import { useState, useMemo } from 'react';

export default function FencerList({ fencers, onSelectFencer }) {
  const [sortKey, setSortKey] = useState('win_prob');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'club' || key === 'rating' ? 'asc' : 'desc');
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
        (f.name || '').toLowerCase().includes(q) ||
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
        case 'strength':
          va = a.strength ?? 0;
          vb = b.strength ?? 0;
          break;
        case 'win_prob':
          va = a.win_prob ?? 0;
          vb = b.win_prob ?? 0;
          break;
        case 'rank':
          va = a.rank ?? 999;
          vb = b.rank ?? 999;
          break;
        case 'record':
          va = (a.wins ?? 0) - (a.losses ?? 0);
          vb = (b.wins ?? 0) - (b.losses ?? 0);
          break;
        case 'td':
          va = a.td ?? 0;
          vb = b.td ?? 0;
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
            <th className="sortable" onClick={() => handleSort('rank')}>
              #Rank{sortIndicator('rank')}
            </th>
            <th className="sortable" onClick={() => handleSort('name')}>
              Name{sortIndicator('name')}
            </th>
            <th className="sortable" onClick={() => handleSort('club')}>
              Club{sortIndicator('club')}
            </th>
            <th className="sortable" onClick={() => handleSort('rating')}>
              Rating{sortIndicator('rating')}
            </th>
            <th className="sortable" onClick={() => handleSort('strength')}>
              Strength{sortIndicator('strength')}
            </th>
            <th className="sortable" onClick={() => handleSort('win_prob')}>
              Win%{sortIndicator('win_prob')}
            </th>
            <th className="sortable" onClick={() => handleSort('record')}>
              Record{sortIndicator('record')}
            </th>
            <th className="sortable" onClick={() => handleSort('td')}>
              TD{sortIndicator('td')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((f) => (
            <tr
              key={f.id || f.name}
              className={f.has_bouts ? '' : 'fencer-row-no-data'}
              onClick={() => onSelectFencer(f)}
              style={{ cursor: 'pointer' }}
            >
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {f.has_bouts ? f.rank : '\u2014'}
              </td>
              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {f.first_name} {f.last_name}
                {f.has_bouts && (
                  <span className="delta-badge pool-data-badge">active</span>
                )}
              </td>
              <td>{f.club || '\u2014'}</td>
              <td>{f.rating || 'U'}</td>
              <td>
                {f.has_bouts ? (
                  <span style={{ fontWeight: 600 }}>{f.strength?.toFixed(2)}</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>{f.strength?.toFixed(2)}</span>
                )}
              </td>
              <td>
                {f.has_bouts ? (
                  <span className={`delta-badge ${
                    f.win_prob > 10 ? 'delta-above' :
                    f.win_prob > 3 ? 'delta-at' : 'delta-below'
                  }`}>
                    {f.win_prob?.toFixed(1)}%
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
                )}
              </td>
              <td>
                {f.has_bouts ? (
                  <span>{f.wins}W-{f.losses}L</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
                )}
              </td>
              <td>
                {f.has_bouts ? (
                  <span style={{ color: f.td > 0 ? 'var(--green)' : f.td < 0 ? 'var(--red)' : 'var(--text-secondary)' }}>
                    {f.td > 0 ? '+' : ''}{f.td}
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
