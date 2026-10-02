## Kontribuutio

Fork → PR → vihreä `node --test` (Node ≥ 22) → merge ⇒ tuotanto

## Kolikoiden pysyvä tallennus

`/goneisii` maksaa 3 (3 samaa 100, 2 samaa 10) ja `/gruunavaiglaava valinta [panos]` (oletus 1, oikein +panos, väärin −panos), saldo `/kukkaro`,`/leaderboard` näyttää kukkaroiden tilastot. Nollasaldolla saa 10 kolikkoa kerran päivässä.

`/goneisii`- ja `/gruunavaiglaava`-komentojen voitot ja häviöt tallennetaan Cloudflare KV:hen käyttäjän Discord-tunnuksella. Ilman `COINS`-sidontaa komento toimii edelleen, mutta saldoa ei tallenneta pysyvästi.

Ylläpitäjä voi ottaa tallennuksen käyttöön näin:

```bash
npx wrangler kv namespace create COINS
```

Lisää komennon tulostama namespace `id` GitHub-repositorion Actions-salaisuuksiin nimellä `COINS_KV_NAMESPACE_ID`. Deploy-workflow käyttää tätä salaisuutta automaattisesti `COINS`-sidonnan luomiseen. Forkilla pitää olla oma Cloudflare KV -namespace ja omat salaisuudet; niitä ei kopioida alkuperäisestä repositoriosta.
