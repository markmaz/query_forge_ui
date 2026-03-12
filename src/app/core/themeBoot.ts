const BODY_CLASSES_TO_CLEAR = ["qf-theme-light", "light", "dark-sidebar"];
const BODY_CLASSES_TO_APPLY = ["qf-theme-dark", "dark-only"];

export function initializeShellTheme(doc: Document = document) {
  doc.body.classList.remove(...BODY_CLASSES_TO_CLEAR);
  doc.body.classList.add(...BODY_CLASSES_TO_APPLY);
}

