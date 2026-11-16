import type {CSSProperties} from 'react';

export function CharacterPortrait({character,className,id}:{character:number;className?:string;id?:string}) {
  const style = {'--portrait-column':character%2,'--portrait-row':Math.floor(character/2)} as CSSProperties;
  return <span id={id} className={className ? `portrait ${className}` : 'portrait'} data-skin={character} style={style} aria-hidden="true"/>;
}
