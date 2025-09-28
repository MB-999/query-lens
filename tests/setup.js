// Jest setup for browser-like globals
Object.defineProperty(window, 'close', { value: jest.fn(), writable: true });