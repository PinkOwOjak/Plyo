import { useCallback, useEffect, useRef, useState } from 'react';
import type { Gesture } from '../engine/gestures.ts';
import { OVER_OPTIONS, other, type MatchState, type Side } from '../engine/match.ts';
import { OnlineClient, type ConnStatus } from '../net/client.ts';
import { ballKey, normaliseCode, ROOM_CODE_LENGTH, type RoomView } from '../net/protocol.ts';
import { prefs } from '../../../platform/prefs.ts';
import { profile } from '../../../platform/profile.ts';
import { href, navigate } from '../../../platform/router.ts';
import { Segmented, TopBar } from '../../../shell/Shell.tsx';
import { IconCopy } from '../../../shell/icons.tsx';
import { MatchView, type Reveal } from '../ui/MatchView.tsx';
import { ResultView } from '../ui/ResultView.tsx';
import { TossView } from '../ui/TossView.tsx';
import { InningsBreak, parseOvers, useRecordResult } from './shared.tsx';

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const STATUS_TEXT: Record<ConnStatus, string> = {
  connecting: 'Connecting to the game server…',
  open: 'Connected',
  reconnecting: 'Connection lost. Reconnecting…',
  offline: 'Can’t reach the game server.',
};

export function OnlineScreen({ query }: { query: URLSearchParams }) {
  const me = profile.use();
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [shown, setShown] = useState<MatchState | null>(null);
  const [matchNo, setMatchNo] = useState(1);
  const animatedSeq = useRef(0);
  const client = useRef<OnlineClient | null>(null);
  const revealRef = useRef<Reveal | null>(null);
  const roomRef = useRef<RoomView | null>(null);

  useEffect(() => {
    const c = new OnlineClient(me.name, {
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
          // A rematch started.
          animatedSeq.current = 0;
          setMatchNo((n) => n + 1);
        }
        // Without a pending animation, show the server's state directly.
        if (!revealRef.current && r.seq >= animatedSeq.current) {
          animatedSeq.current = r.seq;
          setShown(r.match);
        }
      },
      onReveal: (m) => {
        if (m.seq <= animatedSeq.current) return;
        const rv: Reveal = { id: m.seq, gestures: m.gestures, after: m.match };
        revealRef.current = rv;
        setReveal(rv);
      },
      onError: (message) => setError(message),
    });
    client.current = c;
    return () => c.close();
    // One connection per visit; the name is sent when connecting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (m: Parameters<OnlineClient['send']>[0]) => client.current?.send(m);

  const onRevealDone = useCallback((id: number) => {
    const r = revealRef.current;
    if (!r || r.id !== id) return;
    revealRef.current = null;
    animatedSeq.current = r.id;
    setReveal(null);
    const latest = roomRef.current;
    setShown(latest?.match && latest.seq === r.id ? latest.match : r.after);
  }, []);

  const you: Side = room?.you ?? 0;
  const display = shown ?? room?.match ?? null;
  useRecordResult(display ?? ({ phase: 'toss' } as MatchState), you, 'online', matchNo);
  const now = useNow(!!room?.deadline);

  if (!room || room.stage === 'lobby') {
    return (
      <RoomLobby
        status={status}
        room={room}
        error={error}
        url={client.current?.url ?? ''}
        defaultOvers={parseOvers(query.get('overs'), prefs.get().defaultOvers)}
        joinCode={query.get('join')}
        onCreate={(overs) => send({ t: 'create', overs })}
        onJoin={(code) => send({ t: 'join', code })}
        onReady={(ready) => send({ t: 'ready', ready })}
        onLeave={() => send({ t: 'leave' })}
        onRetry={() => client.current?.retryNow()}
      />
    );
  }

  const names: [string, string] = [room.players[0]?.name ?? 'Player 1', room.players[1]?.name ?? 'Player 2'];
  const opp = room.players[other(you)];
  const meView = room.players[you];
  const match = room.match!;
  const secondsLeft = room.deadline ? Math.max(0, Math.ceil((room.deadline - now) / 1000)) : null;

  let overlay: React.ReactNode = null;
  if (room.stage === 'abandoned') {
    overlay = (
      <div className="overlay-card" role="dialog" aria-labelledby="ab-title">
        <h2 id="ab-title">Match over</h2>
        <p>{room.abandonedReason ?? 'The match ended.'}</p>
        <div className="overlay-actions">
          <button
            className="btn btn--primary btn--lg"
            onClick={() => {
              OnlineClient.forgetSeat();
              window.location.reload();
            }}
          >
            Find another game
          </button>
          <a className="btn btn--ghost btn--lg" href={href('/hand-cricket')}>Leave</a>
        </div>
      </div>
    );
  } else if (room.stage === 'toss') {
    overlay = (
      <TossView
        names={names}
        toss={room.toss}
        canAct={(s) => s === you}
        onCall={(face) => send({ t: 'call', face })}
        onDecide={(decision) => send({ t: 'decide', decision })}
      />
    );
  } else if (display?.phase === 'innings-break' && !reveal) {
    overlay = (
      <InningsBreak
        state={display}
        names={names}
        onStart={() => send({ t: 'next-innings' })}
        startLabel="I’m ready"
        note={secondsLeft !== null && <p className="muted">Next innings starts in {secondsLeft}s.</p>}
      />
    );
  } else if (display?.phase === 'complete' && !reveal) {
    overlay = (
      <ResultView
        state={display}
        names={names}
        you={you}
        onRematch={meView?.wantsRematch ? undefined : () => send({ t: 'rematch' })}
        rematchLabel="Ask for a rematch"
        exitHref={href('/hand-cricket')}
        extra={
          <p className="muted">
            {meView?.wantsRematch
              ? `Waiting for ${opp?.name ?? 'your opponent'} to accept…`
              : opp?.wantsRematch
                ? `${opp.name} wants a rematch.`
                : ''}
          </p>
        }
      />
    );
  }

  const canPick = room.stage === 'match' && match.phase === 'playing' && !reveal && !meView?.picked && display?.phase === 'playing';
  let waiting: React.ReactNode = '';
  if (room.stage === 'match' && match.phase === 'playing') {
    if (meView?.picked) waiting = `Locked in. Waiting for ${opp?.name ?? 'your opponent'}…`;
  }

  const leave = () => {
    send({ t: 'leave' });
    navigate('/hand-cricket');
  };

  return (
    <>
      {(status !== 'open' || (opp && !opp.connected && room.stage !== 'abandoned')) && (
        <div className="net-banner" role="status">
          {status !== 'open' ? STATUS_TEXT[status] : `${opp!.name} disconnected. Waiting up to 45 seconds for them to return…`}
        </div>
      )}
      <MatchView
        key={matchNo}
        title={`Room ${room.code}`}
        backHref="/hand-cricket"
        state={display ?? match}
        names={names}
        nearSide={you}
        picker={canPick ? { side: you, hidden: false } : null}
        waiting={
          <>
            {waiting}
            {secondsLeft !== null && match.phase === 'playing' && meView?.picked && <> Auto-pick in {secondsLeft}s.</>}
          </>
        }
        onSubmit={(g: Gesture) => send({ t: 'pick', gesture: g, ball: ballKey(match) })}
        reveal={reveal}
        onRevealDone={onRevealDone}
        overlay={overlay}
        onBack={leave}
        arenaExtra={
          room.stage === 'match' && match.phase === 'playing' && !reveal ? (
            <div className="opp-status" aria-live="polite">
              <span className={`dot${opp?.picked ? ' dot--on' : ''}`} />
              {opp?.picked ? `${opp.name} has locked in` : `${opp?.name ?? 'Opponent'} is choosing`}
              {canPick && secondsLeft !== null && <span className="muted">· {secondsLeft}s left</span>}
            </div>
          ) : null
        }
      />
    </>
  );
}

