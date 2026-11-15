/**
 * Room and match logic for online Hand Cricket, independent of the transport
 * so it can be unit-tested without sockets.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { ALL_GESTURES, isGesture, type Gesture } from '../src/games/hand-cricket/engine/gestures.ts';
import {
  MAX_OVERS,
  createMatch,
  other,
  reduceMatch,
  type CoinFace,
  type MatchState,
  type Side,
  type TossDecision,
} from '../src/games/hand-cricket/engine/match.ts';
import {
  INNINGS_BREAK_MS,
  PICK_TIMEOUT_MS,
  RECONNECT_GRACE_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ballKey,
  type ErrorCode,
  type RoomView,
  type ServerMsg,
  type TossView,
} from '../src/games/hand-cricket/net/protocol.ts';

export interface Connection {
  send(msg: ServerMsg): void;
}

interface Player {
  name: string;
  token: string;
  conn: Connection | null;
  ready: boolean;
  pick: Gesture | null;
  wantsRematch: boolean;
  wantsNextInnings: boolean;
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  overs: number;
  players: [Player | null, Player | null];
  stage: RoomView['stage'];
  toss: TossView;
  match: MatchState | null;
  seq: number;
  deadline: number | null;
  abandonedReason: string | null;
  lastActive: number;
  timers: Set<ReturnType<typeof setTimeout>>;
}

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  clearTimeout(t: ReturnType<typeof setTimeout>): void;
}

const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t),
};

export const MAX_ROOMS = 5000;

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  constructor(
    private clock: Clock = realClock,
    private random: () => number = () => randomInt(0, 2 ** 32) / 2 ** 32,
  ) {}

  private newCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError('server-busy', 'Could not allocate a room code. Try again.');
  }

  private newPlayer(name: string, conn: Connection): Player {
    return {
      name,
      token: randomBytes(16).toString('hex'),
      conn,
      ready: false,
      pick: null,
      wantsRematch: false,
      wantsNextInnings: false,
      disconnectedAt: null,
    };
  }

  create(name: string, overs: number, conn: Connection): { room: Room; side: Side } {
    if (this.rooms.size >= MAX_ROOMS) throw new RoomError('server-busy', 'The server is full right now. Try again soon.');
    if (!Number.isInteger(overs) || overs < 1 || overs > MAX_OVERS) throw new RoomError('bad-request', 'Choose between 1 and 20 overs.');
    const code = this.newCode();
    const room: Room = {
      code,
      overs,
      players: [this.newPlayer(name, conn), null],
      stage: 'lobby',
      toss: { caller: 1, call: null, coin: null, winner: null, decision: null },
      match: null,
      seq: 0,
      deadline: null,
      abandonedReason: null,
      lastActive: this.clock.now(),
      timers: new Set(),
    };
    this.rooms.set(code, room);
    this.broadcast(room);
    return { room, side: 0 };
  }

  join(code: string, name: string, conn: Connection): { room: Room; side: Side } {
    const room = this.rooms.get(code);
    if (!room || room.stage === 'abandoned') throw new RoomError('not-found', `No open room with code ${code}. Check the code with your friend.`);
    if (room.players[1]) throw new RoomError('room-full', 'That room already has two players.');
    room.players[1] = this.newPlayer(name, conn);
    room.lastActive = this.clock.now();
    this.broadcast(room);
    return { room, side: 1 };
  }

  resume(code: string, token: string, conn: Connection): { room: Room; side: Side } {
    const room = this.rooms.get(code);
    const side = room?.players.findIndex((p) => p?.token === token) ?? -1;
    if (!room || side < 0) throw new RoomError('not-found', 'That match is no longer available.');
    const p = room.players[side]!;
    p.conn = conn;
    p.disconnectedAt = null;
    room.lastActive = this.clock.now();
    this.broadcast(room);
    return { room, side: side as Side };
  }

  setReady(room: Room, side: Side, ready: boolean) {
    if (room.stage !== 'lobby') return;
    room.players[side]!.ready = ready;
    if (room.players.every((p) => p?.ready)) {
      room.stage = 'toss';
      room.toss = { caller: room.toss.caller, call: null, coin: null, winner: null, decision: null };
      room.match = createMatch({ overs: room.overs, names: [room.players[0]!.name, room.players[1]!.name] });
      room.seq = 0;
    }
    this.broadcast(room);
  }

  call(room: Room, side: Side, face: CoinFace) {
    if (room.stage !== 'toss' || room.toss.call !== null) throw new RoomError('not-allowed', 'The toss has already been called.');
    if (side !== room.toss.caller) throw new RoomError('not-allowed', 'It’s not your call.');
    const coin: CoinFace = this.random() < 0.5 ? 'heads' : 'tails';
    room.toss = { ...room.toss, call: face, coin, winner: face === coin ? side : other(side) };
    this.broadcast(room);
  }

  decide(room: Room, side: Side, decision: TossDecision) {
    if (room.stage !== 'toss' || room.toss.winner === null || room.toss.decision !== null)
      throw new RoomError('not-allowed', 'There is no toss decision to make.');
    if (side !== room.toss.winner) throw new RoomError('not-allowed', 'Only the toss winner decides.');
    room.toss = { ...room.toss, decision };
    room.match = reduceMatch(room.match!, {
      type: 'toss',
      caller: room.toss.caller,
      call: room.toss.call!,
      coin: room.toss.coin!,
      decision,
    });
    room.stage = 'match';
    this.startBall(room);
    this.broadcast(room);
  }

  private startBall(room: Room) {
    room.players.forEach((p) => {
      if (p) p.pick = null;
    });
    this.clearTimers(room);
    if (room.match?.phase !== 'playing') {
      room.deadline = null;
      return;
    }
    const key = ballKey(room.match);
    room.deadline = this.clock.now() + PICK_TIMEOUT_MS;
    this.addTimer(room, PICK_TIMEOUT_MS, () => {
      if (room.stage !== 'match' || !room.match || ballKey(room.match) !== key) return;
      // Pick for anyone who ran out of time, so the match keeps moving.
      room.players.forEach((p) => {
        if (p && !p.pick) p.pick = ALL_GESTURES[Math.floor(this.random() * ALL_GESTURES.length)];
      });
      this.resolveBall(room);
    });
  }

  pick(room: Room, side: Side, gesture: unknown, ball: unknown) {
    if (room.stage !== 'match' || room.match?.phase !== 'playing') throw new RoomError('not-allowed', 'No ball is being bowled.');
    if (!isGesture(gesture)) throw new RoomError('bad-request', 'That is not a valid hand.');
    if (ball !== ballKey(room.match)) return; // stale pick from a previous ball
    const p = room.players[side]!;
    if (p.pick) return;
    p.pick = gesture;
    if (room.players.every((x) => x?.pick)) this.resolveBall(room);
    else this.broadcast(room);
  }

  private resolveBall(room: Room) {
    const match = room.match!;
    const batting = match.innings[match.innings.length - 1].battingSide;
    const gestures: [Gesture, Gesture] = [room.players[0]!.pick!, room.players[1]!.pick!];
    room.match = reduceMatch(match, { type: 'ball', batting: gestures[batting], bowling: gestures[other(batting)] });
    room.seq++;
    room.lastActive = this.clock.now();
    room.players.forEach((p) => p?.conn?.send({ t: 'reveal', seq: room.seq, gestures, match: room.match! }));
    if (room.match.phase === 'innings-break') {
      room.players.forEach((p) => {
        if (p) {
          p.wantsNextInnings = false;
          p.pick = null;
        }
      });
      room.deadline = this.clock.now() + INNINGS_BREAK_MS;
      this.clearTimers(room);
      this.addTimer(room, INNINGS_BREAK_MS, () => this.nextInnings(room));
    } else {
      this.startBall(room);
    }
    this.broadcast(room);
  }

  requestNextInnings(room: Room, side: Side) {
    if (room.match?.phase !== 'innings-break') return;
    room.players[side]!.wantsNextInnings = true;
    if (room.players.every((p) => p?.wantsNextInnings)) this.nextInnings(room);
    else this.broadcast(room);
  }

  private nextInnings(room: Room) {
    if (room.match?.phase !== 'innings-break') return;
    room.match = reduceMatch(room.match, { type: 'next-innings' });
    this.startBall(room);
    this.broadcast(room);
  }

  rematch(room: Room, side: Side) {
    if (room.match?.phase !== 'complete' || room.stage !== 'match') throw new RoomError('not-allowed', 'The match is not over yet.');
    room.players[side]!.wantsRematch = true;
    if (room.players.every((p) => p?.wantsRematch)) {
      room.players.forEach((p) => {
        if (p) {
          p.wantsRematch = false;
          p.pick = null;
        }
      });
      room.stage = 'toss';
      room.toss = { caller: other(room.toss.caller), call: null, coin: null, winner: null, decision: null };
      room.match = createMatch({ overs: room.overs, names: [room.players[0]!.name, room.players[1]!.name] });
      room.seq = 0;
      room.deadline = null;
    }
    this.broadcast(room);
  }

  /** A player chose to leave. */
  leave(room: Room, side: Side) {
    const p = room.players[side];
    if (!p) return;
    p.conn = null;
    if (room.stage === 'lobby') {
      if (side === 0) this.close(room, `${p.name} closed the room.`);
      else {
        room.players[1] = null;
        room.players[0]!.ready = false;
        this.broadcast(room);
      }
      return;
    }
    if (room.match?.phase === 'complete') {
      this.close(room, `${p.name} left after the match.`);
      return;
    }
    this.abandon(room, `${p.name} left the match.`);
  }

  /** The socket dropped; give the player time to come back. */
  disconnected(room: Room, side: Side, conn: Connection) {
    const p = room.players[side];
    if (!p || p.conn !== conn) return;
    p.conn = null;
    p.disconnectedAt = this.clock.now();
    if (room.stage === 'abandoned') return;
    this.broadcast(room);
    this.clock.setTimeout(() => {
      if (p.conn === null && p.disconnectedAt !== null && room.stage !== 'abandoned') {
        if (room.stage === 'lobby' && side === 1) {
          room.players[1] = null;
          room.players[0]!.ready = false;
          this.broadcast(room);
        } else if (room.players.every((x) => !x?.conn)) {
          this.close(room, 'Both players left.');
        } else {
          this.abandon(room, `${p.name} lost connection and didn’t come back.`);
        }
      }
    }, RECONNECT_GRACE_MS);
  }

  private abandon(room: Room, reason: string) {
    room.stage = 'abandoned';
    room.abandonedReason = reason;
    room.deadline = null;
    this.clearTimers(room);
    this.broadcast(room);
    this.clock.setTimeout(() => this.rooms.delete(room.code), 60_000);
  }

  private close(room: Room, reason: string) {
    room.abandonedReason = reason;
    room.stage = 'abandoned';
    this.clearTimers(room);
    this.broadcast(room);
    this.rooms.delete(room.code);
  }

  /** Remove rooms nobody has touched for a while. */
  sweep(maxIdleMs = 30 * 60_000) {
    const now = this.clock.now();
    for (const room of this.rooms.values()) {
      const nobody = room.players.every((p) => !p?.conn);
      if (nobody && now - room.lastActive > 10 * 60_000) this.rooms.delete(room.code);
      else if (now - room.lastActive > maxIdleMs) this.close(room, 'The room timed out.');
    }
  }

  view(room: Room, side: Side): RoomView {
    return {
      code: room.code,
      you: side,
      token: room.players[side]!.token,
      overs: room.overs,
      players: room.players.map((p) =>
        p
          ? { name: p.name, connected: !!p.conn, ready: p.ready, picked: !!p.pick, wantsRematch: p.wantsRematch }
          : null,
      ) as RoomView['players'],
      stage: room.stage,
      toss: room.toss,
      match: room.match,
      seq: room.seq,
      deadline: room.deadline,
      abandonedReason: room.abandonedReason,
    };
  }

  broadcast(room: Room) {
    room.players.forEach((p, i) => p?.conn?.send({ t: 'room', room: this.view(room, i as Side) }));
  }

  private addTimer(room: Room, ms: number, fn: () => void) {
    const t = this.clock.setTimeout(() => {
      room.timers.delete(t);
      fn();
    }, ms);
    room.timers.add(t);
  }

  private clearTimers(room: Room) {
    room.timers.forEach((t) => this.clock.clearTimeout(t));
    room.timers.clear();
  }
}
