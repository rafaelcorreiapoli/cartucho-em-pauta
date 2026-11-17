import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';

export function LobbyInvite({url,openSettings}:{url:string;openSettings:()=>void}) {
  const input = useRef<HTMLInputElement>(null);
  const [feedback,setFeedback] = useState<'copied'|'selected'>();
  useEffect(()=>{
    if (!feedback) return;
    const timer = window.setTimeout(()=>setFeedback(undefined),1500);
    return ()=>window.clearTimeout(timer);
  },[feedback]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('copied');
    } catch {
      input.current?.focus();
      input.current?.select();
      setFeedback('selected');
    }
  }

  return <>
    <label>Link da sala <input ref={input} id="lobby-invite-url" value={url} readOnly
      onClick={event=>event.currentTarget.select()}/></label>
    <button id="lobby-copy-invite" className="hud-button hud-button--secondary" type="button" onClick={copy}>
      {feedback==='copied' ? 'Link copiado' : 'Copiar link'}
    </button>
    <span className="sr-only" role="status">
      {feedback==='copied' ? 'Link copiado' : feedback==='selected' ? 'Link selecionado para copiar.' : ''}
    </span>
    <button id="lobby-settings" className="hud-icon-button" type="button" aria-label="Configurações" onClick={openSettings}>
      <svg className="hud-glyph" aria-hidden="true"><use href="#icon-settings"/></svg>
    </button>
  </>;
}

export function mountLobbyInvite(host:HTMLElement,url:string,openSettings:()=>void) {
  const root = createRoot(host);
  root.render(<LobbyInvite url={url} openSettings={openSettings}/>);
  return ()=>root.unmount();
}
