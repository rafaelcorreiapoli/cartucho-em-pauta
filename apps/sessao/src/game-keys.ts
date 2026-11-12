export function hudConsumesKeys(target:EventTarget | null) {
  return !!document.querySelector('dialog:modal') ||
    (target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));
}
