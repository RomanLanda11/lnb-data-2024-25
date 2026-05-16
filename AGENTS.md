# Repository Guidelines

## Project Structure & Module Organization

This repository publishes a static GitHub Pages site for the LNB 2024/25 thesis dataset.

- `index.html`: main page and semantic structure.
- `assets/app.css`: public styling for the site.
- `assets/app.js`: browser logic for CSV parsing, filtering, pagination, and game search.
- `public_data/df_players.csv`: consolidated player dataset.
- `public_data/*.parquet`: downloadable game files.
- `public_data/manifest.json`: static file list consumed by the game explorer.
- `style/`: private brand source assets; ignored by Git and not required by the public site.

There is no package manager, build step, or test directory at present.

## Build, Test, and Development Commands

Run a local static server from the repository root:

```powershell
python -m http.server 8123 --bind 127.0.0.1
```

Open `http://127.0.0.1:8123/` and verify that `df_players.csv`, `manifest.json`, CSS, and JS load through HTTP.

Validate JavaScript syntax:

```powershell
node --check assets/app.js
```

Validate the game manifest count:

```powershell
Get-Content public_data\manifest.json | ConvertFrom-Json | Select-Object -ExpandProperty files | Measure-Object
```

## Coding Style & Naming Conventions

Use plain HTML, CSS, and vanilla JavaScript. Keep indentation at two spaces in HTML/CSS/JS. Prefer descriptive camelCase names in JavaScript, kebab-case CSS class names, and Spanish UI copy consistent with the site.

Do not introduce a frontend framework or build tooling unless the deployment plan changes. Keep public assets in `assets/`; do not reference ignored files under `style/`.

## Testing Guidelines

There is no automated test suite. Before committing UI changes, manually verify:

- The page loads from a local HTTP server, not only from disk.
- Player filters, column selection, sorting, and pagination work.
- Game search filters by team, month, and free text.
- Mobile and desktop layouts do not overlap.
- No mojibake appears in Spanish text.

## Commit & Pull Request Guidelines

Recent commits use short Spanish summaries, for example `boton de descarga` and `habilitar scrol`. Keep commit messages concise and action-oriented.

For pull requests, include a short description, list changed data or UI behavior, and add screenshots for visual changes. Mention any updates to `public_data/manifest.json` when parquet files are added, removed, or renamed.

## Data & Privacy Notes

The `public_data/` files are intended for publication. The `style/` directory contains private brand materials and must remain ignored. Avoid committing private logos, drafts, credentials, or local export artifacts.
