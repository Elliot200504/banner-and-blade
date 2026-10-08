import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /banner-and-blade/.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/banner-and-blade/' : '/',
}))
