# flagd OFREP Cloudflare Worker

> **Warning:** This project is under active development and is not yet ready for production use.

This repository contains a reusable Cloudflare Workers package for in-process [flagd](https://flagd.dev/) evaluation plus a reference worker that exposes [OFREP](https://github.com/open-feature/protocol) evaluation endpoints. The package lives in `packages/js-ofrep-worker`, while `examples/js-worker` shows how to compose it with Hono, optional auth handling, and optional R2-backed flag loading.

## Repository Guide

- Package docs: [`packages/js-ofrep-worker/README.md`](packages/js-ofrep-worker/README.md)
- Example worker: [`examples/js-worker`](examples/js-worker)
- Shared test fixtures: [`shared/test-flags.json`](shared/test-flags.json)

## Repository Layout

```text
flagd-ofrep-cf-worker/
├── packages/
│   └── js-ofrep-worker/           # Reusable package: @openfeature/flagd-ofrep-cf-worker
├── examples/
│   └── js-worker/                 # Reference Cloudflare Worker
└── shared/
    └── test-flags.json            # Shared fixtures used by tests and docs
```

## Local Development

```bash
npm install
npm run build
npm test
npm run test:smoke:release
npm run test:smoke:worker
npm run lint
npm run format
```

For the reference worker:

```bash
# Runs examples/js-worker with wrangler dev
npm run dev

# Deploys examples/js-worker with wrangler deploy
npm run deploy
```

## Example Worker Notes

The worker in `examples/js-worker` demonstrates two flag sources:

- Bundled static flags from `examples/js-worker/src/flags.json` for local development and the default example flow
- Per-token flag configs loaded from R2 when `FLAG_SOURCE=r2` and `FLAGS_R2_BUCKET` is configured

The package itself does not automatically add Hono routing, require authentication, or load flags from R2. Those behaviors are composed in the example worker around the package's `OfrepHandler` and `extractAuthToken()` helper.

## Sample Flags

The repo has two similar flag sets for different purposes:

- `examples/js-worker/src/flags.json` is the canonical sample config for the example worker and `npm run dev`
- `shared/test-flags.json` is the broader shared fixture set used by tests and other repository-level validation

## Workers Compatibility

`@openfeature/flagd-core@1.3.0` and later support Cloudflare Workers and other V8 isolate runtimes without relying on dynamic code generation. This repo consumes the released package directly and uses `disableDynamicCodeGeneration: true` so targeting rules stay compatible with Workers runtime restrictions. The upstream work landed through [open-feature/js-sdk-contrib#1480](https://github.com/open-feature/js-sdk-contrib/issues/1480).

## License

Apache-2.0
