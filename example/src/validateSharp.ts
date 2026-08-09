import { Platform } from 'react-native'
import sharp from 'react-native-sharp'

/** Minimal 2×2 PNG (RGBA) as a data URI — no binary fixtures required */
export const SAMPLE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC'

/**
 * Tiny 2×2 AVIF (aom). iOS prebuild can decode (libheif+dav1d);
 * Android prebuild has libheif disabled — decode must fail there.
 */
export const SAMPLE_AVIF =
  'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUEAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAARwAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAgAAAAIAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBIAAAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAT21kYXQSAAoEOAA2CTI9F8AJJJJFAJA/LzNjjALtyCuy6/d9LTXHksbwKk0AQKwrwPzQh7c9nT0OAs5TBj/cT7pkz1ejhWgdoT4EQA=='

/** Tiny HEIC (x265). Neither mobile prebuild links libde265 — decode must fail. */
export const SAMPLE_HEIC =
  'data:image/heic;base64,AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAXxtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAAREAAAQABAAAAAAGgAAEAAAAAAAAAQwAAACNpaW5mAAAAAAABAAAAFWluZmUCAAAAAAEAAGh2YzEAAAAA/GlwcnAAAADcaXBjbwAAAHVodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQApQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbqrprm4CGgwIAAAAyAAAADAIRiAAEABkQBwXPBiQAAABNjb2xybmNseAABAA0ABoAAAAAUaXNwZQAAAAAAAABAAAAAQAAAAChjbGFwAAAAAgAAAAEAAAACAAAAAf///8IAAAAC////wgAAAAIAAAAQcGl4aQAAAAADCAgIAAAAGGlwbWEAAAAAAAAAAQABBYECAwWEAAAAS21kYXQAAAA/KAGvEyGhIFhYHJYoAAnp27Ooz/o9+9asj2Ky0+Pqa8dQICiY5mrNd9kQMsG/f24+iIyA6NuBJWPVtYg3VTJY'

export type CaseResult = {
  name: string
  ok: boolean
  detail: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function bytes(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf)
}

function startsWith(buf: ArrayBuffer, expected: number[]): boolean {
  const view = bytes(buf)
  if (view.length < expected.length) {
    return false
  }
  return expected.every((b, i) => view[i] === b)
}

function hexPrefix(buf: ArrayBuffer, n: number): string {
  return Array.from(bytes(buf).slice(0, n))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')
}

/** Hermes / JSC provide btoa; build a data URI so we can re-open buffers. */
function bufferToDataUri(buf: ArrayBuffer, mime: string): string {
  const view = bytes(buf)
  let binary = ''
  for (let i = 0; i < view.length; i++) {
    binary += String.fromCharCode(view[i]!)
  }
  return `data:${mime};base64,${btoa(binary)}`
}

function writableOutPath(filename: string): string {
  if (Platform.OS === 'ios') {
    return `/tmp/${filename}`
  }
  return `/data/data/com.reactnativesharpexample/cache/${filename}`
}

