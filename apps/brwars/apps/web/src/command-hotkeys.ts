export const normalizeHotkey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Allocate a distinct letter from each visible name, excluding navigation keys. */
export function assignHotkeys(labels: string[], reserved: string[] = []) {
  const used = new Set(reserved.map(normalizeHotkey));
  return labels.map((label) => {
    const key = Array.from(normalizeHotkey(label)).find(
      (letter) => /[a-z]/.test(letter) && !used.has(letter),
    );
    if (key) used.add(key);
    return key;
  });
}
export function hotkeyAttributes(key?: string) {
  return key ? { 'data-command-hotkey': key, 'aria-keyshortcuts': key.toUpperCase() } : {};
}
