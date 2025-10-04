interface WindowWithQueryLens extends Window {
  QueryLens?: new (browserAPI: any) => any;
}

// Global function to avoid ES6 module issues in extension context
(window as any).initializeQueryLens = function (browserAPI: any): void {
  const QueryLens = (window as WindowWithQueryLens).QueryLens;
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
  } catch (error) {
    console.error("Failed to initialise QueryLens:", error);
  }
};
