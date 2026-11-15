import { Suspense, lazy, useEffect } from 'react';
import { IconGlobe, IconHome, IconSettings, IconUser, href, prefersReducedMotion, prefs, useRoute } from '@plyo/core';
import { Home } from './screens/Home.tsx';
import { Setup } from './screens/Setup.tsx';
import { Rules } from './screens/Rules.tsx';
import { ProfileScreen } from './screens/ProfileScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
// Match screens carry the 3D engine; load them on demand.
const OnlineScreen = lazy(() => import('./screens/OnlineScreen.tsx').then((m) => ({ default: m.OnlineScreen })));
const PlayLocal = lazy(() => import('./match/PlayLocal.tsx').then((m) => ({ default: m.PlayLocal })));

function Loading() {
  return (
    <div className="loading" role="status">
      <span className="m-mark" aria-hidden />
      Setting the field…
    </div>
  );
}

const TABS = [
  { id: 'home', to: '/', label: 'Play', Icon: IconHome },
  { id: 'online', to: '/online', label: 'Online', Icon: IconGlobe },
  { id: 'profile', to: '/profile', label: 'Profile', Icon: IconUser },
  { id: 'settings', to: '/settings', label: 'Settings', Icon: IconSettings },
];

function TabBar({ section }: { section: string }) {
  return (
    <nav className="tabs" aria-label="Main">
      {TABS.map(({ id, to, label, Icon }) => (
        <a key={id} href={href(to)} aria-current={section === id ? 'page' : undefined}>
          <Icon />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}

/**
 * Mobile routes (hash, works inside the native WebView):
 *   #/  #/setup  #/play/bot|pass|duel?…  #/online  #/rules  #/profile  #/settings
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
  if (a === 'play' && (b === 'bot' || b === 'pass' || b === 'duel'))
    return (
      <Suspense fallback={<Loading />}>
        <PlayLocal kind={b} query={route.query} />
      </Suspense>
    );
  if (a === 'online')
    return (
      <Suspense fallback={<Loading />}>
        <OnlineScreen query={route.query} tabs={<TabBar section="online" />} />
      </Suspense>
    );
  if (a === 'setup') return <Setup query={route.query} />;
  if (a === 'rules') return <Rules />;

  let page = <Home />;
  let section = 'home';
  if (a === 'profile') {
    page = <ProfileScreen />;
    section = 'profile';
  } else if (a === 'settings') {
    page = <SettingsScreen />;
    section = 'settings';
  }
  return (
    <div className="app">
      <main className="screen">{page}</main>
      <TabBar section={section} />
    </div>
  );
}
