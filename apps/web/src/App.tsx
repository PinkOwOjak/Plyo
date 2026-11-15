import { Suspense, useEffect } from 'react';
import { findGame } from './platform/games.ts';
import { prefersReducedMotion, prefs } from './platform/prefs.ts';
import { useRoute } from './platform/router.ts';
import { Lobby } from './screens/Lobby.tsx';
import { ProfileScreen } from './screens/ProfileScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { Shell } from './shell/Shell.tsx';

function Loading() {
  return (
    <div className="loading" role="status">
      <span className="wordmark__ball loading__ball" aria-hidden />
      Loading game…
    </div>
  );
}

export function App() {
  const route = useRoute();
  const p = prefs.use();
  const reduced = prefersReducedMotion(p);

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', reduced);
  }, [reduced]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  const [first] = route.path;
  if (first === 'profile') return <Shell section="profile"><ProfileScreen /></Shell>;
  if (first === 'settings') return <Shell section="settings"><SettingsScreen /></Shell>;

  const game = findGame(first);
  if (game?.Component) {
    const Game = game.Component;
    return (
      <Suspense fallback={<Loading />}>
        <Game route={route} />
      </Suspense>
    );
  }
  return (
    <Shell section="">
      <Lobby />
    </Shell>
  );
}
