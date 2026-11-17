import { SNAKE_SIZE, type SnakeView } from './snake';

const directions = {
  ArrowUp:'up',ArrowRight:'right',ArrowDown:'down',ArrowLeft:'left',
  w:'up',d:'right',s:'down',a:'left',
} as const;

export function snakeDirection(key:string) {
  return directions[(key.length===1 ? key.toLowerCase() : key) as keyof typeof directions];
}

export function paintSnake(board:HTMLCanvasElement, game:SnakeView) {
  const ctx = board.getContext('2d');
  if (!ctx) return;
  const cell = board.width/SNAKE_SIZE;
  ctx.fillStyle = '#0a1710';
  ctx.fillRect(0,0,board.width,board.height);
  ctx.fillStyle = '#14261b';
  for (let index=0;index<SNAKE_SIZE**2;index++) {
    if ((index+Math.floor(index/SNAKE_SIZE))%2===0) {
      ctx.fillRect(index%SNAKE_SIZE*cell,Math.floor(index/SNAKE_SIZE)*cell,cell,cell);
    }
  }
  if (game.food>=0) {
    ctx.fillStyle = '#ff786b';
    ctx.beginPath();
    ctx.arc((game.food%SNAKE_SIZE+.5)*cell,(Math.floor(game.food/SNAKE_SIZE)+.5)*cell,cell*.32,0,Math.PI*2);
    ctx.fill();
  }
  for (const [index,segment] of game.body.entries()) {
    ctx.fillStyle = index===0 ? '#bdffa7' : '#5fce83';
    ctx.fillRect(segment%SNAKE_SIZE*cell+1,Math.floor(segment/SNAKE_SIZE)*cell+1,cell-2,cell-2);
  }
}
