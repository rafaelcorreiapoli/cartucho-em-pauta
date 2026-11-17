import {useEffectEvent,useLayoutEffect,useRef} from 'react';
import {isEditingText} from '../game-keys';

import type {ShortcutEntry} from '../action-shortcuts';

const paletteEntries = new WeakMap<Element,{entries:readonly ShortcutEntry[];owner:HTMLElement}>();

export function dialogKeyActions(dialog:HTMLElement) {
  const registration = paletteEntries.get(dialog);
  if (!registration || !registration.owner.isConnected || registration.owner.closest('[hidden]')) return;
  return registration.entries.map(entry=>({name:entry.name,activate:()=>{
    const current = paletteEntries.get(dialog);
    if (!dialog.matches('dialog:modal') || current?.owner!==registration.owner ||
        !current.owner.isConnected || current.owner.closest('[hidden]')) return;
    const action = current===registration ? entry :
      entry.id===undefined ? undefined : current.entries.find(candidate=>candidate.id===entry.id);
    action?.activate();
  }}));
}

export function useDialogKeys<T extends HTMLElement>(actionForKey:(key:string)=> (()=>void)|undefined,entries?:readonly ShortcutEntry[]) {
  const panel = useRef<T>(null);
  const currentAction = useEffectEvent(actionForKey);
  useLayoutEffect(()=>{
    const owner = panel.current;
    const dialog = owner?.closest('dialog');
    if (!owner || !dialog || !entries) return;
    const registration = {entries,owner};
    paletteEntries.set(dialog,registration);
    return ()=>{ if (paletteEntries.get(dialog)===registration) paletteEntries.delete(dialog); };
  },[entries]);
  useLayoutEffect(()=>{
    function keydown(event:KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing ||
          event.ctrlKey || event.altKey || event.metaKey || isEditingText(event.target)) return;
      const owner = panel.current;
      const dialog = owner?.closest('dialog:modal');
      if (!dialog || owner?.closest('[hidden]')) return;
      const active = document.activeElement?.closest('dialog:modal');
      if (active ? active!==dialog : [...document.querySelectorAll('dialog:modal')].some(open=>open!==dialog)) return;
      const key = event.shiftKey ? (/^Digit[1-9]$/.test(event.code) ? 'Shift+'+event.code.at(-1) : undefined) : event.key;
      if (!key) return;
      const action = currentAction(key);
      if (!action) return;
      event.preventDefault();
      action();
    }
    document.addEventListener('keydown',keydown,true);
    return ()=>document.removeEventListener('keydown',keydown,true);
  },[]);
  return panel;
}
