import { normalizeHotkey } from './command-hotkeys';
export function HotkeyLabel({ label, hotkey }: { label: string; hotkey?: string }) {
  if (!hotkey) return <>{label}</>;
  const letters = Array.from(label);
  const index = letters.findIndex((letter) => normalizeHotkey(letter) === normalizeHotkey(hotkey));
  if (index < 0)
    return (
      <>
        <span className="command-label-name">{label}</span>
        <span className="command-hotkey-suffix">
          [<b className="command-hotkey">{hotkey}</b>]
        </span>
      </>
    );
  return (
    <>
      {letters.slice(0, index).join('')}
      <b className="command-hotkey">{letters[index]}</b>
      {letters.slice(index + 1).join('')}
    </>
  );
}
