import {MINIGAME_FRUIT_XP} from '../progression';
import {useState} from 'react';
import {useDialogKeys} from './use-dialog-keys';
import {PhoneAppButton} from './phone-apps';
import {Bets,CandyMatch} from './phone-minigames';
import {type CandyRound} from '../candy';
import type {BetsRound} from '../bets';
import type {Ref} from 'react';
import type {GameplayAction} from '../gameplay';
import {SNAKE_GOAL,type SnakeView} from '../snake';

const controls = [
  ['up','Cima','↑'],['left','Esquerda','←'],['down','Baixo','↓'],['right','Direita','→'],
] as const;

export function PhoneSnake({game,bets,candy,wallet,available,board,send}:{
  game?:SnakeView; bets?:BetsRound; candy?:CandyRound; wallet:number; available:boolean; board:Ref<HTMLCanvasElement>; send:(action:GameplayAction)=>void;
}) {
  const [mini,setMini] = useState<'candy'|'bets'>();
  const start = ()=>send({kind:'game-start'});
  const startCandy = ()=>{setMini('candy');send({kind:'candy-start'});};
  const openBets = ()=>setMini('bets');
  const finished = game?.status==='won' || game?.status==='lost';
  const panel = useDialogKeys<HTMLDivElement>(key=>{
    if (!available || mini) return;
    if (key==='1' && (!game || finished)) return start;
    if (!game && key==='2') return startCandy;
    if (!game && key==='3') return openBets;
  });
  if (!available) return <p>O jogo está disponível durante a articulação.</p>;
  if (mini) return mini==='candy' ? <CandyMatch round={candy} send={send}/> : <Bets wallet={wallet} round={bets} send={send}/>;
  if (!game) return <div ref={panel} className="phone-games-menu">
    <PhoneAppButton name="Snake" icon="snake" shortcut="1" onClick={start}/>
    <PhoneAppButton name="Combina Doces" icon="candy" shortcut="2" onClick={startCandy}>🍬</PhoneAppButton>
    <PhoneAppButton name="Bets" icon="bets" shortcut="3" onClick={openBets}>🎲</PhoneAppButton>
  </div>;
  const status = game.status==='ready' ? 'Use as setas para começar' : game.status==='won' ? 'Meta alcançada!' :
    game.status==='lost' ? 'Fim de jogo' : '';
  return <section ref={panel} className="phone-minigame phone-snake" aria-label="Snake">
    <div className="snake-readout"><strong>{game.score} / {SNAKE_GOAL} frutas</strong><span role="status">{status}</span></div>
    <canvas ref={board} width={240} height={240} role="img" aria-label="Tabuleiro do Snake"/>
    <div className="snake-pad" aria-label="Controles do Snake" hidden={finished}>
      {controls.map(([direction,label,arrow])=><button key={direction} type="button" aria-label={label}
        onClick={()=>send({kind:'game-turn',direction})}>{arrow}</button>)}
    </div>
    <p className="game-reward">{MINIGAME_FRUIT_XP} XP por fruta coletada</p>
    {finished && <button type="button" className="hud-button hud-button--secondary" aria-keyshortcuts="1"
      onClick={start}>Jogar de novo <kbd className="action-key" aria-hidden="true">1</kbd></button>}
  </section>;
}
