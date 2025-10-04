"use strict";
chrome.devtools.panels.create("QueryLens", "icon16.png", "devtools-content.html", (panel) => {
    if (chrome.runtime.lastError) {
        console.error("Failed to create DevTools panel:", chrome.runtime.lastError);
    }
});
//# sourceMappingURL=devtools.js.map