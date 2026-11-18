import {HudHelp} from './hud-help';
export function ContextOverflow({visible,expanded,shortcut,toggle}:{
  visible:boolean; expanded:boolean; shortcut?:string; toggle:()=>void;
}) {
  if (!visible) return null;
  return <>
    {expanded && <span className="context-overflow-break" aria-hidden="true"/>}
    <HudHelp className="hud-button hud-button--secondary context-more" help="Veja outras ações disponíveis aqui." aria-expanded={expanded}
      aria-keyshortcuts={shortcut} onClick={toggle}>
      Mais ações
    </HudHelp>
  </>;
}
