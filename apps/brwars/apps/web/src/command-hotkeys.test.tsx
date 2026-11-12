import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { BUILDING_HOTKEYS, FACTIONS } from '@brwars/simulation';
import { HotkeyLabel } from './HotkeyLabel';
import { assignHotkeys, normalizeHotkey } from './command-hotkeys';
it('atalhos de construções não se repetem e continuam explícitos quando ausentes no nome', () => {
  for (const side of ['left', 'right'] as const) {
    const keys = Object.values(BUILDING_HOTKEYS[side]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [kind, key] of Object.entries(BUILDING_HOTKEYS[side])) {
      const label =
        FACTIONS[side].buildings[kind as keyof (typeof FACTIONS)[typeof side]['buildings']];
      const html = renderToStaticMarkup(<HotkeyLabel label={label} hotkey={key} />);
      expect(html).toContain('class="command-hotkey"');
      if (!normalizeHotkey(label).includes(key))
        expect(html).toContain(`[<b class="command-hotkey">${key}</b>]`);
    }
  }
});
it('atribui letras distintas dentro dos nomes e reserva a tecla de voltar', () => {
  const names = ['Exército', 'Econômico', 'Estrutural', 'Poderes globais'];
  const keys = assignHotkeys(names, ['v', 'l', 'd']);
  expect(new Set(keys).size).toBe(names.length);
  keys.forEach((key, index) => {
    expect(key).toBeTruthy();
    expect(normalizeHotkey(names[index])).toContain(key);
    expect(['v', 'l', 'd']).not.toContain(key);
  });
});
it('realça a letra no nome mantendo acentos e sem criar um rótulo separado', () => {
  expect(renderToStaticMarkup(<HotkeyLabel label="Feira cultural" hotkey="c" />)).toBe(
    'Feira <b class="command-hotkey">c</b>ultural',
  );
  expect(renderToStaticMarkup(<HotkeyLabel label="Crédito" hotkey="e" />)).toBe(
    'Cr<b class="command-hotkey">é</b>dito',
  );
});

it('nome sem a letra mantém a palavra intacta e mostra a tecla entre colchetes', () => {
  expect(renderToStaticMarkup(<HotkeyLabel label="INSPER" hotkey="u" />)).toBe(
    '<span class="command-label-name">INSPER</span><span class="command-hotkey-suffix">[<b class="command-hotkey">u</b>]</span>',
  );
  expect(renderToStaticMarkup(<HotkeyLabel label="Escritório" hotkey="h" />)).toBe(
    '<span class="command-label-name">Escritório</span><span class="command-hotkey-suffix">[<b class="command-hotkey">h</b>]</span>',
  );
  expect(renderToStaticMarkup(<HotkeyLabel label="UFMG" />)).toBe('UFMG');
});
