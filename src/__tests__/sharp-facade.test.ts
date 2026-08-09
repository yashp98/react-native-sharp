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
  autorotate: () => {
    calls.push({ method: 'autorotate', args: [] })
  },
  blur: (sigma: number) => {
    calls.push({ method: 'blur', args: [sigma] })
  },
  sharpen: (sigma: number) => {
    calls.push({ method: 'sharpen', args: [sigma] })
  },
  backgroundBlur: (width: number, height: number, sigma: number) => {
    calls.push({ method: 'backgroundBlur', args: [width, height, sigma] })
  },
  roundCorners: (radius: number) => {
    calls.push({ method: 'roundCorners', args: [radius] })
  },
  composite: (images: unknown[]) => {
    calls.push({ method: 'composite', args: [images] })
  },
  jpeg: (quality: number, progressive: boolean) => {
    calls.push({ method: 'jpeg', args: [quality, progressive] })
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
  create: jest.fn((_input?: string) => mockPipeline),
  createFromBuffer: jest.fn((_buffer?: ArrayBuffer) => mockPipeline),
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
  mockNative.createFromBuffer.mockClear()
  mockNative.create.mockImplementation(() => mockPipeline)
  mockNative.createFromBuffer.mockImplementation(() => mockPipeline)
})

describe('sharp(input)', () => {
  it('rejects empty input', () => {
    expect(() => sharp('')).toThrow('sharp(input): input path/URI is required')
  })

  it('rejects bare HTTP(S) URLs with a fromUrl hint', () => {
    expect(() => sharp('https://example.com/a.jpg')).toThrow('sharp.fromUrl')
    expect(() => sharp('http://example.com/a.jpg')).toThrow('sharp.fromUrl')
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

describe('sharp.fromUrl', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches bytes and creates a pipeline via createFromBuffer', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'image/png' },
      arrayBuffer: async () =>
        png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
    })) as unknown as typeof fetch

    const pipeline = await sharp.fromUrl('https://cdn.example/photo.png')
    expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.example/photo.png', {
      headers: undefined,
    })
    expect(mockNative.createFromBuffer).toHaveBeenCalled()
    const buf = mockNative.createFromBuffer.mock.calls[0]?.[0] as unknown
    expect(buf).toBeInstanceOf(ArrayBuffer)
    expect((buf as ArrayBuffer).byteLength).toBe(8)
    expect(mockNative.create).not.toHaveBeenCalled()
    await expect(pipeline.metadata()).resolves.toMatchObject({
      width: 10,
      height: 20,
    })
  })

  it('forwards headers and throws on non-OK responses', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: { get: () => null },
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch

    await expect(
      sharp.fromUrl('https://cdn.example/secret.jpg', {
        headers: { Authorization: 'Bearer x' },
      })
    ).rejects.toThrow('HTTP 403')
    expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.example/secret.jpg', {
      headers: { Authorization: 'Bearer x' },
    })
  })

  it('rejects non-HTTP URLs', async () => {
    await expect(sharp.fromUrl('/tmp/in.jpg')).rejects.toThrow(
      'must start with http:// or https://'
    )
  })
})

describe('sharp.fromBuffer', () => {
  it('creates a pipeline from raw bytes', () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    sharp.fromBuffer(bytes)
    expect(mockNative.createFromBuffer).toHaveBeenCalledWith(bytes)
    expect(mockNative.create).not.toHaveBeenCalled()
  })

  it('rejects empty buffers', () => {
    expect(() => sharp.fromBuffer(new ArrayBuffer(0))).toThrow('buffer is empty')
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
    expect(calls[4]?.args).toEqual([70, false])
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

  it('autorotates when rotate() has no angle', () => {
    sharp('/tmp/in.jpg').rotate().blur().sharpen()
    expect(calls.map((c) => c.method)).toEqual([
      'autorotate',
      'blur',
      'sharpen',
    ])
    expect(calls.map((c) => c.args)).toEqual([[], [0.3], [1]])
  })

  it('applies jpeg / png / webp option defaults', () => {
    sharp('/tmp/in.jpg').jpeg().png().webp()
    expect(calls.map((c) => c.args)).toEqual([
      [80, false],
      [6],
      [80],
    ])
  })

  it('forwards progressive jpeg and composite overlays', () => {
    sharp('/tmp/in.jpg')
      .composite([
        { input: '/tmp/mark.png', gravity: 'southeast' },
        { input: '/tmp/badge.png', left: 10, top: 20 },
      ])
      .jpeg({ quality: 55, progressive: true })
      .png({ compressionLevel: 9 })
      .webp({ quality: 40 })

    expect(calls.map((c) => c.method)).toEqual([
      'composite',
      'jpeg',
      'png',
      'webp',
    ])
    expect(calls[0]?.args).toEqual([
      [
        { input: '/tmp/mark.png', gravity: 'southeast' },
        { input: '/tmp/badge.png', left: 10, top: 20 },
      ],
    ])
    expect(calls[1]?.args).toEqual([55, true])
    expect(calls[2]?.args).toEqual([9])
    expect(calls[3]?.args).toEqual([40])
  })

  it('forwards backgroundBlur and roundCorners', () => {
    sharp('/tmp/in.jpg')
      .backgroundBlur(1080, 1920)
      .roundCorners(48)
      .png()

    expect(calls.map((c) => c.method)).toEqual([
      'backgroundBlur',
      'roundCorners',
      'png',
    ])
    expect(calls[0]?.args).toEqual([1080, 1920, 20])
    expect(calls[1]?.args).toEqual([48])
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

describe('sharp.processMany', () => {
  it('runs tasks and preserves result order', async () => {
    const results = await sharp.processMany(
      [
        async () => {
          await new Promise((r) => setTimeout(r, 20))
          return 'a'
        },
        async () => 'b',
        async () => 'c',
      ],
      { concurrency: 2 }
    )
    expect(results).toEqual(['a', 'b', 'c'])
  })

  it('returns an empty array for no tasks', async () => {
    await expect(sharp.processMany([])).resolves.toEqual([])
  })
})
