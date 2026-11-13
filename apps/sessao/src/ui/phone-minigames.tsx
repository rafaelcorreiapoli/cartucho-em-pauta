import {useState} from 'react';

const candy = ['🍓','🍋','🍇','🍬','🍊'];
const newBoard = ()=>Array.from({length:25},()=>Math.floor(Math.random()*candy.length));

export function CandyMatch() {
  const [board,setBoard] = useState(newBoard);
  const [selected,setSelected] = useState<number>();
  const [score,setScore] = useState(0);
  function swap(index:number) {
    if (selected===undefined || Math.abs(selected%5-index%5)+Math.abs(Math.floor(selected/5)-Math.floor(index/5))!==1) {
      setSelected(index===selected ? undefined : index);
      return;
    }
    const next = [...board];
    [next[index],next[selected]] = [next[selected],next[index]];
    const matches = new Set<number>();
    for (const start of [index,selected]) {
      for (const step of [1,5]) {
        const line = [start];
        for (const direction of [-step,step]) {
          for (let from=start,to=start+direction;next[to]===next[start] &&
            (step===5 || Math.floor(from/5)===Math.floor(to/5));from=to,to+=direction) line.push(to);
        }
        if (line.length>=3) for (const cell of line) matches.add(cell);
      }
    }
    if (matches.size) {
      for (const cell of matches) next[cell] = Math.floor(Math.random()*candy.length);
      setBoard(next);
      setScore(score+matches.size);
    }
    setSelected(undefined);
  }
  return <section aria-label="Combina Doces">
    <p>Troque doces vizinhos para alinhar três iguais.</p>
    <strong role="status">{score} pontos</strong>
    <div className="phone-candy-board">{board.map((kind,index)=><button key={index} type="button" aria-pressed={selected===index}
      aria-label={`Doce ${index+1} ${candy[kind]}`} onKeyDown={event=>{
        const column = index%5;
        const next = {ArrowLeft:column>0 ? index-1 : index,ArrowRight:column<4 ? index+1 : index,
          ArrowUp:Math.max(0,index-5),ArrowDown:Math.min(24,index+5)}[event.key];
        if (next===undefined) return;
        event.preventDefault();
        event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus();
      }} onClick={()=>swap(index)}>{candy[kind]}</button>)}</div>
    <button className="hud-button" type="button" aria-keyshortcuts="5" onClick={()=>{setBoard(newBoard());setScore(0);setSelected(undefined);}}>Novo tabuleiro <kbd>5</kbd></button>
  </section>;
}

export function Bets() {
  const [points,setPoints] = useState(10);
  const [result,setResult] = useState('');
  function pick(guess:number) {
    const roll = 1+Math.floor(Math.random()*6);
    const won = roll%2===guess;
    setPoints(points+(won ? 1 : -1));
    setResult(`Saiu ${roll} · ${won ? '+1' : '−1'} ficha`);
  }
  return <section aria-label="Bets">
    <p>Par ou ímpar no dado. Use fichas do minigame.</p>
    <strong>{points} fichas</strong>
    <p role="status">{result}</p>
    <div className="flex gap-2">
      <button type="button" className="hud-button" aria-keyshortcuts="5" disabled={!points} onClick={()=>pick(0)}>Par <kbd>5</kbd></button>
      <button type="button" className="hud-button" aria-keyshortcuts="6" disabled={!points} onClick={()=>pick(1)}>Ímpar <kbd>6</kbd></button>
      <button type="button" className="hud-button hud-button--secondary" aria-keyshortcuts="7" onClick={()=>{setPoints(10);setResult('');}}>Reiniciar <kbd>7</kbd></button>
    </div>
  </section>;
}
