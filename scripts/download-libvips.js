const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..', 'third_party', 'libvips')
const VERSION = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'VERSION.json'), 'utf8')
)

const ifMissing = process.argv.includes('--if-missing')

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel))
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const client = url.startsWith('https') ? https : http
    const request = (redirectUrl) => {
      client
        .get(redirectUrl, (res) => {
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume()
            request(res.headers.location)
            return
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed ${res.statusCode} for ${url}`))
            return
          }
          res.pipe(file)
          file.on('finish', () => file.close(() => resolve()))
        })
        .on('error', reject)
    }
    request(url)
  })
}

async function ensurePlatform(key) {
  const cfg = VERSION[key]
  if (!cfg || typeof cfg !== 'object' || !cfg.url) return
  if (exists(cfg.marker)) {
    console.log(`[libvips] ${key}: already present`)
    return
  }
  if (ifMissing && exists(cfg.marker)) return

  const downloads = path.join(ROOT, 'downloads')
  fs.mkdirSync(downloads, { recursive: true })
  const archive = path.join(downloads, cfg.asset)
  console.log(`[libvips] ${key}: downloading ${cfg.url}`)
  await download(cfg.url, archive)

  const extractTo = path.join(ROOT, cfg.extractTo)
  fs.mkdirSync(extractTo, { recursive: true })
  console.log(`[libvips] ${key}: extracting to ${extractTo}`)

  if (cfg.asset.endsWith('.zip')) {
    execSync(`unzip -q -o "${archive}" -d "${extractTo}"`, { stdio: 'inherit' })
  } else if (cfg.asset.endsWith('.tar.xz')) {
    execSync(`tar -xJf "${archive}" -C "${extractTo}"`, { stdio: 'inherit' })
  } else {
    throw new Error(`Unsupported archive type: ${cfg.asset}`)
  }

  if (!exists(cfg.marker)) {
    throw new Error(
      `[libvips] ${key}: extraction finished but marker missing: ${cfg.marker}`
    )
  }
  console.log(`[libvips] ${key}: ready`)
}

async function main() {
  if (ifMissing && exists(VERSION.ios.marker) && exists(VERSION.android.marker)) {
    console.log('[libvips] prebuilds present, skipping download')
    return
  }
  await ensurePlatform('ios')
  await ensurePlatform('android')
}

main().catch((err) => {
  console.error(err)
  // Do not fail install if network is unavailable; builds will error clearly later.
  if (ifMissing) {
    console.warn(
      '[libvips] download skipped/failed; run: npm run download-libvips'
    )
    process.exit(0)
  }
  process.exit(1)
})
