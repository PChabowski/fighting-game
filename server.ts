import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomManager } from './src/server/roomManager.ts';
import type { ClientToServerMessage, ServerToClientMessage } from './src/game/net/protocol.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

interface AliveWebSocket extends WebSocket {
  isAlive?: boolean;
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  const roomManager = new RoomManager();

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      rooms: roomManager.listRooms().length,
      uptimeSec: Math.round(process.uptime()),
    });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: roomManager.listRooms() });
  });

  // Explicit HTTP Upgrade routing exclusively for /ws (prevents collisions with proxy/Vite paths)
  server.on('upgrade', (req, socket, head) => {
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (pathname === '/ws') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      } else {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: AliveWebSocket) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const send = (msg: ServerToClientMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    const playerId = roomManager.registerClient(send);

    ws.on('message', (raw) => {
      ws.isAlive = true;
      try {
        const text = typeof raw === 'string' ? raw : raw.toString('utf8');
        const parsed = JSON.parse(text) as ClientToServerMessage;
        if (parsed && parsed.type === 'ping') {
          send({ type: 'pong' });
          return;
        }
        if (parsed && typeof parsed.type === 'string') {
          roomManager.handleMessage(playerId, parsed, Date.now());
        }
      } catch {
        send({
          type: 'error_msg',
          code: 'BAD_REQUEST',
          message: 'Malformed WebSocket payload.',
        });
      }
    });

    ws.on('close', () => {
      roomManager.unregisterClient(playerId);
    });

    ws.on('error', () => {
      roomManager.unregisterClient(playerId);
    });
  });

  // Authoritative 60Hz simulation tick across all active online rooms
  const tickTimer = setInterval(() => {
    roomManager.tick(Date.now());
  }, 16);

  // Keepalive heartbeat every 15s for Cloud Run / Envoy reverse-proxy WebSockets
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((client) => {
      const sock = client as AliveWebSocket;
      if (sock.isAlive === false) {
        sock.terminate();
        return;
      }
      sock.isAlive = false;
      try {
        sock.ping();
      } catch {
        // ignore
      }
    });
  }, 15000);

  if (!IS_PROD) {
    // Serve a clean no-HMR /@vite/client shim so Vite never opens a failing port-24678 WebSocket behind proxies
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
      if (el.getAttribute("data-vite-dev-id") === id) el.remove();
    });
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ash & Iron Server] Listening on http://0.0.0.0:${PORT} (ws://.../ws)`);
  });

  process.on('SIGINT', () => {
    clearInterval(tickTimer);
    clearInterval(heartbeatTimer);
    server.close();
  });
}

startServer().catch((err) => {
  console.error('[Ash & Iron Server] Fatal startup error:', err);
  process.exit(1);
});
