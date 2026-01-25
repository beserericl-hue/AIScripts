const esbuild = require('esbuild');
const { glob } = require('glob');
const path = require('path');

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

  console.log('Build complete!');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
