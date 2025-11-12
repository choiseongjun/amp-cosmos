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

export async function getLatestHeight(rpcUrl: string): Promise<number> {
  const url = rpcUrl.replace(/\/$/, "") + "/status";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`status error: ${res.status}`);
  const j = await res.json();
  const h = j?.result?.sync_info?.latest_block_height;
  return Number(h || 0);
}

export type BlockMeta = { height: number; time?: string; num_txs?: number };

export async function getBlockMetas(rpcUrl: string, minHeight: number, maxHeight: number): Promise<BlockMeta[]> {
  const url = rpcUrl.replace(/\/$/, "") + `/blockchain?minHeight=${minHeight}&maxHeight=${maxHeight}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`blockchain error: ${res.status}`);
  const j = await res.json();
  const metas = j?.result?.block_metas || [];
  return metas.map((m: any) => ({
    height: Number(m?.header?.height),
    time: m?.header?.time,
    num_txs: Number(m?.num_txs ?? 0),
  }));
}
