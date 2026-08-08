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
 * Native pipeline that queues libvips operations and executes on toFile/toBuffer.
 * Constructed via SharpModule.create(inputPath).
 */
export interface SharpPipeline
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  resize(width: number, height: number, fit: string): void
  crop(left: number, top: number, width: number, height: number): void
  rotate(angle: number): void
  blur(sigma: number): void
  sharpen(sigma: number): void
  jpeg(quality: number): void
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
