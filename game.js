/**
 * Chhupan Chhupai game server: rooms, rules, live GPS positions, the 5 m catch,
 * pings and the shrinking zone.
 *
 * Only real people play: every player is a phone sharing its real GPS location.
 * Runs in Node (server.js, behind WebSockets). A client is anything with an
 * id and a send(obj).
 */

export const POLICE = 'police';
export const CHOR = 'chor';

export const COLORS = ['#ff7a00', '#0e8a83', '#e0218a', '#ffb300', '#6d4bd8', '#2f9e44', '#d9381e', '#1c7ed6'];
import { cleanAvatar } from './avatar.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const MAX_PLAYERS = 70;
export const MIN_PLAYERS = 3;
export const CATCH_RADIUS_M = 5; // police this close to a chor = jailed
export const CATCH_HOLD_MS = 1000; // ...for this long, so one GPS jump can't jail anyone
export const STALE_MS = 15_000; // a position older than this doesn't count for a catch
export const EXPOSE_AFTER_MS = 30_000; // pings mode: a chor outside the zone this long shows up live
export const OUT_AFTER_MS = 120_000; // a chor outside the zone this long is out
export const SPECTATE_DELAY_MS = 60_000;
export const HINT_EVERY_MS = 15_000; // flash mode: police get a fresh direction hint this often
export const TICK_MS = 500;
export const DEFAULT_CENTER = { lat: 28.6129, lng: 77.2295 }; // India Gate, New Delhi

export const DEFAULT_SETTINGS = {
  roundSec: 30 * 60,
  // 'flash': chors are hidden, police see them for a few seconds every so often (plus hints);
  // 'live': everyone sees everyone in real time; 'pings': police see where chors were at each ping.
  visibility: 'flash',
  flashEverySec: 60, // flash mode: how often chors appear to police
  flashForSec: 3, // flash mode: for how long
  hints: true, // flash mode: direction and distance hints for police between flashes
  pingSec: 2 * 60, // pings mode only; 0 = no pings
  headStartSec: 2 * 60,
  center: null,
  radius: 300,
  shrink: false,
  finalRadius: 150,
  onJailed: 'spectate', // or 'switch' (jailed chors join the police)
  spectate: 'live', // what jailed players see: 'delayed' | 'live' | 'off'
};

export const LIMITS = {
  roundSec: [5 * 60, 3 * 3600],
  pingSec: [0, 30 * 60],
  flashEverySec: [20, 10 * 60],
  flashForSec: [1, 10],
  headStartSec: [0, 30 * 60],
  radius: [50, 1500],
};

// ---------------------------------------------------------------- geo helpers

const M_PER_DEG = 111_320;

export function metersBetween(a, b) {
  const dy = (b.lat - a.lat) * M_PER_DEG;
  const dx = (b.lng - a.lng) * M_PER_DEG * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dx, dy);
}

export function offset(p, dx, dy) {
  return {
    lat: p.lat + dy / M_PER_DEG,
    lng: p.lng + dx / (M_PER_DEG * Math.cos(p.lat * (Math.PI / 180))),
  };
}

