interface BrowserAPI {
  tabs: {
    query(queryInfo: {
      active: boolean;
      currentWindow: boolean;
    }): Promise<Array<{ id?: number; url?: string }>>;
    update(tabId: number, updateProperties: { url: string }): Promise<any>;
  };
}

interface QueryLensOptions {
  autoInit?: boolean;
}

class QueryLens {
  protected browser: BrowserAPI;
  protected originalUrl = "";
  protected currentUrl = "";
  protected params = new URLSearchParams();

  constructor(browserAPI: BrowserAPI, options: QueryLensOptions = {}) {
    this.browser = browserAPI;
    if (options.autoInit !== false) {
      this.init().catch((error) => {
        console.error("QueryLens failed to initialise", error);
        this.showToast("Unable to load the current tab URL.");
        const applyButton = document.getElementById(
          "apply-changes-btn"
        ) as HTMLButtonElement;
        if (applyButton) applyButton.disabled = true;
      });
    }
  }

  async init(): Promise<void> {
    await this.loadCurrentUrl();
    this.setupEventListeners();
    this.renderParams();
    this.updateDynamicUrl();
  }

  async loadCurrentUrl(): Promise<void> {
    const tabs = await this.browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tabUrl = tabs[0]?.url ?? "";
    let validUrl = "";
    if (
      typeof tabUrl === "string" &&
      tabUrl.trim() !== "" &&
      tabUrl.startsWith("http")
    ) {
      try {
        new URL(tabUrl);
        validUrl = tabUrl;
      } catch {}
    }
    if (validUrl) {
      this.originalUrl = validUrl;
      this.currentUrl = validUrl;
      this.params = new URLSearchParams(new URL(this.currentUrl).search);
      this.updateDynamicUrl();
    } else {
      this.originalUrl = "";
      this.currentUrl = "";
      this.params = new URLSearchParams();
    }
  }

  protected updateDynamicUrl(): void {
    const dynamicUrl = this.buildUrl();
    const url = new URL(dynamicUrl);
    const dynamicUrlDiv = document.getElementById("dynamic-url");

    if (!dynamicUrlDiv) return;

    if (!url.search) {
      dynamicUrlDiv.textContent = dynamicUrl;
      return;
    }

    const baseUrl = url.origin + url.pathname;
    const currentParams = new URLSearchParams(url.search);
    const originalParams = new URLSearchParams(
      new URL(this.originalUrl).search
    );
    const paramEntries: [string, string][] = [];
    currentParams.forEach((value, key) => paramEntries.push([key, value]));

    dynamicUrlDiv.textContent = "";
    dynamicUrlDiv.appendChild(document.createTextNode(baseUrl + "?"));

    const keyCounters = new Map<string, number>();

    paramEntries.forEach(([key, value], index) => {
      const originalValues = originalParams.getAll(key);
      const keyIndex = keyCounters.get(key) ?? 0;
      keyCounters.set(key, keyIndex + 1);

      const keyChanged = originalValues.length <= keyIndex;
      const valueChanged = !keyChanged && originalValues[keyIndex] !== value;

      if (keyChanged) {
        const keySpan = document.createElement("span");
        keySpan.className = "param-changed";
        keySpan.textContent = key;
        dynamicUrlDiv.appendChild(keySpan);
      } else {
        dynamicUrlDiv.appendChild(document.createTextNode(key));
      }

      dynamicUrlDiv.appendChild(document.createTextNode("="));

      if (valueChanged) {
        const valueSpan = document.createElement("span");
        valueSpan.className = "param-changed";
        valueSpan.textContent = value;
        dynamicUrlDiv.appendChild(valueSpan);
      } else {
        dynamicUrlDiv.appendChild(document.createTextNode(value));
      }

      if (index < paramEntries.length - 1) {
        dynamicUrlDiv.appendChild(document.createTextNode("&"));
      }
    });

    if (url.hash) {
      dynamicUrlDiv.appendChild(document.createTextNode(url.hash));
    }
  }

