export type Fit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

export interface ResizeOptions {
  fit?: Fit
}

export interface JpegOptions {
  quality?: number
}

export interface PngOptions {
  compressionLevel?: number
}

export interface WebpOptions {
  quality?: number
}

export interface ImageMetadata {
  width: number
  height: number
  format: string
  channels: number
  hasAlpha: boolean
  size: number
}

export interface SharpInstance {
  resize(
    width?: number | null,
    height?: number | null,
    options?: ResizeOptions
  ): SharpInstance
  crop(options: {
    left: number
    top: number
    width: number
    height: number
  }): SharpInstance
  rotate(angle?: number): SharpInstance
  blur(sigma?: number): SharpInstance
  sharpen(sigma?: number): SharpInstance
  jpeg(options?: JpegOptions): SharpInstance
  png(options?: PngOptions): SharpInstance
  webp(options?: WebpOptions): SharpInstance
  toFile(path: string): Promise<string>
  toBuffer(): Promise<ArrayBuffer>
  metadata(): Promise<ImageMetadata>
}

export interface SharpStatic {
  (input: string): SharpInstance
  vipsVersion: string
}
