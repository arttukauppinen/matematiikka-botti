// /ruletti: European roulette with one zero. Chips go on the table with buttons and two number menus; coins leave the
// wallet only when the wheel spins. The pictures come from tools/ruletti.py through the Worker's static assets
// (env.ASSETS): a GIF of the wheel landing on each number, and the table that tableImage draws the chips on.
// spin: ms from the spin to the result, the GIF's 4.8 s of motion (MOTION_MS in tools/ruletti.py) plus time to load it;
// textSpin: the same without pictures
export const RL = { max: 500, chips: [1, 5, 25, 100], spin: 7000, textSpin: 1000 };

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const FELT = 0x126434;
// outside bets: label, the numbers that win and the payout; a single number pays 35:1. c3/c2/c1 are the table's
// columns, named by the row they make in the picture
const OUTSIDE = {
  low: ['1–18', (n) => n >= 1 && n <= 18, 1],
  even: ['Parillinen', (n) => n > 0 && n % 2 === 0, 1],
  red: ['Punainen', (n) => RED.has(n), 1],
  black: ['Musta', (n) => n > 0 && !RED.has(n), 1],
  odd: ['Pariton', (n) => n % 2 === 1, 1],
  high: ['19–36', (n) => n >= 19, 1],
  d1: ['1–12', (n) => n >= 1 && n <= 12, 2],
  d2: ['13–24', (n) => n >= 13 && n <= 24, 2],
  d3: ['25–36', (n) => n >= 25, 2],
  c3: ['Ylärivi', (n) => n > 0 && n % 3 === 0, 2],
  c2: ['Keskirivi', (n) => n % 3 === 2, 2],
  c1: ['Alarivi', (n) => n % 3 === 1, 2],
};
const NUMBERS = Array.from({ length: 37 }, (_, n) => String(n));
const SPOTS = [...NUMBERS, ...Object.keys(OUTSIDE)];
const won = (spot, n) => (OUTSIDE[spot] ? OUTSIDE[spot][1](n) : +spot === n);
const odds = (spot) => OUTSIDE[spot]?.[2] ?? 35;
const spotName = (spot) => OUTSIDE[spot]?.[0].toLowerCase() ?? spot;
const ball = (n) => (n === 0 ? '🟢' : RED.has(n) ? '🔴' : '⚫');
const staked = (bets) => Object.values(bets).reduce((sum, amount) => sum + amount, 0);
const listed = (bets) => SPOTS.filter((s) => bets[s]).map((s) => `${spotName(s)}: ${bets[s]}`).join(' · ');

