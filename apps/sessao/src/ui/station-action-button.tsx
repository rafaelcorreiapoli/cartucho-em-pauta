import type {Station} from '../plenary';

export function StationActionButton({station,label,icon,detail,action,id,activate}:{
  station:Station;label:string;icon:string;detail?:string;action?:string;id?:string;activate:()=>void;
}) {
  return <button id={id} className="hud-button hud-button--secondary" type="button"
    data-action={action} data-station={station} onClick={activate}>
    <svg className="hud-glyph" aria-hidden="true"><use href={`#icon-${icon}`}/></svg>
    <span>{label}{detail ? <small>{detail}</small> : null}</span>
  </button>;
}
