## Kontribuutio

Fork → PR → vihreä `node --test` (Node ≥ 22) → merge ⇒ tuotanto

## Kolikoiden pysyvä tallennus

`/goneisii` maksaa 3 (3 samaa 100, 2 samaa 10, 3 kalloa 💀 vie 70 % lopuista kolikoista, `autospin` 1–8 pyöräyttää samassa viestissä) ja `/gruunavaiglaava valinta [panos]` (oletus 1, oikein +panos, väärin −panos), saldo `/kukkaro`, `/leaderboard` näyttää kukkaroiden tilastot, `/lainaa kenelle määrä` siirtää kolikoita toiselle saman palvelimen pelaajalle. Nollasaldolla saa 10 kolikkoa kerran päivässä.

`/blackjack panos` (1–500) pelataan yhdessä viestissä napeilla: **Ota kortti**, **Jää** ja kahdella ensimmäisellä kortilla **Tuplaa**. Jakaja ottaa kortteja, kunnes sillä on vähintään 17. Blackjack maksaa 3:2 (pyöristettynä alaspäin), voitto 1:1 ja tasapeli palauttaa panoksen. Vain pelaaja voi painaa oman pelinsä nappeja. `/blackjack` aloittaa session, ja päättyneen käden **Uusi peli** -nappi jakaa uuden käden samaan viestiin samalla panoksella; session tulos ja käsien määrä näkyvät viestissä. **Lopeta** muuttaa viestin session raportiksi (tulos, voitot, tasapelit ja häviöt). Kesken jäänyt käsi näkyy uudelleen `/blackjack`-komennolla, ja se vanhenee vuorokaudessa.

`/goneisii`- ja `/gruunavaiglaava`-komentojen voitot ja häviöt tallennetaan Cloudflare KV:hen käyttäjän Discord-tunnuksella. Ilman `COINS`-sidontaa komento toimii edelleen, mutta saldoa ei tallenneta pysyvästi.

Ylläpitäjä voi ottaa tallennuksen käyttöön näin:

```bash
npx wrangler kv namespace create COINS
```

Lisää komennon tulostama namespace `id` GitHub-repositorion Actions-salaisuuksiin nimellä `COINS_KV_NAMESPACE_ID`. Deploy-workflow käyttää tätä salaisuutta automaattisesti `COINS`-sidonnan luomiseen. Forkilla pitää olla oma Cloudflare KV -namespace ja omat salaisuudet; niitä ei kopioida alkuperäisestä repositoriosta.

## Ruletti

`/ruletti` avaa eurooppalaisen ruletin pöydän (yksi nolla). Valitse pelimerkki (1, 5, 25 tai 100) **Pelimerkki**-napista ja aseta panokset: numerot 0–36 kahdesta valikosta (monta numeroa kerralla) sekä napeista punainen, musta, parillinen, pariton, 1–18, 19–36, tusinat 1–12, 13–24 ja 25–36 ja rivit (pöydän kuvan ylä-, keski- ja alarivi). Numero maksaa 35:1, tusina ja rivi 2:1 ja muut 1:1; nollalla kaikki ulkopanokset häviävät. Panoksia voi olla yhteensä enintään 500 kolikkoa kierroksessa, ja ne veloitetaan vasta pyöräytettäessä. Pöydän kuvassa pelimerkit näkyvät panosten kohdalla. **Pyöräytä** näyttää pyörän pyörivän, kunnes kuula pysähtyy voittonumeroon, ja sen jälkeen tuloksen. **Pyöräytä uudestaan** pelaa samat panokset uudelleen ja **Muuta panoksia** palaa pöytään. Vain pelaaja voi painaa oman pöytänsä nappeja.

Kuvat tekee `tools/ruletti.py` (Python ja Pillow): jokaiselle numerolle GIF pyörästä, joka pysähtyy siihen, sekä pöytä ja pelimerkit, joista Worker piirtää pöydän kuvan osoitteeseen `/poyta.png`. Deploy-workflow ajaa skriptin ja julkaisee kuvat Workerin staattisina tiedostoina (`ASSETS`-sidonta). Ilman kuvia ruletti toimii pelkällä tekstillä. Paikallisesti kuvat syntyvät näin:

```bash
pip install pillow==12.3.0
python tools/ruletti.py public
```

## Kalastus

