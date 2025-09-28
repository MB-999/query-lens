class QueryLens {
  constructor(browserAPI) {
    this.browser = browserAPI;
    this.originalUrl = '';
    this.currentUrl = '';
    this.params = new URLSearchParams();
    this.init().catch((error) => {
      console.error('QueryLens failed to initialise', error);
      this.showToast('Unable to load the current tab URL.');
      const applyButton = document.getElementById('apply-changes-btn');
      if (applyButton) applyButton.disabled = true;
    });
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
    
    const keyCounters = new Map();
    
    paramEntries.forEach(([key, value], index) => {
      const originalValues = originalParams.getAll(key);
      const keyIndex = keyCounters.get(key) || 0;
      keyCounters.set(key, keyIndex + 1);
      
      const keyChanged = originalValues.length <= keyIndex;
      const valueChanged = !keyChanged && originalValues[keyIndex] !== value;
      
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

    document.getElementById('copy-url-btn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.buildUrl());
        this.showToast('URL copied to clipboard!');
      } catch {
        this.showToast('Failed to copy URL');
      }
    });

    document.getElementById('apply-changes-btn').addEventListener('click', async () => {
      try {
        await this.applyChanges();
      } catch (error) {
        console.error('Failed to apply changes:', error);
        this.showToast('Failed to apply changes. Please try again.');
      }
    });

    document.getElementById('add-param-btn').addEventListener('click', () => {
      this.addNewParam();
    });

    // Chrome-specific drag and drop functionality
    if (typeof chrome !== 'undefined' && this.browser === chrome) {
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
    
    if (typeof chrome !== 'undefined' && this.browser === chrome) {
      div.draggable = true;
    }
    
    const paramRow = document.createElement('div');
    paramRow.className = 'param-row';
    
    // Add drag handle only for Chrome
    if (typeof chrome !== 'undefined' && this.browser === chrome) {
      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.title = 'Drag to reorder';
      dragHandle.textContent = '::';
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
    copyBtn.addEventListener('click', async (e) => {
      const value = e.target.closest('.param-row').querySelector('.param-value').value;
      try {
        await navigator.clipboard.writeText(value);
        this.showToast('Value copied!');
      } catch {
        this.showToast('Failed to copy value');
      }
    });
    removeBtn.addEventListener('click', (e) => {
      e.target.closest('.param-item').remove();
      this.syncDomToParams();
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
    const entries = [];

    document.querySelectorAll('.param-item').forEach(item => {
      const key = item.querySelector('.param-key').value.trim();
      const value = item.querySelector('.param-value').value.trim();
      if (key) entries.push([key, value]);
    });

    url.search = new URLSearchParams(entries).toString();
    return url.toString();
  }

  addNewParam() {
    this.syncDomToParams();
    this.params.append('', '');
    this.renderParams();
    this.updatePreview();
    setTimeout(() => {
      const inputs = document.querySelectorAll('.param-key');
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) lastInput.focus();
    }, 0);
  }

  syncDomToParams() {
    const entries = [];
    document.querySelectorAll('.param-item').forEach(item => {
      const key = item.querySelector('.param-key').value.trim();
      const value = item.querySelector('.param-value').value.trim();
      entries.push([key, value]);
    });
    this.params = new URLSearchParams(entries);
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = QueryLens;
}
