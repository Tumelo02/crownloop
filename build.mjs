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

// `node build.mjs gd` builds the GameDistribution version into dist-gd/ (its SDK instead of
// CrazyGames'); plain `node build.mjs` is the CrazyGames build in dist/.
const GD = process.argv[2] === 'gd';
const OUT = GD ? 'dist-gd' : 'dist';
const GD_GAME_ID = '27f0b6a651fa4d2487940b39194abb78'; // same as src/platform/GameDistributionPlatform.js
// GameDistribution's snippet: options first, then the SDK, loading with the page (never on a click).
const GD_SNIPPET = `<script>
    window.GD_OPTIONS = {
      gameId: '${GD_GAME_ID}',
      onEvent: function (event) {
        (window.__gdEvents = window.__gdEvents || []).push(event);
        if (window.__gdListener) window.__gdListener(event);
      },
    };
    (function (d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = 'https://html5.api.gamedistribution.com/main.min.js';
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'gamedistribution-jssdk'));
  </script>`;
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
if (GD) swap(/<script defer src="https:\/\/sdk\.crazygames\.com\/crazygames-sdk-v3\.js"><\/script>/, GD_SNIPPET);

await Promise.all([
  writeFile(`${OUT}/game.js`, jsText),
  writeFile(`${OUT}/styles.css`, cssText),
  writeFile(`${OUT}/index.html`, html),
]);

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`${OUT}/game.js ${kb(jsText.length)} · ${OUT}/styles.css ${kb(cssText.length)} · ${OUT}/index.html ${kb(html.length)}`);