`/galastus` maksaa 3 kolikkoa syötistä. Kala tarttuu satunnaisesti 2–20 sekunnin kuluttua. Kala pysyy koukussa vuorokauden, kunnes nostat sen napista, joten nettikatkos ei vie saalista. Uuden syötin voi heittää, kun kala on tarttunut, mutta silloin nostamatta jäänyt kala menetetään. Vain heittäjä voi nostaa oman saaliinsa. Saalis näyttää painon grammoina tai kilogrammoina ja myydään automaattisesti; painavampi kala antaa enemmän kolikoita. Kalalajeilla on eri harvinaisuudet ja hinnat, ja erittäin harvoin voi saada jättimäisen kalan. Siima voi myös katketa tai nostaa saaliiksi vanhan saappaan.

`/perho` avautuu kalastustasolla 10 ja maksaa 8 kolikkoa. Kala iskee 2–25 sekunnin kuluttua ja pysyy kiinni vuorokauden, kunnes nostat sen. Puolet nostoista on tyhjiä: perho katkeaa (25 %) tai saaliina on saapas (25 %), jolloin saat perhon eli 8 kolikkoa takaisin, mutta harvinaisempia ja isompia kaloja tulee useammin kuin ongella, ja kaloista saa kolminkertaisen kokemuksen. Perho, onki ja verkko voivat olla vedessä yhtä aikaa.

`/verkko toiminto kesto` maksaa 20 kolikkoa. Valitse `heitä` ja aika 1–60 minuuttia (oletus 10), ja nosta verkko ajan kuluttua joko viestin napista tai valitsemalla `nosta`. Verkossa on 2 kalaa ja yksi lisää jokaista valittua 15 minuuttia kohden (vajaa 15 minuuttia antaa mahdollisuuden yhteen lisäkalaan), eli 60 minuutilla 6 kalaa.

`/gatiska [toiminto]` avautuu kalastustasolla 20. `osta` laskee veteen uuden katiskan 300 kolikolla (enintään 5 kerrallaan), ja `katso` (oletus) kokee kaikki katiskat kerralla. Jokaisen täyden tunnin aikana katiskaan ui kala 50 %:n todennäköisyydellä, eli mitä pidempään odotat, sitä enemmän saalista todennäköisesti on, enintään 6 kalaa. Jos katiskaa ei koe 12 tuntiin, kaloja alkaa kuolla (yksi lisää 3 tunnin välein). Joka kokemisella saukko voi 10 %:n todennäköisyydellä syödä katiskan koko saaliin. Katiskaan tulee perhon tapaan harvinaisempia ja isompia kaloja kuin ongella, ja kaloista saa kaksinkertaisen kokemuksen, mutta ne myydään puoleen hintaan: katiska on kokemusta varten, rahat tienataan kasinolla. Viikon jälkeen katiska ruostuu puhki, ja sen viimeiset kalat saa vielä seuraavalla kokemisella.

`/guoma kolikot:N` avautuu kalastustasolla 30. Kuoma on ilmainen: annat vain syöttirahat N (3–300), ja kuoma heittää onkea kerran minuutissa 3 kolikon syötillä, kunnes rahat loppuvat (300 kolikkoa = 100 heittoa, noin 1 h 40 min). Kuoma on ongella hieman sinua taitavampi, joten harvinaisia ja isoja kaloja tulee vähän useammin. Sinä saat kokemuksen samoin kuin ongella, mutta kuoma myy kalat ja pitää rahat. `/guoma` ilman kolikoita näyttää kesken kalastuksen tilanteen ja ajan valmistumiseen; kun kaikki heitot on tehty, se antaa saaliin ja kokemuksen. Kuoma joutuu 10 %:n todennäköisyydellä putkaan, ja silloin saaliin saa vasta 500 kolikon takuilla.

Kalastuksesta saa kokemusta ja taso nousee RuneScape-tyylisesti tasolle 99 asti. Kalastuksen tila tallennetaan samaan KV:hen kuin kolikot.

`/kalastustaso` näyttää nykyisen kalastustason, kokemuksen, seuraavan tason XP-rajan ja kalojen avautumistasot. Kalat avautuvat tasoilla 1, 10, 25, 40, 60 ja 80; harvinaisemmat kalat antavat enemmän kokemusta. `/leaderboard` näyttää kolikoiden lisäksi palvelimen kalastajat suurimman kalan mukaan, saalismäärät ja harvinaisuudet.
