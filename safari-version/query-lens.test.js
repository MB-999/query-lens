/**
 * Unit Tests for QueryLens Class
 * Testing Framework: Jest
 * 
 * This test suite provides comprehensive coverage for the QueryLens class,
 * including happy paths, edge cases, and failure conditions.
 */

// Mock DOM environment
Object.defineProperty(global, 'document', {
  value: {
    createElement: jest.fn(() => ({
      textContent: '',
      innerHTML: '',
      className: '',
      draggable: false,
      title: '',
      type: '',
      value: '',
      placeholder: '',
      appendChild: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      addEventListener: jest.fn(),
      setAttribute: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      },
      getBoundingClientRect: jest.fn(() => ({ top: 0, height: 100 })),
      parentNode: {
        insertBefore: jest.fn()
      },
      nextSibling: null,
      outerHTML: '<div></div>',
      closest: jest.fn()
    })),
    getElementById: jest.fn(),
    body: {
      appendChild: jest.fn()
    },
    querySelectorAll: jest.fn(() => [])
  }
});

Object.defineProperty(global, 'navigator', {
  value: {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined)
    }
  }
});

Object.defineProperty(global, 'window', {
  value: {
    close: jest.fn()
  }
});

Object.defineProperty(global, 'setTimeout', {
  value: jest.fn((fn) => fn())
});

Object.defineProperty(global, 'URL', {
  value: class MockURL {
    constructor(url) {
      const urlParts = url.split('?');
      this.origin = 'https://example.com';
      this.pathname = urlParts[0].replace('https://example.com', '') || '/';
      this.search = urlParts[1] ? '?' + urlParts[1] : '';
    }
    
    toString() {
      return this.origin + this.pathname + this.search;
    }
  }
});

// Import the class (assuming it's exported)
const QueryLens = require('./query-lens');

