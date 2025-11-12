export type Coin = { denom: string; amount: string };

export async function getNodeInfo(restUrl: string) {
  const res = await fetch(
    `${restUrl.replace(/\/$/, "")}/cosmos/base/tendermint/v1beta1/node_info`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Node info error: ${res.status}`);
  return res.json();
}

export async function getBalances(restUrl: string, address: string) {
  if (!address) return { balances: [] as Coin[] };
  const res = await fetch(
    `${restUrl.replace(/\/$/, "")}/cosmos/bank/v1beta1/balances/${address}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Balances error: ${res.status}`);
  return res.json() as Promise<{ balances: Coin[] }>;
}

