"use strict";
class QueryLens {
    constructor(browserAPI, options = {}) {
        this.originalUrl = "";
        this.currentUrl = "";
        this.params = new URLSearchParams();
        this.browser = browserAPI;
        if (options.autoInit !== false) {
            this.init().catch((error) => {
                console.error("QueryLens failed to initialise", error);
                this.showToast("Unable to load the current tab URL.", "error");
                const applyButton = document.getElementById("apply-changes-btn");
                if (applyButton)
                    applyButton.disabled = true;
            });
        }
    }
    async init() {
        await this.loadCurrentUrl();
        this.setupEventListeners();
        this.renderParams();
        this.updateDynamicUrl();
    }
    async loadCurrentUrl() {
        var _a, _b;
        const tabs = await this.browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        const tabUrl = (_b = (_a = tabs[0]) === null || _a === void 0 ? void 0 : _a.url) !== null && _b !== void 0 ? _b : "";
        let validUrl = "";
        if (typeof tabUrl === "string" &&
            tabUrl.trim() !== "" &&
            tabUrl.startsWith("http")) {
            try {
                new URL(tabUrl);
                validUrl = tabUrl;
            }
            catch (_c) { }
        }
        if (validUrl) {
            this.originalUrl = validUrl;
            this.currentUrl = validUrl;
            this.params = new URLSearchParams(new URL(this.currentUrl).search);
            this.updateDynamicUrl();
        }
        else {
            this.originalUrl = "";
            this.currentUrl = "";
            this.params = new URLSearchParams();
        }
    }
    updateDynamicUrl() {
        const dynamicUrlDiv = document.getElementById("dynamic-url");
        if (!dynamicUrlDiv)
            return;
        const dynamicUrl = this.buildUrl();
        if (!dynamicUrl) {
            dynamicUrlDiv.textContent = "";
            return;
        }
        const url = new URL(dynamicUrl);
        if (!url.search) {
            dynamicUrlDiv.textContent = dynamicUrl;
            return;
        }
        const baseUrl = url.origin + url.pathname;
        const currentParams = new URLSearchParams(url.search);
        const originalParams = new URLSearchParams(new URL(this.originalUrl).search);
        const paramEntries = [];
        currentParams.forEach((value, key) => paramEntries.push([key, value]));
        dynamicUrlDiv.textContent = "";
        dynamicUrlDiv.appendChild(document.createTextNode(baseUrl + "?"));
        const keyCounters = new Map();
        paramEntries.forEach(([key, value], index) => {
            var _a;
            const originalValues = originalParams.getAll(key);
            const keyIndex = (_a = keyCounters.get(key)) !== null && _a !== void 0 ? _a : 0;
            keyCounters.set(key, keyIndex + 1);
            const keyChanged = originalValues.length <= keyIndex;
            const valueChanged = !keyChanged && originalValues[keyIndex] !== value;
            if (keyChanged) {
                const keySpan = document.createElement("span");
                keySpan.className = "param-changed";
                keySpan.textContent = key;
                dynamicUrlDiv.appendChild(keySpan);
            }
            else {
                dynamicUrlDiv.appendChild(document.createTextNode(key));
            }
            dynamicUrlDiv.appendChild(document.createTextNode("="));
            if (valueChanged) {
                const valueSpan = document.createElement("span");
                valueSpan.className = "param-changed";
                valueSpan.textContent = value;
                dynamicUrlDiv.appendChild(valueSpan);
            }
            else {
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
    setupEventListeners() {
        var _a, _b, _c, _d;
        (_a = document.getElementById("reset-btn")) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => {
            this.currentUrl = this.originalUrl;
            this.params = this.currentUrl
                ? new URLSearchParams(new URL(this.currentUrl).search)
                : new URLSearchParams();
            this.renderParams();
            this.updateDynamicUrl();
            document.getElementById("apply-changes-btn").disabled = true;
        });
        (_b = document
            .getElementById("copy-url-btn")) === null || _b === void 0 ? void 0 : _b.addEventListener("click", async () => {
            if (!navigator.clipboard) {
                this.showToast("Clipboard not available", "error");
                return;
            }
            try {
                await navigator.clipboard.writeText(this.buildUrl());
                this.showToast("URL copied to clipboard!");
            }
            catch (error) {
                console.error("Clipboard operation failed:", error);
                this.showToast("Failed to copy URL", "error");
            }
        });
        (_c = document
            .getElementById("apply-changes-btn")) === null || _c === void 0 ? void 0 : _c.addEventListener("click", async () => {
            try {
                await this.applyChanges();
            }
            catch (error) {
                console.error("Failed to apply changes:", error);
                this.showToast("Failed to apply changes. Please try again.", "error");
            }
        });
        (_d = document.getElementById("add-param-btn")) === null || _d === void 0 ? void 0 : _d.addEventListener("click", () => {
            this.addNewParam();
        });
        if (typeof chrome !== "undefined") {
            this.setupDragAndDrop();
        }
    }
    setupDragAndDrop() {
        const paramsList = document.getElementById("params-list");
        if (!paramsList)
            return;
        paramsList.addEventListener("dragstart", (e) => {
            const target = e.target;
            if (target.closest(".param-item")) {
                e.dataTransfer.effectAllowed = "move";
                target.closest(".param-item").classList.add("dragging");
            }
        });
        paramsList.addEventListener("dragend", (e) => {
            const target = e.target;
            if (target.closest(".param-item")) {
                target.closest(".param-item").classList.remove("dragging");
            }
        });
        paramsList.addEventListener("dragover", (e) => {
            var _a, _b;
            e.preventDefault();
            const target = e.target;
            const element = target.closest(".param-item");
            if (element) {
                e.dataTransfer.dropEffect = "move";
                const dragging = document.querySelector(".dragging");
                if (dragging && dragging !== element) {
                    const rect = element.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        (_a = element.parentNode) === null || _a === void 0 ? void 0 : _a.insertBefore(dragging, element);
                    }
                    else {
                        (_b = element.parentNode) === null || _b === void 0 ? void 0 : _b.insertBefore(dragging, element.nextSibling);
                    }
                    this.updatePreview();
                }
            }
        });
    }
    renderParams() {
        const paramsList = document.getElementById("params-list");
        const noParams = document.getElementById("no-params");
        if (!paramsList || !noParams)
            return;
        // Clear existing params
        paramsList.innerHTML = "";
        if (!this.params.toString()) {
            noParams.classList.remove("hidden");
            return;
        }
        noParams.classList.add("hidden");
        const paramEntries = [];
        this.params.forEach((value, key) => paramEntries.push([key, value]));
        for (const [key, value] of paramEntries) {
            const paramDiv = this.createParamElement(key, value);
            paramsList.appendChild(paramDiv);
        }
    }
    createParamElement(key, value) {
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
            var _a, _b, _c;
            const target = e.target;
            const inputs = (_a = target
                .closest(".param-row")) === null || _a === void 0 ? void 0 : _a.querySelectorAll(".param-input");
            const value = (_c = (_b = inputs[1]) === null || _b === void 0 ? void 0 : _b.value) !== null && _c !== void 0 ? _c : "";
            if (!navigator.clipboard) {
                this.showToast("Clipboard not available", "error");
                return;
            }
            try {
                await navigator.clipboard.writeText(value);
                this.showToast("Value copied!");
            }
            catch (error) {
                console.error("Clipboard operation failed:", error);
                this.showToast("Failed to copy value", "error");
            }
        });
        removeBtn.addEventListener("click", (e) => {
            const target = e.target;
            const paramItem = target.closest(".param-item");
            paramItem === null || paramItem === void 0 ? void 0 : paramItem.remove();
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
    updatePreview() {
        const newUrl = this.buildUrl();
        const hasChanges = newUrl !== this.originalUrl;
        document.getElementById("apply-changes-btn").disabled = !hasChanges;
        this.updateDynamicUrl();
    }
    addNewParam() {
        const paramsList = document.getElementById("params-list");
        const noParams = document.getElementById("no-params");
        if (!paramsList || !noParams)
            return;
        // Create new parameter element directly in DOM
        const paramDiv = this.createParamElement("", "");
        paramsList.appendChild(paramDiv);
        // Update visibility
        noParams.classList.add("hidden");
        this.updatePreview();
        // Focus the new parameter's key input
        setTimeout(() => {
            const firstInput = paramDiv.querySelector(".param-input");
            firstInput === null || firstInput === void 0 ? void 0 : firstInput.focus();
        }, 0);
    }
    syncDomToParams() {
        const entries = [];
        document.querySelectorAll(".param-item").forEach((item) => {
            var _a, _b, _c, _d;
            const inputs = item.querySelectorAll(".param-input");
            const key = (_b = (_a = inputs[0]) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : "";
            const value = (_d = (_c = inputs[1]) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : "";
            const trimmedKey = key.trim();
            if (trimmedKey !== "")
                entries.push([trimmedKey, value]);
        });
        this.params = new URLSearchParams(entries);
    }
    showToast(message, variant = "success") {
        const toast = document.createElement("div");
        toast.className = `toast toast-${variant}`;
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
    async applyChanges() {
        var _a;
        const newUrl = this.buildUrl();
        const tabs = await this.browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        if ((_a = tabs[0]) === null || _a === void 0 ? void 0 : _a.id) {
            await this.browser.tabs.update(tabs[0].id, { url: newUrl });
        }
        this.originalUrl = newUrl;
        this.currentUrl = newUrl;
        window.close();
    }
    buildUrl() {
        if (!this.currentUrl) {
            return "";
        }
        const url = new URL(this.currentUrl);
        const entries = [];
        document.querySelectorAll(".param-item").forEach((item) => {
            var _a, _b, _c, _d;
            const inputs = item.querySelectorAll(".param-input");
            const key = (_b = (_a = inputs[0]) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : "";
            const value = (_d = (_c = inputs[1]) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : "";
            const trimmedKey = key.trim();
            if (trimmedKey !== "")
                entries.push([trimmedKey, value]);
        });
        url.search = new URLSearchParams(entries).toString();
        return url.toString();
    }
}
// Make QueryLens globally available
window.QueryLens = QueryLens;
//# sourceMappingURL=query-lens.js.map