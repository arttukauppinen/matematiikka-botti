import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import worker from './worker.mjs';

const { publicKey, privateKey } = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const balances = new Map();
const coins = {
  get: async (key) => balances.get(key),
  put: async (key, value) => balances.set(key, value),
  delete: async (key) => balances.delete(key),
  list: async ({ prefix }) => ({ keys: [...balances.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
};
const env = { DISCORD_PUBLIC_KEY: Buffer.from(await crypto.subtle.exportKey('raw', publicKey)).toString('hex'), COINS: coins };

const pending = [];
const edits = [];
const waits = [];
globalThis.scheduler = { wait: async (ms) => waits.push(ms) };
globalThis.fetch = async (url, init) => edits.push([url, JSON.parse(init.body).content]);
const ctx = { waitUntil: (p) => pending.push(p) };

const call = async (i, tamper = '') => {
  const body = JSON.stringify(i);
  const sig = Buffer.from(await crypto.subtle.sign('Ed25519', privateKey, new TextEncoder().encode('1' + body))).toString('hex');
  const headers = { 'x-signature-ed25519': sig, 'x-signature-timestamp': '1' };
  return worker.fetch(new Request('http://x', { method: 'POST', body: body + tamper, headers }), env, ctx);
};

const settle = async (res) => {
  const d = (await res.json()).data;
  await Promise.all(pending.splice(0));
  return edits.length ? { ...d, content: edits.splice(0).at(-1)[1] } : d;
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
    return settle(await call({ type: 2, data: { name, options }, member: { user: { id } } }));
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

    assert.match((await play('b', 'goneisii', [0, 0, 0])).content, /^🎰 🍒 \| 🍒 \| 🍒 🎰\n# (\S+) JACKPOT! \1\n\+97 🪙$/u);
    assert.equal((await play('b', 'goneisii', [0, 0.21, 0])).content, '🎰 🍒 | 🍋 | 🍒 🎰\nclose ✨\n+7 🪙');
    assert.equal((await play('b', 'kukkaro')).content, 'Sulla on **114** kolikkoa 🪙');
    assert.match((await play('b', 'goneisii', [0.9, 0.9, 0.9])).content, /^🎰 💀 \| 💀 \| 💀 🎰\n# (\S+) SHITPOT! \1\n-81 🪙$/u);
    assert.equal((await play('b', 'kukkaro')).content, 'Sulla on **33** kolikkoa 🪙');

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

test('goneisii: rullat paljastuvat sekunnin välein', async () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    waits.length = 0;
    const res = await call({ type: 2, application_id: 'app', token: 'tok', data: { name: 'goneisii', options: [] }, member: { user: { id: 'anim' } } });
    const [, spin] = (await res.json()).data.content.match(/^🎰 (\S+) \| \1 \| \1 🎰$/u);
    await Promise.all(pending.splice(0));
    const url = 'https://discord.com/api/v10/webhooks/app/tok/messages/@original';
    const [one, two, last] = edits.splice(0);
    assert.deepEqual([one, two], [
      [url, `🎰 🍒 | ${spin} | ${spin} 🎰`],
      [url, `🎰 🍒 | 🍒 | ${spin} 🎰`],
    ]);
    assert.equal(last[0], url);
    assert.match(last[1], /^🎰 🍒 \| 🍒 \| 🍒 🎰\n# (\S+) JACKPOT! \1\n\+97 🪙$/u);
    assert.deepEqual(waits, [1000, 1000, 1000]);
  } finally {
    Math.random = originalRandom;
  }
});

test('goneisii autospin: sama viesti, kierros ja yhteissumma, loppuu kun kolikot loppuu', async () => {
  const originalRandom = Math.random;
  const spin = async (id, autospin, randoms) => {
    Math.random = () => randoms.shift();
    const res = await call({ type: 2, application_id: 'app', token: 'tok', data: { name: 'goneisii', options: [{ name: 'autospin', value: autospin }] }, member: { user: { id } } });
    const first = (await res.json()).data.content;
    await Promise.all(pending.splice(0));
    return [first, ...edits.splice(0).map(([, c]) => c)];
  };
  try {
    balances.set('auto', '7');
    const [first, ...rest] = await spin('auto', 3, [0, 0, 0.21, 0, 0.21, 0.41, 0, 0.21, 0.41]);
    const s = first.match(/^🎰 (\S+) \|/u)[1];
    assert.equal(first, `🎰 ${s} | ${s} | ${s} 🎰\n🔁 1/3 · yht. +0 🪙`);
    assert.deepEqual(rest, [
      `🎰 🍒 | ${s} | ${s} 🎰\n🔁 1/3 · yht. +0 🪙`,
      `🎰 🍒 | 🍒 | ${s} 🎰\n🔁 1/3 · yht. +0 🪙`,
      '🎰 🍒 | 🍒 | 🍋 🎰\nclose ✨\n+7 🪙\n🔁 1/3 · yht. +7 🪙',
      `🎰 🍒 | ${s} | ${s} 🎰\n🔁 2/3 · yht. +7 🪙`,
      `🎰 🍒 | 🍋 | ${s} 🎰\n🔁 2/3 · yht. +7 🪙`,
      '🎰 🍒 | 🍋 | 🍉 🎰\nei voittoa\n-3 🪙\n🔁 2/3 · yht. +4 🪙',
      `🎰 🍒 | ${s} | ${s} 🎰\n🔁 3/3 · yht. +4 🪙`,
      `🎰 🍒 | 🍋 | ${s} 🎰\n🔁 3/3 · yht. +4 🪙`,
      '🎰 🍒 | 🍋 | 🍉 🎰\nei voittoa\n-3 🪙\n🔁 3/3 · yht. +1 🪙',
    ]);
    assert.equal(balances.get('auto'), '8');

    balances.set('broke', '4');
    const frames = await spin('broke', 3, [0, 0.21, 0.41, 0, 0.21, 0.41]);
    assert.equal(frames.length, 4);
    assert.equal(frames.at(-1), '🎰 🍒 | 🍋 | 🍉 🎰\nei voittoa\n-3 🪙\n🔁 1/3 · yht. -3 🪙');
    assert.equal(balances.get('broke'), '1');
  } finally {
    Math.random = originalRandom;
  }
});

test('leaderboard: palvelimen pelaajat tasattuna, rikkain ensin', async () => {
  const send = async (name, guild_id, member, randoms = [], ...options) => {
    Math.random = () => randoms.shift();
    return settle(await call({ type: 2, data: { name, options }, guild_id, member }));
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

test('lainaa: siirtää saldoa saman palvelimen pelaajalle', async () => {
  const lend = async (from, to, amount, guild_id = 'g9', bot = false) =>
    settle(
      await call({
        type: 2,
        guild_id,
        member: { user: { id: from, username: from } },
        data: {
          name: 'lainaa',
          options: [{ name: 'kenelle', value: to }, { name: 'määrä', value: amount }],
          resolved: { users: { [to]: { id: to, username: `${to}_user`, bot } }, members: { [to]: { nick: `${to}_nick` } } },
        },
      }),
    );
  const purse = async (id) => (await settle(await call({ type: 2, data: { name: 'kukkaro', options: [] }, member: { user: { id } } }))).content;

  assert.equal((await lend('p1', 'p2', 4)).content, '💸 <@p1> → <@p2> **4** 🪙');
  assert.equal(await purse('p1'), 'Sulla on **6** kolikkoa 🪙');
  assert.equal(await purse('p2'), 'Sulla on **14** kolikkoa 🪙');
  assert.equal(balances.get('g:g9:p2'), 'p2_nick');
  assert.equal((await lend('p1', 'p2', 7)).flags, 64);
  assert.equal((await lend('p1', 'p1', 1)).flags, 64);
  assert.equal((await lend('p1', 'robo', 1, 'g9', true)).flags, 64);
  assert.equal((await lend('p1', 'p2', 1, null)).flags, 64);
  assert.equal(await purse('p1'), 'Sulla on **6** kolikkoa 🪙');
});

test('roll: min ≔ 1, min > max ⇒ swap, kattaa välin', async () => {
  assert.equal(await roll({ name: 'max', value: 1 }), 1);
  const seen = new Set();
  for (let k = 0; k < 300; k++) seen.add(await roll({ name: 'max', value: 3 }, { name: 'min', value: 5 }));
  assert.deepEqual([...seen].sort(), [3, 4, 5]);
});

const press = async (id, custom_id, guild_id) => (await call({ type: 3, data: { custom_id }, guild_id, member: { user: { id } } })).json();
const command = async (id, name, options = [], guild_id, username = id) => (await call({ type: 2, application_id: 'app', token: 'tok', data: { name, options }, guild_id, member: { user: { id, username } } })).json();
const castNet = (kesto) => [{ name: 'toiminto', value: 'heitä' }, { name: 'kesto', value: kesto }];
const raiseNetOption = [{ name: 'toiminto', value: 'nosta' }];
// moves a cast net's timestamps so that it is ready now, keeping its chosen duration
const netReady = (key) => {
  const { castAt, readyAt } = JSON.parse(balances.get(key));
  balances.set(key, JSON.stringify({ castAt: Date.now() - (readyAt - castAt), readyAt: Date.now() }));
};

test('galastus: syötti maksaa 3, vain heittäjä nostaa, myöhästyessä kala karkaa', async () => {
  const originalRandom = Math.random;
  const rod = (readyAt) => balances.set('fishing-rod:dm:fisher', JSON.stringify({ castAt: readyAt - 5000, readyAt }));
  try {
    const randoms = [0.5, 0.2, 0, 0, 0];
    Math.random = () => randoms.shift();
    waits.length = 0;
    const cast = await command('fisher', 'galastus');
    assert.equal(cast.data.content, '🌊🎣 Heitit syötin veteen...\n〰️🌊〰️');
    assert.deepEqual(cast.data.components[0].components[0], { type: 2, style: 1, custom_id: 'galastus:catch:fisher', label: 'Odota', disabled: true });
    await Promise.all(pending.splice(0));
    assert.deepEqual(edits.splice(0).map(([, content]) => content), ['🌊🎣 Siima on vedessä...\n🌊〰️🌊', '🌊🎣 Jotain liikahti vedessä...\n〰️🐟〰️', '🐟 Kala on kiinni! Nosta siima nyt!']);
    assert.deepEqual(waits.splice(0), [1000, 1000, 9000]);
    assert.equal((await command('fisher', 'kukkaro')).data.content, 'Sulla on **7** kolikkoa 🪙');
    assert.equal((await command('fisher', 'galastus')).data.flags, 64);

    rod(Date.now() + 60000);
    assert.equal((await press('fisher', 'galastus:catch:fisher')).data.flags, 64);
    rod(Date.now() - 1000);
    assert.equal((await press('stranger', 'galastus:catch:fisher')).data.flags, 64);
    const caught = await press('fisher', 'galastus:catch:fisher');
    assert.equal(caught.type, 7);
    assert.equal(caught.data.content, '🐟 Sait **ahven** (50 g, yleinen)\n💰 **+1** 🪙 · 🎣 LVL **1** (+20 XP)');
    assert.equal(caught.data.embeds[0].image.url, 'https://raw.githubusercontent.com/arttukauppinen/matematiikka-botti/main/emoji/fish-ahven.png');
    assert.deepEqual(caught.data.components, []);
    assert.equal((await command('fisher', 'kukkaro')).data.content, 'Sulla on **8** kolikkoa 🪙');
    assert.deepEqual(JSON.parse(balances.get('fishing:fisher')), { level: 1, xp: 20 });
    assert.equal((await press('fisher', 'galastus:catch')).data.content, 'Tämä siima on jo nostettu.');

    rod(Date.now() - 11000);
    assert.equal((await press('fisher', 'galastus:catch:fisher')).data.content, '🐟💨 Kala ehti karata! Nosta nopeammin ensi kerralla.');
    assert.equal(balances.has('fishing-rod:dm:fisher'), false);
    rod(Date.now() - 11000);
    Math.random = () => 0;
    assert.equal((await command('fisher', 'galastus')).data.content, '🌊🎣 Heitit syötin veteen...\n〰️🌊〰️');
    await Promise.all(pending.splice(0));
    edits.length = waits.length = 0;

    const status = (await command('fisher', 'kalastustaso')).data.content;
    assert.match(status, /^🎣 Kalastus LVL \*\*1\*\* · \*\*20 XP\*\* · LVL 2: 83 XP\n\n✅ 🐟 ahven \(yleinen\): LVL 1 · \+20 XP\n/u);
    assert.match(status, /🔒 🐊 hauki \(epätavallinen\): LVL 10 · \+70 XP/u);
    const names = [...status.matchAll(/^\S+ \S+ (\S+) \(/gmu)].map(([, name]) => name);
    assert.equal(names.length, 7);
    for (const name of names) assert.ok(existsSync(new URL(`emoji/fish-${name.normalize('NFD').replace(/\p{M}/gu, '')}.png`, import.meta.url)), name);
  } finally {
    Math.random = originalRandom;
  }
});

test('verkko: maksaa 20, saalis kasvaa valitun ajan mukaan, vain heittäjä nostaa', async () => {
  const originalRandom = Math.random;
  const key = 'fishing-pending:dm:netter';
  try {
    Math.random = () => 0;
    balances.set('netter', '100');
    balances.set('fishing-rod:dm:netter', JSON.stringify({ castAt: 0, readyAt: Date.now() }));
    assert.equal((await command('netter', 'verkko', raiseNetOption)).data.content, 'Sinulla ei ole verkkoa vedessä.');

    const cast = await command('netter', 'verkko', castNet(60));
    assert.equal(cast.data.content, '🕸️ Heitit verkon veteen **60 minuutiksi**. Nosta se myöhemmin tästä napista.');
    assert.equal(cast.data.components[0].components[0].custom_id, 'verkko:raise:netter');
    assert.equal(balances.get('netter'), '80');
    assert.equal((await command('netter', 'verkko', castNet(5))).data.flags, 64);
    const early = await command('netter', 'verkko', raiseNetOption);
    assert.deepEqual([early.data.content, early.data.flags], ['Verkko on vielä vedessä. Nosta se noin **60 min** kuluttua.', 64]);

    netReady(key);
    assert.equal((await press('stranger', 'verkko:raise:netter')).data.flags, 64);
    const raised = await press('netter', 'verkko:raise:netter');
    assert.equal(raised.type, 7);
    assert.equal(raised.data.content, `🕸️ Verkossa oli **6** kalaa!\n${Array(6).fill('🐟 ahven 50 g').join(' · ')}\n💰 **+6** 🪙 · 🎣 LVL **2** (+120 XP) ✨ Uusi taso!`);
    assert.equal(balances.get('netter'), '86');
    assert.equal(balances.has(key), false);
    assert.equal((await press('netter', 'verkko:raise:netter')).data.flags, 64);

    await command('netter', 'verkko', castNet(1));
    netReady(key);
    assert.match((await command('netter', 'verkko', raiseNetOption)).data.content, /^🕸️ Verkossa oli \*\*2\*\* kalaa!/u);
    await command('netter', 'verkko', castNet(1));
    netReady(key);
    Math.random = () => 0.99;
    assert.match((await command('netter', 'verkko', raiseNetOption)).data.content, /^🕸️ Verkossa oli \*\*3\*\* kalaa!/u);
  } finally {
    Math.random = originalRandom;
  }
});

test('kalastus leaderboardissa: isoin kala ensin, tilastot kirjoitetaan kerran per nosto', async () => {
  const originalRandom = Math.random;
  const writes = [];
  const put = coins.put;
  coins.put = async (key, value) => (writes.push(key), put(key, value));
  try {
    Math.random = () => 0;
    balances.set('f1', '50');
    await command('f1', 'verkko', castNet(60), 'g5', 'Kalle');
    netReady('fishing-pending:g5:f1');
    await command('f1', 'verkko', raiseNetOption, 'g5', 'Kalle');
    assert.equal(writes.filter((k) => k === 'fishing-stats:g5:f1').length, 1);

    const randoms = [0.2, 0, 0.5, 0];
    Math.random = () => randoms.shift();
    balances.set('f2', '10');
    await command('f2', 'kukkaro', [], 'g5', 'Pekka');
    balances.set('fishing-rod:g5:f2', JSON.stringify({ castAt: Date.now() - 5000, readyAt: Date.now() }));
    assert.equal((await press('f2', 'galastus:catch:f2', 'g5')).data.content, '🐟 Sait **ahven** (925 g, yleinen)\n💰 **+2** 🪙 · 🎣 LVL **1** (+20 XP)');

    assert.equal(
      (await command('f1', 'leaderboard', [], 'g5')).data.content,
      '```\n 1  Kalle  36\n 2  Pekka  12\n```\n\n🎣 KALASTUS\n```\n 1  Pekka  LVL  1  1 kalaa  ennätys ahven 925 g  yleinen 1\n 2  Kalle  LVL  2  6 kalaa  ennätys ahven 50 g  yleinen 6\n```',
    );
  } finally {
    coins.put = put;
    Math.random = originalRandom;
  }
});

test('perho: avautuu tasolla 10, maksaa 10, puolet tyhjää, harvinaisemmat ja isommat kalat, 3× XP, 5 s aikaa', async () => {
  const originalRandom = Math.random;
  const fly = (readyAt) => balances.set('fishing-fly:dm:flyer', JSON.stringify({ castAt: readyAt - 5000, readyAt }));
  try {
    balances.set('flyer', '30');
    const locked = await command('flyer', 'perho');
    assert.equal(locked.data.flags, 64);
    assert.match(locked.data.content, /kalastustasolla 10, sinulla on LVL 1\./u);
    assert.equal(balances.get('flyer'), '30');

    balances.set('fishing:flyer', JSON.stringify({ level: 10, xp: 1154 }));
    Math.random = () => 0.5;
    waits.length = 0;
    const cast = await command('flyer', 'perho');
    assert.equal(cast.data.content, '🪰🎣 Heitit perhon veteen...\n〰️🌊〰️');
    assert.deepEqual(cast.data.components[0].components[0], { type: 2, style: 1, custom_id: 'perho:catch:flyer', label: 'Odota', disabled: true });
    await Promise.all(pending.splice(0));
    assert.deepEqual(edits.splice(0).map(([, content]) => content), ['🪰🎣 Perho kelluu virrassa...\n🌊〰️🌊', '🪰🎣 Jotain liikahti pinnan alla...\n〰️🐟〰️', '🐟 Kala iski perhoon! Nosta nopeasti!']);
    assert.deepEqual(waits.splice(0), [1000, 1000, 11500]);
    assert.equal(balances.get('flyer'), '20');
    assert.equal((await command('flyer', 'perho')).data.flags, 64);
    assert.equal((await command('flyer', 'galastus')).data.content, '🌊🎣 Heitit syötin veteen...\n〰️🌊〰️');
    await Promise.all(pending.splice(0));
    edits.length = waits.length = 0;
    assert.equal(balances.get('flyer'), '17');

    fly(Date.now() + 60000);
    assert.equal((await press('flyer', 'perho:catch:flyer')).data.flags, 64);
    fly(Date.now() - 1000);
    assert.equal((await press('stranger', 'perho:catch:flyer')).data.flags, 64);
    // 0.78 would be a särki with the rod's odds; √chance makes it a hauki, √0.25 puts it mid-range
    const randoms = [0.6, 0.78, 0.25, 0];
    Math.random = () => randoms.shift();
    const caught = await press('flyer', 'perho:catch:flyer');
    assert.equal(caught.type, 7);
    assert.equal(caught.data.content, '🪰 Sait perholla **hauki** (7,75 kg, epätavallinen)\n💰 **+7** 🪙 · 🎣 LVL **11** (+210 XP) ✨ Uusi taso!');
    assert.equal(caught.data.embeds[0].image.url, 'https://raw.githubusercontent.com/arttukauppinen/matematiikka-botti/main/emoji/fish-hauki.png');
    assert.deepEqual(JSON.parse(balances.get('fishing:flyer')), { level: 11, xp: 1364 });
    assert.equal(balances.get('flyer'), '24');
    assert.equal((await press('flyer', 'perho:catch:flyer')).data.content, 'Tämä perho on jo nostettu.');

    for (const [outcome, content] of [
      [0.1, '💥 Perho katkesi! Kala vei sen mukanaan.'],
      [0.3, 'Perho nosti saaliiksi vanhan saappaan. Ei kolikoita tällä kertaa. 🥾'],
    ]) {
      fly(Date.now() - 1000);
      Math.random = () => outcome;
      assert.equal((await press('flyer', 'perho:catch:flyer')).data.content, content);
    }
    fly(Date.now() - 6000);
    assert.equal((await press('flyer', 'perho:catch:flyer')).data.content, '🐟💨 Kala ehti karata! Perhossa pitää olla nopea.');
    assert.equal(balances.get('flyer'), '24');
  } finally {
    Math.random = originalRandom;
  }
});

test('gatiska: avautuu tasolla 20, 300 per katiska, max 5, kala tunnissa, täynnä 6 h:ssa, kuolevat 24 h jälkeen, saukko, 2× XP, ruostuu viikossa', async () => {
  const originalRandom = Math.random;
  const h = 36e5;
  const buy = [{ name: 'toiminto', value: 'osta' }];
  try {
    balances.set('trapper', '2000');
    balances.set('fishing:trapper', JSON.stringify({ level: 19, xp: 4469 }));
    const locked = await command('trapper', 'gatiska', buy);
    assert.deepEqual([locked.data.flags, balances.get('trapper')], [64, '2000']);

    balances.set('fishing:trapper', JSON.stringify({ level: 20, xp: 4470 }));
    assert.equal((await command('trapper', 'gatiska')).data.flags, 64);
    assert.equal((await command('trapper', 'gatiska', buy)).data.content, '🪤 Laskit katiskan veteen (1/5). Se kerää kaloja viikon, kunnes ruostuu puhki. Katso katiskat: `/gatiska`');
    for (let i = 0; i < 4; i++) await command('trapper', 'gatiska', buy);
    assert.equal((await command('trapper', 'gatiska', buy)).data.flags, 64);
    assert.equal(balances.get('trapper'), '500');
    assert.equal((await command('trapper', 'gatiska')).data.content, `🪤 Katiskat\n${[1, 2, 3, 4, 5].map((i) => `#${i} (7 pv) tyhjä`).join('\n')}\nEi saalista tällä kertaa.`);

    const now = Date.now();
    const at = (bought, checked) => ({ boughtAt: now - bought, checkedAt: now - checked });
    balances.set('fishing-traps:trapper', JSON.stringify([at(6 * h, 6 * h), at(3.5 * h, 3.5 * h), at(29 * h, 29 * h), at(8 * 24 * h, 29 * h), at(0, 0)]));
    // per trap: otter roll, then pick/weight/giant per fish. #1 full, #2 3 fish, #3 1 dead + otter eats 3 of 5, #4 rusted with 5 fish, 1 dead
    const roll = (otter, fish) => [otter, ...Array(fish * 3).fill(0)];
    const randoms = [...roll(0.5, 6), ...roll(0.5, 3), ...roll(0.05, 2), ...roll(0.5, 4)];
    Math.random = () => randoms.shift();
    const ahven = (n) => Array(n).fill('🐟 ahven 50 g').join(' · ');
    assert.equal(
      (await command('trapper', 'gatiska')).data.content,
      [
        '🪤 Katiskat',
        `#1 (7 pv) ${ahven(6)}`,
        `#2 (7 pv) ${ahven(3)}`,
        `#3 (6 pv) 💀 1 kuoli · 🦦 saukko söi 3 · ${ahven(2)}`,
        `#4 ruostui puhki 🗑️ 💀 1 kuoli · ${ahven(4)}`,
        '#5 (7 pv) tyhjä',
        '💰 **+15** 🪙 · 🎣 LVL **21** (+600 XP) ✨ Uusi taso!',
      ].join('\n'),
    );
    assert.equal(randoms.length, 0);
    const left = JSON.parse(balances.get('fishing-traps:trapper'));
    assert.equal(left.length, 4);
    assert.equal(left[1].checkedAt, now - 0.5 * h);
    assert.equal(balances.get('trapper'), '515');
    assert.deepEqual(JSON.parse(balances.get('fishing:trapper')), { level: 21, xp: 5070 });
    assert.match((await command('trapper', 'gatiska', buy)).data.content, /\(5\/5\)/u);
  } finally {
    Math.random = originalRandom;
  }
});
