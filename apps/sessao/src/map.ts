export const WIDTH = 480;
export const HEIGHT = 270;
export const SPEED = 88;
export const NAMES = ['Lula', 'Bolsonaro', 'Trump'] as const;
export type Rect = readonly [x: number, y: number, width: number, height: number];

export const walls: Rect[] = [
  [0,0,480,10], [0,259,480,11], [0,10,10,249], [470,10,10,249],
  [139,10,9,115], [332,10,9,115],
  [10,114,49,11], [93,114,124,11], [263,114,121,11], [419,114,51,11],
  [187,161,9,98], [282,161,9,98],
  [10,161,59,11], [105,161,113,11], [262,161,106,11], [404,161,66,11],
];
export const desks = [[48,65],[373,65],[169,84],[266,84],[63,217],[342,217]] as const;
export const furnishings = [
  {frame:0, area:[197,33,86,29], footprint:10},
  {frame:3, area:[16,21,25,34], footprint:9},
  {frame:3, area:[444,18,24,32], footprint:9},
  {frame:3, area:[301,28,22,28], footprint:7},
  {frame:4, area:[111,24,23,29], footprint:10},
  {frame:4, area:[18,192,25,30], footprint:10},
  {frame:4, area:[441,193,23,28], footprint:10},
  {frame:5, area:[232,208,16,33], footprint:10},
] satisfies {frame:number; area:Rect; footprint:number}[];
const obstacles = [
  ...walls,
  ...desks.map(([x,y]):Rect => [x,y+2,45,18]),
  ...furnishings.map(({area:[x,y,width,height],footprint}):Rect =>
    [x,y+height-footprint,width,footprint]),
];

export type Player = { id: string; character: number; x: number; y: number; direction: number; moving: boolean };
export type Motion = { x: number; y: number };
export const idle = { x: 0, y: 0 };

export function canStand(x: number, y: number) {
  return obstacles.every(([left, top, width, height]) =>
    x + 6 <= left || x - 6 >= left + width || y <= top || y - 7 >= top + height);
}

export function move(player: Player, input: Motion, seconds: number) {
  const length = Math.hypot(input.x,input.y);
  if (!length) {
    player.moving = false;
    return;
  }
  const dx = input.x / Math.max(1,length) * SPEED * seconds;
  const dy = input.y / Math.max(1,length) * SPEED * seconds;
  const {x,y} = player;
  if (canStand(x+dx,y)) player.x += dx;
  if (canStand(player.x,y+dy)) player.y += dy;
  player.direction = Math.abs(dx)>Math.abs(dy) ? (dx>0 ? 1 : 3) : (dy>0 ? 0 : 2);
  player.moving = x !== player.x || y !== player.y;
}
