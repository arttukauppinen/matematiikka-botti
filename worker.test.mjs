import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const { publicKey, privateKey } = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const env = { DISCORD_PUBLIC_KEY: Buffer.from(await crypto.subtle.exportKey('raw', publicKey)).toString('hex') };

const call = async (i, tamper = '') => {
  const body = JSON.stringify(i);
  const sig = Buffer.from(await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode('1' + body))).toString('hex');
  const headers = { 'x-signature-ed25519': sig, 'x-signature-timestamp': '1' };
  return worker.fetch(new Request('http://x', { method: 'POST', body: body + tamper, headers }), env);
};

const roll = async (...options) => +(await (await call({ type: 2, data: { options } })).json()).data.content.split(' ')[1];

test('väärä allekirjoitus → 401', async () => {
  assert.equal((await call({ type: 1 }, ' ')).status, 401);
  assert.equal((await worker.fetch(new Request('http://x', { method: 'POST', body: '{}' }), env)).status, 401);
});

test('PING → PONG', async () => {
  assert.deepEqual(await (await call({ type: 1 })).json(), { type: 1 });
});

test('roll: min ≔ 1, min > max ⇒ swap, kattaa välin', async () => {
  assert.equal(await roll({ name: 'max', value: 1 }), 1);
  const seen = new Set();
  for (let k = 0; k < 300; k++) seen.add(await roll({ name: 'max', value: 3 }, { name: 'min', value: 5 }));
  assert.deepEqual([...seen].sort(), [3, 4, 5]);
});
