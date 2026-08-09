# libvips mobile prebuilds

`react-native-sharp` links against **libvips** (same engine as Node [`sharp`](https://sharp.pixelplumbing.com/)).

## Pinned sources

See [`VERSION.json`](./VERSION.json):

| Platform | Source | Artifact |
|----------|--------|----------|
| iOS | [TimOliver/vips-cocoa](https://github.com/TimOliver/vips-cocoa) `v8.18.0` | `vips-static-ios.zip` → `vips.xcframework` |
| Android | [CaiJingLong/libvips_precompile_mobile](https://github.com/CaiJingLong/libvips_precompile_mobile) `android-mobipkg-2025-12-12-11` | `*.tar.xz` → `include/` + `jniLibs/` |

Download / extract:

```sh
npm run download-libvips
```

Extracted trees are gitignored (`ios/`, `android/`, `downloads/`). They are required before building the native module.

## License (LGPL-2.1)

libvips is **LGPL-2.1**. Shipping it inside an app has obligations:

- Prefer linking so users can replace the library (dynamic frameworks / shared `.so`).
- Offer corresponding object files / build instructions when statically linking on iOS.
- Include LGPL notice in your app’s open-source attributions.

This package’s own source is MIT; the vendored libvips binaries remain LGPL.

## App size

Expect **several MB per ABI** for libvips + codecs (JPEG/PNG/WebP). Android packages ship `libvips.so` plus GLib deps under `jniLibs/`. iOS embeds `vips.xcframework`.

## Codec matrix (pinned prebuilds)

Probed from `VIPS_CONFIG` / linked plugins in the artifacts above (Aug 2026):

| Capability | iOS (`vips-cocoa` 8.18.0) | Android (`android-mobipkg-2025-12-12-11`) |
|------------|---------------------------|------------------------------------------|
| JPEG / PNG / WebP load+save | yes | yes |
| **AVIF decode** (pixels) | **yes** (libheif + **dav1d**) | **no** (`libheif: false`) |
| AVIF encode | **no** (no aom / rav1e / SVT) | **no** |
| HEIC open / metadata | may succeed (container) | **no** |
| HEIC pixel decode | **no** (no **libde265**) | **no** |
| HEIC encode | **no** (no **x265**) | **no** |
| SVG → raster (`librsvg`) | **no** | **no** |
| Text / pango (`pangocairo`) | **no** | **no** |
| EXIF read (libexif) | **yes** | **no** |
| EXIF write | not exposed in RN API yet | **no** (no libexif) |

Notes:

- iOS `VIPS_CONFIG` reports `HEIC/AVIF load/save with libheif: true`, but the only real codec plugin linked is **dav1d** (AVIF decode). HEIC **headers** can open for `metadata()`, but **rasterize** (e.g. `.jpeg().toBuffer()`) needs libde265. AVIF/HEIC encode need aom/x265 (or similar).
- Android ships `vips_heif*` / `vips_svgload*` **API stubs**, but `VIPS_CONFIG` has `libheif: false` and `librsvg: false` — calls fail at runtime.
- **`vips_text` / pangocairo** is disabled on both platforms → no native text watermark. Use `composite` with a pre-rendered PNG instead.
- **SVG inputs** fail until librsvg is linked into the prebuilds.
- Until prebuilds gain matching codecs on **both** platforms, this package will **not** expose `avif()` / `heif()` encode APIs. AVIF **decode on iOS** already works via the normal `sharp(input)` load path (no extra method).
- HTTP(S) fetch is handled in JS (`sharp.fromUrl`); bytes are passed to native via `createFromBuffer` (no base64).

To unlock cross-platform HEIC/AVIF encode+decode (or SVG / text / EXIF write), switch or rebuild prebuilds with libheif(+libde265/+aom/+x265), librsvg, pangocairo, and libexif.

## Smoke check

After install, JS exposes the initialized engine version:

```ts
import sharp from 'react-native-sharp'
console.log(sharp.vipsVersion) // e.g. "8.18.0"
```
