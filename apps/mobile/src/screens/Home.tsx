import { useState } from 'react';
import { GAMES, IconBot, IconGlobe, IconUsers, haptic, href, profile, type GameMeta } from '@plyo/core';
import sixArt from '@plyo/tokens/art/hand-six.webp';
import oddEvenArt from '@plyo/tokens/art/odd-even.svg';
import paperArt from '@plyo/tokens/art/paper-duel.svg';
import dotsArt from '@plyo/tokens/art/dots.svg';

const ART: Record<string, string> = { 'hand-cricket': sixArt, 'odd-even': oddEvenArt, 'paper-duel': paperArt, dots: dotsArt };

type Way = 'solo' | 'sameDevice' | 'online';
const WAYS: { id: Way; label: string; sub: string; Icon: typeof IconBot }[] = [
  { id: 'solo', label: 'Solo', sub: 'vs bot', Icon: IconBot },
  { id: 'sameDevice', label: 'Two players', sub: 'this phone', Icon: IconUsers },
  { id: 'online', label: 'Online', sub: 'with a code', Icon: IconGlobe },
];

function startHref(g: GameMeta, way: Way) {
  if (way === 'online') return href('/online');
  return href(`/setup?game=${g.id}&way=${way}`);
}

export function Home() {
  const me = profile.use();
  const [way, setWay] = useState<Way>('solo');
  const games = GAMES.filter((g) => g.players[way]);
  const featured = games.find((g) => g.status === 'playable');

  return (
    <div className="home">
      <header className="m-head">
        <span className="m-mark" aria-hidden />
        <h1>Plyo</h1>
        <span className="m-head__me">{me.name}</span>
      </header>

      <h2 className="m-label">How are you playing?</h2>
      <div className="ways" role="radiogroup" aria-label="How are you playing">
        {WAYS.map(({ id, label, sub, Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={way === id}
            className="way"
            onClick={() => {
              haptic('select');
              setWay(id);
            }}
          >
            <Icon />
            <strong>{label}</strong>
            <span>{sub}</span>
          </button>
        ))}
      </div>

      {featured && (
        <a className="feature" href={startHref(featured, way)}>
          <img className="feature__art" src={ART[featured.id]} alt="" />
          <span className="feature__body">
            <strong>{featured.title}</strong>
            <span>{featured.pitch}</span>
            <span className="feature__cta">{way === 'online' ? 'Open rooms' : 'Set up a match'}</span>
          </span>
        </a>
      )}

      <h2 className="m-label">More games</h2>
      <ul className="m-list">
        {games
          .filter((g) => g !== featured)
          .map((g) => (
            <li key={g.id} className="m-game" aria-disabled="true">
              <img src={ART[g.id]} alt="" />
              <span>
                <strong>{g.title}</strong>
                <span>{g.pitch}</span>
              </span>
              <em>Soon</em>
            </li>
          ))}
        {games.length <= 1 && <li className="m-empty">More games for this way of playing are on the way.</li>}
      </ul>
    </div>
  );
}
