import { test } from 'node:test';
import assert from 'node:assert/strict';
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

const AHVEN = '<:ahven:1558100883550503013>';
const HAUKI = '<:hauki:1558100885014323292>';

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

test('galastus: syötti maksaa 3, vain heittäjä nostaa, kala odottaa nostoa', async () => {
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
    assert.equal(caught.data.content, `# ${AHVEN} Ahven\n-# 50 g · yleinen\n💰 **+1** 🪙 · 🎣 LVL **1** (+20 XP)`);
    assert.equal(caught.data.embeds, undefined);
    assert.deepEqual(caught.data.components, []);
    assert.equal((await command('fisher', 'kukkaro')).data.content, 'Sulla on **8** kolikkoa 🪙');
    assert.deepEqual(JSON.parse(balances.get('fishing:fisher')), { level: 1, xp: 20 });
    assert.equal((await press('fisher', 'galastus:catch')).data.content, 'Tämä siima on jo nostettu.');

    // no time limit: a fish hooked 10 minutes ago is still there
    rod(Date.now() - 10 * 60000);
    const late = [0.2, 0, 0, 0];
    Math.random = () => late.shift();
    assert.equal((await press('fisher', 'galastus:catch:fisher')).data.content, `# ${AHVEN} Ahven\n-# 50 g · yleinen\n💰 **+1** 🪙 · 🎣 LVL **1** (+20 XP)`);
    assert.equal(balances.has('fishing-rod:dm:fisher'), false);
    // casting again after the bite gives up the hooked fish instead of locking the rod
    rod(Date.now() - 1000);
    Math.random = () => 0;
    assert.equal((await command('fisher', 'galastus')).data.content, '🌊🎣 Heitit syötin veteen...\n〰️🌊〰️');
    await Promise.all(pending.splice(0));
    edits.length = waits.length = 0;

    const status = (await command('fisher', 'kalastustaso')).data.content;
    assert.match(status, /^🎣 Kalastus LVL \*\*1\*\* · \*\*40 XP\*\* · LVL 2: 83 XP\n\n✅ <:ahven:1558100883550503013> ahven \(yleinen\): LVL 1 · \+20 XP\n/u);
    assert.match(status, /🔒 <:hauki:1558100885014323292> hauki \(epätavallinen\): LVL 10 · \+70 XP/u);
    assert.equal(status.match(/^(✅|🔒) <:\w+:\d{17,20}> /gmu).length, 7);
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
    assert.equal(raised.data.content, `🕸️ Verkossa oli **6** kalaa!\n${Array(6).fill(`${AHVEN} ahven 50 g`).join(' · ')}\n💰 **+6** 🪙 · 🎣 LVL **2** (+120 XP) ✨ Uusi taso!`);
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
    assert.equal((await press('f2', 'galastus:catch:f2', 'g5')).data.content, `# ${AHVEN} Ahven\n-# 925 g · yleinen\n💰 **+2** 🪙 · 🎣 LVL **1** (+20 XP)`);

    assert.equal(
      (await command('f1', 'leaderboard', [], 'g5')).data.content,
      '```\n 1  Kalle  36\n 2  Pekka  12\n```\n\n🎣 KALASTUS\n```\n 1  Pekka  LVL  1  1 kalaa  ennätys ahven 925 g  yleinen 1\n 2  Kalle  LVL  2  6 kalaa  ennätys ahven 50 g  yleinen 6\n```',
    );
  } finally {
    coins.put = put;
    Math.random = originalRandom;
  }
});

