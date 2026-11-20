import {HudHelp} from './hud-help';
import type {ContextKey} from './context-action-keys';
import {isGear} from '../equipment';
import {objects,type ObjectKind} from '../gameplay';
import {itemSymbols} from '../world-art';

export type NearbyItem = {
  key:string;
  kind:ObjectKind;
  name:string;
  verb:string;
  activate:()=>void;
};

export function NearbyItems({items,keys}:{items:readonly NearbyItem[];keys?:readonly ContextKey[]}) {
  return items.map(({key,kind,name,verb,activate},index)=>{
    const symbol = !isGear(kind) ? itemSymbols[kind] : undefined;
    return <HudHelp key={key} className="item-tile context-item" data-kind={kind}
      help={`${verb} ${name}.`} aria-label={`${verb} ${name}`} aria-keyshortcuts={keys?.[index]?.key} onClick={activate}>
      {symbol ? <span className="item-art-symbol" aria-hidden="true">{symbol}</span> :
        <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+objects[kind].portrait} alt="" draggable={false}/>}
      <span className="item-caption">{name}</span>
    </HudHelp>;
  });
}


export function NearbyActions({items,expanded,toggle,trigger,keys}:{items:readonly NearbyItem[];expanded:boolean;toggle:()=>void;trigger?:ContextKey;keys?:readonly ContextKey[]}) {
  return <>
    <HudHelp className="hud-button" id="nearby-objects" help="Veja os objetos que você pode alcançar." aria-controls="nearby-items"
      aria-expanded={expanded} hidden={!items.length} aria-keyshortcuts={trigger?.key} data-context-overflow={trigger?.overflow} onClick={toggle}>
      <svg className="hud-glyph" aria-hidden="true"><use href="#icon-search"/></svg>Objetos próximos
    </HudHelp>
    <div id="nearby-items" role="group" aria-label="Itens ao alcance" hidden={!expanded}>
      <NearbyItems items={items} keys={keys}/>
    </div>
  </>;
}

export function createNearbyActions() {
  let items:readonly NearbyItem[] = [];
  return {
    get:()=>items,
    update(next:readonly NearbyItem[]) { items = next; },
  };
}
