# Golden fixtures

Optional binary samples for device/simulator checks (validation mostly uses inline data URIs in `src/validateSharp.ts`):

- `fixtures/sample.jpg` / `sample.png` / `sample.webp` — optional larger goldens
- `fixtures/sample.avif` — tiny 2×2 AVIF (also embedded as `SAMPLE_AVIF`)
- `fixtures/sample.heic` — tiny HEIC (also embedded as `SAMPLE_HEIC`)

## Prebuild codec expectations

| Input | iOS | Android |
|-------|-----|---------|
| AVIF decode (pixels) | should work (dav1d) | should fail (`libheif: false`) |
| HEIC `metadata()` | may succeed (container only) | should fail |
| HEIC rasterize (`.jpeg().toBuffer()`) | should fail (no libde265) | should fail |

See [`third_party/libvips/README.md`](../../third_party/libvips/README.md) for the full matrix.

Validation suite checks:

1. `metadata()` / resize / JPEG / progressive / WebP magic
2. crop, rotate, blur+sharpen, composite, roundCorners, backgroundBlur, `toFile`
3. AVIF decode (iOS pass / Android expected fail)
4. HEIC decode unsupported (expected fail on both)
