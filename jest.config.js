module.exports = {
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
  ]
};