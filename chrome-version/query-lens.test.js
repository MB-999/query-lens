const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Load the actual QueryLens implementation
const queryLensCode = fs.readFileSync(path.join(__dirname, 'query-lens.js'), 'utf8');
global.QueryLens = eval(`(function() { ${queryLensCode}; return QueryLens; })()`);
const QueryLens = global.QueryLens;

describe('QueryLens Chrome Tests', () => {
  let mockBrowserAPI;
  let dom;
  let queryLens;

  beforeEach(async () => {
    // Setup JSDOM
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html><body>
        <div id="dynamic-url"></div>
        <div id="params-list"></div>
        <div id="no-params" class="hidden"></div>
        <button id="reset-btn"></button>
        <button id="copy-url-btn"></button>
        <button id="apply-changes-btn">Apply</button>
        <button id="add-param-btn"></button>
      </body></html>
    `);
    
    Object.defineProperty(global, 'document', { value: dom.window.document, writable: true });
    Object.defineProperty(global, 'window', { value: dom.window, writable: true });
    Object.defineProperty(global, 'URL', { value: dom.window.URL, writable: true });
    Object.defineProperty(global, 'URLSearchParams', { value: dom.window.URLSearchParams, writable: true });
    Object.defineProperty(global, 'navigator', {
      value: {
        clipboard: {
          writeText: jest.fn().mockResolvedValue()
        }
      },
      writable: true
    });
    Object.defineProperty(global, 'chrome', { value: {}, writable: true });

    mockBrowserAPI = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ url: 'https://example.com/test?param=value', id: 123 }]),
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

  test('should initialize correctly', () => {
    expect(queryLens.browser).toBe(mockBrowserAPI);
    expect(queryLens.params).toBeInstanceOf(URLSearchParams);
  });

  test('should load current URL', async () => {
    await queryLens.loadCurrentUrl();
    
    expect(mockBrowserAPI.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(queryLens.originalUrl).toBe('https://example.com/test?param=value');
    expect(queryLens.params.get('param')).toBe('value');
  });

  test('should escape HTML', () => {
    const result = queryLens.escapeHtml('<script>alert("xss")</script>');
    expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  test('should build URL', async () => {
    await queryLens.loadCurrentUrl();
    queryLens.renderParams();
    
    const result = queryLens.buildUrl();
    expect(result).toBe('https://example.com/test?param=value');
  });

  test('should apply changes', async () => {
    global.window.close = jest.fn();
    
    await queryLens.loadCurrentUrl();
    queryLens.renderParams();
    await queryLens.applyChanges();
    
    expect(mockBrowserAPI.tabs.update).toHaveBeenCalledWith(123, {
      url: 'https://example.com/test?param=value'
    });
    expect(global.window.close).toHaveBeenCalled();
  });

  test('should copy URL to clipboard', async () => {
    await queryLens.loadCurrentUrl();
    queryLens.renderParams();
    
    await navigator.clipboard.writeText(queryLens.buildUrl());
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/test?param=value');
  });



  test('should setup drag and drop listeners', () => {
    const paramsList = document.getElementById('params-list');
    const addEventListenerSpy = jest.spyOn(paramsList, 'addEventListener');
    
    queryLens.setupDragAndDrop();
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('dragstart', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
  });



  test('should handle special characters in parameters', async () => {
    mockBrowserAPI.tabs.query.mockResolvedValue([{ 
      url: 'https://example.com/test?special=value%20with%20spaces&unicode=测试', 
      id: 123 
    }]);
    
    await queryLens.loadCurrentUrl();
    
    expect(queryLens.params.get('special')).toBe('value with spaces');
    expect(queryLens.params.get('unicode')).toBe('测试');
  });
});