const hex = (s) => Uint8Array.from(s?.match(/../g) ?? [], (b) => parseInt(b, 16));
const reply = (content, flags) => Response.json({ type: 4, data: { content, flags } });
const fruits = ['🍒', '🍋', '🍉', '🍇', '🍊'];
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
  async fetch(req, env) {
    const body = await req.text();
    const key = await crypto.subtle.importKey('raw', hex(env.DISCORD_PUBLIC_KEY), 'Ed25519', false, ['verify']);
    const msg = new TextEncoder().encode(req.headers.get('x-signature-timestamp') + body);
    const ok = await crypto.subtle.verify('Ed25519', key, hex(req.headers.get('x-signature-ed25519')), msg).catch(() => false);
    if (!ok) return new Response(null, { status: 401 });

    const { type, data, member, user, guild_id } = JSON.parse(body);
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
      return reply(`\`\`\`\n${lines.join('\n')}\n\`\`\``);
    }

    if (store && guild_id && ['kukkaro', 'goneisii', 'gruunavaiglaava'].includes(data.name)) {
      const name = member?.nick ?? (member?.user ?? user)?.global_name ?? (member?.user ?? user)?.username ?? playerId;
      const key = `g:${guild_id}:${playerId}`;
      if ((await store.get(key)) !== name) await store.put(key, name);
    }

    const [coins, day] = store ? await walletOf(store, playerId) : [];
    if (data.name === 'kukkaro') return reply(`Sulla on **${coins ?? 0}** kolikkoa 🪙`);

    if (data.name === 'goneisii' || data.name === 'gruunavaiglaava') {
      const cost = data.name === 'goneisii' ? 3 : (o.panos ?? 1);
      if (store && coins < cost) return reply(`Ei tarpeeksi kolikkoja, tarvitset ${cost} 🪙 Nollasaldolla saat 10 ilmaista kerran päivässä.`, 64);

      let text, net;
      if (data.name === 'goneisii') {
        const reels = Array.from({ length: 3 }, () => fruits[Math.floor(Math.random() * fruits.length)]);
        const matches = new Set(reels).size;
        net = (matches === 1 ? 100 : matches === 2 ? 10 : 0) - cost;
        text = `🎰 ${reels.join(' | ')} 🎰\n${matches === 1 ? 'JACKPOT! 🎉' : matches === 2 ? 'close ✨' : 'ei voittoa'}`;
      } else {
        const side = Math.random() < 0.5 ? 'kruuna' : 'klaava';
        net = side === o.valinta ? cost : -cost;
        text = `🪙 ${side}`;
      }
      if (!store) return reply(text);
      await store.put(playerId, `${coins + net} ${day ?? ''}`.trim());
      return reply(`${text}\n${net < 0 ? '' : '+'}${net} 🪙`);
    }

    const lo = Math.min(o.min ?? 1, o.max);
    const hi = Math.max(o.min ?? 1, o.max);
    return reply(`🎲 ${lo + Math.floor(Math.random() * (hi - lo + 1))}`);
  },
};
