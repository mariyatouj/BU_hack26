import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run dev`        -> talks to FastAPI on :8000 via the /api proxy (falls back to demo data if it's down)
// `npm run build:demo` -> one self-contained index.html with in-browser demo data (no backend needed)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:8000' },
  },
  build: mode === 'demo' ? { outDir: 'dist-demo' } : {},
}))
