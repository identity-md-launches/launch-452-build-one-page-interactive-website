import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { BlockLookupError, fingerprint, formatDuration, formatTimestamp, getBlock, isEthereumAddress, parseBlockNumber } from '../src/lib/chain.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const hash = `0x${'a'.repeat(64)}`;
const response = (result: unknown) => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200 });
const block = (number = 20_000_000, timestamp = 1_717_281_407) => ({ number: `0x${number.toString(16)}`, timestamp: `0x${timestamp.toString(16)}`, hash });

test('accepts hex addresses, tolerates surrounding spaces, and rejects ENS or invalid characters', () => {
  assert.equal(isEthereumAddress(address), true);
  assert.equal(isEthereumAddress(`  ${address.toLowerCase()} `), true);
  for (const value of ['', 'vitalik.eth', '0x123', address.replace('d8', 'g8'), `${address}0`]) {
    assert.equal(isEthereumAddress(value), false, value);
  }
});

test('block inputs include genesis and reject signs, fractions, commas, exponents and unsafe integers', () => {
  assert.equal(parseBlockNumber('0'), 0);
  assert.equal(parseBlockNumber(' 20000000 '), 20_000_000);
  assert.equal(parseBlockNumber('00042'), 42);
  assert.equal(parseBlockNumber(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  for (const value of ['', ' ', '-1', '+1', '1.2', '20,000,000', '1e7', '0x10', 'NaN', '9007199254740992']) {
    assert.equal(parseBlockNumber(value), null, value);
  }
});

test('fingerprints are stable for address casing and different for different addresses', () => {
  const first = fingerprint(address);
  assert.deepEqual(first, fingerprint(address.toLowerCase()));
  assert.deepEqual(first, fingerprint(` ${address} `));
  assert.notDeepEqual(first, fingerprint(`0x${'1'.repeat(40)}`));
  assert.equal(first.rings.length, 20);
  assert.match(first.code, /^[0-9A-F]{8}$/);
  assert.ok(first.rings.every(ring => Object.values(ring).every(Number.isFinite)));
});

test('formats timestamps explicitly in UTC including zero, and duration without block-time estimates', () => {
  assert.equal(formatTimestamp(0), '01 Jan 1970, 00:00:00 UTC');
  assert.equal(formatTimestamp(1_717_281_407), '01 Jun 2024, 22:36:47 UTC');
  assert.equal(formatDuration(0), '0 seconds');
  assert.equal(formatDuration(90_061), '1 day, 1 hour, 1 minute, 1 second');
  assert.equal(formatDuration(-120), '2 minutes');
  assert.throws(() => formatTimestamp(Number.NaN), RangeError);
  assert.throws(() => formatDuration(Infinity), RangeError);
});

test('RPC requests use hex block quantities and return the validated provider timestamp', async () => {
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls += 1;
    assert.equal(input, 'https://ethereum-rpc.publicnode.com');
    assert.equal(init?.credentials, 'omit');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: ['0x1312d00', false],
    });
    return response(block());
  };
  assert.deepEqual(await getBlock(20_000_000), { number: 20_000_000, timestamp: 1_717_281_407, hash, source: 'rpc' });
  assert.equal(calls, 1);
});

test('RPC handles the genesis number and its actual zero timestamp', async () => {
  globalThis.fetch = async (_input, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)).params, ['0x0', false]);
    return response(block(0, 0));
  };
  assert.equal((await getBlock(0)).timestamp, 0);
});

test('first-provider failure falls back to the second provider', async () => {
  const endpoints: string[] = [];
  globalThis.fetch = async input => {
    endpoints.push(String(input));
    if (endpoints.length === 1) throw new TypeError('Network failure');
    return response(block());
  };
  assert.equal((await getBlock(20_000_000)).number, 20_000_000);
  assert.deepEqual(endpoints, ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com']);
});

test('unmined blocks yield a recoverable error and never a synthetic timestamp', async () => {
  globalThis.fetch = async () => response(null);
  await assert.rejects(getBlock(99_999_999), error => error instanceof BlockLookupError && error.code === 'not_found');
});

test('a null block response remains actionable when the other provider fails HTTP, in either order', async () => {
  for (const nullFirst of [true, false]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return (calls === 1) === nullFirst ? response(null) : new Response('Provider unavailable', { status: 525 });
    };
    await assert.rejects(getBlock(99_999_999), error => error instanceof BlockLookupError
      && error.code === 'not_found' && error.message.includes('Try an earlier block number'));
    assert.equal(calls, 2);
  }
});

test('a malformed provider response is preserved when the other provider is unreachable', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return response({ ...block(), timestamp: 'invalid' });
    throw new TypeError('Network failure');
  };
  await assert.rejects(getBlock(20_000_000), error => error instanceof BlockLookupError
    && error.code === 'invalid_response' && error.message.includes('incomplete data'));
});

test('rejects mismatched blocks, invalid timestamps, incomplete hashes and malformed RPC envelopes', async () => {
  const badResults = [block(1), { ...block(), timestamp: 'soon' }, { ...block(), timestamp: '0xffffffffffffffff' }, { ...block(), hash: '0xabc' }];
  for (const result of badResults) {
    globalThis.fetch = async () => response(result);
    await assert.rejects(getBlock(20_000_000), error => error instanceof BlockLookupError && error.code === 'invalid_response');
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ result: block() }));
  await assert.rejects(getBlock(20_000_000), BlockLookupError);
});

test('invalid block numbers never contact a provider', async () => {
  globalThis.fetch = async () => { throw new Error('Fetch must not run'); };
  for (const number of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(getBlock(number), error => error instanceof BlockLookupError && error.code === 'invalid_block');
  }
});

test('cancellation stops in-flight work without contacting the fallback', async () => {
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  };
  const controller = new AbortController();
  const result = getBlock(20_000_000, controller.signal);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('already-aborted requests do not contact a provider', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return response(block()); };
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(getBlock(20_000_000, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('a provider that stalls is aborted after six seconds and the fallback can recover', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    if (calls > 1) return response(block());
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
    });
  };
  const result = getBlock(20_000_000);
  context.mock.timers.tick(6_000);
  assert.equal((await result).number, 20_000_000);
  assert.equal(calls, 2);
});
