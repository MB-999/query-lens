/**
 * Unit tests for chrome-version/query-lens.js
 * Testing library/framework: Jest with JSDOM environment
 */

const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, '../../chrome-version/query-lens.js');

// Helpers to (re)initialize DOM skeleton required by QueryLens
function setDomSkeleton() {
  document.body.innerHTML = `
    <div id="dynamic-url"></div>
    <button id="reset-btn"></button>
    <button id="copy-url-btn"></button>
    <button id="apply-changes-btn"></button>
    <button id="add-param-btn"></button>
    <div id="params-list"></div>
    <div id="no-params" class="hidden"></div>
  `;
}

function setClipboardMock() {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
}

async function createInstance(initialUrl = 'https://example.com/page?param1=value1&param2=value2') {
  jest.resetModules();
  setDomSkeleton();
  setClipboardMock();

  // Provide a chrome-like browser API and make it global
  global.chrome = {
    tabs: {
      query: jest.fn().mockResolvedValue([{ url: initialUrl, id: 101 }]),
      update: jest.fn().mockResolvedValue(undefined),
    }
  };

  let QueryLens;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    QueryLens = require(SRC_PATH);
  });

  const instance = new QueryLens(chrome);
  // Ensure async init is completed
  await instance.init();
  return instance;
}

