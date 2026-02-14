import { useMemo } from 'react';

function FencerRow({ fencer, score, isWinner, isBye }) {
  if (isBye) {
    return (
      <div className="bout-fencer-row">
        <span className="bye-text">BYE</span>
      </div>
    );
  }

  if (!fencer) {
    return (
      <div className="bout-fencer-row">
        <span className="bye-text">TBD</span>
      </div>
    );
  }

  return (
    <div className={`bout-fencer-row${isWinner ? ' winner' : ''}`}>
      <span className="seed-badge">{fencer.seed || '-'}</span>
      <span className="fencer-name">{fencer.first_name} {fencer.last_name}</span>
      {score !== null && score !== undefined && (
        <span className="bout-score">{score}</span>
      )}
    </div>
  );
}

function BoutCard({ bout }) {
  const isBye = bout.status === 'bye';
  const isCompleted = bout.status === 'completed';
  const isPendingActive = bout.status === 'pending' && bout.top_fencer && bout.bottom_fencer;

  const cardClass = `bout-card${isCompleted ? ' completed' : ''}${isPendingActive ? ' pending-active' : ''}${isBye ? ' bye' : ''}`;

  return (
    <div className={cardClass}>
      <FencerRow
        fencer={bout.top_fencer}
        score={bout.top_score}
        isWinner={bout.winner_side === 'top'}
        isBye={isBye && !bout.top_fencer}
      />
      <FencerRow
        fencer={bout.bottom_fencer}
        score={bout.bottom_score}
        isWinner={bout.winner_side === 'bottom'}
        isBye={isBye && !bout.bottom_fencer}
      />
    </div>
  );
}

export default function Bracket({ bracket }) {
  const rounds = useMemo(() => bracket?.rounds || [], [bracket]);

  if (!bracket || rounds.length === 0) {
    return <div style={{ color: 'var(--text-muted)', padding: 16 }}>No bracket data</div>;
  }

  return (
    <div className="bracket-container">
      {rounds.map((round, rIdx) => (
        <div key={rIdx} className="bracket-round">
          <div className="bracket-round-title">{round.round_name}</div>
          {round.bouts.map((bout) => (
            <BoutCard key={bout.bout_id} bout={bout} />
          ))}
        </div>
      ))}
    </div>
  );
}
