import { Platform } from 'react-native'
import { launchImageLibrary } from 'react-native-image-picker'
import sharp, { type Fit } from 'react-native-sharp'

/**
 * 120×160 RGB PNG: horizontal color bands + white vertical stripe.
 * Makes rotate / crop / fit modes obvious (no binary fixtures required).
 */
export const DEMO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAACgCAIAAABIaz/HAAABSklEQVR4nO3QMRHAMAwEQcNJbSQBEYiGYxBhkACwOhVSsT8H4GfHnrNhX2Ll58NG+QPQoEGDBg0aNGjQoEGDBg0aNGjQoEGDBg0aNGjQoEGDBg0aNGjQoEGDBg0aNGjQoEGDBg0aNGjQoEGDBg36hJ7rblgGuvx8GGjQoEGDBg26/AFo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNOoJ+dsNS0NXnw0CDBg0aNGjQ5Q9AgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0AH0u66GZaDLz4eBBg0aNGjQoMsfgAYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KBBgwYNGjRo0KDPfjj0fmPhggAFAAAAAElFTkSuQmCC'

export type DemoPreview = {
  label: string
  uri: string
  width: number
  height: number
  detail: string
}

export type DemoPair = {
  before: DemoPreview
  after: DemoPreview
  note?: string
}

export type DemoGallery = {
  source: DemoPreview
  previews: DemoPreview[]
  note?: string
}

const FIT_MODES: Fit[] = ['cover', 'contain', 'fill', 'inside', 'outside']
const TARGET = { width: 160, height: 100 }

function bytes(buf: ArrayBuffer): Uint8Array {
  return new Uint8Array(buf)
}

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

/** Normalize picker URIs so sharp always gets file:// or an absolute path. */
export function normalizeInputUri(uri: string): string {
  if (
    uri.startsWith('file://') ||
    uri.startsWith('data:') ||
    uri.startsWith('/')
  ) {
    return uri
  }
  return `file://${uri}`
}

async function previewFromBuffer(
  label: string,
  buf: ArrayBuffer,
  mime: string,
  detail: string
): Promise<DemoPreview> {
  const uri = bufferToDataUri(buf, mime)
  const meta = await sharp(uri).metadata()
  return {
    label,
    uri,
    width: meta.width,
    height: meta.height,
    detail: `${detail} · ${buf.byteLength}B`,
  }
}

export async function previewFromInput(
  label: string,
  input: string,
  detail?: string
): Promise<DemoPreview> {
  const meta = await sharp(input).metadata()
  return {
    label,
    uri: input.startsWith('data:') ? input : input,
    width: meta.width,
    height: meta.height,
    detail: detail ?? `${meta.width}×${meta.height} ${meta.format}`,
  }
}

export async function originalPreview(
  input: string = DEMO_PNG
): Promise<DemoPreview> {
  return previewFromInput('Original', input)
}

/**
 * Opens the system photo library. Returns null if the user cancels.
 * Throws on permission / picker errors.
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  const result = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    includeBase64: false,
  })

  if (result.didCancel) {
    return null
  }
  if (result.errorCode) {
    throw new Error(
      result.errorMessage ?? `image picker error: ${result.errorCode}`
    )
  }

  const asset = result.assets?.[0]
  const uri = asset?.uri
  if (!uri) {
    throw new Error('image picker returned no uri')
  }
  return normalizeInputUri(uri)
}

/** Tall bands → landscape; white stripe becomes horizontal. */
export async function rotateDemo(
  input: string = DEMO_PNG
): Promise<DemoPair> {
  const before = await originalPreview(input)
  const buf = await sharp(input).rotate(90).png().toBuffer()
  const after = await previewFromBuffer(
    'Rotate 90°',
    buf,
    'image/png',
    'axes swapped'
  )
  return { before, after }
}

/** Keep a center-ish extract (scaled for arbitrary inputs). */
export async function cropDemo(input: string = DEMO_PNG): Promise<DemoPair> {
  const before = await originalPreview(input)
  const left = Math.max(0, Math.floor(before.width * 0.15))
  const top = Math.max(0, Math.floor(before.height * 0.25))
  const width = Math.max(1, Math.floor(before.width * 0.55))
  const height = Math.max(1, Math.floor(before.height * 0.45))
  const buf = await sharp(input)
    .crop({ left, top, width, height })
    .png()
    .toBuffer()
  const after = await previewFromBuffer(
    `Crop ${width}×${height}`,
    buf,
    'image/png',
    `left:${left} top:${top}`
  )
  return { before, after }
}

/**
 * Rotate → crop → JPEG toFile — the “prepare for upload” path.
 * (Library has no HTTP upload; toBuffer/toFile is the hand-off.)
 */
