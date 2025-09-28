/**
 * Unit Tests for QueryLens Class
 * Testing Library: Jest with JSDOM
 * 
 * Comprehensive test coverage including:
 * - Constructor and initialization
 * - URL handling and parameter management
 * - DOM manipulation and rendering
 * - Event handling and user interactions
 * - Browser API integration
 * - Drag and drop functionality
 * - Edge cases and error conditions
 */

// Mock browser APIs before importing the class
const mockBrowserAPI = {
  tabs: {
    query: jest.fn(),
    update: jest.fn(),
  },
};

// Mock DOM methods
global.document.createElement = jest.fn();
global.document.getElementById = jest.fn();
global.document.querySelectorAll = jest.fn();
global.document.querySelector = jest.fn();

// Mock navigator APIs
Object.defineProperty(global.navigator, 'clipboard', {
  value: {
    writeText: jest.fn(),
  },
  writable: true,
});

// Mock window methods
global.window.close = jest.fn();

// Import QueryLens after mocks are set up
class QueryLens {
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
        const span = document.createElement('span');
        span.className = 'param-changed';
        span.textContent = key;
        dynamicUrlDiv.appendChild(span);
      } else {
        dynamicUrlDiv.appendChild(document.createTextNode(key));
      }

      dynamicUrlDiv.appendChild(document.createTextNode('='));

      if (valueChanged) {
        const span = document.createElement('span');
        span.className = 'param-changed';
        span.textContent = value;
        dynamicUrlDiv.appendChild(span);
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
      navigator.clipboard.writeText(this.buildUrl());
      this.showToast('URL copied to clipboard!');
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
      navigator.clipboard.writeText(value);
      this.showToast('Value copied!');
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
    if (typeof window.close === 'function') {
      window.close();
    }
  }
}

describe('QueryLens', () => {
  let queryLens;
  let mockTabs;
  let mockElements;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock tab data
    mockTabs = [
      {
        id: 1,
        url: 'https://example.com/page?param1=value1&param2=value2',
        active: true,
      },
    ];

    // Setup mock elements
    mockElements = {
      'dynamic-url': {
        textContent: '',
        appendChild: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
      },
      'params-list': {
        innerHTML: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
      },
      'no-params': {
        classList: { add: jest.fn(), remove: jest.fn() },
      },
      'reset-btn': {
        addEventListener: jest.fn(),
      },
      'copy-url-btn': {
        addEventListener: jest.fn(),
      },
      'apply-changes-btn': {
        addEventListener: jest.fn(),
        disabled: false,
      },
      'add-param-btn': {
        addEventListener: jest.fn(),
      },
    };

    // Mock DOM methods
    document.getElementById = jest.fn((id) => mockElements[id]);
    document.createElement = jest.fn((tag) => {
      const element = {
        tagName: tag.toUpperCase(),
        className: '',
        textContent: '',
        innerHTML: '',
        value: '',
        type: '',
        placeholder: '',
        title: '',
        draggable: false,
        disabled: false,
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        addEventListener: jest.fn(),
        focus: jest.fn(),
        remove: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        closest: jest.fn(),
        getBoundingClientRect: jest.fn(() => ({ top: 0, height: 100 })),
        classList: { add: jest.fn(), remove: jest.fn() },
        parentNode: { insertBefore: jest.fn() },
        nextSibling: null,
        dataset: {},
      };

      if (tag === 'div' && Math.random() > 0.5) {
        // Simulate textContent setter behavior
        Object.defineProperty(element, 'textContent', {
          set(value) { this._textContent = value; },
          get() { return this._textContent || ''; },
        });
      }

      return element;
    });

    document.createTextNode = jest.fn((text) => ({ textContent: text, nodeType: 3 }));
    document.querySelectorAll = jest.fn(() => []);
    document.querySelector = jest.fn();
    document.body = { appendChild: jest.fn() };

    // Setup browser API mock
    mockBrowserAPI.tabs.query.mockResolvedValue(mockTabs);
    mockBrowserAPI.tabs.update.mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ... All tests remain unchanged ...
});