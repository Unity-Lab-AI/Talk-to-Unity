import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'create-nojekyll',
      closeBundle() {
        // Create .nojekyll file for GitHub Pages
        writeFileSync(resolve(__dirname, 'dist', '.nojekyll'), '', 'utf8')
      }
    }
  ],
  base: '/Talk-to-Unity/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
