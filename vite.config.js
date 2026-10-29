import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true exposes the dev server on your LAN so you can open it on a phone.
// /ws is forwarded to the online game server (npm run server). The demo round needs no server.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } },
  },
});
