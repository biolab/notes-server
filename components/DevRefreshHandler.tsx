"use client";

import React from "react";

const useRefresh = (wsPort: number) => {
  React.useEffect(() => {
    if (typeof window === "undefined" ||
      window.location.hostname !== "localhost") {
      return;
    }
    try {
      const ws = new WebSocket(`ws://localhost:${wsPort}`);
      ws.onmessage = (msg) => {
        if (msg.data === "reload") {
          window.location.reload();
        }
      };
      return () => ws.close();
    }
    catch (e) {
      console.error("Could not connect to dev WebSocket server:", e);
    }
  }, [wsPort]);
}

const ActiveRefreshConnector = ({ wsPort }: { wsPort: number }) => {
  useRefresh(wsPort);
  return null; // Renders nothing, just runs the effect
}

export const DevRefreshHandler = ({ wsPort }: { wsPort: number }) => {
  const [isLocal, setIsLocal] = React.useState(false);
  React.useEffect(() => {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      setIsLocal(true);
    }
  }, []);
  if (!isLocal) {
    return null;
  }
  return <ActiveRefreshConnector wsPort={wsPort}/>;
}
