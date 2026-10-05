## Kontribuutio

Fork → PR → vihreä `node --test` (Node ≥ 22) → merge ⇒ tuotanto

## Kolikoiden pysyvä tallennus

`/goneisii` maksaa 3 (3 samaa 100, 2 samaa 10, 3 kalloa 💀 vie 70 % lopuista kolikoista, `autospin` 1–8 pyöräyttää samassa viestissä) ja `/gruunavaiglaava valinta [panos]` (oletus 1, oikein +panos, väärin −panos), saldo `/kukkaro`, `/leaderboard` näyttää kukkaroiden tilastot, `/lainaa kenelle määrä` siirtää kolikoita toiselle saman palvelimen pelaajalle. Nollasaldolla saa 10 kolikkoa kerran päivässä.

`/goneisii`- ja `/gruunavaiglaava`-komentojen voitot ja häviöt tallennetaan Cloudflare KV:hen käyttäjän Discord-tunnuksella. Ilman `COINS`-sidontaa komento toimii edelleen, mutta saldoa ei tallenneta pysyvästi.

Ylläpitäjä voi ottaa tallennuksen käyttöön näin:

```bash
npx wrangler kv namespace create COINS
```

Lisää komennon tulostama namespace `id` GitHub-repositorion Actions-salaisuuksiin nimellä `COINS_KV_NAMESPACE_ID`. Deploy-workflow käyttää tätä salaisuutta automaattisesti `COINS`-sidonnan luomiseen. Forkilla pitää olla oma Cloudflare KV -namespace ja omat salaisuudet; niitä ei kopioida alkuperäisestä repositoriosta.


`/galastus` maksaa 3 kolikkoa syötistä. Odota, että kala tarttuu, ja paina napista nostaaksesi siiman. Saalis näyttää painon grammoina tai kilogrammoina ja myydään automaattisesti; painavampi kala antaa enemmän kolikoita. Kalalajeilla on eri harvinaisuudet ja hinnat, ja erittäin harvoin voi saada jättimäisen kalan. Siima voi myös katketa tai nostaa saaliiksi vanhan saappaan.

`/verkko toiminto kesto` maksaa 20 kolikkoa. Valitse `heitä` ja aika 1–60 minuuttia, ja nosta verkko myöhemmin joko viestin napista tai valitsemalla `nosta`. Pidempi odotus tuottaa isomman saaliin, enintään 6 kalaa. Kalastustilastot näyttävät myös palvelimen suurimman kalan, saalismäärät ja harvinaisuudet.

Kalastuksesta saa kokemusta ja taso nousee RuneScape-tyylisesti tasolle 99 asti. Kalastuksen tila tallennetaan samaan KV:hen kuin kolikot.
