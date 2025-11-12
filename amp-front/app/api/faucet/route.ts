import { NextRequest } from "next/server";
import { DEFAULT_FAUCET_CREDIT_PATH, DEFAULT_FAUCET_URL } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const { address, faucetUrl, creditPath, coins } = await req.json();
    if (!address || typeof address !== "string") {
      return new Response(JSON.stringify({ error: "address required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const base = (faucetUrl as string) || DEFAULT_FAUCET_URL;
    const path = (creditPath as string) || DEFAULT_FAUCET_CREDIT_PATH;
    const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : "/" + path}`;

    // Many Ignite faucets accept { address } or { address, coins: ["100000stake", "5token"] } JSON body.
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(coins && Array.isArray(coins) && coins.length > 0 ? { address, coins } : { address }),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "faucet request failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
