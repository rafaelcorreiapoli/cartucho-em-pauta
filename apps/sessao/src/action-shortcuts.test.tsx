import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShortcutPalette } from './action-shortcuts';

function render(page:number,total:number) {
  return renderToStaticMarkup(<ShortcutPalette
    entries={[{name:'Abrir inventário',activate:()=>{}},{name:'Abrir celular',activate:()=>{}}]}
    page={page} total={total} changePage={()=>{}}
  />);
}

test('shortcut pages restart numeric shortcuts and disable navigation at the boundaries',()=>{
  const first = render(0,2);
  const last = render(1,2);
  for (const page of [first,last]) {
    expect(page).toContain('aria-keyshortcuts="1">Abrir inventário');
    expect(page).toContain('aria-keyshortcuts="2">Abrir celular');
  }
  expect(first).toContain('aria-label="Página anterior" disabled');
  expect(last).toContain('aria-label="Próxima página" disabled');
  expect(last).toContain('2 / 2');
  expect(render(0,1)).toContain('aria-label="Páginas de ações" hidden');
});
