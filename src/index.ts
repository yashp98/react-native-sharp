import { NitroModules } from 'react-native-nitro-modules'
import type { SharpModule, SharpPipeline } from './specs/Sharp.nitro'
import type {
  JpegOptions,
  PngOptions,
  ResizeOptions,
  SharpInstance,
  SharpStatic,
  WebpOptions,
} from './types'

const native = NitroModules.createHybridObject<SharpModule>('SharpModule')

class SharpFacade implements SharpInstance {
  private readonly pipeline: SharpPipeline

  constructor(input: string) {
    this.pipeline = native.create(input)
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

  rotate(angle: number = 90): SharpInstance {
    this.pipeline.rotate(angle)
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

  jpeg(options?: JpegOptions): SharpInstance {
    this.pipeline.jpeg(options?.quality ?? 80)
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
  return new SharpFacade(input)
}

const sharpExport = Object.assign(sharp, {
  get vipsVersion() {
    return native.vipsVersion
  },
}) as SharpStatic

export type {
  Fit,
  ImageMetadata,
  JpegOptions,
  PngOptions,
  ResizeOptions,
  SharpInstance,
  SharpStatic,
  WebpOptions,
} from './types'
export default sharpExport
export { sharpExport as sharp }
