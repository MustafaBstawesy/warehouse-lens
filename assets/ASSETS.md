# Asset provenance and licensing

All visual assets in this repository are original work created for the
Warehouse Lens demo project. No stock photos, no external image URLs, no
SAP logos or trademarks.

| Asset | Source | How it was made |
|---|---|---|
| `src/mat-1042.svg` | Original illustration (this project) | Hand-authored flat-style vector of a sealed ball bearing, using the project color tokens |
| `src/mat-generic.svg` | Original illustration (this project) | Hand-authored flat-style vector of a warehouse crate with a gear symbol |
| `src/success.svg` | Original illustration (this project) | Hand-authored flat-style success check |
| `images/*.png`, `../mdk/Images/*.png` | Generated from the SVGs above | Rasterized with [sharp](https://www.npmjs.com/package/sharp) via `tools/generate.js` |
| `qr-labels/MAT-*.png`, `qr-labels/MAT-*.svg` | Generated (this project) | Encoded with the [qrcode](https://www.npmjs.com/package/qrcode) npm package; each QR payload is the plain material code (e.g. `MAT-1042`) - no URLs |
| `qr-labels/print-sheet.html` | Generated (this project) | Printable sheet referencing the QR PNGs |

Regenerate everything with:

```bash
cd assets/tools
npm install
npm run generate
```

These original assets are part of this repository and are released under
the same MIT License as the code (see [LICENSE](../LICENSE)).
