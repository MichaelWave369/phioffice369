export function clickTabByLabel(label, doc = globalThis.document) {
  const buttons = Array.from(doc?.querySelectorAll?.('.tabs button') ?? []);
  const target = buttons.find((button) => button.textContent?.trim() === label);
  target?.click();
  return Boolean(target);
}

export function clickFirstTemplateOpenButton(doc = globalThis.document) {
  const button = doc?.querySelector?.('.open-workspace-button') ?? null;
  button?.click();
  return Boolean(button);
}

export function guideToStarterTemplate({ win = globalThis.window, doc = globalThis.document } = {}) {
  const clickedTemplates = clickTabByLabel('Templates', doc);
  win?.setTimeout?.(() => {
    clickFirstTemplateOpenButton(doc);
  }, 80);
  return clickedTemplates;
}