describe('QueryLens (chrome-version)', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  describe('initialization and URL parsing', () => {
    test('loads current tab URL and parses params on init', async () => {
      const ql = await createInstance();
      expect(ql.originalUrl).toBe('https://example.com/page?param1=value1&param2=value2');
      expect(ql.currentUrl).toBe('https://example.com/page?param1=value1&param2=value2');
      expect(ql.params.get('param1')).toBe('value1');
      expect(ql.params.get('param2')).toBe('value2');
    });

    test('handles URL with no query string', async () => {
      const ql = await createInstance('https://example.com/page');
      expect(ql.params.toString()).toBe('');
    });
  });

  describe('escapeHtml', () => {
    test('escapes special HTML characters', async () => {
      const ql = await createInstance();
      const out = ql.escapeHtml('<script>alert(1)</script>');
      expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    test('handles empty, null, and plain text inputs', async () => {
      const ql = await createInstance();
      expect(ql.escapeHtml('')).toBe('');
      expect(ql.escapeHtml('hello')).toBe('hello');
      // In JSDOM, setting textContent = null results in "null" innerHTML
      expect(ql.escapeHtml(null)).toBe('null');
    });
  });

  describe('updateDynamicUrl rendering', () => {
    test('shows full URL when no search params present', async () => {
      const ql = await createInstance('https://example.com/page');
      const spy = jest.spyOn(ql, 'buildUrl').mockReturnValue('https://example.com/page');
      ql.updateDynamicUrl();
      expect(document.getElementById('dynamic-url').textContent).toBe('https://example.com/page');
      spy.mockRestore();
    });

    test('highlights changed keys/values correctly', async () => {
      const ql = await createInstance('https://example.com/page?param1=a&foo=b');
      jest.spyOn(ql, 'buildUrl').mockReturnValue('https://example.com/page?param1=c&bar=d');

      ql.updateDynamicUrl();

      const changed = Array.from(document.querySelectorAll('#dynamic-url .param-changed'))
                           .map(el => el.textContent);
      // Expected: value for param1 ('c') changed, new key 'bar' and its value 'd' are highlighted
      expect(changed).toEqual(expect.arrayContaining(['c', 'bar', 'd']));
      expect(changed.length).toBe(3);
    });
  });

  describe('event listeners wiring', () => {
    test('setupEventListeners attaches handlers to all buttons', async () => {
      const ql = await createInstance();
      const reset = document.getElementById('reset-btn');
      const copy = document.getElementById('copy-url-btn');
      const apply = document.getElementById('apply-changes-btn');
      const add   = document.getElementById('add-param-btn');

      // Simulate clicks to ensure handlers are bound
      const renderSpy = jest.spyOn(ql, 'renderParams').mockImplementation(() => {});
      const updateDynamicSpy = jest.spyOn(ql, 'updateDynamicUrl').mockImplementation(() => {});
      const applySpy = jest.spyOn(ql, 'applyChanges').mockResolvedValue();
      const addSpy = jest.spyOn(ql, 'addNewParam').mockImplementation(() => {});

      reset.click();
      copy.click();
      apply.click();
      add.click();

      expect(renderSpy).toHaveBeenCalled();         // reset path
      expect(updateDynamicSpy).toHaveBeenCalled();  // reset path
      expect(applySpy).toHaveBeenCalled();          // apply path
      expect(addSpy).toHaveBeenCalled();            // add param path
    });

    test('reset button restores original URL and disables apply', async () => {
      const ql = await createInstance();
      ql.currentUrl = 'https://example.com/changed';
      document.getElementById('apply-changes-btn').disabled = false;

      document.getElementById('reset-btn').click();

      expect(ql.currentUrl).toBe(ql.originalUrl);
      expect(document.getElementById('apply-changes-btn').disabled).toBe(true);
    });

    test('copy URL success shows success toast', async () => {
      const ql = await createInstance();
      jest.spyOn(ql, 'buildUrl').mockReturnValue('https://example.com/out');
      const toastSpy = jest.spyOn(ql, 'showToast').mockImplementation(() => {});
      await navigator.clipboard.writeText.mockResolvedValue(undefined);

      document.getElementById('copy-url-btn').click();
      // Allow promise microtasks to resolve
      await Promise.resolve();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/out');
      // On success, only success toast should show
      expect(toastSpy).toHaveBeenLastCalledWith('URL copied to clipboard\!');
    });

    test('copy URL failure shows error then success toast (per catch().then() chain)', async () => {
      const ql = await createInstance();
      jest.spyOn(ql, 'buildUrl').mockReturnValue('https://example.com/out');
      const toastSpy = jest.spyOn(ql, 'showToast').mockImplementation(() => {});
      await navigator.clipboard.writeText.mockRejectedValue(new Error('fail'));

      document.getElementById('copy-url-btn').click();
      await Promise.resolve();

      expect(toastSpy).toHaveBeenNthCalledWith(1, 'Failed to copy URL');
      expect(toastSpy).toHaveBeenNthCalledWith(2, 'URL copied to clipboard\!');
    });
  });

  describe('drag & drop (Chrome only)', () => {
    test('adds drag event listeners to #params-list when using chrome API', async () => {
      const ql = await createInstance();
      const list = document.getElementById('params-list');
      const addListenerSpy = jest.spyOn(list, 'addEventListener');

      ql.setupDragAndDrop();

      const events = addListenerSpy.mock.calls.map(call => call[0]);
      expect(events).toEqual(expect.arrayContaining(['dragstart', 'dragend', 'dragover']));
    });
  });

  describe('rendering parameters', () => {
    test('shows "no params" when params are empty', async () => {
      const ql = await createInstance();
      ql.params = new URLSearchParams();
      ql.renderParams();

      expect(document.getElementById('no-params').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('params-list').children.length).toBe(0);
    });

    test('creates elements for each parameter', async () => {
      const ql = await createInstance();
      ql.renderParams();
      const items = document.querySelectorAll('#params-list .param-item');
      expect(items.length).toBe(2); // param1 & param2 from initial URL
      expect(items[0].querySelector('.param-key').value).toBeDefined();
      expect(items[0].querySelector('.param-value').value).toBeDefined();
    });
  });

  describe('createParamElement', () => {
    test('structure includes inputs and buttons, draggable on Chrome', async () => {
      const ql = await createInstance();
      const el = ql.createParamElement('k', 'v');
      expect(el.className).toBe('param-item');
      // Drag handle for Chrome is included
      expect(el.querySelector('.drag-handle').textContent).toBe('⋮⋮');
      expect(el.querySelector('input.param-key').value).toBe('k');
      expect(el.querySelector('input.param-value').value).toBe('v');
      expect(el.querySelector('button.copy-btn')).toBeTruthy();
      expect(el.querySelector('button.remove-btn')).toBeTruthy();
    });
  });

  describe('buildUrl and syncDomToParams', () => {
    test('buildUrl uses DOM order, trims whitespace and ignores empty keys', async () => {
      const ql = await createInstance('https://example.com/page?x=1');

      // Create three param DOM items (one with empty key)
      const makeItem = (k, v) => {
        const item = document.createElement('div');
        item.className = 'param-item';
        const key = document.createElement('input'); key.className = 'param-key'; key.value = k;
        const val = document.createElement('input'); val.className = 'param-value'; val.value = v;
        item.appendChild(key); item.appendChild(val);
        return item;
      };
      const list = document.getElementById('params-list');
      list.appendChild(makeItem('  key1  ', '  value1  '));
      list.appendChild(makeItem('', 'valueX'));       // ignored
      list.appendChild(makeItem('key2', 'value2'));

      const out = ql.buildUrl();
      expect(out).toBe('https://example.com/page?key1=value1&key2=value2');
    });

    test('syncDomToParams collects params and drops empty keys', async () => {
      const ql = await createInstance();
      const makeItem = (k, v) => {
        const item = document.createElement('div');
        item.className = 'param-item';
        const key = document.createElement('input'); key.className = 'param-key'; key.value = k;
        const val = document.createElement('input'); val.className = 'param-value'; val.value = v;
        item.appendChild(key); item.appendChild(val);
        return item;
      };
      const list = document.getElementById('params-list');
      list.appendChild(makeItem('keyA', 'A'));
      list.appendChild(makeItem('', 'B')); // ignored

      ql.syncDomToParams();
      expect(ql.params.get('keyA')).toBe('A');
      expect(ql.params.has('')).toBe(false);
    });

    test('duplicate keys in DOM keep the last value', async () => {
      const ql = await createInstance('https://example.com/page');
      const makeItem = (k, v) => {
        const item = document.createElement('div');
        item.className = 'param-item';
        const key = document.createElement('input'); key.className = 'param-key'; key.value = k;
        const val = document.createElement('input'); val.className = 'param-value'; val.value = v;
        item.appendChild(key); item.appendChild(val);
        return item;
      };
      const list = document.getElementById('params-list');
      list.appendChild(makeItem('dup', 'first'));
      list.appendChild(makeItem('dup', 'second'));

      const out = ql.buildUrl();
      expect(out).toBe('https://example.com/page?dup=second');
    });
  });

  describe('addNewParam', () => {
    test('adds empty param and focuses last key input', async () => {
      jest.useFakeTimers();
      const ql = await createInstance();
      const focusSpy = jest.spyOn(HTMLInputElement.prototype, 'focus');

      ql.addNewParam();
      // Run the setTimeout within addNewParam
      jest.runOnlyPendingTimers();

      // Rendered list should now include an empty key field
      const keys = Array.from(document.querySelectorAll('.param-key')).map(i => i.value);
      expect(keys[keys.length - 1]).toBe('');
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('updatePreview', () => {
    test('enables apply button when URL changes, disables when unchanged', async () => {
      const ql = await createInstance();
      const btn = document.getElementById('apply-changes-btn');
      expect(btn.disabled).toBe(false); // default state not forced by init

      const spyBuild = jest.spyOn(ql, 'buildUrl').mockReturnValue('https://example.com/changed');
      const spyDyn = jest.spyOn(ql, 'updateDynamicUrl').mockImplementation(() => {});
      ql.updatePreview();
      expect(btn.disabled).toBe(false);

      spyBuild.mockReturnValue(ql.originalUrl);
      ql.updatePreview();
      expect(btn.disabled).toBe(true);

      spyDyn.mockRestore();
      spyBuild.mockRestore();
    });
  });

  describe('showToast', () => {
    test('creates and auto-removes toast after 2s', async () => {
      jest.useFakeTimers();
      const ql = await createInstance();
      ql.showToast('Hello');
      const toast = document.querySelector('.toast');
      expect(toast).toBeTruthy();
      expect(toast.textContent).toBe('Hello');
      jest.advanceTimersByTime(2001);
      expect(document.querySelector('.toast')).toBeNull();
    });
  });

  describe('applyChanges', () => {
    test('updates tab URL and closes window', async () => {
      const ql = await createInstance();
      const newUrl = 'https://example.com/updated';
      jest.spyOn(ql, 'buildUrl').mockReturnValue(newUrl);

      await ql.applyChanges();

      expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(chrome.tabs.update).toHaveBeenCalledWith(101, { url: newUrl });
      expect(ql.originalUrl).toBe(newUrl);
      expect(window.close).toHaveBeenCalled();
    });
  });
});