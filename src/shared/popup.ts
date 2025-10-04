document.addEventListener("DOMContentLoaded", () => {
  try {
    (window as any).initializeQueryLens(chrome);
  } catch (error) {
    console.error("Failed to initialize QueryLens:", error);
    const errorDiv = document.createElement("div");
    errorDiv.textContent = "Extension failed to load. Please refresh the page.";
    errorDiv.style.cssText = "color: red; padding: 10px; text-align: center;";
    document.body.appendChild(errorDiv);
  }
});
