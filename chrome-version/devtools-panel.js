class DevToolsQueryLens extends QueryLens {
  constructor() {
    super(chrome);
  }

  async copyToClipboard(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  async loadCurrentUrl() {
    return new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(
        'window.location.href',
        (result, exceptionInfo) => {
          if (!result || (exceptionInfo && (exceptionInfo.isError || exceptionInfo.isException))) {
            this.showToast('Unable to read the inspected URL');
            document.getElementById('apply-changes-btn').disabled = true;
            return resolve();
          }
          this.originalUrl = result;
          this.currentUrl = result;
          this.params = new URLSearchParams(new URL(this.currentUrl).search);
          this.updateDynamicUrl();
          this.renderParams();
          resolve();
        }
      );
    });
  }

  startUrlMonitoring() {
    chrome.devtools.network.onNavigated.addListener((url) => {
      this.originalUrl = url;
      this.currentUrl = url;
      this.params = new URLSearchParams(new URL(this.currentUrl).search);
      this.renderParams();
      this.updateDynamicUrl();
      document.getElementById('apply-changes-btn').disabled = true;
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
      const success = await this.copyToClipboard(this.buildUrl());
      this.showToast(success ? 'URL copied to clipboard!' : 'Failed to copy URL');
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

    if (typeof chrome !== 'undefined' && this.browser === chrome) {
      this.setupDragAndDrop();
    }
  }

  createParamElement(key, value) {
    const div = super.createParamElement(key, value);
    
    // Override copy button behavior for devtools
    const copyBtn = div.querySelector('.copy-btn');
    copyBtn.replaceWith(copyBtn.cloneNode(true));
    const newCopyBtn = div.querySelector('.copy-btn');
    
    newCopyBtn.addEventListener('click', async (e) => {
      const value = e.target.closest('.param-row')?.querySelector('.param-value')?.value ?? '';
      const success = await this.copyToClipboard(value);
      this.showToast(success ? 'Value copied!' : 'Failed to copy value');
    });
    
    return div;
  }

  async applyChanges() {
    const newUrl = this.buildUrl();
    chrome.devtools.inspectedWindow.eval(
      `window.location.href = ${JSON.stringify(newUrl)}`,
      (result, isException) => {
        if (isException) {
          this.showToast('Failed to apply changes');
        } else {
          this.originalUrl = newUrl;
          this.showToast('Changes applied!');
          document.getElementById('apply-changes-btn').disabled = true;
        }
      }
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const queryLens = new DevToolsQueryLens();
  queryLens.startUrlMonitoring();
});
