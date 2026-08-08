# Example app

Bare React Native **0.76** app with New Architecture enabled, depending on local `react-native-sharp`.

## Setup

```sh
# from repo root
npm install
npm run download-libvips
npm run codegen

cd example
npm install

# iOS
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios

# Android
npm run android
```

Tap **Run validation suite** to assert real native behaviour (PASS/FAIL):

1. `vipsVersion` / PNG `metadata()`
2. resize cover → exact 64×64 (re-read buffer)
3. JPEG `FF D8` + WebP `RIFF…WEBP` magic bytes
4. crop, rotate axis swap, blur+sharpen pipeline
5. `toFile` round-trip via re-`metadata()`

Logic lives in `src/validateSharp.ts` — extend that file when adding ops.
