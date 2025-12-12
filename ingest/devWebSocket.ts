import { WebSocketServer } from "ws";

declare global {
  // Avoid reinitializing during hot reload
  // @ts-ignore
  var __DEV_WSS__: WebSocketServer | undefined;
}


export function getDevWebSocketServer() {
  if (!global.__DEV_WSS__) {
    const wss = new WebSocketServer({ port: 9999 });
    global.__DEV_WSS__ = wss;
    wss.on("connection", (ws) => {
      ws.on("message", (msg) => {
        if (msg.toString() === "reload") {
          for (const client of wss.clients) {
            try {
              client.send("reload");
            } catch (_) {
            }
          }
        }
      });
    });
  }
  return global.__DEV_WSS__;
}

export function broadcastReload() {
  const wss = global.__DEV_WSS__;
  if (!wss) {
    return;
  }
  for (const client of wss.clients) {
    try {
      client.send("reload");
    } catch (_) {
    }
  }
}
