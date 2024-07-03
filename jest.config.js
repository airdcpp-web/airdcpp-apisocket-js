// import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageDirectory: './coverage/',
  coveragePathIgnorePatterns: [
    '/dist/',
    '/node_modules/',
    '/src/tests/'
  ],
  collectCoverage: true,
  roots: [
    '<rootDir>/src/'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default jestConfig;
