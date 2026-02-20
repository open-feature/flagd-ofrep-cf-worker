# Clean Repo To JS-Only Cloudflare Worker

## Goal

Keep only the JavaScript Cloudflare Worker implementation and remove legacy non-JS codepaths, dependencies, and documentation references across code, tooling, and docs.

## Scope Confirmed

- Full cleanup: remove legacy non-JS code, submodules, docs, plan artifacts, and benchmark references.
- Keep benchmark suite, but target JS worker only.

## Implementation Plan

1. Remove legacy non-JS implementation directories and non-JS-specific docs/plans.
2. Remove non-JS dependency wiring and multi-implementation scripts.
3. Retarget benchmarks to JS worker only.
4. Rewrite repository docs to single-implementation narrative.
5. Validate JS-only workspace integrity.

## Acceptance Criteria

- No legacy non-JS packages/examples/submodules remain in repository configuration.
- Root scripts and docs describe a single JS Cloudflare Worker path.
- Benchmarks run against JS worker only.
- Fresh install/build/test for JS path succeeds without any extra language toolchain requirements.
