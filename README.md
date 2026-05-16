# HSK Card Generator

Personal web tool and geometry spike for generating 3D-printable HSK learning card plates.

The current implementation can run in a bare Python environment on Windows, and the Docker image installs Pillow plus Noto/DejaVu fonts for cross-platform text rasterization. It includes:

- live plate layout preview for Chinese, Pinyin, English, and target-language cards;
- configurable printer, card size, rows/columns, gap, border, number, and Hanzi guide;
- browser-local project state;
- JSON/CSV import;
- editable HSK set corrections saved in browser local storage, with JSON import/export for moving corrections between machines;
- local dictionary enrichment for the bundled HSK1 sample without overwriting locked manual edits;
- playable-core domino mode with compact decks, doubles as branch points, sequential bridge tiles, configurable language order, answer sheets, and generated game rules;
- click-to-open card inspector with enlarged preview, base thickness, total model height, fitted font size, and back-number dimensions;
- printable game-plan exports for matching, memory, pair cards, domino, modular expansion, and mixed challenge modes, with deterministic simulator output;
- exported print profile recommendations for Bambu A1 mini quality/material-saver settings;
- ZIP export with STL role files, three 3MF compatibility variants, README mapping, and source JSON.

## Run

```powershell
python server.py
```

Then open:

```text
http://127.0.0.1:8000
```

You can override the bind address and port:

```powershell
$env:HOST = "0.0.0.0"
$env:PORT = "8000"
python server.py
```

## Docker

Build and run with Docker:

```powershell
docker build -t hsk-card-generator .
docker run --rm -p 8000:8000 -v ${PWD}/exports:/app/exports hsk-card-generator
```

Or use Docker Compose:

```powershell
docker compose up --build
```

Then open:

```text
http://127.0.0.1:8000
```

Exports are written to `exports/` and are mounted out of the container by the compose file.

## HSK Set Edits

Built-in HSK sets can be edited directly in the table. Use:

- `Save edits` to save changed translations/pinyin for the selected HSK set in browser local storage.
- `Load original` to reload the clean bundled HSK set without applying saved edits.
- `Export edits` to download the saved corrections JSON.
- `Import edits` to load a corrections JSON back into the browser.
- `Clear edits` to remove saved corrections for the selected HSK set.

These corrections are separate from project state and are applied automatically when the matching HSK set is loaded.

## Domino Mode

Switch `Game Engine -> Mode` to `Domino playable core` to generate physical domino tiles instead of separate language plates. The first implementation supports:

- compact decks: one double per word plus sequential bridge tiles;
- complete-cycle and target-count generation options stored in presets;
- doubles marked as branch points;
- two mirrored debossed back IDs per tile;
- configurable role colors for 3MF export;
- `source/tile-plan.json`, `answer_sheets/domino.*`, and `rules/<language>/*.md` in the export ZIP.

Other game modes now export `source/game-plan.json`, mode-specific answer sheets, rules, and simulator state. Pair, modular expansion, and mixed challenge modes use tile geometry; matching and memory reuse flashcard plates with game-specific rules and answer sheets.

## Print Notes

`Thickness` controls the base body thickness. Bambu Studio may report a taller object because raised text, borders, Hanzi guides, double markers, and optional physical plate labels sit above the base. The export README and manifest include both `baseThicknessMm` and `totalModelHeightMm`.

Every export includes `print_profiles/bambu_a1_mini_quality.md`, `print_profiles/bambu_a1_mini_material_saver.md`, and `print_profiles/profile-summary.json`. The 3MF files include standard metadata with the dataset, range, game mode, recommended nozzle, and layer height. Bambu-specific automatic project-profile import remains experimental until tested in Bambu Studio.

## Test

```powershell
python -m unittest discover -s tests
```

For Linux/macOS or non-Windows local runs, install the optional text raster dependency first:

```powershell
pip install -r requirements.txt
```

Run tests in Docker:

```powershell
docker build -t hsk-card-generator .
docker run --rm hsk-card-generator python -m unittest discover -s tests
```

## Git

The local repository is configured with:

```text
origin = git@github.com:maksimsarychau/hsk_card_generator.git
branch = main
```

After the first commit, push with:

```powershell
git push -u origin main
```

## Notes

This is the first geometry spike. It already verifies the critical layout, role separation, Hanzi guide, 3MF structure, STL packaging, and mirrored back-number geometry. Front text is represented in STL/3MF by separate sizing proxy geometry while the readable text is preserved in the web preview, README, and source JSON. A later font-tooling milestone should replace text proxies with real glyph outlines from bundled Noto fonts.
