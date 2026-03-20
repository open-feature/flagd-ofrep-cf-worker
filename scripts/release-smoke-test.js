const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');
const packageDir = path.join(workspaceRoot, 'packages', 'js-ofrep-worker');
const packageName = '@openfeature/flagd-ofrep-cf-worker';
const requiredBuildArtifacts = ['dist/index.js', 'dist/index.mjs', 'dist/index.d.ts'];
const requiredPackedFiles = ['package.json', 'README.md', ...requiredBuildArtifacts];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `cwd: ${options.cwd ?? workspaceRoot}`,
        '',
        'stdout:',
        result.stdout.trim(),
        '',
        'stderr:',
        result.stderr.trim(),
      ].join('\n'),
    );
  }

  return result.stdout.trim();
}

async function assertBuildArtifactsExist() {
  for (const relativePath of requiredBuildArtifacts) {
    const absolutePath = path.join(packageDir, relativePath);

    try {
      await fs.access(absolutePath);
    } catch {
      throw new Error(`Missing build artifact ${relativePath}. Run "npm run build" before the release smoke test.`);
    }
  }
}

async function writeFile(filePath, contents) {
  await fs.writeFile(filePath, contents, 'utf8');
}

async function main() {
  await assertBuildArtifactsExist();

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'release-smoke-'));

  try {
    const packDir = path.join(tempRoot, 'pack');
    await fs.mkdir(packDir, { recursive: true });

    // Validate the packed tarball rather than the workspace source tree.
    const packOutput = run('npm', ['pack', '--json', '--pack-destination', packDir], { cwd: packageDir });
    const [packResult] = JSON.parse(packOutput);
    const tarballPath = path.join(packDir, packResult.filename);
    const packedFiles = new Set((packResult.files ?? []).map((file) => file.path));

    for (const expectedFile of requiredPackedFiles) {
      assert(packedFiles.has(expectedFile), `Packed tarball is missing ${expectedFile}`);
    }

    const consumerDir = path.join(tempRoot, 'consumer');
    await fs.mkdir(consumerDir, { recursive: true });

    await writeFile(
      path.join(consumerDir, 'package.json'),
      `${JSON.stringify({ name: 'release-smoke-consumer', private: true }, null, 2)}\n`,
    );

    run('npm', ['install', '--ignore-scripts', '--no-package-lock', tarballPath], { cwd: consumerDir });

    await writeFile(
      path.join(consumerDir, 'consumer.cjs'),
      `const assert = require('node:assert/strict');
const { createOfrepHandler, FlagStore, OfrepHandler, extractAuthToken } = require('${packageName}');

const flags = {
  flags: {
    'release-smoke': {
      state: 'ENABLED',
      defaultVariant: 'on',
      variants: {
        on: true,
        off: false,
      },
    },
  },
};

async function main() {
  const store = new FlagStore(flags);
  assert.equal(store.hasFlag('release-smoke'), true);

  const handler = createOfrepHandler({ staticFlags: flags, cors: false });
  const response = await handler(
    new Request('https://example.test/ofrep/v1/evaluate/flags/release-smoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.key, 'release-smoke');
  assert.equal(body.value, true);
  assert.equal(typeof OfrepHandler, 'function');
  assert.equal(
    extractAuthToken(new Request('https://example.test', { headers: { authorization: 'Bearer token' } })),
    'token',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
`,
    );

    await writeFile(
      path.join(consumerDir, 'consumer.mjs'),
      `import assert from 'node:assert/strict';
import { createOfrepHandler, FlagStore, OfrepHandler, extractAuthToken } from '${packageName}';

const flags = {
  flags: {
    'release-smoke': {
      state: 'ENABLED',
      defaultVariant: 'on',
      variants: {
        on: true,
        off: false,
      },
    },
  },
};

const store = new FlagStore(flags);
assert.equal(store.hasFlag('release-smoke'), true);

const handler = createOfrepHandler({ staticFlags: flags, cors: false });
const response = await handler(
  new Request('https://example.test/ofrep/v1/evaluate/flags/release-smoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }),
);
const body = await response.json();

assert.equal(response.status, 200);
assert.equal(body.key, 'release-smoke');
assert.equal(body.value, true);
assert.equal(typeof OfrepHandler, 'function');
assert.equal(extractAuthToken(new Request('https://example.test', { headers: { 'x-api-key': 'key' } })), 'key');
`,
    );

    await writeFile(
      path.join(consumerDir, 'consumer.ts'),
      `import { createOfrepHandler, type JsonValue, type OfrepHandlerOptions } from '${packageName}';

const options = {
  staticFlags: '{"flags":{"release-smoke":{"state":"ENABLED","defaultVariant":"on","variants":{"on":true,"off":false}}}}',
  cors: false,
} satisfies OfrepHandlerOptions;

const handler = createOfrepHandler(options);
const responsePromise: Promise<Response> = handler(
  new Request('https://example.test/ofrep/v1/evaluate/flags/release-smoke', {
    method: 'POST',
    body: '{}',
  }),
);
const sampleValue: JsonValue = { enabled: true };

void responsePromise;
void sampleValue;
`,
    );

    await writeFile(
      path.join(consumerDir, 'tsconfig.json'),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            noEmit: true,
            lib: ['ES2022', 'DOM'],
          },
          include: ['consumer.ts'],
        },
        null,
        2,
      )}\n`,
    );

    run(process.execPath, [path.join(consumerDir, 'consumer.cjs')], { cwd: consumerDir });
    run(process.execPath, [path.join(consumerDir, 'consumer.mjs')], { cwd: consumerDir });
    run(
      process.execPath,
      [
        path.join(workspaceRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
        '--project',
        path.join(consumerDir, 'tsconfig.json'),
      ],
      {
        cwd: consumerDir,
      },
    );

    console.log(`Release smoke test passed for ${packResult.filename}`);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
