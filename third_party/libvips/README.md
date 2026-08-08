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

## Smoke check

After install, JS exposes the initialized engine version:

```ts
import sharp from 'react-native-sharp'
console.log(sharp.vipsVersion) // e.g. "8.18.0"
```
