export const SNAKE_SIZE = 12;
export const SNAKE_GOAL = 5;
export const SNAKE_STEP_MS = 160;
export const snakeDirections = ['up','right','down','left'] as const;
export type SnakeDirection = typeof snakeDirections[number];
export type SnakeView = {
  body:number[]; food:number; score:number; status:'ready'|'playing'|'won'|'lost';
};
export type SnakeRound = SnakeView & {direction:SnakeDirection; pending?:SnakeDirection; stepAt:number};
const movement = {up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]} as const;
const opposite = {up:'down',right:'left',down:'up',left:'right'} as const;

export function createSnake(now:number):SnakeRound {
  const head = 6*SNAKE_SIZE+6;
  return {body:[head,head-1,head-2],food:head+3,score:0,status:'ready',direction:'right',stepAt:now};
}

export function turnSnake(round:SnakeRound, direction:SnakeDirection, now:number) {
  if ((round.status!=='ready' && round.status!=='playing') || round.pending || opposite[round.direction]===direction) return;
  round.pending = direction;
  if (round.status==='ready') {
    round.status = 'playing';
    round.stepAt = now+SNAKE_STEP_MS;
  }
}

export function stepSnake(round:SnakeRound, now:number, random = Math.random) {
  if (round.status!=='playing' || now<round.stepAt) return;
  round.stepAt = now+SNAKE_STEP_MS;
  round.direction = round.pending ?? round.direction;
  round.pending = undefined;
  const [dx,dy] = movement[round.direction];
  const x = round.body[0]%SNAKE_SIZE+dx;
  const y = Math.floor(round.body[0]/SNAKE_SIZE)+dy;
  const head = y*SNAKE_SIZE+x;
  const eating = head===round.food;
  const occupied = eating ? round.body : round.body.slice(0,-1);
  if (x<0 || x>=SNAKE_SIZE || y<0 || y>=SNAKE_SIZE || occupied.includes(head)) {
    round.status = 'lost';
    return;
  }
  round.body = [head,...occupied];
  if (!eating) return;
  round.score++;
  if (round.score===SNAKE_GOAL) {
    round.food = -1;
    round.status = 'won';
    return;
  }
  const free = Array.from({length:SNAKE_SIZE**2},(_,index)=>index).filter(index=>!round.body.includes(index));
  round.food = free[Math.floor(random()*free.length)];
}
