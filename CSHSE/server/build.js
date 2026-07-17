const esbuild = require('esbuild');
const { glob } = require('glob');
const path = require('path');
const fs = require('fs');

/**
 * Recursively copy a directory of non-TS assets (JSON fixtures, etc.) so
 * runtime code that does `path.join(__dirname, '..', 'test', 'fixtures')`
 * resolves correctly in the built `dist/` tree.
 */
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirSync(s, d);
    } else {
      fs.copyFileSync(s, d);
      count += 1;
    }
  }
  return count;
}

async function build() {
  // Find all TypeScript files
  const entryPoints = await glob('src/**/*.ts');

  await esbuild.build({
    entryPoints,
    outdir: 'dist',
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    sourcemap: true,
    bundle: false,
    // Don't bundle - just transpile
    packages: 'external',
  });

  // CR-034 — seed fixtures are non-TS assets; esbuild won't include them.
  // The runtime FIXTURE_DIR resolves to dist/test/fixtures, so mirror them.
  const fixturesCopied = copyDirSync('src/test/fixtures', 'dist/test/fixtures');
  if (fixturesCopied > 0) {
    console.log(`Copied ${fixturesCopied} test fixture(s) to dist/test/fixtures`);
  }

  // CR-011 / S11.4 — DOCX branding assets (CSHSE logo) are non-TS; mirror
  // them so docxBranding.ts (`path.join(__dirname, '..', 'assets', ...)`)
  // resolves in the built dist/ tree.
  const assetsCopied = copyDirSync('src/assets', 'dist/assets');
  if (assetsCopied > 0) {
    console.log(`Copied ${assetsCopied} asset(s) to dist/assets`);
  }

  // Level-aware standards catalog: levelStandards.ts `require`s this JSON at
  // runtime (transpile mode, not bundled), so mirror src/data/*.json into
  // dist/data so the require resolves in the built tree.
  const dataJsonCopied = (await glob('src/data/*.json')).reduce((n, srcFile) => {
    const destFile = path.join('dist', path.relative('src', srcFile));
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
    return n + 1;
  }, 0);
  if (dataJsonCopied > 0) {
    console.log(`Copied ${dataJsonCopied} data JSON file(s) to dist/data`);
  }

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
