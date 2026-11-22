import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:8000' },
  },
  build:
    mode === 'demo'
      ? { outDir: 'dist-demo' }
      : {
          rolldownOptions: {
            output: { codeSplitting: { groups: [{ name: 'mbta', test: /transit\.json/ }] } },
          },
        },
}))
