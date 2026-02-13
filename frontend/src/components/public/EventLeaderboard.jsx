import { useMemo } from 'react';

export default function EventLeaderboard({ pools, events }) {
  const leaderboards = useMemo(() => {
    const eventNames = (events || []).map((e) => e.name);
    const result = {};

    for (const eventName of eventNames) {
      const eventPools = (pools || []).filter(
        (p) => p.event === eventName && p.submission?.status === 'approved'
      );

      if (eventPools.length === 0) continue;

      // Aggregate fencer stats across all approved pools
      const fencerMap = {};

      for (const pool of eventPools) {
        const results = pool.submission?.results || [];
        const fencerList = pool.fencers || [];
        const poolSize = fencerList.length;

        for (const r of results) {
          const name = r.name;
          if (!name) continue;

          if (!fencerMap[name]) {
            // Try to find club/rating from fencer list
            const fencerInfo = fencerList.find(
              (f) => `${f.first_name} ${f.last_name}` === name
            );
            fencerMap[name] = {
              name,
              club: fencerInfo?.club || '',
              rating: fencerInfo?.rating || '',
              V: 0,
              L: 0,
              TS: 0,
              TR: 0,
              poolCount: 0,
            };
          }

          const f = fencerMap[name];
          const v = r.V || 0;
          f.V += v;
          f.L += (poolSize - 1) - v;
          f.TS += r.TS || 0;
          f.TR += r.TR || 0;
          f.poolCount += 1;
        }
      }

      // Sort: V desc → indicator desc → TS desc
      const ranked = Object.values(fencerMap).sort((a, b) => {
        const indA = a.TS - a.TR;
        const indB = b.TS - b.TR;
        if (b.V !== a.V) return b.V - a.V;
        if (indB !== indA) return indB - indA;
        return b.TS - a.TS;
      });

      if (ranked.length > 0) {
        result[eventName] = ranked;
      }
    }

    return result;
  }, [pools, events]);

  const eventNames = Object.keys(leaderboards);

  if (eventNames.length === 0) {
    return (
      <div className="no-data-message">
        No approved pool results yet. Leaderboards will appear once pools are scored.
      </div>
    );
  }

  return (
    <div>
      {eventNames.map((eventName) => {
        const ranked = leaderboards[eventName];
        return (
          <div key={eventName} className="leaderboard-event-section">
            <h3>{eventName}</h3>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="num-col">#</th>
                  <th>Name</th>
                  <th className="hide-mobile">Club</th>
                  <th className="num-col">W</th>
                  <th className="num-col">L</th>
                  <th className="num-col">TS</th>
                  <th className="num-col hide-mobile">TR</th>
                  <th className="num-col">Ind</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((f, i) => {
                  const ind = f.TS - f.TR;
                  const indClass = ind > 0 ? 'positive' : ind < 0 ? 'negative' : 'zero';
                  return (
                    <tr key={f.name}>
                      <td className="leaderboard-rank">{i + 1}</td>
                      <td className="leaderboard-name">{f.name}</td>
                      <td className="leaderboard-club hide-mobile">{f.club}</td>
                      <td className="num-col">{f.V}</td>
                      <td className="num-col">{f.L}</td>
                      <td className="num-col">{f.TS}</td>
                      <td className="num-col hide-mobile">{f.TR}</td>
                      <td className={`num-col leaderboard-indicator ${indClass}`}>
                        {ind > 0 ? `+${ind}` : ind}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
