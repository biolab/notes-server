import { WebSocketServer } from "ws";

declare global {
  // Avoid reinitializing during hot reload
  // @ts-ignore
  var __DEV_WSS__: WebSocketServer | undefined;
}


export function getDevWebSocketServer() {
  if (!global.__DEV_WSS__) {
    global.__DEV_WSS__ = new WebSocketServer(
      { port: parseInt(process.env.NEXT_PUBLIC_WS_PORT || "3021") }
    );
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
