import { js as EasyStar } from 'easystarjs';
import { canStand, canStandInPlenary, HEIGHT, SPEED, WIDTH, type Motion, type Player } from './map';

const cellSize = 4;
const toWorld = (point:Motion):Motion => ({x:point.x*cellSize+2,y:point.y*cellSize+2});
const makeGrid = (stand:typeof canStand) => Array.from({length:Math.floor(HEIGHT/cellSize)},(_,y) =>
  Array.from({length:WIDTH/cellSize},(_,x) => {
    const point = toWorld({x,y});
    return stand(point.x,point.y) ? 0 : 1;
  }));
const search = new EasyStar();
const worldGrid = makeGrid(canStand);
const plenaryGrid = makeGrid(canStandInPlenary);
search.setAcceptableTiles(0);
search.enableSync();
search.enableDiagonals();
search.disableCornerCutting();

function clearSegment(from:Motion,to:Motion,stand:typeof canStand) {
  const steps = Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)));
  for (let step=1;step<=steps;step++) {
    const t = step/steps;
    if (!stand(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t)) return false;
  }
  return true;
}

function closestCell(point:Motion, requireClear:boolean, grid:number[][], stand:typeof canStand) {
  const col = Math.floor(point.x/cellSize);
  const row = Math.floor(point.y/cellSize);
  let best:Motion|undefined;
  let bestDistance = Infinity;
  for (let y=row-5;y<=row+5;y++) {
    for (let x=col-5;x<=col+5;x++) {
      if (grid[y]?.[x]!==0) continue;
      const world = toWorld({x,y});
      const distance = Math.hypot(point.x-world.x,point.y-world.y);
      if (distance<bestDistance && (!requireClear || clearSegment(point,world,stand))) {
        best = {x,y};
        bestDistance = distance;
      }
    }
  }
  return best;
}

export function findRoute(from:Motion,to:Motion, plenary=false):Motion[] {
  const stand = plenary ? canStandInPlenary : canStand;
  const grid = plenary ? plenaryGrid : worldGrid;
  if (plenary && !stand(to.x,to.y)) return [];
  if (clearSegment(from,to,stand)) return [to];
  const start = closestCell(from,true,grid,stand);
  const end = closestCell(to,stand(to.x,to.y),grid,stand);
  if (!start || !end) return [];
  const points:Motion[] = [];
  search.setGrid(grid);
  search.findPath(start.x,start.y,end.x,end.y,path => {
    if (path) points.push(...(path.length ? path.map(toWorld) : [toWorld(start)]));
  });
  search.calculate();
  const last = points.at(-1);
  if (last && clearSegment(last,to,stand)) points.push(to);
  const route:Motion[] = [];
  let anchor = from;
  for (let index=0;index<points.length;) {
    let next = index;
    while (next+1<points.length && clearSegment(anchor,points[next+1],stand)) next++;
    anchor = points[next];
    route.push(anchor);
    index = next+1;
  }
  return route;
}

export function followRoute(player:Player, route:Motion[], seconds:number) {
  player.moving = false;
  let remaining = SPEED*seconds;
  while (route.length && remaining>0) {
    const target = route[0];
    const dx = target.x-player.x;
    const dy = target.y-player.y;
    const distance = Math.hypot(dx,dy);
    if (distance<=remaining) route.shift();
    if (!distance) continue;
    const step = Math.min(distance,remaining);
    player.x += dx/distance*step;
    player.y += dy/distance*step;
    player.direction = Math.abs(dx)>Math.abs(dy) ? (dx>0 ? 1 : 3) : (dy>0 ? 0 : 2);
    player.moving = true;
    remaining -= step;
  }
}
