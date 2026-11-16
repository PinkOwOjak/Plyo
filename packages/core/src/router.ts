/** Minimal hash router: "#/hand-cricket/play?mode=bot" → { path: ['hand-cricket','play'], query }. */
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string[];
  query: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean), query: new URLSearchParams(q) };
}

let current = parse(window.location.hash);
const listeners = new Set<() => void>();
window.addEventListener('hashchange', () => {
  current = parse(window.location.hash);
  listeners.forEach((l) => l());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = '#' + (to.startsWith('/') ? to : '/' + to);
  if (opts.replace) {
    window.history.replaceState(null, '', hash);
    current = parse(hash);
    listeners.forEach((l) => l());
  } else {
    window.location.hash = hash;
  }
}

export function href(to: string) {
  return '#' + (to.startsWith('/') ? to : '/' + to);
}