test('perho: avautuu tasolla 10, maksaa 8, saapas palauttaa perhon, puolet tyhjää, harvinaisemmat ja isommat kalat, 3× XP, kala odottaa nostoa', async () => {
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
    assert.equal(balances.get('flyer'), '22');
    assert.equal((await command('flyer', 'perho')).data.flags, 64);
    assert.equal((await command('flyer', 'galastus')).data.content, '🌊🎣 Heitit syötin veteen...\n〰️🌊〰️');
    await Promise.all(pending.splice(0));
    edits.length = waits.length = 0;
    assert.equal(balances.get('flyer'), '19');

    fly(Date.now() + 60000);
    assert.equal((await press('flyer', 'perho:catch:flyer')).data.flags, 64);
    fly(Date.now() - 1000);
    assert.equal((await press('stranger', 'perho:catch:flyer')).data.flags, 64);
    // 0.78 would be a särki with the rod's odds; √chance makes it a hauki, √0.25 puts it mid-range
    const randoms = [0.6, 0.78, 0.25, 0];
    Math.random = () => randoms.shift();
    const caught = await press('flyer', 'perho:catch:flyer');
    assert.equal(caught.type, 7);
    assert.equal(caught.data.content, `# ${HAUKI} Hauki\n-# 🪰 perholla · 7,75 kg · epätavallinen\n💰 **+7** 🪙 · 🎣 LVL **11** (+210 XP) ✨ Uusi taso!`);
    assert.deepEqual(JSON.parse(balances.get('fishing:flyer')), { level: 11, xp: 1364 });
    assert.equal(balances.get('flyer'), '26');
    assert.equal((await press('flyer', 'perho:catch:flyer')).data.content, 'Tämä perho on jo nostettu.');

    for (const [outcome, content] of [
      [0.1, '💥 Perho katkesi! Kala vei sen mukanaan.'],
      [0.3, 'Perho nosti saaliiksi vanhan saappaan, mutta sait perhon takaisin: **+8** 🪙 🥾'],
    ]) {
      fly(Date.now() - 1000);
      Math.random = () => outcome;
      assert.equal((await press('flyer', 'perho:catch:flyer')).data.content, content);
    }
    fly(Date.now() - 10 * 60000);
    const late = [0.6, 0, 0, 0];
    Math.random = () => late.shift();
    assert.equal((await press('flyer', 'perho:catch:flyer')).data.content, `# ${AHVEN} Ahven\n-# 🪰 perholla · 50 g · yleinen\n💰 **+1** 🪙 · 🎣 LVL **11** (+60 XP)`);
    assert.equal(balances.get('flyer'), '35');
    fly(Date.now() - 1000);
    Math.random = () => 0;
    assert.equal((await command('flyer', 'perho')).data.content, '🪰🎣 Heitit perhon veteen...\n〰️🌊〰️');
    await Promise.all(pending.splice(0));
    edits.length = waits.length = 0;
    assert.equal(balances.get('flyer'), '27');
  } finally {
    Math.random = originalRandom;
  }
});

test('gatiska: avautuu tasolla 20, 300 per katiska, max 5, kala tunnissa 50 %:n todennäköisyydellä, max 6, kuolevat 12 h jälkeen, saukko, harvinaisemmat ja isommat kalat puoleen hintaan, 2× XP, ruostuu viikossa', async () => {
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
    balances.set('fishing-traps:trapper', JSON.stringify([at(6 * h, 6 * h), at(3.5 * h, 3.5 * h), at(14 * h, 14 * h), at(8 * 24 * h, 26 * h), at(0, 0)]));
    // per trap: one 50 % roll per full hour until full, an otter roll if anything is alive, then pick/weight/giant per fish
    // #1 3 of 6 hours, #2 1 of 3, #3 full, 1 dead and the otter eats the other 5, #4 rusted with 2 fish, both dead, #5 empty
    // #2's fish: 0.78 would be a särki with the rod's odds, √chance makes it a hauki and √0.25 puts it mid-range
    const randoms = [0, 0.9, 0, 0.9, 0, 0.9, 0.5, ...Array(9).fill(0), 0, 0.9, 0.9, 0.5, 0.78, 0.25, 0, ...Array(6).fill(0), 0.05, 0, 0];
    Math.random = () => randoms.shift();
    const ahven = (n) => Array(n).fill(`${AHVEN} ahven 50 g`).join(' · ');
    assert.equal(
      (await command('trapper', 'gatiska')).data.content,
      [
        '🪤 Katiskat',
        `#1 (7 pv) ${ahven(3)}`,
        `#2 (7 pv) ${HAUKI} hauki 7,75 kg`,
        '#3 (7 pv) 💀 1 kuoli · 🦦 saukko söi 5',
        '#4 ruostui puhki 🗑️ 💀 2 kuoli',
        '#5 (7 pv) tyhjä',
        // half price: the 7,75 kg hauki sells for 4 instead of 7
        '💰 **+7** 🪙 · 🎣 LVL **20** (+260 XP)',
      ].join('\n'),
    );
    assert.equal(randoms.length, 0);
    const left = JSON.parse(balances.get('fishing-traps:trapper'));
    assert.equal(left.length, 4);
    assert.equal(left[1].checkedAt, now - 0.5 * h);
    assert.equal(balances.get('trapper'), '507');
    assert.deepEqual(JSON.parse(balances.get('fishing:trapper')), { level: 20, xp: 4730 });
    assert.match((await command('trapper', 'gatiska', buy)).data.content, /\(5\/5\)/u);
  } finally {
    Math.random = originalRandom;
  }
});

