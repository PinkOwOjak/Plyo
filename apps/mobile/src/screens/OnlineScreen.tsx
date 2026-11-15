import { useState, type ReactNode } from 'react';
import { OUT_MODE_INFO, OVER_OPTIONS, ROOM_CODE_LENGTH, normaliseCode, other, type OutMode } from '@plyo/engine';
import { IconCopy, OnlineClient, RuleModePicker, Segmented, haptic, href, navigate, prefs, profile, useCountdown, useOnline, type ConnStatus } from '@plyo/core';
import { SoloMatch } from '../match/SoloMatch.tsx';
import { isNative } from '../native.ts';

const STATUS: Record<ConnStatus, string> = {
  connecting: 'Connecting…',
  open: 'Connected',
  reconnecting: 'Reconnecting…',
  offline: 'Can’t reach the game server',
};

export function OnlineScreen({ query, tabs }: { query: URLSearchParams; tabs: ReactNode }) {
  const me = profile.use();
  const net = useOnline(me.name);
  const secs = useCountdown(net.deadline);
  const { room, session } = net;

  if (room && session) {
    const opp = room.players[other(room.you)];
    if (room.stage === 'abandoned') {
      return (
        <div className="overlay">
          <div className="panel">
            <h2>Match over</h2>
            <p>{room.abandonedReason ?? 'The match ended.'}</p>
            <div className="panel__actions">
              <button className="btn btn--primary btn--lg" onClick={() => { OnlineClient.forgetSeat(); window.location.reload(); }}>Find another game</button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <>
        {(net.status !== 'open' || (opp && !opp.connected)) && (
          <div className="net-banner" role="status">{net.status !== 'open' ? STATUS[net.status] : `${opp!.name} disconnected. Waiting 45s.`}</div>
        )}
        <SoloMatch
          session={session}
          title={`Room ${room.code}`}
          exitHref="/online"
          onExit={() => { net.leave(); navigate('/online'); }}
          breakNote={secs !== null && <p className="dim">Next innings in {secs}s.</p>}
          arenaNote={
            session.state.phase === 'playing' && !session.reveal && (
              <div className="arena__opp">
                <span className={`dot${opp?.picked ? ' dot--on' : ''}`} />
                {opp?.picked ? 'Locked in' : 'Choosing'}
                {secs !== null && ` · ${secs}s`}
              </div>
            )
          }
        />
      </>
    );
  }

  return (
    <div className="app">
      <main className="screen">
        <Lobby net={net} query={query} />
      </main>
      {tabs}
    </div>
  );
}

function Lobby({ net, query }: { net: ReturnType<typeof useOnline>; query: URLSearchParams }) {
  const p = prefs.get();
  const [overs, setOvers] = useState(p.defaultOvers);
  const [outMode, setOutMode] = useState<OutMode>(p.outMode);
  const [code, setCode] = useState(() => normaliseCode(query.get('join') ?? ''));
  const [copied, setCopied] = useState(false);
  const online = net.status === 'open';
  const { room } = net;

  if (room) {
    const meP = room.players[room.you]!;
    const opp = room.players[other(room.you)];
    const host = room.you === 0;
    return (
      <div className="online">
        <header className="m-head"><h1>Room</h1><span className="m-head__me">{STATUS[net.status]}</span></header>
        <div className="room-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>
          {room.code.split('').map((c, i) => <span key={i} className="digit">{c}</span>)}
        </div>
        <button
          className="btn btn--line btn--block"
          onClick={async () => {
            const text = `Play Hand Cricket with me on Plyo. Room code: ${room.code}`;
            try {
              if (navigator.share) await navigator.share({ text });
              else {
                await navigator.clipboard.writeText(room.code);
                setCopied(true);
              }
            } catch {
              setCopied(false);
            }
          }}
        >
          <IconCopy width={18} height={18} /> {copied ? 'Code copied' : 'Share code'}
        </button>
        <ul className="m-seats">
          {[meP, opp].map((pl, i) => (
            <li key={i} className={pl ? '' : 'is-empty'}>
              <span>{pl ? `${pl.name}${i === 0 ? ' (you)' : ''}` : 'Waiting for a friend'}</span>
              {pl && <em className={pl.ready ? 'ok' : ''}>{!pl.connected ? 'Reconnecting' : pl.ready ? 'Ready' : 'Not ready'}</em>}
            </li>
          ))}
        </ul>
        <h2 className="m-label">{host ? 'Your rules' : `${opp?.name ?? 'Host'}’s rules`}</h2>
        <RuleModePicker value={room.outMode} onChange={host ? (m) => net.setRules(room.overs, m) : undefined} disabled={!host} />
        <div className="m-row">
          <span>Overs a side</span>
          {host ? (
            <Segmented label="Overs" value={room.overs} options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))} onChange={(o) => net.setRules(o, room.outMode)} />
          ) : (
            <strong>{room.overs}</strong>
          )}
        </div>
        <p className="dim small">{host ? 'Changing a rule clears both players’ ready status.' : 'Ready up to agree to these rules.'}</p>
        <div className="m-stack">
          <button className={`btn btn--lg btn--block ${meP.ready ? 'btn--line' : 'btn--primary'}`} disabled={!online || !opp} onClick={() => { haptic('tap'); net.setReady(!meP.ready); }}>
            {meP.ready ? 'Not ready yet' : host ? `Ready · ${OUT_MODE_INFO[room.outMode].name}` : `Agree and ready · ${OUT_MODE_INFO[room.outMode].name}`}
          </button>
          <button className="btn btn--quiet btn--block" onClick={net.leave}>Leave room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="online">
      <header className="m-head"><h1>Online</h1><span className={`m-head__me conn--${net.status}`}><span className="dot" /> {STATUS[net.status]}</span></header>
      {net.status === 'offline' && (
        <div className="notice notice--bad">
          <p>
            {isNative && !p.serverUrl
              ? 'The app needs a Plyo game server address. Add it in Settings.'
              : <>Tried <code>{net.url}</code>. Make sure the Plyo server is running.</>}
          </p>
          <div className="row">
            <button className="btn btn--line" onClick={net.retry}>Try again</button>
            <a className="btn btn--quiet" href={href('/settings')}>Settings</a>
          </div>
        </div>
      )}
      {net.error && <p className="notice notice--bad" role="alert">{net.error}</p>}
      <section className="m-section">
        <h2 className="m-label">Join with a code</h2>
        <form className="join" onSubmit={(e) => { e.preventDefault(); if (code.length === ROOM_CODE_LENGTH) net.join(code); }}>
          <input className="input join__code" aria-label="Room code" placeholder="Code" value={code} autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={(e) => setCode(normaliseCode(e.target.value))} />
          <button className="btn btn--primary btn--lg" type="submit" disabled={!online || code.length !== ROOM_CODE_LENGTH}>Join</button>
        </form>
      </section>
      <section className="m-section">
        <h2 className="m-label">Or create a room</h2>
        <RuleModePicker value={outMode} onChange={setOutMode} />
        <div className="m-row">
          <span>Overs a side</span>
          <Segmented label="Overs" value={overs} options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))} onChange={setOvers} />
        </div>
        <button className="btn btn--primary btn--lg btn--block" disabled={!online} onClick={() => net.create(overs, outMode)}>Create room</button>
      </section>
    </div>
  );
}
