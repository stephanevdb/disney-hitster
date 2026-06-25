# Disney Hitster

A custom Disney-themed expansion for the [Hitster](https://hitstergame.com/) board game. Import songs from a Spotify playlist, print scannable cards, and play them with a spoiler-free web scanner.

**The official Hitster app does not work with custom cards.** This project provides its own scanner and player.

## What's included

- **Card generator** — imports your Spotify playlist and creates a print-ready duplex PDF
- **Web scanner (PWA)** — scan a card QR code and play the song without showing title, artist, or year on screen
- **~100 Disney songs** from [this playlist](https://open.spotify.com/playlist/0J4kExmMxPfVhbqVq1xTph)

## Quick start

```bash
npm install
cd web && npm install && cd ..

# 1. Import approved spreadsheet (recommended)
npm run import-xlsx

# Or import from Spotify playlist
npm run import

# 2. Resolve YouTube playback IDs (optional — run again for missing tracks)
npm run resolve-youtube

# 3. Generate VerteLith print PDFs + screen preview
npm run generate-cards

# 4. Start the scanner app
npm run dev
```

Open `http://localhost:5173` on your phone (same Wi‑Fi) or deploy to Vercel for HTTPS camera access.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run import-xlsx` | Import `data/playlist_with_datesFemkeApproved.xlsx` → `data/songs.json` |
| `npm run import` | Fetch tracks from Spotify playlist → `data/songs.json` |
| `npm run resolve-youtube` | Auto-search YouTube IDs for each song |
| `npm run generate-cards` | Create VerteLith A1 PDFs + screen preview in `output/` |
| `npm run sync-songs` | Copy `data/songs.json` into the web app |
| `npm run dev` | Run the scanner locally |
| `npm run build` | Build the web app for production |

### Import options

```bash
npm run import -- --playlist "https://open.spotify.com/playlist/..."
npm run import -- --base-url "https://your-app.vercel.app"
```

Optional Spotify API credentials (faster, more reliable years):

```bash
export SPOTIFY_CLIENT_ID=...
export SPOTIFY_CLIENT_SECRET=...
npm run import
```

### Generate cards with production URL

After deploying, regenerate cards so QR codes point to your live app:

```bash
BASE_URL=https://your-app.vercel.app npm run generate-cards
```

## Printing cards

### Output files

| File | Purpose |
|------|---------|
| `output/disney-hitster-fronts-a1.pdf` | **Print first** — QR scan side (CMYK + spot layers) |
| `output/disney-hitster-backs-a1.pdf` | **Print second** — info side (artist, year, song, movie) |
| `output/disney-hitster-white-fronts-a1.pdf` | Spot_White plate — scan side |
| `output/disney-hitster-white-backs-a1.pdf` | Spot_White plate — info side |
| `output/disney-hitster-thrucut-fronts-a1.pdf` | **Summa cut** — front sheet (`Thru-cut` + `Regmark`) |
| `output/disney-hitster-thrucut-backs-a1.pdf` | **Summa cut** — back sheet (mirrored grid for short-edge flip) |
| `output/disney-hitster-preview.pdf` | Screen proof only (not for UV print) |
| `output/disney-hitster-fronts-flat-a1.pdf` | **Optional** — flat CMYK only (no white/varnish/cut spots) |
| `output/disney-hitster-backs-flat-a1.pdf` | **Optional** — flat CMYK only (no white/varnish/cut spots) |

Each production PDF includes VerteLith spot colors:

- **`Spot_White`** — white underprint (full card + QR island on scan side)
- **`Spot_Varnish`** — gloss on neon rings (scan side only; QR excluded)
- **`CutContour`** — trim path at 50×50 mm

The **flat** variants (`*-flat-a1.pdf`) use the same layout and CMYK artwork but omit all spot separations — useful for standard CMYK printers or quick proofs.

Cards have **1 mm bleed**, **crop marks**, and **5 mm solid registration circles** on the sheet perimeter (corners plus every 30 cm along the outside edges).

### Summa flatbed (GoSign / GoProduce)

1. Print `disney-hitster-fronts-a1.pdf` and `disney-hitster-backs-a1.pdf` as usual (UV or other RIP).
2. Import `disney-hitster-thrucut-fronts-a1.pdf` after printing fronts, and `disney-hitster-thrucut-backs-a1.pdf` after printing backs (each cut job matches its print side).
3. In GoSign/GoProduce, set PDF import to **separate layers** (Acrobat OCG layers, not spot colors).
4. Map layers by name:
   - **`Thru-cut`** → through-cut / FlexCut (50×50 mm card trim)
   - **`Regmark`** → registration / OPOS alignment (5 mm solid circles at corners and every 30 cm on the outside edges)
5. Align using the corner circles; run a test cut before the full sheet.

The cut PDF uses Acrobat layers named `Thru-cut` and `Regmark` (visible in Adobe Reader’s Layers panel). Mutoh print PDFs still include embedded `CutContour` for VerteLith.

### Mutoh + VerteLith (UV on cardstock)

1. Import `disney-hitster-fronts-a1.pdf` into VerteLith at **100% scale** on **A1**.
2. In **Printer Profile**:
   - **White Generation → Spot Color**
   - **Varnish Generation → Spot Color**
3. Use **300–350 gsm** UV-compatible cardstock.
4. Print order: **White → CMYK → Varnish** (confirm for your profile).
5. **RIP preview** — check white covers scan cards; varnish avoids QR area.
6. Cure fully, then flip sheet on **short edge** and print `disney-hitster-backs-a1.pdf`.
7. Align using corner registration crosses; run an alignment test before the full sheet.
8. **Scan-test** 3–5 QR codes after cure.

Spot color reference: [Mutoh VerteLith spot colors](https://www.thinkmutoh.com/vertelith-knowledge-base/how-to-use-spot-colors/)

### General print settings

1. Print on **A1** at **100% / actual size** (not “fit to page”)
2. Cut along trim lines / `CutContour` at **50 × 50 mm**
3. QR codes use **error correction H** and **2 mm quiet zone**

Each card has:
- **Front (scan side):** black Hitster-style card with neon ring arcs and centered QR code
- **Back (info side):** artist (top), large year (center), bold song title, movie name

## How to play

Use your existing Hitster board, tokens, and timeline. Follow the [official Hitster rules](https://hitstergame.com/en-us/how-to-play-v3/), but scan cards with **Disney Hitster** instead of the official app:

1. Give each player one starting card face up (oldest year starts)
2. On each turn, scan the top deck card with the Disney Hitster app
3. Listen and place the card in chronological order on your timeline
4. First to 10 cards wins (or use your preferred house rules)

### Scanner tips

- Add the site to your home screen for quick access (PWA)
- Use **3s countdown** mode to mirror the official Spotify Free experience
- The DJ should avoid smartwatches that might show song info

## Deploy to Vercel

```bash
cd web
npx vercel
```

Set the project root to `web/`. After deploy:

```bash
BASE_URL=https://your-app.vercel.app npm run generate-cards
```

Re-print cards if the base URL changed.

## Reviewing song data

Edit `data/songs.json` to fix:

- **`year`** — release year used on card backs and for Expert rules
- **`movie`** — film/show name printed on the card back
- **`youtubeId`** — YouTube video used for playback (verify soundtrack versions)

Then run:

```bash
npm run sync-songs
npm run generate-cards
```

## Project structure

```
disney-hitster/
├── data/songs.json           # Song catalog
├── scripts/
│   ├── generate-cards.ts     # Orchestrates VerteLith + preview output
│   ├── vertelith-pdf.ts      # Mutoh PDF with Spot_White / Spot_Varnish / CutContour
│   ├── summa-cut-pdf.ts      # Summa Thru-cut + Regmark cut-only PDF
│   ├── sheet-regmarks.ts     # 5 mm corner registration crosses
│   ├── card-layout.ts        # A1 grid, bleed, registration
│   └── card-colors.ts        # CMYK palette for UV
├── output/                   # Generated PDF (gitignored)
└── web/                      # React scanner app
```

## License

For personal use. Disney song copyrights belong to their respective owners. This project is not affiliated with Disney or Jumbo Games.
