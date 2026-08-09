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

### Visual demo

1. **Pick photo** (gallery via `react-native-image-picker`) or **Use sample**
2. Run ops on that source:
   - **Rotate** / **Crop** / **Save** (rotate → crop → JPEG `toFile`)
   - **Fit modes** — `cover` / `contain` / `fill` / `inside` / `outside` at 160×100
   - **Blur / sharp** — gaussian blur vs sharpen
   - **Avatar** — `resize(256, 256, { fit: 'cover' })` → JPEG
   - **Round** — circular avatar via `roundCorners`
   - **Bg blur** — story/reel letterbox via `backgroundBlur`
   - **Watermark** — `composite` overlay with southeast gravity

Logic lives in `src/visualDemo.ts`. After installing `react-native-image-picker`, run `pod install` on iOS and rebuild (native module).

### Validation suite

Tap **Run validation suite** to assert real native behaviour (PASS/FAIL):

1. `vipsVersion` / PNG `metadata()`
2. resize cover → exact 64×64 (re-read buffer)
3. JPEG `FF D8` + progressive JPEG `SOF2` + WebP `RIFF…WEBP`
4. crop, rotate axis swap, blur+sharpen pipeline
5. composite overlay (gravity)
6. roundCorners alpha mask + backgroundBlur canvas
7. `toFile` round-trip via re-`metadata()`

Logic lives in `src/validateSharp.ts` — extend that file when adding ops.
