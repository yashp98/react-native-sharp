import { Platform } from 'react-native'
import sharp from 'react-native-sharp'

/** Minimal 2×2 PNG (RGBA) as a data URI — no binary fixtures required */
export const SAMPLE_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC'

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
