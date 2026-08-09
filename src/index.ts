import { NitroModules } from 'react-native-nitro-modules'
import { fetchImageBuffer } from './fromUrl'
import type { SharpModule, SharpPipeline } from './specs/Sharp.nitro'
import type {
  CompositeOptions,
  FromUrlOptions,
  JpegOptions,
  PngOptions,
  ProcessManyOptions,
  ResizeOptions,
  SharpInstance,
  SharpStatic,
  WebpOptions,
} from './types'

const native = NitroModules.createHybridObject<SharpModule>('SharpModule')

async function processMany<T>(
  tasks: Array<() => Promise<T>>,
  options?: ProcessManyOptions
): Promise<T[]> {
  const concurrency = Math.max(1, Math.floor(options?.concurrency ?? 4))
  const results = new Array<T>(tasks.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const index = nextIndex++
      if (index >= tasks.length) {
        return
      }
      const task = tasks[index]
      if (task == null) {
        continue
      }
      results[index] = await task()
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(tasks.length, 1)) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

class SharpFacade implements SharpInstance {
  private readonly pipeline: SharpPipeline

  constructor(input: string)
  constructor(pipeline: SharpPipeline)
  constructor(inputOrPipeline: string | SharpPipeline) {
    this.pipeline =
      typeof inputOrPipeline === 'string'
        ? native.create(inputOrPipeline)
        : inputOrPipeline
  }

  resize(
    width?: number | null,
    height?: number | null,
    options?: ResizeOptions
  ): SharpInstance {
    this.pipeline.resize(width ?? 0, height ?? 0, options?.fit ?? 'cover')
    return this
  }

  crop(options: {
    left: number
    top: number
    width: number
    height: number
  }): SharpInstance {
    this.pipeline.crop(options.left, options.top, options.width, options.height)
    return this
  }

  rotate(angle?: number): SharpInstance {
    if (angle === undefined) {
      this.pipeline.autorotate()
    } else {
      this.pipeline.rotate(angle)
    }
    return this
  }

  blur(sigma: number = 0.3): SharpInstance {
    this.pipeline.blur(sigma)
    return this
  }

  sharpen(sigma: number = 1): SharpInstance {
    this.pipeline.sharpen(sigma)
    return this
  }

  backgroundBlur(
    width: number,
    height: number,
    sigma: number = 20
  ): SharpInstance {
    this.pipeline.backgroundBlur(width, height, sigma)
    return this
  }

  roundCorners(radius: number): SharpInstance {
    this.pipeline.roundCorners(radius)
    return this
  }

  composite(images: CompositeOptions[]): SharpInstance {
    this.pipeline.composite(
      images.map((image) => {
        const item: {
          input: string
          left?: number
          top?: number
          gravity?: string
        } = { input: image.input }
        if (image.left != null) item.left = image.left
        if (image.top != null) item.top = image.top
        if (image.gravity != null) item.gravity = image.gravity
        return item
      })
    )
    return this
  }

  jpeg(options?: JpegOptions): SharpInstance {
    this.pipeline.jpeg(options?.quality ?? 80, options?.progressive ?? false)
    return this
  }

  png(options?: PngOptions): SharpInstance {
    this.pipeline.png(options?.compressionLevel ?? 6)
    return this
  }

  webp(options?: WebpOptions): SharpInstance {
    this.pipeline.webp(options?.quality ?? 80)
    return this
  }

  toFile(path: string): Promise<string> {
    return this.pipeline.toFile(path)
  }

  toBuffer(): Promise<ArrayBuffer> {
    return this.pipeline.toBuffer()
  }

  metadata() {
    return this.pipeline.metadata()
  }
}

function sharp(input: string): SharpInstance {
  if (!input) {
    throw new Error('sharp(input): input path/URI is required')
  }
  if (input.startsWith('http://') || input.startsWith('https://')) {
    throw new Error(
      'sharp(input): HTTP(S) URLs are not loaded synchronously — use await sharp.fromUrl(url)'
    )
  }
  return new SharpFacade(input)
}

async function fromUrl(
  url: string,
  options?: FromUrlOptions
): Promise<SharpInstance> {
  const buffer = await fetchImageBuffer(url, options)
  return new SharpFacade(native.createFromBuffer(buffer))
}

function fromBuffer(buffer: ArrayBuffer): SharpInstance {
  if (buffer == null || buffer.byteLength === 0) {
    throw new Error('sharp.fromBuffer: buffer is empty')
  }
  return new SharpFacade(native.createFromBuffer(buffer))
}

const sharpExport = Object.assign(sharp, {
  get vipsVersion() {
    return native.vipsVersion
  },
  fromUrl,
  fromBuffer,
  processMany,
}) as SharpStatic

export type {
  CompositeOptions,
  Fit,
  FromUrlOptions,
  Gravity,
  ImageMetadata,
  JpegOptions,
  PngOptions,
  ProcessManyOptions,
  ResizeOptions,
  SharpInstance,
  SharpStatic,
  WebpOptions,
} from './types'
export default sharpExport
export { sharpExport as sharp }
