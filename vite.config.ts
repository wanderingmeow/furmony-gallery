import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  // GitHub Pages serves at https://<user>.github.io/furmony-gallery/ (sub-path)
  base: '/furmony-gallery',
})
