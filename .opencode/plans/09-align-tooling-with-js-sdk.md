# Plan 09: Align Build/Test Tooling with js-sdk & js-sdk-contrib

## Goal

Update this repo's developer tooling to match the patterns used in `open-feature/js-sdk` and `open-feature/js-sdk-contrib`. Both repos share the same core choices: Jest + ts-jest for testing, ESLint + @typescript-eslint for linting, Prettier for formatting, and GitHub Actions for CI.

## Decisions

- **Build:** Keep tsup (uses esbuild under the hood, same engine as js-sdk). Add a note in README about potentially switching to direct esbuild + rollup-plugin-dts for type bundling (js-sdk pattern) in the future.
- **Node:** Switch from Node 25 to Node 24 (latest LTS as of Feb 2026).
- **Release:** Defer release-please setup to a later phase.

---

## Changes

### 1. Node Version (`.nvmrc` + `package.json`)

- `.nvmrc`: Change `25` → `24`
- `package.json` engines: Change `>=25.0.0` → `>=24.0.0`
- `@types/node` devDependency: Change `^25.0.10` → `^24.0.0`

### 2. Jest + ts-jest Testing

**New devDependencies (root `package.json`):**
- `jest` ^29.7.0
- `ts-jest` ^29.4.0
- `@types/jest` ^29.5.0

**New files:**

`jest.config.ts` (root):
```ts
import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'js-ofrep-worker',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/js-ofrep-worker/test/**/*.spec.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: 'packages/js-ofrep-worker/tsconfig.spec.json' }],
      },
      moduleFileExtensions: ['ts', 'js', 'json'],
      coverageDirectory: '<rootDir>/coverage/packages/js-ofrep-worker',
    },
  ],
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
};

export default config;
```

`packages/js-ofrep-worker/tsconfig.spec.json` (new):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["jest", "node", "@cloudflare/workers-types"],
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src/**/*", "test/**/*"]
}
```

**Test directory:** `packages/js-ofrep-worker/test/`

Initial test files to create:
- `test/flag-store.spec.ts` — Tests for FlagStore class (resolveValue, resolveBooleanValue, resolveStringValue, resolveNumberValue, resolveObjectValue, hasFlag, getFlagKeys, disabled flags, missing flags)
- `test/ofrep-handler.spec.ts` — Tests for OfrepHandler (single eval, bulk eval, CORS, routing, error handling, JSON parse errors, flag not found)
- `test/types.spec.ts` — Tests for toEvaluationContext helper

**Update `packages/js-ofrep-worker/package.json`:**
```json
"test": "jest --selectProjects=js-ofrep-worker"
```

**Update root `package.json`:**
```json
"test": "jest"
```

### 3. ESLint Configuration

**New devDependencies (root `package.json`):**
- `eslint` ^8.57.0
- `@typescript-eslint/parser` ^8.0.0
- `@typescript-eslint/eslint-plugin` ^8.0.0
- `eslint-config-prettier` ^10.0.0
- `eslint-plugin-prettier` ^5.0.0

**New file:** `.eslintrc.json` (root)
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  "rules": {
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { "prefer": "type-imports", "fixStyle": "separate-type-imports" }
    ],
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
    ],
    "linebreak-style": ["error", "unix"],
    "quotes": ["error", "single", { "avoidEscape": true }],
    "semi": ["error", "always"]
  },
  "ignorePatterns": ["dist/", "node_modules/", "coverage/", "contrib/", "*.js", "*.mjs"]
}
```

**Update `packages/js-ofrep-worker/package.json`:**
```json
"lint": "eslint src test --ext .ts"
```

### 4. Prettier Configuration

**New devDependency (root `package.json`):**
- `prettier` ^3.7.0

**New file:** `.prettierrc` (root)
```json
{
  "singleQuote": true,
  "printWidth": 120
}
```

**New file:** `.prettierignore`
```
dist/
coverage/
node_modules/
package-lock.json
contrib/
*.log
```

**New root scripts:**
```json
"format": "prettier --check .",
"format:fix": "prettier --write ."
```

### 5. Husky + lint-staged

**New devDependencies (root `package.json`):**
- `husky` ^9.1.0
- `lint-staged` ^16.0.0

**New root script:**
```json
"prepare": "husky || true"
```

**New file:** `.husky/pre-commit`
```bash
npx lint-staged
```

**New file:** `.lintstagedrc.json`
```json
{
  "*.{ts,js,json,md}": "prettier --write --ignore-unknown"
}
```

### 6. EditorConfig

**New file:** `.editorconfig`
```ini
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```

### 7. GitHub Actions CI

**New file:** `.github/workflows/ci.yml`
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22.x, 24.x]
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test

  lint-format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: actions/setup-node@v4
        with:
          node-version: 24.x
          cache: npm
      - run: npm ci
      - run: npm run format
      - run: npm run lint
```

### 8. README Update

Add note about potentially switching to direct esbuild + rollup-plugin-dts in the future. Update the Development section with new test/lint/format commands.

### 9. Remove `dist/` from git tracking

`packages/js-ofrep-worker/dist/` is currently committed but `.gitignore` already ignores `dist/`. Remove it from tracking with `git rm -r --cached`.

---

## File Summary

| Action | File |
|--------|------|
| Modify | `.nvmrc` |
| Modify | `package.json` (root — engines, scripts, devDependencies) |
| Modify | `packages/js-ofrep-worker/package.json` (scripts) |
| Modify | `README.md` (development section) |
| Create | `jest.config.ts` |
| Create | `packages/js-ofrep-worker/tsconfig.spec.json` |
| Create | `packages/js-ofrep-worker/test/flag-store.spec.ts` |
| Create | `packages/js-ofrep-worker/test/ofrep-handler.spec.ts` |
| Create | `packages/js-ofrep-worker/test/types.spec.ts` |
| Create | `.eslintrc.json` |
| Create | `.prettierrc` |
| Create | `.prettierignore` |
| Create | `.lintstagedrc.json` |
| Create | `.editorconfig` |
| Create | `.husky/pre-commit` |
| Create | `.github/workflows/ci.yml` |
| Remove | `packages/js-ofrep-worker/dist/` (from git tracking) |

## Implementation Order

1. Node version alignment (.nvmrc, package.json engines)
2. Prettier + .prettierrc + .prettierignore + format scripts
3. ESLint + .eslintrc.json + update lint scripts
4. Run format:fix + lint --fix to clean up existing code
5. Jest + ts-jest + tsconfig.spec.json + jest.config.ts + test scripts
6. Write initial test suite (flag-store, ofrep-handler, types)
7. Husky + lint-staged + .lintstagedrc.json
8. .editorconfig
9. GitHub Actions CI workflow
10. README updates
11. Remove dist/ from git tracking
12. Verify everything works: `npm run build && npm test && npm run lint && npm run format`
