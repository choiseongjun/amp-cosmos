import { DEFAULT_REST_URL } from "./config";

export async function getScore(restUrl = DEFAULT_REST_URL, address: string): Promise<number> {
  if (!address) return 0;
  const res = await fetch(`${restUrl.replace(/\/$/, "")}/amp/points/v1/score/${address}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`score error: ${res.status}`);
  const j = await res.json();
  return Number(j?.score ?? 0);
}

