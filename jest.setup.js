// Polyfill TextEncoder/TextDecoder for JSDOM
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock chrome API globally
global.chrome = {
  tabs: {
    query: jest.fn(),
    update: jest.fn()
  }
};

// Mock navigator.clipboard
Object.defineProperty(global.navigator, 'clipboard', {
  writable: true,
  value: {
    writeText: jest.fn().mockResolvedValue(undefined)
  }
});

// Mock window.close for testing
Object.defineProperty(global.window, 'close', {
  writable: true,
  value: jest.fn()
});

// Mock performance API
Object.defineProperty(global.window, 'performance', {
  writable: true,
  value: {
    now: jest.fn(() => Date.now())
  }
});

// Suppress console errors during testing
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});