const hex = (s) => Uint8Array.from(s?.match(/../g) ?? [], (b) => parseInt(b, 16));
const reply = (content, flags, components) => Response.json({ type: 4, data: { content, flags, components } });
const fruits = ['🍒', '🍋', '🍉', '🍇', '🍊', '💀'];
const SPIN = '<a:slot_spin:1555491281000472646>';
const WIN = '<a:jackpot:1555491279385792593>';
const LOSE = WIN; // ponytail: same gif as jackpot until a shitpot gif is uploaded
// icon = the app's emoji (Developer Portal → Emojis), chance = relative catch weight, value = price of an average-weight fish, level = fishing level that unlocks it
const fish = [
  { name: 'ahven', icon: '<:ahven:1558100883550503013>', rarity: 'yleinen', min: 50, max: 1800, value: 2, xp: 20, chance: 42, level: 1 },
  { name: 'särki', icon: '<:sarki:1558100882086961179>', rarity: 'yleinen', min: 40, max: 1200, value: 2, xp: 25, chance: 25, level: 1 },
  { name: 'hauki', icon: '<:hauki:1558100885014323292>', rarity: 'epätavallinen', min: 500, max: 15000, value: 7, xp: 70, chance: 15, level: 10 },
  { name: 'kuha', icon: '<:kuha:1558100880761557033>', rarity: 'harvinainen', min: 500, max: 12000, value: 16, xp: 130, chance: 8, level: 25 },
  { name: 'lohi', icon: '<:lohi:1558100879440224336>', rarity: 'harvinainen', min: 1000, max: 20000, value: 27, xp: 220, chance: 6, level: 40 },
  { name: 'järvitaimen', icon: '<:taimen:1558100878026604585>', rarity: 'eeppinen', min: 500, max: 10000, value: 54, xp: 400, chance: 3, level: 60 },
  { name: 'monni', icon: '<:monni:1558100876621516881>', rarity: 'legendaarinen', min: 5000, max: 50000, value: 250, xp: 800, chance: 1, level: 80 },
];
const rarities = [...new Set(fish.map((f) => f.rarity))];
// /perho: bites within 2–25 s because the bite edit must fit in the 30 s waitUntil limit
const FLY_BITE = 23000;
const FLY_COST = 8; // a boot gives the fly back, so only a snapped fly costs
// /gatiska: an owned trap lasts 7 days and holds 6 fish; every full hour a fish swims in with 50 % chance. Rarer and heavier fish
// like perho, double XP, sold at half price. Fish start dying 12 h after the last check, one more every 3 h.
// blackjack: the app's card emojis (Developer Portal → Emojis), named suit (s, h, d, c) + rank (a, 2–10, j, q, k)
const CARD = {
  sa: '1558909376989892668', s2: '1558909393326833904', s3: '1558909392164749533', s4: '1558909390478639287', s5: '1558909388817698917', s6: '1558909387152691200', s7: '1558909385911177306', s8: '1558909384199770203', s9: '1558909382891405424', s10: '1558909395893493770', sj: '1558909381460889650', sq: '1558909378470481930', sk: '1558909379384967311',
  ha: '1558909406924509254', h2: '1558909418140213370', h3: '1558909416802226246', h4: '1558909415476961291', h5: '1558909414361272485', h6: '1558909412112990339', h7: '1558909410665828512', h8: '1558909409554596022', h9: '1558909407889203311', h10: '1558909419243184278', hj: '1558909405297381448', hq: '1558909402508165170', hk: '1558909404055601163',
  da: '1558909426658840777', d2: '1558909452650807367', d3: '1558909451086471239', d4: '1558909449840754708', d5: '1558909448414822541', d6: '1558909447126913135', d7: '1558909445612896406', d8: '1558909444107272302', d9: '1558909442815295660', d10: '1558909454077141113', dj: '1558909425195032636', dq: '1558909421818478663', dk: '1558909423597129758',
  ca: '1558909460657733672', c2: '1558909473521934507', c3: '1558909472217370634', c4: '1558909470573207612', c5: '1558909469348466688', c6: '1558909468199096471', c7: '1558909466961903696', c8: '1558909465594564688', c9: '1558909462339780798', c10: '1558909475342123159', cj: '1558909458678022276', cq: '1558909455259934802', ck: '1558909456283209910',
};
const BACK = '<:kortti_selka:1558909399299522630>';
const FLIP = '<a:kortti_flip:1558909401430229092>';
const BJ = { min: 1, max: 500, step: 600 }; // bet limits; ms between dealt cards, like the slot reels
const cardEmoji = (c) => `<:${c}:${CARD[c]}>`;
const handValue = (cards) => {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const rank = c.slice(1);
    if (rank === 'a') aces++;
    total += rank === 'a' ? 11 : 'jqk'.includes(rank) ? 10 : +rank;
  }
  for (; total > 21 && aces; aces--) total -= 10;
  return total;
};
const isBlackjack = (cards) => cards.length === 2 && handValue(cards) === 21;
const shuffledDeck = () => {
  const deck = Object.keys(CARD);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};
