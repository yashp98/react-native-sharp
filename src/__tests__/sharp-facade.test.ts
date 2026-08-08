/**
 * Unit tests for the public sharp() facade.
 * Nitro HybridObjects are mocked so CI can run without a device / libvips.
 */

type Call = { method: string; args: unknown[] }

const calls: Call[] = []

const mockPipeline = {
  resize: (width: number, height: number, fit: string) => {
    calls.push({ method: 'resize', args: [width, height, fit] })
  },
  crop: (left: number, top: number, width: number, height: number) => {
    calls.push({ method: 'crop', args: [left, top, width, height] })
  },
  rotate: (angle: number) => {
    calls.push({ method: 'rotate', args: [angle] })
  },
  blur: (sigma: number) => {
    calls.push({ method: 'blur', args: [sigma] })
  },
  sharpen: (sigma: number) => {
    calls.push({ method: 'sharpen', args: [sigma] })
  },
  jpeg: (quality: number) => {
    calls.push({ method: 'jpeg', args: [quality] })
  },
  png: (level: number) => {
    calls.push({ method: 'png', args: [level] })
  },
  webp: (quality: number) => {
    calls.push({ method: 'webp', args: [quality] })
  },
  toFile: async (path: string) => {
    calls.push({ method: 'toFile', args: [path] })
    return path
  },
  toBuffer: async () => {
    calls.push({ method: 'toBuffer', args: [] })
    return new ArrayBuffer(8)
  },
  metadata: async () => {
    calls.push({ method: 'metadata', args: [] })
    return {
      width: 10,
      height: 20,
      format: 'jpeg',
      channels: 3,
      hasAlpha: false,
      size: 100,
    }
  },
}

const mockNative = {
  vipsVersion: '8.17.2',
  create: jest.fn(() => mockPipeline),
}

jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(() => mockNative),
  },
}))

import sharp, { sharp as namedSharp } from '../index'

beforeEach(() => {
  calls.length = 0
  mockNative.create.mockClear()
  mockNative.create.mockImplementation(() => mockPipeline)
})

describe('sharp(input)', () => {
  it('rejects empty input', () => {
    expect(() => sharp('')).toThrow('sharp(input): input path/URI is required')
  })

  it('creates a native pipeline with the given input', () => {
    sharp('/tmp/in.jpg')
    expect(mockNative.create).toHaveBeenCalledWith('/tmp/in.jpg')
  })

  it('exposes vipsVersion from the native module', () => {
    expect(sharp.vipsVersion).toBe('8.17.2')
  })

  it('exports the same function as default and named sharp', () => {
    expect(namedSharp).toBe(sharp)
  })
})

describe('sharp facade op queue', () => {
  it('chains ops and preserves call order', async () => {
    const out = await sharp('/tmp/in.jpg')
      .resize(800, 600, { fit: 'contain' })
      .rotate(90)
      .blur(2)
      .sharpen()
      .jpeg({ quality: 70 })
      .toFile('/tmp/out.jpg')

    expect(out).toBe('/tmp/out.jpg')
    expect(calls.map((c) => c.method)).toEqual([
      'resize',
      'rotate',
      'blur',
      'sharpen',
      'jpeg',
      'toFile',
    ])
    expect(calls[0]?.args).toEqual([800, 600, 'contain'])
    expect(calls[4]?.args).toEqual([70])
    expect(calls[5]?.args).toEqual(['/tmp/out.jpg'])
  })

  it('defaults resize fit to cover and missing height to 0', () => {
    sharp('/tmp/in.jpg').resize(100)
    expect(calls[0]?.args).toEqual([100, 0, 'cover'])
  })

  it('maps null resize dimensions to 0', () => {
    sharp('/tmp/in.jpg').resize(null, null)
    expect(calls[0]?.args).toEqual([0, 0, 'cover'])
  })

  it('forwards crop rectangles', () => {
    sharp('/tmp/in.jpg').crop({ left: 1, top: 2, width: 3, height: 4 })
    expect(calls[0]?.args).toEqual([1, 2, 3, 4])
  })

  it('applies rotate / blur / sharpen defaults', () => {
    sharp('/tmp/in.jpg').rotate().blur().sharpen()
    expect(calls.map((c) => c.args)).toEqual([[90], [0.3], [1]])
  })

  it('applies jpeg / png / webp option defaults', () => {
    sharp('/tmp/in.jpg').jpeg().png().webp()
    expect(calls.map((c) => c.args)).toEqual([[80], [6], [80]])
  })

  it('forwards explicit encoder options', () => {
    sharp('/tmp/in.jpg')
      .jpeg({ quality: 55 })
      .png({ compressionLevel: 9 })
      .webp({ quality: 40 })
    expect(calls.map((c) => c.args)).toEqual([[55], [9], [40]])
  })

  it('returns ArrayBuffer from toBuffer()', async () => {
    const buf = await sharp('/tmp/in.jpg').toBuffer()
    expect(buf).toBeInstanceOf(ArrayBuffer)
    expect(buf.byteLength).toBe(8)
    expect(calls.map((c) => c.method)).toEqual(['toBuffer'])
  })

  it('returns metadata from metadata()', async () => {
    const meta = await sharp('/tmp/in.jpg').metadata()
    expect(meta).toEqual({
      width: 10,
      height: 20,
      format: 'jpeg',
      channels: 3,
      hasAlpha: false,
      size: 100,
    })
  })

  it('supports the README quick-start pipeline shape', async () => {
    await sharp('file:///photo.jpg')
      .resize(800, 600, { fit: 'cover' })
      .rotate(90)
      .blur(3)
      .sharpen()
      .jpeg({ quality: 80 })
      .toFile('/tmp/out.jpg')

    const buf = await sharp('data:image/png;base64,aaa')
      .webp({ quality: 75 })
      .toBuffer()

    expect(buf.byteLength).toBe(8)
    expect(mockNative.create).toHaveBeenCalledWith('file:///photo.jpg')
    expect(mockNative.create).toHaveBeenCalledWith('data:image/png;base64,aaa')
  })
})
