/* Keplr + CosmJS helpers for AMP chain */
"use client";

import { DEFAULT_REST_URL } from "./config";
import { Registry, EncodeObject } from "@cosmjs/proto-signing";
import { SigningStargateClient, GasPrice } from "@cosmjs/stargate";

export const AMP_TYPEURL_LIST = "/amp.amp.v1.MsgListItem";
export const AMP_TYPEURL_BUY = "/amp.amp.v1.MsgBuyItem";

type Coin = { denom: string; amount: string };

// Minimal protobuf varint utilities
function encodeVarint(value: number | bigint): Uint8Array {
  let v = BigInt(value);
  const bytes: number[] = [];
  while (v >= 0x80n) {
    bytes.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  bytes.push(Number(v));
  return new Uint8Array(bytes);
}

function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function concat(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

// field helpers (wire type 2 = length-delimited)
function tag(fieldNumber: number, wireType: number): Uint8Array {
  return encodeVarint(BigInt((fieldNumber << 3) | wireType));
}

function fldString(fieldNumber: number, value: string): Uint8Array {
  const data = utf8(value);
  return concat(tag(fieldNumber, 2), encodeVarint(BigInt(data.length)), data);
}

function encodeCoinNested(c: Coin): Uint8Array {
  const denom = fldString(1, c.denom);
  const amount = fldString(2, c.amount);
  return concat(denom, amount);
}

function fldCoin(fieldNumber: number, c: Coin): Uint8Array {
  const body = encodeCoinNested(c);
  return concat(tag(fieldNumber, 2), encodeVarint(BigInt(body.length)), body);
}

// Encoders for AMP custom messages
export function encodeMsgListItem(value: {
  seller: string;
  title?: string;
  description?: string;
  asset: Coin;
  price: Coin;
}): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(fldString(1, value.seller));
  if (value.title) parts.push(fldString(2, value.title));
  if (value.description) parts.push(fldString(3, value.description));
  parts.push(fldCoin(4, value.asset));
  parts.push(fldCoin(5, value.price));
  return concat(...parts);
}

export function encodeMsgBuyItem(value: { buyer: string; listing_id: number }): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(fldString(1, value.buyer));
  parts.push(concat(tag(2, 0), encodeVarint(BigInt(value.listing_id))));
  return concat(...parts);
}

// CosmJS registry with minimal GeneratedType-like interface
const listType = {
  encode: (v: any) => ({ finish: () => encodeMsgListItem(v) }),
  decode: (_: Uint8Array) => ({}),
  fromPartial: (v: any) => v,
} as any;

const buyType = {
  encode: (v: any) => ({ finish: () => encodeMsgBuyItem(v) }),
  decode: (_: Uint8Array) => ({}),
  fromPartial: (v: any) => v,
} as any;

export function getRegistry(): Registry {
  const reg = new Registry();
  reg.register(AMP_TYPEURL_LIST, listType);
  reg.register(AMP_TYPEURL_BUY, buyType);
  return reg;
}

export type ChainConfig = {
  chainId: string;
  chainName: string;
  rpc: string;
  rest: string;
  stakeDenom: string;
  bip44CoinType?: number;
};

export async function enableKeplr(chain: ChainConfig) {
  const anyWindow = window as any;
  if (!anyWindow.keplr) throw new Error("Keplr not found. Install Keplr extension.");

  const bech32 = "cosmos"; // from app.App AccountAddressPrefix
  const coinType = chain.bip44CoinType ?? 118;

  await anyWindow.keplr.experimentalSuggestChain({
    chainId: chain.chainId,
    chainName: chain.chainName,
    rpc: chain.rpc,
    rest: chain.rest,
    bip44: { coinType },
    bech32Config: {
      bech32PrefixAccAddr: bech32,
      bech32PrefixAccPub: bech32 + "pub",
      bech32PrefixValAddr: bech32 + "valoper",
      bech32PrefixValPub: bech32 + "valoperpub",
      bech32PrefixConsAddr: bech32 + "valcons",
      bech32PrefixConsPub: bech32 + "valconspub",
    },
    stakeCurrency: {
      coinDenom: chain.stakeDenom,
      coinMinimalDenom: chain.stakeDenom,
      coinDecimals: 6,
    },
    currencies: [
      { coinDenom: chain.stakeDenom, coinMinimalDenom: chain.stakeDenom, coinDecimals: 6 },
      { coinDenom: "token", coinMinimalDenom: "token", coinDecimals: 6 },
    ],
    feeCurrencies: [
      { coinDenom: chain.stakeDenom, coinMinimalDenom: chain.stakeDenom, coinDecimals: 6, gasPriceStep: { low: 0.01, average: 0.025, high: 0.04 } },
    ],
    features: ["stargate", "cosmwasm"].filter(Boolean),
  });

  await anyWindow.keplr.enable(chain.chainId);
}

export async function getSigningClient(chain: ChainConfig) {
  const anyWindow = window as any;
  await enableKeplr(chain);
  const offlineSigner = anyWindow.getOfflineSignerAuto
    ? await anyWindow.getOfflineSignerAuto(chain.chainId)
    : await anyWindow.keplr.getOfflineSignerAuto(chain.chainId);

  const registry = getRegistry();
  const client = await SigningStargateClient.connectWithSigner(chain.rpc, offlineSigner, {
    registry,
    gasPrice: GasPrice.fromString(`0.025${chain.stakeDenom}`),
  });

  const [account] = await offlineSigner.getAccounts();
  return { client, address: account.address };
}

export function buildMsgListItem(params: {
  seller: string;
  title?: string;
  description?: string;
  asset: Coin;
  price: Coin;
}): EncodeObject {
  return {
    typeUrl: AMP_TYPEURL_LIST,
    value: {
      seller: params.seller,
      title: params.title ?? "",
      description: params.description ?? "",
      asset: params.asset,
      price: params.price,
    },
  };
}

export function buildMsgBuyItem(params: { buyer: string; listing_id: number }): EncodeObject {
  return {
    typeUrl: AMP_TYPEURL_BUY,
    value: { buyer: params.buyer, listing_id: params.listing_id },
  };
}

