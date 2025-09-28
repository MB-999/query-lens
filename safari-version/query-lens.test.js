const { JSDOM } = require('jsdom');

// Mock QueryLens class for Safari
class QueryLens {
  constructor(browserAPI) {
    this.browser = browserAPI;
    this.originalUrl = '';
    this.currentUrl = '';
    this.params = new URLSearchParams();
  }

  async init() {
    await this.loadCurrentUrl();
    this.setupEventListeners();
    this.renderParams();
    this.updateDynamicUrl();
  }

  async loadCurrentUrl() {
    const tabs = await this.browser.tabs.query({ active: true, currentWindow: true });
    this.originalUrl = tabs[0].url;
    this.currentUrl = tabs[0].url;
    this.params = new URLSearchParams(new URL(this.currentUrl).search);
    this.updateDynamicUrl();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateDynamicUrl() {
    const dynamicUrl = this.buildUrl();
    const dynamicUrlDiv = document.getElementById('dynamic-url');
    if (dynamicUrlDiv) {
      dynamicUrlDiv.textContent = dynamicUrl;
    }
  }

  setupEventListeners() {
    // Mock implementation
  }

  renderParams() {
    const paramsList = document.getElementById('params-list');
    const noParams = document.getElementById('no-params');
    
    if (paramsList) paramsList.innerHTML = '';
    
    if (this.params.size === 0) {
      if (noParams) noParams.classList.remove('hidden');
      return;
    }

    if (noParams) noParams.classList.add('hidden');
  }

  buildUrl() {
    const url = new URL(this.currentUrl);
    url.search = this.params.toString();
    return url.toString();
  }

  addNewParam() {
    this.params.set('', '');
    this.renderParams();
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  async applyChanges() {
    const newUrl = this.buildUrl();
    const tabs = await this.browser.tabs.query({ active: true, currentWindow: true });
    await this.browser.tabs.update(tabs[0].id, { url: newUrl });
    this.originalUrl = newUrl;
    window.close();
  }

  async copyUrl() {
    const url = this.buildUrl();
    await navigator.clipboard.writeText(url);
  }

  handleError(error) {
    console.error('QueryLens error:', error);
    this.showToast('An error occurred');
  }
}

describe('QueryLens Safari Tests', () => {
  let mockBrowserAPI;
  let queryLens;
  let dom;

  beforeEach(() => {
    // Setup JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="dynamic-url"></div>
          <div id="params-list"></div>
          <div id="no-params" class="hidden"></div>
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

    queryLens = new QueryLens(mockBrowserAPI);
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

  test('should add new parameter', () => {
    queryLens.addNewParam();
    expect(queryLens.params.has('')).toBe(true);
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
    await queryLens.applyChanges();
    
    expect(mockBrowserAPI.tabs.update).toHaveBeenCalledWith(123, {
      url: 'https://example.com/test?param1=value1&param2=value2'
    });
    expect(global.window.close).toHaveBeenCalled();
  });

  test('should copy URL to clipboard', async () => {
    await queryLens.loadCurrentUrl();
    
    await queryLens.copyUrl();
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/test?param1=value1&param2=value2');
  });

  test('should handle clipboard copy failure', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'));
    await queryLens.loadCurrentUrl();
    
    await expect(queryLens.copyUrl()).rejects.toThrow('Clipboard error');
  });

  test('should handle malformed URLs gracefully', async () => {
    mockBrowserAPI.tabs.query.mockResolvedValue([{ url: 'invalid-url', id: 123 }]);
    
    await expect(queryLens.loadCurrentUrl()).rejects.toThrow();
  });

  test('should handle error logging', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const showToastSpy = jest.spyOn(queryLens, 'showToast');
    
    queryLens.handleError(new Error('Test error'));
    
    expect(consoleSpy).toHaveBeenCalledWith('QueryLens error:', expect.any(Error));
    expect(showToastSpy).toHaveBeenCalledWith('An error occurred');
  });

  test('should handle empty tab results', async () => {
    mockBrowserAPI.tabs.query.mockResolvedValue([]);
    
    await expect(queryLens.loadCurrentUrl()).rejects.toThrow();
  });
});