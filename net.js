/**
 * Opens a WebSocket to the game server at /ws and reconnects on its own.
 * The caller gets { send, onOpen, close } and messages arrive at onMessage.
 */
export function connect({ onMessage, onStatus }) {
  let ws = null;
  let closed = false;
  let retry = 0;
  let queue = [];
  const onOpenHooks = [];

  const open = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    onStatus?.(retry ? 'reconnecting' : 'connecting');
    ws.onopen = () => {
      retry = 0;
      onStatus?.('online');
      onOpenHooks.forEach((fn) => fn());
      queue.forEach((m) => ws.send(JSON.stringify(m)));
      queue = [];
    };
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      if (closed) return;
      retry += 1;
      onStatus?.(retry > 3 ? 'offline' : 'reconnecting');
      setTimeout(open, Math.min(8000, 600 * retry));
    };
  };
  open();

  return {
    send: (msg) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      else if (msg.t !== 'pos') queue.push(msg);
    },
    /** Runs fn on every (re)connect, e.g. to rejoin the room. */
    onOpen: (fn) => onOpenHooks.push(fn),
    close: () => {
      closed = true;
      ws?.close();
    },
  };
}
