import {createElement,useId,useLayoutEffect,useRef,useState,type ButtonHTMLAttributes,type RefAttributes} from 'react';
import {createPortal} from 'react-dom';

type Anchor = 'button'|'div'|'span'|'aside'|'header'|'li'|'strong'|'small'|'article'|'summary';
type Props = ButtonHTMLAttributes<HTMLElement> & {help:string;as?:Anchor};

export function HudHelp({help,as:Tag='button',children,onClick,...props}:Props) {
  const id = useId();
  const anchor = useRef<HTMLElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [mode,setMode] = useState<'preview'|'pinned'>();
  const hold = useRef<number>(undefined);
  const held = useRef(false);
  const clearHold = ()=>window.clearTimeout(hold.current);
  useLayoutEffect(()=>clearHold,[]);
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
    observer.observe(tip);
    window.addEventListener('resize',move,{signal});
    window.addEventListener('scroll',move,{signal,capture:true});
    document.addEventListener('keydown',event=>{ if (event.key==='Escape') close(); },{signal});
    document.addEventListener('click',event=>{ if (!event.composedPath().includes(button)) close(); },{signal});
    return ()=>{
      controller.abort();
      observer.disconnect();
    };
  },[open,help]);

  const acts = onClick || Tag==='summary';
  const description = [props['aria-describedby'],open ? id : undefined].filter(Boolean).join(' ');
  const anchorProps: ButtonHTMLAttributes<HTMLElement> & RefAttributes<HTMLElement> & {'data-help':string} = {
    ...props,
    ref:anchor,
    type:Tag==='button' ? 'button' : undefined,
    tabIndex:props.tabIndex ?? 0,
    'data-help':help,
    'aria-describedby':description || undefined,
    onPointerDown:event=>{
      clearHold();
      held.current = false;
      if (event.pointerType==='touch' && acts) hold.current = window.setTimeout(()=>{
        held.current = true;
        setMode('pinned');
      },500);
    },
    onPointerUp:clearHold,
    onPointerCancel:clearHold,
    onContextMenu:event=>{if (held.current) event.preventDefault();},
    onKeyDown:event=>{
      if (Tag!=='button' && !acts && (event.key==='Enter' || event.key===' ')) {
        event.preventDefault();
        setMode(mode==='pinned' ? undefined : 'pinned');
      }
    },
    onPointerEnter:event=>{
      if (event.pointerType!=='touch' && mode!=='pinned') setMode('preview');
    },
    onPointerLeave:event=>{
      clearHold();
      if (mode==='preview' && document.activeElement!==event.currentTarget) setMode(undefined);
    },
    onFocus:()=>{ if (mode!=='pinned') setMode('preview'); },
    onBlur:()=>{ if (mode==='preview') setMode(undefined); },
    onClick:event=>{
      if (held.current && event.detail) {
        event.preventDefault();
        held.current = false;
        return;
      }
      if (acts) {
        setMode(undefined);
        onClick?.(event);
      } else setMode(mode==='pinned' ? undefined : 'pinned');
    },
  };
  return <>
    {createElement(Tag,anchorProps,children)}
    {open && createPortal(<div ref={popover} id={id} className="hud-panel hud-help-popover" role="tooltip">{help}</div>,document.body)}
  </>;
}
