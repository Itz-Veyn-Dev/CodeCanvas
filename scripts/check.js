// `npm run check`: syntax-check every JS file, then run the Node unit tests.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path');
const root = path.join(__dirname, '..');
const files = ['main.js', 'preload.js', 'storage.js', 'scripts/check.js', 'src/renderer/core.js', 'src/renderer/app.js',
  ...fs.readdirSync(path.join(root, 'test')).filter(f => f.endsWith('.js')).map(f => 'test/' + f)];
let bad = 0;
for (const f of files) { try { execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' }); console.log('ok   ' + f); } catch (e) { bad++; console.error('FAIL ' + f + '\n' + e.stderr); } }
if (bad) process.exit(1);
const tests = fs.readdirSync(path.join(root, 'test')).filter(f => f.endsWith('.test.js')).map(f => path.join(root, 'test', f));
execFileSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
