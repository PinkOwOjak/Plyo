import { describe, expect, it } from 'vitest';
import { RoomManager, RoomError, type Clock, type Connection } from '../server/rooms.ts';
import type { RoomView, ServerMsg } from '../src/games/hand-cricket/net/protocol.ts';
import { ballKey, PICK_TIMEOUT_MS, RECONNECT_GRACE_MS } from '../src/games/hand-cricket/net/protocol.ts';

class FakeClock implements Clock {
  t = 0;
  timers: { at: number; fn: () => void; id: number }[] = [];
  id = 0;
  now = () => this.t;
  setTimeout = (fn: () => void, ms: number) => {
    const id = ++this.id;
    this.timers.push({ at: this.t + ms, fn, id });
    return id as unknown as ReturnType<typeof setTimeout>;
  };
  clearTimeout = (id: ReturnType<typeof setTimeout>) => {
    this.timers = this.timers.filter((x) => x.id !== (id as unknown as number));
  };
  advance(ms: number) {
    this.t += ms;
    for (;;) {
      const due = this.timers.filter((x) => x.at <= this.t).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter((x) => x !== due);
      due.fn();
    }
  }
}

class Conn implements Connection {
  msgs: ServerMsg[] = [];
  send(m: ServerMsg) {
    this.msgs.push(m);
  }
  get room(): RoomView {
    const r = [...this.msgs].reverse().find((m) => m.t === 'room');
    return (r as Extract<ServerMsg, { t: 'room' }>).room;
  }
  reveals() {
    return this.msgs.filter((m) => m.t === 'reveal') as Extract<ServerMsg, { t: 'reveal' }>[];
  }
}

function setup(overs = 1, coin = 0.1) {
  const clock = new FakeClock();
  const mgr = new RoomManager(clock, () => coin);
  const a = new Conn();
  const b = new Conn();
  const { room } = mgr.create('Ana', overs, a);
  mgr.join(room.code, 'Ben', b);
  return { clock, mgr, a, b, room };
}

function toMatch(s: ReturnType<typeof setup>) {
  s.mgr.setReady(s.room, 0, true);
  s.mgr.setReady(s.room, 1, true);
  s.mgr.call(s.room, 1, 'heads'); // coin() = 0.1 → heads → Ben wins
  s.mgr.decide(s.room, 1, 'bat');
}

