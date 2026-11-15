/**
 * End-to-end: start the real server and play a short match with two
 * WebSocket clients.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ClientMsg, RoomView, ServerMsg } from '@plyo/engine';
import { PROTOCOL_VERSION, ballKey } from '@plyo/engine';

const PORT = 18000 + Math.floor(Math.random() * 1000);
let server: ChildProcess;

beforeAll(async () => {
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 15000);
    server.stdout!.on('data', (d) => {
      if (String(d).includes('listening')) {
        clearTimeout(t);
        resolve();
      }
    });
  });
}, 20000);

afterAll(() => {
  server?.kill();
});

class Client {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  waiters: { pred: (m: ServerMsg) => boolean; resolve: (m: ServerMsg) => void }[] = [];
  constructor() {
    this.ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMsg;
      this.msgs.push(m);
      this.waiters = this.waiters.filter((w) => (w.pred(m) ? (w.resolve(m), false) : true));
    });
  }
  open() {
    return new Promise<void>((r) => this.ws.once('open', () => r()));
  }
  send(m: ClientMsg) {
    this.ws.send(JSON.stringify(m));
  }
  next(pred: (m: ServerMsg) => boolean): Promise<ServerMsg> {
    const found = this.msgs.find(pred);
    if (found) {
      this.msgs = this.msgs.filter((m) => m !== found);
      return Promise.resolve(found);
    }
    return new Promise((resolve) => this.waiters.push({ pred, resolve }));
  }
  room(pred: (r: RoomView) => boolean) {
    return this.next((m) => m.t === 'room' && pred(m.room)).then((m) => (m as Extract<ServerMsg, { t: 'room' }>).room);
  }
}

describe('multiplayer server', () => {
  it('serves health', async () => {
    const res = await fetch(`http://localhost:${PORT}/health`);
    expect(await res.json()).toMatchObject({ ok: true, protocol: PROTOCOL_VERSION });
  });

  it('plays a match between two sockets', async () => {
    const a = new Client();
    const b = new Client();
    await Promise.all([a.open(), b.open()]);
    a.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Ana' });
    b.send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Ben' });
    a.send({ t: 'create', overs: 1, outMode: 'exact' });
    const created0 = await a.room(() => true);
    expect(created0.outMode).toBe('exact');
    const created = created0;
    b.send({ t: 'join', code: created.code.toLowerCase() });
    await b.room((r) => r.players[0]?.name === 'Ana');
    a.send({ t: 'ready', ready: true });
    b.send({ t: 'ready', ready: true });
    await a.room((r) => r.stage === 'toss');
    b.send({ t: 'call', face: 'heads' });
    const tossed = await a.room((r) => r.toss.winner !== null);
    const winner = tossed.toss.winner!;
    (winner === 0 ? a : b).send({ t: 'decide', decision: 'bat' });
    let room = await a.room((r) => r.stage === 'match');
    expect(room.match?.innings[0].battingSide).toBe(winner);

    // Ball 1: same count, different fingers → runs, not out.
    a.send({ t: 'pick', gesture: '01111', ball: ballKey(room.match!) });
    b.send({ t: 'pick', gesture: '11101', ball: ballKey(room.match!) });
    const r1 = (await b.next((m) => m.t === 'reveal')) as Extract<ServerMsg, { t: 'reveal' }>;
    expect(r1.gestures).toEqual(['01111', '11101']);
    expect(r1.match.innings[0].runs).toBe(4);
    expect(r1.match.innings[0].out).toBe(false);
    const r1a = (await a.next((m) => m.t === 'reveal')) as Extract<ServerMsg, { t: 'reveal' }>;
    expect(r1a.seq).toBe(1);

    // Ball 2: identical hands → out.
    room = await a.room((r) => r.seq === 1);
    a.send({ t: 'pick', gesture: '00111', ball: ballKey(room.match!) });
    b.send({ t: 'pick', gesture: '00111', ball: ballKey(room.match!) });
    const r2 = (await a.next((m) => m.t === 'reveal')) as Extract<ServerMsg, { t: 'reveal' }>;
    expect(r2.match.phase).toBe('innings-break');

    // Bad input is rejected with a clear error.
    a.send({ t: 'pick', gesture: 'xxxxx', ball: 0 } as unknown as ClientMsg);
    const err = await a.next((m) => m.t === 'error');
    expect(err).toMatchObject({ t: 'error' });

    a.send({ t: 'leave' });
    await a.next((m) => m.t === 'left');
    const abandoned = await b.room((r) => r.stage === 'abandoned');
    expect(abandoned.abandonedReason).toMatch(/Ana/);
    a.ws.close();
    b.ws.close();
  }, 20000);
});
