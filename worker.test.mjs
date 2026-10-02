import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const { publicKey, privateKey } = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const balances = new Map();
const coins = {
  get: async (key) => balances.get(key),
  put: async (key, value) => balances.set(key, value),
  list: async ({ prefix }) => ({ keys: [...balances.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
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

test('goneisii maksaa 3, gruunavaiglaava panos, päivälahja 10 vain nollasaldolla', async () => {
  const play = async (id, name, randoms = [], ...options) => {
    Math.random = () => randoms.shift();
    return (await (await call({ type: 2, data: { name, options }, member: { user: { id } } })).json()).data;
  };
  const kruuna = { name: 'valinta', value: 'kruuna' };
  const panos = (value) => ({ name: 'panos', value });
  const originalRandom = Math.random;
  try {
    assert.equal((await play('a', 'kukkaro')).content, 'Sulla on **10** kolikkoa 🪙');
    assert.equal((await play('a', 'goneisii', [0, 0.21, 0.41])).content, '🎰 🍒 | 🍋 | 🍉 🎰\nei voittoa\n-3 🪙');
    assert.equal((await play('a', 'gruunavaiglaava', [0], kruuna, panos(2))).content, '🪙 kruuna\n+2 🪙');
    assert.equal((await play('a', 'gruunavaiglaava', [0.9], kruuna)).content, '🪙 klaava\n-1 🪙');
    assert.equal((await play('a', 'gruunavaiglaava', [0.9], kruuna, panos(6))).content, '🪙 klaava\n-6 🪙');
    assert.equal((await play('a', 'goneisii', [0, 0, 0])).flags, 64);
    assert.equal((await play('a', 'gruunavaiglaava', [0], kruuna, panos(3))).flags, 64);
    assert.equal((await play('a', 'gruunavaiglaava', [0.9], kruuna, panos(2))).content, '🪙 klaava\n-2 🪙');
    assert.equal((await play('a', 'gruunavaiglaava', [0], kruuna)).flags, 64);
    assert.equal((await play('a', 'kukkaro')).content, 'Sulla on **0** kolikkoa 🪙');

    assert.equal((await play('b', 'goneisii', [0, 0, 0])).content, '🎰 🍒 | 🍒 | 🍒 🎰\nJACKPOT! 🎉\n+97 🪙');
    assert.equal((await play('b', 'goneisii', [0, 0.21, 0])).content, '🎰 🍒 | 🍋 | 🍒 🎰\nclose ✨\n+7 🪙');
    assert.equal((await play('b', 'kukkaro')).content, 'Sulla on **114** kolikkoa 🪙');

    balances.set('c', '0 2000-01-01');
    balances.set('d', '1 2000-01-01');
    balances.set('e', '190');
    assert.equal((await play('c', 'kukkaro')).content, 'Sulla on **10** kolikkoa 🪙');
    assert.equal((await play('d', 'kukkaro')).content, 'Sulla on **1** kolikkoa 🪙');
    assert.equal((await play('e', 'kukkaro')).content, 'Sulla on **190** kolikkoa 🪙');
  } finally {
    Math.random = originalRandom;
  }
});

test('leaderboard: palvelimen pelaajat tasattuna, rikkain ensin', async () => {
  const send = async (name, guild_id, member, randoms = [], ...options) => {
    Math.random = () => randoms.shift();
    return (await (await call({ type: 2, data: { name, options }, guild_id, member })).json()).data;
  };
  const originalRandom = Math.random;
  try {
    await send('gruunavaiglaava', 'g1', { user: { id: 'l3', username: 'Matti`' } }, [0.9], { name: 'valinta', value: 'kruuna' });
    await send('kukkaro', 'g1', { user: { id: 'l2', username: 'jansfr' } });
    await send('goneisii', 'g1', { nick: 'Arttu', user: { id: 'l1', username: 'arttu_k' } }, [0, 0, 0]);
    await send('goneisii', 'g2', { user: { id: 'l4', username: 'Muualla' } }, [0, 0, 0]);

    assert.equal((await send('leaderboard', 'g1')).content, '```\n 1  Arttu   107\n 2  jansfr   10\n 3  Matti\'    9\n```');
    assert.equal((await send('leaderboard', 'tyhjä')).flags, 64);
    assert.equal((await send('leaderboard')).flags, 64);
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
