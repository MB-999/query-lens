// Load QueryLens file to execute it
import "./query-lens";

// Access QueryLens from global scope
declare global {
  interface Window {
    QueryLens: any;
  }
}

const QueryLens = (globalThis as any).QueryLens || (window as any).QueryLens;

// Mock chrome API
const mockChrome = {
  tabs: {
    query: jest.fn(),
    update: jest.fn(),
  },
};

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

// Mock window.close
Object.defineProperty(window, "close", {
  value: jest.fn(),
  writable: true,
});

// Mock console methods
jest.spyOn(console, "error").mockImplementation(() => {});

describe("QueryLens", () => {
  let queryLens: QueryLens;
  let mockTab: any;

  beforeEach(() => {
    // Clear any existing toasts
    document.querySelectorAll(".toast").forEach((toast) => toast.remove());

    document.body.innerHTML = `
      <div class="container">
        <div class="header">
          <h1>QueryLens</h1>
          <div class="buttons">
            <button id="reset-btn" class="btn">Reset</button>
            <button id="copy-url-btn" class="btn">Copy URL</button>
            <button id="apply-changes-btn" class="btn" disabled>Apply Changes</button>
          </div>
        </div>
        <div class="url-display">
          <div id="dynamic-url"></div>
        </div>
        <div class="params-section">
          <div class="params-header">
            <h2>Query Parameters</h2>
            <button id="add-param-btn" class="btn">Add Parameter</button>
          </div>
          <div id="no-params" class="no-params hidden">No query parameters found</div>
          <div id="params-list" class="params-list"></div>
        </div>
      </div>
    `;

    mockTab = {
      id: 1,
      url: "https://example.com?param1=value1&param2=value2",
    };

    jest.clearAllMocks();
    mockChrome.tabs.query.mockResolvedValue([mockTab]);
    mockChrome.tabs.update.mockResolvedValue({});

    // Reset clipboard mock
    if (navigator.clipboard) {
      (navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined);
    }

    queryLens = new QueryLens(mockChrome, { autoInit: false });
  });

  describe("initialization", () => {
    it("should initialize with browser API", () => {
      expect(queryLens).toBeInstanceOf(QueryLens);
    });

    it("should load current URL and parse parameters", async () => {
      await queryLens.init();

      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
      // Verify initialization by checking DOM state
      const dynamicUrl = document.getElementById("dynamic-url");
      expect(dynamicUrl?.textContent).toContain("example.com");
    });
  });

  describe("parameter management", () => {
    beforeEach(async () => {
      await queryLens.init();
    });

    it("should render parameters from URL", () => {
      const paramsList = document.getElementById("params-list");
      const paramItems = paramsList?.querySelectorAll(".param-item");

      expect(paramItems?.length).toBe(2);
    });

    it("should show no parameters message when URL has no query string", async () => {
      mockTab.url = "https://example.com";
      mockChrome.tabs.query.mockResolvedValue([mockTab]);

      await queryLens.init();

      const noParams = document.getElementById("no-params");
      expect(noParams?.classList.contains("hidden")).toBe(false);
    });

    it("should add new parameter", () => {
      const addBtn = document.getElementById("add-param-btn");
      addBtn?.click();

      const paramItems = document.querySelectorAll(".param-item");
      expect(paramItems.length).toBe(3);
    });

    it("should remove parameter", () => {
      const initialCount = document.querySelectorAll(".param-item").length;
      const removeBtn = document.querySelector(
        ".btn-remove"
      ) as HTMLButtonElement;
      removeBtn?.click();

      const paramItems = document.querySelectorAll(".param-item");
      expect(paramItems.length).toBe(initialCount - 1);
    });
  });

  describe("URL building", () => {
    beforeEach(async () => {
      await queryLens.init();
    });

    it("should build URL from DOM parameters", () => {
      const url = queryLens.buildUrl();
      expect(url).toContain("param1=value1");
      expect(url).toContain("param2=value2");
    });

    it("should handle empty parameters", () => {
      document.getElementById("params-list")!.innerHTML = "";

      const url = queryLens.buildUrl();
      expect(url).toMatch(/^https:\/\/example\.com\/?$/);
    });

    it("should trim whitespace from parameter keys", () => {
      // Add parameter with whitespace
      const addBtn = document.getElementById("add-param-btn");
      addBtn?.click();

      const paramItems = document.querySelectorAll(".param-item");
      const lastItem = paramItems[paramItems.length - 1];
      const inputs = lastItem.querySelectorAll(
        ".param-input"
      ) as NodeListOf<HTMLInputElement>;
      inputs[0].value = "  spaced key  ";
      inputs[1].value = "value";

      const url = queryLens.buildUrl();
      expect(url).toContain("spaced+key=value");
    });

    it("should exclude empty keys from URL", () => {
      const addBtn = document.getElementById("add-param-btn");
      addBtn?.click();

      const paramItems = document.querySelectorAll(".param-item");
      const lastItem = paramItems[paramItems.length - 1];
      const inputs = lastItem.querySelectorAll(
        ".param-input"
      ) as NodeListOf<HTMLInputElement>;
      inputs[0].value = "   "; // Only whitespace
      inputs[1].value = "value";

      const url = queryLens.buildUrl();
      const paramCount = (url.match(/=/g) || []).length;
      expect(paramCount).toBe(2); // Only original params
    });
  });

  describe("clipboard operations", () => {
    beforeEach(async () => {
      await queryLens.init();
    });

    it("should copy URL to clipboard", async () => {
      const copyBtn = document.getElementById("copy-url-btn");
      copyBtn?.click();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("example.com")
      );
    });

    it("should copy parameter value to clipboard", async () => {
      const copyBtn = document.querySelector(".btn-copy") as HTMLButtonElement;
      copyBtn?.click();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("value1");

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector(".toast")?.textContent).toBe(
        "Value copied!"
      );
    });
  });

  describe("URL navigation", () => {
    beforeEach(async () => {
      await queryLens.init();
    });

    it("should apply changes and navigate to new URL", async () => {
      await queryLens.applyChanges();

      expect(mockChrome.tabs.update).toHaveBeenCalledWith(mockTab.id, {
        url: expect.stringContaining("example.com"),
      });
      expect(window.close).toHaveBeenCalled();
    });

    it("should reset to original URL and disable apply button", () => {
      const resetBtn = document.getElementById("reset-btn");
      resetBtn?.click();

      const applyBtn = document.getElementById(
        "apply-changes-btn"
      ) as HTMLButtonElement;
      expect(applyBtn.disabled).toBe(true);
    });

    it("should enable apply button when changes are made", () => {
      const valueInput = document.querySelector(
        ".param-input:nth-child(2)"
      ) as HTMLInputElement;
      valueInput.value = "changed";
      valueInput.dispatchEvent(new Event("input"));

      const applyBtn = document.getElementById(
        "apply-changes-btn"
      ) as HTMLButtonElement;
      expect(applyBtn.disabled).toBe(false);
    });
  });

  describe("dynamic URL display", () => {
    beforeEach(async () => {
      await queryLens.init();
    });

    it("should update dynamic URL display", () => {
      const dynamicUrl = document.getElementById("dynamic-url");
      expect(dynamicUrl?.textContent).toContain("example.com");
    });

    it("should highlight changed parameters", () => {
      // Change a parameter value
      const valueInput = document.querySelector(
        ".param-input:nth-child(2)"
      ) as HTMLInputElement;
      valueInput.value = "newvalue";
      valueInput.dispatchEvent(new Event("input"));

      const dynamicUrl = document.getElementById("dynamic-url");
      const changedSpans = dynamicUrl?.querySelectorAll(".param-changed");
      expect(changedSpans?.length).toBeGreaterThan(0);
    });

    it("should highlight new parameter keys", () => {
      const addBtn = document.getElementById("add-param-btn");
      addBtn?.click();

      const paramItems = document.querySelectorAll(".param-item");
      const lastItem = paramItems[paramItems.length - 1];
      const inputs = lastItem.querySelectorAll(
        ".param-input"
      ) as NodeListOf<HTMLInputElement>;
      inputs[0].value = "newkey";
      inputs[1].value = "newvalue";
      inputs[0].dispatchEvent(new Event("input"));

      const dynamicUrl = document.getElementById("dynamic-url");
      const changedSpans = dynamicUrl?.querySelectorAll(".param-changed");
      expect(changedSpans?.length).toBeGreaterThan(0);
    });

    it("should not highlight unchanged parameters", () => {
      const dynamicUrl = document.getElementById("dynamic-url");
      const changedSpans = dynamicUrl?.querySelectorAll(".param-changed");
      expect(changedSpans?.length).toBe(0);
    });

    it("should handle URL fragments in dynamic display", async () => {
      mockTab.url = "https://example.com?param1=value1#fragment";
      mockChrome.tabs.query.mockResolvedValue([mockTab]);

      await queryLens.init();

      const dynamicUrl = document.getElementById("dynamic-url");
      expect(dynamicUrl?.textContent).toContain("#fragment");
    });

    it("should show URL without query params when none exist", async () => {
      mockTab.url = "https://example.com";
      mockChrome.tabs.query.mockResolvedValue([mockTab]);

      await queryLens.init();

      const dynamicUrl = document.getElementById("dynamic-url");
      expect(dynamicUrl?.textContent).toBe("https://example.com/");
    });

    it("should handle multiple parameters with same key", async () => {
      mockTab.url = "https://example.com?key=value1&key=value2";
      mockChrome.tabs.query.mockResolvedValue([mockTab]);

      await queryLens.init();

      const dynamicUrl = document.getElementById("dynamic-url");
      expect(dynamicUrl?.textContent).toContain("key=value1");
      expect(dynamicUrl?.textContent).toContain("key=value2");
    });
  });

  describe("parameter synchronization", () => {
    beforeEach(async () => {
      await queryLens.init();
    });

    it("should sync DOM changes to params on remove", () => {
      const initialCount = document.querySelectorAll(".param-item").length;
      const removeBtn = document.querySelector(
        ".btn-remove"
      ) as HTMLButtonElement;
      removeBtn?.click();

      const newCount = document.querySelectorAll(".param-item").length;
      expect(newCount).toBe(initialCount - 1);
    });

    it("should focus new parameter input after adding", async () => {
      const addBtn = document.getElementById("add-param-btn");
      addBtn?.click();

      await new Promise((resolve) => setTimeout(resolve, 10));
      const focusedElement = document.activeElement;
      expect(focusedElement?.classList.contains("param-input")).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle clipboard API not available for URL copy", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
      });

      await queryLens.init();
      const copyBtn = document.getElementById("copy-url-btn");
      copyBtn?.click();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector(".toast")?.textContent).toBe(
        "Clipboard not available"
      );
    });

    it("should handle clipboard API not available for parameter copy", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
      });

      await queryLens.init();
      const copyBtn = document.querySelector(".btn-copy") as HTMLButtonElement;
      copyBtn?.click();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector(".toast")?.textContent).toBe(
        "Clipboard not available"
      );
    });

    it("should handle clipboard write failure", async () => {
      const mockClipboard = {
        writeText: jest.fn().mockRejectedValue(new Error("Clipboard error")),
      };
      Object.defineProperty(navigator, "clipboard", {
        value: mockClipboard,
        writable: true,
      });

      await queryLens.init();
      const copyBtn = document.getElementById("copy-url-btn");
      copyBtn?.click();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector(".toast")?.textContent).toBe(
        "Failed to copy URL"
      );
    });

    it("should handle tab query failure during initialization", async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error("Tab access denied"));

      const queryLensWithAutoInit = new QueryLens(mockChrome);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(console.error).toHaveBeenCalledWith(
        "QueryLens failed to initialise",
        expect.any(Error)
      );

      const applyBtn = document.getElementById(
        "apply-changes-btn"
      ) as HTMLButtonElement;
      expect(applyBtn.disabled).toBe(true);
    });

    it("should handle tab update failure", async () => {
      await queryLens.init();
      mockChrome.tabs.update.mockRejectedValue(new Error("Update failed"));

      const applyBtn = document.getElementById("apply-changes-btn");
      // Make a change to enable the button
      const valueInput = document.querySelector(
        ".param-input:nth-child(2)"
      ) as HTMLInputElement;
      valueInput.value = "changed";
      valueInput.dispatchEvent(new Event("input"));

      applyBtn?.click();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector(".toast")?.textContent).toBe(
        "Failed to apply changes. Please try again."
      );
    });

    it("should handle parameter copy clipboard failure", async () => {
      const mockClipboard = {
        writeText: jest.fn().mockRejectedValue(new Error("Copy failed")),
      };
      Object.defineProperty(navigator, "clipboard", {
        value: mockClipboard,
        writable: true,
      });

      await queryLens.init();
      const copyBtn = document.querySelector(".btn-copy") as HTMLButtonElement;
      copyBtn?.click();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector(".toast")?.textContent).toBe(
        "Failed to copy value"
      );
    });

    it("should handle missing DOM elements gracefully", async () => {
      document.getElementById("dynamic-url")?.remove();

      await queryLens.init();

      // Should not throw error
      expect(true).toBe(true);
    });

    it("should handle invalid URL during initialization", async () => {
      mockTab.url = "invalid-url";
      mockChrome.tabs.query.mockResolvedValue([mockTab]);

      const queryLensWithAutoInit = new QueryLens(mockChrome);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should handle empty tab array", async () => {
      mockChrome.tabs.query.mockResolvedValue([]);

      const queryLensWithAutoInit = new QueryLens(mockChrome);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(console.error).not.toHaveBeenCalled();
    });

    it("should handle missing tab ID during apply changes", async () => {
      mockTab.id = undefined;
      mockChrome.tabs.query.mockResolvedValue([mockTab]);

      await queryLens.init();
      await queryLens.applyChanges();

      expect(mockChrome.tabs.update).not.toHaveBeenCalled();
    });
  });

  describe("toast notifications", () => {
    beforeEach(async () => {
      await queryLens.init();
    });

    it("should show toast on successful copy", async () => {
      const copyBtn = document.getElementById("copy-url-btn");
      copyBtn?.click();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector(".toast")?.textContent).toBe(
        "URL copied to clipboard!"
      );
    });

    it("should auto-remove toast after timeout", async () => {
      const copyBtn = document.getElementById("copy-url-btn");
      copyBtn?.click();

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(document.querySelector(".toast")).toBeTruthy();

      await new Promise((resolve) => setTimeout(resolve, 1800));
      expect(document.querySelector(".toast")).toBeFalsy();
    });
  });

  describe("drag and drop", () => {
    beforeEach(async () => {
      // Mock chrome to enable drag and drop
      (globalThis as any).chrome = {};
      await queryLens.init();
    });

    afterEach(() => {
      delete (globalThis as any).chrome;
    });

    it("should add drag handles when chrome is available", () => {
      const dragHandles = document.querySelectorAll(".drag-handle");
      expect(dragHandles.length).toBe(2);
    });

    it("should make param items draggable", () => {
      const paramItems = document.querySelectorAll(".param-item");
      paramItems.forEach((item) => {
        expect((item as HTMLElement).draggable).toBe(true);
      });
    });
  });
});
