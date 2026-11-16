import { useState } from 'react';
import { OUT_MODE_INFO, OVER_OPTIONS, ROOM_CODE_LENGTH, isOutMode, normaliseCode, other, type OutMode } from '@plyo/engine';
import { IconCopy, OnlineClient, RuleModePicker, Segmented, navigate, prefs, profile, useCountdown, useOnline, type ConnStatus } from '@plyo/core';
import { Rail } from '../shell/Rail.tsx';
import { MatchScreen } from '../match/MatchScreen.tsx';

const STATUS: Record<ConnStatus, string> = {
  connecting: 'Connecting to the game server…',
  open: 'Connected',
  reconnecting: 'Connection lost. Reconnecting…',
  offline: 'Can’t reach the game server.',
};

export function OnlineScreen({ query }: { query: URLSearchParams }) {
  const me = profile.use();
  const net = useOnline(me.name);
  const secs = useCountdown(net.deadline);
  const { room, session } = net;

  if (room && session) {
    const opp = room.players[other(room.you)];
    const leave = () => {
      net.leave();
      navigate('/online');
    };
    return (
      <>
        {(net.status !== 'open' || (opp && !opp.connected && room.stage !== 'abandoned')) && (
          <div className="net-banner" role="status">
            {net.status !== 'open' ? STATUS[net.status] : `${opp!.name} disconnected. Waiting up to 45 seconds for them to return.`}
          </div>
        )}
        {room.stage === 'abandoned' ? (
          <div className="overlay">
            <div className="panel" role="dialog" aria-labelledby="ab-h">
              <h2 id="ab-h">Match over</h2>
              <p>{room.abandonedReason ?? 'The match ended.'}</p>
              <div className="panel__actions">
                <button
                  className="btn btn--primary btn--lg"
                  onClick={() => {
                    OnlineClient.forgetSeat();
                    window.location.reload();
                  }}
                >
                  Find another game
                </button>
              </div>
            </div>
          </div>
        ) : (
          <MatchScreen
            session={session}
            title={`Room ${room.code}`}
            exitHref="/online"
            onExit={leave}
            breakNote={secs !== null && <p className="dim">Next innings starts in {secs}s.</p>}
            arenaNote={
              session.state.phase === 'playing' &&
              !session.reveal && (
                <div className="arena__opp">
                  <span className={`dot${opp?.picked ? ' dot--on' : ''}`} />
                  {opp?.picked ? `${opp.name} has locked in` : `${opp?.name ?? 'Opponent'} is choosing`}
                  {secs !== null && <span className="dim"> · {secs}s</span>}
                </div>
              )
            }
          />
        )}
      </>
    );
  }

  return (
    <div className="frame">
      <Rail section="online" />
      <main className="content">
        <RoomLobby net={net} query={query} />
      </main>
    </div>
  );
}

function RoomLobby({ net, query }: { net: ReturnType<typeof useOnline>; query: URLSearchParams }) {
  const p = prefs.get();
  const rule = query.get('rule');
  const [overs, setOvers] = useState(() => Number(query.get('overs')) || p.defaultOvers);
  const [outMode, setOutMode] = useState<OutMode>(isOutMode(rule) ? rule : p.outMode);
  const [code, setCode] = useState(() => normaliseCode(query.get('join') ?? ''));
  const [copied, setCopied] = useState(false);
  const online = net.status === 'open';
  const { room } = net;

  if (room) {
    const meP = room.players[room.you]!;
    const opp = room.players[other(room.you)];
    const host = room.you === 0;
    const link = `${location.origin}${location.pathname}#/online?join=${room.code}`;
    return (
      <div className="online">
        <header className="page-head">
          <h1>Room</h1>
          <p className="dim">{STATUS[net.status]}</p>
        </header>
        <div className="online__grid">
          <section className="room">
            <div className="room__code" aria-label={`Room code ${room.code.split('').join(' ')}`}>
              {room.code.split('').map((c, i) => (
                <span key={i} className="digit">{c}</span>
              ))}
            </div>
            <button
              className="btn btn--line"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <IconCopy width={18} height={18} /> {copied ? 'Invite link copied' : 'Copy invite link'}
            </button>
            <ul className="seats">
              {[meP, opp].map((pl, i) => (
                <li key={i} className={pl ? '' : 'is-empty'}>
                  <span>{pl ? `${pl.name}${i === 0 ? ' (you)' : ''}` : 'Waiting for a friend to join'}</span>
                  {pl && <span className={pl.ready ? 'ok' : 'dim'}>{!pl.connected ? 'Reconnecting' : pl.ready ? 'Ready' : 'Not ready'}</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="room__rules">
            <h2>Match rules</h2>
            <p className="dim">
              {host ? 'You set the rules. Changing them clears both players’ ready status.' : `${opp?.name ?? 'The host'} set these rules. Ready up to agree to them.`}
            </p>
            <RuleModePicker value={room.outMode} onChange={host ? (m) => net.setRules(room.overs, m) : undefined} disabled={!host} />
            <div className="field">
              <span className="field__label">Overs per side</span>
              {host ? (
                <Segmented label="Overs" value={room.overs} options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))} onChange={(o) => net.setRules(o, room.outMode)} />
              ) : (
                <strong>{room.overs}</strong>
              )}
            </div>
            <button className={`btn btn--lg btn--block ${meP.ready ? 'btn--line' : 'btn--primary'}`} disabled={!online || !opp} onClick={() => net.setReady(!meP.ready)}>
              {meP.ready ? 'Not ready yet' : host ? `Ready: ${OUT_MODE_INFO[room.outMode].name}` : `Agree and ready: ${OUT_MODE_INFO[room.outMode].name}`}
            </button>
            <button className="btn btn--quiet btn--block" onClick={net.leave}>Leave room</button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="online">
      <header className="page-head">
        <h1>Play online</h1>
        <p className={`conn conn--${net.status}`}><span className="dot" /> {STATUS[net.status]}</p>
      </header>
      {net.status === 'offline' && (
        <div className="notice notice--bad">
          Online play needs the Plyo server. Tried <code>{net.url}</code>. Run <code>npm run dev</code> locally, or set a server in Settings.
          <button className="btn btn--line" onClick={net.retry}>Try again</button>
        </div>
      )}
      {net.error && <p className="notice notice--bad" role="alert">{net.error}</p>}
      <div className="online__grid">
        <section>
          <h2>Create a room</h2>
          <RuleModePicker value={outMode} onChange={setOutMode} />
          <div className="field">
            <span className="field__label">Overs per side</span>
            <Segmented label="Overs" value={overs} options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))} onChange={setOvers} />
          </div>
          <button className="btn btn--primary btn--lg btn--block" disabled={!online} onClick={() => net.create(overs, outMode)}>
            Create room
          </button>
        </section>
        <section>
          <h2>Join a friend</h2>
          <form
            className="join"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === ROOM_CODE_LENGTH) net.join(code);
            }}
          >
            <label className="sr-only" htmlFor="code">Room code</label>
            <input id="code" className="input join__code" placeholder="Code" value={code} autoComplete="off" spellCheck={false} onChange={(e) => setCode(normaliseCode(e.target.value))} />
            <button className="btn btn--primary btn--lg" type="submit" disabled={!online || code.length !== ROOM_CODE_LENGTH}>Join</button>
          </form>
          <p className="dim join__hint">You’ll see the host’s rules before you agree to play.</p>
        </section>
      </div>
    </div>
  );
}
