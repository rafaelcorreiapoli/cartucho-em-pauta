import {snakeDirection} from '../phone-snake';
import {MINIGAME_FRUIT_XP} from '../progression';
import {useCallback,useMemo,useState} from 'react';
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

export function PhoneSnake({game,bets,candy,wallet,available,board,send,close}:{
  game?:SnakeView; bets?:BetsRound; candy?:CandyRound; wallet:number; available:boolean; board:Ref<HTMLCanvasElement>; send:(action:GameplayAction)=>void; close?:()=>void;
}) {
  const [mini,setMini] = useState<'candy'|'bets'>();
  const start = useCallback(()=>send({kind:'game-start'}),[send]);
  const startCandy = useCallback(()=>{setMini('candy');send({kind:'candy-start'});},[send]);
  const openBets = useCallback(()=>setMini('bets'),[]);
  const finished = game?.status==='won' || game?.status==='lost';
  const directions = useMemo(()=>controls.map(([direction,name,arrow])=>({direction,name,arrow,activate:()=>send({kind:'game-turn',direction})})),[send]);
  const hasGame = !!game;
  const entries = useMemo(()=>[
    ...(close ? [{name:'Fechar aplicativo',activate:close}] : []),
    ...(available ? !hasGame ? [
      {name:'Snake',activate:start},{name:'Combina Doces',activate:startCandy},{name:'Bets',activate:openBets},
    ] : finished ? [{name:'Jogar de novo',activate:start}] : directions : []),
  ],[available,close,directions,finished,hasGame,openBets,start,startCandy]);
  const panel = useDialogKeys<HTMLElement>(key=>{
    if (!available || mini) return;
    if (key==='1' && (!game || finished)) return start;
    if (!game && key==='2') return startCandy;
    if (!game && key==='3') return openBets;
    if (game && !finished) return directions.find(option=>option.direction===snakeDirection(key))?.activate;
  },mini && available ? undefined : entries);
  const attach = (element:HTMLElement|null)=>{panel.current = element;};
  if (!available) return <p ref={attach}>O jogo está disponível durante a articulação.</p>;
  if (mini) return mini==='candy' ? <CandyMatch round={candy} send={send} close={close}/> : <Bets wallet={wallet} round={bets} send={send} close={close}/>;
  if (!game) return <div ref={attach} className="phone-games-menu">
    <PhoneAppButton name="Snake" icon="snake" shortcut="1" onClick={start}/>
    <PhoneAppButton name="Combina Doces" icon="candy" shortcut="2" onClick={startCandy}>🍬</PhoneAppButton>
    <PhoneAppButton name="Bets" icon="bets" shortcut="3" onClick={openBets}>🎲</PhoneAppButton>
  </div>;
  const status = game.status==='ready' ? 'Use as setas para começar' : game.status==='won' ? 'Meta alcançada!' :
    game.status==='lost' ? 'Fim de jogo' : '';
  return <section ref={attach} className="phone-minigame phone-snake" aria-label="Snake">
    <div className="snake-readout"><strong>{game.score} / {SNAKE_GOAL} frutas</strong><span role="status">{status}</span></div>
    <canvas ref={board} width={240} height={240} role="img" aria-label="Tabuleiro do Snake"/>
    <div className="snake-pad" aria-label="Controles do Snake" hidden={finished}>
      {directions.map(({name,arrow,activate})=><button key={name} type="button" aria-label={name}
        onClick={activate}>{arrow}</button>)}
    </div>
    <p className="game-reward">{MINIGAME_FRUIT_XP} XP por fruta coletada</p>
    {finished && <button type="button" className="hud-button hud-button--secondary" aria-keyshortcuts="1"
      onClick={start}>Jogar de novo <kbd className="action-key" aria-hidden="true">1</kbd></button>}
  </section>;
}
