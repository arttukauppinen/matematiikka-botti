const hex = (s) => Uint8Array.from(s?.match(/../g) ?? [], (b) => parseInt(b, 16));
const reply = (content, flags, components) => Response.json({ type: 4, data: { content, flags, components } });
const fruits = ['🍒', '🍋', '🍉', '🍇', '🍊', '💀'];
const SPIN = '<a:slot_spin:1555491281000472646>';
const WIN = '<a:jackpot:1555491279385792593>';
const LOSE = WIN; // ponytail: same gif as jackpot until a shitpot gif is uploaded
// chance = relative catch weight, value = price of an average-weight fish, level = fishing level that unlocks it
const fish = [
  { name: 'ahven', icon: '🐟', rarity: 'yleinen', min: 50, max: 1800, value: 2, xp: 20, chance: 42, level: 1 },
  { name: 'särki', icon: '🐟', rarity: 'yleinen', min: 40, max: 1200, value: 2, xp: 25, chance: 25, level: 1 },
  { name: 'hauki', icon: '🐊', rarity: 'epätavallinen', min: 500, max: 15000, value: 7, xp: 70, chance: 15, level: 10 },
  { name: 'kuha', icon: '🐠', rarity: 'harvinainen', min: 500, max: 12000, value: 16, xp: 130, chance: 8, level: 25 },
  { name: 'lohi', icon: '🐟', rarity: 'harvinainen', min: 1000, max: 20000, value: 27, xp: 220, chance: 6, level: 40 },
  { name: 'järvitaimen', icon: '🐟', rarity: 'eeppinen', min: 500, max: 10000, value: 54, xp: 400, chance: 3, level: 60 },
  { name: 'monni', icon: '🐡', rarity: 'legendaarinen', min: 5000, max: 50000, value: 250, xp: 800, chance: 1, level: 80 },
];
const rarities = [...new Set(fish.map((f) => f.rarity))];
// /perho: bites within 2–25 s because the bite edit must fit in the 30 s waitUntil limit
const FLY_BITE = 23000;
// /gatiska: an owned trap lasts 7 days and holds 6 fish, one an hour (full in 6 h). Rarer and heavier fish like perho, double XP.
// Fish start dying 24 h after the last check, one more every 6 h.
const TRAP = { cost: 300, max: 5, level: 20, life: 7 * 864e5, every: 36e5, cap: 6, xp: 2, rot: 24 * 36e5, dies: 6 * 36e5 };
const button = (custom_id, label, disabled = false) => [{ type: 1, components: [{ type: 2, style: 1, custom_id, label, disabled }] }];
// RuneScape XP table: xpFor[level] = total XP needed to reach that level
const xpFor = [0, 0];
for (let level = 1, sum = 0; level < 99; level++) xpFor.push(Math.floor((sum += Math.floor(level + 300 * 2 ** (level / 7))) / 4));
const levelFor = (xp) => {
  let level = 1;
  while (level < 99 && xp >= xpFor[level + 1]) level++;
  return level;
};
const fishingKey = (id) => `fishing:${id}`;
const rodKey = (guild, id) => `fishing-rod:${guild ?? 'dm'}:${id}`;
const flyKey = (guild, id) => `fishing-fly:${guild ?? 'dm'}:${id}`;
const netKey = (guild, id) => `fishing-pending:${guild ?? 'dm'}:${id}`; // old name kept so nets cast before the rod got its own key can still be raised
const fishingState = async (store, id) => {
  const { xp = 0 } = JSON.parse((await store.get(fishingKey(id))) || '{}');
  return { xp, level: levelFor(xp) };
};
// rare (perho, gatiska): rarer species are likelier (√chance) and fish skew heavier (√random)
const pickFish = (level, rare) => {
  const pool = fish.filter((f) => f.level <= level);
  const odds = (f) => (rare ? Math.sqrt(f.chance) : f.chance);
  let n = Math.random() * pool.reduce((sum, f) => sum + odds(f), 0);
  return pool.find((f) => (n -= odds(f)) < 0) ?? pool[0];
};
const catchFish = (level, rare = false, xpTimes = 1) => {
  const f = pickFish(level, rare);
  const r = Math.random();
  let weight = f.min + (rare ? Math.sqrt(r) : r) * (f.max - f.min);
  const giant = Math.random() > 0.99;
  if (giant) weight *= 2 + Math.random() * 2;
  weight = Math.round(weight);
  const value = Math.max(1, Math.round((f.value * weight) / ((f.min + f.max) / 2)));
  // Discord embeds can't show SVG, so the images are PNGs
  const image = `https://raw.githubusercontent.com/arttukauppinen/matematiikka-botti/main/emoji/fish-${f.name.normalize('NFD').replace(/\p{M}/gu, '')}.png`;
  return { ...f, weight, giant, value, image, xp: f.xp * xpTimes };
};
const formatWeight = (weight) => (weight < 1000 ? `${weight} g` : `${(weight / 1000).toFixed(2).replace('.', ',')} kg`);
// Sells the catch and saves coins, XP and server stats. KV allows one write per second per key, so every key is written once.
const land = async (store, guild, id, state, caught) => {
  const [coins, day] = await walletOf(store, id);
  const total = caught.reduce((sum, f) => sum + f.value, 0);
  const xp = state.xp + caught.reduce((sum, f) => sum + f.xp, 0);
  const level = levelFor(xp);
  await store.put(id, `${coins + total} ${day ?? ''}`.trim());
  await store.put(fishingKey(id), JSON.stringify({ level, xp }));
  if (guild) {
    const key = `fishing-stats:${guild}:${id}`;
    const stats = JSON.parse((await store.get(key)) || '{"count":0,"biggest":null,"rarities":{}}');
    for (const f of caught) {
      stats.count++;
      stats.rarities[f.rarity] = (stats.rarities[f.rarity] ?? 0) + 1;
      if (!stats.biggest || f.weight > stats.biggest.weight) stats.biggest = { name: f.name, weight: f.weight };
    }
    await store.put(key, JSON.stringify(stats));
  }
  return `💰 **+${total}** 🪙 · 🎣 LVL **${level}** (+${xp - state.xp} XP)${level > state.level ? ' ✨ Uusi taso!' : ''}`;
};
const interactionUpdate = (content, components = [], embeds = []) => Response.json({ type: 7, data: { content, components, embeds } });
const walletOf = async (store, playerId) => {
  const [coins, day] = ((await store.get(playerId)) ?? '0').split(' ');
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
  return +coins === 0 && day !== today ? [10, today] : [+coins, day];
};