// /guoma: a free buddy casts the rod once a minute with the bait money you give him, a bit luckier than you. He keeps the
// money from the fish, you get the XP. With 10 % chance per hire he ends up in jail and the catch costs bail; the catch is
// paid out only when every cast is done.
const KUOMA = { bait: 3, max: 300, every: 6e4, level: 30, skill: 0.75, jail: 0.1, bail: 500 };
const TRAP = { cost: 300, max: 5, level: 20, life: 7 * 864e5, every: 36e5, chance: 0.5, cap: 6, xp: 2, price: 0.5, rot: 12 * 36e5, dies: 3 * 36e5 };
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
// skill < 1 makes rarer species likelier (chance^skill) and fish heavier (random^skill): 0.5 for perho and gatiska, 0.75 for guoma
const pickFish = (level, skill) => {
  const pool = fish.filter((f) => f.level <= level);
  const odds = (f) => f.chance ** skill;
  let n = Math.random() * pool.reduce((sum, f) => sum + odds(f), 0);
  return pool.find((f) => (n -= odds(f)) < 0) ?? pool[0];
};
const catchFish = (level, skill = 1, xpTimes = 1, price = 1) => {
  const f = pickFish(level, skill);
  const r = Math.random();
  let weight = f.min + r ** skill * (f.max - f.min);
  const giant = Math.random() > 0.99;
  if (giant) weight *= 2 + Math.random() * 2;
  weight = Math.round(weight);
  const value = Math.max(1, Math.round((f.value * weight * price) / ((f.min + f.max) / 2)));
  return { ...f, weight, giant, value, xp: f.xp * xpTimes };
};
// a single catch as a headline: the emoji renders large in a # heading, the details go in -# subtext
const hero = (f, via) => `# ${f.icon} ${f.name[0].toUpperCase()}${f.name.slice(1)}\n-# ${[via, formatWeight(f.weight), f.rarity, f.giant && 'jättiläinen!'].filter(Boolean).join(' · ')}`;
const formatWeight = (weight) => (weight < 1000 ? `${weight} g` : `${(weight / 1000).toFixed(2).replace('.', ',')} kg`);
// Sells the catch and saves coins, XP and server stats. KV allows one write per second per key, so every key is written once.
const land = async (store, guild, id, state, caught, cost = 0) => {
  const [coins, day] = await walletOf(store, id);
  const total = caught.reduce((sum, f) => sum + f.value, 0);
  const xp = state.xp + caught.reduce((sum, f) => sum + f.xp, 0);
  const level = levelFor(xp);
  await store.put(id, `${coins + total - cost} ${day ?? ''}`.trim());
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
  return `${total ? `💰 **+${total}** 🪙 · ` : ''}🎣 LVL **${level}** (+${xp - state.xp} XP)${level > state.level ? ' ✨ Uusi taso!' : ''}`;
};
const interactionUpdate = (content, components = []) => Response.json({ type: 7, data: { content, components } });
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

    const duration = (ms) => {
      const m = Math.ceil(ms / 6e4);
      return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
    };
    // rolls the casts made so far and stores them; pays out only when every cast is done. paying = the bail button was pressed
    const kuomaReport = async (paying = false) => {
      const key = `fishing-kuoma:${playerId}`;
      const k = JSON.parse((await store?.get(key)) || 'null');
      if (!k) return [64, `Sinulla ei ole kuomaa kalassa. Palkkaa: \`/guoma kolikot:${KUOMA.max}\``];
      const due = Math.min(k.casts, Math.floor((Date.now() - k.start) / KUOMA.every));
      const state = await fishingState(store, playerId);
      for (; k.done < due; k.done++) {
        const outcome = Math.random();
        if (outcome < 0.08) k.snapped++;
        else if (outcome < 0.16) k.boots++;
        else {
          const { name, rarity, weight, value, xp, giant } = catchFish(state.level, KUOMA.skill);
          k.caught.push({ name, rarity, weight, value, xp, giant });
        }
      }
      const caught = k.caught.map((c) => ({ ...fish.find((f) => f.name === c.name), ...c }));
      const big = caught.reduce((a, f) => (!a || f.weight > a.weight ? f : a), null);
      const species = fish.map((f) => [f.icon, caught.filter((c) => c.name === f.name).length]);
      const tally = [...species, ['🥾', k.boots], ['💥', k.snapped]].filter(([, n]) => n).map(([icon, n]) => `${icon} ×${n}`).join(' · ');
      const progress = `${k.done}/${k.casts}`;
      if (k.done < k.casts) {
        await store.put(key, JSON.stringify(k));
        const best = big ? `\n-# suurin tähän asti: ${big.icon} ${big.name} ${formatWeight(big.weight)}` : '';
        return [64, `🧔 Kuoma kalastaa: ${progress} heittoa, valmis noin ${duration(k.start + k.casts * KUOMA.every - Date.now())} kuluttua\n${tally || 'ei saalista vielä'}${best}`];
      }
      if (k.jail && !paying) {
        await store.put(key, JSON.stringify(k));
        return [0, `🚔 Kuoma onanoi laiturilla ja joutui putkaan. Maksa ${KUOMA.bail} 🪙 takuita lunastaaksesi saaliin.`, button(`guoma:bail:${playerId}`, `Maksa takuut (${KUOMA.bail} 🪙)`)];
      }
      if (k.jail && (await walletOf(store, playerId))[0] < KUOMA.bail) return [64, `Takuisiin tarvitaan ${KUOMA.bail} 🪙.`];
      await store.delete(key);
      const bail = k.jail ? KUOMA.bail : 0;
      const sold = caught.reduce((sum, f) => sum + f.value, 0);
      return [0, [
        big ? hero(big, `🧔 kuoman saalis ${progress}`) : `🧔 Kuoman saalis ${progress}: ei kaloja`,
        tally,
        sold && `🧔 Kuoma myi kalat ja piti rahat (${sold} 🪙)`,
        bail && `🚔 Takuut −${bail} 🪙`,
        caught.length || bail ? await land(store, guild_id, playerId, state, caught.map((f) => ({ ...f, value: 0 })), bail) : '',
        '🧔 Kuoma käytti kaikki syötit ja lähti kotiin.',
      ].filter(Boolean).join('\n')];
    };

    // one blackjack hand. Returns an error string (shown only to the player) or the frames to show: the first is the reply,
    // the rest are edits BJ.step apart. Each request writes the wallet and the game at most once.
    const blackjack = async (action, betArg) => {
      const key = `blackjack:${playerId}`;
      const sessionKey = `blackjack-session:${playerId}`;
      let g = JSON.parse((await store.get(key)) || 'null');
      if (g) g.session ??= { hands: 0, net: 0, wins: 0, blackjacks: 0, pushes: 0, losses: 0 };
      const [coins, day] = await walletOf(store, playerId);
      const hand = (cards, extra = []) => ({ row: [...cards.map(cardEmoji), ...extra], total: cards.length ? handValue(cards) : '' });
      const view = (dealer, player, bottom) =>
        [`-# JAKAJA${dealer.total === '' ? '' : ` · ${dealer.total}`}`, `# ${dealer.row.join(' ')}`, `-# SINÄ${player.total === '' ? '' : ` · ${player.total}`}`, `# ${player.row.join(' ')}`, bottom].join('\n');
      const signed = (n) => `${n < 0 ? '−' : '+'}${Math.abs(n)} 🪙`;
      const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
      const sessionText = (s) => (s.hands ? ` · sessio ${signed(s.net)} (${count(s.hands, 'käsi', 'kättä')})` : '');
      const stake = (extra = '') => `-# panos ${g.bet} 🪙${g.bet > g.base ? ' (tuplattu)' : ''}${extra}${sessionText(g.session)}`;
      const buttons = (balance, disabled = false) => [
        {
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: `blackjack:hit:${playerId}`, label: 'Ota kortti', disabled },
            { type: 2, style: 2, custom_id: `blackjack:stand:${playerId}`, label: 'Jää', disabled },
            ...(g.player.length === 2 && balance >= g.base ? [{ type: 2, style: 3, custom_id: `blackjack:double:${playerId}`, label: `Tuplaa +${g.base} 🪙`, disabled }] : []),
          ],
        },
      ];
      const off = () => buttons(0, true);
      const playing = (balance) => [view(hand([g.dealer[0]], [BACK]), hand(g.player), stake()), buttons(balance)];
      const frames = [];
      let spend = 0;
      const dealerPlays = () => {
        frames.push([view(hand([g.dealer[0]], [FLIP]), hand(g.player), stake()), off()]);
        frames.push([view(hand(g.dealer), hand(g.player), stake()), off()]);
        while (handValue(g.dealer) < 17) {
          frames.push([view(hand(g.dealer, [FLIP]), hand(g.player), stake()), off()]);
          g.dealer.push(g.deck.pop());
          frames.push([view(hand(g.dealer), hand(g.player), stake()), off()]);
        }
      };
      const finish = async () => {
        const p = handValue(g.player);
        const d = handValue(g.dealer);
        const blackjackPay = Math.floor(g.bet * 1.5); // 3:2, rounded down
        const [payout, text] =
          isBlackjack(g.player) && isBlackjack(g.dealer) ? [g.bet, 'Molemmilla blackjack · tasapeli']
          : isBlackjack(g.player) ? [g.bet + blackjackPay, `🃏 Blackjack! +${blackjackPay} 🪙`]
          : isBlackjack(g.dealer) ? [0, `Jakajalla blackjack · −${g.bet} 🪙`]
          : p > 21 ? [0, `Yli 21 · −${g.bet} 🪙`]
          : d > 21 ? [2 * g.bet, `Jakaja yli 21 · +${g.bet} 🪙`]
          : p > d ? [2 * g.bet, `Voitit · +${g.bet} 🪙`]
          : p < d ? [0, `Jakaja voitti · −${g.bet} 🪙`]
          : [g.bet, 'Tasapeli · panos takaisin'];
        const balance = coins - spend + payout;
        const s = g.session;
        s.hands++;
        s.net += payout - g.bet;
        if (payout > g.bet) s.wins++;
        else if (payout === g.bet) s.pushes++;
        else s.losses++;
        if (payout > 2 * g.bet) s.blackjacks++;
        await store.put(playerId, `${balance} ${day ?? ''}`.trim());
        await store.delete(key);
        await store.put(sessionKey, JSON.stringify(s), { expirationTtl: 86400 });
        const next = [
          {
            type: 1,
            components: [
              { type: 2, style: 1, custom_id: `blackjack:again:${playerId}:${g.base}`, label: `Uusi peli · ${g.base} 🪙` },
              { type: 2, style: 2, custom_id: `blackjack:quit:${playerId}`, label: 'Lopeta' },
            ],
          },
        ];
        if (!frames.at(-1)[0].includes(FLIP)) frames.pop(); // the result comes with the last card, not a step after it
        frames.push([view(hand(g.dealer), hand(g.player), `### ${text}\n${stake(` · saldo ${balance} 🪙`)}`), next]);
        return frames;
      };
      const keep = async () => {
        if (spend) await store.put(playerId, `${coins - spend} ${day ?? ''}`.trim());
        await store.put(key, JSON.stringify(g), { expirationTtl: 86400 });
        return frames;
      };

      if (action === 'quit') {
        if (g) return 'Pelaa käsi loppuun ennen kuin lopetat.';
        const s = JSON.parse((await store.get(sessionKey)) || 'null');
        if (!s) return 'Tämä sessio on jo päättynyt.';
        await store.delete(sessionKey);
        const tally = [count(s.hands, 'käsi', 'kättä'), `${count(s.wins, 'voitto', 'voittoa')}${s.blackjacks ? ` (${count(s.blackjacks, 'blackjack', 'blackjackia')})` : ''}`, count(s.pushes, 'tasapeli', 'tasapeliä'), count(s.losses, 'häviö', 'häviötä')];
        return [[`## 🃏 Blackjack-sessio päättyi\n### ${signed(s.net)}\n-# ${tally.join(' · ')}\n-# saldo ${coins} 🪙`, []]];
      }
      if (action === 'deal' || action === 'again') {
        if (g) return [playing(coins)]; // a hand is already on the table: show it again
        if (!(betArg >= BJ.min && betArg <= BJ.max)) return `Panos on ${BJ.min}–${BJ.max} 🪙.`;
        if (coins < betArg) return `Ei tarpeeksi kolikoita, sulla on **${coins}** 🪙`;
        const deck = shuffledDeck();
        // /blackjack starts a new session, "Uusi peli" continues the one on the table
        const session = (action === 'again' && JSON.parse((await store.get(sessionKey)) || 'null')) || { hands: 0, net: 0, wins: 0, blackjacks: 0, pushes: 0, losses: 0 };
        g = { base: betArg, bet: betArg, deck, player: [], dealer: [], session };
        g.player.push(deck.pop());
        g.dealer.push(deck.pop());
        g.player.push(deck.pop());
        g.dealer.push(deck.pop());
        spend = betArg;
        const [p1, p2] = g.player;
        frames.push(
          [view(hand([], [FLIP, FLIP]), hand([], [FLIP, FLIP]), stake()), off()],
          [view(hand([], [FLIP, FLIP]), hand([p1], [FLIP]), stake()), off()],
          [view(hand([g.dealer[0]], [FLIP]), hand([p1], [FLIP]), stake()), off()],
          [view(hand([g.dealer[0]], [FLIP]), hand([p1, p2]), stake()), off()],
        );
        if (isBlackjack(g.player) || isBlackjack(g.dealer)) return finish();
        frames.push(playing(coins - spend));
        return keep();
      }
      if (!g) return 'Tämä peli on jo päättynyt. Aloita uusi: `/blackjack`';
      if (action === 'double') {
        if (g.player.length !== 2 || coins < g.base) return 'Tuplata voi vain kahdella ensimmäisellä kortilla, ja siihen tarvitaan panoksen verran kolikoita.';
        spend = g.base;
        g.bet = 2 * g.base;
      }
      if (action === 'hit' || action === 'double') {
        frames.push([view(hand([g.dealer[0]], [BACK]), hand(g.player, [FLIP]), stake()), off()]);
        g.player.push(g.deck.pop());
        const p = handValue(g.player);
        if (p > 21) return finish();
        if (action === 'hit' && p < 21) {
          frames.push(playing(coins));
          return keep();
        }
        frames.push([view(hand([g.dealer[0]], [BACK]), hand(g.player), stake()), off()]);
      }
      dealerPlays(); // stand, a double, or 21
      return finish();
    };

    // edits the original message frame by frame, BJ.step apart (the next edit waits for the previous one to land)
    const animate = (later) => {
      if (!later.length) return;
      ctx.waitUntil(
        (async () => {
          let sent;
          for (const [content, components] of later) {
            await Promise.all([scheduler.wait(BJ.step), sent]);
            sent = fetch(`https://discord.com/api/v10/webhooks/${application_id}/${token}/messages/@original`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content, components }),
            });
          }
          await sent;
        })(),
      );
    };

    if (type === 3) {
      // buttons carry the id of the player who cast; older buttons without it belong to whoever clicks
      const [game, action, owner = playerId, bet] = data.custom_id.split(':');
      if (owner !== playerId) return reply('Tämä ei ole sinun saaliisi. Heitä omasi: `/galastus` tai `/verkko`.', 64);
      if (game === 'verkko') {
        const [flags, content] = await raiseNet();
        return flags ? reply(content, flags) : interactionUpdate(content);
      }
      if (game === 'blackjack') {
        const frames = await blackjack(action, +bet);
        if (typeof frames === 'string') return reply(frames, 64);
        const [[content, components], ...later] = frames;
        animate(later);
        return interactionUpdate(content, components);
      }
      if (game === 'guoma') {
        const [flags, content] = await kuomaReport(true);
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
        if (outcome < 0.5) {
          const [coins, day] = await walletOf(store, playerId);
          await store.put(playerId, `${coins + FLY_COST} ${day ?? ''}`.trim());
          return interactionUpdate(`Perho nosti saaliiksi vanhan saappaan, mutta sait perhon takaisin: **+${FLY_COST}** 🪙 🥾`);
        }
        const state = await fishingState(store, playerId);
        const f = catchFish(state.level, 0.5, 3);
        return interactionUpdate(`${hero(f, '🪰 perholla')}\n${await land(store, guild_id, playerId, state, [f])}`);
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
      return interactionUpdate(`${hero(f)}\n${await land(store, guild_id, playerId, state, [f])}`);
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
    if (store && guild_id && ['kukkaro', 'goneisii', 'gruunavaiglaava', 'lainaa', 'galastus', 'perho', 'gatiska', 'guoma', 'verkko', 'blackjack'].includes(data.name)) await mark(playerId, member, member?.user ?? user);

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
      const cost = FLY_COST;
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

    if (data.name === 'blackjack') {
      if (!store) return reply('Blackjack vaatii käytössä olevan kolikkotallennuksen.', 64);
      const frames = await blackjack('deal', o.panos);
      if (typeof frames === 'string') return reply(frames, 64);
      const [[content, components], ...later] = frames;
      animate(later);
      return reply(content, undefined, components);
    }

    if (data.name === 'guoma') {
      if (!store) return reply('Kuoma vaatii käytössä olevan kolikkotallennuksen.', 64);
      const { level } = await fishingState(store, playerId);
      if (level < KUOMA.level) return reply(`🔒 Kuoma lähtee kalaan kanssasi kalastustasolla ${KUOMA.level}, sinulla on LVL ${level}.`, 64);
      if (o.kolikot === undefined) {
        const [flags, content, components] = await kuomaReport();
        return reply(content, flags, components);
      }
      const key = `fishing-kuoma:${playerId}`;
      if (await store.get(key)) return reply('Kuoma on jo kalassa. Katso tilanne tai lunasta saalis: `/guoma`', 64);
      const casts = Math.floor(Math.min(o.kolikot, KUOMA.max) / KUOMA.bait);
      const cost = casts * KUOMA.bait;
      if (casts < 1) return reply(`Anna kuomalle syöttirahaa vähintään ${KUOMA.bait} 🪙.`, 64);
      if (coins < cost) return reply(`Ei tarpeeksi kolikoita, syötit maksavat ${cost} 🪙`, 64);
      await store.put(playerId, `${coins - cost} ${day ?? ''}`.trim());
      await store.put(key, JSON.stringify({ start: Date.now(), casts, done: 0, jail: Math.random() < KUOMA.jail, caught: [], boots: 0, snapped: 0 }));
      return reply(`🧔 Palkkasit kuoman kalaan: ${casts} heittoa, noin ${duration(casts * KUOMA.every)}. Katso tilanne ja lunasta saalis lopuksi: \`/guoma\``);
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
        const hours = Math.floor((end - t.checkedAt) / TRAP.every);
        let fish = 0;
        for (let h = 0; h < hours && fish < TRAP.cap; h++) if (Math.random() < TRAP.chance) fish++;
        const dead = Math.min(fish, Math.max(0, Math.ceil((now - t.checkedAt - TRAP.rot) / TRAP.dies)));
        const otter = fish > dead && Math.random() < 0.1 ? fish - dead : 0; // the otter eats the whole catch
        const got = Array.from({ length: fish - dead - otter }, () => catchFish(state.level, 0.5, TRAP.xp, TRAP.price));
        caught.push(...got);
        // the unfinished hour carries over, unless the trap was full
        t.checkedAt = fish < TRAP.cap ? t.checkedAt + hours * TRAP.every : end;
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
