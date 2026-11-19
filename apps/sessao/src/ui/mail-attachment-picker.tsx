import {useDialogKeys} from './use-dialog-keys';
import {useLayoutEffect,useRef,useState} from 'react';
import type {AttachmentRef} from '../internal-mail';
import type {Photo} from '../photography';
import {HudIcon} from './hud-icon';

export type AttachmentChoice = AttachmentRef & {label:string;photo?:Photo};
export type AttachmentCategory = 'document'|'photo';

function PhotoPreview({photo,draw}:{photo:Photo;draw:(canvas:HTMLCanvasElement,photo:Photo)=>void}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(()=>{if (canvas.current) draw(canvas.current,photo);},[draw,photo]);
  return <canvas ref={canvas} aria-hidden="true"/>;
}

export function MailAttachmentPicker({choices,category,setCategory,pick,cancel,draw}:{
  choices:readonly AttachmentChoice[];category?:AttachmentCategory;setCategory:(category:AttachmentCategory|undefined)=>void;
  pick:(choice:AttachmentChoice)=>void;cancel:()=>void;draw:(canvas:HTMLCanvasElement,photo:Photo)=>void;
}) {
  const [query,setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  const categories = [{kind:'document' as const,label:'Documentos',icon:'document'},{kind:'photo' as const,label:'Fotografias',icon:'app-photos'}];
  const inCategory = (choice:AttachmentChoice,kind:AttachmentCategory)=>kind==='photo' ? choice.kind==='photo' : choice.kind!=='photo';
  const visible = choices.filter(choice=>category && inCategory(choice,category) && choice.label.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));
  const entries = [
    {name:'Cancelar anexo',activate:cancel},
    ...(category ? [
      {name:'Voltar às categorias',activate:()=>setCategory(undefined)},
      {name:'Buscar anexo',activate:()=>search.current?.focus()},
      ...visible.map(choice=>({name:choice.label,activate:()=>pick(choice)})),
    ] : categories.map(entry=>({name:entry.label,activate:()=>{setQuery('');setCategory(entry.kind);}}))),
  ];
  const panel = useDialogKeys<HTMLElement>(()=>undefined,entries);
  useLayoutEffect(()=>{
    const previous = document.activeElement as HTMLElement|null;
    panel.current?.querySelector<HTMLElement>('input,button')?.focus({preventScroll:true});
    return ()=>{if (previous?.isConnected) previous.focus({preventScroll:true});};
  },[category]);
  return <section ref={panel} className="mail-picker" role="dialog" aria-label="Selecionar anexo" onKeyDown={event=>{
    if (event.key==='Escape') {event.preventDefault();event.stopPropagation();cancel();}
  }}>
    <header><h3>{categories.find(entry=>entry.kind===category)?.label ?? 'Selecionar anexo'}</h3>
      <p>{category ? 'Escolha um item para anexar ao comunicado.' : 'Qual tipo de anexo você quer enviar?'}</p></header>
    {!category ? <div className="mail-attachment-categories">
      {categories.map(entry=><button key={entry.kind} type="button" onClick={()=>{setQuery('');setCategory(entry.kind);}}>
        <HudIcon name={entry.icon}/><span><strong>{entry.label}</strong><small>{choices.filter(choice=>inCategory(choice,entry.kind)).length} disponíveis</small></span>
      </button>)}
    </div> : <>
      <input ref={search} aria-label="Buscar anexo" placeholder={category==='photo' ? 'Buscar fotografia' : 'Buscar documento'} value={query} onChange={event=>setQuery(event.target.value)}/>
      <div className={category==='photo' ? 'mail-photo-grid' : 'mail-document-list'} aria-label={category==='photo' ? 'Fotografias disponíveis' : 'Documentos disponíveis'}>
        {visible.map(choice=><button key={choice.kind+'-'+choice.id} type="button" aria-label={choice.label} onClick={()=>pick(choice)}>
          {choice.photo ? <PhotoPreview photo={choice.photo} draw={draw}/> : <HudIcon name={choice.kind==='photo' ? 'app-photos' : 'document'}/>}
          <span>{choice.label}</span>
        </button>)}
        {!visible.length && <p>{category==='photo' ? 'Nenhuma fotografia encontrada.' : 'Nenhum documento encontrado.'}</p>}
      </div>
    </>}
    <footer><button type="button" className="mail-cancel" onClick={cancel}>Cancelar</button></footer>
  </section>;
}
