# Changelog

## [0.0.2](https://github.com/open-feature/flagd-ofrep-cf-worker/compare/flagd-ofrep-cf-worker-v0.0.1...flagd-ofrep-cf-worker-v0.0.2) (2026-03-31)


### ✨ New Features

* add R2 flag source support with per-token config loading ([#2](https://github.com/open-feature/flagd-ofrep-cf-worker/issues/2)) ([92f9c2e](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/92f9c2e497ed4ba35197ec1b43bef3b8c78c78ff))
* add Rust OFREP worker with WASM support ([d3dec1c](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/d3dec1c74e33490beb8fac7465b16f3919434259))
* initial JS OFREP worker implementation ([be8010a](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/be8010a8db07e09f3b6c1d0b65a2d0a20d6b3228))


### 🐛 Bug Fixes

* disable CORS by default in the published artifact ([#12](https://github.com/open-feature/flagd-ofrep-cf-worker/issues/12)) ([714d49f](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/714d49f32c5f4abbff0caed075b921a87c71b21c))
* normalize repository URLs in package.json ([#20](https://github.com/open-feature/flagd-ofrep-cf-worker/issues/20)) ([d8c6be5](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/d8c6be5c4cc99db728f63d451ebd69816d14b875))
* use disableDynamicCodeGeneration option in FlagdCoreOptions ([a6fdbaf](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/a6fdbafd22c57fc785a649c6c059159db9124ef5))


### 🧹 Chore

* add Apache-2.0 LICENSE and include it in published package ([#16](https://github.com/open-feature/flagd-ofrep-cf-worker/issues/16)) ([7769fa4](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/7769fa48e5f33e24996b73ae159c9cd44f98a0e1))
* add release-please and npm publish workflow with OIDC ([#18](https://github.com/open-feature/flagd-ofrep-cf-worker/issues/18)) ([d4e5e56](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/d4e5e564b8448c08783f9a5da1ecce664a1eb8e4))
* align dev tooling with js-sdk and js-sdk-contrib ([2b2d316](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/2b2d31668f1ff70f3b58db236b25ed3cc143b940))
* **deps:** update dependency @openfeature/flagd-core to v2 ([#13](https://github.com/open-feature/flagd-ofrep-cf-worker/issues/13)) ([0c7d3ff](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/0c7d3ff202f66e9059c4590f12f87ccd7526ea76))
* fix TypeScript warnings and use logger in Targeting class ([b30ec6f](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/b30ec6fa689e5d791e87bbe3cfbe0f032ee6dc06))
* pin js-sdk-contrib PR branch and add local build/test resolution mappings ([42540ae](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/42540ae5a618934f0fa8df0ddd98caa2110c7cdd))
* replace the flagd-core submodule with the released 1.3.0 package ([#6](https://github.com/open-feature/flagd-ofrep-cf-worker/issues/6)) ([7199cd5](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/7199cd5044f2469478cf2a773b4fdbe3a2325bf8))
* update all dependencies to latest versions ([394dd4c](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/394dd4c89e8bece1dbfe686b31bf0e91dd5ffeac))
* upgrade to Node 25 and latest Cloudflare packages ([e40c3a9](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/e40c3a9b19a28bbaa031181c32eab51ebd06a4ff))


### 📚 Documentation

* clean up root and package readmes ([#7](https://github.com/open-feature/flagd-ofrep-cf-worker/issues/7)) ([3ee157a](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/3ee157a9545b5b0a01eeb16d9d5d87de86101123))


### 🔄 Refactoring

* switch from custom implementation to forked flagd-core ([e198b86](https://github.com/open-feature/flagd-ofrep-cf-worker/commit/e198b8659a8049c68d54130bc2784f89bb2f8e39))
