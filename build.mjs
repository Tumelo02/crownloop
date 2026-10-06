/**
 * Production build: `npm run build` bundles the 85 ES-module files and the stylesheet into
 * dist/ as ONE minified script + ONE minified stylesheet (about a third of the size, 3 requests
 * instead of ~90), which is what a phone on a slow connection or a tunnel needs, and what you
 * upload to CrazyGames. Development is unchanged: index.html still runs straight from src/.
 *
 *   npm run build   ->  dist/index.html, dist/game.js, dist/styles.css
 *   npm run serve   ->  serves dist/ on 0.0.0.0:8000 with gzip (open it from your phone)
 */
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const OUT = 'dist';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

// Lowered syntax so Android Chrome 84+ and iOS Safari 15+ (2021 and newer) run it.
const target = ['chrome84', 'safari15', 'firefox78', 'edge84'];

const [js, css] = await Promise.all([
  build({
    entryPoints: ['src/main.js'],
    bundle: true,
    minify: true,
    format: 'esm',
    target,
    write: false,
    legalComments: 'none',
    logLevel: 'warning',
  }),
  build({
    entryPoints: ['styles.css'],
    bundle: true,
    minify: true,
    target,
    write: false,
    logLevel: 'warning',
    // The one font URL in the stylesheet is remote: leave it alone.
    external: ['https://*'],
  }),
]);

const hash = (text) => createHash('sha1').update(text).digest('hex').slice(0, 8);
const jsText = js.outputFiles[0].text;
const cssText = css.outputFiles[0].text;
const jsName = `game.js?v=${hash(jsText)}`;
const cssName = `styles.css?v=${hash(cssText)}`;

let html = await readFile('index.html', 'utf8');
const swap = (pattern, replacement) => {
  if (!pattern.test(html)) throw new Error(`index.html: ${pattern} not found`);
  html = html.replace(pattern, replacement);
};
swap(/<script type="module" src="src\/main\.js[^"]*"><\/script>/, `<script type="module" src="${jsName}"></script>`);
swap(/<link rel="stylesheet" href="styles\.css[^"]*">/, `<link rel="stylesheet" href="${cssName}">`);

await Promise.all([
  writeFile(`${OUT}/game.js`, jsText),
  writeFile(`${OUT}/styles.css`, cssText),
  writeFile(`${OUT}/index.html`, html),
]);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`dist/game.js ${kb(jsText.length)} · dist/styles.css ${kb(cssText.length)} · dist/index.html ${kb(html.length)}`);
