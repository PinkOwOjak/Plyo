import { GAMES } from '../platform/games.ts';
import { profile } from '../platform/profile.ts';
import { href } from '../platform/router.ts';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late-night match';
  if (h < 12) return 'Morning session';
  if (h < 17) return 'Afternoon session';
  return 'Under the lights';
}

export function Lobby() {
  const p = profile.use();
  const featured = GAMES.find((g) => g.status === 'playable')!;
  const rest = GAMES.filter((g) => g !== featured);
  const played = p.stats.bot.played + p.stats.local.played + p.stats.online.played;
  const won = p.stats.bot.won + p.stats.local.won + p.stats.online.won;

  return (
    <>
      <section className="lobby-hello">
        <h1>{greeting()}, {p.name}.</h1>
        <p>Pick a game. Hand Cricket is open for play.</p>
      </section>

      <article className="feature" aria-labelledby="feature-title">
        <div className="feature__board" aria-label="Thumb only scores six">
          {'10000'.split('').map((b, i) => (
            <span key={i} className="tile tile--xl">{b}</span>
          ))}
          <span className="feature__eq" aria-hidden>=</span>
          <span className="tile tile--xl feature__six">6</span>
        </div>
        <div className="feature__body">
          <h2 id="feature-title">{featured.title}</h2>
          <p>{featured.pitch}</p>
          <div className="chips">
            {featured.modes.map((m) => (
              <span key={m} className="chip">{m}</span>
            ))}
          </div>
          <a className="btn btn--primary btn--lg" href={href(`/${featured.id}`)}>Play Hand Cricket</a>
          {played > 0 && (
            <div className="feature__stats">
              <div><strong>{played}</strong>matches</div>
              <div><strong>{won}</strong>wins</div>
              <div><strong>{p.bestInnings}</strong>best innings</div>
            </div>
          )}
        </div>
      </article>

      <section className="more-games" aria-labelledby="more-title">
        <h2 id="more-title">In the nets</h2>
        {rest.map((g) => (
          <div key={g.id} className="game-row" aria-disabled="true">
            <span className="game-row__dot" style={{ background: g.accent }} aria-hidden>{g.title[0]}</span>
            <div className="game-row__text">
              <h3>{g.title}</h3>
              <p>{g.pitch}</p>
            </div>
            <span className="soon">Coming soon</span>
          </div>
        ))}
      </section>
    </>
  );
}