  protected setupEventListeners(): void {
    document.getElementById("reset-btn")?.addEventListener("click", () => {
      this.currentUrl = this.originalUrl;
      this.params = new URLSearchParams(new URL(this.currentUrl).search);
      this.renderParams();
      this.updateDynamicUrl();
      (
        document.getElementById("apply-changes-btn") as HTMLButtonElement
      ).disabled = true;
    });

    document
      .getElementById("copy-url-btn")
      ?.addEventListener("click", async () => {
        if (!navigator.clipboard) {
          this.showToast("Clipboard not available");
          return;
        }
        try {
          await navigator.clipboard.writeText(this.buildUrl());
          this.showToast("URL copied to clipboard!");
        } catch (error) {
          console.error("Clipboard operation failed:", error);
          this.showToast("Failed to copy URL");
        }
      });

    document
      .getElementById("apply-changes-btn")
      ?.addEventListener("click", async () => {
        try {
          await this.applyChanges();
        } catch (error) {
          console.error("Failed to apply changes:", error);
          this.showToast("Failed to apply changes. Please try again.");
        }
      });

    document.getElementById("add-param-btn")?.addEventListener("click", () => {
      this.addNewParam();
    });

    if (typeof chrome !== "undefined") {
      this.setupDragAndDrop();
    }
  }