// one /ruletti action. Returns an error string (shown only to the player) or [message, result]: the message replaces
// the table now and result, after a spin, replaces it RL.spin ms later. images = the origin serving the pictures.
export const roulette = async (action, { store, playerId, wallet: [coins, day], images, arg, values = [] }) => {
  const key = `ruletti:${playerId}`;
  const saved = JSON.parse((await store.get(key)) || 'null') ?? { chip: 5, bets: {} };
  const id =(...parts) => ['ruletti', parts[0], playerId, ...parts.slice(1)].join(':');
  const picture = (path) => (images ? [{ color: FELT, image: { url: `${images}/${path}` } }] : []);

  const table = (t) => {
    const total = staked(t.bets);
    const button = (name, style, label, disabled = false) => ({ type: 2, style, custom_id: id(name), label, disabled });
    const bet = (spot, style = 2, emoji) => ({
      type: 2,
      style,
      custom_id: id('bet', spot),
      label: t.bets[spot] ? `${OUTSIDE[spot][0]} · ${t.bets[spot]}` : OUTSIDE[spot][0],
      ...(emoji && { emoji: { name: emoji } }),
    });
    const menu = (part, from, to) => ({
      type: 1,
      components: [
        {
          type: 3,
          custom_id: id('num', part),
          placeholder: `Numerot ${from}–${to} · 35:1`,
          min_values: 1,
          max_values: to - from + 1,
          options: NUMBERS.slice(from, to + 1).map((s) => ({ label: s, value: s, emoji: { name: ball(+s) }, ...(t.bets[s] && { description: `panos ${t.bets[s]} 🪙` }) })),
        },
      ],
    });
    const chips = SPOTS.filter((s) => t.bets[s]).map((s) => `${s}.${t.bets[s]}`).join(',');
    return {
      content: [
        '## 🎡 Ruletti',
        `-# pelimerkki ${t.chip} 🪙 · panokset ${total}/${RL.max} 🪙 · saldo ${coins} 🪙`,
        `-# ${total ? listed(t.bets) : 'numero maksaa 35:1, tusina ja rivi 2:1, muut 1:1'}`,
      ].join('\n'),
      embeds: picture(`poyta.png${chips ? `?p=${chips}` : ''}`),
      components: [
        menu('a', 0, 18),
        menu('b', 19, 36),
        { type: 1, components: [bet('low'), bet('even'), bet('red', 4), bet('black', 2, '⚫'), bet('odd')] },
        { type: 1, components: [bet('high'), bet('d1'), bet('d2'), bet('d3'), button('clear', 2, 'Tyhjennä', !total)] },
        { type: 1, components: [bet('c3'), bet('c2'), bet('c1'), button('chip', 1, `Pelimerkki ${t.chip} 🪙`), button('spin', 3, 'Pyöräytä', !total)] },
      ],
    };
  };

  // the result is decided and paid before the wheel turns, so a lost edit can't lose coins
  const spin = async (bets) => {
    const total = staked(bets);
    if (!total) return 'Aseta ensin panos.';
    if (coins < total) return `Ei tarpeeksi kolikoita, panokset ovat ${total} 🪙 ja sulla on **${coins}** 🪙`;
    const n = Math.floor(Math.random() * 37);
    const hits = SPOTS.filter((s) => bets[s] && won(s, n));
    const payout = hits.reduce((sum, s) => sum + bets[s] * (odds(s) + 1), 0);
    const balance = coins - total + payout;
    await store.put(playerId, `${balance} ${day ?? ''}`.trim());
    const net = payout - total;
    const result = {
      content: [
        `## ${ball(n)} ${n}`,
        `### ${net > 0 ? `Voitit +${net} 🪙` : net < 0 ? `Hävisit −${-net} 🪙` : 'Tasan · ±0 🪙'}`,
        hits.length && `-# osui: ${hits.map((s) => `${spotName(s)} +${bets[s] * odds(s)}`).join(' · ')}`,
        `-# panokset ${total} 🪙 · saldo ${balance} 🪙`,
      ].filter(Boolean).join('\n'),
      embeds: picture(`ruletti/${n}.png`),
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, custom_id: id('spin'), label: `Pyöräytä uudestaan · ${total} 🪙` },
            { type: 2, style: 2, custom_id: id('edit'), label: 'Muuta panoksia' },
          ],
        },
      ],
    };
    return [{ content: `## 🎡 Ruletti\n-# pyörä pyörii… · panokset ${total} 🪙\n-# ${listed(bets)}`, embeds: picture(`ruletti/${n}.gif`), components: [] }, result];
  };

  // KV takes one write per key a second: a tap faster than that gets a message instead of a failed interaction
  const save = async (t) => {
    try {
      await store.put(key, JSON.stringify(t), { expirationTtl: 86400 });
      return [table(t)];
    } catch (err) {
      console.error('ruletti: save', err);
      return 'Liian nopeasti! Odota hetki ja yritä uudelleen.';
    }
  };

  if (action === 'spin') return spin(saved.bets);
  if (action === 'bet' || action === 'num') {
    const spots = action === 'bet' ? [arg] : Array.isArray(values) ? values : [];
    if (!spots.length || !spots.every((s) => SPOTS.includes(s))) return 'Tuntematon panos.';
    const total = staked(saved.bets) + saved.chip * spots.length;
    if (total > RL.max) return `Panokset ovat yhteensä enintään ${RL.max} 🪙 kierroksessa.`;
    if (total > coins) return `Ei tarpeeksi kolikoita, sulla on **${coins}** 🪙`;
    const bets = { ...saved.bets };
    for (const s of spots) bets[s] = (bets[s] ?? 0) + saved.chip;
    return save({ ...saved, bets });
  }
  if (action === 'chip') return save({ ...saved, chip: RL.chips[(RL.chips.indexOf(saved.chip) + 1) % RL.chips.length] });
  if (action === 'clear') return save({ ...saved, bets: {} });
  return [table(saved)]; // the command and "Muuta panoksia" show the table as it is
};