test('guoma: avautuu tasolla 30, ilmainen, maksat syötit, pitää myyntirahat, heitto minuutissa, raportti kesken, maksu lopussa, putka ja takuut', async () => {
  const originalRandom = Math.random;
  const SARKI = '<:sarki:1558100882086961179>';
  const hire = (id, kolikot) => command(id, 'guoma', [{ name: 'kolikot', value: kolikot }]);
  const minutesAgo = (id, m) => {
    const k = JSON.parse(balances.get(`fishing-kuoma:${id}`));
    balances.set(`fishing-kuoma:${id}`, JSON.stringify({ ...k, start: Date.now() - m * 6e4 - 1000 }));
  };
  try {
    balances.set('buddy', '1000');
    balances.set('fishing:buddy', JSON.stringify({ level: 29, xp: 13362 }));
    assert.equal((await hire('buddy', 300)).data.flags, 64);
    balances.set('fishing:buddy', JSON.stringify({ level: 30, xp: 13363 }));
    assert.equal((await command('buddy', 'guoma')).data.flags, 64);

    Math.random = () => 0.5; // no jail this time
    assert.equal((await hire('buddy', 301)).data.content, '🧔 Palkkasit kuoman kalaan: 100 heittoa, noin 1 h 40 min. Katso tilanne ja lunasta saalis lopuksi: `/guoma`');
    assert.equal(balances.get('buddy'), '700');
    assert.equal((await hire('buddy', 30)).data.flags, 64);
    const start = await command('buddy', 'guoma');
    assert.deepEqual([start.data.flags, start.data.content], [64, '🧔 Kuoma kalastaa: 0/100 heittoa, valmis noin 1 h 40 min kuluttua\nei saalista vielä']);

    // 0.5 picks a särki with chance^0.75 at LVL 30 and 0.5^0.75 makes it 730 g
    minutesAgo('buddy', 10);
    const report = `🧔 Kuoma kalastaa: 10/100 heittoa, valmis noin 1 h 30 min kuluttua\n${SARKI} ×10\n-# suurin tähän asti: ${SARKI} särki 730 g`;
    const mid = await command('buddy', 'guoma');
    assert.deepEqual([mid.data.flags, mid.data.content], [64, report]);
    assert.equal(balances.get('buddy'), '700');
    // asking again doesn't roll the same casts again
    Math.random = () => 0.1;
    assert.equal((await command('buddy', 'guoma')).data.content, report);

    minutesAgo('buddy', 500); // the other 90 casts are boots
    const done = await command('buddy', 'guoma');
    assert.equal(done.data.flags, 0);
    assert.equal(done.data.content, `# ${SARKI} Särki\n-# 🧔 kuoman saalis 100/100 · 730 g · yleinen\n${SARKI} ×10 · 🥾 ×90\n🧔 Kuoma myi kalat ja piti rahat (20 🪙)\n🎣 LVL **30** (+250 XP)\n🧔 Kuoma käytti kaikki syötit ja lähti kotiin.`);
    assert.equal(balances.get('buddy'), '700');
    assert.equal(balances.has('fishing-kuoma:buddy'), false);

    Math.random = () => 0.05; // jail, and every cast snaps
    await hire('buddy', 15);
    assert.equal(balances.get('buddy'), '685');
    minutesAgo('buddy', 3);
    assert.match((await command('buddy', 'guoma')).data.content, /^🧔 Kuoma kalastaa: 3\/5 heittoa, valmis noin 2 min kuluttua\n💥 ×3$/u);
    minutesAgo('buddy', 10);
    const jailed = await command('buddy', 'guoma');
    assert.equal(jailed.data.content, '🚔 Kuoma onanoi laiturilla ja joutui putkaan. Maksa 500 🪙 takuita lunastaaksesi saaliin.');
    assert.equal(jailed.data.components[0].components[0].custom_id, 'guoma:bail:buddy');
    assert.equal((await press('stranger', 'guoma:bail:buddy')).data.flags, 64);
    balances.set('buddy', '50');
    assert.equal((await press('buddy', 'guoma:bail:buddy')).data.flags, 64);
    balances.set('buddy', '505');
    const bailed = await press('buddy', 'guoma:bail:buddy');
    assert.equal(bailed.type, 7);
    assert.equal(bailed.data.content, '🧔 Kuoman saalis 5/5: ei kaloja\n💥 ×5\n🚔 Takuut −500 🪙\n🎣 LVL **30** (+0 XP)\n🧔 Kuoma käytti kaikki syötit ja lähti kotiin.');
    assert.equal(balances.get('buddy'), '5');
    assert.equal(balances.has('fishing-kuoma:buddy'), false);
    // a stale bail button doesn't charge again
    assert.equal((await press('buddy', 'guoma:bail:buddy')).data.flags, 64);
    assert.equal(balances.get('buddy'), '5');
  } finally {
    Math.random = originalRandom;
  }
});

