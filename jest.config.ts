import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'js-ofrep-worker',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/packages/js-ofrep-worker'],
      testMatch: ['<rootDir>/packages/js-ofrep-worker/test/**/*.spec.ts'],
      transform: {
        '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'packages/js-ofrep-worker/tsconfig.spec.json' }],
      },
      moduleNameMapper: {
        '^@openfeature/flagd-ofrep-cf-worker$': '<rootDir>/packages/js-ofrep-worker/src/index.ts',
      },
      // Allow ts-jest to transform installed @openfeature packages (ESM exports in .js)
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
