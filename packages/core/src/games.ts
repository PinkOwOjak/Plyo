/**
 * Game registry. The lobby only knows this metadata; each game's code lives
 * in its own module and is loaded on demand.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Route } from './router.ts';

export interface GameProps {
  route: Route;
}

export interface GameEntry {
  id: string;
  title: string;
  pitch: string;
  modes: string[];
  status: 'playable' | 'coming-soon';
  accent: string;
  Component?: LazyExoticComponent<ComponentType<GameProps>>;
}

export const GAMES: GameEntry[] = [
  {
    id: 'hand-cricket',
    title: 'Hand Cricket',
    pitch: 'Show fingers, score runs. Match your opponent’s exact hand and you’re out.',
    modes: ['vs Bot', 'Pass & play', 'Online'],
    status: 'playable',
    accent: '#c83a2c',
    Component: lazy(() => import('../games/hand-cricket/HandCricketGame.tsx')),
  },
  {
    id: 'odd-even',
    title: 'Odd or Even',
    pitch: 'Call odd or even, throw fingers together, and win the toss of the century.',
    modes: ['vs Bot', 'Online'],
    status: 'coming-soon',
    accent: '#f4c54a',
  },
  {
    id: 'rps-duel',
    title: 'Paper Duel',
    pitch: 'Rock, paper, scissors with streaks, power-ups and best-of-seven duels.',
    modes: ['vs Bot', 'Online'],
    status: 'coming-soon',
    accent: '#5aa7d6',
  },
  {
    id: 'dots',
    title: 'Dots & Boxes',
    pitch: 'Draw lines, close boxes, steal the board on a single turn.',
    modes: ['Pass & play'],
    status: 'coming-soon',
    accent: '#8fbf6a',
  },
];

export const findGame = (id: string | undefined) => GAMES.find((g) => g.id === id);
