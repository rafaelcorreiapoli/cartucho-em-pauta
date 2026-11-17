import {bindContextCommand} from './context-command';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
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
      title={`${verb} · ${name}`} aria-label={`${verb} ${name}`} ref={bindContextCommand(activate)} onClick={activate}>
      {symbol ? <span className="item-art-symbol" aria-hidden="true">{symbol}</span> :
        <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+objects[kind].portrait} alt="" draggable={false}/>}
      <span className="item-caption">{name}</span>
    </button>;
  });
}


export function NearbyActions({items,expanded,toggle}:{items:readonly NearbyItem[];expanded:boolean;toggle:()=>void}) {
  return <>
    <button className="hud-button" id="nearby-objects" type="button" aria-controls="nearby-items"
      aria-expanded={expanded} hidden={!items.length} ref={bindContextCommand(toggle)} onClick={toggle}>
      <svg className="hud-glyph" aria-hidden="true"><use href="#icon-search"/></svg>Objetos próximos
    </button>
    <div id="nearby-items" role="group" aria-label="Itens ao alcance" hidden={!expanded}>
      <NearbyItems items={items}/>
    </div>
  </>;
}

export function mountNearbyActions(host:HTMLElement) {
  const root = createRoot(host);
  let items:readonly NearbyItem[] = [];
  let expanded = false;

  function setExpanded(next:boolean) {
    if (expanded===next) return;
    expanded = next;
    render();
    if (expanded) host.querySelector<HTMLElement>('#nearby-items')?.scrollTo(0,0);
  }

  function render() {
    flushSync(()=>root.render(<NearbyActions items={items} expanded={expanded} toggle={()=>setExpanded(!expanded)}/>));
  }

  return {
    update(next:readonly NearbyItem[]) {
      items = next;
      if (!items.length) expanded = false;
      render();
    },
    visible:()=>items.length>0,
    expanded:()=>expanded,
    close:()=>setExpanded(false),
    destroy:()=>root.unmount(),
  };
}
