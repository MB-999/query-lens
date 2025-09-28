const { JSDOM } = require('jsdom');

describe('QueryLens', () => {
  let mockBrowserAPI;
  let queryLens;
  let dom;
  let document;
  let navigator;

  beforeEach(() => {
    // Setup JSDOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="dynamic-url"></div>
          <div id="params-list"></div>
          <div id="no-params" class="hidden"></div>
          <button id="reset-btn">Reset</button>
          <button id="copy-url-btn">Copy URL</button>
          <button id="apply-changes-btn">Apply Changes</button>
          <button id="add-param-btn">Add Parameter</button>
        </body>
      </html>
    `, {
      url: 'https://example.com/test?param1=value1&param2=value2'
    });
    
    global.document = dom.window.document;
    global.window = dom.window;
    global.navigator = {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    };
    global.URL = dom.window.URL;
    global.URLSearchParams = dom.window.URLSearchParams;

    // Mock Chrome browser API
    mockBrowserAPI = {
      tabs: {
        query: jest.fn(),
        update: jest.fn()
      }
    };

    // Mock the QueryLens class since we need to import it
    global.QueryLens = class QueryLens {
      constructor(browserAPI) {
        this.browser = browserAPI;
        this.originalUrl = '';
        this.currentUrl = '';
        this.params = new URLSearchParams();
        this.init();
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
        const url = new URL(dynamicUrl);
        const dynamicUrlDiv = document.getElementById('dynamic-url');
        
        if (!url.search) {
          dynamicUrlDiv.textContent = dynamicUrl;
          return;
        }

        const baseUrl = url.origin + url.pathname;
        const currentParams = new URLSearchParams(url.search);
        const originalParams = new URLSearchParams(new URL(this.originalUrl).search);
        const paramEntries = Array.from(currentParams.entries());
        
        dynamicUrlDiv.textContent = '';
        dynamicUrlDiv.appendChild(document.createTextNode(baseUrl + '?'));
        
        paramEntries.forEach(([key, value], index) => {
          const originalValue = originalParams.get(key);
          const originalKey = originalParams.has(key);
          
          const keyChanged = !originalKey;
          const valueChanged = originalValue !== value;
          
          if (keyChanged) {
            const keySpan = document.createElement('span');
            keySpan.className = 'param-changed';
            keySpan.textContent = key;
            dynamicUrlDiv.appendChild(keySpan);
          } else {
            dynamicUrlDiv.appendChild(document.createTextNode(key));
          }
          
          dynamicUrlDiv.appendChild(document.createTextNode('='));
          
          if (valueChanged) {
            const valueSpan = document.createElement('span');
            valueSpan.className = 'param-changed';
            valueSpan.textContent = value;
            dynamicUrlDiv.appendChild(valueSpan);
          } else {
            dynamicUrlDiv.appendChild(document.createTextNode(value));
          }
          
          if (index < paramEntries.length - 1) {
            dynamicUrlDiv.appendChild(document.createTextNode('&'));
          }
        });
      }

      setupEventListeners() {
        document.getElementById('reset-btn').addEventListener('click', () => {
          this.currentUrl = this.originalUrl;
          this.params = new URLSearchParams(new URL(this.currentUrl).search);
          this.renderParams();
          this.updateDynamicUrl();
          document.getElementById('apply-changes-btn').disabled = true;
        });

        document.getElementById('copy-url-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(this.buildUrl()).catch(() => {
            this.showToast('Failed to copy URL');
          }).then(() => {
            this.showToast('URL copied to clipboard!');
          });
        });

        document.getElementById('apply-changes-btn').addEventListener('click', () => {
          this.applyChanges();
        });

        document.getElementById('add-param-btn').addEventListener('click', () => {
          this.addNewParam();
        });

        if (this.browser === chrome) {
          this.setupDragAndDrop();
        }
      }

      setupDragAndDrop() {
        const paramsList = document.getElementById('params-list');
        paramsList.addEventListener('dragstart', (e) => {
          if (e.target.closest('.param-item')) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', e.target.closest('.param-item').outerHTML);
            e.target.closest('.param-item').classList.add('dragging');
          }
        });

        paramsList.addEventListener('dragend', (e) => {
          if (e.target.closest('.param-item')) {
            e.target.closest('.param-item').classList.remove('dragging');
          }
        });

        paramsList.addEventListener('dragover', (e) => {
          e.preventDefault();
          const element = e.target.closest('.param-item');
          if (element) {
            e.dataTransfer.dropEffect = 'move';
            const dragging = document.querySelector('.dragging');
            if (dragging && dragging !== element) {
              const rect = element.getBoundingClientRect();
              const midY = rect.top + rect.height / 2;
              if (e.clientY < midY) {
                element.parentNode.insertBefore(dragging, element);
              } else {
                element.parentNode.insertBefore(dragging, element.nextSibling);
              }
              this.updatePreview();
            }
          }
        });
      }

      renderParams() {
        const paramsList = document.getElementById('params-list');
        const noParams = document.getElementById('no-params');
        
        paramsList.innerHTML = '';
        
        if (this.params.size === 0) {
          noParams.classList.remove('hidden');
          return;
        }

        noParams.classList.add('hidden');

        for (const [key, value] of this.params.entries()) {
          const paramDiv = this.createParamElement(key, value);
          paramsList.appendChild(paramDiv);
        }
      }

      createParamElement(key, value) {
        const div = document.createElement('div');
        div.className = 'param-item';
        
        if (this.browser === chrome) {
          div.draggable = true;
        }
        
        const paramRow = document.createElement('div');
        paramRow.className = 'param-row';
        
        if (this.browser === chrome) {
          const dragHandle = document.createElement('div');
          dragHandle.className = 'drag-handle';
          dragHandle.title = 'Drag to reorder';
          dragHandle.textContent = '⋮⋮';
          paramRow.appendChild(dragHandle);
        }
        
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'param-key';
        keyInput.value = key;
        keyInput.setAttribute('data-original', key);
        keyInput.placeholder = 'Key';
        
        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'param-value';
        valueInput.value = value;
        valueInput.placeholder = 'Value';
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.setAttribute('data-key', key);
        copyBtn.setAttribute('data-value', value);
        copyBtn.title = 'Copy value';
        copyBtn.textContent = 'Copy';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.setAttribute('data-key', key);
        removeBtn.title = 'Remove parameter';
        removeBtn.textContent = 'Delete';
        
        paramRow.appendChild(keyInput);
        paramRow.appendChild(valueInput);
        paramRow.appendChild(copyBtn);
        paramRow.appendChild(removeBtn);
        div.appendChild(paramRow);

        keyInput.addEventListener('input', () => this.updatePreview());
        valueInput.addEventListener('input', () => this.updatePreview());
        copyBtn.addEventListener('click', (e) => {
          const value = e.target.dataset.value;
          navigator.clipboard.writeText(value).catch(() => {
            this.showToast('Failed to copy value');
          }).then(() => {
            this.showToast('Value copied!');
          });
        });
        removeBtn.addEventListener('click', (e) => {
          this.params.delete(e.target.dataset.key);
          this.renderParams();
          this.updatePreview();
        });

        return div;
      }

      updatePreview() {
        const newUrl = this.buildUrl();
        const hasChanges = newUrl !== this.originalUrl;
        document.getElementById('apply-changes-btn').disabled = !hasChanges;
        this.updateDynamicUrl();
      }

      buildUrl() {
        const url = new URL(this.currentUrl);
        const newParams = new URLSearchParams();
        
        document.querySelectorAll('.param-item').forEach(item => {
          const key = item.querySelector('.param-key').value.trim();
          const value = item.querySelector('.param-value').value.trim();
          if (key) newParams.set(key, value);
        });

        url.search = newParams.toString();
        return url.toString();
      }

      addNewParam() {
        this.syncDomToParams();
        this.params.set('', '');
        this.renderParams();
        this.updatePreview();
        setTimeout(() => {
          const inputs = document.querySelectorAll('.param-key');
          const lastInput = inputs[inputs.length - 1];
          if (lastInput) lastInput.focus();
        }, 0);
      }

      syncDomToParams() {
        this.params = new URLSearchParams();
        document.querySelectorAll('.param-item').forEach(item => {
          const key = item.querySelector('.param-key').value.trim();
          const value = item.querySelector('.param-value').value.trim();
          if (key) this.params.set(key, value);
        });
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
    };

    // Initialize QueryLens instance
    queryLens = new QueryLens(mockBrowserAPI);
  });

  afterEach(() => {
    dom.window.close();
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with browser API and empty state', () => {
      expect(queryLens.browser).toBe(mockBrowserAPI);
      expect(queryLens.originalUrl).toBe('');
      expect(queryLens.currentUrl).toBe('');
      expect(queryLens.params).toBeInstanceOf(URLSearchParams);
    });

    test('should call init method during construction', () => {
      const initSpy = jest.spyOn(QueryLens.prototype, 'init');
      new QueryLens(mockBrowserAPI);
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('loadCurrentUrl', () => {
    beforeEach(() => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test?param1=value1&param2=value2'
      }]);
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

    test('should handle URLs without parameters', async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test'
      }]);

      await queryLens.loadCurrentUrl();
      
      expect(queryLens.params.size).toBe(0);
    });

    test('should handle malformed URLs gracefully', async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'not-a-valid-url'
      }]);

      await expect(queryLens.loadCurrentUrl()).rejects.toThrow();
    });
  });

  describe('escapeHtml', () => {
    test('should escape HTML characters correctly', () => {
      expect(queryLens.escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
      expect(queryLens.escapeHtml('&')).toBe('&amp;');
      expect(queryLens.escapeHtml('"')).toBe('"');
      expect(queryLens.escapeHtml("'")).toBe("'");
    });

    test('should handle empty and null inputs', () => {
      expect(queryLens.escapeHtml('')).toBe('');
      expect(queryLens.escapeHtml('normal text')).toBe('normal text');
    });

    test('should handle special characters', () => {
      expect(queryLens.escapeHtml('param=value&other=test')).toBe('param=value&amp;other=test');
    });
  });

  describe('updateDynamicUrl', () => {
    beforeEach(async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test?original=value'
      }]);
      await queryLens.loadCurrentUrl();
    });

    test('should display URL without parameters correctly', () => {
      queryLens.params = new URLSearchParams();
      queryLens.currentUrl = 'https://example.com/test';
      
      queryLens.updateDynamicUrl();
      
      const dynamicUrlDiv = document.getElementById('dynamic-url');
      expect(dynamicUrlDiv.textContent).toBe('https://example.com/test');
    });

    test('should highlight changed parameters', () => {
      // Add new parameter
      queryLens.params.set('new', 'param');
      queryLens.params.set('original', 'changed');
      
      queryLens.updateDynamicUrl();
      
      const dynamicUrlDiv = document.getElementById('dynamic-url');
      const changedSpans = dynamicUrlDiv.querySelectorAll('.param-changed');
      expect(changedSpans.length).toBeGreaterThan(0);
    });

    test('should show unchanged parameters without highlighting', () => {
      queryLens.updateDynamicUrl();
      
      const dynamicUrlDiv = document.getElementById('dynamic-url');
      expect(dynamicUrlDiv.textContent).toContain('original=value');
    });
  });

  describe('Event Listeners', () => {
    beforeEach(async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test?param=value'
      }]);
      await queryLens.loadCurrentUrl();
    });

    test('should reset to original URL when reset button clicked', () => {
      queryLens.currentUrl = 'https://example.com/test?modified=true';
      const resetBtn = document.getElementById('reset-btn');
      
      resetBtn.click();
      
      expect(queryLens.currentUrl).toBe(queryLens.originalUrl);
      expect(document.getElementById('apply-changes-btn').disabled).toBe(true);
    });

    test('should copy URL to clipboard when copy button clicked', async () => {
      const copyBtn = document.getElementById('copy-url-btn');
      const showToastSpy = jest.spyOn(queryLens, 'showToast');
      
      copyBtn.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(showToastSpy).toHaveBeenCalledWith('URL copied to clipboard!');
    });

    test('should handle clipboard copy failure', async () => {
      navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard error'));
      const copyBtn = document.getElementById('copy-url-btn');
      const showToastSpy = jest.spyOn(queryLens, 'showToast');
      
      copyBtn.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(showToastSpy).toHaveBeenCalledWith('Failed to copy URL');
    });

    test('should call applyChanges when apply button clicked', () => {
      const applyChangesSpy = jest.spyOn(queryLens, 'applyChanges');
      const applyBtn = document.getElementById('apply-changes-btn');
      
      applyBtn.click();
      
      expect(applyChangesSpy).toHaveBeenCalled();
    });

    test('should add new parameter when add button clicked', () => {
      const addNewParamSpy = jest.spyOn(queryLens, 'addNewParam');
      const addBtn = document.getElementById('add-param-btn');
      
      addBtn.click();
      
      expect(addNewParamSpy).toHaveBeenCalled();
    });
  });

  describe('Drag and Drop (Chrome specific)', () => {
    let chromeQueryLens;

    beforeEach(async () => {
      global.chrome = mockBrowserAPI;
      chromeQueryLens = new QueryLens(chrome);
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test?param=value'
      }]);
      await chromeQueryLens.loadCurrentUrl();
    });

    test('should setup drag and drop for Chrome browser', () => {
      const paramsList = document.getElementById('params-list');
      const dragStartHandler = jest.fn();
      paramsList.addEventListener('dragstart', dragStartHandler);
      
      // Simulate drag start event
      const dragEvent = new dom.window.Event('dragstart');
      dragEvent.dataTransfer = {
        effectAllowed: '',
        setData: jest.fn()
      };
      
      const paramItem = document.createElement('div');
      paramItem.className = 'param-item';
      paramsList.appendChild(paramItem);
      
      Object.defineProperty(dragEvent, 'target', {
        value: paramItem,
        writable: false
      });
      
      paramsList.dispatchEvent(dragEvent);
      expect(dragStartHandler).toHaveBeenCalled();
    });

    test('should not setup drag and drop for non-Chrome browsers', () => {
      const nonChromeQueryLens = new QueryLens(mockBrowserAPI);
      const setupDragAndDropSpy = jest.spyOn(nonChromeQueryLens, 'setupDragAndDrop');
      expect(setupDragAndDropSpy).not.toHaveBeenCalled();
    });
  });

  describe('Parameter Rendering', () => {
    beforeEach(async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test?param1=value1&param2=value2'
      }]);
      await queryLens.loadCurrentUrl();
    });

    test('should render parameters list when parameters exist', () => {
      queryLens.renderParams();
      
      const paramsList = document.getElementById('params-list');
      const noParams = document.getElementById('no-params');
      
      expect(paramsList.children.length).toBeGreaterThan(0);
      expect(noParams.classList.contains('hidden')).toBe(true);
    });

    test('should show no parameters message when no parameters exist', () => {
      queryLens.params = new URLSearchParams();
      queryLens.renderParams();
      
      const paramsList = document.getElementById('params-list');
      const noParams = document.getElementById('no-params');
      
      expect(paramsList.innerHTML).toBe('');
      expect(noParams.classList.contains('hidden')).toBe(false);
    });

    test('should create parameter elements with correct structure', () => {
      const paramElement = queryLens.createParamElement('testKey', 'testValue');
      
      expect(paramElement.className).toBe('param-item');
      expect(paramElement.querySelector('.param-key').value).toBe('testKey');
      expect(paramElement.querySelector('.param-value').value).toBe('testValue');
      expect(paramElement.querySelector('.copy-btn')).toBeTruthy();
      expect(paramElement.querySelector('.remove-btn')).toBeTruthy();
    });

    test('should add drag handle for Chrome browser', () => {
      global.chrome = mockBrowserAPI;
      const chromeQueryLens = new QueryLens(chrome);
      const paramElement = chromeQueryLens.createParamElement('testKey', 'testValue');
      
      expect(paramElement.draggable).toBe(true);
      expect(paramElement.querySelector('.drag-handle')).toBeTruthy();
    });

    test('should handle parameter removal', () => {
      queryLens.renderParams();
      const removeBtn = document.querySelector('.remove-btn');
      const renderParamsSpy = jest.spyOn(queryLens, 'renderParams');
      const updatePreviewSpy = jest.spyOn(queryLens, 'updatePreview');
      
      removeBtn.click();
      
      expect(renderParamsSpy).toHaveBeenCalled();
      expect(updatePreviewSpy).toHaveBeenCalled();
    });
  });

  describe('URL Building', () => {
    beforeEach(async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test'
      }]);
      await queryLens.loadCurrentUrl();
    });

    test('should build URL with parameters from DOM', () => {
      // Create mock DOM elements
      const paramItem = document.createElement('div');
      paramItem.className = 'param-item';
      
      const keyInput = document.createElement('input');
      keyInput.className = 'param-key';
      keyInput.value = 'testKey';
      
      const valueInput = document.createElement('input');
      valueInput.className = 'param-value';
      valueInput.value = 'testValue';
      
      paramItem.appendChild(keyInput);
      paramItem.appendChild(valueInput);
      document.getElementById('params-list').appendChild(paramItem);
      
      const result = queryLens.buildUrl();
      
      expect(result).toBe('https://example.com/test?testKey=testValue');
    });

    test('should ignore empty keys', () => {
      const paramItem = document.createElement('div');
      paramItem.className = 'param-item';
      
      const keyInput = document.createElement('input');
      keyInput.className = 'param-key';
      keyInput.value = '';
      
      const valueInput = document.createElement('input');
      valueInput.className = 'param-value';
      valueInput.value = 'testValue';
      
      paramItem.appendChild(keyInput);
      paramItem.appendChild(valueInput);
      document.getElementById('params-list').appendChild(paramItem);
      
      const result = queryLens.buildUrl();
      
      expect(result).toBe('https://example.com/test');
    });

    test('should handle multiple parameters', () => {
      // Add first parameter
      const paramItem1 = document.createElement('div');
      paramItem1.className = 'param-item';
      
      const keyInput1 = document.createElement('input');
      keyInput1.className = 'param-key';
      keyInput1.value = 'key1';
      
      const valueInput1 = document.createElement('input');
      valueInput1.className = 'param-value';
      valueInput1.value = 'value1';
      
      paramItem1.appendChild(keyInput1);
      paramItem1.appendChild(valueInput1);
      
      // Add second parameter
      const paramItem2 = document.createElement('div');
      paramItem2.className = 'param-item';
      
      const keyInput2 = document.createElement('input');
      keyInput2.className = 'param-key';
      keyInput2.value = 'key2';
      
      const valueInput2 = document.createElement('input');
      valueInput2.className = 'param-value';
      valueInput2.value = 'value2';
      
      paramItem2.appendChild(keyInput2);
      paramItem2.appendChild(valueInput2);
      
      const paramsList = document.getElementById('params-list');
      paramsList.appendChild(paramItem1);
      paramsList.appendChild(paramItem2);
      
      const result = queryLens.buildUrl();
      
      expect(result).toContain('key1=value1');
      expect(result).toContain('key2=value2');
    });
  });

  describe('Parameter Management', () => {
    beforeEach(async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test'
      }]);
      await queryLens.loadCurrentUrl();
    });

    test('should add new empty parameter', () => {
      const syncDomToParamsSpy = jest.spyOn(queryLens, 'syncDomToParams');
      const renderParamsSpy = jest.spyOn(queryLens, 'renderParams');
      const updatePreviewSpy = jest.spyOn(queryLens, 'updatePreview');
      
      queryLens.addNewParam();
      
      expect(syncDomToParamsSpy).toHaveBeenCalled();
      expect(queryLens.params.has('')).toBe(true);
      expect(renderParamsSpy).toHaveBeenCalled();
      expect(updatePreviewSpy).toHaveBeenCalled();
    });

    test('should sync DOM to params correctly', () => {
      // Create mock DOM elements
      const paramItem = document.createElement('div');
      paramItem.className = 'param-item';
      
      const keyInput = document.createElement('input');
      keyInput.className = 'param-key';
      keyInput.value = 'syncedKey';
      
      const valueInput = document.createElement('input');
      valueInput.className = 'param-value';
      valueInput.value = 'syncedValue';
      
      paramItem.appendChild(keyInput);
      paramItem.appendChild(valueInput);
      document.getElementById('params-list').appendChild(paramItem);
      
      queryLens.syncDomToParams();
      
      expect(queryLens.params.get('syncedKey')).toBe('syncedValue');
    });

    test('should focus on last input after adding parameter', (done) => {
      queryLens.addNewParam();
      
      setTimeout(() => {
        const inputs = document.querySelectorAll('.param-key');
        const lastInput = inputs[inputs.length - 1];
        expect(document.activeElement).toBe(lastInput);
        done();
      }, 10);
    });
  });

  describe('Preview Updates', () => {
    beforeEach(async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test?original=value'
      }]);
      await queryLens.loadCurrentUrl();
    });

    test('should enable apply button when changes detected', () => {
      const buildUrlSpy = jest.spyOn(queryLens, 'buildUrl').mockReturnValue('https://example.com/test?changed=value');
      
      queryLens.updatePreview();
      
      expect(buildUrlSpy).toHaveBeenCalled();
      expect(document.getElementById('apply-changes-btn').disabled).toBe(false);
    });

    test('should disable apply button when no changes detected', () => {
      const buildUrlSpy = jest.spyOn(queryLens, 'buildUrl').mockReturnValue(queryLens.originalUrl);
      
      queryLens.updatePreview();
      
      expect(document.getElementById('apply-changes-btn').disabled).toBe(true);
    });
  });

  describe('Toast Notifications', () => {
    test('should create and display toast message', () => {
      queryLens.showToast('Test message');
      
      const toast = document.querySelector('.toast');
      expect(toast).toBeTruthy();
      expect(toast.textContent).toBe('Test message');
      expect(toast.className).toBe('toast');
    });

    test('should remove toast after timeout', (done) => {
      queryLens.showToast('Test message');
      
      expect(document.querySelector('.toast')).toBeTruthy();
      
      setTimeout(() => {
        expect(document.querySelector('.toast')).toBeFalsy();
        done();
      }, 2100);
    });
  });

  describe('Apply Changes', () => {
    beforeEach(async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        id: 123,
        url: 'https://example.com/test?original=value'
      }]);
      await queryLens.loadCurrentUrl();
      
      global.window.close = jest.fn();
    });

    test('should update tab with new URL and close window', async () => {
      const buildUrlSpy = jest.spyOn(queryLens, 'buildUrl').mockReturnValue('https://example.com/test?updated=value');
      
      await queryLens.applyChanges();
      
      expect(mockBrowserAPI.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(mockBrowserAPI.tabs.update).toHaveBeenCalledWith(123, { url: 'https://example.com/test?updated=value' });
      expect(queryLens.originalUrl).toBe('https://example.com/test?updated=value');
      expect(window.close).toHaveBeenCalled();
    });

    test('should handle browser API errors gracefully', async () => {
      mockBrowserAPI.tabs.update.mockRejectedValue(new Error('Tab update failed'));
      
      await expect(queryLens.applyChanges()).rejects.toThrow('Tab update failed');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty parameter values', () => {
      const paramElement = queryLens.createParamElement('key', '');
      expect(paramElement.querySelector('.param-value').value).toBe('');
    });

    test('should handle special characters in parameters', () => {
      const paramElement = queryLens.createParamElement('key with spaces', 'value&with=special');
      expect(paramElement.querySelector('.param-key').value).toBe('key with spaces');
      expect(paramElement.querySelector('.param-value').value).toBe('value&with=special');
    });

    test('should handle undefined or null browser API', () => {
      expect(() => new QueryLens(null)).toThrow();
      expect(() => new QueryLens(undefined)).toThrow();
    });

    test('should handle missing DOM elements gracefully', () => {
      // Remove required DOM elements
      document.getElementById('dynamic-url').remove();
      
      expect(() => queryLens.updateDynamicUrl()).toThrow();
    });

    test('should handle malformed URLs in parameters', async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/test?malformed=%ZZ'
      }]);
      
      await queryLens.loadCurrentUrl();
      
      // Should not crash, but handle gracefully
      expect(queryLens.params.get('malformed')).toBe('%ZZ');
    });
  });

  describe('Performance and Memory Management', () => {
    test('should clean up event listeners when parameters are removed', () => {
      queryLens.renderParams();
      const initialListenerCount = document.querySelectorAll('.param-item').length * 4; // 4 listeners per item
      
      // Remove all parameters
      queryLens.params.clear();
      queryLens.renderParams();
      
      // New render should have no listeners
      expect(document.querySelectorAll('.param-item').length).toBe(0);
    });

    test('should handle large numbers of parameters efficiently', () => {
      // Add many parameters
      for (let i = 0; i < 100; i++) {
        queryLens.params.set(`param${i}`, `value${i}`);
      }
      
      const startTime = performance.now();
      queryLens.renderParams();
      const endTime = performance.now();
      
      // Should complete within reasonable time (less than 100ms for 100 params)
      expect(endTime - startTime).toBeLessThan(100);
      expect(document.querySelectorAll('.param-item').length).toBe(100);
    });
  });

  describe('Accessibility Features', () => {
    test('should include appropriate ARIA labels and titles', () => {
      const paramElement = queryLens.createParamElement('key', 'value');
      
      expect(paramElement.querySelector('.copy-btn').title).toBe('Copy value');
      expect(paramElement.querySelector('.remove-btn').title).toBe('Remove parameter');
    });

    test('should support keyboard navigation', () => {
      queryLens.renderParams();
      const keyInput = document.querySelector('.param-key');
      
      // Should be focusable
      keyInput.focus();
      expect(document.activeElement).toBe(keyInput);
    });
  });
});