import {createRoot} from 'react-dom/client';
import {characterStats} from '../character-stats';
import {NAMES,type Player} from '../map';
import {CharacterPortrait} from './character-portrait';

type PickerPlayer = Pick<Player,'id'|'nick'|'character'>;

export function CharacterPicker({players,ownId,select}:{
  players:readonly PickerPlayer[];ownId:string;select:(character:number)=>void;
}) {
  const ownCharacter = players.find(player=>player.id===ownId)?.character;
  return NAMES.map((name,character)=>{
    const stats = characterStats[character];
    return <button key={name} type="button" className="hud-option character-option" aria-pressed={character===ownCharacter}
      title={`${stats.hp} PV · Força ${stats.attack} · Velocidade ${stats.speed}`} onClick={()=>select(character)}>
      <CharacterPortrait character={character}/>
      <span className="character-players">{players.filter(player=>player.character===character).map(player=>
        <span key={player.id} title={player.nick}>{player.nick}</span>,
      )}</span>
      <span className="character-name">{name}</span>
    </button>;
  });
}

export function mountCharacterPicker(element:HTMLElement,ownId:string,select:(character:number)=>void) {
  const root = createRoot(element);
  let rosterKey = '';
  return {
    render(players:readonly Player[]) {
      const roster = players.map(({id,nick,character})=>({id,nick,character}));
      const nextKey = JSON.stringify(roster);
      if (nextKey===rosterKey) return;
      rosterKey = nextKey;
      root.render(<CharacterPicker players={roster} ownId={ownId} select={select}/>);
    },
    destroy:()=>root.unmount(),
  };
}
