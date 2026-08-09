import type { HybridObject } from 'react-native-nitro-modules'

export interface ImageMetadata {
  width: number
  height: number
  format: string
  channels: number
  hasAlpha: boolean
  size: number
}

/**
 * Overlay for `composite`. Path / `file://` / base64 data URI.
 * Prefer `left`+`top`, or `gravity` (default `centre` when neither is set).
 */
export interface CompositeImage {
  input: string
  left?: number
  top?: number
  gravity?: string
}

/**
 * Native pipeline that queues libvips operations and executes on toFile/toBuffer.
 * Constructed via SharpModule.create(inputPath).
 */
export interface SharpPipeline
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  resize(width: number, height: number, fit: string): void
  crop(left: number, top: number, width: number, height: number): void
  rotate(angle: number): void
  /** Apply EXIF orientation and clear the orientation tag. */
  autorotate(): void
  blur(sigma: number): void
  sharpen(sigma: number): void
  /**
   * Fill width×height with a blurred cover of the image, then place a sharp
   * contain-fitted copy on top (story / reel letterboxing).
   */
  backgroundBlur(width: number, height: number, sigma: number): void
  /** Punch a rounded-rectangle mask into the alpha channel. */
  roundCorners(radius: number): void
  composite(images: CompositeImage[]): void
  jpeg(quality: number, progressive: boolean): void
  png(compressionLevel: number): void
  webp(quality: number): void
  toFile(path: string): Promise<string>
  toBuffer(): Promise<ArrayBuffer>
  metadata(): Promise<ImageMetadata>
}

/**
 * Entry HybridObject registered with Nitro.
 */
export interface SharpModule
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  /** libvips version string after successful vips_init */
  readonly vipsVersion: string
  create(inputPath: string): SharpPipeline
}
