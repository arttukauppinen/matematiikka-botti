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

## Kalastus

`/galastus` maksaa 3 kolikkoa syötistä. Kala tarttuu satunnaisesti 2–20 sekunnin kuluttua. Kala pysyy koukussa vuorokauden, kunnes nostat sen napista, joten nettikatkos ei vie saalista. Uuden syötin voi heittää, kun kala on tarttunut, mutta silloin nostamatta jäänyt kala menetetään. Vain heittäjä voi nostaa oman saaliinsa. Saalis näyttää painon grammoina tai kilogrammoina ja myydään automaattisesti; painavampi kala antaa enemmän kolikoita. Kalalajeilla on eri harvinaisuudet ja hinnat, ja erittäin harvoin voi saada jättimäisen kalan. Siima voi myös katketa tai nostaa saaliiksi vanhan saappaan.

`/perho` avautuu kalastustasolla 10 ja maksaa 8 kolikkoa. Kala iskee 2–25 sekunnin kuluttua ja pysyy kiinni vuorokauden, kunnes nostat sen. Puolet nostoista on tyhjiä: perho katkeaa (25 %) tai saaliina on saapas (25 %), jolloin saat perhon eli 8 kolikkoa takaisin, mutta harvinaisempia ja isompia kaloja tulee useammin kuin ongella, ja kaloista saa kolminkertaisen kokemuksen. Perho, onki ja verkko voivat olla vedessä yhtä aikaa.

`/verkko toiminto kesto` maksaa 20 kolikkoa. Valitse `heitä` ja aika 1–60 minuuttia (oletus 10), ja nosta verkko ajan kuluttua joko viestin napista tai valitsemalla `nosta`. Verkossa on 2 kalaa ja yksi lisää jokaista valittua 15 minuuttia kohden (vajaa 15 minuuttia antaa mahdollisuuden yhteen lisäkalaan), eli 60 minuutilla 6 kalaa.

`/gatiska [toiminto]` avautuu kalastustasolla 20. `osta` laskee veteen uuden katiskan 300 kolikolla (enintään 5 kerrallaan), ja `katso` (oletus) kokee kaikki katiskat kerralla. Katiska saa kalan tunnin välein ja on täynnä 6 tunnissa (6 kalaa). Jos katiskaa ei koe 24 tuntiin, kaloja alkaa kuolla (yksi lisää 6 tunnin välein). Joka kokemisella saukko voi 10 %:n todennäköisyydellä syödä katiskan koko saaliin. Katiskaan tulee perhon tapaan harvinaisempia ja isompia kaloja kuin ongella, ja kaloista saa kaksinkertaisen kokemuksen. Viikon jälkeen katiska ruostuu puhki, ja sen viimeiset kalat saa vielä seuraavalla kokemisella.

`/guoma kolikot:N` avautuu kalastustasolla 30 ja palkkaa kuoman kalastamaan puolestasi. Palkkio on 100 kolikkoa, ja lisäksi annat syöttirahat N (3–300): kuoma heittää onkea kerran minuutissa 3 kolikon syötillä, kunnes rahat loppuvat (300 kolikkoa = 100 heittoa, noin 1 h 40 min). Kuoma on ongella hieman sinua taitavampi, joten harvinaisia ja isoja kaloja tulee vähän useammin; kokemus on sama kuin ongella, ja katkennut siima maksaa vain syötin. `/guoma` ilman kolikoita näyttää kesken kalastuksen tilanteen ja ajan valmistumiseen; kun kaikki heitot on tehty, se maksaa saaliin, kokemuksen ja kolikot. Kuoma joutuu 10 %:n todennäköisyydellä putkaan, ja silloin saaliin saa vasta 500 kolikon takuilla.

Kalastuksesta saa kokemusta ja taso nousee RuneScape-tyylisesti tasolle 99 asti. Kalastuksen tila tallennetaan samaan KV:hen kuin kolikot.

`/kalastustaso` näyttää nykyisen kalastustason, kokemuksen, seuraavan tason XP-rajan ja kalojen avautumistasot. Kalat avautuvat tasoilla 1, 10, 25, 40, 60 ja 80; harvinaisemmat kalat antavat enemmän kokemusta. `/leaderboard` näyttää kolikoiden lisäksi palvelimen kalastajat suurimman kalan mukaan, saalismäärät ja harvinaisuudet.
