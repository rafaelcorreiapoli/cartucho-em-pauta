import { button, node } from './gameplay-ui';
import { hudConsumesKeys } from './game-keys';

const pageSize = 9;

export function markShortcut(control:HTMLElement, key:string, label = key) {
  control.setAttribute('aria-keyshortcuts',key);
  const badge = node('kbd',label);
  badge.className = 'action-key';
  badge.setAttribute('aria-hidden','true');
  control.append(badge);
}

const quickActions = [
  ['g','#open-surveillance'], ['e','#open-equipment'], ['i','#open-attributes'], ['c','#open-phone'], ['v','#voice-toggle'],
  ['j','#politics-dock > summary'],
  ['p','#election-dock > summary'],
] as const;

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

export function bindActionShortcuts(root:HTMLElement, signal:AbortSignal) {
  disableHudTabStops(root,signal);
  const launcher = root.querySelector<HTMLButtonElement>('#open-action-shortcuts')!;
  const palette = root.querySelector<HTMLDialogElement>('#action-shortcuts')!;
  const list = palette.querySelector<HTMLElement>('.shortcut-list')!;
  const pages = palette.querySelector<HTMLElement>('.shortcut-pages')!;
  const map = root.querySelector<HTMLElement>('#map')!;
  const controls = quickActions.map(([key,selector])=>[key,root.querySelector<HTMLElement>(selector)!] as const);
  for (const [key,control] of controls) control.setAttribute('aria-keyshortcuts',key.toUpperCase());
  let scope:HTMLElement = root;
  let page = 0;

  function modal() {
    return document.activeElement?.closest<HTMLDialogElement>('dialog:modal') ??
      [...root.querySelectorAll<HTMLDialogElement>('dialog:modal')].at(-1);
  }

  function render() {
    const actions = [...scope.querySelectorAll<HTMLElement>('button, summary, input, select, textarea')]
      .filter(control=>control!==launcher && !palette.contains(control) && available(control))
      .map(control=>({control,name:actionName(control)})).filter(({name})=>name);
    const total = Math.max(1,Math.ceil(actions.length/pageSize));
    page = Math.max(0,Math.min(page,total-1));
    list.replaceChildren(...actions.slice(page*pageSize,(page+1)*pageSize).map(({control,name},index)=>{
      const entry = button(name,()=>{
        palette.close();
        if (!available(control)) return;
        if (control.matches('input:not([type="checkbox"], [type="radio"]), select, textarea')) control.focus();
        else control.click();
      });
      markShortcut(entry,String(index+1));
      return entry;
    }));
    pages.hidden = total===1;
    pages.replaceChildren(button('‹',()=>{ page--; render(); }),node('span',`${page+1} / ${total}`),button('›',()=>{ page++; render(); }));
    const [back,next] = pages.querySelectorAll('button');
    back.disabled = page===0;
    next.disabled = page===total-1;
    back.setAttribute('aria-label','Página anterior');
    next.setAttribute('aria-label','Próxima página');
    if (palette.open) list.querySelector('button')?.focus({preventScroll:true});
  }

  function toggle() {
    if (palette.open) { palette.close(); return; }
    scope = modal() ?? root;
    page = 0;
    render();
    palette.showModal();
  }

  launcher.onclick = toggle;
  document.addEventListener('keydown',event=>{
    if (event.defaultPrevented || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || root.hidden) return;
    const active = modal();
    if (event.key==='F2') {
      event.preventDefault();
      toggle();
      return;
    }
    if (active) {
      if (active===palette && (event.key==='ArrowLeft' || event.key==='ArrowRight')) {
        event.preventDefault();
        page += event.key==='ArrowLeft' ? -1 : 1;
        render();
        return;
      }
      if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (event.shiftKey || !/^[1-9]$/.test(event.key)) return;
      const control = active.querySelector<HTMLButtonElement>(`button[aria-keyshortcuts="${event.key}"]`);
      if (!control || !available(control)) return;
      event.preventDefault();
      control.click();
      return;
    }
    if (event.shiftKey || hudConsumesKeys(event.target)) return;
    const key = event.key.toLowerCase();
    const control = key==='y' || key==='r'
      ? root.querySelector<HTMLElement>(key==='y' ? '[data-vote="yes"]' : '[data-vote="no"]')
      : controls.find(([shortcut])=>shortcut===key)?.[1];
    if (!control) return;
    const viaApp = control.closest('#gameplay-tools') || control.id==='voice-toggle';
    if (viaApp ? control.matches(':disabled,[hidden]') || !root.querySelector('#match:not([hidden])') && !available(control) : !available(control)) return;
    event.preventDefault();
    control.click();
    if (!modal()) map.focus({preventScroll:true});
  },{signal});
  signal.addEventListener('abort',()=>{
    launcher.onclick = null;
    palette.close();
    list.replaceChildren();
    pages.replaceChildren();
  },{once:true});
}
