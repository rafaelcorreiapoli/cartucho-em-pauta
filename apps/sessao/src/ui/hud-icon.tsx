export function HudIcon({name,className}:{name:string;className?:string}) {
  return <svg className={className ? 'hud-glyph '+className : 'hud-glyph'} aria-hidden="true">
    <use href={'#icon-'+name}/>
  </svg>;
}