function randomPointIn(center, radius) {
  const r = radius * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  return offset(center, Math.cos(a) * r, Math.sin(a) * r);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeCode(taken) {
  let code;
  do {
    code = Array.from({ length: 6 }, () => pick([...CODE_CHARS])).join('');
  } while (taken.has(code));
  return code;
}

const token = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export function cleanSettings(input = {}, base = DEFAULT_SETTINGS) {
  const s = { ...base, ...input };
  s.roundSec = clamp(Math.round(s.roundSec), ...LIMITS.roundSec);
  s.pingSec = clamp(Math.round(s.pingSec), ...LIMITS.pingSec);
  s.headStartSec = clamp(Math.round(s.headStartSec), ...LIMITS.headStartSec);
  s.radius = clamp(Math.round(s.radius), ...LIMITS.radius);
  s.finalRadius = clamp(Math.round(s.finalRadius), 25, s.radius);
  s.shrink = !!s.shrink;
  if (!['flash', 'live', 'pings'].includes(s.visibility)) s.visibility = 'flash';
  s.flashEverySec = clamp(Math.round(s.flashEverySec), ...LIMITS.flashEverySec);
  s.flashForSec = clamp(Math.round(s.flashForSec), ...LIMITS.flashForSec);
  s.hints = s.hints !== false;
  if (!['spectate', 'switch'].includes(s.onJailed)) s.onJailed = 'spectate';
  if (!['delayed', 'live', 'off'].includes(s.spectate)) s.spectate = 'live';
  if (!s.center || !Number.isFinite(s.center.lat) || !Number.isFinite(s.center.lng)) s.center = { ...DEFAULT_CENTER };
  else s.center = { lat: s.center.lat, lng: s.center.lng };
  return s;
}

/** Teams are pure luck: nobody, not even the host, chooses who is Police. */
export function assignTeams(players) {
  const order = shuffle(players);
  const police = Math.max(1, Math.round(order.length / 3));
  order.forEach((p, i) => (p.team = i < police ? POLICE : CHOR));
}

// ---------------------------------------------------------------- server

export class GameServer {
  constructor({ now = () => Date.now(), tickMs = TICK_MS } = {}) {
    this.now = now;
    this.tickMs = tickMs;
    this.rooms = new Map();
    this.clients = new Map(); // clientId -> { send, roomCode, playerId }
    this.timer = null;
  }

  start() {
    if (!this.timer) this.timer = setInterval(() => this.tick(), this.tickMs);
    return this;
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  attach(clientId, send) {
    this.clients.set(clientId, { send, roomCode: null, playerId: null });
  }

  detach(clientId) {
    const c = this.clients.get(clientId);
    this.clients.delete(clientId);
    const room = c && this.rooms.get(c.roomCode);
    const p = room?.players.get(c.playerId);
    if (p && p.clientId === clientId) {
      p.connected = false;
      p.clientId = null;
      p.lastSeen = this.now();
      this.broadcast(room);
    }
  }

  receive(clientId, msg) {
    const c = this.clients.get(clientId);
    if (!c || !msg || typeof msg.t !== 'string') return;
    try {
      this.handle(clientId, c, msg);
    } catch (err) {
      c.send({ t: 'error', msg: 'Something went wrong. Try again.' });
      console.error(err);
    }
  }

  // -------------------------------------------------------------- messages

  handle(clientId, c, msg) {
    const now = this.now();
    if (msg.t === 'create') {
      const code = makeCode(this.rooms);
      const room = {
        code,
        hostId: null,
        settings: cleanSettings(msg.settings),
        phase: 'lobby',
        players: new Map(),
        chat: { [POLICE]: [], [CHOR]: [] },
        feed: [],
        pings: [],
        zone: null,
        nextZone: null,
        shrinkPlan: [],
        createdAt: now,
        round: 0,
      };
      this.rooms.set(code, room);
      const p = this.addPlayer(room, msg, clientId);
      room.hostId = p.id;
      this.bind(c, room, p);
      return;
    }

    if (msg.t === 'join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const room = this.rooms.get(code);
      if (!room) return c.send({ t: 'error', msg: `No game with code ${code}. Check the code and try again.` });
      const back = msg.playerId && room.players.get(msg.playerId);
      if (back && back.token === msg.token) {
        if (back.clientId && back.clientId !== clientId) this.clients.get(back.clientId)?.send({ t: 'kicked', msg: 'You joined from another tab.' });
        back.clientId = clientId;
        back.connected = true;
        return this.bind(c, room, back);
      }
      if (room.phase !== 'lobby') return c.send({ t: 'error', msg: 'That game has already started. Ask the host for the next round.' });
      if (room.players.size >= MAX_PLAYERS) return c.send({ t: 'error', msg: `That game is full (${MAX_PLAYERS} players).` });
      const p = this.addPlayer(room, msg, clientId);
      this.log(room, `${p.name} joined`, 'join');
      return this.bind(c, room, p);
    }

    const room = this.rooms.get(c.roomCode);
    const me = room?.players.get(c.playerId);
    if (!room || !me) return;
    me.lastSeen = now;
    const isHost = room.hostId === me.id;

    switch (msg.t) {
      case 'profile':
        if (room.phase === 'lobby') {
          if (msg.name) me.name = String(msg.name).slice(0, 16).trim() || me.name;
          if (msg.avatar) me.avatar = cleanAvatar(msg.avatar);
        }
        break;
      case 'settings':
        if (isHost && room.phase === 'lobby') room.settings = cleanSettings(msg.settings, room.settings);
        break;
      case 'kick': {
        const target = room.players.get(msg.playerId);
        if (isHost && room.phase === 'lobby' && target && target.id !== me.id) {
          room.players.delete(target.id);
          if (target.clientId) this.clients.get(target.clientId)?.send({ t: 'kicked', msg: 'The host removed you from the game.' });
        }
        break;
      }
      case 'start':
        if (isHost && room.phase === 'lobby') {
          if (room.players.size < MIN_PLAYERS) return c.send({ t: 'error', msg: `You need at least ${MIN_PLAYERS} players.` });
          this.startRound(room);
        }
        break;
      case 'pos':
        if (Number.isFinite(msg.lat) && Number.isFinite(msg.lng) && Math.abs(msg.lat) <= 90 && Math.abs(msg.lng) <= 180) {
          this.updatePos(room, me, { lat: msg.lat, lng: msg.lng, acc: Number.isFinite(msg.acc) ? Math.round(msg.acc) : null }, now);
        }
        return; // positions go out on the next tick (every 0.5 s), not echoed one by one
      case 'chat': {
        const text = String(msg.text || '').slice(0, 200).trim();
        if (!text || room.phase === 'lobby') break;
        const team = me.team === POLICE ? POLICE : CHOR;
        room.chat[team].push({ id: token().slice(0, 8), from: me.id, name: me.name, text, at: now });
        room.chat[team] = room.chat[team].slice(-80);
        break;
      }
      case 'selfJail':
        // Backup for when GPS misses a real catch: the chor owns up.
        if (room.phase === 'hunt' && me.team === CHOR && me.state === 'free') this.jail(room, me, null);
        break;
      case 'endRound':
        if (isHost && (room.phase === 'hunt' || room.phase === 'headstart')) this.finish(room, 'host');
        break;
      case 'again':
        if (isHost && room.phase === 'over') this.backToLobby(room);
        break;
      case 'leave':
        this.leave(room, me, c);
        return;
      default:
        return;
    }
    this.broadcast(room);
  }

  addPlayer(room, msg, clientId) {
    const id = 'p' + token().slice(0, 8);
    const used = new Set([...room.players.values()].map((p) => p.color));
    const p = {
      id,
      token: token(),
      name: String(msg.name || 'Player').slice(0, 16).trim() || 'Player',
      avatar: cleanAvatar(msg.avatar),
      color: COLORS.find((col) => !used.has(col)) || pick(COLORS),
      clientId,
      connected: true,
      lastSeen: this.now(),
      pos: null,
      ...this.freshRoundState(),
    };
    room.players.set(id, p);
    return p;
  }

  freshRoundState() {
    return { team: null, state: 'lobby', hist: [], outSince: null, nearSince: null, meters: 0, catches: 0, jailedAt: null, jailedBy: null, switched: false, exposedWarned: false };
  }

  bind(c, room, p) {
    c.roomCode = room.code;
    c.playerId = p.id;
    c.send({ t: 'joined', code: room.code, playerId: p.id, token: p.token });
    this.broadcast(room);
  }

  leave(room, me, c) {
    c.roomCode = null;
    c.playerId = null;
    if (room.phase === 'lobby') {
      room.players.delete(me.id);
      this.log(room, `${me.name} left`, 'leave');
    } else {
      me.connected = false;
      me.clientId = null;
    }
    if (room.hostId === me.id) {
      const next = [...room.players.values()].find((p) => p.connected && p.id !== me.id);
      if (next) {
        room.hostId = next.id;
        this.log(room, `${next.name} is now the host`, 'info');
      }
    }
    if (room.players.size === 0 || ![...room.players.values()].some((p) => p.connected)) this.rooms.delete(room.code);
    else this.broadcast(room);
  }

  // -------------------------------------------------------------- round flow

  startRound(room) {
    const now = this.now();
    const s = room.settings;
    const players = [...room.players.values()];
    for (const p of players) Object.assign(p, this.freshRoundState());
    assignTeams(players);
    for (const p of players) p.state = p.team === POLICE ? 'hunting' : 'free';
    room.round += 1;
    room.phase = 'headstart';
    room.startAt = now;
    room.huntAt = now + s.headStartSec * 1000;
    room.endAt = room.huntAt + s.roundSec * 1000;
    room.nextPingAt = s.visibility === 'pings' && s.pingSec ? room.huntAt + s.pingSec * 1000 : null;
    room.nextFlashAt = s.visibility === 'flash' ? room.huntAt + s.flashEverySec * 1000 : null;
    room.flashUntil = 0;
    room.hints = new Map();
    room.zone = { ...s.center, radius: s.radius };
    room.nextZone = null;
    room.shrinkPlan = s.shrink ? this.planShrink(room) : [];
    room.pings = [];
    room.chat = { [POLICE]: [], [CHOR]: [] };
    room.result = null;
    room.feed = [];
    this.log(room, 'Teams drawn at random. Chors, scatter!', 'start');
    for (const p of players) {
      this.alert(room, p, p.team === POLICE
        ? { kind: 'start', title: 'You are Police 🚨', body: s.headStartSec ? `Close your eyes. The hunt starts in ${fmtDur(s.headStartSec)}.` : 'Go! The hunt is on.' }
        : { kind: 'start', title: 'You are a Chor 🏃', body: s.headStartSec ? `Run and hide! ${fmtDur(s.headStartSec)} head start.` : 'Run! The police are already out.' });
    }
  }

  planShrink(room) {
    const s = room.settings;
    const steps = 4;
    const plan = [];
    let prev = { ...s.center, radius: s.radius };
    for (let i = 1; i <= steps; i++) {
      const radius = Math.round(s.radius - ((s.radius - s.finalRadius) * i) / steps);
      const slack = Math.max(0, prev.radius - radius) * 0.8;
      const c = randomPointIn(prev, slack);
      const at = room.huntAt + (s.roundSec * 1000 * i) / (steps + 1);
      plan.push({ at, lat: c.lat, lng: c.lng, radius, warned: false });
      prev = { ...c, radius };
    }
    return plan;
  }

  backToLobby(room) {
    room.phase = 'lobby';
    room.zone = null;
    room.nextZone = null;
    room.pings = [];
    room.result = null;
    room.feed = [];
    for (const p of room.players.values()) Object.assign(p, this.freshRoundState());
  }

  finish(room, why) {
    if (room.phase === 'over') return;
    const now = this.now();
    room.phase = 'over';
    room.endedAt = now;
    const free = this.freeChors(room);
    const winner = why === 'host' ? null : free.length ? CHOR : POLICE;
    room.result = { winner, why, at: now, survivors: free.map((p) => p.id) };
    const title = winner === POLICE ? 'Police win! 🚨' : winner === CHOR ? 'Chors win! 🏃' : 'Round ended by the host';
    this.log(room, title, 'end');
    for (const p of room.players.values()) this.alert(room, p, { kind: 'end', title: 'Time! Round over.', body: title });
  }

  updatePos(room, p, pos, now) {
    pos.at = now;
    const inRound = room.phase === 'headstart' || room.phase === 'hunt';
    if (inRound && p.pos) {
      const step = metersBetween(p.pos, pos);
      if (step < 200) p.meters += step; // ignore GPS jumps
    }
    p.pos = pos;
    if (!inRound) return;
    p.hist.push({ at: now, lat: pos.lat, lng: pos.lng });
    const cutoff = now - SPECTATE_DELAY_MS - 15_000;
    while (p.hist.length && p.hist[0].at < cutoff) p.hist.shift();
  }

  jail(room, chor, cop) {
    const now = this.now();
    chor.state = 'jailed';
    chor.jailedAt = now;
    chor.jailedBy = cop?.id || null;
    chor.outSince = null;
    chor.nearSince = null;
    if (cop) cop.catches += 1;
    this.log(room, cop ? `${cop.name} caught ${chor.name} 🔒` : `${chor.name} gave themself up 🔒`, 'jail');
    if (room.settings.onJailed === 'switch') {
      chor.team = POLICE;
      chor.state = 'hunting';
      chor.switched = true;
      this.alert(room, chor, { kind: 'jailed', title: 'Pakde gaye! You are Police now', body: cop ? `${cop.name} got within ${CATCH_RADIUS_M} m. Now help catch the rest.` : 'Now help catch the rest.' });
    } else {
      this.alert(room, chor, { kind: 'jailed', title: 'Pakde gaye! You are in jail 🔒', body: cop ? `${cop.name} got within ${CATCH_RADIUS_M} m of you.` : 'Watch the rest of the round.' });
    }
    const left = this.freeChors(room).length;
    for (const p of room.players.values()) {
      if (p === chor) continue;
      if (p === cop) this.alert(room, p, { kind: 'catch', title: `You caught ${chor.name}! 🎯`, body: `${left} chor${left === 1 ? '' : 's'} still free.` });
      else this.alert(room, p, { kind: 'info', title: `${chor.name} is in jail 🔒`, body: `${left} chor${left === 1 ? '' : 's'} still free.` });
    }
    this.checkWin(room);
  }

  freeChors(room) {
    return [...room.players.values()].filter((p) => p.team === CHOR && p.state === 'free');
  }

  checkWin(room) {
    if (room.phase === 'hunt' && this.freeChors(room).length === 0) this.finish(room, 'all-caught');
  }

  // -------------------------------------------------------------- tick

  tick() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      const anyone = [...room.players.values()].some((p) => p.connected || now - p.lastSeen < 10 * 60_000);
      if (!anyone) {
        this.rooms.delete(room.code);
        continue;
      }
      if (room.phase === 'headstart' || room.phase === 'hunt') this.stepRound(room, now);
      this.broadcast(room);
    }
  }

  stepRound(room, now) {
    const s = room.settings;

    if (room.phase === 'headstart' && now >= room.huntAt) {
      room.phase = 'hunt';
      this.log(room, 'Hunt is on! Police, go!', 'hunt');
      for (const p of room.players.values()) {
        this.alert(room, p, p.team === POLICE
          ? { kind: 'hunt', title: 'Aankhein kholo! Hunt is on 🚨', body: `Get within ${CATCH_RADIUS_M} m of a chor to jail them.` }
          : { kind: 'hunt', title: 'Police are out!', body: `Don't let them get within ${CATCH_RADIUS_M} m of you.` });
      }
    }
    if (room.phase !== 'hunt') return;

    this.checkCatches(room, now);
    if (room.phase !== 'hunt') return;

    // Pings (pings mode only)
    if (room.nextPingAt && now >= room.nextPingAt) {
      const spots = this.freeChors(room).filter((p) => p.pos).map((p) => ({ id: p.id, lat: p.pos.lat, lng: p.pos.lng }));
      room.pings.push({ at: now, spots });
      room.pings = room.pings.slice(-12);
      room.nextPingAt = now + s.pingSec * 1000;
      for (const p of room.players.values()) {
        if (p.team === POLICE) this.alert(room, p, { kind: 'ping', title: 'Ping! 📍', body: `${spots.length} chor${spots.length === 1 ? '' : 's'} just lit up on your map.` });
        else if (p.state === 'free') this.alert(room, p, { kind: 'ping', title: 'Ping! Move!', body: 'Your location was just sent to the police.' });
      }
    }

    // Flashes (flash mode): chors show up to police for a few seconds.
    if (room.nextFlashAt && now >= room.nextFlashAt) {
      room.flashUntil = now + s.flashForSec * 1000;
      room.nextFlashAt = now + s.flashEverySec * 1000;
      const n = this.freeChors(room).length;
      for (const p of room.players.values()) {
        if (p.team === POLICE) this.alert(room, p, { kind: 'ping', title: 'Flash! 👀 Look now!', body: `${n} chor${n === 1 ? '' : 's'} visible for ${s.flashForSec} seconds.` });
        else if (p.state === 'free') this.alert(room, p, { kind: 'zone', title: 'Flash! Police can see you', body: `For ${s.flashForSec} seconds. Move after it ends!` });
      }
    }
    if (s.visibility === 'flash' && s.hints) this.updateHints(room, now);

    // Shrinking zone
    const due = room.shrinkPlan.filter((z) => z.at <= now);
    if (due.length) {
      const z = due[due.length - 1];
      room.zone = { lat: z.lat, lng: z.lng, radius: z.radius };
      this.log(room, `Lakshman Rekha shrank to ${z.radius * 2} m across`, 'zone');
      room.shrinkPlan = room.shrinkPlan.filter((x) => x.at > now);
    }
    const upcoming = room.shrinkPlan[0];
    const warnMs = Math.min(60_000, (s.roundSec * 1000) / 10);
    if (upcoming && now >= upcoming.at - warnMs) {
      room.nextZone = { lat: upcoming.lat, lng: upcoming.lng, radius: upcoming.radius, at: upcoming.at };
      if (!upcoming.warned) {
        upcoming.warned = true;
        for (const p of room.players.values()) {
          this.alert(room, p, { kind: 'zone', title: `Zone shrinks in ${fmtDur(Math.round(warnMs / 1000))}`, body: `Down to ${upcoming.radius * 2} m. Get inside the new line.` });
        }
      }
    } else room.nextZone = null;

    // Chors outside the zone
    for (const p of this.freeChors(room)) {
      if (!p.pos) continue;
      const outside = metersBetween(p.pos, room.zone) > room.zone.radius;
      if (!outside) {
        p.outSince = null;
        p.exposedWarned = false;
        continue;
      }
      if (!p.outSince) {
        p.outSince = now;
        this.alert(room, p, { kind: 'zone', title: "You're outside the zone!", body: `Get back in within ${fmtDur(OUT_AFTER_MS / 1000)} or you're out.` });
      } else if (now - p.outSince >= OUT_AFTER_MS) {
        p.state = 'out';
        p.outSince = null;
        this.log(room, `${p.name} stayed outside the zone and is out`, 'out');
        this.alert(room, p, { kind: 'jailed', title: "You're out", body: 'Two minutes outside the zone. Better luck next round!' });
        this.checkWin(room);
      } else if (s.visibility !== 'live' && now - p.outSince >= EXPOSE_AFTER_MS && !p.exposedWarned) {
        p.exposedWarned = true;
        this.alert(room, p, { kind: 'zone', title: 'Police can see you live!', body: 'Get back inside the zone, fast.' });
      }
    }

    if (room.phase === 'hunt' && now >= room.endAt) this.finish(room, 'time');
  }

  /**
   * Flash mode: each police player gets a rough direction and distance to the nearest
   * free chor, refreshed every HINT_EVERY_MS, so it guides without becoming live tracking.
   */
  updateHints(room, now) {
    const chors = this.freeChors(room).filter((p) => p.pos);
    for (const cop of room.players.values()) {
      if (cop.team !== POLICE || cop.state !== 'hunting') continue;
      const old = room.hints.get(cop.id);
      if (old && !old.none && now - old.at < HINT_EVERY_MS) continue;
      if (!cop.pos || !chors.length) {
        room.hints.set(cop.id, { at: now, none: true });
        continue;
      }
      let best = null;
      for (const c of chors) {
        const d = metersBetween(cop.pos, c.pos);
        if (!best || d < best.d) best = { d, c };
      }
      room.hints.set(cop.id, { at: now, ...describeHint(cop.pos, best.c.pos, best.d) });
    }
  }

  /** Any police within CATCH_RADIUS_M of a free chor, for CATCH_HOLD_MS, jails them. */
  checkCatches(room, now) {
    const cops = [...room.players.values()].filter((p) => p.team === POLICE && p.state === 'hunting' && p.pos && now - p.pos.at < STALE_MS);
    for (const chor of this.freeChors(room)) {
      if (!chor.pos || now - chor.pos.at >= STALE_MS) {
        chor.nearSince = null;
        continue;
      }
      let best = null;
      let bestD = Infinity;
      for (const cop of cops) {
        const d = metersBetween(cop.pos, chor.pos);
        if (d < bestD) {
          bestD = d;
          best = cop;
        }
      }
      if (best && bestD <= CATCH_RADIUS_M) {
        chor.nearSince ??= now;
        if (now - chor.nearSince >= CATCH_HOLD_MS) this.jail(room, chor, best);
      } else chor.nearSince = null;
      if (room.phase !== 'hunt') return;
    }
  }

  // -------------------------------------------------------------- output

  log(room, text, kind) {
    room.feed.push({ at: this.now(), text, kind });
    room.feed = room.feed.slice(-40);
  }

  alert(room, p, a) {
    if (!p.clientId) return;
    this.clients.get(p.clientId)?.send({ t: 'alert', ...a, at: this.now() });
  }

  broadcast(room) {
    for (const p of room.players.values()) {
      if (!p.clientId) continue;
      this.clients.get(p.clientId)?.send({ t: 'state', room: this.view(room, p) });
    }
  }

  /** Everything one player is allowed to know. */
  view(room, me) {
    const now = this.now();
    const s = room.settings;
    const players = [...room.players.values()];
    const inRound = room.phase === 'headstart' || room.phase === 'hunt';
    const spectating = inRound && me.team === CHOR && me.state !== 'free';
    const blind = room.phase === 'headstart' && me.team === POLICE; // no peeking during the head start
    const live = [];

    const show = (p, kind, pos = p.pos) => pos && live.push({ id: p.id, lat: pos.lat, lng: pos.lng, acc: pos.acc ?? null, at: pos.at, kind });

    if (room.phase === 'over') {
      for (const p of players) show(p, 'live');
    } else if (inRound) {
      for (const p of players) {
        if (p.id === me.id) {
          show(p, 'me');
          continue;
        }
        if (spectating) {
          if (s.spectate === 'live') show(p, 'live');
          else if (s.spectate === 'delayed') {
            const old = p.hist.find((h) => h.at >= now - SPECTATE_DELAY_MS);
            if (old) show(p, 'delayed', old);
          }
          continue;
        }
        if (p.team === me.team) {
          if (p.state === 'free' || p.state === 'hunting') show(p, 'team');
          continue;
        }
        if (blind) continue;
        if (s.visibility === 'live') {
          // Real-time mode: the other team's free players are on the map live.
          if (p.state === 'free' || p.state === 'hunting') show(p, 'live');
        } else if (me.team === POLICE && p.state === 'free') {
          if (s.visibility === 'flash' && now < room.flashUntil) show(p, 'flash');
          else if (p.outSince && now - p.outSince >= EXPOSE_AFTER_MS) show(p, 'exposed');
        }
      }
    }

    const seesPings = s.visibility === 'pings' && (me.team === POLICE || spectating || room.phase === 'over');
    const lastPing = room.pings[room.pings.length - 1];

    return {
      code: room.code,
      round: room.round,
      now,
      phase: room.phase,
      hostId: room.hostId,
      meId: me.id,
      settings: s,
      startAt: room.startAt,
      huntAt: room.huntAt,
      endAt: room.endAt,
      endedAt: room.endedAt,
      nextPingAt: room.nextPingAt,
      nextFlashAt: room.phase === 'hunt' ? room.nextFlashAt : null,
      flashUntil: room.phase === 'hunt' ? room.flashUntil : 0,
      hint: room.phase === 'hunt' && me.team === POLICE && me.state === 'hunting' ? room.hints?.get(me.id) || null : null,
      zone: room.zone,
      nextZone: room.nextZone,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        team: p.team,
        state: p.state,
        connected: p.connected,
        switched: p.switched,
        hasGps: !!p.pos && now - p.pos.at < STALE_MS,
        catches: room.phase === 'over' || p.id === me.id || p.team === me.team ? p.catches : undefined,
        meters: room.phase === 'over' || p.id === me.id ? Math.round(p.meters) : undefined,
        outSince: p.id === me.id ? p.outSince : undefined,
        nearSince: p.id === me.id ? p.nearSince : undefined,
      })),
      live,
      ping: seesPings && lastPing ? lastPing : null,
      chat: inRound || room.phase === 'over' ? room.chat[me.team === POLICE ? POLICE : CHOR] : [],
      feed: room.feed.slice(-15),
      result: room.result,
    };
  }
}

const DIRECTIONS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];

/** "~120 m, North-East": a compass direction (to 45°) and a distance band, never exact. */
export function describeHint(from, to, d) {
  const dy = (to.lat - from.lat) * M_PER_DEG;
  const dx = (to.lng - from.lng) * M_PER_DEG * Math.cos(from.lat * (Math.PI / 180));
  const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  const sector = Math.round(bearing / 45) % 8;
  const band = d <= 25 ? 'hot' : d <= 75 ? 'warm' : d <= 150 ? 'near' : d <= 300 ? 'far' : 'veryfar';
  const range = { hot: 'under 25 m', warm: '25–75 m', near: '75–150 m', far: '150–300 m', veryfar: 'over 300 m' }[band];
  return { dir: DIRECTIONS[sector], angle: sector * 45, band, range };
}

export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec} s`;
  if (sec < 3600) return sec % 60 ? `${Math.floor(sec / 60)} min ${sec % 60} s` : `${sec / 60} min`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function fmtClock(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtMeters(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
