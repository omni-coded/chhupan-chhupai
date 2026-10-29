import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { POLICE, CHOR, CATCH_RADIUS_M, EXPOSE_AFTER_MS, OUT_AFTER_MS, fmtClock, fmtMeters, metersBetween } from './game.js';
import MapView from './MapView.jsx';
import Avatar from './Avatar.jsx';

const QUICK = {
  [POLICE]: ['Ping aaya! 📍', 'Cover the gate', "I'll take the left", 'Spotted one 👀', 'Regroup at the centre'],
  [CHOR]: ['Police near me 🚨', 'Move, move!', "I'm hidden 🤫", 'Split up!', 'All clear here'],
};
const SEND_EVERY_MS = 700;

function ago(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} ago`;
}

export default function Game({ room, me, isHost, send, offset, onLeave, status }) {
  const [now, setNow] = useState(() => Date.now() + offset.current);
  const [sheet, setSheet] = useState(null); // 'radio' | 'players'
  const [confirmSelf, setConfirmSelf] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [gps, setGps] = useState('waiting');
  const [gpsPos, setGpsPos] = useState(null);
  const [base, setBase] = useState('street');
  const [readCount, setReadCount] = useState(0);
  const [reveal, setReveal] = useState(() => room.phase === 'headstart' && Date.now() + offset.current - room.startAt < 4000);
  const [jailSeen, setJailSeen] = useState(me.state !== 'free' && me.state !== 'hunting');
  const mapRef = useRef(null);

  const inRound = room.phase === 'headstart' || room.phase === 'hunt';
  const spectating = inRound && me.team === CHOR && me.state !== 'free';
  const sharing = inRound && (me.state === 'free' || me.state === 'hunting');
  const liveMode = room.settings.visibility === 'live';
  const byId = useMemo(() => Object.fromEntries(room.players.map((p) => [p.id, p])), [room.players]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => clearInterval(t);
  }, [offset]);

  // ------------------------------------------------------------ real GPS
  useEffect(() => {
    if (!sharing) return;
    if (!navigator.geolocation) {
      setGps('none');
      return;
    }
    let lastSent = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        setGps(p.coords.accuracy > 20 ? 'weak' : 'ok');
        setGpsPos(pos);
        if (Date.now() - lastSent >= SEND_EVERY_MS) {
          lastSent = Date.now();
          send({ t: 'pos', ...pos });
        }
      },
      (err) => setGps(err.code === 1 ? 'blocked' : 'weak'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [sharing, send]);

  // Keep the screen on during a round.
  useEffect(() => {
    if (!inRound || !navigator.wakeLock) return;
    let lock;
    const get = () => navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {});
    get();
    const onVis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release();
    };
  }, [inRound]);

  // Show the role reveal at the start of every round.
  useEffect(() => {
    if (room.phase === 'headstart') setReveal(true);
  }, [room.round]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => setReveal(false), 3200);
    return () => clearTimeout(t);
  }, [reveal]);

  // ------------------------------------------------------------ markers
  const myPos = gpsPos || room.live.find((l) => l.kind === 'me') || null;
  const markers = useMemo(() => {
    const out = [];
    const shown = new Set();
    for (const l of room.live) {
      const p = byId[l.id];
      if (!p) continue;
      const pos = l.id === me.id && myPos ? myPos : l;
      shown.add(l.id);
      const jailed = p.state === 'jailed' || p.state === 'out';
      out.push({
        id: l.id,
        lat: pos.lat,
        lng: pos.lng,
        avatar: p.avatar,
        color: p.color,
        cls: `${p.team === POLICE ? 'police' : 'chor'} ${l.kind} ${jailed ? 'jailed' : ''}`,
        label: l.id === me.id ? 'You' : l.kind === 'exposed' ? `${p.name} · LIVE` : l.kind === 'delayed' ? `${p.name} · 1 min ago` : p.name,
      });
    }
    if (myPos && !shown.has(me.id) && sharing) out.push({ id: me.id, ...myPos, avatar: me.avatar, color: me.color, cls: `${me.team === POLICE ? 'police' : 'chor'} me`, label: 'You' });
    if (room.ping) {
      for (const s of room.ping.spots) {
        const p = byId[s.id];
        if (!p || (p.state !== 'free' && room.phase !== 'over') || shown.has(s.id)) continue;
        out.push({ id: `ping-${s.id}`, lat: s.lat, lng: s.lng, avatar: p.avatar, color: p.color, cls: 'ping', label: `${p.name} · ${ago(now - room.ping.at)}` });
      }
    }
    return out;
    // `now` only matters for the ping labels, so round it to whole seconds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.live, room.ping, byId, me, myPos?.lat, myPos?.lng, sharing, room.phase, Math.floor(now / 1000)]);

  // Distance to the nearest player on the other team (only when they are visible to me).
  const nearest = useMemo(() => {
    if (!myPos || !sharing) return null;
    let best = null;
    for (const l of room.live) {
      const p = byId[l.id];
      if (!p || l.id === me.id || p.team === me.team || (p.state !== 'free' && p.state !== 'hunting')) continue;
      const d = metersBetween(myPos, l);
      if (!best || d < best.d) best = { d, p };
    }
    return best;
  }, [room.live, byId, me, myPos?.lat, myPos?.lng, sharing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ HUD numbers
  const headstart = room.phase === 'headstart';
  const clock = headstart ? room.huntAt - now : room.phase === 'hunt' ? room.endAt - now : 0;
  const nextPing = room.phase === 'hunt' && room.nextPingAt ? room.nextPingAt - now : null;
  const freeChors = room.players.filter((p) => p.team === CHOR && p.state === 'free');
  const hudCls = room.phase === 'over' ? 'over' : spectating ? 'spectate' : me.team;
  const roleLabel = spectating ? (me.state === 'out' ? 'Out · watching' : 'In jail · watching') : me.team === POLICE ? (me.switched ? 'Police (switched)' : 'Police') : 'Chor';
  const unread = Math.max(0, room.chat.length - readCount);
  const outFor = me.outSince ? now - me.outSince : 0;
  const danger = nearest && me.team === CHOR && nearest.d <= 20;

  useEffect(() => {
    if (sheet === 'radio') setReadCount(room.chat.length);
  }, [sheet, room.chat.length]);

  // Buzz the chor when the police get close.
  const lastBuzz = useRef(0);
  useEffect(() => {
    if (danger && room.phase === 'hunt' && Date.now() - lastBuzz.current > 4000) {
      lastBuzz.current = Date.now();
      navigator.vibrate?.([80, 60, 80]);
    }
  }, [danger, room.phase, Math.floor(now / 1000)]); // eslint-disable-line react-hooks/exhaustive-deps

  const fitZone = () => {
    const z = room.nextZone || room.zone;
    if (z && mapRef.current) mapRef.current.fitBounds(L.latLng(z.lat, z.lng).toBounds(z.radius * 2.2));
  };
  const findMe = () => myPos && mapRef.current?.setView([myPos.lat, myPos.lng], 19);

  return (
    <div className="game">
      <div className={`game-hud ${hudCls}`}>
        <div>
          <div className="hud-label">{room.phase === 'over' ? 'Round over' : headstart ? 'Head start' : 'Time left'}</div>
          <div className="hud-clock">{room.phase === 'over' ? '0:00' : fmtClock(clock)}</div>
        </div>
        <div className="hud-mid">
          <div className="hud-label hud-role">
            <Avatar av={me.avatar} size={22} /> {roleLabel}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {freeChors.length} chor{freeChors.length === 1 ? '' : 's'} free
            {status && status !== 'online' && ` · ${status}…`}
            {sharing && gps !== 'ok' && ` · GPS ${gps}`}
            {sharing && gpsPos && ` · ±${Math.round(gpsPos.acc)} m`}
          </div>
        </div>
        <div className="hud-side">
          {nearest && room.phase === 'hunt' && (
            <>
              <span className="hud-label">{me.team === POLICE ? 'Nearest chor' : 'Nearest police'}</span>
              <b className={danger ? 'hot' : ''}>{fmtMeters(nearest.d)}</b>
            </>
          )}
          {!nearest && nextPing != null && (
            <>
              <span className="hud-label">Next ping</span>
              <b>{fmtClock(nextPing)}</b>
            </>
          )}
          {room.nextZone && (
            <span className="hud-label" style={{ color: 'var(--marigold)' }}>
              Zone shrinks {fmtClock(room.nextZone.at - now)}
            </span>
          )}
        </div>
      </div>

      <div className="game-map">
        <MapView
          center={room.zone || room.settings.center}
          zone={room.zone}
          nextZone={room.nextZone}
          markers={markers}
          me={sharing ? myPos : null}
          catchRadius={sharing && me.team === POLICE && room.phase === 'hunt' ? CATCH_RADIUS_M : 0}
          base={base}
          onReady={(m) => (mapRef.current = m)}
          fitKey={room.round}
        />
        <div className="map-tools">
          <button className="icon-btn" onClick={fitZone} title="Show the zone">
            ⭕
          </button>
          {myPos && (
            <button className="icon-btn" onClick={findMe} title="Find me">
              📍
            </button>
          )}
          <button className="icon-btn" onClick={() => setBase(base === 'street' ? 'satellite' : 'street')} title={base === 'street' ? 'Satellite view' : 'Street map'}>
            {base === 'street' ? '🛰️' : '🗺️'}
          </button>
        </div>

        {me.state === 'free' && me.nearSince && room.phase === 'hunt' ? (
          <div className="banner danger">🚨 Police within {CATCH_RADIUS_M} m! RUN!</div>
        ) : me.outSince && me.state === 'free' ? (
          <div className={`banner ${outFor >= EXPOSE_AFTER_MS ? 'danger' : ''}`}>
            {!liveMode && outFor >= EXPOSE_AFTER_MS
              ? `Police can see you LIVE! Back inside or you're out in ${fmtClock(OUT_AFTER_MS - outFor)}`
              : `Outside the zone! Get back in within ${fmtClock(OUT_AFTER_MS - outFor)}`}
          </div>
        ) : danger && room.phase === 'hunt' ? (
          <div className="banner danger">{nearest.p.name} is {fmtMeters(nearest.d)} away!</div>
        ) : null}

        {sharing && (gps === 'blocked' || gps === 'none' || (gps === 'waiting' && !myPos)) && (
          <div className="gps-card card">
            {gps === 'waiting' ? (
              <>
                <div className="gps-spinner">📡</div>
                <b>Finding your real location…</b>
                <p className="note">Step outside for a better GPS signal.</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40 }}>📍</div>
                <b>{gps === 'none' ? 'This browser has no GPS' : 'Location is blocked'}</b>
                <p className="note">This game runs on your real location. Allow location for this site in your browser settings, then reload. Without it you can't be seen or caught, and you can't catch anyone.</p>
              </>
            )}
          </div>
        )}

        {me.team === POLICE && headstart && !reveal && (
          <div className="blindfold">
            <div>
              <div className="eyes">🙈</div>
              <h2>Aankhein band!</h2>
              <p style={{ margin: '0 0 8px', fontSize: 18 }}>Eyes closed. The chors are running. Start counting…</p>
              <div className="count">{fmtClock(clock)}</div>
              <p style={{ fontSize: 20, opacity: 0.85 }}>
                Ek, do, teen, chaar…
              </p>
            </div>
          </div>
        )}

        {sheet === 'radio' && (
          <div className="sheet">
            <div className="sheet-head">
              <h3>📻 {me.team === POLICE ? 'Police' : 'Chor'} radio</h3>
              <button className="icon-btn" onClick={() => setSheet(null)}>
                ✕
              </button>
            </div>
            <ChatLog chat={room.chat} meId={me.id} />
            {room.phase !== 'over' && (
              <>
                <div className="quick">
                  {QUICK[me.team === POLICE ? POLICE : CHOR].map((q) => (
                    <button key={q} onClick={() => send({ t: 'chat', text: q })}>
                      {q}
                    </button>
                  ))}
                </div>
                <ChatInput onSend={(text) => send({ t: 'chat', text })} />
              </>
            )}
          </div>
        )}

        {sheet === 'players' && (
          <div className="sheet">
            <div className="sheet-head">
              <h3>👥 Players</h3>
              <button className="icon-btn" onClick={() => setSheet(null)}>
                ✕
              </button>
            </div>
            <div className="sheet-body">
              <PlayerTable room={room} me={me} />
              <ul className="feed">
                {room.feed
                  .slice()
                  .reverse()
                  .map((f, i) => (
                    <li key={i}>
                      {fmtClock(now - f.at)} ago · {f.text}
                    </li>
                  ))}
              </ul>
              {isHost && inRound && (
                <button className="btn small rani" style={{ marginTop: 14 }} onClick={() => confirm('End the round for everyone?') && send({ t: 'endRound' })}>
                  End round now
                </button>
              )}
              <button className="btn small ghost" style={{ marginTop: 14 }} onClick={() => confirm('Leave this game?') && onLeave()}>
                Leave game
              </button>
            </div>
          </div>
        )}

        {room.phase === 'over' && showResults && <Results room={room} me={me} isHost={isHost} send={send} onLeave={onLeave} onMap={() => setShowResults(false)} />}
      </div>

      <div className="game-bar">
        <button className={`tab-btn ${sheet === 'radio' ? 'on' : ''}`} onClick={() => setSheet(sheet === 'radio' ? null : 'radio')}>
          📻 Radio
          {unread > 0 && sheet !== 'radio' && <span className="count">{unread}</span>}
        </button>
        <button className={`tab-btn ${sheet === 'players' ? 'on' : ''}`} onClick={() => setSheet(sheet === 'players' ? null : 'players')}>
          👥
        </button>
        <span className="grow" />
        {room.phase === 'over' ? (
          <button className="btn small" onClick={() => setShowResults(true)}>
            🏁 Results
          </button>
        ) : me.team === POLICE ? (
          <span className="chip catch-chip">🚨 Get within {CATCH_RADIUS_M} m to catch</span>
        ) : me.state === 'free' ? (
          <button className="btn small rani" disabled={headstart} onClick={() => setConfirmSelf(true)}>
            🤚 I got caught
          </button>
        ) : (
          <span className="chip">{me.state === 'out' ? "You're out" : 'In jail 🔒'}</span>
        )}
      </div>

      {reveal && <RoleReveal team={me.team} />}

      {inRound && me.team === CHOR && me.state === 'jailed' && !jailSeen && (
        <div className="modal-back jail-back" onClick={() => setJailSeen(true)}>
          <div className="jail-bars" />
          <div className="card modal jail-modal">
            <div style={{ fontSize: 64 }}>🔒</div>
            <h2>Pakde gaye!</h2>
            <p>The police got within {CATCH_RADIUS_M} m of you. You're in jail for the rest of the round.</p>
            <button className="btn rani" onClick={() => setJailSeen(true)}>
              Watch the game 👀
            </button>
          </div>
        </div>
      )}

      {confirmSelf && (
        <div className="modal-back" onClick={() => setConfirmSelf(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 56 }}>🚨</div>
            <h2>Did the police catch you?</h2>
            <p>Use this only if GPS missed it. You'll go to jail{room.settings.onJailed === 'switch' ? ' and join the police' : ''}.</p>
            <div className="row-gap" style={{ justifyContent: 'center' }}>
              <button
                className="btn rani"
                onClick={() => {
                  send({ t: 'selfJail' });
                  setConfirmSelf(false);
                }}
              >
                Yes, I'm caught
              </button>
              <button className="btn cream" onClick={() => setConfirmSelf(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Spins between Police and Chor, then lands on the side luck picked. */
function RoleReveal({ team }) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLanded(true), 1600);
    return () => clearTimeout(t);
  }, []);
  const police = team === POLICE;
  return (
    <div className={`reveal ${landed ? (police ? 'police' : 'chor') : ''}`}>
      <div className="reveal-inner">
        <div className="kicker" style={{ color: '#fff' }}>
          {landed ? 'Luck has decided' : 'Police ya Chor?'}
        </div>
        <div className={`reveal-card ${landed ? 'landed' : 'spinning'}`}>{landed ? (police ? '🚨' : '🏃') : '🎲'}</div>
        <h1>{landed ? (police ? 'Tu hai Police!' : 'Tu hai Chor!') : 'Drawing teams…'}</h1>
        {landed && <p>{police ? `Catch the chors by getting within ${CATCH_RADIUS_M} m.` : `Run! Don't let police get within ${CATCH_RADIUS_M} m.`}</p>}
      </div>
    </div>
  );
}

