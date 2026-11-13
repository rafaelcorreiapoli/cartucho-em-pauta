import {walls,type Motion,type Rect} from './map';

export function wallVision(origin:Motion,radius:number) {
  const nearby = [...walls,...(origin.barriers ?? [])].filter(([x,y,w,h])=>
    x<=origin.x+radius && x+w>=origin.x-radius && y<=origin.y+radius && y+h>=origin.y-radius);
  const angles = Array.from({length:48},(_,index)=>index*Math.PI/24-Math.PI);
  for (const [x,y,w,h] of nearby) for (const [cx,cy] of [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]) {
    const angle = Math.atan2(cy-origin.y,cx-origin.x);
    for (const offset of [-.0001,0,.0001]) angles.push(Math.atan2(Math.sin(angle+offset),Math.cos(angle+offset)));
  }
  return angles.sort((a,b)=>a-b).map(angle=>{
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let nearest = radius;
    let distance = radius;
    for (const wall of nearby) {
      const [entry,surfaceEnd] = litWallSpan(origin,dx,dy,wall);
      if (entry>nearest || (entry===nearest && surfaceEnd>=distance)) continue;
      nearest = entry;
      distance = Math.min(radius,surfaceEnd);
    }
    return {x:dx*distance,y:dy*distance,dx,dy};
  });
}

function litWallSpan(origin:Motion,dx:number,dy:number,[x,y,w,h]:Rect) {
  const [nearX,farX] = slab(origin.x,dx,x,x+w);
  const [nearY,farY] = slab(origin.y,dy,y,y+h);
  const near = Math.max(nearX,nearY,0);
  const far = Math.min(farX,farY);
  if (near>far) return [Infinity,Infinity];
  // An end cap blocks the ray at its face. Letting it travel inside the
  // rectangle paints a wedge along the wall, especially at corridor joins.
  const hitsEndCap = (w<h && nearY>=nearX) || (h<w && nearX>=nearY);
  return [near,hitsEndCap ? near : Math.min(far,near+Math.min(w,h))];
}

function slab(origin:number,direction:number,min:number,max:number) {
  if (Math.abs(direction)<1e-9) return origin>=min && origin<=max ? [-Infinity,Infinity] : [Infinity,-Infinity];
  const a = (min-origin)/direction, b = (max-origin)/direction;
  return [Math.min(a,b),Math.max(a,b)];
}

export function shadowOutline(points:ReturnType<typeof wallVision>,x:number,y:number,extent:number) {
  const [first] = points;
  if (!first) return [];
  const outer = points.map(({dx,dy})=>({x:x+dx*extent,y:y+dy*extent}));
  const inner = points.map(point=>({x:x+point.x,y:y+point.y}));
  // Traverse the exterior and the opening in opposite directions, joined by a single edge.
  return [...outer,outer[0],inner[0],...inner.slice(1).reverse(),inner[0]];
}
