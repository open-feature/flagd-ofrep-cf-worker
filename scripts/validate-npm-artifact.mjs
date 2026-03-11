import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageDir = join(repoRoot, 'packages', 'js-ofrep-worker');
const workspaceSelector = 'packages/js-ofrep-worker';
const packageName = '@openfeature/flagd-ofrep-cf-worker';

async function run(command, args, cwd) {
  try {
    return await execFileAsync(command, args, {
      cwd,
      env: {
        ...process.env,
        npm_config_audit: 'false',
        npm_config_fund: 'false',
      },
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    const details = [`Command failed: ${command} ${args.join(' ')}`, error.stdout?.trim(), error.stderr?.trim()]
      .filter(Boolean)
      .join('\n\n');

    throw new Error(details, { cause: error });
  }
}

function assertPackedFiles(files) {
  const filePaths = files.map((file) => file.path);
  const expectedFiles = ['README.md', 'dist/index.d.ts', 'dist/index.js', 'dist/index.mjs', 'package.json'];

  for (const filePath of expectedFiles) {
    assert(filePaths.includes(filePath), `Packed artifact is missing ${filePath}`);
  }

  const unexpectedSourceFiles = filePaths.filter(
    (filePath) => filePath.startsWith('src/') || filePath.startsWith('test/'),
  );

  assert.equal(
    unexpectedSourceFiles.length,
    0,
    `Packed artifact should not include source or test files: ${unexpectedSourceFiles.join(', ')}`,
  );
}

function consumerCheckSource(moduleSyntax) {
  return `
const flags = {
  flags: {
    feature: {
      state: 'ENABLED',
      defaultVariant: 'on',
      variants: {
        on: true,
        off: false
      }
    }
  }
};

${moduleSyntax}

if (typeof createOfrepHandler !== 'function') {
  throw new Error('Expected createOfrepHandler export');
}

if (typeof FlagStore !== 'function') {
  throw new Error('Expected FlagStore export');
}

const handler = createOfrepHandler({ staticFlags: flags });
if (typeof handler !== 'function') {
  throw new Error('Expected createOfrepHandler to return a fetch handler');
}

const store = new FlagStore(flags);
const evaluation = store.resolveBooleanValue('feature', false, { targetingKey: 'artifact-test-user' });

if (evaluation.value !== true) {
  throw new Error(\`Expected packaged FlagStore to evaluate the flag to true, got \${evaluation.value}\`);
}

console.log('Artifact import check passed');
`.trimStart();
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), 'flagd-ofrep-artifact-'));
  const packDir = join(tempRoot, 'pack');
  const consumerDir = join(tempRoot, 'consumer');

  await mkdir(packDir, { recursive: true });
  await mkdir(consumerDir, { recursive: true });

  try {
    console.log('Building workspace package before packing...');
    await run('npm', ['run', 'build', `--workspace=${workspaceSelector}`], repoRoot);

    console.log('Packing npm artifact...');
    const { stdout } = await run('npm', ['pack', '--json', '--pack-destination', packDir], packageDir);
    const [artifact] = JSON.parse(stdout);

    assert(artifact?.filename, 'npm pack did not produce an artifact filename');
    assert(Array.isArray(artifact.files), 'npm pack did not report packaged files');
    assertPackedFiles(artifact.files);

    const artifactPath = join(packDir, artifact.filename);

    console.log('Installing packed artifact into a clean consumer...');
    await writeFile(
      join(consumerDir, 'package.json'),
      `${JSON.stringify({ name: 'artifact-consumer', private: true, type: 'module' }, null, 2)}\n`,
    );
    await run('npm', ['install', '--no-audit', '--no-fund', artifactPath], consumerDir);

    console.log('Verifying ESM import path...');
    await writeFile(
      join(consumerDir, 'esm-check.mjs'),
      consumerCheckSource(`import { createOfrepHandler, FlagStore } from '${packageName}';`),
    );
    await run('node', ['esm-check.mjs'], consumerDir);

    console.log('Verifying CommonJS require path...');
    await writeFile(
      join(consumerDir, 'cjs-check.cjs'),
      consumerCheckSource(`const { createOfrepHandler, FlagStore } = require('${packageName}');`),
    );
    await run('node', ['cjs-check.cjs'], consumerDir);

    console.log(`Validated npm artifact ${artifact.filename}`);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
}

await main();
