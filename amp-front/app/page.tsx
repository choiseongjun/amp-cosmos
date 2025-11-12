"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_FAUCET_CREDIT_PATH, DEFAULT_FAUCET_URL, DEFAULT_REST_URL, DEFAULT_RPC_URL } from "@/lib/config";
import { getBalances, getNodeInfo, type Coin } from "@/lib/cosmos";
import { getListings, statusToLabel, type Listing } from "@/lib/amp";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { buildMsgBuyItem, buildMsgListItem, getSigningClient, type ChainConfig } from "@/lib/wallet";
import { subscribeNewBlocks, type BlockHeader } from "@/lib/tmws";
import { getBlockTxEvents, type TxEvent } from "@/lib/tx";

type Actor = "alice" | "bob";

export default function Home() {
  const [restUrl, setRestUrl] = useLocalStorage("amp.restUrl", DEFAULT_REST_URL);
  const [rpcUrl, setRpcUrl] = useLocalStorage("amp.rpcUrl", DEFAULT_RPC_URL);
  const [faucetUrl, setFaucetUrl] = useLocalStorage("amp.faucetUrl", DEFAULT_FAUCET_URL);
  const [creditPath, setCreditPath] = useLocalStorage("amp.faucetPath", DEFAULT_FAUCET_CREDIT_PATH);

  const [aliceAddress, setAliceAddress] = useLocalStorage("amp.alice", "");
  const [bobAddress, setBobAddress] = useLocalStorage("amp.bob", "");
  const [active, setActive] = useLocalStorage<Actor>("amp.active", "alice");

  const activeAddress = useMemo(() => (active === "alice" ? aliceAddress : bobAddress), [active, aliceAddress, bobAddress]);

  const [nodeInfo, setNodeInfo] = useState<any | null>(null);
  const [balances, setBalances] = useState<Coin[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [txPending, setTxPending] = useState(false);
  const [txMsg, setTxMsg] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ownedLookupAddr, setOwnedLookupAddr] = useState<string>("");
  const [wsEnabled, setWsEnabled] = useState(true);
  const [wsError, setWsError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockHeader[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [blockEvents, setBlockEvents] = useState<TxEvent[] | null>(null);
  const [loadingBlock, setLoadingBlock] = useState(false);

  // sell form state
  const [sellTitle, setSellTitle] = useState("");
  const [sellDesc, setSellDesc] = useState("");
  const [sellAssetDenom, setSellAssetDenom] = useState("token");
  const [sellAssetAmt, setSellAssetAmt] = useState("1");
  const [sellPriceDenom, setSellPriceDenom] = useState("stake");
  const [sellPriceAmt, setSellPriceAmt] = useState("1000");
  // send form state
  const [sendTo, setSendTo] = useState("");
  const [sendDenom, setSendDenom] = useState("stake");
  const [sendAmount, setSendAmount] = useState("1000");

  const refresh = async () => {
    setError(null);
    setFaucetMsg(null);
    try {
      const [info, bals, allListings] = await Promise.all([
        getNodeInfo(restUrl),
        activeAddress ? getBalances(restUrl, activeAddress) : Promise.resolve({ balances: [] as Coin[] }),
        getListings(restUrl),
      ]);
      setNodeInfo(info?.default_node_info || info?.node_info || info);
      setBalances(bals.balances || []);
      setListings(allListings);
    } catch (e: any) {
      setError(e?.message || "failed to fetch");
    }
  };

  useEffect(() => {
    // initial fetch
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restUrl, activeAddress]);

  useEffect(() => {
    // preset owned lookup to active address if empty
    if (!ownedLookupAddr && (aliceAddress || bobAddress)) {
      setOwnedLookupAddr(activeAddress || aliceAddress || bobAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress]);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let poll: any = null;
    setWsError(null);
    if (wsEnabled && rpcUrl) {
      try {
        stop = subscribeNewBlocks(rpcUrl, (h) => {
          setBlocks((prev) => {
            const next = [h, ...prev.filter((x) => x.height !== h.height)];
            return next.slice(0, 12);
          });
        });
      } catch (e: any) {
        setWsError(e?.message || "ws connect failed");
      }
    }
    if (!wsEnabled && restUrl) {
      // Fallback: poll latest block every 2s
      poll = setInterval(async () => {
        try {
          const res = await fetch(`${restUrl.replace(/\/$/, "")}/cosmos/base/tendermint/v1beta1/blocks/latest`, { cache: "no-store" });
          if (res.ok) {
            const j = await res.json();
            const header = j?.block?.header;
            const txs = Array.isArray(j?.block?.data?.txs) ? j.block.data.txs.length : undefined;
            if (header?.height) {
              const h = { height: String(header.height), time: header.time, txs } as BlockHeader;
              setBlocks((prev) => {
                const next = [h, ...prev.filter((x) => x.height !== h.height)];
                return next.slice(0, 12);
              });
            }
          }
        } catch {
          // ignore
        }
      }, 2000);
    }
    return () => {
      if (stop) stop();
      if (poll) clearInterval(poll);
    };
  }, [rpcUrl, restUrl, wsEnabled]);

  useEffect(() => {
    const h = blocks[0]?.height; // if new block arrives and nothing selected, show latest
    if (!selectedBlock && h) setSelectedBlock(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  useEffect(() => {
    (async () => {
      if (!selectedBlock) return;
      try {
        setLoadingBlock(true);
        const activity = await getBlockTxEvents(restUrl, selectedBlock);
        setBlockEvents(activity.events);
      } catch (e: any) {
        setBlockEvents([{ type: "error", attributes: [{ key: "message", value: e?.message || "failed" }] }]);
      } finally {
        setLoadingBlock(false);
      }
    })();
  }, [selectedBlock, restUrl]);

  const requestFaucet = async () => {
    setError(null);
    setFaucetMsg(null);
    if (!activeAddress) {
      setError("Enter an address for the active user");
      return;
    }
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: activeAddress, faucetUrl, creditPath }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `faucet error: ${res.status}`);
      setFaucetMsg(text || "Faucet request sent");
      // refresh balances after a short delay
      setTimeout(refresh, 1200);
    } catch (e: any) {
      setError(e?.message || "faucet request failed");
    }
  };

  const connectWallet = async () => {
    try {
      setError(null);
      const chain: ChainConfig = { chainId: (nodeInfo?.network as string) || "amp", chainName: "AMP Local", rpc: rpcUrl, rest: restUrl, stakeDenom: "stake", bip44CoinType: 118 };
      const { address } = await getSigningClient(chain);
      setWalletAddress(address);
    } catch (e: any) {
      setError(e?.message || "wallet connect failed");
    }
  };

  const faucetToWallet = async () => {
    if (!walletAddress) { setError("Connect wallet first"); return; }
    try {
      setError(null); setFaucetMsg(null);
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: walletAddress, faucetUrl, creditPath }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `faucet error: ${res.status}`);
      setFaucetMsg(text || "Faucet request sent");
      setTimeout(refresh, 1200);
    } catch (e: any) { setError(e?.message || "faucet request failed"); }
  };

  const faucetStakeToWallet = async (amount = "100000") => {
    if (!walletAddress) { setError("Connect wallet first"); return; }
    try {
      setError(null); setFaucetMsg(null);
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: walletAddress, faucetUrl, creditPath, coins: [`${amount}stake`] }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `faucet error: ${res.status}`);
      setFaucetMsg(text || `Requested ${amount} stake`);
      setTimeout(refresh, 1200);
    } catch (e: any) { setError(e?.message || "faucet request failed"); }
  };

  return (
    <div className="flex min-h-screen w-full justify-center bg-zinc-50 p-6 font-sans dark:bg-black">
      <main className="w-full max-w-4xl rounded-2xl border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-black">
        <h1 className="mb-4 text-2xl font-semibold text-black dark:text-zinc-50">AMP Frontend</h1>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Endpoints</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">REST URL</span>
              <input value={restUrl} onChange={(e) => setRestUrl(e.target.value)} className="rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="http://localhost:1317" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">RPC URL</span>
              <input value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} className="rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="http://localhost:26657" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Faucet URL</span>
              <input value={faucetUrl} onChange={(e) => setFaucetUrl(e.target.value)} className="rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="http://localhost:4500" />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-600 dark:text-zinc-400">Faucet Credit Path</span>
              <input value={creditPath} onChange={(e) => setCreditPath(e.target.value)} className="rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="/credit" />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={wsEnabled} onChange={(e) => setWsEnabled(e.target.checked)} />
              <span className="text-zinc-600 dark:text-zinc-400">Use WebSocket for live blocks</span>
            </label>
            {wsError && <span className="text-red-600 dark:text-red-400">WS error: {wsError}</span>}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Owned Items (by Address)</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            <div className="flex flex-wrap items-center gap-2">
              <input value={ownedLookupAddr} onChange={(e) => setOwnedLookupAddr(e.target.value)} className="min-w-[320px] flex-1 rounded-md border border-black/10 bg-white p-2 text-sm dark:border-white/15 dark:bg-zinc-900" placeholder="cosmos1..." />
              <button onClick={() => setOwnedLookupAddr(aliceAddress)} className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/15">Use Alice</button>
              <button onClick={() => setOwnedLookupAddr(bobAddress)} className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/15">Use Bob</button>
              {walletAddress && (
                <button onClick={() => setOwnedLookupAddr(walletAddress)} className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/15">Use Wallet</button>
              )}
            </div>
            <div className="mt-3">
              {(() => {
                const addr = (ownedLookupAddr || "").trim();
                if (!addr) return <p className="text-sm text-zinc-600 dark:text-zinc-400">Enter an address to view items.</p>;
                const owned = listings.filter((l) => {
                  const status = statusToLabel(l.status);
                  const sellerOwns = (status === "ACTIVE" || status === "CANCELLED") && l.seller === addr;
                  const buyerOwns = status === "SOLD" && (l.buyer || "") === addr;
                  return sellerOwns || buyerOwns;
                });
                if (owned.length === 0) return <p className="text-sm text-zinc-600 dark:text-zinc-400">No owned items found.</p>;
                return (
                  <ul className="text-sm text-black dark:text-zinc-50">
                    {owned.map((l) => {
                      const status = statusToLabel(l.status);
                      const nowOwner = status === "SOLD" ? l.buyer : l.seller;
                      return (
                        <li key={String(l.id)} className="py-1">
                          <span className="font-medium">#{String(l.id)}</span>
                          <span className="ml-2">{l.title || l.description || `${l.asset.amount} ${l.asset.denom}`}</span>
                          <span className="ml-2 text-zinc-500">for {l.price.amount} {l.price.denom}</span>
                          <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{status}</span>
                          <span className="ml-2 text-xs text-zinc-500">owner {nowOwner?.slice(0, 10)}…{nowOwner?.slice(-6)}</span>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Live Blocks</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            {blocks.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Waiting for block events…</p>
            ) : (
              <ul className="text-sm text-black dark:text-zinc-50">
                {blocks.map((b) => (
                  <li key={b.height} className="flex items-center justify-between py-1">
                    <button className={`text-left ${selectedBlock === b.height ? "font-semibold" : ""}`} onClick={() => setSelectedBlock(b.height)}>
                      Height {b.height}
                    </button>
                    <span className="text-zinc-500">{b.time?.replace("T", " ").replace("Z", " Z") || ""}</span>
                    {typeof b.txs === "number" && <span className="text-zinc-500">txs {b.txs}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Blocks With Txs (txs > 0)</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            {blocks.filter((b) => typeof b.txs === "number" && (b.txs ?? 0) > 0).length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No recent blocks with transactions.</p>
            ) : (
              <ul className="text-sm text-black dark:text-zinc-50">
                {blocks
                  .filter((b) => typeof b.txs === "number" && (b.txs ?? 0) > 0)
                  .map((b) => (
                    <li key={b.height} className="flex items-center justify-between py-1">
                      <button className={`text-left ${selectedBlock === b.height ? "font-semibold" : ""}`} onClick={() => setSelectedBlock(b.height)}>
                        Height {b.height}
                      </button>
                      <span className="text-zinc-500">{b.time?.replace("T", " ").replace("Z", " Z") || ""}</span>
                      <span className="text-zinc-500">txs {b.txs}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Block Activity {selectedBlock ? `(#${selectedBlock})` : ""}</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            <div className="mb-2 flex items-center gap-2 text-sm">
              <input value={selectedBlock ?? ""} onChange={(e) => setSelectedBlock(e.target.value)} className="w-40 rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="height" />
              {loadingBlock && <span className="text-zinc-500">Loading…</span>}
            </div>
            {blockEvents && blockEvents.length > 0 ? (
              <ul className="text-sm text-black dark:text-zinc-50">
                {blockEvents.map((ev, idx) => (
                  <li key={idx} className="py-1">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{ev.type}</span>
                    {ev.attributes?.map((a, i) => (
                      <span key={i} className="ml-2 text-xs text-zinc-500">{a.key}:{a.value}</span>
                    ))}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No relevant events in this block.</p>
            )}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Wallet</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={connectWallet} className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15">Connect Keplr</button>
              {walletAddress && (
                <>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{walletAddress}</span>
                  <button onClick={faucetToWallet} className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">Faucet (default)</button>
                  <button onClick={() => faucetStakeToWallet("100000")} className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15">Faucet stake 100000</button>
                </>
              )}
            </div>
            {!walletAddress && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Connect Keplr to get your wallet address and fund it.</p>}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Send Tokens</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-zinc-600 dark:text-zinc-400">To Address</span>
                <input value={sendTo} onChange={(e) => setSendTo(e.target.value)} className="rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="cosmos1..." />
              </label>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Amount / Denom</span>
                <div className="flex gap-2">
                  <input value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} className="w-28 rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" />
                  <input value={sendDenom} onChange={(e) => setSendDenom(e.target.value)} className="w-28 rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <button
                className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
                onClick={async () => {
                  setTxMsg(null); setError(null);
                  if (!walletAddress) { setError("Connect Keplr wallet first"); return; }
                  if (!sendTo) { setError("Enter destination address"); return; }
                  try {
                    setTxPending(true);
                    const chain: ChainConfig = { chainId: (nodeInfo?.network as string) || "amp", chainName: "AMP Local", rpc: rpcUrl, rest: restUrl, stakeDenom: "stake", bip44CoinType: 118 };
                    const { client, address } = await getSigningClient(chain);
                    const coins = [{ denom: sendDenom, amount: sendAmount }];
                    const result = await client.sendTokens(address, sendTo, coins, "auto");
                    if (result.code !== 0) throw new Error(result.rawLog || `tx failed: ${result.code}`);
                    setTxMsg(`Sent ${sendAmount} ${sendDenom}. txhash ${result.transactionHash}`);
                    setTimeout(refresh, 1200);
                  } catch (e: any) { setError(e?.message || "send failed"); }
                  finally { setTxPending(false); }
                }}
                disabled={txPending}
              >{txPending ? "Sending..." : "Send"}</button>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Note: This sends from your connected Keplr wallet. If you want to send from Alice/Bob, import 그 키를 Keplr로 가져오거나 CLI를 사용하세요.</p>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Accounts</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Alice Address</span>
              <input value={aliceAddress} onChange={(e) => setAliceAddress(e.target.value)} className="rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="cosmos1..." />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Bob Address</span>
              <input value={bobAddress} onChange={(e) => setBobAddress(e.target.value)} className="rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="cosmos1..." />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setActive("alice")} className={`rounded-md px-3 py-2 text-sm ${active === "alice" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-black/10 dark:border-white/15"}`}>Use Alice</button>
            <button onClick={() => setActive("bob")} className={`rounded-md px-3 py-2 text-sm ${active === "bob" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-black/10 dark:border-white/15"}`}>Use Bob</button>
            <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">Active: {active} {activeAddress ? `(${activeAddress.slice(0, 10)}…${activeAddress.slice(-6)})` : "(no address)"}</span>
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-medium text-black dark:text-zinc-50">Balances</h2>
            <div className="flex items-center gap-2">
              <button onClick={refresh} disabled={loadingBalances} className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15">Refresh</button>
              <button onClick={requestFaucet} className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">Request Faucet</button>
            </div>
          </div>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            {balances.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No balances or address not set.</p>) : (
              <ul className="text-sm text-black dark:text-zinc-50">
                {balances.map((c) => (
                  <li key={`${c.denom}`} className="py-0.5">{c.amount} {c.denom}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Sell (List Item)</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Title</span>
                <input value={sellTitle} onChange={(e) => setSellTitle(e.target.value)} className="rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Description</span>
                <input value={sellDesc} onChange={(e) => setSellDesc(e.target.value)} className="rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" />
              </label>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Asset (what you sell)</span>
                <div className="flex gap-2">
                  <input value={sellAssetAmt} onChange={(e) => setSellAssetAmt(e.target.value)} className="w-32 rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="1" />
                  <input value={sellAssetDenom} onChange={(e) => setSellAssetDenom(e.target.value)} className="w-40 rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="token" />
                </div>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Price (what buyer pays)</span>
                <div className="flex gap-2">
                  <input value={sellPriceAmt} onChange={(e) => setSellPriceAmt(e.target.value)} className="w-32 rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="1000" />
                  <input value={sellPriceDenom} onChange={(e) => setSellPriceDenom(e.target.value)} className="w-40 rounded-md border border-black/10 bg-white p-2 dark:border-white/15 dark:bg-zinc-900" placeholder="stake" />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <button
                className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
                onClick={async () => {
                  setTxMsg(null); setError(null);
                  if (!activeAddress) { setError("Set active address"); return; }
                  try {
                    setTxPending(true);
                    const chain: ChainConfig = { chainId: (nodeInfo?.network as string) || "amp", chainName: "AMP Local", rpc: rpcUrl, rest: restUrl, stakeDenom: "stake", bip44CoinType: 118 };
                    const { client, address } = await getSigningClient(chain);
                    if (address !== activeAddress) {
                      // Keplr account may differ; proceed anyway, but warn.
                    }
                    const msg = buildMsgListItem({
                      seller: address,
                      title: sellTitle,
                      description: sellDesc,
                      asset: { amount: sellAssetAmt, denom: sellAssetDenom },
                      price: { amount: sellPriceAmt, denom: sellPriceDenom },
                    });
                    const result = await client.signAndBroadcast(address, [msg], "auto");
                    if (result.code !== 0) throw new Error(result.rawLog || `tx failed: ${result.code}`);
                    setTxMsg(`Listed! txhash ${result.transactionHash}`);
                    setTimeout(refresh, 1500);
                  } catch (e: any) { setError(e?.message || "sell failed"); }
                  finally { setTxPending(false); }
                }}
                disabled={txPending}
              >{txPending ? "Listing..." : "List Item"}</button>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Your Listings (Selling)</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            {activeAddress ? (
              (() => {
                const mine = listings.filter((l) => l.seller === activeAddress);
                if (mine.length === 0) return <p className="text-sm text-zinc-600 dark:text-zinc-400">No listings from this address.</p>;
                return (
                  <ul className="text-sm text-black dark:text-zinc-50">
                    {mine.map((l) => (
                      <li key={String(l.id)} className="py-1">
                        <span className="font-medium">#{String(l.id)}</span>
                        <span className="ml-2">{l.title || l.description || `${l.asset.amount} ${l.asset.denom}`}</span>
                        <span className="ml-2 text-zinc-500">for {l.price.amount} {l.price.denom}</span>
                        <span className="ml-2 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{statusToLabel(l.status)}</span>
                        {l.buyer ? <span className="ml-2 text-xs text-zinc-500">buyer {l.buyer.slice(0, 10)}…{l.buyer.slice(-6)}</span> : null}
                      </li>
                    ))}
                  </ul>
                );
              })()
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Set an active address to see listings.</p>
            )}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Your Purchases (Bought)</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            {activeAddress ? (
              (() => {
                const mine = listings.filter((l) => (l.buyer || "") === activeAddress);
                if (mine.length === 0) return <p className="text-sm text-zinc-600 dark:text-zinc-400">No purchases found for this address.</p>;
                return (
                  <ul className="text-sm text-black dark:text-zinc-50">
                    {mine.map((l) => (
                      <li key={String(l.id)} className="py-1">
                        <span className="font-medium">#{String(l.id)}</span>
                        <span className="ml-2">{l.title || l.description || `${l.asset.amount} ${l.asset.denom}`}</span>
                        <span className="ml-2 text-zinc-500">for {l.price.amount} {l.price.denom}</span>
                        <span className="ml-2 text-xs text-zinc-500">seller {l.seller.slice(0, 10)}…{l.seller.slice(-6)}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Set an active address to see purchases.</p>
            )}
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Active Listings (All)</h2>
          <div className="rounded-md border border-black/10 p-4 dark:border-white/15">
            {listings.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">No listings on chain.</p>
            ) : (
              <ul className="text-sm text-black dark:text-zinc-50">
                {listings
                  .filter((l) => statusToLabel(l.status) === "ACTIVE")
                  .map((l) => (
                    <li key={String(l.id)} className="flex items-center justify-between py-1">
                      <span className="font-medium">#{String(l.id)}</span>
                      <span className="ml-2 flex-1">{l.title || l.description || `${l.asset.amount} ${l.asset.denom}`}</span>
                      <span className="ml-2 text-zinc-500">for {l.price.amount} {l.price.denom}</span>
                      <span className="ml-2 text-xs text-zinc-500">seller {l.seller.slice(0, 10)}…{l.seller.slice(-6)}</span>
                      <button
                        className="ml-3 rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/15"
                        onClick={async () => {
                          setTxMsg(null); setError(null);
                          if (!activeAddress) { setError("Set active address"); return; }
                          try {
                            setTxPending(true);
                            const chain: ChainConfig = { chainId: (nodeInfo?.network as string) || "amp", chainName: "AMP Local", rpc: rpcUrl, rest: restUrl, stakeDenom: "stake", bip44CoinType: 118 };
                            const { client, address } = await getSigningClient(chain);
                            const msg = buildMsgBuyItem({ buyer: address, listing_id: Number(l.id) });
                            const result = await client.signAndBroadcast(address, [msg], "auto");
                            if (result.code !== 0) throw new Error(result.rawLog || `tx failed: ${result.code}`);
                            setTxMsg(`Bought! txhash ${result.transactionHash}`);
                            setTimeout(refresh, 1500);
                          } catch (e: any) { setError(e?.message || "buy failed"); }
                          finally { setTxPending(false); }
                        }}
                        disabled={txPending || (activeAddress && l.seller === activeAddress)}
                      >Buy</button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mb-2">
          <h2 className="mb-2 text-lg font-medium text-black dark:text-zinc-50">Node</h2>
          <div className="rounded-md border border-black/10 p-4 text-sm dark:border-white/15 dark:text-zinc-50">
            {nodeInfo ? (
              <div>
                <div>Network: {nodeInfo?.network}</div>
                <div>Version: {nodeInfo?.version}</div>
                <div>Moniker: {nodeInfo?.moniker}</div>
              </div>
            ) : (
              <div className="text-zinc-600 dark:text-zinc-400">No node info</div>
            )}
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950 dark:text-red-300">{error}</div>
        )}
        {txMsg && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950 dark:text-emerald-300">{txMsg}</div>
        )}
        {faucetMsg && (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950 dark:text-emerald-300">{faucetMsg}</div>
        )}
      </main>
    </div>
  );
}
