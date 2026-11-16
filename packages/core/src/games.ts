/**
 * Game catalogue: metadata only. Each app decides how to present and load a
 * game; no game logic lives here.
 */
export type PlayerCount = 1 | 2;

export interface GameMeta {
  id: string;
  title: string;
  pitch: string;
  /** Ways to play, used by the lobby filters. */
  players: { solo: boolean; sameDevice: boolean; online: boolean };
  status: 'playable' | 'coming-soon';
}

export const GAMES: GameMeta[] = [
  {
    id: 'hand-cricket',
    title: 'Hand Cricket',
    pitch: 'Raise fingers to score runs. Match the batter’s hand to take the wicket.',
    players: { solo: true, sameDevice: true, online: true },
    status: 'playable',
  },
  {
    id: 'odd-even',
    title: 'Odd or Even',
    pitch: 'Call it, throw fingers together, and see who reads the other better.',
    players: { solo: true, sameDevice: true, online: true },
    status: 'coming-soon',
  },
  {
    id: 'paper-duel',
    title: 'Paper Duel',
    pitch: 'Rock, paper, scissors with streaks and best-of-seven duels.',
    players: { solo: true, sameDevice: true, online: true },
    status: 'coming-soon',
  },
  {
    id: 'dots',
    title: 'Dots & Boxes',
    pitch: 'Draw lines, close boxes, steal the board in a single turn.',
    players: { solo: false, sameDevice: true, online: false },
    status: 'coming-soon',
  },
];

export const findGame = (id: string | undefined) => GAMES.find((g) => g.id === id);
