import type { ReactNode } from 'react';
import { href } from '../platform/router.ts';
import { IconPlay, IconSettings, IconUser } from './icons.tsx';

export function Wordmark() {
  return (
    <a className="wordmark" href={href('/')} aria-label="Plyo home">
      Plyo<span className="wordmark__ball" aria-hidden />
    </a>
  );
}

const TABS = [
  { to: '/', label: 'Games', Icon: IconPlay, match: (p: string) => p === '' },
  { to: '/profile', label: 'Profile', Icon: IconUser, match: (p: string) => p === 'profile' },
  { to: '/settings', label: 'Settings', Icon: IconSettings, match: (p: string) => p === 'settings' },
];

export function Shell({ section, children }: { section: string; children: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Wordmark />
      </header>
      <main className="page" id="main">
        {children}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map(({ to, label, Icon, match }) => (
          <a key={to} href={href(to)} aria-current={match(section) ? 'page' : undefined}>
            <Icon />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}

export function TopBar({ title, back, actions }: { title: string; back?: string; actions?: ReactNode }) {
  return (
    <header className="topbar">
      {back !== undefined && (
        <a className="icon-btn" href={href(back)} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
      )}
      <h1 className="topbar__title">{title}</h1>
      {actions}
    </header>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
  );
}
