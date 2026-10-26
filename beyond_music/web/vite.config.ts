import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// The app's version comes from the Home Assistant app's own config, so the two never disagree.
const version = /version: "([^"]+)"/.exec(readFileSync(new URL('../config.yaml', import.meta.url), 'utf8'))?.[1] ?? '0.0.0'

// Home Assistant serves the app under its own ingress address, so every path in the build is relative.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 600,
  },
})
