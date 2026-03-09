/**
 * Patch the submodule's @openfeature/flagd-core package.json to add
 * main/types fields pointing at the TypeScript source.
 *
 * The upstream js-sdk-contrib repo uses nx for builds and doesn't include
 * these fields. Our workspace needs them so tsup can resolve the package
 * for bundling and declaration generation.
 *
 * This runs as a postinstall script and is idempotent.
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'contrib', 'js-sdk-contrib', 'libs', 'shared', 'flagd-core', 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.log('flagd-core submodule not initialized, skipping patch');
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

let changed = false;

if (pkg.main !== './src/index.ts') {
  pkg.main = './src/index.ts';
  changed = true;
}

if (pkg.types !== './src/index.ts') {
  pkg.types = './src/index.ts';
  changed = true;
}

if (changed) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('Patched flagd-core package.json with main/types fields');
} else {
  console.log('flagd-core package.json already patched');
}
