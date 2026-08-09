export interface FromUrlOptions {
  /** Optional request headers (e.g. Authorization) */
  headers?: Record<string, string>
}

/**
 * Fetch an HTTP(S) image as raw bytes for `createFromBuffer` / `fromUrl`.
 * Avoids base64 — bytes go straight into native libvips.
 */
export async function fetchImageBuffer(
  url: string,
  options?: FromUrlOptions
): Promise<ArrayBuffer> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('sharp.fromUrl: url must start with http:// or https://')
  }

  const response = await fetch(url, {
    headers: options?.headers,
  })
  if (!response.ok) {
    throw new Error(
      `sharp.fromUrl: HTTP ${response.status} ${response.statusText || ''}`.trim()
    )
  }

  const buf = await response.arrayBuffer()
  if (buf.byteLength === 0) {
    throw new Error('sharp.fromUrl: empty response body')
  }
  return buf
}
