export type Fit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

export type Gravity =
  | 'centre'
  | 'center'
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest'

export interface ResizeOptions {
  fit?: Fit
}

export interface JpegOptions {
  quality?: number
  /** Progressive / interlaced JPEG (default `false`) */
  progressive?: boolean
}

export interface PngOptions {
  compressionLevel?: number
}

export interface WebpOptions {
  quality?: number
}

export interface CompositeOptions {
  input: string
  left?: number
  top?: number
  gravity?: Gravity | string
}

export interface ImageMetadata {
  width: number
  height: number
  format: string
  channels: number
  hasAlpha: boolean
  size: number
}

export interface ProcessManyOptions {
  /** Max concurrent pipelines (default `4`) */
  concurrency?: number
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
  /**
   * Rotate by degrees. With no argument, applies EXIF orientation
   * (`autorotate`) — same idea as Node sharp.
   */
  rotate(angle?: number): SharpInstance
  blur(sigma?: number): SharpInstance
  sharpen(sigma?: number): SharpInstance
  /**
   * Canvas filled with a blurred cover of the image, sharp contain overlay on top.
   * @param sigma Gaussian blur for the background (default `20`)
   */
  backgroundBlur(
    width: number,
    height: number,
    sigma?: number
  ): SharpInstance
  /**
   * Apply a rounded-rectangle alpha mask (use PNG/WebP to keep transparency).
   * Radius is clamped to half the shorter side (circle when equal).
   */
  roundCorners(radius: number): SharpInstance
  /** Overlay one or more images (watermark / stamp). */
  composite(images: CompositeOptions[]): SharpInstance
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
  /**
   * Run many pipeline tasks with limited concurrency.
   * @example
   * await sharp.processMany(
   *   uris.map((uri) => () =>
   *     sharp(uri).resize(800).jpeg({ progressive: true }).toFile(out(uri))
   *   )
   * )
   */
  processMany<T>(
    tasks: Array<() => Promise<T>>,
    options?: ProcessManyOptions
  ): Promise<T[]>
}
