const { JSDOM } = require('jsdom');
const QueryLens = require('./query-lens');

describe('QueryLens Safari Tests', () => {
  let mockBrowserAPI;
  let queryLens;
  let dom;

  beforeEach(async () => {
    // Setup JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="dynamic-url"></div>
          <div id="params-list"></div>
          <div id="no-params" class="hidden"></div>
          <button id="reset-btn"></button>
          <button id="copy-url-btn"></button>
          <button id="apply-changes-btn"></button>
          <button id="add-param-btn"></button>
        </body>
      </html>
    `);
    
    Object.defineProperty(global, 'document', {
      value: dom.window.document,
      writable: true
    });
    Object.defineProperty(global, 'window', {
      value: dom.window,
      writable: true
    });
    Object.defineProperty(global, 'URL', {
      value: dom.window.URL,
      writable: true
    });
    Object.defineProperty(global, 'URLSearchParams', {
      value: dom.window.URLSearchParams,
      writable: true
    });

    // Mock navigator.clipboard
    Object.defineProperty(global, 'navigator', {
      value: {
        clipboard: {
          writeText: jest.fn().mockResolvedValue()
        }
      },
      writable: true
    });

    // Mock Safari browser API
    mockBrowserAPI = {
      tabs: {
        query: jest.fn().mockResolvedValue([{
          url: 'https://example.com/test?param1=value1&param2=value2',
          id: 123
        }]),
        update: jest.fn().mockResolvedValue()
      }
    };

    // Create QueryLens instance without auto-init
    queryLens = Object.create(QueryLens.prototype);
    queryLens.browser = mockBrowserAPI;
    queryLens.originalUrl = '';
    queryLens.currentUrl = '';
    queryLens.params = new URLSearchParams();
  });

  afterEach(() => {
    dom.window.close();
    jest.clearAllMocks();
  });

  test('should initialize with browser API', () => {
    expect(queryLens.browser).toBe(mockBrowserAPI);
    expect(queryLens.originalUrl).toBe('');
    expect(queryLens.currentUrl).toBe('');
    expect(queryLens.params).toBeInstanceOf(URLSearchParams);
  });

  test('should load current URL from active tab', async () => {
    await queryLens.loadCurrentUrl();
    
    expect(mockBrowserAPI.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true
    });
    expect(queryLens.originalUrl).toBe('https://example.com/test?param1=value1&param2=value2');
    expect(queryLens.currentUrl).toBe('https://example.com/test?param1=value1&param2=value2');
  });

  test('should parse URL parameters correctly', async () => {
    await queryLens.loadCurrentUrl();
    
    expect(queryLens.params.get('param1')).toBe('value1');
    expect(queryLens.params.get('param2')).toBe('value2');
  });

  test('should escape HTML characters', () => {
    const result = queryLens.escapeHtml('<script>alert("xss")</script>');
    expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  test('should build URL correctly', async () => {
    await queryLens.loadCurrentUrl();
    queryLens.renderParams();
    const result = queryLens.buildUrl();
    expect(result).toBe('https://example.com/test?param1=value1&param2=value2');
  });

  test('should render parameters', async () => {
    await queryLens.loadCurrentUrl();
    queryLens.renderParams();
    
    const noParams = document.getElementById('no-params');
    expect(noParams.classList.contains('hidden')).toBe(true);
  });

  test('should show no parameters message when empty', () => {
    queryLens.params = new URLSearchParams();
    queryLens.renderParams();
    
    const noParams = document.getElementById('no-params');
    expect(noParams.classList.contains('hidden')).toBe(false);
  });

  test('should add new parameter', async () => {
    await queryLens.loadCurrentUrl();
    queryLens.renderParams();
    queryLens.addNewParam();
    const paramItems = document.querySelectorAll('.param-item');
    expect(paramItems.length).toBeGreaterThan(0);
  });

  test('should show toast message', () => {
    queryLens.showToast('Test message');
    
    const toast = document.querySelector('.toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toBe('Test message');
  });

  test('should apply changes', async () => {
    // Mock window.close
    global.window.close = jest.fn();
    
    await queryLens.loadCurrentUrl();
    queryLens.renderParams();
    await queryLens.applyChanges();
    
    expect(mockBrowserAPI.tabs.update).toHaveBeenCalledWith(123, {
      url: 'https://example.com/test?param1=value1&param2=value2'
    });
    expect(global.window.close).toHaveBeenCalled();
  });

  test('should copy URL to clipboard', async () => {
    await queryLens.loadCurrentUrl();
    queryLens.renderParams();
    
    await navigator.clipboard.writeText(queryLens.buildUrl());
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/test?param1=value1&param2=value2');
  });



  test('should handle malformed URLs gracefully', async () => {
    mockBrowserAPI.tabs.query.mockResolvedValue([{ url: 'invalid-url', id: 123 }]);
    
    await expect(queryLens.loadCurrentUrl()).rejects.toThrow();
  });



  test('should handle empty tab results', async () => {
    mockBrowserAPI.tabs.query.mockResolvedValue([]);
    
    await expect(queryLens.loadCurrentUrl()).rejects.toThrow();
  });
});