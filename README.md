# Tasted

Your food passport: a small iPhone web app that tracks which countries you've eaten food from.
Add it to your Home Screen from Safari and it works like an app, fully offline.

Plain HTML, CSS and JavaScript. No build step, no backend, no accounts. Your data stays on your phone.

## Files

| File | What it is |
| --- | --- |
| `js/countries.js` | **The 195 countries**, with continent and sub-region. Edit this to change the list. |
| `index.html` | Layout of the four screens and the tab bar. |
| `css/app.css` | All styling. Colours are at the top (`--flame`, `--sand`, ...). |
| `js/app.js` | Screens, navigation, buttons, backup/restore. |
| `js/dotmap.js` | Turns the world map into the dotted grid. |
| `js/store.js` | Saves your data on the phone (localStorage). |
| `sw.js` | Service worker: caches everything for offline use. |
| `manifest.webmanifest` | Home Screen name, icon and colours. |
| `fonts/` | Bricolage Grotesque and DM Mono (SIL Open Font License), bundled for offline use. |
| `vendor/` | D3 v7.9.0 and topojson-client v3.1.0. |
| `data/countries-50m.json` | Natural Earth 1:50m countries from world-atlas v2.0.2 (public domain). |
| `icons/` | App icons. |

## Making a change

1. Edit the file(s).
2. Open `sw.js` and bump `VERSION` (e.g. `"v1"` → `"v2"`) so phones download the new files.
3. Commit and push to GitHub. GitHub Pages redeploys in a minute or two.
4. Open the app on your phone. It picks up the new version and reloads itself.

## Running it on your computer

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
