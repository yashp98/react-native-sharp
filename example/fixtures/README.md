# Golden fixtures

Place sample images here for device/simulator golden tests:

- `fixtures/sample.jpg`
- `fixtures/sample.png`
- `fixtures/sample.webp`

The example app runs these checks via **Run validation suite** (`src/validateSharp.ts`)
using an inline 2×2 PNG data URI — no binary fixtures required for a smoke run.

Optional file fixtures for larger golden tests:

1. `metadata()` returns expected width/height/format
2. `resize(100,100,{fit:'cover'}).jpeg().toBuffer()` produces a JPEG with SOI marker `FF D8`
3. `webp().toBuffer()` starts with `RIFF....WEBP`
