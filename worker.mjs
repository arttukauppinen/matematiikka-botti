const hex = (s) => Uint8Array.from(s?.match(/../g) ?? [], (b) => parseInt(b, 16));
const reply = (content, flags, components) => Response.json({ type: 4, data: { content, flags, components } });
const fruits = ['🍒', '🍋', '🍉', '🍇', '🍊', '💀'];
const SPIN = '<a:slot_spin:1555491281000472646>';
const WIN = '<a:jackpot:1555491279385792593>';
const LOSE = WIN; // ponytail: same gif as jackpot until a shitpot gif is uploaded
const fish = [
  ['ahven', '🐟', 'yleinen', 50, 1800, 2, 20, 42, 1, 'ahven'],
  ['särki', '🐟', 'yleinen', 40, 1200, 2, 25, 25, 1, 'sarki'],
  ['hauki', '🐊', 'epätavallinen', 500, 15000, 7, 70, 15, 10, 'hauki'],
  ['kuha', '🐠', 'harvinainen', 500, 12000, 16, 130, 8, 25, 'kuha'],
  ['lohi', '🐟', 'harvinainen', 1000, 20000, 27, 220, 6, 40, 'lohi'],
  ['järvitaimen', '🐟', 'eeppinen', 500, 10000, 54, 400, 3, 60, 'jarvitaimen'],
  ['monni', '🐡', 'legendaarinen', 5000, 50000, 250, 800, 1, 80, 'monni'],
];
const button = (custom_id, label, disabled = false) => [{ type: 1, components: [{ type: 2, style: 1, custom_id, label, disabled }] }];
const levelFor = (xp) => {
  let level = 1;
  let needed = 0;
  while (level < 99) {
    needed += Math.floor(level + 300 * 2 ** (level / 7));
    if (Math.floor(needed / 4) > xp) return level;
    level++;
  }
  return 99;
};
const fishingKey = (id) => `fishing:${id}`;
const fishingStatsKey = (guild, id) => `fishing-stats:${guild}:${id}`;
const pendingKey = (guild, id) => `fishing-pending:${guild ?? 'dm'}:${id}`;
const fishingState = async (store, id) => JSON.parse((await store.get(fishingKey(id))) || '{"level":1,"xp":0}');
const pickFish = (level) => {
  const available = fish.filter((entry) => entry[8] <= level);
  let n = Math.random() * available.reduce((sum, entry) => sum + entry[7], 0);
  return available.find((entry) => (n -= entry[7]) < 0) ?? available[0];
};
const catchFish = (level) => {
  const [name, icon, rarity, min, max, baseValue, xp, , , imageName] = pickFish(level);
  let weight = min + Math.random() * (max - min);
  let giant = false;
  if (Math.random() > 0.99) {
    weight *= 2 + Math.random() * 2;
    giant = true;
  }
  weight = Math.round(weight);
  const value = Math.max(1, Math.round(baseValue * weight / ((min + max) / 2)));
  return { name, icon, rarity, weight, value, xp, giant, image: `https://raw.githubusercontent.com/arttukauppinen/matematiikka-botti/main/emoji/fish-${imageName}.svg` };
};
const formatWeight = (weight) => weight < 1000 ? `${weight} g` : `${(weight / 1000).toFixed(2).replace('.', ',')} kg`;
const recordCatch = async (store, guild, id, caught) => {
  if (!store || !guild) return;
  const key = fishingStatsKey(guild, id);
  const stats = JSON.parse((await store.get(key)) || '{"count":0,"xp":0,"biggest":null,"rarities":{}}');
  stats.count++;
  stats.xp += caught.xp;
  stats.rarities[caught.rarity] = (stats.rarities[caught.rarity] ?? 0) + 1;
  if (!stats.biggest || caught.weight > stats.biggest.weight) stats.biggest = { name: caught.name, weight: caught.weight };
  await store.put(key, JSON.stringify(stats));
};
const fishingProgress = async (store, id, xpGain) => {
  if (!store) return { level: levelFor(xpGain), xp: xpGain, gained: true };
  const previous = await fishingState(store, id);
  const xp = previous.xp + xpGain;
  const level = levelFor(xp);
  await store.put(fishingKey(id), JSON.stringify({ level, xp }));
  return { level, xp, gained: level > previous.level };
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
    const raiseNet = async () => {
      const key = pendingKey(guild_id, playerId);
      const pending = JSON.parse((await store?.get(key)) || 'null');
      if (!pending) return { content: 'Sinulla ei ole verkkoa vedessä.', components: [], flags: 64 };
      if (Date.now() < pending.readyAt) {
        const minutes = Math.ceil((pending.readyAt - Date.now()) / 60000);
        return { content: `Verkko on vielä vedessä. Nosta se noin **${minutes} min** kuluttua.`, components: button('verkko:raise', 'Nosta verkko'), flags: 64 };
      }
      await store.put(key, '');
      const [coins, day] = await walletOf(store, playerId);
      const count = Math.min(6, 2 + Math.floor((Date.now() - pending.castAt) / 60000));
      const fishing = await fishingState(store, playerId);
      let total = 0;
      let xp = 0;
      const caught = [];
      for (let i = 0; i < count; i++) {
        const fishCaught = catchFish(fishing.level);
        await recordCatch(store, guild_id, playerId, fishCaught);
        total += fishCaught.value;
        xp += fishCaught.xp;
        caught.push(`${fishCaught.icon} ${fishCaught.name} ${formatWeight(fishCaught.weight)}`);
      }
      await store.put(playerId, `${coins + total} ${day ?? ''}`.trim());
      const progress = await fishingProgress(store, playerId, xp);
      return { content: `🕸️ Verkossa oli **${count}** kalaa!
${caught.join(' · ')}
💰 Myynti: **+${total}** 🪙 · 🎣 LVL **${progress.level}** (+${xp} XP)${progress.gained ? ' ✨ Uusi taso!' : ''}`, components: [] };
    };

    if (type === 3 && data.custom_id === 'galastus:catch') {
      const key = pendingKey(guild_id, playerId);
      const pending = JSON.parse((await store?.get(key)) || 'null');
      if (!pending) return interactionUpdate('Tämä siima on jo nostettu.', []);
      if (Date.now() < pending.readyAt) return interactionUpdate('Liian aikaisin! Kala ei ole vielä kiinni. 🎣', button('galastus:catch', 'Odota'));
      await store.put(key, '');
      const [coins, day] = await walletOf(store, playerId);
      const outcome = Math.random();
      if (outcome < 0.08) {
        const penalty = Math.min(5, coins);
        await store.put(playerId, `${coins - penalty} ${day ?? ''}`.trim());
        return interactionUpdate(`💥 Siima katkesi! Menetit **${penalty}** 🪙`, []);
      }
      if (outcome < 0.16) return interactionUpdate('Sait saaliiksi vanhan saappaan. Ei kolikoita tällä kertaa. 🥾', []);
      const fishing = await fishingState(store, playerId);
      const fishCaught = catchFish(fishing.level);
      await store.put(playerId, `${coins + fishCaught.value} ${day ?? ''}`.trim());
      await recordCatch(store, guild_id, playerId, fishCaught);
      const progress = await fishingProgress(store, playerId, fishCaught.xp);
      return interactionUpdate(`${fishCaught.icon} Sait **${fishCaught.name}** (${formatWeight(fishCaught.weight)}, ${fishCaught.rarity}${fishCaught.giant ? ' jättiläinen' : ''})
    💰 **+${fishCaught.value}** 🪙
    🎣 Kalastus LVL **${progress.level}** (+${fishCaught.xp} XP)${progress.gained ? ' ✨ Uusi taso!' : ''}`, [], [{ title: fishCaught.name, image: { url: fishCaught.image } }]);
    }

    if (type === 3 && data.custom_id === 'verkko:raise') {
      const result = await raiseNet();
      return interactionUpdate(result.content, result.components);
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
      const fishing = await env.COINS.list({ prefix: `fishing-stats:${guild_id}:` });
      if (!fishing.keys.length) return reply(`\`\`\`\n${lines.join('\n')}\n\`\`\``);
      const fishRows = await Promise.all(fishing.keys.map(async ({ name: key }) => {
        const id = key.split(':')[2];
        const stats = JSON.parse((await env.COINS.get(key)) || '{"count":0,"xp":0,"biggest":null,"rarities":{}}');
        const name = (await env.COINS.get(`g:${guild_id}:${id}`)) ?? id;
        return { name: name.replace(/`/g, "'").slice(0, 16), level: levelFor(stats.xp), count: stats.count, biggest: stats.biggest, rarities: Object.entries(stats.rarities).map(([rarity, count]) => `${rarity} ${count}`).join(', ') };
      }));
      fishRows.sort((a, b) => (b.biggest?.weight ?? 0) - (a.biggest?.weight ?? 0));
      const fishLines = fishRows.slice(0, 10).map((row, i) => `${String(i + 1).padStart(2)}  ${row.name} LVL ${row.level} · ${row.count} kalaa · ennätys ${row.biggest?.name ?? '-'} ${formatWeight(row.biggest?.weight ?? 0)} · ${row.rarities}`);
      return reply(`\`\`\`\n${lines.join('\n')}\n\`\`\`\n\n🎣 KALASTUS\n\`\`\`\n${fishLines.join('\n')}\n\`\`\``);
    }

    if (data.name === 'kalastusleaderboard') {
      if (!guild_id || !env.COINS) return reply('Kalastusleaderboard toimii vain palvelimella.', 64);
      const { keys } = await env.COINS.list({ prefix: `fishing-stats:${guild_id}:` });
      const rows = await Promise.all(keys.map(async ({ name: key }) => {
        const id = key.split(':')[2];
        const stats = JSON.parse((await env.COINS.get(key)) || '{"count":0,"xp":0,"biggest":null,"rarities":{}}');
        const name = (await env.COINS.get(`g:${guild_id}:${id}`)) ?? id;
        const rarities = Object.entries(stats.rarities).map(([rarity, count]) => `${rarity} ${count}`).join(', ');
        return { name: name.replace(/`/g, "'").slice(0, 16), level: levelFor(stats.xp), count: stats.count, biggest: stats.biggest, rarities };
      }));
      if (!rows.length) return reply('Palvelimella ei ole vielä kalastajia.', 64);
      rows.sort((a, b) => (b.biggest?.weight ?? 0) - (a.biggest?.weight ?? 0));
      const lines = rows.slice(0, 10).map((row, i) => `${String(i + 1).padStart(2)}  ${row.name} LVL ${row.level} · ${row.count} kalaa · ennätys ${row.biggest?.name ?? '-'} ${formatWeight(row.biggest?.weight ?? 0)} · ${row.rarities}`);
      return reply(`\`\`\`\n${lines.join('\n')}\n\`\`\``);
    }

    const mark = async (id, m, u) => {
      const name = m?.nick ?? u?.global_name ?? u?.username ?? id;
      const key = `g:${guild_id}:${id}`;
      if ((await store.get(key)) !== name) await store.put(key, name);
    };
    if (store && guild_id && ['kukkaro', 'goneisii', 'gruunavaiglaava', 'lainaa', 'galastus', 'verkko'].includes(data.name)) await mark(playerId, member, member?.user ?? user);

    const [coins, day] = store ? await walletOf(store, playerId) : [];
    if (data.name === 'kukkaro') return reply(`Sulla on **${coins ?? 0}** kolikkoa 🪙`);

    if (data.name === 'kalastustaso') {
      if (!store) return reply('Kalastustaso vaatii käytössä olevan kolikkotallennuksen.', 64);
      const fishing = await fishingState(store, playerId);
      const available = fish.map(([name, icon, rarity, , , , xp, , required]) => `${required <= fishing.level ? '✅' : '🔒'} ${icon} ${name} (${rarity}): LVL ${required} · +${xp} XP`).join('\n');
      return reply(`🎣 Kalastus LVL **${fishing.level}** · **${fishing.xp} XP**\n\n${available}`);
    }

    if (data.name === 'galastus') {
      if (!store) return reply('Kalastus vaatii käytössä olevan kolikkotallennuksen.', 64);
      const cost = 3;
      if (store && coins < cost) return reply(`Ei tarpeeksi kolikoita, syötti maksaa ${cost} 🪙`, 64);
      if (store && await store.get(pendingKey(guild_id, playerId))) return reply('Sinulla on jo siima vedessä.', 64);
      const biteDelay = 2000 + Math.floor(Math.random() * 18000);
      if (store) {
        const now = Date.now();
        await store.put(playerId, `${coins - cost} ${day ?? ''}`.trim());
        await store.put(pendingKey(guild_id, playerId), JSON.stringify({ castAt: now, readyAt: now + biteDelay }), { expirationTtl: 3600 });
      }
      const edit = async (content, components) => fetch(`https://discord.com/api/v10/webhooks/${application_id}/${token}/messages/@original`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, components }) });
      ctx.waitUntil((async () => {
        await scheduler.wait(1000);
        await edit('🌊🎣 Siima on vedessä...\n🌊〰️🌊', button('galastus:catch', 'Odota', true));
        await scheduler.wait(1000);
        await edit('🌊🎣 Jotain liikahti vedessä...\n〰️🐟〰️', button('galastus:catch', 'Odota', true));
        await scheduler.wait(biteDelay - 2000);
        await edit('🐟 Kala on kiinni! Nosta siima nyt!', button('galastus:catch', 'Nosta kala'));
      })());
      return reply('🌊🎣 Heitit syötin veteen...\n〰️🌊〰️', undefined, button('galastus:catch', 'Odota', true));
    }

    if (data.name === 'verkko') {
      const action = o.toiminto;
      if (!store) return reply('Verkkokalastus vaatii käytössä olevan kolikkotallennuksen.', 64);
      const key = pendingKey(guild_id, playerId);
      if (action === 'nosta') {
        const result = await raiseNet();
        return reply(result.content, result.flags, result.components);
      }
      const cost = 20;
      const minutes = Math.min(Math.max(o.kesto ?? 10, 1), 60);
      if (store && coins < cost) return reply(`Ei tarpeeksi kolikoita, verkko maksaa ${cost} 🪙`, 64);
      if (store && await store.get(key)) return reply('Sinulla on jo verkko vedessä.', 64);
      if (store) {
        const now = Date.now();
        await store.put(playerId, `${coins - cost} ${day ?? ''}`.trim());
        await store.put(key, JSON.stringify({ castAt: now, readyAt: now + minutes * 60000 }), { expirationTtl: 86400 });
      }
      return reply(`🕸️ Heitit verkon veteen **${minutes} minuutiksi**. Nosta se myöhemmin tästä napista.`, undefined, button('verkko:raise', 'Nosta verkko'));
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
