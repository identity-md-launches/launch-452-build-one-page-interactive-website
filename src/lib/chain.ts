export interface ChainBlock {
  number: number;
  /** Unix timestamp in seconds, as returned by the execution-layer block. */
  timestamp: number;
  hash: string;
  source: 'rpc';
}

export interface Fingerprint {
  seed: number;
  hue: number;
  code: string;
  rings: Array<{
    radius: number;
    tilt: number;
    rotation: number;
    thickness: number;
    opacity: number;
  }>;
}

export type BlockLookupErrorCode = 'invalid_block' | 'not_found' | 'unavailable' | 'invalid_response';

export class BlockLookupError extends Error {
  constructor(message: string, public readonly code: BlockLookupErrorCode) {
    super(message);
    this.name = 'BlockLookupError';
  }
}

const RPC_ENDPOINTS = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com'];
const ATTEMPT_TIMEOUT_MS = 6_000;
const MAX_TIMESTAMP = 8_640_000_000_000;

/** Checks the address shape; intentionally does not enforce mixed-case EIP-55 checksums. */
export function isEthereumAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

/** Accept decimal digits only. No separators, signs, exponents or decimal fractions. */
export function parseBlockNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

/** Decorative, deterministic FNV-1a seed and Mulberry32 sequence; not a security identity. */
export function fingerprint(address: string): Fingerprint {
  const canonical = address.trim().toLowerCase();
  let seed = 2_166_136_261;
  for (let index = 0; index < canonical.length; index += 1) {
    seed = Math.imul(seed ^ canonical.charCodeAt(index), 16_777_619) >>> 0;
  }
  let state = seed;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    seed,
    hue: 150 + random() * 34,
    code: seed.toString(16).toUpperCase().padStart(8, '0'),
    rings: Array.from({ length: 20 }, (_, index) => ({
      radius: 45 + index * 5.1 + random() * 4,
      tilt: 0.33 + random() * 0.46,
      rotation: random() * 180,
      thickness: 0.55 + random() * 1.35,
      opacity: 0.3 + random() * 0.65,
    })),
  };
}

export function formatTimestamp(timestamp: number): string {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > MAX_TIMESTAMP) {
    throw new RangeError('Timestamp is outside the supported date range.');
  }
  return `${new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23', timeZone: 'UTC',
  }).format(new Date(timestamp * 1_000))} UTC`;
}

/** An absolute difference, retaining seconds instead of estimating from block count. */
export function formatDuration(seconds: number): string {
  if (!Number.isSafeInteger(seconds)) throw new RangeError('Duration must be a safe integer number of seconds.');
  let remaining = Math.abs(seconds);
  const parts: string[] = [];
  const units = [[86_400, 'day'], [3_600, 'hour'], [60, 'minute'], [1, 'second']] as const;
  for (const [size, label] of units) {
    const count = Math.floor(remaining / size);
    remaining %= size;
    if (count > 0) parts.push(`${count.toLocaleString('en-US')} ${label}${count === 1 ? '' : 's'}`);
  }
  return parts.join(', ') || '0 seconds';
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function quantity(value: unknown): number | null {
  if (typeof value !== 'string' || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function parseResponse(payload: unknown, expectedNumber: number): ChainBlock {
  if (!object(payload) || payload.jsonrpc !== '2.0' || payload.id !== 1 || 'error' in payload) {
    throw new BlockLookupError('The block provider returned an unexpected response. Please try again.', 'invalid_response');
  }
  if (payload.result === null) {
    throw new BlockLookupError('This block is not available yet. Try an earlier block number.', 'not_found');
  }
  if (object(payload.result)) {
    const { number, timestamp, hash } = payload.result;
    const parsedNumber = quantity(number);
    const parsedTimestamp = quantity(timestamp);
    if (parsedNumber === expectedNumber && parsedTimestamp !== null && parsedTimestamp <= MAX_TIMESTAMP
      && typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return { number: parsedNumber, timestamp: parsedTimestamp, hash, source: 'rpc' };
    }
  }
  throw new BlockLookupError('The block provider returned incomplete data. Please try again.', 'invalid_response');
}

function abortError(): DOMException {
  return new DOMException('Block lookup cancelled.', 'AbortError');
}

async function requestBlock(endpoint: string, number: number, signal?: AbortSignal): Promise<ChainBlock> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, ATTEMPT_TIMEOUT_MS);
  try {
    if (signal?.aborted) throw abortError();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: [`0x${number.toString(16)}`, false] }),
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new BlockLookupError('The block provider is temporarily unavailable.', 'unavailable');
    const payload: unknown = await response.json();
    if (signal?.aborted) throw abortError();
    return parseResponse(payload, number);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

/** Read-only, keyless mainnet lookup. Two bounded attempts; never substitutes an estimated date. */
export async function getBlock(number: number, signal?: AbortSignal): Promise<ChainBlock> {
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new BlockLookupError('Enter a whole block number of 0 or higher.', 'invalid_block');
  }
  let responseError: BlockLookupError | undefined;
  for (const endpoint of RPC_ENDPOINTS) {
    if (signal?.aborted) throw abortError();
    try {
      return await requestBlock(endpoint, number, signal);
    } catch (error) {
      if (signal?.aborted) throw abortError();
      // A valid null result gives a more useful answer than another provider's outage.
      // Keep malformed-response details too, instead of describing every failure as offline.
      if (error instanceof BlockLookupError && error.code === 'not_found') responseError = error;
      else if (error instanceof BlockLookupError && error.code === 'invalid_response' && !responseError) responseError = error;
    }
  }
  if (responseError) throw responseError;
  throw new BlockLookupError('Unable to reach Ethereum right now. Check your connection and try again.', 'unavailable');
}
