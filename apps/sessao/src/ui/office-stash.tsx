import {officeRules} from '../private-offices';
import {INVENTORY_SLOTS,objects,type GameplayAction,type GameplayView,type WorldItem} from '../gameplay';

type Props = {
  stash:NonNullable<GameplayView['officeStash']>;
  inventory:readonly WorldItem[];
  send:(action:GameplayAction)=>void;
};

export function OfficeStash({stash,inventory,send}:Props) {
  const grids = [
    {name:'Armário',items:stash.items,size:officeRules.stashSlots,verb:'Retirar',kind:'office-take',blocked:inventory.length>=INVENTORY_SLOTS},
    {name:'Inventário',items:inventory,size:INVENTORY_SLOTS,verb:'Guardar',kind:'office-stash',blocked:stash.items.length>=officeRules.stashSlots},
  ] as const;
  return <div className="grid gap-4">
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
          return <button type="button" key={index} className="item-tile" disabled={blocked} title={verb+' '+name}
            aria-label={verb+' '+name} aria-keyshortcuts={key} onClick={()=>send({kind,item:item.id,place:stash.id})}>
            <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+definition.portrait} alt="" draggable={false}/>
            <span className="item-caption">{name}</span>
            <kbd className="action-key" aria-hidden="true">{key}</kbd>
          </button>;
        })}
      </div>
    </section>)}
  </div>;
}
