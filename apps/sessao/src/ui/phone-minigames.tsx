import {useEffect,useRef,useState,type CSSProperties} from 'react';

const fruit = ['🍓','🍋','🍇','🍒','🍊'];
const width = 5;
type Swap = {from:number;to:number;matches:Set<number>;stage:'swap'|'burst'|'return'};

function newBoard(source?:readonly number[],cleared?:ReadonlySet<number>) {
  const board:number[] = source ? [...source] : [];
  for (let index=0;index<width*width;index++) {
    if (cleared && !cleared.has(index)) continue;
    const forbidden = new Set<number>();
    for (const step of [1,width]) {
      for (const offset of [-2,-1,0]) {
        const start = index+step*offset;
        const end = start+step*2;
        if (start<0 || end>=width*width || (step===1 && Math.floor(start/width)!==Math.floor(end/width))) continue;
        const neighbors = [start,start+step,end].filter(cell=>cell!==index);
        if (board[neighbors[0]]!==undefined && board[neighbors[0]]===board[neighbors[1]]) forbidden.add(board[neighbors[0]]);
      }
    }
    const choices = fruit.map((_,kind)=>kind).filter(kind=>!forbidden.has(kind));
    if (!choices.length) return newBoard();
    board[index] = choices[Math.floor(Math.random()*choices.length)];
  }
  return board;
}

export function matchingFruit(board:readonly number[]) {
  const matches = new Set<number>();
  for (let index=0;index<board.length;index++) {
    for (const step of [1,width]) {
      if (step===1 && index%width>width-3) continue;
      if (board[index]===board[index+step] && board[index]===board[index+2*step]) {
        for (const offset of [0,step,2*step]) matches.add(index+offset);
      }
    }
  }
  return matches;
}

export function CandyMatch() {
  const [board,setBoard] = useState(()=>newBoard());
  const [selected,setSelected] = useState<number>();
  const [score,setScore] = useState(0);
  const [motion,setMotion] = useState<Swap>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  function swap(index:number) {
    if (motion) return;
    if (selected===undefined || Math.abs(selected%width-index%width)+Math.abs(Math.floor(selected/width)-Math.floor(index/width))!==1) {
      setSelected(index===selected ? undefined : index);
      return;
    }
    const next = [...board];
    [next[index],next[selected]] = [next[selected],next[index]];
    const matches = matchingFruit(next);
    const move = {from:selected,to:index,matches};
    setSelected(undefined);
    setMotion({...move,stage:'swap'});
    timer.current = setTimeout(()=>{
      if (matches.size) setBoard(next);
      setMotion({...move,stage:matches.size ? 'burst' : 'return'});
      timer.current = setTimeout(()=>{
        if (matches.size) {
          setBoard(newBoard(next,matches));
          setScore(previous=>previous+matches.size);
        }
        setMotion(undefined);
      },matches.size ? 260 : 170);
    },170);
  }
  return <section className="phone-minigame candy-game" aria-label="Combina Doces">
    <header><p>Alinhe três frutas iguais</p><strong role="status">{score} pontos</strong></header>
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
    <button className="hud-button" type="button" disabled={!!motion} aria-keyshortcuts="5"
      onClick={()=>{setBoard(newBoard());setScore(0);setSelected(undefined);}}>Novo tabuleiro <kbd>5</kbd></button>
  </section>;
}

const symbols = ['🐯','🍒','💎','🔔','🍀','7️⃣'];
const initialReels = [0,1,2];
export function winningReels(reels:readonly number[]) {
  return reels.length===3 && reels[0]===reels[1] && reels[1]===reels[2];
}

export function Bets() {
  const [points,setPoints] = useState(10);
  const [reels,setReels] = useState(initialReels);
  const [stopped,setStopped] = useState(0);
  const [spinning,setSpinning] = useState(false);
  const [result,setResult] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
  function spin() {
    if (spinning || !points) return;
    setStopped(0);
    setSpinning(true);
    setResult('');
    const final = reels.map(()=>Math.floor(Math.random()*symbols.length));
    timers.current = final.map((symbol,index)=>setTimeout(()=>{
      setStopped(index+1);
      setReels(current=>current.map((value,column)=>column===index ? symbol : value));
      if (index!==final.length-1) return;
      const won = winningReels(final);
      setPoints(current=>current+(won ? 8 : -1));
      setResult(won ? 'Trinca! +8 fichas' : 'Sem trinca · −1 ficha');
      setSpinning(false);
    },280+index*180));
  }
  return <section className="phone-minigame bets-game" aria-label="Bets">
    <header><p>Três símbolos iguais</p><strong>{points} fichas</strong></header>
    <div className="bets-reels" data-spinning={spinning} aria-label={reels.map(symbol=>symbols[symbol]).join(' ')}>
      {reels.map((symbol,index)=><div className="bets-reel" data-rolling={spinning && index>=stopped} key={index} >
        {spinning && index>=stopped ? <div className="bets-strip" aria-hidden="true">
          {[...symbols,symbols[0]].map((glyph,slot)=><span key={slot}>{glyph}</span>)}
        </div> : <span>{symbols[symbol]}</span>}
      </div>)}
    </div>
    <p className="bets-result" role="status">{result}</p>
    <button type="button" className="hud-button" aria-keyshortcuts="5" disabled={spinning || !points} onClick={spin}>Girar <kbd>5</kbd></button>
    <button type="button" className="hud-button hud-button--secondary" aria-keyshortcuts="7" disabled={spinning}
      onClick={()=>{setPoints(10);setReels(initialReels);setResult('');}}>Reiniciar <kbd>7</kbd></button>
  </section>;
}
