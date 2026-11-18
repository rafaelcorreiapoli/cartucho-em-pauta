import {createRoot} from 'react-dom/client';
import type {ShortcutEntry} from '../action-shortcuts';
import {Hand,Shirt,Footprints,Cpu} from 'lucide';
import {equippedWeapon,equipmentSlots,xray} from '../equipment';
import {cashAmount,objects,type GameplayView,type ObjectKind} from '../gameplay';
import {money} from '../politics';
import {weapons} from '../weapons';
import {HudHelp} from './hud-help';

export const equipmentControls = {
  xray:{key:'X',action:'scan-xray'},
  binoculars:{key:'B',action:'use-binoculars'},
  megaphone:{key:'H',action:'toggle-megaphone'},
  voiceModulator:{key:'U',action:'toggle-modulator'},
} as const;
export const weaponControl = {key:'Space',action:'attack'} as const;
type EquipmentControl = typeof equipmentControls[keyof typeof equipmentControls] | typeof weaponControl;
export type EquipmentAction = EquipmentControl['action'];

const slots = [
  {label:'Mãos',icon:Hand},
  {label:'Tronco',icon:Shirt},
  {label:'Pés',icon:Footprints},
  {label:'Acessório 1',icon:Cpu},
  {label:'Acessório 2',icon:Cpu},
] as const;
const secondsLabel = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});

export function equippedGearState(state?:GameplayView) {
  if (!state) return;
  return {
    slots:equipmentSlots(state.equipped ?? []).map(item=>{
      if (!item) return;
      const weapon = equippedWeapon([item]);
      const control = weapon ? weaponControl : equipmentControls[item.kind as keyof typeof equipmentControls];
      const seconds = state.equipmentCooldowns?.[item.id] ?? 0;
      const charges = item.kind==='xray' ? `${item.charges ?? 0}/${xray.capacity}` : '';
      const activeSeconds = item.kind==='binoculars' ? state.binocularSeconds : item.kind==='megaphone' ? state.megaphoneSeconds : undefined;
      const scan = item.kind==='xray' ? state.xrayVision : undefined;
      const scanning = !!scan;
      const modulating = item.kind==='voiceModulator' && !!state.modulator?.active;
      const active = !!activeSeconds || scanning || modulating;
      const time = activeSeconds ? `${activeSeconds} s` : scan ? `${scan.remaining}s · ${charges}` :
        charges || (seconds ? `${secondsLabel.format(seconds)} s` : '');
      const name = objects[item.kind].name;
      const label = activeSeconds ? `${name} · Ativo: ${time}` : seconds ? `${name} · Recarga: ${time}` :
        charges ? `${name} · ${time}` : name;
      const tooltip = weapon ? `${label} · ${weapons[weapon].staminaCost} stamina por golpe` :
        item.kind==='voiceModulator' ? `${label} · ${modulating ? 'Ligado' : 'Desligado'} (U)` : label;
      const toggle = item.kind==='xray' || item.kind==='megaphone' || item.kind==='voiceModulator';
      return {
        kind:item.kind, control, active, time, tooltip, pressed:toggle ? active : undefined,
        label:item.kind==='xray' ? `${scanning ? 'Desativar' : 'Ativar'} ${label}` : label,
        hint:control?.key,
      };
    }),
    briefcases:state.inventory.filter(item=>item.kind==='briefcase').map(item=>({
      id:item.id,amount:cashAmount(item) ?? 0,stolenFrom:item.cashStolenFrom,
    })),
    concealment:state.concealmentSeconds,
  };
}

function GearPortrait({kind}:{kind:ObjectKind}) {
  return <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+objects[kind].portrait} alt="" draggable={false}/>;
}

type GearState = NonNullable<ReturnType<typeof equippedGearState>>;

function EquippedTile({item,activate}:{item:NonNullable<GearState['slots'][number]>;activate:(action:EquipmentAction)=>void}) {
  const action = item.control?.action;
  return <HudHelp as={action ? "button" : "span"} className="equipped-gear-tile"
    data-kind={item.kind} data-active={String(item.active)} help={item.tooltip} aria-label={item.label}
    aria-pressed={item.pressed} aria-keyshortcuts={item.hint}
    onClick={action ? ()=>activate(action) : undefined}>
    <GearPortrait kind={item.kind}/>
    <span className="equipped-gear-footer">
      <span className="equipped-gear-timer" aria-hidden="true" hidden={!item.time}>{item.time}</span>
    </span>
    {item.hint && <kbd className="action-key" aria-hidden="true">{item.hint==='Space' ? 'Espaço' : item.hint.toUpperCase()}</kbd>}
  </HudHelp>;
}

export function EquippedGear({state,activate,inspectBriefcase}:{state:GearState;activate:(action:EquipmentAction)=>void;inspectBriefcase:(id:number)=>void}) {
  return <>
    <div className="equipped-gear-slots" role="presentation">
      {slots.map(({label,icon},index)=>{
        const item = state.slots[index];
        return <div key={label} className="gear-slot" role="listitem">
          {item ? <EquippedTile item={item} activate={activate}/> : <HudHelp as="span" help={`${label}: espaço livre para equipar um item.`} className="gear-slot-empty" aria-label={label+' · vazio'}>
            <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">{icon.map(([tag,attrs],i)=>{
              const Tag = tag as 'path'|'rect'|'line'|'circle';
              return <Tag key={i} {...attrs}/>;
            })}</svg>
          </HudHelp>}
        </div>;
      })}
      {state.concealment ? <HudHelp as="span" className="equipped-gear-tile" role="listitem" help="Tempo restante com o dinheiro escondido.">
        <GearPortrait kind="mensalUnderwear"/>
        <span className="equipped-gear-footer"><span className="equipped-gear-timer">{state.concealment} s</span></span>
      </HudHelp> : null}
    </div>
    {state.briefcases.length>0 && <div className="carried-briefcases" role="listitem" aria-label="Maletas carregadas">
      {state.briefcases.map(({id,amount,stolenFrom})=>{
        const value = money(amount);
        const origin = stolenFrom ? ` · Roubada ${stolenFrom.safe ? 'do cofre de' : 'de'} ${stolenFrom.name}` : '';
        return <HudHelp key={id} className="gear-slot carried-briefcase" help={`Veja o conteúdo da maleta. ${value}${origin}`}
          aria-label={`${objects.briefcase.name} · ${value}`} onClick={()=>inspectBriefcase(id)}>
          <GearPortrait kind="briefcase"/>
        </HudHelp>;
      })}
    </div>}
  </>;
}

export function mountEquippedGear(element:HTMLElement,activate:(action:EquipmentAction)=>void,inspectBriefcase:(id:number)=>void) {
  const root = createRoot(element);
  let current: string|undefined;
  let state:GearState|undefined;
  const visible = ()=>element.checkVisibility({visibilityProperty:true,opacityProperty:true});
  return {
    render(view?:GameplayView) {
      const next = equippedGearState(view);
      const key = JSON.stringify(next);
      element.hidden = !next;
      if (key===current) return;
      current = key;
      state = next;
      root.render(state ? <EquippedGear state={state} activate={activate} inspectBriefcase={inspectBriefcase}/> : null);
    },
    shortcuts():ShortcutEntry[] {
      if (!visible()) return [];
      return state?.slots.flatMap(item=>{
        const action = item?.control?.action;
        return action ? [{name:item.label,activate:()=>{if (visible()) activate(action);}}] : [];
      }) ?? [];
    },
    destroy:()=>{element.hidden = true; root.unmount();},
  };
}
