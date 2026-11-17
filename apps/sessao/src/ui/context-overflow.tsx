export function ContextOverflow({visible,expanded,shortcut,toggle}:{
  visible:boolean; expanded:boolean; shortcut?:string; toggle:()=>void;
}) {
  if (!visible) return null;
  return <>
    {expanded && <span className="context-overflow-break" aria-hidden="true"/>}
    <button type="button" className="hud-button hud-button--secondary context-more" aria-expanded={expanded}
      aria-keyshortcuts={shortcut} onClick={toggle}>
      Mais ações
      {shortcut && <kbd className="station-key" aria-hidden="true">{shortcut}</kbd>}
    </button>
  </>;
}
