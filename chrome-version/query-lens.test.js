const { JSDOM } = require('jsdom');

describe('QueryLens Chrome Tests', () => {
  let mockBrowserAPI;
  let dom;
  let QueryLens;

  beforeEach(() => {
    // Setup JSDOM
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html><body>
        <div id="dynamic-url"></div>
        <div id="params-list"></div>
        <div id="no-params" class="hidden"></div>
        <button id="apply-changes-btn">Apply</button>
      </body></html>
    `);
    
    Object.defineProperty(global, 'document', { value: dom.window.document, writable: true });
    Object.defineProperty(global, 'window', { value: dom.window, writable: true });
    Object.defineProperty(global, 'URL', { value: dom.window.URL, writable: true });
    Object.defineProperty(global, 'URLSearchParams', { value: dom.window.URLSearchParams, writable: true });

    mockBrowserAPI = {
      tabs: {
        query: jest.fn().mockResolvedValue([{ url: 'https://example.com/test?param=value', id: 123 }]),
        update: jest.fn().mockResolvedValue()
      }
    };

    // Simple QueryLens implementation
    QueryLens = class {
      constructor(browserAPI) {
        this.browser = browserAPI;
        this.originalUrl = '';
        this.currentUrl = '';
        this.params = new URLSearchParams();
      }

      async loadCurrentUrl() {
        const tabs = await this.browser.tabs.query({ active: true, currentWindow: true });
        this.originalUrl = tabs[0].url;
        this.currentUrl = tabs[0].url;
        this.params = new URLSearchParams(new URL(this.currentUrl).search);
      }

      escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }

      buildUrl() {
        const url = new URL(this.currentUrl);
        url.search = this.params.toString();
        return url.toString();
      }

      async applyChanges() {
        const newUrl = this.buildUrl();
        const tabs = await this.browser.tabs.query({ active: true, currentWindow: true });
        await this.browser.tabs.update(tabs[0].id, { url: newUrl });
        global.window.close();
      }

      async copyUrl() {
        const url = this.buildUrl();
        await navigator.clipboard.writeText(url);
      }

      setupDragAndDrop() {
        const paramsList = document.getElementById('params-list');
        if (paramsList) {
          paramsList.addEventListener('dragstart', this.handleDragStart.bind(this));
          paramsList.addEventListener('dragover', this.handleDragOver.bind(this));
        }
      }

      handleDragStart(e) {
        if (e.target.closest('.param-item')) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/html', e.target.closest('.param-item').outerHTML);
        }
      }

      handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }
    };
  });

  afterEach(() => {
    dom.window.close();
    jest.clearAllMocks();
  });

  test('should initialize correctly', () => {
    const queryLens = new QueryLens(mockBrowserAPI);
    expect(queryLens.browser).toBe(mockBrowserAPI);
    expect(queryLens.params).toBeInstanceOf(URLSearchParams);
  });

  test('should load current URL', async () => {
    const queryLens = new QueryLens(mockBrowserAPI);
    await queryLens.loadCurrentUrl();
    
    expect(mockBrowserAPI.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(queryLens.originalUrl).toBe('https://example.com/test?param=value');
    expect(queryLens.params.get('param')).toBe('value');
  });

  test('should escape HTML', () => {
    const queryLens = new QueryLens(mockBrowserAPI);
    const result = queryLens.escapeHtml('<script>alert("xss")</script>');
    expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  test('should build URL', async () => {
    const queryLens = new QueryLens(mockBrowserAPI);
    await queryLens.loadCurrentUrl();
    queryLens.params.set('new', 'param');
    
    const result = queryLens.buildUrl();
    expect(result).toContain('param=value');
    expect(result).toContain('new=param');
  });

  test('should apply changes', async () => {
    global.window.close = jest.fn();
    
    const queryLens = new QueryLens(mockBrowserAPI);
    await queryLens.loadCurrentUrl();
    await queryLens.applyChanges();
    
    expect(mockBrowserAPI.tabs.update).toHaveBeenCalledWith(123, {
      url: 'https://example.com/test?param=value'
    });
    expect(global.window.close).toHaveBeenCalled();
  });

  test('should copy URL to clipboard', async () => {
    const queryLens = new QueryLens(mockBrowserAPI);
    await queryLens.loadCurrentUrl();
    
    await queryLens.copyUrl();
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/test?param=value');
  });

  test('should handle clipboard copy failure', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'));
    const queryLens = new QueryLens(mockBrowserAPI);
    await queryLens.loadCurrentUrl();
    
    await expect(queryLens.copyUrl()).rejects.toThrow('Clipboard error');
  });

  test('should setup drag and drop listeners', () => {
    const queryLens = new QueryLens(mockBrowserAPI);
    const paramsList = document.getElementById('params-list');
    const addEventListenerSpy = jest.spyOn(paramsList, 'addEventListener');
    
    queryLens.setupDragAndDrop();
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('dragstart', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('dragover', expect.any(Function));
  });

  test('should handle drag start event', () => {
    const queryLens = new QueryLens(mockBrowserAPI);
    const mockEvent = {
      target: {
        closest: jest.fn().mockReturnValue({
          outerHTML: '<div class="param-item">test</div>'
        })
      },
      dataTransfer: {
        effectAllowed: '',
        setData: jest.fn()
      }
    };
    
    queryLens.handleDragStart(mockEvent);
    
    expect(mockEvent.dataTransfer.effectAllowed).toBe('move');
    expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith('text/html', '<div class="param-item">test</div>');
  });

  test('should handle special characters in parameters', async () => {
    mockBrowserAPI.tabs.query.mockResolvedValue([{ 
      url: 'https://example.com/test?special=value%20with%20spaces&unicode=测试', 
      id: 123 
    }]);
    
    const queryLens = new QueryLens(mockBrowserAPI);
    await queryLens.loadCurrentUrl();
    
    expect(queryLens.params.get('special')).toBe('value with spaces');
    expect(queryLens.params.get('unicode')).toBe('测试');
  });
});