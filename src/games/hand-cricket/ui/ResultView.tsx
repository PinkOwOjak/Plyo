import type { MatchState, Side } from '../engine/match.ts';
import { oversText } from '../engine/match.ts';

interface Props {
  state: MatchState;
  names: [string, string];
  /** The side this device plays as, or null for pass & play. */
  you: Side | null;
  onRematch?: () => void;
  rematchLabel?: string;
  exitHref: string;
  extra?: React.ReactNode;
}

export function ResultView({ state, names, you, onRematch, rematchLabel = 'Play again', exitHref, extra }: Props) {
  const r = state.result!;
  let headline: string;
  let tone: 'win' | 'loss' | 'tie' = 'tie';
  if (r.winner === null) headline = 'It’s a tie';
  else if (you === null) {
    headline = `${names[r.winner]} wins`;
    tone = 'win';
  } else if (r.winner === you) {
    headline = 'You won';
    tone = 'win';
  } else {
    headline = `${names[r.winner]} won`;
    tone = 'loss';
  }

  return (
    <div className={`overlay-card result result--${tone}`} role="dialog" aria-labelledby="result-title">
      <h2 id="result-title" className="result__headline">{headline}</h2>
      {r.margin && <p className="result__margin">{r.winner !== null ? `${names[r.winner]} won ${r.margin}` : ''}</p>}
      <table className="table result__card">
        <thead>
          <tr><th scope="col">Innings</th><th scope="col">Runs</th><th scope="col">Overs</th><th scope="col">6s</th><th scope="col">How</th></tr>
        </thead>
        <tbody>
          {state.innings.map((inn, i) => (
            <tr key={i}>
              <td>{names[inn.battingSide]}</td>
              <td><strong>{inn.runs}</strong></td>
              <td>{oversText(inn.balls.length)}</td>
              <td>{inn.balls.filter((b) => b.runs === 6).length}</td>
              <td>{inn.out ? 'out' : 'not out'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {extra}
      <div className="overlay-actions">
        {onRematch && <button className="btn btn--primary btn--lg" onClick={onRematch}>{rematchLabel}</button>}
        <a className="btn btn--ghost btn--lg" href={exitHref}>Leave match</a>
      </div>
    </div>
  );
}
