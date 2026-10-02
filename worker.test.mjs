import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const { publicKey, privateKey } = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const balances = new Map();
const coins = {
  get: async (key) => balances.get(key),
  put: async (key, value) => balances.set(key, value),
};
const env = { DISCORD_PUBLIC_KEY: Buffer.from(await crypto.subtle.exportKey('raw', publicKey)).toString('hex'), COINS: coins };

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

test('makelippo', async () => {
  const lippo = async (s) => (await (await call({ type: 2, data: { name: 'makelippo', options: [{ name: 'laskutoimitus', value: s }] } })).json()).data;
  for (const [s, v] of [['2+3*4', '14'], ['(2+3)*4', '20'], ['2^3^2', '512'], ['-2^2', '-4'], ['1,5*2', '3'], ['0.1+0.2', '0,3'], ['7÷2', '3,5'], ['2 × −3', '-6']]) {
    assert.equal((await lippo(s)).content, `\`${s}\` = **${v}** 🤓`);
  }
  for (const s of ['1/0', '2+', '(1', '1)', 'abc', '']) assert.equal((await lippo(s)).flags, 64);
});

test('goneisii: kolme hedelmärullaa ja voitot', async () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const jackpot = (await (await call({ type: 2, data: { name: 'goneisii', options: [] }, member: { user: { id: 'player-1' } } })).json()).data.content;
    assert.match(jackpot, /^🎰 (🍒 \| ){2}🍒 🎰\nJACKPOT![\s\S]*\+100 kolikkoa \| saldo: \*\*100\*\*/u);

    let spin = 0;
    Math.random = () => [0, 0.21, 0][spin++];
    const pair = (await (await call({ type: 2, data: { name: 'goneisii', options: [] }, member: { user: { id: 'player-1' } } })).json()).data.content;
    assert.match(pair, /^🎰 🍒 \| 🍋 \| 🍒 🎰\nclose ✨[\s\S]*\+10 kolikkoa \| saldo: \*\*110\*\*/u);

    const balance = (await (await call({ type: 2, data: { name: 'kukkaro', options: [] }, member: { user: { id: 'player-1' } } })).json()).data.content;
    assert.equal(balance, 'Sulla on **110** kolikkoa 🪙');
  } finally {
    Math.random = originalRandom;
  }
});

test('roll: min ≔ 1, min > max ⇒ swap, kattaa välin', async () => {
  assert.equal(await roll({ name: 'max', value: 1 }), 1);
  const seen = new Set();
  for (let k = 0; k < 300; k++) seen.add(await roll({ name: 'max', value: 3 }, { name: 'min', value: 5 }));
  assert.deepEqual([...seen].sort(), [3, 4, 5]);
});
