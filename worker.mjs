const hex = (s) => Uint8Array.from(s?.match(/../g) ?? [], (b) => parseInt(b, 16));

export default {
  async fetch(req, env) {
    const body = await req.text();
    const key = await crypto.subtle.importKey('raw', hex(env.DISCORD_PUBLIC_KEY), 'Ed25519', false, ['verify']);
    const msg = new TextEncoder().encode(req.headers.get('x-signature-timestamp') + body);
    const ok = await crypto.subtle.verify('Ed25519', key, hex(req.headers.get('x-signature-ed25519')), msg).catch(() => false);
    if (!ok) return new Response(null, { status: 401 });

    const { type, data } = JSON.parse(body);
    if (type === 1) return Response.json({ type: 1 });

    const o = Object.fromEntries(data.options.map((x) => [x.name, x.value]));
    const lo = Math.min(o.min ?? 1, o.max);
    const hi = Math.max(o.min ?? 1, o.max);
    return Response.json({ type: 4, data: { content: `🎲 ${lo + Math.floor(Math.random() * (hi - lo + 1))}` } });
  },
};
