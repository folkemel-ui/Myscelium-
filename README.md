# Mycelium

A mushroom spreading through a forest: grow your mycelium, fight off beetles, and watch the forest
turn from grey to glowing colour. A 2D top-down game for the browser, made with React, PixiJS,
TypeScript and Vite.

## Play

Once published, the game is at `https://<your-github-name>.github.io/<repository>/`. It also works
in Safari on an iPhone (touch controls are not tuned yet).

## Run it on your own computer

```
npm install
npm run dev
```

Then open http://localhost:5173. To play from a phone on the same Wi-Fi, use `npm run dev -- --host`
and open the "Network" address it prints.

## Publish

Every push to `main` on GitHub runs the tests, builds the game and puts it on GitHub Pages
(`.github/workflows/deploy.yml`). In the repository's settings, under Pages, the source must be
"GitHub Actions".

## More

- `IDEAS.md` – what has been built, pack by pack, and what comes next.
- `wisdom.md` – how the project works and what tripped us up.
- `npm test` runs the tests; `npm run build` makes the files to publish in `dist/`.
