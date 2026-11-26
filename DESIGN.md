# DESIGN.md — Orin Winberg Portfolio ("Orin's Desk & Bookshelf")

## 1. Visual Identity & Dual-Front-Door Architecture
Modeled after the tactile stationery craft of `itsdavis.com`, this portfolio offers **two front doors into one paper-and-plum world**:
- **Interactive Mode (`/` — The Storyteller's 3D Desk):** A full-viewport (`100svh`) pixel-sampled Three.js WebGL 2 writing desk bathed in warm sunlight (with a clickable banker's desk lamp that shifts into evening tungsten lighting). Physical objects on the desk and hutch open real portfolio folios, 3D-flippable pinned prints, a ruled scratch-paper drawing pad, and a pull-out drawer containing a personalized keepsake postcard.
- **"Boring" Mode (`/boring` — The Editorial Print Shelf):** An instant, zero-WebGL gallery built from the exact same ink, paper stocks, and typography—featuring a hairline masthead, an asymmetric welcome split, a swipeable shelf of dog-eared illustrated prints resting on a wooden ledge over an adaptive graph-paper wall, and split-pane reading dialogs.
- **Full Bilingual EN (LTR) ↔ HE (RTL) Support:** Every interface label, room folio, 3D prop tooltip, interactive workbench artifact, and postcard dynamically switches between English (`dir="ltr"`) and Hebrew (`dir="rtl"`) with CSS logical properties (`margin-inline`, `padding-inline`, `inset-inline`, `border-inline`).

## 2. Color Architecture (60 / 30 / 10)
- **60% Primary Canvas:**
  - `--paper`: `#fffbf6` (warm archival paper body)
  - `--mast`: `#fffbf8` (masthead paper strip)
  - `--studio-bg`: `#c7bc9e` (3D room backdrop)
  - `--shelf-bg`: `#eee4eb` (24px graph-paper shelf, cross-fading `0.36s ease` per centered print: `#f3e6db`, `#ebeddf`, `#eee2e8`, `#e4ede7`, `#e9e5f0`, `#f3eadc`)
- **30% Secondary Tonal Surfaces:**
  - Room wall tints: Workbench `#e8eada` (sage), Archive `#e8e1d3` (parchment), Notebook `#e9e1ea` (dusty lavender), Letters `#e8e2ed` (pale lilac)
  - Paper stocks: Manila `#f4e7d4`, File Sheet `#fffcf0`, Notebook Cream `#fff8e8`, Folder Tabs `#ead3b2` / `#e2b9ab` / `#c7d2b8` / `#d9c9dd` / `#f1d9a3`, Active Walnut Tab `#76523e`
  - Print stocks: `#fff0c8` (High Voltage), `#e8efd6` (Hello Tech), `#f2dce0` (Miloolita), `#dbede5` (We Have a Dream), `#e9e7ff` (Journalism), `#ffeac1` (Audio Tour & Keynotes)
  - Wood & Felt: Oak `#69452f` / Ledge `#cfb194 → #b58973`, Stitched Sage Blotter `#5b7361`
- **10% Ink & Sharp Accents:**
  - `--ink`: `#422c41` (deep eggplant ink — 12.1:1 contrast on `#fffbf6`, WCAG AAA)
  - `--muted`: `#5c4b59` (muted mauve secondary text — 7.4:1 contrast on `#fffbf6`)
  - `--berry`: `#7d3251` (editorial text links & active accents — 8.1:1 contrast)
  - `--hair`: `#bdabba` / `#cbb9c5` (1px hairline dividers)
  - `--focus`: `#6b3986` (`3px solid` accessible focus outline)

## 3. Typography Pairing
- **Display & UI Controls (EN):** `Bricolage Grotesque` (weights 600–720, tight tracking `-0.03em` to `-0.055em`, tight leading `0.98–1.12`)
- **Display & UI Controls (HE):** `Rubik` + `Frank Ruhl Libre` (crisp geometric display & literary editorial voice with clean Hebrew kerning)
- **Body Prose:** `DM Sans` (EN) / `Heebo` (HE), `17px–18px` base, `1.55–1.65` line-height, `40ch`–`48ch` editorial measure
- **Metadata & Timestamps:** `IBM Plex Mono` (`11px–13px`) for print categories, counts, years, audio timecodes, and postmarks
- **Archival Notes & Reverse Captions:** Italic `Georgia, serif` (EN) / `Frank Ruhl Libre` (HE)

## 4. Surface & Shape Language
- **Paper Sheets:** Crisp `2px–6px` corners, `1px` warm borders (`#9c836b`, `#bdabba`), clipped `11px` dog-ear top-right folds on shelf prints, and layered hard paper-edge shadows (`1px 3px #ccbfaa, 3px 5px #ffefd8, 5px 7px #a18a75`) instead of soft SaaS drop shadows.
- **Folder & Bookmark Tabs:** `8px 8px 0 0` (top tabs) and `2px 9px 2px 2px` (side cabinet dividers, mirrored automatically in RTL).
- **Interactive Controls:** `24px` pill buttons and `50%` circular arrows with `2px` physical press feedback (`translateY(2px)`).

## 5. Layout Rhythm & Mobile Adaptation (`1440px` & `390px`)
- Desktop `1440px`: Edge-to-edge 3D desk with corner HUD; Boring mode shows hero + full 5-print shelf above the fold; split-pane print modal (`28% / 72%`); 2-column file cabinet & open book spread.
- Mobile `390px`: Reframed vertical 3D desk camera with thumb-reachable props; `62vw` swipeable prints; single-column print modal; wrapped horizontal category pills in Project Files; stacked book spread with full-bleed cover banner.
