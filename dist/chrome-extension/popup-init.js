"use strict";
// Global function to avoid ES6 module issues in extension context
window.initializeQueryLens = function (browserAPI) {
    const QueryLens = window.QueryLens;
    if (!QueryLens) {
        console.error("QueryLens class not found on window object");
        return;
    }
    if (typeof browserAPI === "undefined" || !browserAPI.tabs) {
        console.error("Browser API not available");
        return;
    }
    try {
        new QueryLens(browserAPI);
    }
    catch (error) {
        console.error("Failed to initialise QueryLens:", error);
    }
};
//# sourceMappingURL=popup-init.js.map