test('blackjack: yksi viesti napeilla, kortit kääntyvät, 3:2, tuplaus, vain pelaajan napit, sessio ja raportti', async () => {
  const originalRandom = Math.random;
  const ids = { sa: '1558909376989892668', ck: '1558909456283209910', cq: '1558909455259934802', cj: '1558909458678022276', h10: '1558909419243184278', s9: '1558909382891405424', c10: '1558909475342123159', d6: '1558909447126913135', h2: '1558909418140213370', sk: '1558909379384967311', h5: '1558909414361272485', s6: '1558909387152691200', d7: '1558909445612896406', ha: '1558909406924509254', s8: '1558909384199770203', d8: '1558909444107272302' };
  const E = (...cards) => cards.map((c) => `<:${c}:${ids[c]}>`).join(' ');
  const FLIP = '<a:kortti_flip:1558909401430229092>';
  const BACK = '<:kortti_selka:1558909399299522630>';
  const table = (dealer, player, bottom) => `-# JAKAJA${dealer[1] === '' ? '' : ` · ${dealer[1]}`}\n# ${dealer[0]}\n-# SINÄ${player[1] === '' ? '' : ` · ${player[1]}`}\n# ${player[0]}\n${bottom}`;
  const labels = (msg) => msg.data.components[0].components.map((b) => [b.label, b.disabled ?? false]);
  const deal = async (panos) => command('dealer', 'blackjack', [{ name: 'panos', value: panos }]);
  const set = (g) => balances.set('blackjack:dealer', JSON.stringify({ base: 20, bet: 20, deck: [], ...g }));
  const settled = async (msg) => {
    await Promise.all(pending.splice(0));
    return edits.splice(0).map(([, content]) => content);
  };
  try {
    balances.set('dealer', '100');
    assert.equal((await deal(501)).data.flags, 64);
    assert.equal((await deal(101)).data.flags, 64);

    // Math.random 0 deals A♠ Q♣ to the player and K♣ J♣ to the dealer: a natural pays 3:2
    Math.random = () => 0;
    waits.length = 0;
    const first = await deal(20);
    assert.equal(first.data.content, table([`${FLIP} ${FLIP}`, ''], [`${FLIP} ${FLIP}`, ''], '-# panos 20 🪙'));
    assert.deepEqual(labels(first), [['Ota kortti', true], ['Jää', true]]);
    const dealt = await settled();
    assert.deepEqual(dealt, [
      table([`${FLIP} ${FLIP}`, ''], [`${E('sa')} ${FLIP}`, 11], '-# panos 20 🪙'),
      table([`${E('ck')} ${FLIP}`, 10], [`${E('sa')} ${FLIP}`, 11], '-# panos 20 🪙'),
      table([`${E('ck')} ${FLIP}`, 10], [E('sa', 'cq'), 21], '-# panos 20 🪙'),
      table([E('ck', 'cj'), 20], [E('sa', 'cq'), 21], '### 🃏 Blackjack! +30 🪙\n-# panos 20 🪙 · saldo 130 🪙 · sessio +30 🪙 (1 käsi)'),
    ]);
    assert.deepEqual(waits.splice(0), [600, 600, 600, 600]);
    assert.equal(balances.get('dealer'), '130');
    assert.equal(balances.has('blackjack:dealer'), false);

    // hit: the new card flips in, then shows; a bust ends the hand
    set({ player: ['h10', 's9'], dealer: ['c10', 'd6'], deck: ['sk'] });
    balances.set('dealer', '100');
    assert.equal((await press('stranger', 'blackjack:hit:dealer')).data.flags, 64);
    const hit = await press('dealer', 'blackjack:hit:dealer');
    assert.equal(hit.type, 7);
    assert.equal(hit.data.content, table([`${E('c10')} ${BACK}`, 10], [`${E('h10', 's9')} ${FLIP}`, 19], '-# panos 20 🪙'));
    assert.deepEqual(await settled(), [table([E('c10', 'd6'), 16], [E('h10', 's9', 'sk'), 29], '### Yli 21 · −20 🪙\n-# panos 20 🪙 · saldo 100 🪙 · sessio −20 🪙 (1 käsi)')]);
    assert.equal(balances.has('blackjack:dealer'), false);
    assert.equal((await press('dealer', 'blackjack:stand:dealer')).data.flags, 64);

    // stand: the hole card flips, the dealer draws to 17 or more
    set({ player: ['h10', 's9'], dealer: ['c10', 'd6'], deck: ['h2'] });
    const stand = await press('dealer', 'blackjack:stand:dealer');
    assert.equal(stand.data.content, table([`${E('c10')} ${FLIP}`, 10], [E('h10', 's9'), 19], '-# panos 20 🪙'));
    const drawn = await settled();
    assert.equal(drawn.at(-1), table([E('c10', 'd6', 'h2'), 18], [E('h10', 's9'), 19], '### Voitit · +20 🪙\n-# panos 20 🪙 · saldo 140 🪙 · sessio +20 🪙 (1 käsi)'));
    assert.equal(drawn.length, 3);

    // double: one more card for twice the bet, then the dealer plays
    set({ player: ['h5', 's6'], dealer: ['c10', 'd7'], deck: ['sk'] });
    balances.set('dealer', '100');
    const doubled = await press('dealer', 'blackjack:double:dealer');
    assert.equal(doubled.data.content, table([`${E('c10')} ${BACK}`, 10], [`${E('h5', 's6')} ${FLIP}`, 11], '-# panos 40 🪙 (tuplattu)'));
    const end = (await settled()).at(-1);
    assert.equal(end, table([E('c10', 'd7'), 17], [E('h5', 's6', 'sk'), 21], '### Voitit · +40 🪙\n-# panos 40 🪙 (tuplattu) · saldo 160 🪙 · sessio +40 🪙 (1 käsi)'));
    assert.equal(balances.get('dealer'), '160');

    // a tie gives the bet back; the finished hand offers a new one with the same bet
    set({ player: ['h10', 's8'], dealer: ['c10', 'd8'] });
    await press('dealer', 'blackjack:stand:dealer');
    const tie = (await settled()).at(-1);
    assert.match(tie, /### Tasapeli · panos takaisin\n-# panos 20 🪙 · saldo 180 🪙 · sessio \+0 🪙 \(1 käsi\)$/u);
    assert.equal(balances.get('dealer'), '180');

    // a hand in progress: hit keeps it going without a double button; /blackjack shows it again
    set({ player: ['h2', 'h5'], dealer: ['c10', 'd7'], deck: ['s6'] });
    await press('dealer', 'blackjack:hit:dealer');
    const going = await settled();
    assert.equal(going.length, 1);
    assert.equal(JSON.parse(balances.get('blackjack:dealer')).player.length, 3);
    const shown = await deal(20);
    assert.equal(shown.data.content, table([`${E('c10')} ${BACK}`, 10], ['<:h2:1558909418140213370> <:h5:1558909414361272485> <:s6:1558909387152691200>', 13], '-# panos 20 🪙'));
    assert.deepEqual(labels(shown), [['Ota kortti', false], ['Jää', false]]);
    assert.equal(balances.get('dealer'), '180');

    assert.equal((await press('dealer', 'blackjack:quit:dealer')).data.flags, 64); // finish the hand first

    // "Uusi peli" deals a new hand into the same message and keeps the session (the tie above) going
    balances.delete('blackjack:dealer');
    Math.random = () => 0;
    const again = await press('dealer', 'blackjack:again:dealer:20');
    assert.equal(again.type, 7);
    assert.equal(again.data.content, table([`${FLIP} ${FLIP}`, ''], [`${FLIP} ${FLIP}`, ''], '-# panos 20 🪙 · sessio +0 🪙 (1 käsi)'));
    assert.match((await settled()).at(-1), /### 🃏 Blackjack! \+30 🪙\n-# panos 20 🪙 · saldo 210 🪙 · sessio \+30 🪙 \(2 kättä\)$/u);

    // "Lopeta" turns the message into a report of the session and removes the buttons
    const report = await press('dealer', 'blackjack:quit:dealer');
    assert.equal(report.type, 7);
    assert.equal(report.data.content, '## 🃏 Blackjack-sessio päättyi\n### +30 🪙\n-# 2 kättä · 1 voitto (1 blackjack) · 1 tasapeli · 0 häviötä\n-# saldo 210 🪙');
    assert.deepEqual(report.data.components, []);
    assert.equal((await press('dealer', 'blackjack:quit:dealer')).data.flags, 64);
  } finally {
    Math.random = originalRandom;
  }
});
