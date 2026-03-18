/**
 * Kraken asset code normalization.
 *
 * Kraken uses non-standard codes for many assets:
 *   XXBT → BTC, XETH → ETH, ZUSD → USD, etc.
 */
export const KRAKEN_ASSET_MAP: Record<string, string> = {
  // X-prefixed crypto
  XXBT: 'BTC',
  XETH: 'ETH',
  XLTC: 'LTC',
  XXRP: 'XRP',
  XXLM: 'XLM',
  XXMR: 'XMR',
  XZEC: 'ZEC',
  XDAO: 'DAO',
  XICN: 'ICN',
  XMLN: 'MLN',
  XREP: 'REP',
  XREPV2: 'REPV2',
  // Z-prefixed fiat
  ZUSD: 'USD',
  ZEUR: 'EUR',
  ZGBP: 'GBP',
  ZCAD: 'CAD',
  ZJPY: 'JPY',
  ZAUD: 'AUD',
  // Already normalized (pass-through)
  BTC: 'BTC',
  ETH: 'ETH',
  SOL: 'SOL',
  ADA: 'ADA',
  DOT: 'DOT',
  MATIC: 'MATIC',
  AVAX: 'AVAX',
  ATOM: 'ATOM',
  LINK: 'LINK',
  UNI: 'UNI',
  AAVE: 'AAVE',
  MKR: 'MKR',
  COMP: 'COMP',
  SNX: 'SNX',
  GRT: 'GRT',
  FIL: 'FIL',
  NEAR: 'NEAR',
  ALGO: 'ALGO',
  XTZ: 'XTZ',
  EOS: 'EOS',
  TRX: 'TRX',
  DASH: 'DASH',
  ETC: 'ETC',
  FTM: 'FTM',
  OP: 'OP',
  ARB: 'ARB',
  APT: 'APT',
  INJ: 'INJ',
  USDT: 'USDT',
  USDC: 'USDC',
  DAI: 'DAI',
  EUR: 'EUR',
  USD: 'USD',
  GBP: 'GBP',
  // Staked variants (treat same as base)
  ETH2: 'ETH',
  'ETH2.S': 'ETH',
  XBT: 'BTC',
};

/**
 * Normalize a Kraken asset code to a standard symbol.
 * Returns the input unchanged if not in the map.
 */
export function normalizeKrakenAsset(krakenAsset: string): string {
  // Strip .S suffix (staked variant, e.g. "DOT.S" → "DOT")
  const stripped = krakenAsset.replace(/\.S$/, '');
  return KRAKEN_ASSET_MAP[stripped] ?? KRAKEN_ASSET_MAP[krakenAsset] ?? krakenAsset;
}

/** CoinGecko ID map for normalized Kraken symbols */
export const KRAKEN_COINGECKO_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  ADA: 'cardano',
  XRP: 'ripple',
  DOT: 'polkadot',
  LTC: 'litecoin',
  XLM: 'stellar',
  XMR: 'monero',
  ZEC: 'zcash',
  DASH: 'dash',
  ETC: 'ethereum-classic',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  NEAR: 'near',
  ALGO: 'algorand',
  XTZ: 'tezos',
  UNI: 'uniswap',
  AAVE: 'aave',
  MKR: 'maker',
  COMP: 'compound-governance-token',
  SNX: 'havven',
  GRT: 'the-graph',
  FIL: 'filecoin',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  FTM: 'fantom',
  EOS: 'eos',
  TRX: 'tron',
  OP: 'optimism',
  ARB: 'arbitrum',
  APT: 'aptos',
  INJ: 'injective-protocol',
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
};

export function krakenAssetToId(krakenAsset: string): string | undefined {
  const normalized = normalizeKrakenAsset(krakenAsset);
  return KRAKEN_COINGECKO_MAP[normalized];
}