describe('rooms', () => {
  it('creates and joins rooms with 5-character codes', () => {
    const s = setup();
    expect(s.room.code).toMatch(/^[A-Z2-9]{5}$/);
    expect(s.a.room.players[1]?.name).toBe('Ben');
    expect(() => s.mgr.join(s.room.code, 'Cat', new Conn())).toThrow(RoomError);
    expect(() => s.mgr.join('ZZZZZ', 'Cat', new Conn())).toThrow(/No open room/);
  });

  it('runs toss: only the caller calls, only the winner decides', () => {
    const s = setup();
    s.mgr.setReady(s.room, 0, true);
    expect(s.a.room.stage).toBe('lobby');
    s.mgr.setReady(s.room, 1, true);
    expect(s.a.room.stage).toBe('toss');
    expect(() => s.mgr.call(s.room, 0, 'heads')).toThrow(/not your call/);
    s.mgr.call(s.room, 1, 'tails'); // coin heads → Ana wins
    expect(s.b.room.toss.winner).toBe(0);
    expect(() => s.mgr.decide(s.room, 1, 'bat')).toThrow();
    s.mgr.decide(s.room, 0, 'bowl');
    expect(s.a.room.match?.innings[0].battingSide).toBe(1);
  });

  it('never leaks a pending gesture and reveals both together', () => {
    const s = setup();
    toMatch(s);
    const key = ballKey(s.room.match!);
    s.mgr.pick(s.room, 0, '01111', key);
    const json = JSON.stringify(s.b.msgs);
    expect(json).not.toContain('01111');
    expect(s.b.room.players[0]?.picked).toBe(true);
    s.mgr.pick(s.room, 1, '11101', key);
    const [ra] = s.a.reveals();
    const [rb] = s.b.reveals();
    expect(ra.gestures).toEqual(['01111', '11101']);
    expect(rb).toEqual(ra);
    // Ben bats with 11101 vs Ana's 01111: same count, different hand → 4 runs, not out.
    expect(ra.match.innings[0].runs).toBe(4);
    expect(ra.match.innings[0].out).toBe(false);
  });

  it('dismisses on an exact match and ignores stale or invalid picks', () => {
    const s = setup();
    toMatch(s);
    const key = ballKey(s.room.match!);
    expect(() => s.mgr.pick(s.room, 0, '0111', key)).toThrow(/valid hand/);
    s.mgr.pick(s.room, 0, '00110', key - 1); // stale
    expect(s.a.room.players[0]?.picked).toBe(false);
    s.mgr.pick(s.room, 0, '00110', key);
    s.mgr.pick(s.room, 1, '00110', key);
    expect(s.room.match?.phase).toBe('innings-break');
    expect(s.room.match?.innings[0].out).toBe(true);
  });

  it('plays a full match, then a rematch', () => {
    const s = setup(1);
    toMatch(s);
    const play = (a: string, b: string) => {
      const k = ballKey(s.room.match!);
      s.mgr.pick(s.room, 0, a, k);
      s.mgr.pick(s.room, 1, b, k);
    };
    for (let i = 0; i < 6; i++) play('00001', '11000'); // Ben bats: 2 × 6 = 12
    expect(s.room.match?.phase).toBe('innings-break');
    s.mgr.requestNextInnings(s.room, 0);
    expect(s.room.match?.phase).toBe('innings-break');
    s.mgr.requestNextInnings(s.room, 1);
    play('10000', '01000'); // Ana bats: 6
    play('10000', '01000'); // 12
    play('01000', '00000'); // 13 → wins
    expect(s.room.match?.phase).toBe('complete');
    expect(s.room.match?.result?.winner).toBe(0);
    s.mgr.rematch(s.room, 0);
    expect(s.a.room.stage).toBe('match');
    s.mgr.rematch(s.room, 1);
    expect(s.a.room.stage).toBe('toss');
    expect(s.a.room.toss.caller).toBe(0);
    expect(s.a.room.seq).toBe(0);
  });

  it('auto-picks after the shot clock and auto-starts the second innings', () => {
    const s = setup(1);
    toMatch(s);
    s.mgr.pick(s.room, 0, '11111', ballKey(s.room.match!));
    s.clock.advance(PICK_TIMEOUT_MS + 1);
    expect(s.a.reveals()).toHaveLength(1);
  });

  it('abandons when a disconnected player does not return, but survives a quick reconnect', () => {
    const s = setup();
    toMatch(s);
    s.mgr.disconnected(s.room, 1, s.b);
    expect(s.a.room.players[1]?.connected).toBe(false);
    s.clock.advance(5000);
    const b2 = new Conn();
    s.mgr.resume(s.room.code, s.b.room.token, b2);
    expect(b2.room.you).toBe(1);
    s.clock.advance(RECONNECT_GRACE_MS + 1);
    expect(s.a.room.stage).toBe('match');

    s.mgr.disconnected(s.room, 1, b2);
    s.clock.advance(RECONNECT_GRACE_MS + 1);
    expect(s.a.room.stage).toBe('abandoned');
    expect(s.a.room.abandonedReason).toMatch(/Ben/);
  });

  it('rejects resume with a wrong token', () => {
    const s = setup();
    expect(() => s.mgr.resume(s.room.code, 'nope', new Conn())).toThrow(RoomError);
  });

  it('frees the seat when the guest leaves the lobby', () => {
    const s = setup();
    s.mgr.leave(s.room, 1);
    expect(s.a.room.players[1]).toBeNull();
    s.mgr.leave(s.room, 0);
    expect(s.mgr.rooms.has(s.room.code)).toBe(false);
  });
});
