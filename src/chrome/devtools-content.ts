class DevToolsQueryLens extends QueryLens {
  constructor() {
    const devToolsBrowserAPI = {
      tabs: {
        query: async () => {
          try {
            const tabId = chrome.devtools.inspectedWindow.tabId;
            const tab = await chrome.tabs.get(tabId);
            return [{ id: tabId, url: tab.url }];
          } catch (error) {
            console.error("Failed to get inspected tab:", error);
            return [];
          }
        },
        update: async (tabId: number, updateProperties: { url: string }) => {
          await chrome.tabs.update(tabId, updateProperties);
        },
      },
    };
    super(devToolsBrowserAPI, { autoInit: false });
    this.startUrlMonitoring();
  }

  async loadCurrentUrl(): Promise<void> {
    return new Promise((resolve) => {
      chrome.devtools.inspectedWindow.eval(
        "window.location.href",
        (result: string, exceptionInfo: any) => {
          if (
            !result ||
            (exceptionInfo &&
              (exceptionInfo.isError || exceptionInfo.isException))
          ) {
            this.showToast("Unable to read the inspected URL", "error");
            (
              document.getElementById("apply-changes-btn") as HTMLButtonElement
            ).disabled = true;
            return resolve();
          }
          try {
            this.originalUrl = result;
            this.currentUrl = result;
            this.params = new URLSearchParams(new URL(this.currentUrl).search);
            this.setupEventListeners();
            this.renderParams();
            this.updateDynamicUrl();
            resolve();
          } catch (error) {
            console.error("Failed to parse URL:", error);
            this.showToast("Invalid URL format", "error");
            (
              document.getElementById("apply-changes-btn") as HTMLButtonElement
            ).disabled = true;
            resolve();
          }
        }
      );
    });
  }

  startUrlMonitoring(): void {
    chrome.devtools.network.onNavigated.addListener((url: string) => {
      try {
        this.originalUrl = url;
        this.currentUrl = url;
        this.params = new URLSearchParams(new URL(this.currentUrl).search);
        this.renderParams();
        this.updateDynamicUrl();
        (
          document.getElementById("apply-changes-btn") as HTMLButtonElement
        ).disabled = true;
      } catch (error) {
        console.error("Failed to parse navigated URL:", error);
        this.showToast("Invalid URL format", "error");
      }
    });
  }

  protected async copyToClipboard(text: string): Promise<boolean> {
    try {
      // DevTools context blocks Clipboard API, use execCommand
      const textarea = document.createElement("textarea");
      textarea.value = text;
      // Textarea could briefly appear on screen, prevent causing a visual flicker.
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch (error) {
      console.error("Clipboard operation failed:", error);
      return false;
    }
  }

  protected setupEventListeners(): void {
    super.setupEventListeners();

    // Override copy button behavior to use DevTools clipboard method
    const copyUrlBtn = document.getElementById("copy-url-btn");
    if (copyUrlBtn) {
      copyUrlBtn.replaceWith(copyUrlBtn.cloneNode(true));
      document
        .getElementById("copy-url-btn")
        ?.addEventListener("click", async () => {
          const success = await this.copyToClipboard(this.buildUrl());
          if (success) {
            this.showToast("URL copied to clipboard!");
          } else {
            this.showToast("Failed to copy URL", "error");
          }
        });
    }
  }

  protected createParamElement(key: string, value: string): HTMLElement {
    const div = super.createParamElement(key, value);

    const copyBtn = div.querySelector(".btn-copy");
    if (copyBtn) {
      const newCopyBtn = copyBtn.cloneNode(true) as HTMLElement;
      copyBtn.replaceWith(newCopyBtn);

      newCopyBtn.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        const inputs = target
          .closest(".param-row")
          ?.querySelectorAll(".param-input") as NodeListOf<HTMLInputElement>;
        const value = inputs[1]?.value ?? "";
        const success = await this.copyToClipboard(value);
        if (success) {
          this.showToast("Value copied!");
        } else {
          this.showToast("Failed to copy value", "error");
        }
      });
    }

    return div;
  }

  async applyChanges(): Promise<void> {
    const newUrl = this.buildUrl();
    chrome.devtools.inspectedWindow.eval(
      `window.location.href = ${JSON.stringify(newUrl)}`,
      (result: any, exceptionInfo: any) => {
        if (exceptionInfo?.isException) {
          this.showToast("Failed to apply changes", "error");
        } else {
          this.originalUrl = newUrl;
          this.currentUrl = newUrl;
          this.showToast("Changes applied!");
          (
            document.getElementById("apply-changes-btn") as HTMLButtonElement
          ).disabled = true;
        }
      }
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const queryLens = new DevToolsQueryLens();
  queryLens.loadCurrentUrl();
});
