// Mock chrome API globally
global.chrome = {
  tabs: {
    query: jest.fn(),
    update: jest.fn()
  }
};

// Mock window.close for testing
Object.defineProperty(window, 'close', {
  writable: true,
  value: jest.fn()
});

// Mock performance API
Object.defineProperty(window, 'performance', {
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