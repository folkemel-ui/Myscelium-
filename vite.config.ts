import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths in the build, so the game works from any address, such as a GitHub Pages
  // project page (https://<user>.github.io/<repository>/).
  base: './',
  server: { port: 5173, strictPort: true },
});
