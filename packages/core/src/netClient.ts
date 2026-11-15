/**
 * Browser client for the multiplayer server, with automatic reconnection and
 * seat resumption (a dropped connection rejoins the same match).
 */
import { PROTOCOL_VERSION, type ClientMsg, type RoomView, type ServerMsg } from './protocol.ts';
import { prefs } from '../../../platform/prefs.ts';

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'offline';

const SEAT_KEY = 'plyo.online.seat';

export function serverUrl(): string {
  const custom = prefs.get().serverUrl;
  if (custom) return custom;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

function loadSeat(): { code: string; token: string } | null {
  try {
    const raw = sessionStorage.getItem(SEAT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSeat(seat: { code: string; token: string } | null) {
  try {
    if (seat) sessionStorage.setItem(SEAT_KEY, JSON.stringify(seat));
    else sessionStorage.removeItem(SEAT_KEY);
  } catch {
    // Session storage unavailable: resuming after reload won't work, play still does.
  }
}

export interface ClientEvents {
  onStatus(s: ConnStatus): void;
  onRoom(r: RoomView | null): void;
  onReveal(m: Extract<ServerMsg, { t: 'reveal' }>): void;
  onError(message: string, code: string): void;
}

export class OnlineClient {
  private ws: WebSocket | null = null;
  private closed = false;
  private attempts = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private queue: ClientMsg[] = [];
  private name: string;
  private events: ClientEvents;
  readonly url: string;

  constructor(name: string, events: ClientEvents) {
    this.name = name;
    this.events = events;
    this.url = serverUrl();
    this.connect();
  }

  private connect() {
    this.events.onStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.events.onStatus('offline');
      this.events.onError(`The server address “${this.url}” is not valid. Check it in Settings.`, 'bad-url');
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.attempts = 0;
      this.events.onStatus('open');
      const seat = loadSeat();
      ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, name: this.name, resume: seat ?? undefined } satisfies ClientMsg));
      this.queue.splice(0).forEach((m) => ws.send(JSON.stringify(m)));
    };
    ws.onmessage = (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      switch (msg.t) {
        case 'room':
          if (msg.room.stage === 'abandoned') saveSeat(null);
          else saveSeat({ code: msg.room.code, token: msg.room.token });
          this.events.onRoom(msg.room);
          break;
        case 'reveal':
          this.events.onReveal(msg);
          break;
        case 'left':
          saveSeat(null);
          this.events.onRoom(null);
          break;
        case 'error':
          if (msg.code === 'not-found') saveSeat(null);
          this.events.onError(msg.message, msg.code);
          break;
      }
    };
    ws.onclose = () => {
      if (this.closed) return;
      this.attempts++;
      if (this.attempts > 8) {
        this.events.onStatus('offline');
        return;
      }
      this.events.onStatus(this.attempts > 2 ? 'offline' : 'reconnecting');
      this.retry = setTimeout(() => this.connect(), Math.min(8000, 600 * 2 ** this.attempts));
    };
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }

  retryNow() {
    if (this.retry) clearTimeout(this.retry);
    this.attempts = 0;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.connect();
  }

  close() {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    this.ws?.close();
  }

  static forgetSeat() {
    saveSeat(null);
  }
}
