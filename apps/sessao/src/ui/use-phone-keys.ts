import {useEffect,useEffectEvent,useRef} from 'react';
import {isEditingText} from '../game-keys';

export function usePhoneKeys<T extends HTMLElement>(actionForKey:(key:string)=> (()=>void)|undefined) {
  const panel = useRef<T>(null);
  const currentAction = useEffectEvent(actionForKey);
  useEffect(()=>{
    function keydown(event:KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing || event.shiftKey ||
          event.ctrlKey || event.altKey || event.metaKey || isEditingText(event.target)) return;
      const dialog = panel.current?.closest('dialog:modal');
      if (!dialog) return;
      const active = document.activeElement?.closest('dialog:modal');
      if (active ? active!==dialog : document.querySelector('dialog:modal:not(#gameplay-dialog)')) return;
      const action = currentAction(event.key);
      if (!action) return;
      event.preventDefault();
      action();
    }
    document.addEventListener('keydown',keydown,true);
    return ()=>document.removeEventListener('keydown',keydown,true);
  },[]);
  return panel;
}
