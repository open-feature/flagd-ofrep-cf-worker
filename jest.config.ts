import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'js-ofrep-worker',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/js-ofrep-worker/test/**/*.spec.ts'],
      transform: {
        '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'packages/js-ofrep-worker/tsconfig.spec.json' }],
      },
      // Allow ts-jest to transform flagd-core workspace-linked files (ESM exports in .js)
      transformIgnorePatterns: ['/node_modules/(?!@openfeature/)'],
      moduleFileExtensions: ['ts', 'js', 'json'],
      coverageDirectory: '<rootDir>/coverage/packages/js-ofrep-worker',
    },
  ],
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['packages/*/src/**/*.ts', '!packages/*/src/stash/**'],
};

export default config;