interface LobbyProps {
  status: ConnStatus;
  room: RoomView | null;
  error: string | null;
  url: string;
  defaultOvers: number;
  joinCode: string | null;
  onCreate: (overs: number) => void;
  onJoin: (code: string) => void;
  onReady: (ready: boolean) => void;
  onLeave: () => void;
  onRetry: () => void;
}

function RoomLobby({ status, room, error, url, defaultOvers, joinCode, onCreate, onJoin, onReady, onLeave, onRetry }: LobbyProps) {
  const [overs, setOvers] = useState(defaultOvers);
  const [code, setCode] = useState(() => normaliseCode(joinCode ?? ''));
  const [copied, setCopied] = useState(false);
  const online = status === 'open';

  if (room) {
    const me = room.players[room.you]!;
    const opp = room.players[other(room.you)];
    const link = `${location.origin}${location.pathname}#/hand-cricket/online?join=${room.code}`;
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        setCopied(false);
      }
    };
    return (
      <div className="shell">
        <TopBar title="Online room" back="/hand-cricket" />
        <main className="page page--narrow online">
          {status !== 'open' && <p className="notice">{STATUS_TEXT[status]}</p>}
          <p className="muted">Room code · {room.overs} overs a side</p>
          <div className="room-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>
            {room.code.split('').map((ch, i) => (
              <span key={i} className="tile tile--xl">{ch}</span>
            ))}
          </div>
          <button className="btn btn--ghost" onClick={copy}>
            <IconCopy width={18} height={18} />
            {copied ? 'Invite link copied' : 'Copy invite link'}
          </button>

          <ul className="seats" aria-label="Players">
            {[me, opp].map((p, i) => (
              <li key={i} className={`seat${p ? '' : ' seat--empty'}`}>
                <span className="seat__name">{p ? p.name : 'Waiting for a friend to join…'}{i === 0 && ' (you)'}</span>
                {p && (
                  <span className={`seat__state${p.ready ? ' seat__state--ready' : ''}`}>
                    {!p.connected ? 'Reconnecting' : p.ready ? 'Ready' : 'Not ready'}
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="online__actions">
            <button className={`btn btn--lg btn--block ${me.ready ? 'btn--ghost' : 'btn--primary'}`} onClick={() => onReady(!me.ready)} disabled={!online}>
              {me.ready ? 'Not ready yet' : 'I’m ready'}
            </button>
            <button className="btn btn--ghost btn--block" onClick={onLeave}>Leave room</button>
          </div>
          <p className="muted online__hint">The toss starts when both players are ready.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <TopBar title="Play online" back="/hand-cricket" />
      <main className="page page--narrow online">
        <p className={`conn conn--${status}`} role="status">
          <span className="dot" /> {STATUS_TEXT[status]}
        </p>
        {status === 'offline' && (
          <div className="notice notice--error">
            <p>
              Online play needs the Plyo game server. Tried <code>{url}</code>. If you’re running Plyo locally, start it with{' '}
              <code>npm run dev</code>, or set a server address in Settings.
            </p>
            <button className="btn btn--ghost" style={{ marginTop: '0.75rem' }} onClick={onRetry}>Try again</button>
          </div>
        )}
        {error && <p className="notice notice--error" role="alert">{error}</p>}

        <section className="section">
          <h2>Create a room</h2>
          <div className="field">
            <div className="field__label">Overs per side</div>
            <Segmented label="Overs" value={overs} options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))} onChange={setOvers} />
          </div>
          <button className="btn btn--primary btn--lg btn--block" disabled={!online} onClick={() => onCreate(overs)}>
            Create room
          </button>
        </section>

        <section className="section">
          <h2>Join a friend</h2>
          <form
            className="join"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === ROOM_CODE_LENGTH) onJoin(code);
            }}
          >
            <label className="visually-hidden" htmlFor="code">Room code</label>
            <input
              id="code"
              className="text-input join__input"
              placeholder="Room code"
              value={code}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCode(normaliseCode(e.target.value))}
            />
            <button className="btn btn--amber btn--lg" type="submit" disabled={!online || code.length !== ROOM_CODE_LENGTH}>
              Join
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
