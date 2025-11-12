import { DEFAULT_REST_URL } from "./config";

export type AmpCoin = { denom: string; amount: string };

export type Listing = {
  id: string | number;
  seller: string;
  title?: string;
  description?: string;
  asset: AmpCoin;
  price: AmpCoin;
  status: string | number;
  buyer?: string;
  created_at?: string | number;
};

export type ListingsResponse = {
  listings: Listing[];
};

export function statusToLabel(status: string | number): string {
  if (typeof status === "number") {
    return ["ACTIVE", "SOLD", "CANCELLED"][status] || String(status);
  }
  const s = status.toUpperCase();
  if (s.includes("ACTIVE")) return "ACTIVE";
  if (s.includes("SOLD")) return "SOLD";
  if (s.includes("CANCELLED")) return "CANCELLED";
  return status;
}

export async function getListings(restUrl = DEFAULT_REST_URL): Promise<Listing[]> {
  const res = await fetch(`${restUrl.replace(/\/$/, "")}/amp/amp/v1/listings`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Listings error: ${res.status}`);
  const json = (await res.json()) as ListingsResponse;
  return json.listings || [];
}

