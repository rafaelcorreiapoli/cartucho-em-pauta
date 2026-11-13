import { markShortcut } from './action-shortcuts';
import { button, glyph, node } from './gameplay-ui';
import { createSurveillanceViewport } from './surveillance-viewport';
import type { PhotoScene } from './photography';
import type { SpyView } from './surveillance';

export function createSurveillancePanel(send:(action:object)=>void) {
  const launch = document.querySelector<HTMLButtonElement>('#open-surveillance')!;
  const badge = launch.querySelector('span')!;
  const dialog = document.querySelector<HTMLDialogElement>('#surveillance-dialog')!;
  const list = document.querySelector<HTMLElement>('#spy-channels')!;
  const monitor = document.querySelector<HTMLElement>('#spy-monitor')!;
  const viewport = node('div');
  viewport.className = 'spy-viewport';
  viewport.setAttribute('aria-label','Visão ao vivo da câmera');
  let live:ReturnType<typeof createSurveillanceViewport>|undefined;
  function stopViewport() { live?.destroy(); live = undefined; }
  let view:SpyView|undefined;
  let key = '';
  let page = 0;
  let editing:number|undefined;
  let focusedChannel:number|undefined;

  function update() {
    if (!dialog.open) return;
    const next = JSON.stringify([view?.channels,view?.selected,view?.audio,view?.muted,page,focusedChannel]);
    if (key===next || editing!==undefined) return;
    key = next;
    const channels = view?.channels ?? [];
    const selected = channels.find(channel=>channel.id===view?.selected && !channel.removed);
    const audio = channels.find(channel=>channel.id===view?.audio && !channel.removed);
    list.replaceChildren();
    if (!channels.length) list.append(node('p','Instale um grampo ou uma câmera do Apoio Técnico para abrir um canal.'));
    const size = 4;
    const last = Math.max(0,Math.ceil(channels.length/size)-1);
    page = Math.min(page,last);
    channels.slice(page*size,(page+1)*size).forEach((channel,index)=>{
      const label = channel.removed ? 'Desconectado' : channel.active ? 'Atividade' : 'Em espera';
      const control = button('',()=>{
        focusedChannel = channel.id;
        send({kind:'open',channel:channel.id});
        update();
      });
      control.classList.add('spy-channel');
      control.disabled = channel.removed;
      control.classList.toggle('spy-active',channel.active);
      control.setAttribute('aria-pressed',String(selected?.id===channel.id || audio?.id===channel.id));
      const text = node('span');
      text.append(node('strong',channel.name),node('small',channel.room+' · '+label));
      control.append(glyph(channel.kind==='wiretap' ? 'mic' : 'camera'),text);
      if (!channel.removed) markShortcut(control,String(index+1));
      list.append(control);
    });
    if (last>0) {
      const back = button('‹',()=>{page--;update();});
      const nextPage = button('›',()=>{page++;update();});
      back.disabled = page===0;
      nextPage.disabled = page===last;
      markShortcut(back,'ArrowLeft','←');
      markShortcut(nextPage,'ArrowRight','→');
      list.append(back,node('span',` ${page+1} / ${last+1} `),nextPage);
    }
    monitor.replaceChildren();
    if (selected) monitor.append(node('h3',selected.name),viewport);
    if (audio) monitor.append(node('p',`${audio.name} · ${view?.muted ? 'Silenciado' : audio.active ? 'Áudio ativo' : 'Sem voz detectada'}`));
    const channel = [selected,audio].find(channel=>channel?.id===focusedChannel) ?? selected ?? audio;
    if (!channel) { monitor.append(node('p','Selecione um canal.')); return; }
    const action = (label:string,key:string,run:()=>void) => {
      const control = button(label,run);
      markShortcut(control,key);
      monitor.append(control);
    };
    if (selected) action('Fotografar','5',()=>send({kind:'capture'}));
    if (audio) action(view?.muted ? 'Ouvir grampo' : 'Silenciar grampo','6',()=>send({kind:'mute',channel:audio.id}));
    action(channel.alerts ? 'Silenciar alertas' : 'Ativar alertas','7',()=>send({kind:'alerts',channel:channel.id}));
    action('Renomear','8',()=>{
      editing = channel.id;
      const form = node('form');
      const input = node('input');
      input.value = channel.name;
      input.maxLength = 32;
      input.setAttribute('aria-label','Nome do canal');
      const save = node('button','Salvar');
      form.append(input,save);
      form.onsubmit = event=>{
        event.preventDefault();
        send({kind:'rename',channel:channel.id,name:input.value});
        editing = undefined;
        key = '';
        update();
      };
      monitor.append(form);
      input.focus();
      input.select();
      input.onkeydown = event=>{
        if (event.key!=='Escape') return;
        event.preventDefault();
        editing = undefined;
        key = '';
        update();
      };
    });
    action('Fechar canal','9',()=>send({kind:'close-channel',channel:channel.id}));
  }

  launch.onclick = ()=>{
    if (dialog.open) return;
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
    if (event.key==='ArrowLeft' && page===0 || event.key==='ArrowRight' && (page+1)*4>=(view?.channels.length ?? 0)) return;
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
    destroy() { stopViewport(); launch.onclick = null; dialog.onclose = null; dialog.close(); launch.hidden = true; },
  };
}
