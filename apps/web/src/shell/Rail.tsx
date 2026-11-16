import { IconHelp, IconHome, IconGlobe, IconMute, IconSettings, IconSound, IconUser, href, prefs, profile } from '@plyo/core';

const ITEMS = [
  { id: 'home', to: '/', label: 'Play', Icon: IconHome },
  { id: 'online', to: '/online', label: 'Online', Icon: IconGlobe },
  { id: 'rules', to: '/rules', label: 'Rules', Icon: IconHelp },
  { id: 'profile', to: '/profile', label: 'Profile', Icon: IconUser },
  { id: 'settings', to: '/settings', label: 'Settings', Icon: IconSettings },
];

export function Wordmark() {
  return (
    <a className="wordmark" href={href('/')} aria-label="Plyo home">
      <span className="wordmark__cut" aria-hidden />
      Plyo
    </a>
  );
}

/** Desktop: vertical rail. Narrow screens: a top bar (same items). */
export function Rail({ section }: { section: string }) {
  const p = prefs.use();
  const me = profile.use();
  return (
    <nav className="rail" aria-label="Main">
      <Wordmark />
      <ul className="rail__list">
        {ITEMS.map(({ id, to, label, Icon }) => (
          <li key={id}>
            <a href={href(to)} aria-current={section === id ? 'page' : undefined}>
              <Icon />
              <span>{label}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="rail__foot">
        <button
          className="icon-btn"
          type="button"
          aria-pressed={!p.sound}
          aria-label={p.sound ? 'Mute sound' : 'Turn sound on'}
          onClick={() => prefs.set((x) => ({ ...x, sound: !x.sound }))}
        >
          {p.sound ? <IconSound /> : <IconMute />}
        </button>
        <a className="rail__me" href={href('/profile')}>
          <span className="rail__avatar" aria-hidden>{me.name.slice(0, 1).toUpperCase()}</span>
          <span>{me.name}</span>
        </a>
      </div>
    </nav>
  );
}
