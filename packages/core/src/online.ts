/**
 * Online play: wraps the reconnecting client and exposes the room plus a
 * MatchSession once the match starts. The server is authoritative.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ballKey, other, type CoinFace, type Gesture, type MatchState, type OutMode, type RoomView, type Side, type TossDecision } from '@plyo/engine';
import { OnlineClient, type ConnStatus } from './netClient.ts';
import { useRecordResult, type MatchSession, type Reveal } from './session.ts';

export interface OnlineControls {
  status: ConnStatus;
  room: RoomView | null;
  error: string | null;
  url: string;
  create: (overs: number, outMode: OutMode) => void;
  join: (code: string) => void;
  setRules: (overs: number, outMode: OutMode) => void;
  setReady: (ready: boolean) => void;
  leave: () => void;
  retry: () => void;
  /** Present once the toss stage starts. */
  session: MatchSession | null;
  /** Epoch ms when the server auto-picks or auto-starts the next innings. */
  deadline: number | null;
}

const NONE: Side[] = [];
const noop = () => {};

export function useOnline(name: string): OnlineControls {
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [shown, setShown] = useState<MatchState | null>(null);
  const [matchNo, setMatchNo] = useState(1);
  const client = useRef<OnlineClient | null>(null);
  const animated = useRef(0);
  const revealRef = useRef<Reveal | null>(null);
  const roomRef = useRef<RoomView | null>(null);

  useEffect(() => {
    const c = new OnlineClient(name, {
      onStatus: setStatus,
      onRoom: (r) => {
        const prev = roomRef.current;
        roomRef.current = r;
        setRoom(r);
        if (r) setError(null);
        if (!r?.match) {
          setShown(null);
          return;
        }
        if (prev && prev.seq > 0 && r.seq === 0) {
          animated.current = 0;
          setMatchNo((n) => n + 1);
        }
        if (!revealRef.current && r.seq >= animated.current) {
          animated.current = r.seq;
          setShown(r.match);
        }
      },
      onReveal: (m) => {
        if (m.seq <= animated.current) return;
        const rv: Reveal = { id: m.seq, gestures: m.gestures, after: m.match };
        revealRef.current = rv;
        setReveal(rv);
      },
      onError: (message) => setError(message),
    });
    client.current = c;
    return () => c.close();
    // One connection per visit; the name is sent on connect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback((m: Parameters<OnlineClient['send']>[0]) => client.current?.send(m), []);

  const revealDone = useCallback((id: number) => {
    const r = revealRef.current;
    if (!r || r.id !== id) return;
    revealRef.current = null;
    animated.current = r.id;
    setReveal(null);
    const latest = roomRef.current;
    setShown(latest?.match && latest.seq === r.id ? latest.match : r.after);
  }, []);

  const you: Side = room?.you ?? 0;
  const display = shown ?? room?.match ?? null;
  useRecordResult(display, you, 'online', matchNo);

  let session: MatchSession | null = null;
  if (room && room.stage !== 'lobby' && display) {
    const names: [string, string] = [room.players[0]?.name ?? 'Player 1', room.players[1]?.name ?? 'Player 2'];
    const me = room.players[you];
    const opp = room.players[other(you)];
    const live = room.match!;
    const canPick = room.stage === 'match' && live.phase === 'playing' && !reveal && !me?.picked && display.phase === 'playing';
    let st = '';
    if (room.stage === 'match' && live.phase === 'playing') {
      st = me?.picked ? `Locked in. Waiting for ${opp?.name ?? 'your opponent'}…` : `${opp?.name ?? 'Opponent'} ${opp?.picked ? 'has locked in' : 'is choosing'}.`;
    }
    session = {
      kind: 'online',
      state: display,
      names,
      outMode: room.outMode,
      nearSide: you,
      you,
      toss: room.toss,
      canActForToss: (s) => s === you,
      callToss: (face: CoinFace) => send({ t: 'call', face }),
      decideToss: (decision: TossDecision) => send({ t: 'decide', decision }),
      pickers: canPick ? [you] : NONE,
      hidePreview: false,
      handoff: null,
      confirmHandoff: noop,
      drawDeadline: null,
      readyForDraw: NONE,
      setReadyForDraw: noop,
      setSelection: noop,
      submit: (side: Side, g: Gesture) => {
        if (side === you) send({ t: 'pick', gesture: g, ball: ballKey(live) });
      },
      locked: { 0: !!room.players[0]?.picked, 1: !!room.players[1]?.picked } as Record<Side, boolean>,
      status: st,
      reveal,
      revealDone,
      nextInnings: () => send({ t: 'next-innings' }),
      rematch: me?.wantsRematch ? null : () => send({ t: 'rematch' }),
      rematchLabel: 'Ask for a rematch',
      rematchNote: me?.wantsRematch ? `Waiting for ${opp?.name ?? 'your opponent'} to accept…` : opp?.wantsRematch ? `${opp.name} wants a rematch.` : '',
    };
  }

  return {
    status,
    room,
    error,
    url: client.current?.url ?? '',
    create: (overs, outMode) => send({ t: 'create', overs, outMode }),
    join: (code) => send({ t: 'join', code }),
    setRules: (overs, outMode) => send({ t: 'set-rules', overs, outMode }),
    setReady: (ready) => send({ t: 'ready', ready }),
    leave: () => send({ t: 'leave' }),
    retry: () => client.current?.retryNow(),
    session,
    deadline: room?.deadline ?? null,
  };
}
