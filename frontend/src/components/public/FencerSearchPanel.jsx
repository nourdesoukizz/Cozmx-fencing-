import { useState, useMemo } from 'react';

export default function FencerSearchPanel({ pools }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFencer, setSelectedFencer] = useState(null);

  // Build unique fencer list from all pools
  const allFencers = useMemo(() => {
    const map = {};
    for (const pool of pools || []) {
      for (const f of pool.fencers || []) {
        const name = `${f.first_name} ${f.last_name}`;
        if (!map[name]) {
          map[name] = {
            name,
            club: f.club || '',
            rating: f.rating || '',
            events: new Set(),
          };
        }
        map[name].events.add(pool.event);
      }
    }
    return Object.values(map).map((f) => ({
      ...f,
      events: Array.from(f.events),
    }));
  }, [pools]);

  // Filter fencers by search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allFencers
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.club.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [searchQuery, allFencers]);

  // Compute aggregated stats for selected fencer (approved pools only)
  const fencerStats = useMemo(() => {
    if (!selectedFencer) return null;

    const approvedPools = (pools || []).filter(
      (p) => p.submission?.status === 'approved'
    );

    let totalV = 0, totalL = 0, totalTS = 0, totalTR = 0;
    const poolBreakdowns = [];

    for (const pool of approvedPools) {
      const results = pool.submission?.results || [];
      const match = results.find((r) => r.name === selectedFencer.name);
      if (!match) continue;

      const v = match.V || 0;
      const ts = match.TS || 0;
      const tr = match.TR || 0;
      const poolSize = (pool.fencers || []).length;
      const l = (poolSize - 1) - v;

      totalV += v;
      totalL += l;
      totalTS += ts;
      totalTR += tr;

      poolBreakdowns.push({
        event: pool.event,
        poolNumber: pool.pool_number,
        place: match.place,
        V: v,
        L: l,
        TS: ts,
        TR: tr,
      });
    }

    return {
      totalV,
      totalL,
      totalTS,
      totalTR,
      indicator: totalTS - totalTR,
      pools: poolBreakdowns,
    };
  }, [selectedFencer, pools]);

  const handleSelect = (fencer) => {
    setSelectedFencer(fencer);
    setSearchQuery('');
  };

  return (
    <>
      <div className="fencer-search">
        <span className="fencer-search-icon">&#128269;</span>
        <input
          className="fencer-search-input"
          type="text"
          placeholder="Search fencer by name or club..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value.trim()) setSelectedFencer(null);
          }}
        />
        {filtered.length > 0 && searchQuery.trim() && (
          <div className="fencer-search-dropdown">
            {filtered.map((f) => (
              <div
                key={f.name}
                className="fencer-search-item"
                onClick={() => handleSelect(f)}
              >
                <div className="fencer-search-item-name">{f.name}</div>
                <div className="fencer-search-item-meta">
                  {f.club}{f.rating ? ` | ${f.rating}` : ''} | {f.events.join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFencer && fencerStats && (
        <div className="fencer-result-card">
          <div className="fencer-result-card-header">
            <div>
              <div className="fencer-result-card-name">{selectedFencer.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {selectedFencer.club}{selectedFencer.rating ? ` | ${selectedFencer.rating}` : ''}
              </div>
            </div>
            <button
              className="fencer-result-card-close"
              onClick={() => setSelectedFencer(null)}
            >
              &times;
            </button>
          </div>

          <div className="fencer-result-stats">
            <div className="fencer-result-stat">
              <div className="fencer-result-stat-value">{fencerStats.totalV}</div>
              <div className="fencer-result-stat-label">Wins</div>
            </div>
            <div className="fencer-result-stat">
              <div className="fencer-result-stat-value">{fencerStats.totalL}</div>
              <div className="fencer-result-stat-label">Losses</div>
            </div>
            <div className="fencer-result-stat">
              <div className="fencer-result-stat-value">{fencerStats.totalTS}</div>
              <div className="fencer-result-stat-label">TS</div>
            </div>
            <div className="fencer-result-stat">
              <div className="fencer-result-stat-value">{fencerStats.totalTR}</div>
              <div className="fencer-result-stat-label">TR</div>
            </div>
            <div className="fencer-result-stat">
              <div className="fencer-result-stat-value" style={{ color: fencerStats.indicator > 0 ? 'var(--green)' : fencerStats.indicator < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                {fencerStats.indicator > 0 ? `+${fencerStats.indicator}` : fencerStats.indicator}
              </div>
              <div className="fencer-result-stat-label">Ind</div>
            </div>
          </div>

          {fencerStats.pools.length > 0 && (
            <div className="fencer-result-pools">
              <h4>Pool Breakdown</h4>
              {fencerStats.pools.map((p, i) => (
                <div key={i} className="fencer-result-pool-row">
                  <span>{p.event} — Pool {p.poolNumber}</span>
                  <span>
                    #{p.place} | {p.V}V-{p.L}L | {p.TS}-{p.TR}
                  </span>
                </div>
              ))}
            </div>
          )}

          {fencerStats.pools.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              No approved pool results yet for this fencer.
            </div>
          )}
        </div>
      )}
    </>
  );
}