function ChatLog({ chat, meId }) {
  const end = useRef(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [chat.length]);
  return (
    <div className="sheet-body">
      <div className="chat-log">
        {chat.length === 0 && <p className="note">No messages yet. Only your team can read this.</p>}
        {chat.map((m) => (
          <div key={m.id} className={`chat-msg ${m.from === meId ? 'mine' : ''}`}>
            <span className={`bubble ${m.from === meId ? 'mine' : ''}`}>
              {m.from !== meId && <b>{m.name}: </b>}
              {m.text}
            </span>
          </div>
        ))}
        <div ref={end} />
      </div>
    </div>
  );
}

function ChatInput({ onSend }) {
  const [text, setText] = useState('');
  return (
    <form
      className="chat-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSend(text.trim());
        setText('');
      }}
    >
      <input className="input" style={{ padding: '8px 14px', fontSize: 16 }} value={text} maxLength={200} placeholder="Message your team" onChange={(e) => setText(e.target.value)} />
      <button className="btn small saffron">Send</button>
    </form>
  );
}

const STATE_LABEL = { free: 'Free', hunting: 'Hunting', jailed: 'Jailed 🔒', out: 'Out', lobby: '' };

function PlayerTable({ room, me, stats }) {
  const teams = [POLICE, CHOR].map((team) => ({ team, list: room.players.filter((p) => p.team === team) }));
  return teams.map(({ team, list }) => (
    <div key={team} style={{ marginBottom: 12 }}>
      <div className="kicker" style={{ margin: '6px 0 0', color: team === POLICE ? 'var(--police)' : 'var(--rani)' }}>
        {team === POLICE ? '🚨 Police' : '🏃 Chors'} · {list.length}
      </div>
      <ul className="player-list" style={{ margin: 0 }}>
        {list.map((p) => (
          <li key={p.id} className="player-row">
            <span className="av">
              <Avatar av={p.avatar} size={40} />
              <span className={`dot ${p.connected ? '' : 'off'}`} />
            </span>
            <span className="name">
              {p.name}
              {p.id === me.id && ' (you)'}
              <small>
                {stats
                  ? `${p.catches ? `${p.catches} catch${p.catches === 1 ? '' : 'es'} · ` : ''}${p.meters != null ? `${(p.meters / 1000).toFixed(2)} km on foot` : ''}`
                  : p.hasGps
                    ? '📡 GPS live'
                    : '⚠️ no GPS'}
              </small>
            </span>
            <span className={`badge ${p.state === 'free' ? 'chor' : p.state === 'hunting' ? 'police' : 'out'}`}>{p.switched ? 'Switched' : STATE_LABEL[p.state]}</span>
          </li>
        ))}
      </ul>
    </div>
  ));
}