// --- the table picture: the chips drawn on the table from tools/ruletti.py, as a palette PNG -----------------------

const TRANSPARENT = 255; // chip pixels to skip
let assets; // [layout, table pixels, chip sprites], read once per isolate
const loadAssets = (env) =>
  (assets ??= Promise.all(
    ['poyta.json', 'poyta.bin', 'pelimerkit.bin'].map(async (file) => {
      const res = await env.ASSETS.fetch(`https://assets/ruletti/${file}`);
      if (!res.ok) throw new Error(`ruletti/${file}: ${res.status}`);
      return file.endsWith('.json') ? res.json() : new Uint8Array(await res.arrayBuffer());
    }),
  ).catch((err) => {
    assets = undefined;
    throw err;
  }));

const CRC = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const chunk = (type, data) => {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set([...type].map((c) => c.charCodeAt(0)), 4);
  out.set(data, 8);
  let crc = ~0;
  for (let i = 4; i < data.length + 8; i++) crc = CRC[(crc ^ out[i]) & 255] ^ (crc >>> 8);
  view.setUint32(data.length + 8, ~crc >>> 0);
  return out;
};
const png = async (w, h, palette, pixels) => {
  const rows = new Uint8Array((w + 1) * h); // every row starts with filter type 0, none
  for (let y = 0; y < h; y++) rows.set(pixels.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const idat = new Uint8Array(await new Response(new Blob([rows]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, w);
  new DataView(header.buffer).setUint32(4, h);
  header.set([8, 3], 8); // 8-bit palette indices
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return new Blob([signature, chunk('IHDR', header), chunk('PLTE', Uint8Array.from(palette)), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]);
};

// GET /poyta.png?p=17.5,red.20 → the table with a 5 chip on 17 and a 20 chip on red
export const tableImage = async (url, env) => {
  if (!env.ASSETS) return new Response('Ruletin kuvat puuttuvat.', { status: 404 });
  let layout, board, chips;
  try {
    [layout, board, chips] = await loadAssets(env);
  } catch (err) {
    console.error('ruletti: table assets', err);
    return new Response('Ruletin kuvat puuttuvat.', { status: 503 });
  }
  const bets = (url.searchParams.get('p') ?? '').split(',').filter(Boolean).map((pair) => pair.split('.'));
  // only tables the bot can make: each spot once and RL.max in all, so a request draws at most one chip per spot
  const valid = (pair) => pair.length === 2 && Object.hasOwn(layout.spots, pair[0]) && /^[1-9]\d{0,2}$/.test(pair[1]);
  const unique = new Set(bets.map(([spot]) => spot)).size === bets.length;
  if (!bets.every(valid) || !unique || bets.reduce((sum, [, amount]) => sum + +amount, 0) > RL.max) return new Response('Tuntematon panos.', { status: 400 });
  const { w, h, chip: s } = layout;
  const pixels = board.slice();
  for (const [spot, amount] of bets) {
    const [cx, cy] = layout.spots[spot];
    const sprite = chips.subarray((amount - 1) * s * s, amount * s * s);
    for (let i = 0; i < s * s; i++) {
      const x = cx - (s >> 1) + (i % s);
      const y = cy - (s >> 1) + Math.floor(i / s);
      if (sprite[i] !== TRANSPARENT && x >= 0 && x < w && y >= 0 && y < h) pixels[y * w + x] = sprite[i];
    }
  }
  return new Response(await png(w, h, layout.palette, pixels), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' } });
};
