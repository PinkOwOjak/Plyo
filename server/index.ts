/**
 * Plyo multiplayer server: a WebSocket endpoint at /ws for Hand Cricket rooms.
 * In production it also serves the built web app from ./dist.
 *
 *   PORT          HTTP port (default 8787)
 *   PLYO_ORIGINS  optional comma-separated list of allowed browser origins
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { PROTOCOL_VERSION, normaliseCode, type ClientMsg, type ServerMsg, type Side } from '@plyo/engine';
import { RoomError, RoomManager, type Connection, type Room } from './rooms.ts';

const PORT = Number(process.env.PORT ?? process.env.PLYO_SERVER_PORT ?? 8787);
const DIST = resolve(process.cwd(), process.env.PLYO_DIST ?? 'apps/web/dist');
const ORIGINS = (process.env.PLYO_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const MAX_MESSAGE_BYTES = 2048;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.json': 'application/json',
};

const rooms = new RoomManager();

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.rooms.size, protocol: PROTOCOL_VERSION }));
    return;
  }
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Plyo game server is running. Build the web app (npm run build) to serve it from here.');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  const ext = extname(file);
  res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': file.startsWith(join(DIST, 'assets')) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

const http = createServer(serveStatic);
const wss = new WebSocketServer({
  server: http,
  path: '/ws',
  maxPayload: MAX_MESSAGE_BYTES,
  verifyClient: ({ origin }: { origin?: string }) => ORIGINS.length === 0 || (!!origin && ORIGINS.includes(origin)),
});

function cleanName(raw: unknown) {
  const n = typeof raw === 'string' ? [...raw].filter((ch) => ch.charCodeAt(0) >= 32).join('').replace(/\s+/g, ' ').trim().slice(0, 16) : '';
  return n || 'Player';
}

wss.on('connection', (socket: WebSocket & { alive?: boolean }) => {
  socket.alive = true;
  socket.on('pong', () => (socket.alive = true));

  const conn: Connection = {
    send(msg: ServerMsg) {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
    },
  };
  let name = 'Player';
  let seat: { room: Room; side: Side } | null = null;
  let greeted = false;

  const fail = (e: unknown) => {
    if (e instanceof RoomError) conn.send({ t: 'error', code: e.code, message: e.message });
    else {
      console.error(e);
      conn.send({ t: 'error', code: 'bad-request', message: 'Something went wrong handling that request.' });
    }
  };

  socket.on('message', (data) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(data));
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') throw new Error();
    } catch {
      conn.send({ t: 'error', code: 'bad-request', message: 'Malformed message.' });
      return;
    }
    try {
      if (msg.t === 'ping') return conn.send({ t: 'pong' });
      if (msg.t === 'hello') {
        if (msg.v !== PROTOCOL_VERSION) throw new RoomError('version', 'Your app is out of date. Reload the page.');
        name = cleanName(msg.name);
        greeted = true;
        if (msg.resume) seat = rooms.resume(normaliseCode(String(msg.resume.code)), String(msg.resume.token), conn);
        return;
      }
      if (!greeted) throw new RoomError('bad-request', 'Say hello first.');
      if (msg.t === 'create' || msg.t === 'join') {
        if (seat) rooms.leave(seat.room, seat.side);
        seat =
          msg.t === 'create'
            ? rooms.create(name, msg.overs, msg.outMode, conn)
            : rooms.join(normaliseCode(String(msg.code)), name, conn);
        return;
      }
      if (!seat) throw new RoomError('not-allowed', 'Join a room first.');
      const { room, side } = seat;
      switch (msg.t) {
        case 'set-rules':
          return rooms.setRules(room, side, msg.overs, msg.outMode);
        case 'ready':
          return rooms.setReady(room, side, !!msg.ready);
        case 'call':
          return rooms.call(room, side, msg.face === 'tails' ? 'tails' : 'heads');
        case 'decide':
          return rooms.decide(room, side, msg.decision === 'bowl' ? 'bowl' : 'bat');
        case 'pick':
          return rooms.pick(room, side, msg.gesture, msg.ball);
        case 'next-innings':
          return rooms.requestNextInnings(room, side);
        case 'rematch':
          return rooms.rematch(room, side);
        case 'leave':
          rooms.leave(room, side);
          seat = null;
          return conn.send({ t: 'left' });
        default:
          throw new RoomError('bad-request', 'Unknown message.');
      }
    } catch (e) {
      fail(e);
    }
  });

  socket.on('close', () => {
    if (seat) rooms.disconnected(seat.room, seat.side, conn);
  });
});

// Drop dead sockets and stale rooms.
setInterval(() => {
  for (const ws of wss.clients as Set<WebSocket & { alive?: boolean }>) {
    if (ws.alive === false) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
  rooms.sweep();
}, 15_000).unref();

http.listen(PORT, () => {
  console.log(`Plyo server listening on http://localhost:${PORT} (WebSocket at /ws)`);
});
