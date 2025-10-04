// Safari-specific initialization
document.addEventListener("DOMContentLoaded", () => {
  new (window as any).QueryLens(chrome);
});
