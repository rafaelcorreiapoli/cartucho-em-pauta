import type {ShortcutEntry} from '../action-shortcuts';
import {objects,type GameplayAction,type GameplayView} from '../gameplay';
import {useDialogKeys} from './use-dialog-keys';

type EquipmentState = Pick<GameplayView,'equipped'|'megaphoneSeconds'|'modulator'|'nightVision'|'equipmentCooldowns'>;

export function EquipmentPanel({state,available,send,close}:{
  state:EquipmentState;available:boolean;send:(action:GameplayAction)=>void;close:()=>void;
}) {
  const entries:ShortcutEntry[] = [{name:'Fechar',activate:close}];
  const panel = useDialogKeys<HTMLDivElement>(()=>undefined,entries);
  const items = (state.equipped ?? []).map(gear=>{
    const item = objects[gear.kind];
    const unequip = ()=>send({kind:'unequip',item:gear.id});
    const toggleMegaphone = ()=>send({kind:'toggle-megaphone'});
    const toggleNightVision = ()=>send({kind:'toggle-night-vision'});
    const nightVisionLabel = state.nightVision ? 'Desligar visão noturna' : 'Ligar visão noturna';
    const toggleModulator = ()=>send({kind:'toggle-modulator'});
    const cooldown = state.equipmentCooldowns?.[gear.id];
    const megaphoneLabel = state.megaphoneSeconds ? 'Encerrar megafone' : 'Ativar megafone';
    const modulatorLabel = state.modulator?.active ? 'Desligar modulador' : 'Ligar modulador';
    if (available) {
      if (gear.kind==='nightVision') entries.push({name:nightVisionLabel,activate:toggleNightVision});
      entries.push({name:'Desequipar '+item.name,activate:unequip});
      if (gear.kind==='megaphone' && !cooldown) entries.push({name:megaphoneLabel,activate:toggleMegaphone});
      if (gear.kind==='voiceModulator' && state.modulator) entries.push({name:modulatorLabel,activate:toggleModulator});
    }
    return <li key={gear.id}>
      <img className="item-portrait" src={import.meta.env.BASE_URL+'assets/'+item.portrait} alt="" draggable={false}/>
      <strong>{item.name}</strong>
      {available && <>
        <button type="button" className="hud-button hud-button--secondary" onClick={unequip}>Desequipar</button>
        {gear.kind==='megaphone' && <button type="button" className="hud-button hud-button--secondary" disabled={!!cooldown}
          onClick={toggleMegaphone}>{state.megaphoneSeconds ? `Encerrar · ${state.megaphoneSeconds}s` :
            cooldown ? `Recarga · ${cooldown}s` : megaphoneLabel}</button>}
        {gear.kind==='nightVision' && <button type="button" className="hud-button hud-button--secondary"
          aria-pressed={!!state.nightVision} onClick={toggleNightVision}>{nightVisionLabel}</button>}
        {gear.kind==='voiceModulator' && state.modulator && <button type="button" className="hud-button hud-button--secondary"
          onClick={toggleModulator}>{modulatorLabel}</button>}
      </>}
    </li>;
  });
  return <div ref={panel} className="contents">
    {items.length ? <ul className="equipment-list">{items}</ul> :
      <p className="equipment-empty"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-inventory"/></svg>Nenhum item equipado.</p>}
  </div>;
}
