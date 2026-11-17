import { DialogDismiss } from './ui/dialog-dismiss';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { appForKey, type LaunchHudApp } from './hud-apps';
import { hudConsumesKeys, isEditingText } from './game-keys';

const pageSize = 9;
export type ShortcutEntry = {name:string;activate:()=>void};

function available(control:HTMLElement) {
  return !control.matches(':disabled, [aria-disabled="true"], input[type="hidden"]') &&
    !control.closest('[hidden], [inert], [data-context-hidden="true"]') && control.checkVisibility({visibilityProperty:true});
}

function actionName(control:HTMLElement) {
  const label = control.getAttribute('aria-label');
  if (label) return label;
  if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
    return control.labels?.[0]?.textContent?.trim() || control.title || control.getAttribute('placeholder') || '';
  }
  const copy = control.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('kbd, svg, [hidden], [aria-hidden="true"]').forEach(child=>child.remove());
  return copy.textContent?.replace(/\s+/g,' ').trim() || control.title;
}

function disableHudTabStops(root:HTMLElement, signal:AbortSignal) {
  const selector = ':is(button, summary, input, select, textarea, a[href], [tabindex], [contenteditable="true"]):not(#map)';
  function update(container:Element) {
    if (container instanceof HTMLElement && container.matches(selector)) container.tabIndex = -1;
    for (const control of container.querySelectorAll<HTMLElement>(selector)) control.tabIndex = -1;
  }
  update(root);
  const observer = new MutationObserver(records=>{
    for (const record of records) {
      for (const added of record.addedNodes) if (added instanceof Element) update(added);
    }
  });
  observer.observe(root,{childList:true,subtree:true});
  signal.addEventListener('abort',()=>observer.disconnect(),{once:true});
}

export function bindActionShortcuts(root:HTMLElement, signal:AbortSignal, launchApp:LaunchHudApp, shortcuts:{j:()=>boolean;l:()=>boolean;u:()=>boolean;vote:(key:string)=>boolean;context:()=>readonly ShortcutEntry[];dialog:(scope:HTMLElement)=>readonly ShortcutEntry[]|undefined}) {
  disableHudTabStops(root,signal);
  const palette = root.querySelector<HTMLDialogElement>('#action-shortcuts')!;
  const paletteRoot = createRoot(palette);
  const map = root.querySelector<HTMLElement>('#map')!;
  const settings = root.querySelector<HTMLDialogElement>('#room-settings')!;
  let scope:HTMLElement = root;
  let page = 0;
  let visibleEntries:readonly ShortcutEntry[] = [];

  function modal() {
    return document.activeElement?.closest<HTMLDialogElement>('dialog:modal') ??
      [...root.querySelectorAll<HTMLDialogElement>('dialog:modal')].at(-1);
  }

  function render() {
    const registered = shortcuts.dialog(scope);
    const otherActions = registered ? [] : [...scope.querySelectorAll<HTMLElement>('button, summary, input, select, textarea')]
      .filter(control=>!palette.contains(control) && !control.closest('#context-actions-mount, #ballot-host [data-vote], #ballot-host .cassation-ballot button') && available(control))
      .map(control=>({control,name:actionName(control)})).filter(({name})=>name);
    const actions:ShortcutEntry[] = [
      ...(scope===root ? shortcuts.context() : registered ?? []),
      ...otherActions.map(({control,name})=>({
        name,
        activate:()=>{
          if (!available(control)) return;
          if (control.matches('input:not([type="checkbox"], [type="radio"]), select, textarea')) control.focus();
          else control.click();
        },
      })),
    ];
    const total = Math.max(1,Math.ceil(actions.length/pageSize));
    page = Math.max(0,Math.min(page,total-1));
    visibleEntries = actions.slice(page*pageSize,(page+1)*pageSize).map(({name,activate})=>({
      name,activate:()=>{ palette.close(); activate(); },
    }));
    flushSync(()=>paletteRoot.render(<ShortcutPalette
      entries={visibleEntries}
      page={page} total={total} changePage={offset=>{ page += offset; render(); }}
    />));
    if (palette.open) palette.querySelector<HTMLButtonElement>('.shortcut-list button')?.focus({preventScroll:true});
  }

  function toggle() {
    if (palette.open) { palette.close(); return; }
    scope = modal() ?? root;
    page = 0;
    render();
    palette.showModal();
  }

  document.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || root.hidden) return;
    const active = modal();
    if (event.key==='F2') {
      event.preventDefault();
      toggle();
      return;
    }
    if (active) {
      if (active.id==='dossier-dialog' && !event.shiftKey && event.key.toLowerCase()==='j' && shortcuts.j()) {
        event.preventDefault();
        return;
      }
      if (active===palette && (event.key==='ArrowLeft' || event.key==='ArrowRight')) {
        event.preventDefault();
        page += event.key==='ArrowLeft' ? -1 : 1;
        render();
        return;
      }
      if (isEditingText(event.target)) return;
      const key = event.shiftKey && /^Digit[1-9]$/.test(event.code) ? 'Shift+'+event.code.at(-1) :
        !event.shiftKey && /^[0-9]$/.test(event.key) ? event.key : undefined;
      if (!key) return;
      if (active===palette) {
        const entry = visibleEntries[Number(key)-1];
        if (!entry) return;
        event.preventDefault();
        entry.activate();
        return;
      }
      const control = [...active.querySelectorAll<HTMLButtonElement>(`button[aria-keyshortcuts="${key}"]`)].find(available);
      if (!control) return;
      event.preventDefault();
      control.click();
      return;
    }
    if (event.shiftKey || hudConsumesKeys(event.target)) return;
    const key = event.key.toLowerCase();
    const app = appForKey(key);
    if (app) {
      if (launchApp(app)) {
        event.preventDefault();
        if (!modal()) map.focus({preventScroll:true});
      }
      return;
    }
    if (key==='j' || key==='l' || key==='u') {
      if (shortcuts[key]()) event.preventDefault();
      return;
    }
    if (!shortcuts.vote(key)) return;
    event.preventDefault();
    if (!modal()) map.focus({preventScroll:true});
  },{signal});
  signal.addEventListener('abort',()=>{
    if (settings.open) settings.close();
    palette.close();
    paletteRoot.unmount();
  },{once:true});
}

export function ShortcutPalette({entries,page,total,changePage}:{
  entries: readonly ShortcutEntry[];
  page:number;
  total:number;
  changePage:(offset:number)=>void;
}) {
  return <>
    <header>
      <h2 id="action-shortcuts-title">Atalhos de teclado</h2>
      <DialogDismiss label="Fechar atalhos">Esc</DialogDismiss>
    </header>
    <p>Use os números para agir. Use ← e → para mudar de página.</p>
    <div className="shortcut-list">
      {entries.map(({name,activate},index)=><button
        key={page*pageSize+index} type="button" className="hud-button hud-button--secondary" onClick={activate}
        aria-keyshortcuts={String(index+1)}
      >
        {name}<kbd className="action-key" aria-hidden="true">{index+1}</kbd>
      </button>)}
    </div>
    <nav className="shortcut-pages" aria-label="Páginas de ações" hidden={total===1}>
      <button type="button" className="hud-button hud-button--secondary" aria-label="Página anterior" disabled={page===0} onClick={()=>changePage(-1)}>‹</button>
      <span>{page+1} / {total}</span>
      <button type="button" className="hud-button hud-button--secondary" aria-label="Próxima página" disabled={page===total-1} onClick={()=>changePage(1)}>›</button>
    </nav>
  </>;
}
