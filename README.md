# react-native-sharp

High-performance image processing for React Native — same spirit as Node [`sharp`](https://sharp.pixelplumbing.com/), powered by **libvips** via [Nitro Modules](https://github.com/mrousavy/nitro).

Works on **iOS** and **Android** with a chainable TypeScript API.

```ts
import sharp from 'react-native-sharp'

await sharp(photoUri)
  .resize(1200, 1200, { fit: 'cover' })
  .jpeg({ quality: 80 })
  .toFile(outPath)
```

## Requirements

| Requirement | Notes |
|-------------|--------|
| React Native New Architecture | Required (Nitro HybridObjects) |
| `react-native-nitro-modules` | Peer dependency |
| iOS | `pod install` after install |
| Android | Autolinking + CMake (no extra steps beyond Gradle sync) |

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

## Features

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
