import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // relative paths so the same build works from a sub-path (GitHub Pages),
  // from the bundled CLI server, or straight off the file system
  base: './',
  plugins: [react()],
})
