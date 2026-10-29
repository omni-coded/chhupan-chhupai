/**
 * Chhupan Chhupai online server.
 *
 * Runs the GameServer from game.js behind WebSockets so friends' phones share
 * one game, and serves the built app (dist/), so one URL is all players need.
 *
 *   npm run build && npm start            HTTP on :3000 (put it behind an HTTPS host or tunnel)
 *   npm run build && npm run start:https  HTTPS on :3443 with a self-signed certificate,
 *                                         so phones on your Wi-Fi can share GPS
 *
 * Environment: PORT (default 3000, or 3443 with --https), HOST (default 0.0.0.0).
 */
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import selfsigned from 'selfsigned';
import { GameServer } from './game.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const useHttps = process.argv.includes('--https');
const PORT = Number(process.env.PORT) || (useHttps ? 3443 : 3000);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

// App-install files that live next to the code rather than in dist/.
const ROOT_FILES = new Set(['/manifest.webmanifest', '/sw.js', '/icon.svg', '/icon-192.png', '/icon-512.png']);

/** Serves files from dist/, falling back to index.html for app routes. */
async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (ROOT_FILES.has(urlPath)) {
    try {
      const body = await readFile(path.join(ROOT, urlPath));
      res.writeHead(200, { 'Content-Type': MIME[path.extname(urlPath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      return res.end(body);
    } catch {
      return res.writeHead(404).end();
    }
  }
  let file = path.normalize(path.join(DIST, urlPath));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (urlPath === '/' || !existsSync(file)) file = path.join(DIST, 'index.html');
  try {
    const body = await readFile(file);
    const cache = file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Build the app first: npm run build');
  }
}

/** A self-signed certificate, generated once and kept in .cert/. */
async function loadCertificate() {
  const dir = path.join(ROOT, '.cert');
  const keyFile = path.join(dir, 'key.pem');
  const certFile = path.join(dir, 'cert.pem');
  if (!existsSync(keyFile) || !existsSync(certFile)) {
    const pems = await selfsigned.generate([{ name: 'commonName', value: 'chhupan-chhupai.local' }], { days: 825, keySize: 2048 });
    mkdirSync(dir, { recursive: true });
    writeFileSync(keyFile, pems.private);
    writeFileSync(certFile, pems.cert);
  }
  return { key: readFileSync(keyFile), cert: readFileSync(certFile) };
}

const httpServer = useHttps ? createHttpsServer(await loadCertificate(), serveStatic) : createHttpServer(serveStatic);
const game = new GameServer().start();
const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 8192 });
let nextId = 0;

wss.on('connection', (ws) => {
  const id = `ws-${++nextId}`;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  game.attach(id, (msg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg)));
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    game.receive(id, msg);
  });
  ws.on('close', () => game.detach(id));
  ws.on('error', () => ws.terminate());
});

// Drop sockets that stopped answering (phones that lost signal without closing).
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

httpServer.listen(PORT, HOST, () => {
  const scheme = useHttps ? 'https' : 'http';
  console.log(`Chhupan Chhupai server running (${useHttps ? 'HTTPS, self-signed' : 'HTTP'})`);
  console.log(`  Local:   ${scheme}://localhost:${PORT}`);
  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets || []) {
      if (net.family === 'IPv4' && !net.internal) console.log(`  Network: ${scheme}://${net.address}:${PORT}`);
    }
  }
  if (!existsSync(path.join(DIST, 'index.html'))) console.log('  (dist/ is missing: run "npm run build" so the server can serve the app)');
});
