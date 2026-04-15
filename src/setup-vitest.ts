import "@testing-library/jest-dom/vitest";
import "./i18n-config";
import "./qa/setupTests";

if (typeof window !== "undefined") {
  const originalGetComputedStyle = window.getComputedStyle.bind(window);

  window.getComputedStyle = ((element: Element, pseudoElt?: string) => {
    if (pseudoElt) {
      return originalGetComputedStyle(element);
    }
    return originalGetComputedStyle(element);
  }) as typeof window.getComputedStyle;
}
