class DevToolsQueryLens extends QueryLens {
  constructor() {
    super(chrome);
  }

  async loadCurrentUrl() {
    return new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(
        'window.location.href',
        (result) => {
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
  
  async applyChanges() {
    const newUrl = this.buildUrl();
    chrome.devtools.inspectedWindow.eval(
      'window.location.href = arguments[0]',
      [newUrl]
    );
    this.originalUrl = newUrl;
    this.showToast('Changes applied!');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new DevToolsQueryLens();
});
