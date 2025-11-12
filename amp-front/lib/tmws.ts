export type BlockHeader = {
  height: string;
  time?: string;
  txs?: number;
};

export function rpcToWs(rpcUrl: string): string {
  const u = rpcUrl.trim();
  if (u.startsWith("ws://") || u.startsWith("wss://")) return u.replace(/\/?$/, "") + "/websocket";
  if (u.startsWith("https://")) return "wss://" + u.slice("https://".length).replace(/\/?$/, "") + "/websocket";
  if (u.startsWith("http://")) return "ws://" + u.slice("http://".length).replace(/\/?$/, "") + "/websocket";
  return "ws://" + u.replace(/\/?$/, "") + "/websocket";
}

export function subscribeNewBlocks(rpcUrl: string, onHeader: (h: BlockHeader) => void) {
  const wsUrl = rpcToWs(rpcUrl);
  const ws = new WebSocket(wsUrl);

  const sub = {
    jsonrpc: "2.0",
    method: "subscribe",
    id: "newblocks",
    params: { query: "tm.event='NewBlock'" },
  };

  ws.onopen = () => {
    ws.send(JSON.stringify(sub));
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      const v = msg?.result?.data?.value;
      if (!v) return;
      // Try NewBlock first
      const block = v.block || v.data?.value?.block;
      if (block?.header) {
        const header = block.header;
        const txs = Array.isArray(block.data?.txs) ? block.data.txs.length : undefined;
        onHeader({ height: String(header.height), time: header.time, txs });
        return;
      }
      // Fallback to NewBlockHeader
      const header = v.header;
      if (header?.height) {
        onHeader({ height: String(header.height), time: header.time });
      }
    } catch {
      // ignore parse errors
    }
  };

  return () => {
    try { ws.close(); } catch { /* noop */ }
  };
}

