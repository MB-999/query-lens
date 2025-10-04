// Initialization for Chrome and Safari browsers
document.addEventListener("DOMContentLoaded", () => {
  try {
    if (typeof chrome === "undefined" || !chrome.tabs) {
      throw new Error("Browser API not available");
    }

    const windowWithQueryLens = window as typeof window & {
      QueryLens?: new (browserAPI: any) => any;
    };

    if (!windowWithQueryLens.QueryLens) {
      throw new Error("QueryLens class not found");
    }

    new windowWithQueryLens.QueryLens(chrome);
  } catch (error) {
    console.error("Failed to initialize QueryLens:", error);
    const errorDiv = document.createElement("div");
    errorDiv.textContent = "Extension failed to load. Please refresh the page.";
    errorDiv.style.cssText = "color: red; padding: 10px; text-align: center;";
    document.body.appendChild(errorDiv);
  }
});
