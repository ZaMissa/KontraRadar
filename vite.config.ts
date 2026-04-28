import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readPkgVersion(): string {
  const raw = readFileSync(resolve(__dirname, 'package.json'), 'utf8')
  const p = JSON.parse(raw) as { version?: string }
  return p.version || '0.0.0'
}

function shortSha(): string {
  const fromEnv = process.env.GITHUB_SHA?.slice(0, 7)
  if (fromEnv) return fromEnv
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

const appVersion = readPkgVersion()
const appCommit = shortSha()
const appBuiltAt = new Date().toISOString()

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/KontraRadar/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT__: JSON.stringify(appCommit),
    __APP_BUILT_AT__: JSON.stringify(appBuiltAt),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
