import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  // GitHub Pages serves at https://<user>.github.io/furmony-gallery/ (sub-path)
  base: '/furmony-gallery',
})
