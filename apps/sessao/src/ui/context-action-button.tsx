import {HudHelp} from './hud-help';
import type {ContextKey} from './context-action-keys';
import type {Station} from '../plenary';

export function ContextActionButton({station,label,accessibleLabel,icon,detail,action,id,blocked,disabled,activate,presentation}:{
  station?:Station;label:string;accessibleLabel?:string;icon:string;detail?:string;action?:string;id?:string;blocked?:string;disabled?:boolean;activate:()=>void;presentation?:ContextKey;
}) {
  return <HudHelp id={id} className="hud-button hud-button--secondary" help={blocked || [accessibleLabel ?? label,detail].filter(Boolean).join(" · ")}
    aria-label={accessibleLabel} disabled={disabled || !!blocked} data-action={action} data-station={station} aria-keyshortcuts={presentation?.key} data-context-overflow={presentation?.overflow} onClick={activate}>
    <svg className="hud-glyph" aria-hidden="true"><use href={`#icon-${icon}`}/></svg>
    <span>{label}{blocked ? <small> · {blocked}</small> : detail && <small>{detail}</small>}</span>
  </HudHelp>;
}
