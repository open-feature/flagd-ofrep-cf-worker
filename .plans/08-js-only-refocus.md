# Plan 08: Refocus to JS-Only Cloudflare Worker

## Goal

Remove all Rust/WASM code, benchmarks, and related documentation. Retain the two-layer JS structure (`packages/js-ofrep-worker` + `examples/js-worker`) and the `contrib/js-sdk-contrib` submodule fork.

## Changes Made

### Phase 1 — Remove Rust Git Submodules
- Removed `contrib/rust-sdk-contrib` submodule
- Removed `contrib/flagd-evaluator` submodule
- Updated `.gitmodules` to retain only `contrib/js-sdk-contrib`
- Cleaned up `.git/modules/` cache

### Phase 2 — Delete Rust Packages
- Deleted `packages/rust-ofrep-worker/`
- Deleted `packages/rust-ofrep-worker-forking/`

### Phase 3 — Delete Rust Examples
- Deleted `examples/rust-worker/`
- Deleted `examples/rust-worker-forking/`

### Phase 4 — Delete Benchmarks
- Deleted `benchmarks/` directory (k6 scripts, benchmark flags, results)

### Phase 5 — Delete Rust Documentation
- Deleted `docs/rust-wasm-approaches.md`
- Deleted `docs/` directory

### Phase 6 — Update Root package.json
- Removed `deploy:rust`, `deploy:rust-forking`, `deploy:all` scripts
- Renamed `dev:js` to `dev`, `deploy:js` to `deploy`
- Updated description to reflect JS-only focus

### Phase 7 — Update README.md
- Removed all Rust worker sections, comparison tables, Rust quick start guides
- Removed references to Rust submodules and forks
- Simplified project structure, development, and deployment sections
- Removed Rust-related roadmap items

### Phase 8 — Clean Up .gitignore
- Removed Rust/WASM entries (`target/`, `*.wasm`, `pkg/`)
- Removed stale `docs/mermaid-diagrams/` entry

## What Was Retained

| Item | Reason |
|---|---|
| `packages/js-ofrep-worker/` | Core JS package — untouched |
| `examples/js-worker/` | CF Worker entry point — untouched |
| `contrib/js-sdk-contrib` submodule | Kept pending upstream flagd-core PR |
| `packages/js-ofrep-worker/src/stash/` | Already excluded from build; left as-is |
| `.plans/01-07` | Historical context |
| `shared/test-flags.json` | Used by JS package |

## Future

- Replace `contrib/js-sdk-contrib` submodule with the published `@openfeature/flagd-core` npm package once upstream PRs land
