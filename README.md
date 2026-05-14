# HSK Card Generator

Personal web tool and geometry spike for generating 3D-printable HSK learning card plates.

The current implementation can run in a bare Python environment on Windows, and the Docker image installs Pillow plus Noto/DejaVu fonts for cross-platform text rasterization. It includes:

- live plate layout preview for Chinese, Pinyin, English, and target-language cards;
- configurable printer, card size, rows/columns, gap, border, number, and Hanzi guide;
- browser-local project state;
- JSON/CSV import;
- local dictionary enrichment for the bundled HSK1 sample without overwriting locked manual edits;
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
