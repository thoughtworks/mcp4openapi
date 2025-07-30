/**
 * Jest setup file for global test configuration
 */

// Global test timeout
jest.setTimeout(10000);

// Mock console methods in tests to reduce noise
const originalConsole = { ...console };

beforeEach(() => {
  // Suppress console output during tests unless needed
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Create a mock fetch function
const mockFetch = jest.fn();

// Mock fetch globally for network calls
global.fetch = mockFetch;

// Mock fs for file system operations
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

// Mock path for cross-platform compatibility
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...paths) => paths.join('/')),
}));

// Mock chalk to avoid ESM import issues
jest.mock('chalk', () => ({
  default: {
    blue: jest.fn((text) => text),
    green: jest.fn((text) => text),
    red: jest.fn((text) => text),
    yellow: jest.fn((text) => text),
    cyan: jest.fn((text) => text),
    gray: jest.fn((text) => text),
    grey: jest.fn((text) => text),
    white: jest.fn((text) => text),
    black: jest.fn((text) => text),
    magenta: jest.fn((text) => text),
    bold: jest.fn((text) => text),
    dim: jest.fn((text) => text),
    italic: jest.fn((text) => text),
    underline: jest.fn((text) => text),
    strikethrough: jest.fn((text) => text),
  },
  blue: jest.fn((text) => text),
  green: jest.fn((text) => text),
  red: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  cyan: jest.fn((text) => text),
  gray: jest.fn((text) => text),
  grey: jest.fn((text) => text),
  white: jest.fn((text) => text),
  black: jest.fn((text) => text),
  magenta: jest.fn((text) => text),
  bold: jest.fn((text) => text),
  dim: jest.fn((text) => text),
  italic: jest.fn((text) => text),
  underline: jest.fn((text) => text),
  strikethrough: jest.fn((text) => text),
}));

// Mock node-fetch to avoid ESM import issues - this provides the default export
jest.mock('node-fetch', () => mockFetch);

// Export utilities for tests
export const mockConsole = {
  log: jest.spyOn(console, 'log').mockImplementation(() => {}),
  info: jest.spyOn(console, 'info').mockImplementation(() => {}),
  warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
  error: jest.spyOn(console, 'error').mockImplementation(() => {}),
};

export const restoreConsole = () => {
  Object.assign(console, originalConsole);
}; 