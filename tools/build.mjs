// Builds index.html from src/: vendor bundles + styles + the app compiled once with esbuild.
// Usage: node tools/build.mjs          (writes index.html)
//        node tools/build.mjs --check  (exit 1 if index.html is stale)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const result = await build({
  entryPoints: [join(root, 'src/app/main.jsx')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  minify: false,
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'warning',
});
const app = result.outputFiles[0].text;

const html = [
  read('src/head.html').replace(/\n$/, ''),
  '<script>/* React 18 (inlined) */',
  read('src/vendor/react.js').replace(/\n$/, ''),
  '</script>',
  '<script>/* ReactDOM 18 (inlined) */',
  read('src/vendor/react-dom.js').replace(/\n$/, ''),
  '</script>',
  '<script>window.react = window.React; window.PropTypes = new Proxy({}, { get: () => () => {} });</script>',
  '<script>/* lucide-react (inlined) */',
  read('src/vendor/lucide-react.js').replace(/\n$/, ''),
  '</script>',
  '<style>',
  read('src/styles.css').replace(/\n$/, ''),
  '</style>',
  '</head>',
  '<body>',
  '<div id="root"></div>',
  '<script>/* Protocol OS app — compiled from src/app by tools/build.mjs; edit the source, not this file */',
  app.replace(/\n$/, ''),
  '</script>',
  '</body>',
  '</html>',
  '',
].join('\n');

const out = join(root, 'index.html');
if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== html) { console.error('index.html is stale: run `npm run build` and commit the result'); process.exit(1); }
  console.log('index.html is up to date');
} else {
  writeFileSync(out, html);
  console.log(`wrote index.html (${(html.length / 1024).toFixed(0)} KB, app ${(app.length / 1024).toFixed(0)} KB)`);
}
