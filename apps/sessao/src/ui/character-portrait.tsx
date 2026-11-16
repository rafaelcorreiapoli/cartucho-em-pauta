import type {CSSProperties} from 'react';

export function CharacterPortrait({character,className}:{character:number;className?:string}) {
  const style = {'--portrait-column':character%2,'--portrait-row':Math.floor(character/2)} as CSSProperties;
  return <span className={className ? `portrait ${className}` : 'portrait'} data-skin={character} style={style} aria-hidden="true"/>;
}
