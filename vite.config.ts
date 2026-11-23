import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// After a build, write dist/sw.js: a service worker that keeps every file of this build on the
// device, so the game loads with no signal and starts faster from the Home Screen. Its cache is
// named after a hash of the files, so a new build replaces the old copy.
function offline(): Plugin {
  let outDir = 'dist';
  return {
    name: 'mycelium-offline',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const path = join(dir, name);
          if (statSync(path).isDirectory()) walk(path);
          else if (name !== 'sw.js') files.push(relative(outDir, path).split('\\').join('/'));
        }
      };
      walk(outDir);
      files.sort();
      const template = readFileSync('src/sw-template.js', 'utf8');
      const hash = createHash('sha256').update(template);
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      writeFileSync(join(outDir, 'sw.js'), template
        .replace('__VERSION__', version)
        .replace('__FILES__', JSON.stringify(['./', ...files.map((f) => `./${f}`)])));
    },
  };
}

export default defineConfig({
  plugins: [react(), offline()],
  // Relative paths in the build, so the game works from any address, such as a GitHub Pages
  // project page (https://<user>.github.io/<repository>/).
  base: './',
  server: { port: 5173, strictPort: true },
});
