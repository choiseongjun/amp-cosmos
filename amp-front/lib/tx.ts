export type TxAttribute = { key: string; value: string };
export type TxEvent = { type: string; attributes: TxAttribute[] };
export type BlockActivity = { height: string; events: TxEvent[] };

export async function getBlockTxEvents(restUrl: string, height: string | number) {
  const h = String(height);
  const url = `${restUrl.replace(/\/$/, "")}/cosmos/tx/v1beta1/txs?events=tx.height=${encodeURIComponent(h)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`txs error: ${res.status}`);
  const json = await res.json();
  const responses = json?.tx_responses ?? [];
  const events: TxEvent[] = [];
  for (const r of responses) {
    const logs = r?.logs ?? [];
    for (const log of logs) {
      const evs = log?.events ?? [];
      for (const e of evs) {
        const typ = e?.type as string;
        const attrs = (e?.attributes || []).map((a: any) => ({ key: a.key, value: a.value })) as TxAttribute[];
        // keep only our module + useful basics; adjust filters as needed
        if (
          typ === "item_listed" ||
          typ === "item_bought" ||
          typ === "item_delisted" ||
          typ === "transfer" ||
          typ === "message"
        ) {
          events.push({ type: typ, attributes: attrs });
        }
      }
    }
  }
  return { height: h, events } as BlockActivity;
}

