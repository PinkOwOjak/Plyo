import { useState } from 'react';
import { GAMES, href, profile, type GameMeta } from '@plyo/core';
import sixArt from '@plyo/tokens/art/hand-six.webp';
import oddEvenArt from '@plyo/tokens/art/odd-even.svg';
import paperArt from '@plyo/tokens/art/paper-duel.svg';
import dotsArt from '@plyo/tokens/art/dots.svg';

const ART: Record<string, string> = { 'hand-cricket': sixArt, 'odd-even': oddEvenArt, 'paper-duel': paperArt, dots: dotsArt };

type Filter = 'all' | 'solo' | 'sameDevice' | 'online';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All games' },
  { id: 'solo', label: 'Solo vs bot' },
  { id: 'sameDevice', label: 'Two on one screen' },
  { id: 'online', label: 'Online' },
];

function Tile({ g }: { g: GameMeta }) {
  const playable = g.status === 'playable';
  const body = (
    <>
      <span className={`tile__art${g.id === 'hand-cricket' ? ' tile__art--hand' : ''}`}>
        <img src={ART[g.id]} alt="" loading="lazy" />
      </span>
      <span className="tile__body">
        <span className="tile__title">{g.title}</span>
        <span className="tile__pitch">{g.pitch}</span>
        <span className="tile__ways">
          {[g.players.solo && 'Bot', g.players.sameDevice && 'Same screen', g.players.online && 'Online'].filter(Boolean).join(' / ')}
        </span>
      </span>
      {!playable && <span className="tile__soon">In development</span>}
    </>
  );
  return playable ? (
    <a className="tile" href={href(`/play/${g.id}`)}>
      {body}
    </a>
  ) : (
    <div className="tile tile--soon" aria-disabled="true">
      {body}
    </div>
  );
}

export function Home() {
  const me = profile.use();
  const [filter, setFilter] = useState<Filter>('all');
  const games = GAMES.filter((g) => filter === 'all' || g.players[filter]);
  const played = me.stats.bot.played + me.stats.local.played + me.stats.online.played;

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-h">
        <div className="hero__text">
          <h1 id="hero-h" className="hero__title">
            Hand
            <br />
            Cricket
          </h1>
          <p className="hero__lede">
            Raise fingers to score. Thumb alone is a six. Match the batter’s hand and the wicket falls. Play the bot, a friend beside you, or a
            friend online.
          </p>
          <div className="hero__actions">
            <a className="btn btn--primary btn--lg" href={href('/play/hand-cricket?mode=bot')}>Play the bot</a>
            <a className="btn btn--line btn--lg" href={href('/play/hand-cricket?mode=pass')}>Two players</a>
            <a className="btn btn--line btn--lg" href={href('/online')}>Online room</a>
          </div>
          {played > 0 && (
            <dl className="hero__stats">
              <div><dt>Matches</dt><dd>{played}</dd></div>
              <div><dt>Best innings</dt><dd>{me.bestInnings}</dd></div>
              <div><dt>Sixes</dt><dd>{me.sixes}</dd></div>
            </dl>
          )}
        </div>
        <figure className="hero__art">
          <img src={sixArt} alt="A 3D hand showing a thumbs-up, the six in Hand Cricket" />
          <figcaption>
            <span className="code">10000</span> Thumb only scores six
          </figcaption>
        </figure>
      </section>

      <section className="library" aria-labelledby="lib-h">
        <div className="library__head">
          <h2 id="lib-h">Library</h2>
          <div className="filters" role="radiogroup" aria-label="Filter games">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="tiles">
          {games.map((g) => (
            <Tile key={g.id} g={g} />
          ))}
        </div>
      </section>
    </div>
  );
}