export async function saveDemo(input: string = DEMO_PNG): Promise<DemoPair> {
  const before = await originalPreview(input)
  const path = writableOutPath(`rn-sharp-demo-${Date.now()}.jpg`)
  // Pipeline applies rotate before crop — size after 90° is swapped.
  const afterW = before.height
  const afterH = before.width
  const cropW = Math.min(100, afterW)
  const cropH = Math.min(100, afterH)
  const left = Math.max(0, Math.floor((afterW - cropW) / 2))
  const top = Math.max(0, Math.floor((afterH - cropH) / 2))

  const written = await sharp(input)
    .rotate(90)
    .crop({ left, top, width: cropW, height: cropH })
    .jpeg({ quality: 85 })
    .toFile(path)

  const meta = await sharp(written).metadata()
  const previewBuf = await sharp(written).jpeg({ quality: 85 }).toBuffer()
  const after = await previewFromBuffer(
    'Saved JPEG',
    previewBuf,
    'image/jpeg',
    `${meta.width}×${meta.height}`
  )
  return { before, after, note: written }
}

/** Same target box, five fit modes — easiest way to see resize behaviour. */
export async function fitModesDemo(
  input: string = DEMO_PNG
): Promise<DemoGallery> {
  const source = await originalPreview(input)
  const previews: DemoPreview[] = []

  for (const fit of FIT_MODES) {
    const buf = await sharp(input)
      .resize(TARGET.width, TARGET.height, { fit })
      .png()
      .toBuffer()
    previews.push(
      await previewFromBuffer(
        fit,
        buf,
        'image/png',
        `${TARGET.width}×${TARGET.height}`
      )
    )
  }

  return {
    source,
    previews,
    note: `resize(${TARGET.width}, ${TARGET.height}, { fit })`,
  }
}

/** Side-by-side blur vs sharpen on the same source. */
export async function blurSharpenDemo(
  input: string = DEMO_PNG
): Promise<DemoGallery> {
  const source = await originalPreview(input)

  const blurred = await sharp(input).blur(2.5).png().toBuffer()
  const sharpened = await sharp(input).sharpen(2).png().toBuffer()

  return {
    source,
    previews: [
      await previewFromBuffer('Blur σ=2.5', blurred, 'image/png', 'gaussian'),
      await previewFromBuffer('Sharpen σ=2', sharpened, 'image/png', 'unsharp'),
    ],
  }
}

/** Avatar-style cover crop to a square JPEG (common upload recipe). */
export async function avatarDemo(input: string = DEMO_PNG): Promise<DemoPair> {
  const before = await originalPreview(input)
  const buf = await sharp(input)
    .resize(256, 256, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer()
  const after = await previewFromBuffer(
    'Avatar 256²',
    buf,
    'image/jpeg',
    'cover + jpeg q80'
  )
  return { before, after }
}

/** Circular avatar via roundCorners (PNG keeps alpha). */
export async function roundCornersDemo(
  input: string = DEMO_PNG
): Promise<DemoPair> {
  const before = await originalPreview(input)
  const buf = await sharp(input)
    .resize(200, 200, { fit: 'cover' })
    .roundCorners(100)
    .png()
    .toBuffer()
  const after = await previewFromBuffer(
    'Circle 200²',
    buf,
    'image/png',
    'roundCorners(100)'
  )
  return { before, after, note: 'PNG alpha mask — dark UI shows the circle' }
}

/** Story / reel letterbox: blurred cover canvas + sharp contain overlay. */
export async function backgroundBlurDemo(
  input: string = DEMO_PNG
): Promise<DemoPair> {
  const before = await originalPreview(input)
  const buf = await sharp(input)
    .backgroundBlur(180, 320, 12)
    .jpeg({ quality: 85 })
    .toBuffer()
  const after = await previewFromBuffer(
    'Bg blur 180×320',
    buf,
    'image/jpeg',
    'σ=12 cover+contain'
  )
  return { before, after }
}

/** Watermark: stamp a small cover crop into the southeast corner. */
export async function compositeDemo(
  input: string = DEMO_PNG
): Promise<DemoPair> {
  const before = await originalPreview(input)
  const markBuf = await sharp(input)
    .resize(56, 56, { fit: 'cover' })
    .png()
    .toBuffer()
  const markUri = bufferToDataUri(markBuf, 'image/png')
  const buf = await sharp(input)
    .resize(280, 200, { fit: 'cover' })
    .composite([{ input: markUri, gravity: 'southeast' }])
    .png()
    .toBuffer()
  const after = await previewFromBuffer(
    'Watermark SE',
    buf,
    'image/png',
    'composite gravity'
  )
  return { before, after }
}