async function runCase(
  name: string,
  fn: () => Promise<string>
): Promise<CaseResult> {
  try {
    const detail = await fn()
    return { name, ok: true, detail }
  } catch (e) {
    return {
      name,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Device/simulator checks against the real Nitro + libvips pipeline.
 * Safe to run from the example UI (no Detox/Maestro required).
 */
export async function validateSharp(): Promise<CaseResult[]> {
  return [
    await runCase('vipsVersion', async () => {
      const version = sharp.vipsVersion
      assert(typeof version === 'string' && version.length > 0, 'empty version')
      return version
    }),

    await runCase('metadata(png data URI)', async () => {
      const meta = await sharp(SAMPLE_PNG).metadata()
      assert(meta.width === 2, `width=${meta.width}`)
      assert(meta.height === 2, `height=${meta.height}`)
      assert(meta.format === 'png', `format=${meta.format}`)
      assert(meta.channels === 4, `channels=${meta.channels}`)
      assert(meta.hasAlpha === true, `hasAlpha=${meta.hasAlpha}`)
      assert(meta.size > 0, `size=${meta.size}`)
      return `${meta.width}x${meta.height} ${meta.format} ch=${meta.channels}`
    }),

    await runCase('resize cover → 64×64 png', async () => {
      const buf = await sharp(SAMPLE_PNG)
        .resize(64, 64, { fit: 'cover' })
        .png()
        .toBuffer()
      assert(startsWith(buf, [0x89, 0x50, 0x4e, 0x47]), `not png: ${hexPrefix(buf, 4)}`)
      const meta = await sharp(bufferToDataUri(buf, 'image/png')).metadata()
      assert(meta.width === 64 && meta.height === 64, `${meta.width}x${meta.height}`)
      return `${meta.width}x${meta.height} ${buf.byteLength}B`
    }),

    await runCase('jpeg magic + quality encode', async () => {
      const buf = await sharp(SAMPLE_PNG)
        .resize(32, 32, { fit: 'fill' })
        .jpeg({ quality: 80 })
        .toBuffer()
      assert(startsWith(buf, [0xff, 0xd8]), `no SOI: ${hexPrefix(buf, 2)}`)
      assert(buf.byteLength > 32, `too small: ${buf.byteLength}`)
      return `FF D8… ${buf.byteLength}B`
    }),

    await runCase('progressive jpeg SOF2', async () => {
      const buf = await sharp(SAMPLE_PNG)
        .resize(48, 48, { fit: 'fill' })
        .jpeg({ quality: 80, progressive: true })
        .toBuffer()
      assert(startsWith(buf, [0xff, 0xd8]), `no SOI: ${hexPrefix(buf, 2)}`)
      const view = bytes(buf)
      let hasSof2 = false
      for (let i = 0; i + 1 < view.length; i++) {
        if (view[i] === 0xff && view[i + 1] === 0xc2) {
          hasSof2 = true
          break
        }
      }
      assert(hasSof2, `missing SOF2 (progressive): ${hexPrefix(buf, 16)}`)
      return `progressive ${buf.byteLength}B`
    }),

    await runCase('webp RIFF/WEBP magic', async () => {
      const buf = await sharp(SAMPLE_PNG).webp({ quality: 70 }).toBuffer()
      assert(startsWith(buf, [0x52, 0x49, 0x46, 0x46]), `no RIFF: ${hexPrefix(buf, 4)}`)
      const view = bytes(buf)
      assert(
        view.length >= 12 &&
          view[8] === 0x57 &&
          view[9] === 0x45 &&
          view[10] === 0x42 &&
          view[11] === 0x50,
        `no WEBP at +8: ${hexPrefix(buf, 12)}`
      )
      return `RIFF…WEBP ${buf.byteLength}B`
    }),

    await runCase('crop 1×1', async () => {
      const buf = await sharp(SAMPLE_PNG)
        .crop({ left: 0, top: 0, width: 1, height: 1 })
        .png()
        .toBuffer()
      const meta = await sharp(bufferToDataUri(buf, 'image/png')).metadata()
      assert(meta.width === 1 && meta.height === 1, `${meta.width}x${meta.height}`)
      return `${meta.width}x${meta.height}`
    }),

    await runCase('rotate 90 swaps axes', async () => {
      const tall = await sharp(SAMPLE_PNG)
        .resize(10, 20, { fit: 'fill' })
        .png()
        .toBuffer()
      const rotated = await sharp(bufferToDataUri(tall, 'image/png'))
        .rotate(90)
        .png()
        .toBuffer()
      const meta = await sharp(bufferToDataUri(rotated, 'image/png')).metadata()
      assert(meta.width === 20 && meta.height === 10, `${meta.width}x${meta.height}`)
      return `${meta.width}x${meta.height}`
    }),

    await runCase('blur + sharpen pipeline', async () => {
      const buf = await sharp(SAMPLE_PNG)
        .resize(48, 48, { fit: 'cover' })
        .blur(0.5)
        .sharpen(1)
        .jpeg({ quality: 85 })
        .toBuffer()
      assert(startsWith(buf, [0xff, 0xd8]), `no SOI: ${hexPrefix(buf, 2)}`)
      return `${buf.byteLength}B jpeg`
    }),

    await runCase('composite overlay gravity', async () => {
      const base = await sharp(SAMPLE_PNG)
        .resize(64, 64, { fit: 'fill' })
        .png()
        .toBuffer()
      const mark = await sharp(SAMPLE_PNG)
        .resize(16, 16, { fit: 'fill' })
        .png()
        .toBuffer()
      const buf = await sharp(bufferToDataUri(base, 'image/png'))
        .composite([
          {
            input: bufferToDataUri(mark, 'image/png'),
            gravity: 'southeast',
          },
        ])
        .png()
        .toBuffer()
      const meta = await sharp(bufferToDataUri(buf, 'image/png')).metadata()
      assert(meta.width === 64 && meta.height === 64, `${meta.width}x${meta.height}`)
      assert(meta.hasAlpha, 'expected alpha after composite')
      return `${meta.width}x${meta.height} alpha`
    }),

    await runCase('roundCorners alpha mask', async () => {
      const buf = await sharp(SAMPLE_PNG)
        .resize(64, 64, { fit: 'cover' })
        .roundCorners(16)
        .png()
        .toBuffer()
      const meta = await sharp(bufferToDataUri(buf, 'image/png')).metadata()
      assert(meta.width === 64 && meta.height === 64, `${meta.width}x${meta.height}`)
      assert(meta.hasAlpha, 'expected alpha after roundCorners')
      return `${meta.width}x${meta.height} r=16`
    }),

    await runCase('backgroundBlur canvas', async () => {
      const buf = await sharp(SAMPLE_PNG)
        .backgroundBlur(80, 120, 8)
        .jpeg({ quality: 80 })
        .toBuffer()
      assert(startsWith(buf, [0xff, 0xd8]), `no SOI: ${hexPrefix(buf, 2)}`)
      const meta = await sharp(bufferToDataUri(buf, 'image/jpeg')).metadata()
      assert(meta.width === 80 && meta.height === 120, `${meta.width}x${meta.height}`)
      return `${meta.width}x${meta.height}`
    }),

    await runCase('toFile round-trip', async () => {
      const path = writableOutPath(`rn-sharp-validate-${Date.now()}.jpg`)
      const written = await sharp(SAMPLE_PNG)
        .resize(24, 24, { fit: 'fill' })
        .jpeg({ quality: 75 })
        .toFile(path)
      assert(written === path || written.endsWith('.jpg'), `written=${written}`)
      const meta = await sharp(written).metadata()
      assert(meta.width === 24 && meta.height === 24, `${meta.width}x${meta.height}`)
      assert(meta.format === 'jpeg' || meta.format === 'jpg', `format=${meta.format}`)
      return `${meta.width}x${meta.height} → ${written}`
    }),

    await runCase('avif decode (prebuild-dependent)', async () => {
      if (Platform.OS === 'ios') {
        const meta = await sharp(SAMPLE_AVIF).metadata()
        assert(meta.width === 2 && meta.height === 2, `${meta.width}x${meta.height}`)
        assert(
          meta.format === 'heif' || meta.format === 'avif',
          `format=${meta.format}`
        )
        const buf = await sharp(SAMPLE_AVIF).jpeg({ quality: 80 }).toBuffer()
        assert(startsWith(buf, [0xff, 0xd8]), `no SOI: ${hexPrefix(buf, 2)}`)
        return `ios ${meta.width}x${meta.height} ${meta.format} → jpeg ${buf.byteLength}B`
      }
      // Android mobipkg: libheif disabled
      let failed = false
      try {
        await sharp(SAMPLE_AVIF).metadata()
      } catch {
        failed = true
      }
      assert(failed, 'expected Android AVIF decode to fail (libheif absent)')
      return 'android: decode unavailable (libheif:false) ✓'
    }),

    await runCase('heic rasterize unsupported (expected)', async () => {
      // HEIF container headers can load without a HEVC codec (metadata may
      // succeed). Force pixel decode via jpeg encode — needs libde265.
      let failed = false
      let detail = ''
      try {
        await sharp(SAMPLE_HEIC).jpeg({ quality: 80 }).toBuffer()
      } catch (e) {
        failed = true
        detail = e instanceof Error ? e.message : String(e)
      }
      assert(
        failed,
        'expected HEIC rasterize to fail (no libde265 in iOS/Android prebuilds)'
      )
      return `${Platform.OS}: no libde265 ✓ (${detail.slice(0, 80)})`
    }),
  ]
}

export function summarize(results: CaseResult[]): {
  passed: number
  failed: number
  ok: boolean
} {
  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  return { passed, failed, ok: failed === 0 }
}
