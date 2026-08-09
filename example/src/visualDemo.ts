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
/** Cap demo working size so gallery photos stay snappy. */
const DEMO_MAX = 720

function writableOutPath(filename: string): string {
  if (Platform.OS === 'ios') {
    return `/tmp/${filename}`
  }
  return `/data/data/com.reactnativesharpexample/cache/${filename}`
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`
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

async function previewFromPath(
  label: string,
  path: string,
  detail: string
): Promise<DemoPreview> {
  const meta = await sharp(path).metadata()
  return {
    label,
    uri: toFileUri(path),
    width: meta.width,
    height: meta.height,
    detail: `${detail} · ${Math.round(meta.size)}B`,
  }
}

/**
 * Write a demo result to a temp file and return a file:// preview.
 * Avoids huge data-URI / btoa work that made rotate/crop feel slow.
 */
async function writeDemoPreview(
  label: string,
  ext: 'png' | 'jpg',
  detail: string,
  run: (outPath: string) => Promise<string>
): Promise<DemoPreview> {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const outPath = writableOutPath(
    `rn-sharp-demo-${label.replace(/\W+/g, '_').slice(0, 24)}-${stamp}.${ext}`
  )
  const written = await run(outPath)
  return previewFromPath(label, written, detail)
}

export async function previewFromInput(
  label: string,
  input: string,
  detail?: string
): Promise<DemoPreview> {
  const meta = await sharp(input).metadata()
  return {
    label,
    uri: input.startsWith('data:') ? input : toFileUri(input),
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
  const after = await writeDemoPreview(
    'Rotate 90°',
    'jpg',
    'axes swapped',
    (out) =>
      sharp(input)
        .rotate(90)
        .resize(DEMO_MAX, DEMO_MAX, { fit: 'inside' })
        .jpeg({ quality: 85 })
        .toFile(out)
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

  // Native order is resize→crop, so crop first to a temp file, then downscale.
  const croppedPath = writableOutPath(`rn-sharp-crop-${Date.now()}.jpg`)
  await sharp(input)
    .crop({ left, top, width, height })
    .jpeg({ quality: 85 })
    .toFile(croppedPath)

  const after = await writeDemoPreview(
    `Crop ${width}×${height}`,
    'jpg',
    `left:${left} top:${top}`,
    (out) =>
      sharp(croppedPath)
        .resize(DEMO_MAX, DEMO_MAX, { fit: 'inside' })
        .jpeg({ quality: 85 })
        .toFile(out)
  )
  return { before, after }
}

/**
 * Prepare-for-upload path: EXIF autorotate → max edge 1200 → progressive JPEG toFile.
 */
export async function saveDemo(input: string = DEMO_PNG): Promise<DemoPair> {
  const before = await originalPreview(input)
  const path = writableOutPath(`rn-sharp-demo-${Date.now()}.jpg`)

  const written = await sharp(input)
    .rotate() // EXIF autorotate when present
    .resize(1200, 1200, { fit: 'inside' })
    .jpeg({ quality: 85, progressive: true })
    .toFile(path)

  const after = await previewFromPath(
    'Saved JPEG',
    written,
    'autorotate · ≤1200 · progressive'
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
    previews.push(
      await writeDemoPreview(
        fit,
        'jpg',
        `${TARGET.width}×${TARGET.height}`,
        (out) =>
          sharp(input)
            .resize(TARGET.width, TARGET.height, { fit })
            .jpeg({ quality: 85 })
            .toFile(out)
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

  return {
    source,
    previews: [
      await writeDemoPreview('Blur σ=2.5', 'jpg', 'gaussian', (out) =>
        sharp(input)
          .resize(DEMO_MAX, DEMO_MAX, { fit: 'inside' })
          .blur(2.5)
          .jpeg({ quality: 85 })
          .toFile(out)
      ),
      await writeDemoPreview('Sharpen σ=2', 'jpg', 'unsharp', (out) =>
        sharp(input)
          .resize(DEMO_MAX, DEMO_MAX, { fit: 'inside' })
          .sharpen(2)
          .jpeg({ quality: 85 })
          .toFile(out)
      ),
    ],
  }
}

/** Avatar-style cover crop to a square JPEG (common upload recipe). */
export async function avatarDemo(input: string = DEMO_PNG): Promise<DemoPair> {
  const before = await originalPreview(input)
  const after = await writeDemoPreview(
    'Avatar 256²',
    'jpg',
    'cover + jpeg q80',
    (out) =>
      sharp(input)
        .resize(256, 256, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(out)
  )
  return { before, after }
}

/** Circular avatar via roundCorners (PNG keeps alpha). */
export async function roundCornersDemo(
  input: string = DEMO_PNG
): Promise<DemoPair> {
  const before = await originalPreview(input)
  const after = await writeDemoPreview(
    'Circle 200²',
    'png',
    'roundCorners(100)',
    (out) =>
      sharp(input)
        .resize(200, 200, { fit: 'cover' })
        .roundCorners(100)
        .png()
        .toFile(out)
  )
  return { before, after, note: 'PNG alpha mask — dark UI shows the circle' }
}

/** Story / reel letterbox: blurred cover canvas + sharp contain overlay. */
export async function backgroundBlurDemo(
  input: string = DEMO_PNG
): Promise<DemoPair> {
  const before = await originalPreview(input)
  const after = await writeDemoPreview(
    'Bg blur 180×320',
    'jpg',
    'σ=12 cover+contain',
    (out) =>
      sharp(input).backgroundBlur(180, 320, 12).jpeg({ quality: 85 }).toFile(out)
  )
  return { before, after }
}

/** Watermark: stamp a small cover crop into the southeast corner. */
export async function compositeDemo(
  input: string = DEMO_PNG
): Promise<DemoPair> {
  const before = await originalPreview(input)
  const markPath = writableOutPath(`rn-sharp-mark-${Date.now()}.png`)
  await sharp(input).resize(56, 56, { fit: 'cover' }).png().toFile(markPath)

  const after = await writeDemoPreview(
    'Watermark SE',
    'jpg',
    'composite gravity',
    (out) =>
      sharp(input)
        .resize(280, 200, { fit: 'cover' })
        .composite([{ input: markPath, gravity: 'southeast' }])
        .jpeg({ quality: 85 })
        .toFile(out)
  )
  return { before, after }
}

/** Stable remote JPEG for `fromUrl` (fetch → native createFromBuffer). */
export const DEMO_REMOTE_URL =
  'https://picsum.photos/id/1015/400/300.jpg'

/**
 * HTTP(S) input: download with fetch, load via native buffer (no base64).
 * Before preview uses the remote URL directly in Image.
 */
export async function fromUrlDemo(
  url: string = DEMO_REMOTE_URL
): Promise<DemoPair> {
  const img = await sharp.fromUrl(url)
  const meta = await img.metadata()
  const before: DemoPreview = {
    label: 'Remote HTTP',
    uri: url,
    width: meta.width,
    height: meta.height,
    detail: `fromUrl · ${meta.format} · ${Math.round(meta.size)}B`,
  }

  const after = await writeDemoPreview(
    'fromUrl → 240w',
    'jpg',
    'fetch + createFromBuffer',
    (out) =>
      img.resize(240, 240, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(out)
  )

  return {
    before,
    after,
    note: 'JS fetch → ArrayBuffer → native createFromBuffer',
  }
}
