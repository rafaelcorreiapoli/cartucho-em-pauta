import {usePhoneKeys} from './use-phone-keys';
import {MINIGAME_FRUIT_XP} from '../progression';
import {useEffect,useRef,useState,type CSSProperties} from 'react';

import {BET_PAYOUT,BET_SPIN_MS,BET_STAKES,BET_SYMBOLS,type BetsRound} from '../bets';
import {money} from '../politics';
import type {GameplayAction} from '../gameplay';

import {candyFruit as fruit,candyWidth as width,CANDY_SWAP_MS,CANDY_BURST_MS,swapCandy,type CandyRound} from '../candy';

type Swap = {from:number;to:number;board:number[];matches:Set<number>;stage:'swap'|'burst'|'return'};

export function CandyMatch({round,send}:{round?:CandyRound;send:(action:GameplayAction)=>void}) {
  const [selected,setSelected] = useState<number>();
  const [motion,setMotion] = useState<Swap>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const restart = ()=>{if (!motion) {setSelected(undefined);send({kind:'candy-start'});}};
  const panel = usePhoneKeys(key=>key==='1' && round ? restart : undefined);
  if (!round) return <section className="phone-minigame candy-game" aria-label="Combina Doces">
    <button className="hud-button" type="button" onClick={()=>send({kind:'candy-start'})}>Iniciar tabuleiro</button>
  </section>;
  const board = motion?.stage==='burst' ? motion.board : round.board;
  function swap(index:number) {
    if (motion || !round) return;
    const move = selected===undefined ? undefined : swapCandy(round.board,selected,index);
    if (!move || selected===undefined) {
      setSelected(index===selected ? undefined : index);
      return;
    }
    const animation = {...move,from:selected,to:index};
    setSelected(undefined);
    setMotion({...animation,stage:'swap'});
    timer.current = setTimeout(()=>{
      setMotion({...animation,stage:move.matches.size ? 'burst' : 'return'});
      if (move.matches.size) send({kind:'candy-swap',cells:[animation.from,animation.to],token:round.id});
      timer.current = setTimeout(()=>setMotion(undefined),move.matches.size ? CANDY_BURST_MS : CANDY_SWAP_MS);
    },CANDY_SWAP_MS);
  }
  return <section ref={panel} className="phone-minigame candy-game" aria-label="Combina Doces">
    <header><p>Alinhe três frutas iguais</p><strong role="status">{round.score} pontos</strong></header>
    <div className="phone-candy-board">{board.map((kind,index)=>{
      const destination = index===motion?.from ? motion.to : index===motion?.to ? motion.from : undefined;
      const moving = (motion?.stage==='swap' || motion?.stage==='return') && destination!==undefined;
      const burst = motion?.stage==='burst' && motion.matches.has(index);
      return <button key={index} type="button" aria-pressed={selected===index} data-burst={burst}
        aria-label={`Fruta ${index+1} ${fruit[kind]}`} onKeyDown={event=>{
          const column = index%width;
          const next = {ArrowLeft:column>0 ? index-1 : index,ArrowRight:column<width-1 ? index+1 : index,
            ArrowUp:index>=width ? index-width : index,ArrowDown:index<width*(width-1) ? index+width : index}[event.key];
          if (next===undefined) return;
          event.preventDefault();
          event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus();
        }} onClick={()=>swap(index)}>
        <span className="candy-fruit" data-moving={moving ? motion.stage : undefined} style={moving ? {
          '--fruit-x':`${(destination%width-index%width)*100}%`,
          '--fruit-y':`${(Math.floor(destination/width)-Math.floor(index/width))*100}%`,
        } as CSSProperties : undefined} aria-hidden="true">{fruit[kind]}</span>
      </button>;
    })}</div>
    <p className="game-reward">{MINIGAME_FRUIT_XP} XP por fruta eliminada</p>
    <button className="hud-button" type="button" disabled={!!motion} aria-keyshortcuts="1"
      onClick={restart}>Novo tabuleiro <kbd className="action-key" aria-hidden="true">1</kbd></button>
  </section>;
}

const initialReels = [0,1,2];

export function Bets({wallet,round,send}:{wallet:number;round?:BetsRound;send:(action:GameplayAction)=>void}) {
  const [stake,setStake] = useState<(typeof BET_STAKES)[number]>(BET_STAKES[0]);
  const [shown,setShown] = useState(round);
  const spinning = !!round && round.id!==shown?.id;
  useEffect(()=>{
    if (!spinning) return;
    const timer = setTimeout(()=>setShown(round),BET_SPIN_MS);
    return ()=>clearTimeout(timer);
  },[round,spinning]);
  const reels = shown?.reels ?? initialReels;
  const balance = Math.round(wallet*10);
  const result = shown && (shown.payout ? `Trinca! +${money(shown.payout-shown.stake)}` : `Sem trinca · −${money(shown.stake)}`);
  const disabled = spinning || stake>balance;
  const spin = ()=>{if (!disabled) send({kind:'bets-spin',quantity:stake,token:round?.id ?? 0});};
  const panel = usePhoneKeys(key=>key==='1' ? spin : undefined);
  return <section ref={panel} className="phone-minigame bets-game" aria-label="Bets">
    <header><p>Saldo do personagem</p><strong>{money(wallet)}</strong></header>
    <p>Três símbolos iguais pagam {BET_PAYOUT}× a aposta.</p>
    <div className="bets-reels" aria-label={spinning ? 'Girando' : reels.map(symbol=>BET_SYMBOLS[symbol]).join(' ')}>
      {reels.map((symbol,index)=><div className="bets-reel" key={index}>
        {spinning ? <div className="bets-strip" aria-hidden="true">
          {[...BET_SYMBOLS,BET_SYMBOLS[0]].map((glyph,slot)=><span key={slot}>{glyph}</span>)}
        </div> : <span>{BET_SYMBOLS[symbol]}</span>}
      </div>)}
    </div>
    <p className="bets-result" role="status">{spinning ? 'Girando…' : result}</p>
    <div className="bets-stakes" role="group" aria-label="Valor da aposta">
      {BET_STAKES.map(amount=><button type="button" className="hud-button hud-button--secondary" key={amount}
        aria-pressed={stake===amount} disabled={spinning || amount>balance} onClick={()=>setStake(amount)}>
        {money(amount/10)}
      </button>)}
    </div>
    <button type="button" className="hud-button" aria-keyshortcuts="1" disabled={disabled}
      onClick={spin}>
      Apostar {money(stake/10)} <kbd className="action-key" aria-hidden="true">1</kbd>
    </button>
  </section>;
}
