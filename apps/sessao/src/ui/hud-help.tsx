import {useId,useLayoutEffect,useRef,useState,type ComponentPropsWithoutRef} from 'react';
import {createPortal} from 'react-dom';

type Props = Omit<ComponentPropsWithoutRef<'button'>,'type'> & {help:string};

export function HudHelpButton({help,children,...props}:Props) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [mode,setMode] = useState<'preview'|'pinned'>();
  const open = mode!==undefined;

  useLayoutEffect(()=>{
    const button = anchor.current;
    const tip = popover.current;
    if (!open || !button || !tip) return;
    const controller = new AbortController();
    const {signal} = controller;
    const close = ()=>setMode(undefined);

    function move() {
      if (!button || !tip) return;
      if (!button.getClientRects().length) return close();
      const {left,top,bottom} = button.getBoundingClientRect();
      const x = Math.max(8,Math.min(left,window.innerWidth-tip.offsetWidth-8));
      const y = bottom+7+tip.offsetHeight<=window.innerHeight-8 ? bottom+7 : Math.max(8,top-tip.offsetHeight-7);
      tip.style.translate = `${x}px ${y}px`;
    }

    button.dispatchEvent(new Event('hud-help-open',{bubbles:true}));
    document.addEventListener('hud-help-open',event=>{ if (event.target!==button) close(); },{signal});
    move();
    const observer = new ResizeObserver(move);
    observer.observe(button);
    window.addEventListener('resize',move,{signal});
    window.addEventListener('scroll',move,{signal,capture:true});
    document.addEventListener('keydown',event=>{ if (event.key==='Escape') close(); },{signal});
    document.addEventListener('click',event=>{ if (!event.composedPath().includes(button)) close(); },{signal});
    return ()=>{
      controller.abort();
      observer.disconnect();
    };
  },[open,help]);

  return <>
    <button {...props} ref={anchor} type="button" data-help={help} aria-describedby={open?id:undefined}
      onPointerEnter={event=>{ if (event.pointerType!=='touch' && mode!=='pinned') setMode('preview'); }}
      onPointerLeave={event=>{ if (mode==='preview' && document.activeElement!==event.currentTarget) setMode(undefined); }}
      onFocus={()=>{ if (mode!=='pinned') setMode('preview'); }}
      onBlur={()=>{ if (mode==='preview') setMode(undefined); }}
      onClick={()=>setMode(mode==='pinned'?undefined:'pinned')}>{children}</button>
    {open && createPortal(<div ref={popover} id={id} className="hud-panel hud-help-popover" role="tooltip">{help}</div>,document.body)}
  </>;
}
