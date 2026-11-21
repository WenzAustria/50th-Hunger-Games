# Panem Archive – 50th Hunger Games (3D game) + Hunger Games info pages

Static site (no build step). Home: `index.html`. Playable game: `50th-hunger-games/`. Info pages: one folder per edition.

## Deploy to GitHub Pages
1. Create a new public repo on github.com (e.g. `panem-archive`).
2. Upload ALL files and folders of this project (keep `.nojekyll`), commit to `main`.
3. Settings → Pages → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)` → Save.
4. Wait ~1 minute: `https://<username>.github.io/panem-archive/`

## Test locally
Textures need http, not file://. In this folder run `python -m http.server 8000` and open http://localhost:8000

## Victor photos
Put images in `assets/victors/` named: lucy-gray, mags, beetee, brutus, wiress, enobaria, gloss, cashmere, finnick, annie, johanna, katniss-peeta (.jpg). They load automatically; without them the district emblem shows.
