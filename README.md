# react-native-sharp

**Sharp for React Native** — high-performance native image processing (resize, crop, rotate, compress JPEG / PNG / WebP) on iOS and Android. Same chainable API spirit as Node [`sharp`](https://sharp.pixelplumbing.com/), powered by **libvips** via [Nitro Modules](https://github.com/mrousavy/nitro) (New Architecture).

> Looking for Node.js? Use [`sharp`](https://www.npmjs.com/package/sharp). This package is the **React Native** alternative that runs on device — not in Node.

[![npm version](https://img.shields.io/npm/v/react-native-sharp.svg)](https://www.npmjs.com/package/react-native-sharp)
[![npm downloads](https://img.shields.io/npm/dm/react-native-sharp.svg)](https://www.npmjs.com/package/react-native-sharp)
[![React Native](https://img.shields.io/badge/React%20Native-%3E%3D%200.76-61dafb)](https://reactnative.dev/)
[![New Architecture](https://img.shields.io/badge/New%20Architecture-required-orange)](https://reactnative.dev/docs/the-new-architecture/landing-page)
[![Platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey)](https://github.com/yashp98/react-native-sharp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

- **Package:** [`react-native-sharp`](https://www.npmjs.com/package/react-native-sharp) on npm
- **Use cases:** thumbnails, upload compression, photo editing pipelines, client-side image resize / crop / rotate
- **Stack:** React Native ≥ 0.76 · New Architecture · TypeScript · libvips

```ts
import sharp from 'react-native-sharp'

await sharp(photoUri)
  .resize(1200, 1200, { fit: 'cover' })
  .jpeg({ quality: 80 })
  .toFile(outPath)
```

## Why use react-native-sharp?

Most React Native image tools either wrap thin platform APIs, run slow JS decode/encode, or push work to a server. This package is built for **on-device pipelines** that feel like Node [`sharp`](https://sharp.pixelplumbing.com/).

| Approach | What you usually get | Gap |
|----------|----------------------|-----|
| **Node `sharp`** | Best-in-class libvips API | Does **not** run inside RN / Hermes |
| **JS-only image libs** | Easy to install | Slow, memory-heavy on large camera photos |
| **Typical RN resizers** | One-off resize / compress helpers | Different APIs per library; limited chainable pipelines; often UIKit/Bitmap wrappers |
| **Server-side processing** | Unlimited CPU | Upload cost, latency, offline breaks, privacy tradeoffs |
| **react-native-sharp** | Chainable sharp-like API + **libvips** via **Nitro** | Built for New Architecture apps that need real native throughput on device |

**Why this package:**

- **Same idea as Node sharp, on the phone** — `rotate/autorotate → resize → crop → blur → sharpen → backgroundBlur → roundCorners → composite → jpeg/png/webp → toFile/toBuffer`, not a one-shot helper.
- **libvips under the hood** — the same family of engine Node sharp is known for: fast, streaming-oriented, better memory behavior than naive full-frame JS processing.
- **Nitro Modules (New Architecture)** — JSI HybridObjects instead of the old bridge; operations queue natively and resolve on background promises.
- **Upload-ready outputs** — write a file for local use, or `toBuffer()` for multipart uploads without a round-trip to your backend first.
- **Cross-platform parity** — one API for iOS and Android, with TypeScript types included.

**Use it when you need to:**

- Shrink camera roll / picker images before upload
- Build client-side thumbnail / preview pipelines
- Apply crop / rotate / light edit steps offline
- Keep a sharp-familiar DX in a React Native codebase

**Prefer something else when you need:** Expo Go (no custom natives), Old Architecture, web, or formats / ops we do not ship yet (see roadmap below).

## Compatibility

| | Support |
|--|---------|
| **React Native** | **≥ 0.76** |
| **React** | Matches your RN release (e.g. React 18.3 with RN 0.76) |
| **Architecture** | **New Architecture only** |
| **Platforms** | iOS, Android |
| **Node** | ≥ 18 |

### Tested with

| Platform | React Native | React | nitro-modules | Result |
|----------|--------------|-------|---------------|--------|
| iOS | **0.76.9** | 18.3.1 | 0.36.5 | Validation suite |
| Android | **0.76.9** | 18.3.1 | 0.36.5 | Validation suite |
| Library build | 0.86.0 | 19.x | 0.36.x | Typecheck / bob build |

### Not supported

- React Native **&lt; 0.76**
- **Old Architecture** / Paper (Bridge-only apps)
- Expo Go (needs a **dev client** / bare workflow with native modules)
- Web

## Requirements

| Requirement | Supported / notes |
|-------------|-------------------|
| **React Native** | **0.76+** (tested on **0.76.9**; builds with newer RN such as 0.86) |
| **React** | Version required by your React Native release (e.g. React **18.3** with RN 0.76) |
| **New Architecture** | **Required** (`newArchEnabled=true`) |
| **Node.js** | **18+** |
| **`react-native-nitro-modules`** | **≥ 0.36** (peer dependency) |
| **iOS** | **15.1+**, Xcode with CocoaPods |
| **Android** | **minSdk 24+**, NDK / CMake via Gradle |
| **Platforms** | iOS and Android |

Enable New Architecture if your app does not already:

```properties
# android/gradle.properties
newArchEnabled=true
```

```ruby
# ios — RN 0.76+ apps usually already default to New Arch;
# confirm in Podfile / Xcode that the new architecture is on.
```

## Install

```sh
npm install react-native-sharp react-native-nitro-modules
# or
yarn add react-native-sharp react-native-nitro-modules
```

### iOS

```sh
cd ios && pod install && cd ..
```

Rebuild the app (native module + libvips).

### Android

Rebuild the app. Autolinking picks up the package.

### libvips prebuilds

Pinned libvips binaries download automatically on `postinstall` when missing. To fetch manually:

```sh
node node_modules/react-native-sharp/scripts/download-libvips.js
```

## Integration

### 1. Import

```ts
import sharp from 'react-native-sharp'
// or
import { sharp } from 'react-native-sharp'
```

### 2. Supported inputs

| Input | Example |
|-------|---------|
| Absolute file path | `/var/.../image.jpg` |
| `file://` URI | `file:///.../image.jpg` |
| Base64 data URI | `data:image/png;base64,...` |
| HTTP(S) URL | `await sharp.fromUrl('https://…/photo.jpg')` |
| Raw bytes | `sharp.fromBuffer(arrayBuffer)` |

`sharp('https://…')` throws on purpose — the sync constructor cannot fetch. Use `fromUrl` (fetch → native buffer, no base64).

### 3. Common recipes

**HTTP(S) input**

```ts
const img = await sharp.fromUrl('https://example.com/photo.jpg')
await img.resize(800).jpeg({ quality: 80 }).toFile(outPath)

// or if you already have bytes:
await sharp.fromBuffer(arrayBuffer).resize(800).webp().toBuffer()
```

**Metadata**

```ts
const meta = await sharp(uri).metadata()
// { width, height, format, channels, hasAlpha, size }
```

**Resize + JPEG file**

```ts
await sharp(uri)
  .resize(800, 600, { fit: 'cover' })
  .jpeg({ quality: 80 })
  .toFile(outPath)
```

**WebP / PNG buffer** (e.g. upload)

```ts
const buf = await sharp(uri).webp({ quality: 75 }).toBuffer()
// ArrayBuffer — wrap for upload as needed
```

**Crop, rotate, blur, sharpen**

```ts
await sharp(uri)
  .rotate(90)
  .resize(512, 512, { fit: 'cover' })
  .crop({ left: 0, top: 0, width: 512, height: 512 })
  .blur(1)
  .sharpen()
  .png({ compressionLevel: 6 })
  .toFile(outPath)
```

**EXIF orientation fix + progressive JPEG**

```ts
await sharp(cameraUri)
  .rotate() // no angle → EXIF autorotate
  .resize(1600)
  .jpeg({ quality: 80, progressive: true })
  .toFile(outPath)
```

**Watermark / overlay**

```ts
await sharp(uri)
  .resize(1200)
  .composite([{ input: logoUri, gravity: 'southeast' }])
  .webp({ quality: 80 })
  .toFile(outPath)
```

**Rounded avatar**

```ts
await sharp(uri)
  .resize(256, 256, { fit: 'cover' })
  .roundCorners(128) // circle
  .png()
  .toFile(outPath)
```

**Background blur (story / reel letterbox)**

```ts
await sharp(uri)
  .backgroundBlur(1080, 1920, 25)
  .jpeg({ quality: 85 })
  .toFile(outPath)
```

**Batch processing**

```ts
await sharp.processMany(
  uris.map((uri) => () =>
    sharp(uri).resize(800).jpeg({ progressive: true }).toFile(outPathFor(uri))
  ),
  { concurrency: 4 }
)
```

**Engine version** (sanity check after install)

```ts
console.log(sharp.vipsVersion) // e.g. "8.18.0"
```

## API

### `sharp(input): SharpInstance`

| Method | Description |
|--------|-------------|
| `resize(width?, height?, { fit? })` | Fit: `cover` (default), `contain`, `fill`, `inside`, `outside` |
| `crop({ left, top, width, height })` | Extract region |
| `rotate(angle?)` | Degrees, or no arg → EXIF autorotate |
| `blur(sigma?)` | Gaussian blur (default `0.3`) |
| `sharpen(sigma?)` | Sharpen (default `1`) |
| `backgroundBlur(width, height, sigma?)` | Blurred cover canvas + sharp contain overlay (default σ `20`) |
| `roundCorners(radius)` | Rounded-rect alpha mask (use PNG/WebP) |
| `composite([{ input, left?, top?, gravity? }])` | Overlay watermark / stamp images |
| `jpeg({ quality?, progressive? })` | Encode JPEG (default quality `80`) |
| `png({ compressionLevel? })` | Encode PNG (default `6`) |
| `webp({ quality? })` | Encode WebP (default quality `80`) |
| `toFile(path)` | Write file → `Promise<string>` |
| `toBuffer()` | Encode to memory → `Promise<ArrayBuffer>` |
| `metadata()` | Read input metadata → `Promise<ImageMetadata>` |

Static:

| Member | Description |
|--------|-------------|
| `sharp.vipsVersion` | libvips version string |
| `sharp.fromUrl(url, { headers? })` | Fetch HTTP(S) → native buffer load (no base64) |
| `sharp.fromBuffer(arrayBuffer)` | Pipeline from raw encoded bytes |
| `sharp.processMany(tasks, { concurrency? })` | Run pipeline tasks with limited concurrency (default `4`) |

### Pipeline order

Native execution order is:

`rotate/autorotate → resize → crop → blur → sharpen → backgroundBlur → roundCorners → composite → encode`

Write chains in that order so results match what you expect.

## Limitations (current prebuilds)

| Feature | Status | Why |
|---------|--------|-----|
| Image watermark | **Supported** | `composite([{ input, gravity? }])` with a PNG/WebP overlay |
| **Text** watermark | **Not available** | Needs **pangocairo** — absent on iOS + Android prebuilds |
| **SVG → PNG** | **Not available** | Needs **librsvg** — absent on both; `vips_svgload*` stubs fail at runtime |
| AVIF decode | **iOS only** | dav1d linked in iOS xcframework; Android `libheif: false` |
| HEIC pixel decode / AVIF·HEIC encode | **Not available** | Missing libde265 / aom / x265 |
| EXIF write | **Not available yet** | libexif on **iOS only**; Android `libexif: false` — no cross-platform API yet |

Workaround for text: render text to a transparent PNG in your app (or design tool), then `composite` it.

Full codec matrix: [`third_party/libvips/README.md`](third_party/libvips/README.md).

## Roadmap

- **HEIC/AVIF encode + Android AVIF/HEIC decode** — blocked on richer prebuilds (see codec matrix). iOS can already **decode AVIF** via normal `sharp(uri)` input.
- **Text watermark / SVG→PNG** — blocked on pangocairo + librsvg in prebuilds.
- EXIF write (needs libexif on Android too, or an iOS-only opt-in).

HTTP(S) inputs: **done** via `sharp.fromUrl`.

## Example app

This repo includes a bare RN example with a native validation suite:

```sh
cd example
npm install
cd ios && bundle exec pod install && cd ..
npm run ios    # or: npm run android
```

Tap **Run validation suite** to exercise the real Nitro + libvips pipeline.

## How it works

```
JS sharp()  →  Nitro SharpModule / SharpPipeline  →  C++ libvips
```

Operations queue on a HybridObject; `toFile` / `toBuffer` / `metadata` run asynchronously on a background promise.

## License

- Package source: **MIT**
- Downloaded **libvips** prebuilds: **LGPL-2.1** — see [`third_party/libvips/README.md`](third_party/libvips/README.md) for app attribution / linking notes
