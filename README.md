# matematiikka-botti

Discord-slash-komento `/roll max [min]` → `🎲 n`, n ∈ ℤ ∩ [min, max], min ≔ 1, min > max ⇒ swap

## CI/CD

- `pull_request` → `node --test`
- `push main` → `node --test` → `wrangler deploy` → `PUT /applications/{id}/commands`

## Käyttö

Developer Portal → Installation → Install Link → palvelin ∨ oma käyttäjä. `/roll max:100`, `/roll max:20 min:5`

## Kontribuutio

Fork → PR → vihreä `node --test` (Node ≥ 22) → merge ⇒ tuotanto
