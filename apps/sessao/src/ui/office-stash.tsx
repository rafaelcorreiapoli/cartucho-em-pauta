import {useDialogKeys} from './use-dialog-keys';
import type {ShortcutEntry} from '../action-shortcuts';
import {officeRules} from '../private-offices';
import {INVENTORY_SLOTS,objects,type GameplayAction,type GameplayView,type WorldItem} from '../gameplay';

type Props = {
  stash:NonNullable<GameplayView['officeStash']>;
  inventory:readonly WorldItem[];
  send:(action:GameplayAction)=>void;
  close:()=>void;
};

export function OfficeStash({stash,inventory,send,close}:Props) {
  const grids = [
    {name:'Armário',items:stash.items,size:officeRules.stashSlots,verb:'Retirar',kind:'office-take',blocked:inventory.length>=INVENTORY_SLOTS},
    {name:'Inventário',items:inventory,size:INVENTORY_SLOTS,verb:'Guardar',kind:'office-stash',blocked:stash.items.length>=officeRules.stashSlots},
  ] as const;
  const entries:ShortcutEntry[] = [{name:'Fechar',activate:close}];
  const actions = new Map<string,()=>void>();
  const panel = useDialogKeys<HTMLDivElement>(key=>actions.get(key),entries);
  return <div ref={panel} className="grid gap-4">
    <p>{stash.level ? 'Segurança nível '+stash.level : 'Armário arrombado'}</p>
    {grids.map(({name,items,size,verb,kind,blocked})=><section key={name}>
      <h3>{name} <small>{items.length}/{size}</small></h3>
      <div className="office-stash-grid">
        {Array.from({length:size},(_,index)=>{
          const item = items[index];
          if (!item) return <span key={index} className="item-tile item-tile-empty" aria-hidden="true"/>;
          const definition = objects[item.kind];
          const name = item.document?.title ?? definition.name;
          const key = kind==='office-take' ? String(index+1) : 'Shift+'+(index+1);
          const label = verb+' '+name;
          const activate = ()=>send({kind,item:item.id,place:stash.id});
          if (!blocked) {
            actions.set(key,activate);
            entries.push({name:label,activate});
          }
          return <button type="button" key={index} className="item-tile" disabled={blocked} title={label}
            aria-label={label} aria-keyshortcuts={key} onClick={activate}>
            <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+definition.portrait} alt="" draggable={false}/>
            <span className="item-caption">{name}</span>
            <kbd className="action-key" aria-hidden="true">{key}</kbd>
          </button>;
        })}
      </div>
    </section>)}
  </div>;
}
