"use strict";
class DevToolsQueryLens extends QueryLens {
    constructor() {
        const devToolsBrowserAPI = {
            tabs: {
                query: async () => {
                    try {
                        const tabId = chrome.devtools.inspectedWindow.tabId;
                        const tab = await chrome.tabs.get(tabId);
                        return [{ id: tabId, url: tab.url }];
                    }
                    catch (error) {
                        console.error("Failed to get inspected tab:", error);
                        return [];
                    }
                },
                update: async (tabId, updateProperties) => {
                    await chrome.tabs.update(tabId, updateProperties);
                },
            },
        };
        super(devToolsBrowserAPI, { autoInit: false });
        this.startUrlMonitoring();
    }
    async loadCurrentUrl() {
        return new Promise((resolve) => {
            chrome.devtools.inspectedWindow.eval("window.location.href", (result, exceptionInfo) => {
                if (!result ||
                    (exceptionInfo &&
                        (exceptionInfo.isError || exceptionInfo.isException))) {
                    this.showToast("Unable to read the inspected URL", "error");
                    document.getElementById("apply-changes-btn").disabled = true;
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
                }
                catch (error) {
                    console.error("Failed to parse URL:", error);
                    this.showToast("Invalid URL format", "error");
                    document.getElementById("apply-changes-btn").disabled = true;
                    resolve();
                }
            });
        });
    }
    startUrlMonitoring() {
        chrome.devtools.network.onNavigated.addListener((url) => {
            try {
                this.originalUrl = url;
                this.currentUrl = url;
                this.params = new URLSearchParams(new URL(this.currentUrl).search);
                this.renderParams();
                this.updateDynamicUrl();
                document.getElementById("apply-changes-btn").disabled = true;
            }
            catch (error) {
                console.error("Failed to parse navigated URL:", error);
                this.showToast("Invalid URL format", "error");
            }
        });
    }
    async copyToClipboard(text) {
        try {
            // DevTools context blocks Clipboard API, use execCommand
            const textarea = document.createElement("textarea");
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand("copy");
            document.body.removeChild(textarea);
            return success;
        }
        catch (error) {
            console.error("Clipboard operation failed:", error);
            return false;
        }
    }
    setupEventListeners() {
        var _a;
        super.setupEventListeners();
        // Override copy button behavior to use DevTools clipboard method
        const copyUrlBtn = document.getElementById("copy-url-btn");
        if (copyUrlBtn) {
            copyUrlBtn.replaceWith(copyUrlBtn.cloneNode(true));
            (_a = document
                .getElementById("copy-url-btn")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", async () => {
                const success = await this.copyToClipboard(this.buildUrl());
                if (success) {
                    this.showToast("URL copied to clipboard!");
                }
                else {
                    this.showToast("Failed to copy URL", "error");
                }
            });
        }
    }
    createParamElement(key, value) {
        const div = super.createParamElement(key, value);
        const copyBtn = div.querySelector(".btn-copy");
        if (copyBtn) {
            const newCopyBtn = copyBtn.cloneNode(true);
            copyBtn.replaceWith(newCopyBtn);
            newCopyBtn.addEventListener("click", async (e) => {
                var _a, _b, _c;
                const target = e.target;
                const inputs = (_a = target
                    .closest(".param-row")) === null || _a === void 0 ? void 0 : _a.querySelectorAll(".param-input");
                const value = (_c = (_b = inputs[1]) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : "";
                const success = await this.copyToClipboard(value);
                if (success) {
                    this.showToast("Value copied!");
                }
                else {
                    this.showToast("Failed to copy value", "error");
                }
            });
        }
        return div;
    }
    async applyChanges() {
        const newUrl = this.buildUrl();
        chrome.devtools.inspectedWindow.eval(`window.location.href = ${JSON.stringify(newUrl)}`, (result, exceptionInfo) => {
            if (exceptionInfo === null || exceptionInfo === void 0 ? void 0 : exceptionInfo.isException) {
                this.showToast("Failed to apply changes", "error");
            }
            else {
                this.originalUrl = newUrl;
                this.showToast("Changes applied!");
                document.getElementById("apply-changes-btn").disabled = true;
            }
        });
    }
}
document.addEventListener("DOMContentLoaded", () => {
    const queryLens = new DevToolsQueryLens();
    queryLens.loadCurrentUrl();
});
//# sourceMappingURL=devtools-content.js.map