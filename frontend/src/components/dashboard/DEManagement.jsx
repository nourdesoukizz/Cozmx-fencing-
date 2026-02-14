import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import Bracket from '../shared/Bracket';
import StatusBadge from '../shared/StatusBadge';

export default function DEManagement({ pools, referees, addNotification, onRefresh }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [seedings, setSeedings] = useState(null);
  const [bracket, setBracket] = useState(null);
  const [allBrackets, setAllBrackets] = useState({});
  const [loading, setLoading] = useState(false);

  // Events where all pools are approved
  const eligibleEvents = useMemo(() => {
    const eventMap = {};
    pools.forEach((p) => {
      if (!eventMap[p.event]) eventMap[p.event] = { total: 0, approved: 0 };
      eventMap[p.event].total++;
      if (p.submission?.status === 'approved') eventMap[p.event].approved++;
    });
    return Object.entries(eventMap)
      .filter(([, v]) => v.total > 0 && v.approved === v.total)
      .map(([name]) => name)
      .sort();
  }, [pools]);

  // Fetch all brackets on mount
  const fetchBrackets = useCallback(async () => {
    try {
      const data = await api.getAllDEBrackets();
      const map = {};
      (data.brackets || []).forEach((b) => { map[b.event] = b; });
      setAllBrackets(map);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchBrackets(); }, [fetchBrackets]);

  // When event is selected, load seedings or bracket
  useEffect(() => {
    if (!selectedEvent) {
      setSeedings(null);
      setBracket(null);
      return;
    }

    const existing = allBrackets[selectedEvent];
    if (existing) {
      setBracket(existing);
      setSeedings(null);
    } else {
      setBracket(null);
      setSeedings(null);
      api.getDESeedings(selectedEvent)
        .then((data) => setSeedings(data.seedings || []))
        .catch(() => setSeedings([]));
    }
  }, [selectedEvent, allBrackets]);

  const handleCreate = async () => {
    if (!selectedEvent) return;
    setLoading(true);
    try {
      const result = await api.createDEBracket(selectedEvent);
      setBracket(result.bracket);
      setSeedings(null);
      setAllBrackets((prev) => ({ ...prev, [selectedEvent]: result.bracket }));
      addNotification('success', 'Bracket Created', `DE bracket for ${selectedEvent} created`);
      if (onRefresh) onRefresh();
    } catch (err) {
      addNotification('error', 'Create Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent || !window.confirm(`Delete DE bracket for ${selectedEvent}?`)) return;
    try {
      await api.deleteDEBracket(selectedEvent);
      setBracket(null);
      setAllBrackets((prev) => {
        const next = { ...prev };
        delete next[selectedEvent];
        return next;
      });
      addNotification('info', 'Bracket Deleted', `DE bracket for ${selectedEvent} deleted`);
    } catch (err) {
      addNotification('error', 'Delete Failed', err.message);
    }
  };

  const handleAssign = async (boutId, refereeId, strip) => {
    try {
      await api.assignDEReferee(selectedEvent, {
        bout_id: boutId,
        referee_id: refereeId,
        strip_number: strip || null,
      });
      addNotification('success', 'Referee Assigned', `Referee assigned to ${boutId}`);
      // Refresh bracket
      const updated = await api.getDEBracket(selectedEvent);
      setBracket(updated);
      setAllBrackets((prev) => ({ ...prev, [selectedEvent]: updated }));
    } catch (err) {
      addNotification('error', 'Assign Failed', err.message);
    }
  };

  // Compute progress for active bracket
  const progress = useMemo(() => {
    if (!bracket) return null;
    let total = 0, completed = 0;
    bracket.rounds.forEach((r) => r.bouts.forEach((b) => {
      if (b.status !== 'bye') { total++; if (b.status === 'completed') completed++; }
    }));
    return { total, completed, pct: total > 0 ? (completed / total) * 100 : 0 };
  }, [bracket]);

  return (
    <div className="de-management">
      <h3 style={{ marginBottom: 12 }}>Direct Elimination</h3>

      {eligibleEvents.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          No events with all pools approved. Complete pool scoring first.
        </p>
      ) : (
        <>
          <div className="de-event-selector">
            {eligibleEvents.map((ev) => (
              <button
                key={ev}
                className={selectedEvent === ev ? 'active' : ''}
                onClick={() => setSelectedEvent(ev)}
              >
                {ev}
                {allBrackets[ev] && <span className="bracket-exists" />}
              </button>
            ))}
          </div>

          {/* Seedings Preview (no bracket yet) */}
          {selectedEvent && seedings && !bracket && (
            <div>
              <div className="de-bracket-info">
                <span className="info-item">
                  <strong>{seedings.length}</strong> fencers
                </span>
                <span className="info-item">
                  Bracket of <strong>{Math.pow(2, Math.ceil(Math.log2(Math.max(seedings.length, 2))))}</strong>
                </span>
                <span className="info-item">
                  {Math.pow(2, Math.ceil(Math.log2(Math.max(seedings.length, 2)))) - seedings.length} byes
                </span>
              </div>

              <table className="de-seedings-table">
                <thead>
                  <tr>
                    <th>Seed</th>
                    <th>Name</th>
                    <th>Club</th>
                    <th>Rating</th>
                    <th>V</th>
                    <th>Ind</th>
                  </tr>
                </thead>
                <tbody>
                  {seedings.map((s) => (
                    <tr key={s.fencer_id}>
                      <td>{s.rank}</td>
                      <td>{s.first_name} {s.last_name}</td>
                      <td>{s.club}</td>
                      <td>{s.rating}</td>
                      <td>{s.V}</td>
                      <td>{s.indicator > 0 ? `+${s.indicator}` : s.indicator}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                className="de-create-btn"
                onClick={handleCreate}
                disabled={loading || seedings.length < 2}
              >
                {loading ? 'Creating...' : 'Create Bracket'}
              </button>
            </div>
          )}

          {/* Active Bracket */}
          {selectedEvent && bracket && (
            <div>
              <div className="de-bracket-info">
                <span className="info-item">
                  <StatusBadge status={bracket.status === 'completed' ? 'completed' : 'active'} />
                </span>
                {progress && (
                  <>
                    <span className="info-item">
                      <strong>{progress.completed}</strong> of <strong>{progress.total}</strong> bouts
                    </span>
                    <div className="de-progress-bar">
                      <div className="de-progress-fill" style={{ width: `${progress.pct}%` }} />
                    </div>
                  </>
                )}
              </div>

              <Bracket bracket={bracket} />

              {/* Bout Management Table */}
              <table className="de-bout-table">
                <thead>
                  <tr>
                    <th>Bout</th>
                    <th>Top Fencer</th>
                    <th>Bottom Fencer</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Referee / Strip</th>
                  </tr>
                </thead>
                <tbody>
                  {bracket.rounds.map((round) => (
                    <RoundRows
                      key={round.round_number}
                      round={round}
                      referees={referees}
                      onAssign={handleAssign}
                    />
                  ))}
                </tbody>
              </table>

              {/* Final Standings */}
              {bracket.status === 'completed' && bracket.final_standings?.length > 0 && (
                <div>
                  <h4 style={{ marginTop: 20, marginBottom: 8 }}>Final Standings</h4>
                  <table className="de-standings-table">
                    <thead>
                      <tr><th>Place</th><th>Fencer</th><th>Seed</th></tr>
                    </thead>
                    <tbody>
                      {bracket.final_standings.map((s, i) => (
                        <tr key={i}>
                          <td className={s.place === 1 ? 'gold' : s.place === 2 ? 'silver' : s.place <= 3 ? 'bronze' : ''}>
                            {s.place === 1 ? '1st' : s.place === 2 ? '2nd' : `T${s.place}`}
                          </td>
                          <td>{s.first_name} {s.last_name}</td>
                          <td>#{s.seed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button className="de-delete-btn" onClick={handleDelete}>
                Delete Bracket
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RoundRows({ round, referees, onAssign }) {
  return (
    <>
      <tr>
        <td colSpan={6} className="de-round-header">{round.round_name}</td>
      </tr>
      {round.bouts.map((bout) => (
        <BoutRow key={bout.bout_id} bout={bout} referees={referees} onAssign={onAssign} />
      ))}
    </>
  );
}

function BoutRow({ bout, referees, onAssign }) {
  const [selRef, setSelRef] = useState('');
  const [selStrip, setSelStrip] = useState('');

  const isBye = bout.status === 'bye';
  const isCompleted = bout.status === 'completed';
  const isPending = bout.status === 'pending';
  const hasBothFencers = bout.top_fencer && bout.bottom_fencer;

  const fmtFencer = (f) => {
    if (!f) return '—';
    return `(${f.seed}) ${f.first_name} ${f.last_name}`;
  };

  return (
    <tr className={`de-bout-row ${bout.status}`}>
      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bout.bout_id}</td>
      <td>{isBye && !bout.top_fencer ? 'BYE' : fmtFencer(bout.top_fencer)}</td>
      <td>{isBye && !bout.bottom_fencer ? 'BYE' : fmtFencer(bout.bottom_fencer)}</td>
      <td>
        {isCompleted ? `${bout.top_score}-${bout.bottom_score}` : isBye ? '—' : ''}
      </td>
      <td>
        {isCompleted && <span style={{ color: 'var(--green)' }}>Done</span>}
        {isBye && <span style={{ color: 'var(--text-muted)' }}>BYE</span>}
        {isPending && !hasBothFencers && <span style={{ color: 'var(--text-muted)' }}>Waiting</span>}
        {isPending && hasBothFencers && <span style={{ color: 'var(--blue)' }}>Ready</span>}
      </td>
      <td>
        {isCompleted && (
          <span style={{ fontSize: 12 }}>{bout.referee_name || '—'}{bout.strip_number ? ` / Strip ${bout.strip_number}` : ''}</span>
        )}
        {isPending && hasBothFencers && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <select
              className="de-assign-dropdown"
              value={selRef}
              onChange={(e) => setSelRef(e.target.value)}
            >
              <option value="">Referee...</option>
              {referees.map((r) => (
                <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>
              ))}
            </select>
            <input
              className="de-strip-input"
              placeholder="#"
              value={selStrip}
              onChange={(e) => setSelStrip(e.target.value)}
            />
            <button
              className="de-assign-btn"
              disabled={!selRef}
              onClick={() => onAssign(bout.bout_id, parseInt(selRef), selStrip)}
            >
              Assign
            </button>
          </span>
        )}
        {isPending && !hasBothFencers && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
        {isBye && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
      </td>
    </tr>
  );
}
