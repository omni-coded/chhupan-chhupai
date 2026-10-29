# Chhupan Chhupai

Real-world hide-and-seek for the whole mohalla: **Police vs Chor** on real streets, played on foot with phones as the umpire.

Only real people play: every player is a phone at its real GPS location on a real map (OpenStreetMap street tiles or Esri satellite imagery, both free, no API key). There are no bots.

- **Host**: the zone starts on your real location; set the rules and share the 6-letter code or invite link.
- **Teams are random**: when the round starts, luck decides who is Police (about a third) and who is Chor. Nobody can choose, not even the host.
- **Chhupo**: chors get a head start; the police screen is blindfolded ("Aankhein band!").
- **Dhoondo**: positions update twice a second and markers glide in real time. A police player within **5 m** of a chor for 1 second jails them automatically. A chor can also say "I got caught" if GPS misses a real catch.

Host rules: round length (5 min to 3 h), head start (0 to 30 min), zone size (100 m to 3 km across), who sees whom (everyone live, or chors hidden behind pings), an optional shrinking zone (the "Lakshman Rekha"), and whether jailed chors watch or switch to Police. A chor outside the zone for 2 minutes is out.

Phone GPS is usually accurate to 3 to 10 m outdoors, so the 5 m catch works best in open areas; the HUD shows your current accuracy (±m).

## Files

Everything lives in this one folder:

- [game.js](game.js): the authoritative game server (rooms, random teams, live positions, the 5 m catch, pings, zone, per-player views).
- [server.js](server.js): WebSocket server that also serves the built app.
- [net.js](net.js): the phone's connection to the server.
- [main.jsx](main.jsx), [router.js](router.js): app entry and page routing.
- [Landing.jsx](Landing.jsx): the landing page at `/`.
- [Play.jsx](Play.jsx), [HostSetup.jsx](HostSetup.jsx), [Lobby.jsx](Lobby.jsx), [Game.jsx](Game.jsx), [MapView.jsx](MapView.jsx): the app at `/play` (home, host setup, lobby, live game and results, map). Invite links are `/join/CODE`.
- [styles.css](styles.css): Indian theme and animations.

## Run it

```bash
npm install
npm run dev
```

Run `npm run server` in a second terminal too (the game needs the server), then open http://localhost:5174.

### Put it online (works on any Wi-Fi or mobile data)

Phones on different networks can only reach a server that is on the internet. Free option, about 10 minutes:

1. Put this folder on GitHub (a new repository containing just this folder).
2. Sign up at https://render.com, choose **New → Blueprint**, and pick the repository. [render.yaml](render.yaml) sets everything up.
3. Render gives you a link like `https://chhupan-chhupai.onrender.com` with https, so phone GPS works. Share it with friends.

On Render's free plan the server sleeps after 15 minutes without players; the first visit then takes about a minute to wake it.

### Install it on the phone like an app

Open the link on the phone. Android Chrome: menu ⋮ → **Install app** / **Add to Home screen**. iPhone Safari: Share → **Add to Home Screen**. It opens full-screen with its own icon ([manifest.webmanifest](manifest.webmanifest), [sw.js](sw.js)).

Browsers pause GPS when the screen is locked, so the game keeps the screen on during a round. A Play Store / App Store app (built with Capacitor around this same code) could keep tracking in the pocket.

### Play on one Wi-Fi without hosting

```bash
npm run build
npm run start:https
```

Everyone opens the **Network** URL it prints (e.g. `https://192.168.1.5:3443`) on the same Wi-Fi. The certificate is self-signed, so each phone shows a warning once: tap *Advanced → Proceed*. HTTPS is required for phones to share GPS.

Outdoors on mobile data, phones can't reach your laptop's Wi-Fi address. Either host the server publicly (any Node host: `npm run build && npm start`, which uses `PORT`), or tunnel it: `npm start`, then `npx cloudflared tunnel --url http://localhost:3000` and share the `https://…trycloudflare.com` link.

While developing online features, run `npm run server` alongside `npm run dev`; Vite forwards `/ws` to it.

If a phone drops signal, the player keeps their seat and rejoins automatically.
