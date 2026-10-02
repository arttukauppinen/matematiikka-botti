const hex = (s) => Uint8Array.from(s?.match(/../g) ?? [], (b) => parseInt(b, 16));
const reply = (content, flags) => Response.json({ type: 4, data: { content, flags } });
const fruits = ['🍒', '🍋', '🍉', '🍇', '🍊', '💀'];
const SPIN = '<a:slot_spin:1555491281000472646>';
const WIN = '<a:jackpot:1555491279385792593>';
const LOSE = WIN; // ponytail: same gif as jackpot until a shitpot gif is uploaded
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

    const mark = async (id, m, u) => {
      const name = m?.nick ?? u?.global_name ?? u?.username ?? id;
      const key = `g:${guild_id}:${id}`;
      if ((await store.get(key)) !== name) await store.put(key, name);
    };
    if (store && guild_id && ['kukkaro', 'goneisii', 'gruunavaiglaava', 'lainaa'].includes(data.name)) await mark(playerId, member, member?.user ?? user);

    const [coins, day] = store ? await walletOf(store, playerId) : [];
    if (data.name === 'kukkaro') return reply(`Sulla on **${coins ?? 0}** kolikkoa 🪙`);

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

      let text, net, reels;
      if (data.name === 'goneisii') {
        reels = Array.from({ length: 3 }, () => fruits[Math.floor(Math.random() * fruits.length)]);
        const matches = new Set(reels).size;
        const shit = matches === 1 && reels[0] === '💀';
        net = shit ? -cost - Math.ceil((coins - cost) * 0.7) : (matches === 1 ? 100 : matches === 2 ? 10 : 0) - cost;
        const verdict = shit ? `# ${LOSE} SHITPOT! ${LOSE}` : matches === 1 ? `# ${WIN} JACKPOT! ${WIN}` : matches === 2 ? 'close ✨' : 'ei voittoa';
        text = `🎰 ${reels.join(' | ')} 🎰\n${verdict}`;
      } else {
        const side = Math.random() < 0.5 ? 'kruuna' : 'klaava';
        net = side === o.valinta ? cost : -cost;
        text = `🪙 ${side}`;
      }
      if (store) await store.put(playerId, `${coins + net} ${day ?? ''}`.trim());
      const out = store ? `${text}\n${net < 0 ? '' : '+'}${net} 🪙` : text;
      if (!reels) return reply(out);

      const frame = (n) => `🎰 ${reels.map((r, i) => (i < n ? r : SPIN)).join(' | ')} 🎰`;
      ctx.waitUntil(
        (async () => {
          for (const content of [frame(1), frame(2), out]) {
            await scheduler.wait(1000);
            await fetch(`https://discord.com/api/v10/webhooks/${application_id}/${token}/messages/@original`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content }),
            });
          }
        })(),
      );
      return reply(frame(0));
    }

    const lo = Math.min(o.min ?? 1, o.max);
    const hi = Math.max(o.min ?? 1, o.max);
    return reply(`🎲 ${lo + Math.floor(Math.random() * (hi - lo + 1))}`);
  },
};
