import {useState} from 'react';
import {PhoneAppButton} from './phone-apps';
import {Bets,CandyMatch} from './phone-minigames';
import type {Ref} from 'react';
import type {GameplayAction} from '../gameplay';
import {SNAKE_GOAL,type SnakeView} from '../snake';

const controls = [
  ['up','Cima','↑'],['left','Esquerda','←'],['down','Baixo','↓'],['right','Direita','→'],
] as const;

export function PhoneSnake({game,available,board,send}:{
  game?:SnakeView; available:boolean; board:Ref<HTMLCanvasElement>; send:(action:GameplayAction)=>void;
}) {
  const [mini,setMini] = useState<'candy'|'bets'>();
  if (!available) return <p>O jogo está disponível durante a articulação.</p>;
  if (mini) return mini==='candy' ? <CandyMatch/> : <Bets/>;
  if (!game) return <div className="phone-games-menu">
    <PhoneAppButton name="Snake" icon="snake" shortcut="5" onClick={()=>send({kind:'game-start'})}/>
    <PhoneAppButton name="Combina Doces" icon="candy" shortcut="6" onClick={()=>setMini('candy')}>🍬</PhoneAppButton>
    <PhoneAppButton name="Bets" icon="bets" shortcut="7" onClick={()=>setMini('bets')}>🎲</PhoneAppButton>
  </div>;
  const finished = game.status==='won' || game.status==='lost';
  const status = game.status==='ready' ? 'Use as setas para começar' : game.status==='won' ? 'Meta alcançada!' :
    game.status==='lost' ? 'Fim de jogo' : '';
  return <>
    <div className="phone-snake">
      <div className="snake-readout"><strong>{game.score} / {SNAKE_GOAL} frutas</strong><span role="status">{status}</span></div>
      <canvas ref={board} width={240} height={240} role="img" aria-label="Tabuleiro do Snake"/>
      <div className="snake-pad" aria-label="Controles do Snake" hidden={finished}>
        {controls.map(([direction,label,arrow])=><button key={direction} type="button" aria-label={label}
          onClick={()=>send({kind:'game-turn',direction})}>{arrow}</button>)}
      </div>
    </div>
    {finished && <button type="button" className="hud-button hud-button--secondary" aria-keyshortcuts="5"
      onClick={()=>send({kind:'game-start'})}>Jogar de novo <kbd className="action-key" aria-hidden="true">5</kbd></button>}
  </>;
}
