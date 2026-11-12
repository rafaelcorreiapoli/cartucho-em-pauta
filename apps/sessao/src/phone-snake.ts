import { SNAKE_GOAL, SNAKE_SIZE, type SnakeDirection, type SnakeView } from './snake';

const directions = {
  ArrowUp:'up',ArrowRight:'right',ArrowDown:'down',ArrowLeft:'left',
  w:'up',d:'right',s:'down',a:'left',
} as const;

export function snakeDirection(event:KeyboardEvent) {
  return directions[(event.key.length===1 ? event.key.toLowerCase() : event.key) as keyof typeof directions];
}

export function createPhoneSnake(turn:(direction:SnakeDirection)=>void) {
  const board = document.createElement('canvas');
  board.width = board.height = 240;
  board.setAttribute('role','img');
  board.setAttribute('aria-label','Tabuleiro do Snake');
  const score = document.createElement('strong');
  const message = document.createElement('span');
  message.setAttribute('role','status');
  const header = document.createElement('div');
  header.className = 'snake-readout';
  header.append(score,message);
  const pad = document.createElement('div');
  pad.className = 'snake-pad';
  pad.setAttribute('aria-label','Controles do Snake');
  for (const [direction,label,arrow] of [
    ['up','Cima','↑'],['left','Esquerda','←'],['down','Baixo','↓'],['right','Direita','→'],
  ] as const) {
    const key = document.createElement('button');
    key.type = 'button';
    key.textContent = arrow;
    key.setAttribute('aria-label',label);
    key.onclick = ()=>turn(direction);
    pad.append(key);
  }
  const element = document.createElement('div');
  element.className = 'phone-snake';
  element.append(header,board,pad);

  return {
    element,
    paint(game:SnakeView) {
      score.textContent = `${game.score} / ${SNAKE_GOAL} frutas`;
      const status = game.status==='ready' ? 'Use as setas para começar' : game.status==='won' ? 'Meta alcançada!' :
        game.status==='lost' ? 'Fim de jogo' : '';
      if (message.textContent!==status) message.textContent = status;
      pad.hidden = game.status==='won' || game.status==='lost';
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
    },
  };
}