function Results({ room, me, isHost, send, onLeave, onMap }) {
  const w = room.result?.winner;
  const myTeamOriginally = me.switched ? CHOR : me.team;
  const won = w && w === myTeamOriginally;
  return (
    <div className="results">
      <div className={`results-hero ${w || 'none'} rangoli-bg`}>
        <div className="em bounce">{w === POLICE ? '🚨' : w === CHOR ? '🏃' : '🏁'}</div>
        <h1>{w === POLICE ? 'Police jeet gayi!' : w === CHOR ? 'Chor bhaag gaye!' : 'Round ended'}</h1>
        <p style={{ fontSize: 19, margin: 0 }}>
          {w === POLICE ? 'Every chor was caught.' : w === CHOR ? `${room.result.survivors.length} chor${room.result.survivors.length === 1 ? '' : 's'} stayed free till the end.` : 'The host stopped the round.'}
          {w && <b>{won ? ' You win! 🎉' : ' Better luck next round.'}</b>}
        </p>
        {won && <Confetti />}
      </div>
      <div className="toran" />
      <div className="app-body">
        <PlayerTable room={room} me={me} stats />
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {isHost ? (
            <button className="btn saffron block" onClick={() => send({ t: 'again' })}>
              🔁 Play again
            </button>
          ) : (
            <div className="card" style={{ padding: 12, textAlign: 'center', fontWeight: 700 }}>
              Waiting for the host to start the next round…
            </div>
          )}
          <button className="btn cream block" onClick={onMap}>
            🗺️ See the final map
          </button>
          <button className="btn ghost block" onClick={onLeave}>
            Leave game
          </button>
        </div>
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#ffb300', '#e0218a', '#0e8a83', '#fff', '#ff7a00'];
function Confetti() {
  const bits = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 1.5, dur: 2.2 + Math.random() * 1.6, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] })),
    [],
  );
  return (
    <div className="confetti-box" aria-hidden="true">
      {bits.map((b, i) => (
        <span key={i} className="confetti" style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }} />
      ))}
    </div>
  );
}
