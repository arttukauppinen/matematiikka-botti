const hex = (s) => Uint8Array.from(s?.match(/../g) ?? [], (b) => parseInt(b, 16));
const reply = (content, flags) => Response.json({ type: 4, data: { content, flags } });
const fruits = ['🍒', '🍋', '🍉', '🍇', '🍊'];
const addCoins = async (store, playerId, amount) => {
  const balance = +(await store.get(playerId) ?? 0) + amount;
  await store.put(playerId, String(balance));
  return balance;
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

    const { type, data } = JSON.parse(body);
    if (type === 1) return Response.json({ type: 1 });

    const o = Object.fromEntries((data.options ?? []).map((x) => [x.name, x.value]));
    if (data.name === 'makelippo') {
      try {
        return reply(`\`${o.laskutoimitus}\` = **${calc(o.laskutoimitus)}** 🤓`);
      } catch {
        return reply(`En osaa laskea tätä: \`${o.laskutoimitus}\` 🤓`, 64);
      }
    }
    if (data.name === 'goneisii') {
      const reels = Array.from({ length: 3 }, () => fruits[Math.floor(Math.random() * fruits.length)]);
      const matches = new Set(reels).size;
      const winnings = matches === 1 ? 100 : matches === 2 ? 10 : 0;
      const result = matches === 1 ? 'JACKPOT! 🎉' : matches === 2 ? 'close ✨' : 'ei voittoa';
      const playerId = data.member?.user?.id ?? data.user?.id;
      if (!env.COINS || !playerId) return reply(`🎰 ${reels.join(' | ')} 🎰\n${result}`);
      const balance = await addCoins(env.COINS, playerId, winnings);
      return reply(`🎰 ${reels.join(' | ')} 🎰\n${result}\n+${winnings} kolikkoa | saldo: **${balance}** 🪙`);
    }
    if (data.name === 'kukkaro') {
      const playerId = data.member?.user?.id ?? data.user?.id;
      const balance = env.COINS && playerId ? +(await env.COINS.get(playerId) ?? 0) : 0;
      return reply(`Sulla on **${balance}** kolikkoa 🪙`);
    }

    const lo = Math.min(o.min ?? 1, o.max);
    const hi = Math.max(o.min ?? 1, o.max);
    return reply(`🎲 ${lo + Math.floor(Math.random() * (hi - lo + 1))}`);
  },
};