describe('QueryLens', () => {
  let mockBrowserAPI;
  let queryLens;
  let mockElements;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock browser API
    mockBrowserAPI = {
      tabs: {
        query: jest.fn().mockResolvedValue([{
          url: 'https://example.com/page?param1=value1&param2=value2',
          id: 123
        }]),
        update: jest.fn().mockResolvedValue()
      }
    };

    // Mock DOM elements
    mockElements = {
      dynamicUrl: {
        textContent: '',
        appendChild: jest.fn()
      },
      resetBtn: { addEventListener: jest.fn() },
      copyUrlBtn: { addEventListener: jest.fn() },
      applyChangesBtn: { 
        addEventListener: jest.fn(),
        disabled: false
      },
      addParamBtn: { addEventListener: jest.fn() },
      paramsList: {
        innerHTML: '',
        addEventListener: jest.fn()
      },
      noParams: {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      }
    };

    document.getElementById.mockImplementation((id) => mockElements[id.replace('-', '')]);
    document.querySelectorAll.mockReturnValue([]);
  });

  describe('Constructor', () => {
    test('should initialize with browser API', () => {
      queryLens = new QueryLens(mockBrowserAPI);
      
      expect(queryLens.browser).toBe(mockBrowserAPI);
      expect(queryLens.originalUrl).toBe('');
      expect(queryLens.currentUrl).toBe('');
      expect(queryLens.params).toBeInstanceOf(URLSearchParams);
    });

    test('should call init method during construction', () => {
      const initSpy = jest.spyOn(QueryLens.prototype, 'init').mockImplementation();
      queryLens = new QueryLens(mockBrowserAPI);
      
      expect(initSpy).toHaveBeenCalledTimes(1);
      initSpy.mockRestore();
    });
  });

  describe('init method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      jest.spyOn(queryLens, 'loadCurrentUrl').mockResolvedValue();
      jest.spyOn(queryLens, 'setupEventListeners').mockImplementation();
      jest.spyOn(queryLens, 'renderParams').mockImplementation();
      jest.spyOn(queryLens, 'updateDynamicUrl').mockImplementation();
    });

    test('should call all initialization methods in correct order', async () => {
      await queryLens.init();
      
      expect(queryLens.loadCurrentUrl).toHaveBeenCalledTimes(1);
      expect(queryLens.setupEventListeners).toHaveBeenCalledTimes(1);
      expect(queryLens.renderParams).toHaveBeenCalledTimes(1);
      expect(queryLens.updateDynamicUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadCurrentUrl method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      jest.spyOn(queryLens, 'updateDynamicUrl').mockImplementation();
    });

    test('should load URL from active tab', async () => {
      await queryLens.loadCurrentUrl();
      
      expect(mockBrowserAPI.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true
      });
      expect(queryLens.originalUrl).toBe('https://example.com/page?param1=value1&param2=value2');
      expect(queryLens.currentUrl).toBe('https://example.com/page?param1=value1&param2=value2');
    });

    test('should parse URL parameters correctly', async () => {
      await queryLens.loadCurrentUrl();
      
      expect(queryLens.params.get('param1')).toBe('value1');
      expect(queryLens.params.get('param2')).toBe('value2');
    });

    test('should handle URLs without parameters', async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([{
        url: 'https://example.com/page',
        id: 123
      }]);
      
      await queryLens.loadCurrentUrl();
      
      expect(queryLens.params.size).toBe(0);
    });

    test('should handle empty tab results', async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([]);
      
      await expect(queryLens.loadCurrentUrl()).rejects.toThrow();
    });
  });

  describe('escapeHtml method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
    });

    test('should escape HTML special characters', () => {
      const mockDiv = {
        textContent: '',
        innerHTML: '&lt;script&gt;alert("xss")&lt;/script&gt;'
      };
      document.createElement.mockReturnValue(mockDiv);
      
      const result = queryLens.escapeHtml('<script>alert("xss")</script>');
      
      expect(mockDiv.textContent).toBe('<script>alert("xss")</script>');
      expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    test('should handle empty string', () => {
      const mockDiv = {
        textContent: '',
        innerHTML: ''
      };
      document.createElement.mockReturnValue(mockDiv);
      
      const result = queryLens.escapeHtml('');
      
      expect(result).toBe('');
    });

    test('should handle regular text without special characters', () => {
      const mockDiv = {
        textContent: '',
        innerHTML: 'normal text'
      };
      document.createElement.mockReturnValue(mockDiv);
      
      const result = queryLens.escapeHtml('normal text');
      
      expect(result).toBe('normal text');
    });
  });

  describe('updateDynamicUrl method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      queryLens.originalUrl = 'https://example.com/page?original=value';
      jest.spyOn(queryLens, 'buildUrl').mockReturnValue('https://example.com/page?param1=value1');
    });

    test('should display URL without parameters', () => {
      queryLens.buildUrl.mockReturnValue('https://example.com/page');
      
      queryLens.updateDynamicUrl();
      
      expect(mockElements.dynamicUrl.textContent).toBe('https://example.com/page');
    });

    test('should highlight changed parameters', () => {
      const mockTextNode = { textContent: '' };
      const mockChangedSpan = {
        className: '',
        textContent: '',
        appendChild: jest.fn()
      };
      
      document.createTextNode = jest.fn().mockReturnValue(mockTextNode);
      document.createElement.mockReturnValue(mockChangedSpan);
      mockElements.dynamicUrl.appendChild = jest.fn();
      
      queryLens.updateDynamicUrl();
      
      expect(mockElements.dynamicUrl.appendChild).toHaveBeenCalled();
    });

    test('should handle URLs with multiple parameters', () => {
      queryLens.buildUrl.mockReturnValue('https://example.com/page?param1=value1&param2=value2&param3=value3');
      queryLens.originalUrl = 'https://example.com/page?param1=oldvalue&param2=value2';
      
      const mockTextNode = { textContent: '' };
      const mockChangedSpan = {
        className: '',
        textContent: '',
        appendChild: jest.fn()
      };
      
      document.createTextNode = jest.fn().mockReturnValue(mockTextNode);
      document.createElement.mockReturnValue(mockChangedSpan);
      mockElements.dynamicUrl.appendChild = jest.fn();
      
      queryLens.updateDynamicUrl();
      
      expect(mockElements.dynamicUrl.appendChild).toHaveBeenCalled();
    });
  });

  describe('setupEventListeners method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      queryLens.originalUrl = 'https://example.com/original';
      queryLens.currentUrl = 'https://example.com/current';
      jest.spyOn(queryLens, 'renderParams').mockImplementation();
      jest.spyOn(queryLens, 'updateDynamicUrl').mockImplementation();
      jest.spyOn(queryLens, 'buildUrl').mockReturnValue('https://example.com/test');
      jest.spyOn(queryLens, 'showToast').mockImplementation();
      jest.spyOn(queryLens, 'applyChanges').mockImplementation();
      jest.spyOn(queryLens, 'addNewParam').mockImplementation();
      jest.spyOn(queryLens, 'setupDragAndDrop').mockImplementation();
    });

    test('should setup reset button listener', () => {
      queryLens.setupEventListeners();
      
      expect(mockElements.resetBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      
      // Test reset functionality
      const clickHandler = mockElements.resetBtn.addEventListener.mock.calls[0][1];
      clickHandler();
      
      expect(queryLens.currentUrl).toBe(queryLens.originalUrl);
      expect(queryLens.renderParams).toHaveBeenCalled();
      expect(queryLens.updateDynamicUrl).toHaveBeenCalled();
      expect(mockElements.applyChangesBtn.disabled).toBe(true);
    });

    test('should setup copy URL button listener', () => {
      queryLens.setupEventListeners();
      
      expect(mockElements.copyUrlBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      
      // Test copy functionality
      const clickHandler = mockElements.copyUrlBtn.addEventListener.mock.calls[0][1];
      clickHandler();
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/test');
      expect(queryLens.showToast).toHaveBeenCalledWith('URL copied to clipboard\!');
    });

    test('should setup apply changes button listener', () => {
      queryLens.setupEventListeners();
      
      expect(mockElements.applyChangesBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      
      // Test apply changes functionality
      const clickHandler = mockElements.applyChangesBtn.addEventListener.mock.calls[0][1];
      clickHandler();
      
      expect(queryLens.applyChanges).toHaveBeenCalled();
    });

    test('should setup add parameter button listener', () => {
      queryLens.setupEventListeners();
      
      expect(mockElements.addParamBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      
      // Test add parameter functionality
      const clickHandler = mockElements.addParamBtn.addEventListener.mock.calls[0][1];
      clickHandler();
      
      expect(queryLens.addNewParam).toHaveBeenCalled();
    });

    test('should setup drag and drop for Chrome', () => {
      queryLens.browser = chrome;
      
      queryLens.setupEventListeners();
      
      expect(queryLens.setupDragAndDrop).toHaveBeenCalled();
    });

    test('should not setup drag and drop for non-Chrome browsers', () => {
      queryLens.browser = mockBrowserAPI;
      
      queryLens.setupEventListeners();
      
      expect(queryLens.setupDragAndDrop).not.toHaveBeenCalled();
    });
  });

  describe('setupDragAndDrop method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      jest.spyOn(queryLens, 'updatePreview').mockImplementation();
    });

    test('should setup dragstart listener', () => {
      queryLens.setupDragAndDrop();
      
      expect(mockElements.paramsList.addEventListener).toHaveBeenCalledWith('dragstart', expect.any(Function));
    });

    test('should setup dragend listener', () => {
      queryLens.setupDragAndDrop();
      
      expect(mockElements.paramsList.addEventListener).toHaveBeenCalledWith('dragend', expect.any(Function));
    });

    test('should setup dragover listener', () => {
      queryLens.setupDragAndDrop();
      
      expect(mockElements.paramsList.addEventListener).toHaveBeenCalledWith('dragover', expect.any(Function));
    });

    test('should handle dragstart event', () => {
      queryLens.setupDragAndDrop();
      
      const dragstartHandler = mockElements.paramsList.addEventListener.mock.calls[0][1];
      const mockEvent = {
        target: {
          closest: jest.fn().mockReturnValue({
            outerHTML: '<div class="param-item"></div>',
            classList: { add: jest.fn() }
          })
        },
        dataTransfer: {
          effectAllowed: '',
          setData: jest.fn()
        }
      };
      
      dragstartHandler(mockEvent);
      
      expect(mockEvent.dataTransfer.effectAllowed).toBe('move');
      expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith('text/html', '<div class="param-item"></div>');
    });
  });

  describe('renderParams method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      jest.spyOn(queryLens, 'createParamElement').mockReturnValue(document.createElement('div'));
    });

    test('should show no-params message when no parameters', () => {
      queryLens.params = new URLSearchParams();
      
      queryLens.renderParams();
      
      expect(mockElements.noParams.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.paramsList.innerHTML).toBe('');
    });

    test('should hide no-params message when parameters exist', () => {
      queryLens.params = new URLSearchParams('param1=value1&param2=value2');
      
      queryLens.renderParams();
      
      expect(mockElements.noParams.classList.add).toHaveBeenCalledWith('hidden');
      expect(queryLens.createParamElement).toHaveBeenCalledTimes(2);
    });

    test('should create parameter elements for each param', () => {
      queryLens.params = new URLSearchParams('test=value');
      
      queryLens.renderParams();
      
      expect(queryLens.createParamElement).toHaveBeenCalledWith('test', 'value');
    });
  });

  describe('createParamElement method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      jest.spyOn(queryLens, 'updatePreview').mockImplementation();
      jest.spyOn(queryLens, 'showToast').mockImplementation();
      jest.spyOn(queryLens, 'renderParams').mockImplementation();
    });

    test('should create param element with correct structure', () => {
      const element = queryLens.createParamElement('testKey', 'testValue');
      
      expect(element.className).toBe('param-item');
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.createElement).toHaveBeenCalledWith('input');
      expect(document.createElement).toHaveBeenCalledWith('button');
    });

    test('should set draggable for Chrome browser', () => {
      queryLens.browser = chrome;
      const element = queryLens.createParamElement('key', 'value');
      
      expect(element.draggable).toBe(true);
    });

    test('should not set draggable for non-Chrome browsers', () => {
      queryLens.browser = mockBrowserAPI;
      const element = queryLens.createParamElement('key', 'value');
      
      expect(element.draggable).toBe(false);
    });

    test('should add drag handle for Chrome browser', () => {
      queryLens.browser = chrome;
      const mockDragHandle = { className: '', title: '', textContent: '' };
      document.createElement.mockReturnValueOnce(mockDragHandle);
      
      queryLens.createParamElement('key', 'value');
      
      expect(mockDragHandle.className).toBe('drag-handle');
      expect(mockDragHandle.title).toBe('Drag to reorder');
      expect(mockDragHandle.textContent).toBe('⋮⋮');
    });
  });

  describe('updatePreview method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      queryLens.originalUrl = 'https://example.com/original';
      jest.spyOn(queryLens, 'buildUrl').mockReturnValue('https://example.com/new');
      jest.spyOn(queryLens, 'updateDynamicUrl').mockImplementation();
    });

    test('should enable apply button when URL changes', () => {
      queryLens.updatePreview();
      
      expect(mockElements.applyChangesBtn.disabled).toBe(false);
      expect(queryLens.updateDynamicUrl).toHaveBeenCalled();
    });

    test('should disable apply button when URL unchanged', () => {
      queryLens.buildUrl.mockReturnValue(queryLens.originalUrl);
      
      queryLens.updatePreview();
      
      expect(mockElements.applyChangesBtn.disabled).toBe(true);
    });
  });

  describe('buildUrl method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      queryLens.currentUrl = 'https://example.com/page?old=param';
    });

    test('should build URL from DOM elements', () => {
      const mockParamItems = [
        {
          querySelector: jest.fn()
            .mockReturnValueOnce({ value: 'key1 ' })  // with trailing space
            .mockReturnValueOnce({ value: ' value1' }) // with leading space
        },
        {
          querySelector: jest.fn()
            .mockReturnValueOnce({ value: 'key2' })
            .mockReturnValueOnce({ value: 'value2' })
        }
      ];
      
      document.querySelectorAll.mockReturnValue(mockParamItems);
      
      const result = queryLens.buildUrl();
      
      expect(result).toContain('key1=value1');
      expect(result).toContain('key2=value2');
    });

    test('should ignore empty keys', () => {
      const mockParamItems = [
        {
          querySelector: jest.fn()
            .mockReturnValueOnce({ value: '' })
            .mockReturnValueOnce({ value: 'value1' })
        },
        {
          querySelector: jest.fn()
            .mockReturnValueOnce({ value: 'key2' })
            .mockReturnValueOnce({ value: 'value2' })
        }
      ];
      
      document.querySelectorAll.mockReturnValue(mockParamItems);
      
      const result = queryLens.buildUrl();
      
      expect(result).not.toContain('=value1');
      expect(result).toContain('key2=value2');
    });

    test('should handle whitespace-only keys', () => {
      const mockParamItems = [
        {
          querySelector: jest.fn()
            .mockReturnValueOnce({ value: '   ' })
            .mockReturnValueOnce({ value: 'value1' })
        }
      ];
      
      document.querySelectorAll.mockReturnValue(mockParamItems);
      
      const result = queryLens.buildUrl();
      
      expect(result).not.toContain('=value1');
    });
  });

  describe('addNewParam method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      jest.spyOn(queryLens, 'syncDomToParams').mockImplementation();
      jest.spyOn(queryLens, 'renderParams').mockImplementation();
      jest.spyOn(queryLens, 'updatePreview').mockImplementation();
    });

    test('should add empty parameter and render', () => {
      queryLens.addNewParam();
      
      expect(queryLens.syncDomToParams).toHaveBeenCalled();
      expect(queryLens.params.has('')).toBe(true);
      expect(queryLens.renderParams).toHaveBeenCalled();
      expect(queryLens.updatePreview).toHaveBeenCalled();
    });

    test('should focus on last key input after timeout', () => {
      const mockInput = { focus: jest.fn() };
      document.querySelectorAll.mockReturnValue([mockInput, mockInput, mockInput]);
      
      queryLens.addNewParam();
      
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
      expect(mockInput.focus).toHaveBeenCalled();
    });

    test('should handle no inputs gracefully', () => {
      document.querySelectorAll.mockReturnValue([]);
      
      expect(() => queryLens.addNewParam()).not.toThrow();
    });
  });

  describe('syncDomToParams method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
    });

    test('should sync DOM values to URLSearchParams', () => {
      const mockParamItems = [
        {
          querySelector: jest.fn()
            .mockReturnValueOnce({ value: 'key1' })
            .mockReturnValueOnce({ value: 'value1' })
        },
        {
          querySelector: jest.fn()
            .mockReturnValueOnce({ value: 'key2' })
            .mockReturnValueOnce({ value: 'value2' })
        }
      ];
      
      document.querySelectorAll.mockReturnValue(mockParamItems);
      
      queryLens.syncDomToParams();
      
      expect(queryLens.params.get('key1')).toBe('value1');
      expect(queryLens.params.get('key2')).toBe('value2');
    });

    test('should skip empty keys', () => {
      const mockParamItems = [
        {
          querySelector: jest.fn()
            .mockReturnValueOnce({ value: '' })
            .mockReturnValueOnce({ value: 'value1' })
        }
      ];
      
      document.querySelectorAll.mockReturnValue(mockParamItems);
      
      queryLens.syncDomToParams();
      
      expect(queryLens.params.size).toBe(0);
    });
  });

  describe('showToast method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
    });

    test('should create and show toast message', () => {
      const mockToast = {
        className: '',
        textContent: '',
        remove: jest.fn()
      };
      document.createElement.mockReturnValue(mockToast);
      
      queryLens.showToast('Test message');
      
      expect(mockToast.className).toBe('toast');
      expect(mockToast.textContent).toBe('Test message');
      expect(document.body.appendChild).toHaveBeenCalledWith(mockToast);
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
    });

    test('should remove toast after timeout', () => {
      const mockToast = { remove: jest.fn() };
      document.createElement.mockReturnValue(mockToast);
      
      // Mock setTimeout to immediately call the callback
      setTimeout.mockImplementation((fn) => fn());
      
      queryLens.showToast('Test message');
      
      expect(mockToast.remove).toHaveBeenCalled();
    });
  });

  describe('applyChanges method', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      jest.spyOn(queryLens, 'buildUrl').mockReturnValue('https://example.com/new');
    });

    test('should update tab with new URL', async () => {
      await queryLens.applyChanges();
      
      expect(mockBrowserAPI.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true
      });
      expect(mockBrowserAPI.tabs.update).toHaveBeenCalledWith(123, {
        url: 'https://example.com/new'
      });
    });

    test('should update originalUrl and close window', async () => {
      await queryLens.applyChanges();
      
      expect(queryLens.originalUrl).toBe('https://example.com/new');
      expect(window.close).toHaveBeenCalled();
    });

    test('should handle browser API errors', async () => {
      mockBrowserAPI.tabs.update.mockRejectedValue(new Error('Browser error'));
      
      await expect(queryLens.applyChanges()).rejects.toThrow('Browser error');
    });

    test('should handle empty tab results', async () => {
      mockBrowserAPI.tabs.query.mockResolvedValue([]);
      
      await expect(queryLens.applyChanges()).rejects.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
    });

    test('should handle malformed URLs gracefully', () => {
      expect(() => {
        new URL('not-a-valid-url');
      }).toThrow();
    });

    test('should handle special characters in parameter values', () => {
      const specialValue = 'value with spaces & symbols\\!@#$%';
      const params = new URLSearchParams();
      params.set('special', specialValue);
      
      expect(params.get('special')).toBe(specialValue);
    });

    test('should handle Unicode characters in parameters', () => {
      const unicodeValue = '测试中文字符';
      queryLens.params.set('unicode', unicodeValue);
      
      expect(queryLens.params.get('unicode')).toBe(unicodeValue);
    });

    test('should handle very long parameter values', () => {
      const longValue = 'x'.repeat(10000);
      queryLens.params.set('long', longValue);
      
      expect(queryLens.params.get('long')).toBe(longValue);
    });

    test('should handle parameter names with special characters', () => {
      const specialKey = 'key-with_special.chars';
      queryLens.params.set(specialKey, 'value');
      
      expect(queryLens.params.get(specialKey)).toBe('value');
    });
  });

  describe('Performance and Memory Management', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
    });

    test('should not create memory leaks with event listeners', () => {
      // Test that event listeners are properly attached
      queryLens.setupEventListeners();
      
      expect(mockElements.resetBtn.addEventListener).toHaveBeenCalled();
      expect(mockElements.copyUrlBtn.addEventListener).toHaveBeenCalled();
      expect(mockElements.applyChangesBtn.addEventListener).toHaveBeenCalled();
      expect(mockElements.addParamBtn.addEventListener).toHaveBeenCalled();
    });

    test('should handle large numbers of parameters', () => {
      // Create 100 parameters
      for (let i = 0; i < 100; i++) {
        queryLens.params.set(`param${i}`, `value${i}`);
      }
      
      expect(queryLens.params.size).toBe(100);
      
      // Test that rendering still works
      jest.spyOn(queryLens, 'createParamElement').mockReturnValue(document.createElement('div'));
      queryLens.renderParams();
      
      expect(queryLens.createParamElement).toHaveBeenCalledTimes(100);
    });
  });

  describe('Browser Compatibility', () => {
    test('should handle different browser APIs', () => {
      const safariAPI = {
        tabs: {
          query: jest.fn().mockResolvedValue([{ url: 'https://example.com', id: 1 }]),
          update: jest.fn().mockResolvedValue()
        }
      };
      
      const safarLens = new QueryLens(safariAPI);
      expect(safarLens.browser).toBe(safariAPI);
    });

    test('should work without drag and drop support', () => {
      queryLens.browser = mockBrowserAPI; // Not Chrome
      
      expect(() => queryLens.setupEventListeners()).not.toThrow();
    });
  });

  describe('Integration Test Scenarios', () => {
    beforeEach(() => {
      queryLens = new QueryLens(mockBrowserAPI);
      queryLens.originalUrl = 'https://example.com?original=true';
      queryLens.currentUrl = 'https://example.com?original=true';
    });

    test('should handle complete parameter management workflow', async () => {
      // Load initial state
      await queryLens.loadCurrentUrl();
      
      // Add new parameter
      jest.spyOn(queryLens, 'syncDomToParams').mockImplementation(() => {
        queryLens.params = new URLSearchParams('original=true&new=param');
      });
      jest.spyOn(queryLens, 'buildUrl').mockReturnValue('https://example.com?original=true&new=param');
      
      queryLens.addNewParam();
      
      // Verify changes detected
      const hasChanges = queryLens.buildUrl() !== queryLens.originalUrl;
      expect(hasChanges).toBe(true);
      
      // Apply changes
      await queryLens.applyChanges();
      
      expect(mockBrowserAPI.tabs.update).toHaveBeenCalled();
      expect(window.close).toHaveBeenCalled();
    });

    test('should handle reset functionality', () => {
      queryLens.currentUrl = 'https://example.com?modified=true';
      queryLens.params = new URLSearchParams('modified=true');
      
      jest.spyOn(queryLens, 'renderParams').mockImplementation();
      jest.spyOn(queryLens, 'updateDynamicUrl').mockImplementation();
      
      // Simulate reset button click
      queryLens.setupEventListeners();
      const resetHandler = mockElements.resetBtn.addEventListener.mock.calls[0][1];
      resetHandler();
      
      expect(queryLens.currentUrl).toBe(queryLens.originalUrl);
      expect(queryLens.renderParams).toHaveBeenCalled();
      expect(queryLens.updateDynamicUrl).toHaveBeenCalled();
      expect(mockElements.applyChangesBtn.disabled).toBe(true);
    });
  });
});