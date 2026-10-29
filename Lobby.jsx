import { useState } from 'react';
import Avatar from './Avatar.jsx';
import { CATCH_RADIUS_M, MIN_PLAYERS, fmtDur, fmtMeters } from './game.js';

export function rulesSummary(s) {
  return [
    `⏱ ${fmtDur(s.roundSec)} round`,
    s.visibility === 'flash'
      ? `👀 Chors flash every ${fmtDur(s.flashEverySec)} for ${s.flashForSec}s${s.hints ? ' + hints' : ''}`
      : s.visibility === 'live'
        ? '🛰️ Everyone live on the map'
        : s.pingSec
          ? `📍 Chors pinged every ${fmtDur(s.pingSec)}`
          : '📍 Chors hidden, no pings',
    `🔒 Caught within ${CATCH_RADIUS_M} m`,
    s.headStartSec ? `🏃 ${fmtDur(s.headStartSec)} head start` : '🏃 No head start',
    `⭕ ${fmtMeters(s.radius * 2)} zone${s.shrink ? ', shrinking' : ''}`,
    s.onJailed === 'switch' ? '🔁 Jailed chors join Police' : '👀 Jailed chors watch',
  ];
}

export default function Lobby({ room, me, isHost, send, onLeave, onEditRules, status }) {
  const [copied, setCopied] = useState(false);
  const [loc, setLoc] = useState(null);
  const [notif, setNotif] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const link = `${location.origin}/join/${room.code}`;
  const enough = room.players.length >= MIN_PLAYERS;

  const share = async () => {
    const text = `Chhupan Chhupai khelna hai? Join my game with code ${room.code}: ${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Chhupan Chhupai', text, url: link });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const checkLocation = () => {
    if (!navigator.geolocation) return setLoc({ state: 'none' });
    setLoc({ state: 'asking' });
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ state: 'ok', acc: Math.round(p.coords.accuracy) }),
      (e) => setLoc({ state: e.code === 1 ? 'blocked' : 'error' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="fade-in">
      <div className="card code-card">
        <div className="kicker" style={{ margin: 0 }}>
          Game code
        </div>
        <div className="code">{room.code}</div>
        <div className="row-gap" style={{ justifyContent: 'center' }}>
          <button className="btn small saffron" onClick={share}>
            {copied ? '✅ Copied!' : '📤 Share invite'}
          </button>
        </div>
        {status && status !== 'online' && <p className="note" style={{ margin: '10px 0 0' }}>Connection: {status}…</p>}
      </div>

      <div className="card dice-card">
        <span className="dice">🎲</span>
        <span>
          <b>Teams are drawn at random</b>
          <small>When the round starts, luck decides who is Police and who is Chor. About a third become Police. Nobody can choose, not even the host.</small>
        </span>
      </div>

      <div className="rule-chips">
        {rulesSummary(room.settings).map((r) => (
          <span key={r} className="chip">
            {r}
          </span>
        ))}
        {isHost && (
          <button className="chip" style={{ background: 'var(--marigold)', cursor: 'pointer' }} onClick={onEditRules}>
            ✏️ Edit rules
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="sheet-head" style={{ paddingBottom: 0 }}>
          <h3>
            Players <span className="note">({room.players.length}/70)</span>
          </h3>
        </div>
        <ul className="player-list">
          {room.players.map((p) => (
            <li key={p.id} className="player-row pop-in">
              <span className="av">
                <Avatar av={p.avatar} size={40} />
                <span className={`dot ${p.connected ? '' : 'off'}`} />
              </span>
              <span className="name">
                {p.name}
                {p.id === me.id && ' (you)'}
                <small>{p.id === room.hostId ? '👑 Host' : p.connected ? 'Ready' : 'Disconnected'}</small>
              </span>
              {isHost && p.id !== me.id && (
                <button className="icon-btn" title={`Remove ${p.name}`} onClick={() => send({ t: 'kick', playerId: p.id })}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {!enough && <p className="note" style={{ padding: '0 14px 14px', margin: 0 }}>Waiting for friends to join… share the code above.</p>}
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <h3 style={{ fontSize: 22, marginBottom: 6 }}>Get your phone ready</h3>
        <p className="note" style={{ marginTop: 0 }}>
          The game uses your real GPS location, shared only while the round is on. Allow it now so the round starts smoothly.
        </p>
        <div className="row-gap">
          <button className="btn small cream" onClick={checkLocation} disabled={loc?.state === 'ok' || loc?.state === 'asking'}>
            {loc?.state === 'ok' ? `✅ Location ready (±${loc.acc} m)` : loc?.state === 'asking' ? 'Asking…' : '📍 Allow location'}
          </button>
          {notif !== 'unsupported' && (
            <button className="btn small cream" disabled={notif === 'granted'} onClick={() => Notification.requestPermission().then(setNotif)}>
              {notif === 'granted' ? '✅ Alerts on' : '🔔 Allow alerts'}
            </button>
          )}
        </div>
        {loc?.state === 'blocked' && <p className="error-box">Location is blocked. Allow it for this site in your browser settings, or you can't play.</p>}
        {loc?.state === 'error' && <p className="note">Couldn't get a GPS fix yet. Step outside and try again.</p>}
        {loc?.state === 'ok' && loc.acc > 20 && <p className="note">Your GPS is fuzzy right now (±{loc.acc} m). Open sky helps: catches need {CATCH_RADIUS_M} m precision.</p>}
        {location.protocol !== 'https:' && location.hostname !== 'localhost' && <p className="error-box">Phones only share GPS over https. Open the https link from the host.</p>}
      </div>

      {isHost ? (
        <button className="btn saffron block" disabled={!enough} onClick={() => send({ t: 'start' })}>
          {enough ? '🎲 Draw teams & start' : `Need ${MIN_PLAYERS - room.players.length} more player${MIN_PLAYERS - room.players.length === 1 ? '' : 's'}`}
        </button>
      ) : (
        <div className="card" style={{ padding: 14, textAlign: 'center', fontWeight: 700 }}>
          Waiting for {room.players.find((p) => p.id === room.hostId)?.name || 'the host'} to start…
        </div>
      )}
      <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onLeave}>
        Leave game
      </button>
    </div>
  );
}