const calc = (s) => {
  const t = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').match(/\d+(?:[.,]\d+)?|\S/g) ?? [];
  let i = 0;
  const eat = (c) => t[i] === c && ++i;
  const expr = () => {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  };
  const term = () => {
    let v = unary();
    for (;;) {
      if (eat('*')) v *= unary();
      else if (eat('/')) v /= unary();
      else return v;
    }
  };
  const unary = () => (eat('-') ? -unary() : eat('+') ? unary() : pow());
  const pow = () => {
    const b = atom();
    return eat('^') ? b ** unary() : b;
  };
  const atom = () => {
    if (eat('(')) {
      const v = expr();
      if (!eat(')')) throw 0;
      return v;
    }
    if (!/^\d/.test(t[i] ?? '')) throw 0;
    return parseFloat(t[i++].replace(',', '.'));
  };
  const v = expr();
  if (i < t.length || !Number.isFinite(v)) throw 0;
  return String(+v.toPrecision(12)).replace('.', ',');
};

export default {
  async fetch(req, env, ctx) {
    const body = await req.text();
    const key = await crypto.subtle.importKey('raw', hex(env.DISCORD_PUBLIC_KEY), 'Ed25519', false, ['verify']);
    const msg = new TextEncoder().encode(req.headers.get('x-signature-timestamp') + body);
    const ok = await crypto.subtle.verify('Ed25519', key, hex(req.headers.get('x-signature-ed25519')), msg).catch(() => false);
    if (!ok) return new Response(null, { status: 401 });

    const { type, data, member, user, guild_id, application_id, token } = JSON.parse(body);
    if (type === 1) return Response.json({ type: 1 });

    const o = Object.fromEntries((data.options ?? []).map((x) => [x.name, x.value]));
    if (data.name === 'makelippo') {
      try {
        return reply(`\`${o.laskutoimitus}\` = **${calc(o.laskutoimitus)}** 🤓`);
      } catch {
        return reply(`En osaa laskea tätä: \`${o.laskutoimitus}\` 🤓`, 64);
      }
    }
    const playerId = (member?.user ?? user)?.id;
    const store = playerId && env.COINS;
    // returns [flags, content]: 64 = nothing to raise yet, shown only to the player
    const raiseNet = async () => {
      const key = netKey(guild_id, playerId);
      const net = JSON.parse((await store?.get(key)) || 'null');
      if (!net) return [64, 'Sinulla ei ole verkkoa vedessä.'];
      if (Date.now() < net.readyAt) return [64, `Verkko on vielä vedessä. Nosta se noin **${Math.ceil((net.readyAt - Date.now()) / 60000)} min** kuluttua.`];
      await store.delete(key);
      // 2 fish + 1 per 15 min chosen, a partial 15 min is a chance of one more: 60 min = 6
      const count = 2 + Math.floor(Math.round((net.readyAt - net.castAt) / 60000) / 15 + Math.random());
      const state = await fishingState(store, playerId);
      const caught = Array.from({ length: count }, () => catchFish(state.level));
      const list = caught.map((f) => `${f.icon} ${f.name} ${formatWeight(f.weight)}${f.giant ? ' (jättiläinen)' : ''}`).join(' · ');
      return [0, `🕸️ Verkossa oli **${count}** kalaa!\n${list}\n${await land(store, guild_id, playerId, state, caught)}`];
    };

    if (type === 3) {
      // buttons carry the id of the player who cast; older buttons without it belong to whoever clicks
      const [game, , owner = playerId] = data.custom_id.split(':');
      if (owner !== playerId) return reply('Tämä ei ole sinun saaliisi. Heitä omasi: `/galastus` tai `/verkko`.', 64);
      if (game === 'verkko') {
        const [flags, content] = await raiseNet();
        return flags ? reply(content, flags) : interactionUpdate(content);
      }
      if (game === 'perho') {
        const key = flyKey(guild_id, playerId);
        const cast = JSON.parse((await store?.get(key)) || 'null');
        if (!cast) return interactionUpdate('Tämä perho on jo nostettu.');
        if (Date.now() < cast.readyAt) return reply('Kala ei ole vielä iskenyt, odota! 🪰', 64);
        await store.delete(key);
        const outcome = Math.random();
        if (outcome < 0.25) return interactionUpdate('💥 Perho katkesi! Kala vei sen mukanaan.');
        if (outcome < 0.5) return interactionUpdate('Perho nosti saaliiksi vanhan saappaan. Ei kolikoita tällä kertaa. 🥾');
        const state = await fishingState(store, playerId);
        const f = catchFish(state.level, true, 3);
        const content = `🪰 Sait perholla **${f.name}** (${formatWeight(f.weight)}, ${f.rarity}${f.giant ? ', jättiläinen!' : ''})\n${await land(store, guild_id, playerId, state, [f])}`;
        return interactionUpdate(content, [], [{ title: f.name, image: { url: f.image } }]);
      }
      const key = rodKey(guild_id, playerId);
      const rod = JSON.parse((await store?.get(key)) || 'null');
      if (!rod) return interactionUpdate('Tämä siima on jo nostettu.');
      if (Date.now() < rod.readyAt) return reply('Kala ei ole vielä kiinni, odota! 🎣', 64);
      await store.delete(key);
      const outcome = Math.random();
      if (outcome < 0.08) {
        const [coins, day] = await walletOf(store, playerId);
        const penalty = Math.min(5, coins);
        await store.put(playerId, `${coins - penalty} ${day ?? ''}`.trim());
        return interactionUpdate(`💥 Siima katkesi! Menetit **${penalty}** 🪙`);
      }
      if (outcome < 0.16) return interactionUpdate('Sait saaliiksi vanhan saappaan. Ei kolikoita tällä kertaa. 🥾');
      const state = await fishingState(store, playerId);
      const f = catchFish(state.level);
      const content = `${f.icon} Sait **${f.name}** (${formatWeight(f.weight)}, ${f.rarity}${f.giant ? ', jättiläinen!' : ''})\n${await land(store, guild_id, playerId, state, [f])}`;
      return interactionUpdate(content, [], [{ title: f.name, image: { url: f.image } }]);
    }

    if (data.name === 'leaderboard') {
      if (!guild_id || !env.COINS) return reply('Leaderboard toimii vain palvelimella.', 64);
      const { keys } = await env.COINS.list({ prefix: `g:${guild_id}:` });
      const rows = await Promise.all(
        keys.map(async ({ name: key }) => [
          ((await env.COINS.get(key)) ?? '').replace(/`/g, "'").slice(0, 16),
          (await walletOf(env.COINS, key.split(':')[2]))[0],
        ]),
      );
      if (!rows.length) return reply('Tällä palvelimella ei ole vielä pelaajia.', 64);
      const top = rows.sort((a, b) => b[1] - a[1]).slice(0, 10);
      const w = Math.max(...top.map(([n]) => n.length));
      const sw = Math.max(...top.map(([, c]) => String(c).length));
      const lines = top.map(([n, c], i) => `${String(i + 1).padStart(2)}  ${n.padEnd(w)}  ${String(c).padStart(sw)}`);
      const board = `\`\`\`\n${lines.join('\n')}\n\`\`\``;
      const fishers = (await env.COINS.list({ prefix: `fishing-stats:${guild_id}:` })).keys;
      if (!fishers.length) return reply(board);
      const fishRows = await Promise.all(
        fishers.map(async ({ name: key }) => {
          const id = key.split(':')[2];
          const { count, biggest, rarities: caught } = JSON.parse(await env.COINS.get(key));
          const name = ((await env.COINS.get(`g:${guild_id}:${id}`)) ?? id).replace(/`/g, "'").slice(0, 16);
          const tiers = rarities.filter((r) => caught[r]).map((r) => `${r} ${caught[r]}`).join(', ');
          return { name, level: (await fishingState(env.COINS, id)).level, count, biggest, tiers };
        }),
      );
      const best = fishRows.sort((a, b) => b.biggest.weight - a.biggest.weight).slice(0, 10);
      const fw = Math.max(...best.map((r) => r.name.length));
      const cw = Math.max(...best.map((r) => String(r.count).length));
      const fishLines = best.map(
        (r, i) => `${String(i + 1).padStart(2)}  ${r.name.padEnd(fw)}  LVL ${String(r.level).padStart(2)}  ${String(r.count).padStart(cw)} kalaa  ennätys ${r.biggest.name} ${formatWeight(r.biggest.weight)}  ${r.tiers}`,
      );
      return reply(`${board}\n\n🎣 KALASTUS\n\`\`\`\n${fishLines.join('\n')}\n\`\`\``);
    }

    const mark = async (id, m, u) => {
      const name = m?.nick ?? u?.global_name ?? u?.username ?? id;
      const key = `g:${guild_id}:${id}`;
      if ((await store.get(key)) !== name) await store.put(key, name);
    };
    if (store && guild_id && ['kukkaro', 'goneisii', 'gruunavaiglaava', 'lainaa', 'galastus', 'perho', 'gatiska', 'verkko'].includes(data.name)) await mark(playerId, member, member?.user ?? user);

    const [coins, day] = store ? await walletOf(store, playerId) : [];
    if (data.name === 'kukkaro') return reply(`Sulla on **${coins ?? 0}** kolikkoa 🪙`);

    if (data.name === 'kalastustaso') {
      if (!store) return reply('Kalastustaso vaatii käytössä olevan kolikkotallennuksen.', 64);
      const { level, xp } = await fishingState(store, playerId);
      const next = level < 99 ? ` · LVL ${level + 1}: ${xpFor[level + 1]} XP` : '';
      const list = fish.map((f) => `${f.level <= level ? '✅' : '🔒'} ${f.icon} ${f.name} (${f.rarity}): LVL ${f.level} · +${f.xp} XP`).join('\n');
      return reply(`🎣 Kalastus LVL **${level}** · **${xp} XP**${next}\n\n${list}`);
    }

    if (data.name === 'galastus') {
      if (!store) return reply('Kalastus vaatii käytössä olevan kolikkotallennuksen.', 64);
      const cost = 3;
      if (coins < cost) return reply(`Ei tarpeeksi kolikoita, syötti maksaa ${cost} 🪙`, 64);
      const key = rodKey(guild_id, playerId);
      const old = JSON.parse((await store.get(key)) || 'null');
      // a hooked fish waits until it is raised; casting again after the bite gives it up, so a lost message can't lock the rod
      if (old && Date.now() < old.readyAt) return reply('Sinulla on jo siima vedessä.', 64);
      const now = Date.now();
      const biteDelay = 2000 + Math.floor(Math.random() * 18000);
      await store.put(playerId, `${coins - cost} ${day ?? ''}`.trim());
      await store.put(key, JSON.stringify({ castAt: now, readyAt: now + biteDelay }), { expirationTtl: 86400 });
      const id = `galastus:catch:${playerId}`;
      const edit = (content, components) =>
        fetch(`https://discord.com/api/v10/webhooks/${application_id}/${token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, components }),
        });
      // the button turns on only after readyAt; the longest bite (20 s) fits in the 30 s waitUntil limit
      ctx.waitUntil(
        (async () => {
          await scheduler.wait(1000);
          await edit('🌊🎣 Siima on vedessä...\n🌊〰️🌊', button(id, 'Odota', true));
          await scheduler.wait(1000);
          await edit('🌊🎣 Jotain liikahti vedessä...\n〰️🐟〰️', button(id, 'Odota', true));
          await scheduler.wait(biteDelay - 2000);
          await edit('🐟 Kala on kiinni! Nosta siima nyt!', button(id, 'Nosta kala'));
        })(),
      );
      return reply('🌊🎣 Heitit syötin veteen...\n〰️🌊〰️', undefined, button(id, 'Odota', true));
    }

    if (data.name === 'perho') {
      if (!store) return reply('Perhokalastus vaatii käytössä olevan kolikkotallennuksen.', 64);
      const cost = 10;
      const { level } = await fishingState(store, playerId);
      if (level < 10) return reply(`🔒 Perhokalastus avautuu kalastustasolla 10, sinulla on LVL ${level}. Kalasta ensin \`/galastus\` tai \`/verkko\`.`, 64);
      if (coins < cost) return reply(`Ei tarpeeksi kolikoita, perho maksaa ${cost} 🪙`, 64);
      const key = flyKey(guild_id, playerId);
      const old = JSON.parse((await store.get(key)) || 'null');
      if (old && Date.now() < old.readyAt) return reply('Sinulla on jo perho vedessä.', 64);
      const now = Date.now();
      const biteDelay = 2000 + Math.floor(Math.random() * FLY_BITE);
      await store.put(playerId, `${coins - cost} ${day ?? ''}`.trim());
      await store.put(key, JSON.stringify({ castAt: now, readyAt: now + biteDelay }), { expirationTtl: 86400 });
      const id = `perho:catch:${playerId}`;
      const edit = (content, components) =>
        fetch(`https://discord.com/api/v10/webhooks/${application_id}/${token}/messages/@original`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, components }),
        });
      ctx.waitUntil(
        (async () => {
          await scheduler.wait(1000);
          await edit('🪰🎣 Perho kelluu virrassa...\n🌊〰️🌊', button(id, 'Odota', true));
          await scheduler.wait(1000);
          await edit('🪰🎣 Jotain liikahti pinnan alla...\n〰️🐟〰️', button(id, 'Odota', true));
          await scheduler.wait(biteDelay - 2000);
          await edit('🐟 Kala iski perhoon! Nosta nopeasti!', button(id, 'Nosta kala'));
        })(),
      );
      return reply('🪰🎣 Heitit perhon veteen...\n〰️🌊〰️', undefined, button(id, 'Odota', true));
    }

    if (data.name === 'gatiska') {
      if (!store) return reply('Katiskat vaativat käytössä olevan kolikkotallennuksen.', 64);
      const state = await fishingState(store, playerId);
      if (state.level < TRAP.level) return reply(`🔒 Katiskat avautuvat kalastustasolla ${TRAP.level}, sinulla on LVL ${state.level}.`, 64);
      const key = `fishing-traps:${playerId}`;
      const traps = JSON.parse((await store.get(key)) || '[]');
      const now = Date.now();
      const rusted = (t) => now >= t.boughtAt + TRAP.life;
      if (o.toiminto === 'osta') {
        const active = traps.filter((t) => !rusted(t)).length;
        if (active >= TRAP.max) return reply(`Sinulla on jo ${TRAP.max} katiskaa vedessä.`, 64);
        if (coins < TRAP.cost) return reply(`Ei tarpeeksi kolikoita, katiska maksaa ${TRAP.cost} 🪙`, 64);
        traps.push({ boughtAt: now, checkedAt: now });
        await store.put(playerId, `${coins - TRAP.cost} ${day ?? ''}`.trim());
        await store.put(key, JSON.stringify(traps));
        return reply(`🪤 Laskit katiskan veteen (${active + 1}/${TRAP.max}). Se kerää kaloja viikon, kunnes ruostuu puhki. Katso katiskat: \`/gatiska\``);
      }
      if (!traps.length) return reply(`Sinulla ei ole katiskoja. Osta: \`/gatiska toiminto:osta\` (${TRAP.cost} 🪙)`, 64);
      const caught = [];
      const lines = traps.map((t, i) => {
        const end = Math.min(now, t.boughtAt + TRAP.life);
        const fish = Math.min(TRAP.cap, Math.floor((end - t.checkedAt) / TRAP.every));
        const dead = Math.min(fish, Math.max(0, Math.ceil((now - t.checkedAt - TRAP.rot) / TRAP.dies)));
        const otter = fish > dead && Math.random() < 0.1 ? Math.ceil((fish - dead) / 2) : 0;
        const got = Array.from({ length: fish - dead - otter }, () => catchFish(state.level, true, TRAP.xp));
        caught.push(...got);
        // time toward the next fish carries over, unless the trap was full
        t.checkedAt = fish < TRAP.cap ? t.checkedAt + fish * TRAP.every : end;
        const notes = [dead && `💀 ${dead} kuoli`, otter && `🦦 saukko söi ${otter}`, ...got.map((f) => `${f.icon} ${f.name} ${formatWeight(f.weight)}${f.giant ? ' (jättiläinen)' : ''}`)];
        const life = rusted(t) ? 'ruostui puhki 🗑️' : `(${Math.ceil((t.boughtAt + TRAP.life - now) / 864e5)} pv)`;
        return `#${i + 1} ${life} ${notes.filter(Boolean).join(' · ') || 'tyhjä'}`;
      });
      await store.put(key, JSON.stringify(traps.filter((t) => !rusted(t))));
      const summary = caught.length ? await land(store, guild_id, playerId, state, caught) : 'Ei saalista tällä kertaa.';
      return reply(`🪤 Katiskat\n${lines.join('\n')}\n${summary}`);
    }

    if (data.name === 'verkko') {
      if (!store) return reply('Verkkokalastus vaatii käytössä olevan kolikkotallennuksen.', 64);
      if (o.toiminto === 'nosta') {
        const [flags, content] = await raiseNet();
        return reply(content, flags);
      }
      const cost = 20;
      const minutes = Math.min(Math.max(o.kesto ?? 10, 1), 60);
      if (coins < cost) return reply(`Ei tarpeeksi kolikoita, verkko maksaa ${cost} 🪙`, 64);
      const key = netKey(guild_id, playerId);
      if (await store.get(key)) return reply('Sinulla on jo verkko vedessä. Nosta se ensin: `/verkko nosta`', 64);
      const now = Date.now();
      await store.put(playerId, `${coins - cost} ${day ?? ''}`.trim());
      await store.put(key, JSON.stringify({ castAt: now, readyAt: now + minutes * 60000 }), { expirationTtl: 86400 });
      return reply(`🕸️ Heitit verkon veteen **${minutes} minuutiksi**. Nosta se myöhemmin tästä napista.`, undefined, button(`verkko:raise:${playerId}`, 'Nosta verkko'));
    }

    if (data.name === 'lainaa') {
      const to = o.kenelle;
      const amount = o.määrä;
      if (!store || !guild_id) return reply('Lainaus toimii vain palvelimella.', 64);
      if (to === playerId) return reply('Et voi lainata itsellesi.', 64);
      if (data.resolved?.users?.[to]?.bot) return reply('Botille ei voi lainata.', 64);
      if (coins < amount) return reply(`Ei tarpeeksi kolikkoja, sulla on **${coins}** 🪙`, 64);
      const [theirs, theirDay] = await walletOf(store, to);
      await store.put(playerId, `${coins - amount} ${day ?? ''}`.trim());
      await store.put(to, `${theirs + amount} ${theirDay ?? ''}`.trim());
      await mark(to, data.resolved?.members?.[to], data.resolved?.users?.[to]);
      return reply(`💸 <@${playerId}> → <@${to}> **${amount}** 🪙`);
    }

    if (data.name === 'goneisii' || data.name === 'gruunavaiglaava') {
      const cost = data.name === 'goneisii' ? 3 : (o.panos ?? 1);
      if (store && coins < cost) return reply(`Ei tarpeeksi kolikkoja, tarvitset ${cost} 🪙 Nollasaldolla saat 10 ilmaista kerran päivässä.`, 64);
      const signed = (n) => `${n < 0 ? '' : '+'}${n}`;

      if (data.name === 'gruunavaiglaava') {
        const side = Math.random() < 0.5 ? 'kruuna' : 'klaava';
        const net = side === o.valinta ? cost : -cost;
        if (store) await store.put(playerId, `${coins + net} ${day ?? ''}`.trim());
        return reply(store ? `🪙 ${side}\n${signed(net)} 🪙` : `🪙 ${side}`);
      }

      // ponytail: waitUntil lives max 30 s after the reply and each spin animates for 3 s, so autospin caps at 8 (also max_value in deploy.yml)
      const total = Math.min(o.autospin ?? 1, 8);
      const spins = [];
      let bal = coins;
      while (spins.length < total && !(store && bal < cost)) {
        const reels = Array.from({ length: 3 }, () => fruits[Math.floor(Math.random() * fruits.length)]);
        const matches = new Set(reels).size;
        const shit = matches === 1 && reels[0] === '💀';
        const net = shit ? -cost - Math.ceil((bal - cost) * 0.7) : (matches === 1 ? 100 : matches === 2 ? 10 : 0) - cost;
        const verdict = shit ? `# ${LOSE} SHITPOT! ${LOSE}` : matches === 1 ? `# ${WIN} JACKPOT! ${WIN}` : matches === 2 ? 'close ✨' : 'ei voittoa';
        spins.push({ reels, before: bal - coins, text: `🎰 ${reels.join(' | ')} 🎰\n${verdict}${store ? `\n${signed(net)} 🪙` : ''}` });
        bal += net;
      }
      if (store) await store.put(playerId, `${bal} ${day ?? ''}`.trim());

      const foot = (i, sum) => (total > 1 ? `\n🔁 ${i + 1}/${total}${store ? ` · yht. ${signed(sum)} 🪙` : ''}` : '');
      const frame = (i, n) => `🎰 ${spins[i].reels.map((r, k) => (k < n ? r : SPIN)).join(' | ')} 🎰${foot(i, spins[i].before)}`;
      const edits = spins.flatMap((s, i) => [frame(i, 1), frame(i, 2), s.text + foot(i, spins[i + 1]?.before ?? bal - coins)]);
      ctx.waitUntil(
        (async () => {
          let sent;
          for (const content of edits) {
            await Promise.all([scheduler.wait(1000), sent]);
            sent = fetch(`https://discord.com/api/v10/webhooks/${application_id}/${token}/messages/@original`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content }),
            });
          }
          await sent;
        })(),
      );
      return reply(frame(0, 0));
    }

    const lo = Math.min(o.min ?? 1, o.max);
    const hi = Math.max(o.min ?? 1, o.max);
    return reply(`🎲 ${lo + Math.floor(Math.random() * (hi - lo + 1))}`);
  },
};
