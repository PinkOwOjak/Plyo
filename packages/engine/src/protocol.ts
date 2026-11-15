/**
 * Wire protocol between the Hand Cricket client and the multiplayer server.
 * The server is authoritative: it runs the same match reducer as the client
 * and never reveals a player's gesture until both have locked in.
 */
import type { Gesture } from '../engine/gestures.ts';
import type { CoinFace, MatchState, Side, TossDecision } from '../engine/match.ts';

export const PROTOCOL_VERSION = 1;
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const PICK_TIMEOUT_MS = 30_000;
export const RECONNECT_GRACE_MS = 45_000;
export const INNINGS_BREAK_MS = 8_000;

export type ClientMsg =
  | { t: 'hello'; v: number; name: string; resume?: { code: string; token: string } }
  | { t: 'create'; overs: number }
  | { t: 'join'; code: string }
  | { t: 'ready'; ready: boolean }
  | { t: 'call'; face: CoinFace }
  | { t: 'decide'; decision: TossDecision }
  | { t: 'pick'; gesture: Gesture; ball: number }
  | { t: 'next-innings' }
  | { t: 'rematch' }
  | { t: 'leave' }
  | { t: 'ping' };

export interface PlayerView {
  name: string;
  connected: boolean;
  ready: boolean;
  /** True once this player has locked in a gesture for the current ball. Never the gesture itself. */
  picked: boolean;
  wantsRematch: boolean;
}

export type RoomStage = 'lobby' | 'toss' | 'match' | 'abandoned';

export interface TossView {
  caller: Side;
  call: CoinFace | null;
  coin: CoinFace | null;
  winner: Side | null;
  decision: TossDecision | null;
}

export interface RoomView {
  code: string;
  you: Side;
  token: string;
  overs: number;
  players: [PlayerView | null, PlayerView | null];
  stage: RoomStage;
  toss: TossView;
  match: MatchState | null;
  /** Number of balls revealed so far in this match; used to order reveals. */
  seq: number;
  /** Epoch ms when an unpicked gesture is chosen automatically. */
  deadline: number | null;
  abandonedReason: string | null;
}

export type ErrorCode = 'not-found' | 'room-full' | 'bad-request' | 'version' | 'not-allowed' | 'server-busy';

export type ServerMsg =
  | { t: 'room'; room: RoomView }
  | { t: 'reveal'; seq: number; gestures: [Gesture, Gesture]; match: MatchState }
  | { t: 'left' }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong' };

/** Index of the next ball across the whole match, so stale picks are rejected. */
export function ballKey(match: MatchState): number {
  return match.innings.reduce((n, inn) => n + inn.balls.length, 0) + match.innings.length * 1000;
}

export function normaliseCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}