  protected setupDragAndDrop(): void {
    const paramsList = document.getElementById("params-list");
    if (!paramsList) return;

    paramsList.addEventListener("dragstart", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".param-item")) {
        e.dataTransfer!.effectAllowed = "move";
        target.closest(".param-item")!.classList.add("dragging");
      }
    });

    paramsList.addEventListener("dragend", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".param-item")) {
        target.closest(".param-item")!.classList.remove("dragging");
      }
    });

    paramsList.addEventListener("dragover", (e) => {
      e.preventDefault();
      const target = e.target as HTMLElement;
      const element = target.closest(".param-item") as HTMLElement;
      if (element) {
        e.dataTransfer!.dropEffect = "move";
        const dragging = document.querySelector(".dragging") as HTMLElement;
        if (dragging && dragging !== element) {
          const rect = element.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (e.clientY < midY) {
            element.parentNode?.insertBefore(dragging, element);
          } else {
            element.parentNode?.insertBefore(dragging, element.nextSibling);
          }
          this.updatePreview();
        }
      }
    });
  }

  protected renderParams(): void {
    const paramsList = document.getElementById("params-list");
    const noParams = document.getElementById("no-params");

    if (!paramsList || !noParams) return;

    // Clear existing params
    paramsList.innerHTML = "";

    if (!this.params.toString()) {
      noParams.classList.remove("hidden");
      return;
    }

    noParams.classList.add("hidden");

    const paramEntries: [string, string][] = [];
    this.params.forEach((value, key) => paramEntries.push([key, value]));
    for (const [key, value] of paramEntries) {
      const paramDiv = this.createParamElement(key, value);
      paramsList.appendChild(paramDiv);
    }
  }

  protected createParamElement(key: string, value: string): HTMLElement {
    const div = document.createElement("div");
    div.className = "param-item";
    div.setAttribute("role", "listitem");

    if (typeof chrome !== "undefined") {
      div.draggable = true;
    }

    const paramRow = document.createElement("div");
    paramRow.className = "param-row";

    if (typeof chrome !== "undefined") {
      const dragHandle = document.createElement("div");
      dragHandle.className = "drag-handle";
      dragHandle.setAttribute("aria-label", "Drag to reorder parameter");
      dragHandle.textContent = "::";
      paramRow.appendChild(dragHandle);
    }

    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.className = "param-input";
    keyInput.value = key;
    keyInput.placeholder = "Key";
    keyInput.setAttribute("aria-label", "Parameter key");

    const valueInput = document.createElement("input");
    valueInput.type = "text";
    valueInput.className = "param-input";
    valueInput.value = value;
    valueInput.placeholder = "Value";
    valueInput.setAttribute("aria-label", "Parameter value");

    const copyBtn = document.createElement("button");
    copyBtn.className = "btn-copy";
    copyBtn.setAttribute("aria-label", "Copy parameter value to clipboard");
    copyBtn.textContent = "Copy";

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-remove";
    removeBtn.setAttribute("aria-label", "Remove this parameter");
    removeBtn.textContent = "Delete";

    paramRow.appendChild(keyInput);
    paramRow.appendChild(valueInput);
    paramRow.appendChild(copyBtn);
    paramRow.appendChild(removeBtn);
    div.appendChild(paramRow);

    keyInput.addEventListener("input", () => this.updatePreview());
    valueInput.addEventListener("input", () => this.updatePreview());
    copyBtn.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      const inputs = target
        .closest(".param-row")
        ?.querySelectorAll(".param-input") as NodeListOf<HTMLInputElement>;
      const value = inputs[1]?.value ?? "";
      if (!navigator.clipboard) {
        this.showToast("Clipboard not available");
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        this.showToast("Value copied!");
      } catch (error) {
        console.error("Clipboard operation failed:", error);
        this.showToast("Failed to copy value");
      }
    });
    removeBtn.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const paramItem = target.closest(".param-item");
      paramItem?.remove();

      // Update visibility
      const paramsList = document.getElementById("params-list");
      const noParams = document.getElementById("no-params");
      if (paramsList && noParams && paramsList.children.length === 0) {
        noParams.classList.remove("hidden");
      }

      this.updatePreview();
    });

    return div;
  }

  protected updatePreview(): void {
    const newUrl = this.buildUrl();
    const hasChanges = newUrl !== this.originalUrl;
    (
      document.getElementById("apply-changes-btn") as HTMLButtonElement
    ).disabled = !hasChanges;
    this.updateDynamicUrl();
  }

  protected addNewParam(): void {
    const paramsList = document.getElementById("params-list");
    const noParams = document.getElementById("no-params");

    if (!paramsList || !noParams) return;

    // Create new parameter element directly in DOM
    const paramDiv = this.createParamElement("", "");
    paramsList.appendChild(paramDiv);

    // Update visibility
    noParams.classList.add("hidden");

    this.updatePreview();

    // Focus the new parameter's key input
    setTimeout(() => {
      const firstInput = paramDiv.querySelector(
        ".param-input"
      ) as HTMLInputElement;
      firstInput?.focus();
    }, 0);
  }

  protected syncDomToParams(): void {
    const entries: [string, string][] = [];
    document.querySelectorAll(".param-item").forEach((item) => {
      const inputs = item.querySelectorAll(
        ".param-input"
      ) as NodeListOf<HTMLInputElement>;
      const key = inputs[0]?.value ?? "";
      const value = inputs[1]?.value ?? "";
      const trimmedKey = key.trim();
      if (trimmedKey !== "") entries.push([trimmedKey, value]);
    });
    this.params = new URLSearchParams(entries);
  }

  protected showToast(message: string): void {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 200);
    }, 1500);
  }

  async applyChanges(): Promise<void> {
    const newUrl = this.buildUrl();
    const tabs = await this.browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs[0]?.id) {
      await this.browser.tabs.update(tabs[0].id, { url: newUrl });
    }
    this.originalUrl = newUrl;
    this.currentUrl = newUrl;

    window.close();
  }

  buildUrl(): string {
    const url = new URL(this.currentUrl);
    const entries: [string, string][] = [];

    document.querySelectorAll(".param-item").forEach((item) => {
      const inputs = item.querySelectorAll(
        ".param-input"
      ) as NodeListOf<HTMLInputElement>;
      const key = inputs[0]?.value ?? "";
      const value = inputs[1]?.value ?? "";
      const trimmedKey = key.trim();
      if (trimmedKey !== "") entries.push([trimmedKey, value]);
    });

    url.search = new URLSearchParams(entries).toString();
    return url.toString();
  }
}

// Make QueryLens globally available
(window as any).QueryLens = QueryLens;
