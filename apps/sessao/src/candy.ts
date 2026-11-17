export const candyFruit = ['🍓','🍋','🍇','🍒','🍊'];
export const candyWidth = 5;

export function newCandyBoard(source?:readonly number[],cleared?:ReadonlySet<number>) {
  const board:number[] = source ? [...source] : [];
  for (let index=0;index<candyWidth*candyWidth;index++) {
    if (cleared && !cleared.has(index)) continue;
    const forbidden = new Set<number>();
    for (const step of [1,candyWidth]) {
      for (const offset of [-2,-1,0]) {
        const start = index+step*offset;
        const end = start+step*2;
        if (start<0 || end>=candyWidth*candyWidth || (step===1 && Math.floor(start/candyWidth)!==Math.floor(end/candyWidth))) continue;
        const neighbors = [start,start+step,end].filter(cell=>cell!==index);
        if (board[neighbors[0]]!==undefined && board[neighbors[0]]===board[neighbors[1]]) forbidden.add(board[neighbors[0]]);
      }
    }
    const choices = candyFruit.map((_,kind)=>kind).filter(kind=>!forbidden.has(kind));
    if (!choices.length) return newCandyBoard();
    board[index] = choices[Math.floor(Math.random()*choices.length)];
  }
  return board;
}

export function matchingFruit(board:readonly number[]) {
  const matches = new Set<number>();
  for (let index=0;index<board.length;index++) {
    for (const step of [1,candyWidth]) {
      if (step===1 && index%candyWidth>candyWidth-3) continue;
      if (board[index]===board[index+step] && board[index]===board[index+2*step]) {
        for (const offset of [0,step,2*step]) matches.add(index+offset);
      }
    }
  }
  return matches;
}

export const CANDY_SWAP_MS = 170;
export const CANDY_BURST_MS = 260;

export type CandyRound = {id:number; board:number[]; score:number};

export function swapCandy(board:readonly number[],from:number,to:number) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || board[from]===undefined || board[to]===undefined ||
    Math.abs(from%candyWidth-to%candyWidth)+Math.abs(Math.floor(from/candyWidth)-Math.floor(to/candyWidth))!==1) return;
  const next = [...board];
  [next[to],next[from]] = [next[from],next[to]];
  return {board:next,matches:matchingFruit(next)};
}
