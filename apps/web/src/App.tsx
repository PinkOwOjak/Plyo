import { Suspense, lazy, useEffect } from 'react';
import { prefersReducedMotion, prefs, useRoute } from '@plyo/core';
import { Rail } from './shell/Rail.tsx';
import { Home } from './screens/Home.tsx';
import { Setup } from './screens/Setup.tsx';
import { Rules } from './screens/Rules.tsx';
import { ProfileScreen } from './screens/ProfileScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
// Match screens carry the 3D engine; load them only when a match starts.
const OnlineScreen = lazy(() => import('./screens/OnlineScreen.tsx').then((m) => ({ default: m.OnlineScreen })));
const LocalMatch = lazy(() => import('./match/LocalMatch.tsx').then((m) => ({ default: m.LocalMatch })));

function Loading() {
  return (
    <div className="loading" role="status">
      <span className="wordmark__cut" aria-hidden />
      Setting the field…
    </div>
  );
}

/**
 * Routes (hash):
 *   #/                         home + library
 *   #/play/hand-cricket        match setup
 *   #/match/bot|pass?…         local matches (full screen)
 *   #/online                   rooms and online matches
 *   #/rules  #/profile  #/settings
 */
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

  const [a, b] = route.path;
  if (a === 'match' && (b === 'bot' || b === 'pass'))
    return (
      <Suspense fallback={<Loading />}>
        <LocalMatch kind={b} query={route.query} />
      </Suspense>
    );
  if (a === 'online')
    return (
      <Suspense fallback={<Loading />}>
        <OnlineScreen query={route.query} />
      </Suspense>
    );

  let page = <Home />;
  let section = 'home';
  if (a === 'play') {
    page = <Setup query={route.query} />;
    section = 'home';
  } else if (a === 'rules') {
    page = <Rules />;
    section = 'rules';
  } else if (a === 'profile') {
    page = <ProfileScreen />;
    section = 'profile';
  } else if (a === 'settings') {
    page = <SettingsScreen />;
    section = 'settings';
  }
  return (
    <div className="frame">
      <Rail section={section} />
      <main className="content" id="main">
        {page}
      </main>
    </div>
  );
}
