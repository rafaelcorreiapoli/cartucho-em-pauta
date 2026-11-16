import {isGear} from '../equipment';
import {objects,type ObjectKind} from '../gameplay';
import {itemSymbols} from '../photo-renderer';

export type NearbyItem = {
  key:string;
  kind:ObjectKind;
  name:string;
  verb:string;
  activate:()=>void;
};

export function NearbyItems({items}:{items:readonly NearbyItem[]}) {
  return items.map(({key,kind,name,verb,activate})=>{
    const symbol = !isGear(kind) ? itemSymbols[kind] : undefined;
    return <button key={key} type="button" className="item-tile context-item" data-kind={kind}
      title={`${verb} · ${name}`} aria-label={`${verb} ${name}`} onClick={activate}>
      {symbol ? <span className="item-art-symbol" aria-hidden="true">{symbol}</span> :
        <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+objects[kind].portrait} alt="" draggable={false}/>}
      <span className="item-caption">{name}</span>
    </button>;
  });
}
