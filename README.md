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
| iOS | **0.76.9** | 18.3.1 | 0.36.5 | Validation suite 9/9 |
| Android | **0.76.9** | 18.3.1 | 0.36.5 | Validation suite 9/9 |
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

### 3. Common recipes

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
| `rotate(angle?)` | Degrees (default `90`) |
| `blur(sigma?)` | Gaussian blur (default `0.3`) |
| `sharpen(sigma?)` | Sharpen (default `1`) |
| `jpeg({ quality? })` | Encode JPEG (default quality `80`) |
| `png({ compressionLevel? })` | Encode PNG (default `6`) |
| `webp({ quality? })` | Encode WebP (default quality `80`) |
| `toFile(path)` | Write file → `Promise<string>` |
| `toBuffer()` | Encode to memory → `Promise<ArrayBuffer>` |
| `metadata()` | Read input metadata → `Promise<ImageMetadata>` |

Static: `sharp.vipsVersion: string`

### Pipeline order

Native execution order is:

`rotate → resize → crop → blur → sharpen → encode`

Write chains in that order so results match what you expect.

## Why react-native-sharp?

Node [`sharp`](https://www.npmjs.com/package/sharp) does not run inside React Native apps. **react-native-sharp** brings the same idea on-device: fast libvips-backed resize, crop, rotate, blur, sharpen, and JPEG/PNG/WebP encode through a familiar chainable API.

| Area | Support |
|------|---------|
| Platforms | iOS, Android |
| Formats | JPEG, PNG, WebP |
| Ops | resize, crop, rotate, blur, sharpen |
| Output | `toFile`, `toBuffer`, `metadata` |
| Types | TypeScript included |

Roadmap: HEIC/AVIF, watermark, composite, EXIF write, HTTP(S) inputs.

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
