import { useCallback, useEffect, useRef, useState } from 'react';
import { connect } from './net.js';
import { cleanAvatar, randomAvatar } from './avatar.js';
import CharacterMaker from './CharacterMaker.jsx';
import { navigate } from './router.js';
import { Logo } from './Landing.jsx';
import HostSetup from './HostSetup.jsx';
import Lobby from './Lobby.jsx';
import Game from './Game.jsx';

const PROFILE_KEY = 'cc-profile';
const SESSION_KEY = 'cc-session';

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}
function save(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

const ALERT_ICONS = { ping: '📍', zone: '⭕', jailed: '🔒', catch: '🎯', start: '🎲', hunt: '🔦', end: '🏁', info: '💬' };

/** Short beeps for alerts, so phones in a pocket still get noticed. */
function beep(kind) {
  try {
    const ctx = (beep.ctx ||= new (window.AudioContext || window.webkitAudioContext)());
    const notes = kind === 'ping' || kind === 'catch' ? [880, 1175] : kind === 'jailed' || kind === 'zone' ? [440, 330] : [660];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'triangle';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.16);
      o.stop(ctx.currentTime + i * 0.16 + 0.16);
    });
  } catch {
    /* no audio */
  }
}

export default function Play({ joinCode }) {
  const [profile, setProfile] = useState(() => {
    const saved = load(PROFILE_KEY);
    return { name: saved?.name || '', avatar: saved?.avatar && typeof saved.avatar === 'object' ? cleanAvatar(saved.avatar) : randomAvatar() };
  });
  const [screen, setScreen] = useState(joinCode ? 'join' : 'home');
  const [code, setCode] = useState(joinCode || '');
  const [room, setRoom] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [settingsEdit, setSettingsEdit] = useState(false);
  const conn = useRef(null);
  const session = useRef(null);
  const offset = useRef(0);
  const saved = load(SESSION_KEY);

  const toast = useCallback((a) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, ...a }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const onMessage = useCallback(
    (msg) => {
      if (msg.t === 'state') {
        offset.current = msg.room.now - Date.now();
        setRoom(msg.room);
        setBusy(false);
      } else if (msg.t === 'joined') {
        session.current = { code: msg.code, playerId: msg.playerId, token: msg.token };
        save(SESSION_KEY, session.current);
        if (location.pathname !== '/play') navigate('/play', { replace: true });
      } else if (msg.t === 'alert') {
        toast(msg);
        beep(msg.kind);
        navigator.vibrate?.(msg.kind === 'jailed' ? [400, 100, 400, 100, 400] : msg.kind === 'ping' ? [200, 100, 200] : [300]);
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(msg.title, { body: msg.body, tag: msg.kind, icon: '/favicon.ico' });
          } catch {
            /* some mobile browsers only allow notifications from a service worker */
          }
        }
      } else if (msg.t === 'error') {
        setError(msg.msg);
        setBusy(false);
        if (!session.current) {
          conn.current?.close();
          conn.current = null;
        }
      } else if (msg.t === 'kicked') {
        reset(msg.msg);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );

  const reset = useCallback((why) => {
    conn.current?.close();
    conn.current = null;
    session.current = null;
    save(SESSION_KEY, null);
    setRoom(null);
    setStatus(null);
    setScreen('home');
    if (why) setError(why);
  }, []);

  /** Opens a connection and sends `first` once it is up (and rejoins after drops). */
  const open = useCallback(
    (first) => {
      setError('');
      setBusy(true);
      conn.current?.close();
      session.current = null;
      const c = connect({ onMessage, onStatus: setStatus });
      conn.current = c;
      c.onOpen(() => {
        if (session.current) c.send({ t: 'join', ...session.current });
        else c.send(first);
      });
      setTimeout(() => setBusy(false), 6000);
    },
    [onMessage],
  );

  const send = useCallback((msg) => conn.current?.send(msg), []);

  useEffect(() => () => conn.current?.close(), []);
  useEffect(() => {
    save(PROFILE_KEY, profile);
  }, [profile]);

  const leave = () => {
    send({ t: 'leave' });
    reset();
    navigate('/play', { replace: true });
  };

  // ------------------------------------------------------------ in a room
  if (room) {
    const me = room.players.find((p) => p.id === room.meId);
    const isHost = room.hostId === room.meId;
    let body;
    if (room.phase === 'lobby' && settingsEdit && isHost) {
      body = (
        <HostSetup
          initial={room.settings}
          submitLabel="Save rules"
          onSubmit={(settings) => {
            send({ t: 'settings', settings });
            setSettingsEdit(false);
          }}
          onBack={() => setSettingsEdit(false)}
        />
      );
    } else if (room.phase === 'lobby') {
      body = <Lobby room={room} me={me} isHost={isHost} send={send} onLeave={leave} onEditRules={() => setSettingsEdit(true)} status={status} />;
    } else {
      return (
        <>
          <Game room={room} me={me} isHost={isHost} send={send} offset={offset} onLeave={leave} status={status} />
          <Toasts toasts={toasts} />
        </>
      );
    }
    return (
      <Shell>
        {body}
        <Toasts toasts={toasts} />
      </Shell>
    );
  }

  // ------------------------------------------------------------ before a room
  const nameOk = profile.name.trim().length > 0;
  return (
    <Shell>
      {screen === 'host' ? (
        <HostSetup
          submitLabel={busy ? 'Creating…' : 'Create game'}
          busy={busy}
          onBack={() => setScreen('home')}
          onSubmit={(settings) => open({ t: 'create', name: profile.name, avatar: profile.avatar, settings })}
          error={error}
        />
      ) : (
        <>
          <h1 className="screen-title">Namaste! 🙏</h1>
          <p className="screen-sub">Naam daalo, character banao. That's the whole sign-up.</p>
          <label className="field">
            <span>Your name</span>
            <input className="input" maxLength={16} value={profile.name} placeholder="e.g. Chintu" onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          </label>
          <div className="field">
            <span>Your character</span>
            <CharacterMaker value={profile.avatar} onChange={(avatar) => setProfile({ ...profile, avatar })} />
          </div>

          {error && <div className="error-box">{error}</div>}

          {saved && (
            <button className="card action-card" style={{ background: 'var(--marigold)', marginBottom: 14 }} onClick={() => open({ t: 'join', ...saved })} disabled={busy}>
              <span className="ic" style={{ background: '#fff' }}>
                ↩️
              </span>
              <span>
                <b>Rejoin game {saved.code}</b>
                <small>Pick up where you left off.</small>
              </span>
            </button>
          )}

          {screen === 'join' ? (
            <form
              className="card"
              style={{ padding: 18 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (nameOk && code.length === 6) open({ t: 'join', code, name: profile.name, avatar: profile.avatar });
              }}
            >
              <label className="field">
                <span>Game code</span>
                <input className="input code" maxLength={6} value={code} autoFocus={!joinCode} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
              </label>
              <button className="btn saffron block" disabled={!nameOk || code.length !== 6 || busy}>
                {busy ? 'Joining…' : nameOk ? 'Join game' : 'Enter your name first'}
              </button>
              <button type="button" className="btn ghost block" style={{ marginTop: 8 }} onClick={() => setScreen('home')}>
                Back
              </button>
            </form>
          ) : (
            <div className="home-actions">
              <button className="card action-card" disabled={!nameOk} onClick={() => setScreen('host')}>
                <span className="ic" style={{ background: 'var(--saffron)' }}>
                  🚩
                </span>
                <span>
                  <b>Host a game</b>
                  <small>Draw the zone, set the rules, invite friends.</small>
                </span>
              </button>
              <button className="card action-card" disabled={!nameOk} onClick={() => setScreen('join')}>
                <span className="ic" style={{ background: 'var(--teal)' }}>
                  🔑
                </span>
                <span>
                  <b>Join with a code</b>
                  <small>Got a six-letter code from a friend?</small>
                </span>
              </button>
              <p className="note">
                Everyone plays on their real GPS location, so all players need their own phone and must allow location. Teams are drawn at random when the round starts.
              </p>
              {!nameOk && <p className="note">Enter your name to host or join.</p>}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="app">
      <header className="app-top">
        <div className="app-top-inner">
          <Logo light />
        </div>
      </header>
      <div className="toran" />
      <main className="app-body">{children}</main>
    </div>
  );
}

function Toasts({ toasts }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="t-ic">{ALERT_ICONS[t.kind] || '🔔'}</span>
          <span>
            <b>{t.title}</b>
            {t.body && <small>{t.body}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}
