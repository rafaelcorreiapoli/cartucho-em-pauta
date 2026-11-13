import { createRoot } from 'react-dom/client';
import { node } from './gameplay-ui';
import { createSurveillanceViewport } from './surveillance-viewport';
import type { PhotoScene } from './photography';
import { monitoredChannel, type SpyDevice, type SpyView } from './surveillance';

export function createSurveillancePanel(send:(action:object)=>void) {
  const launch = document.querySelector<HTMLButtonElement>('#open-surveillance')!;
  const badge = launch.querySelector('span')!;
  const dialog = document.querySelector<HTMLDialogElement>('#surveillance-dialog')!;
  const list = document.querySelector<HTMLElement>('#spy-channels')!;
  const channelsRoot = createRoot(list);
  const monitor = document.querySelector<HTMLElement>('#spy-monitor')!;
  const monitorRoot = createRoot(monitor);
  const viewport = node('div');
  viewport.className = 'spy-viewport';
  viewport.setAttribute('aria-label','Visão ao vivo da câmera');
  let live:ReturnType<typeof createSurveillanceViewport>|undefined;
  function stopViewport() { live?.destroy(); live = undefined; }
  let view:SpyView|undefined;
  let key = '';
  let page = 0;
  let device:SpyDevice = 'spyCamera';
  const pageSize = 4;
  const devices = [{kind:'spyCamera',label:'Câmeras',icon:'camera'},{kind:'wiretap',label:'Escutas',icon:'mic'}] as const;
  let editing:number|undefined;

  function update() {
    if (!dialog.open) return;
    const next = JSON.stringify([view?.channels,view?.selected,view?.audio,view?.muted,page,editing,device]);
    if (key===next) return;
    key = next;
    const allChannels = view?.channels ?? [];
    const channels = allChannels.filter(channel=>channel.kind===device);
    const channel = monitoredChannel(view);
    const selected = channel?.kind==='spyCamera' ? channel : undefined;
    const audio = channel?.kind==='wiretap' ? channel : undefined;
    const last = Math.max(0,Math.ceil(channels.length/pageSize)-1);
    page = Math.min(page,last);
    channelsRoot.render(<>
      <div className="spy-tabs flex gap-2" role="group" aria-label="Tipo de canal">
        {devices.map(tab=><button key={tab.kind} type="button" aria-pressed={tab.kind===device}
          onClick={()=>{device = tab.kind;page = 0;update();}}>
          <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+tab.icon}/></svg>
          {tab.label} <small>{allChannels.filter(channel=>channel.kind===tab.kind).length}</small>
        </button>)}
      </div>
      {!channels.length && <p>{device==='spyCamera' ? 'Nenhuma câmera instalada.' : 'Nenhuma escuta instalada.'}</p>}
      {channels.slice(page*pageSize,(page+1)*pageSize).map((channel,index)=>{
        const label = channel.removed ? 'Desconectado' : channel.active ? 'Atividade' : 'Em espera';
        return <button key={channel.id} type="button" className={`hud-button hud-button--secondary spy-channel${channel.active ? ' spy-active' : ''}`}
          disabled={channel.removed} aria-pressed={selected?.id===channel.id || audio?.id===channel.id}
          aria-keyshortcuts={channel.removed ? undefined : String(index+1)} onClick={()=>{
            send({kind:'open',channel:channel.id});
            update();
          }}>
          <svg className="hud-glyph" aria-hidden="true"><use href={channel.kind==='wiretap' ? '#icon-mic' : '#icon-camera'}/></svg>
          <span className="flex-1"><strong>{channel.name}</strong><small>{channel.room} · {label}</small></span>
          {!channel.removed && <kbd className="action-key" aria-hidden="true">{index+1}</kbd>}
          {!channel.removed && <span className="spy-play" aria-hidden="true">▶</span>}
        </button>;
      })}
      {last>0 && <div className="flex items-center gap-2">
        <button type="button" className="hud-button hud-button--secondary" disabled={page===0}
          aria-label="Página anterior" onClick={()=>{page--;update();}}>‹</button>
        <span>{page+1} / {last+1}</span>
        <button type="button" className="hud-button hud-button--secondary" disabled={page===last}
          aria-label="Próxima página" onClick={()=>{page++;update();}}>›</button>
      </div>}
    </>);
    const closeEditor = () => { editing = undefined; update(); };
    const action = (label:string,key:string,run:()=>void) =>
      <button type="button" className="hud-button hud-button--secondary" aria-keyshortcuts={key} onClick={run}>
        {label}<kbd className="action-key" aria-hidden="true">{key}</kbd>
      </button>;
    monitorRoot.render(<>
      {selected && <><h3>{selected.name}</h3><div ref={host=>{ if (host && viewport.parentElement!==host) host.append(viewport); }}/></>}
      {audio && <p>{audio.name} · {view?.muted ? 'Silenciado' : audio.active ? 'Áudio ativo' : 'Sem voz detectada'}</p>}
      {!channel ? <p>Selecione um canal.</p> : <>
        {selected && action('Fotografar','5',()=>send({kind:'capture'}))}
        {audio && action(view?.muted ? 'Ouvir grampo' : 'Silenciar grampo','6',()=>send({kind:'mute',channel:audio.id}))}
        {action(channel.alerts ? 'Silenciar alertas' : 'Ativar alertas','7',()=>send({kind:'alerts',channel:channel.id}))}
        {action('Renomear','8',()=>{ editing = channel.id; update(); })}
        {action('Fechar canal','9',()=>send({kind:'close-channel',channel:channel.id}))}
        {editing===channel.id && <form key={channel.id} onSubmit={event=>{
          event.preventDefault();
          const name = String(new FormData(event.currentTarget).get('name') ?? '');
          send({kind:'rename',channel:channel.id,name});
          closeEditor();
        }}>
          <input name="name" defaultValue={channel.name} maxLength={32} aria-label="Nome do canal" autoFocus
            onFocus={event=>event.currentTarget.select()} onKeyDown={event=>{
              if (event.key!=='Escape') return;
              event.preventDefault();
              closeEditor();
            }}/>
          <button>Salvar</button>
        </form>}
      </>}
    </>);
  }

  launch.onclick = ()=>{
    if (dialog.open) return;
    device = monitoredChannel(view)?.kind ?? (view?.channels.some(channel=>channel.kind==='spyCamera') ? 'spyCamera' : 'wiretap');
    page = 0;
    dialog.showModal();
    update();
  };
  dialog.onclose = ()=>{
    stopViewport();
    key = '';
    editing = undefined;
    send({kind:'close'});
  };
  dialog.onkeydown = event=>{
    if (event.target instanceof HTMLInputElement || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    if (event.key==='ArrowLeft' && page===0 || event.key==='ArrowRight' && (page+1)*pageSize>=(view?.channels.filter(channel=>channel.kind===device).length ?? 0)) return;
    event.preventDefault();
    page += event.key==='ArrowLeft' ? -1 : 1;
    update();
  };

  return {
    render(next?:SpyView) {
      if (next?.selected!==view?.selected) stopViewport();
      view = next;
      launch.hidden = !view;
      const active = view?.channels.filter(channel=>channel.active).length ?? 0;
      badge.hidden = !active;
      badge.textContent = String(active);
      if (!view && dialog.open) dialog.close();
      update();
    },
    frame(frame:PhotoScene) {
      if (!dialog.open || view?.selected===undefined) return;
      live ??= createSurveillanceViewport(viewport);
      live.receive(frame);
    },
    destroy() {
      channelsRoot.unmount();
      monitorRoot.unmount();
      stopViewport();
      launch.onclick = dialog.onclose = dialog.onkeydown = null;
      dialog.close();
      launch.hidden = true;
    },
  };
}
