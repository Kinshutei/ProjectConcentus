import { cpSync, existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const DATA_DIR = REPO_ROOT + 'data'

/**
 * データJSONはリポジトリ直下の data/ にあり web/ の外なので、そのままでは
 * dev サーバーからもビルド成果物からも見えない。
 * dev では /data/* として配信し、build では成果物へコピーする。
 * 実行時に raw.githubusercontent.com を見に行く旧DBの構成は踏襲しない。
 */
function dataPlugin(): Plugin {
  return {
    name: 'concentus-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0]
        const idx = url.indexOf('/data/')
        if (idx === -1) return next()
        const rel = url.slice(idx + 6)
        if (!/^[\w/-]+\.json$/.test(rel)) return next()
        const file = DATA_DIR + '/' + rel
        if (!existsSync(file)) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(readFileSync(file))
      })
    },
    closeBundle() {
      cpSync(DATA_DIR, REPO_ROOT + 'web/dist/data', { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [react(), dataPlugin()],
  build: { outDir: 'dist', emptyOutDir: true },
})
