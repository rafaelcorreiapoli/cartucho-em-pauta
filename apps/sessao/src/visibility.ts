import {walls,type Motion,type Rect} from './map';

export function wallVision(origin:Motion,radius:number,showWallFaces=false) {
  const nearby = [...walls,...(origin.barriers ?? [])].filter(([x,y,w,h])=>
    x<=origin.x+radius && x+w>=origin.x-radius && y<=origin.y+radius && y+h>=origin.y-radius);
  const angles = Array.from({length:48},(_,index)=>index*Math.PI/24-Math.PI);
  for (const [x,y,w,h] of nearby) for (const [cx,cy] of [[x,y],[x+w,y],[x+w,y+h],[x,y+h]]) {
    const angle = Math.atan2(cy-origin.y,cx-origin.x);
    for (const offset of [-.0001,0,.0001]) angles.push(Math.atan2(Math.sin(angle+offset),Math.cos(angle+offset)));
  }
  return angles.sort((a,b)=>a-b).map(angle=>{
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let first = radius, distance = radius;
    for (const wall of nearby) {
      const hit = wallEntry(origin,dx,dy,wall,showWallFaces);
      if (!hit) continue;
      if (hit.near<first) {
        first = hit.near;
        distance = hit.visible;
      } else if (hit.near===first) distance = Math.max(distance,hit.visible);
    }
    // Choose the first physical surface before revealing its artwork. A divider
    // behind that surface must not cast a shadow across the same visible face.
    distance = Math.min(radius,distance);
    return {x:dx*distance,y:dy*distance,dx,dy};
  });
}

function wallEntry(origin:Motion,dx:number,dy:number,[x,y,w,h]:Rect,showWallFaces:boolean) {
  const [nearX,farX] = slab(origin.x,dx,x,x+w);
  const [nearY,farY] = slab(origin.y,dy,y,y+h);
  const near = Math.max(nearX,nearY,0);
  const far = Math.min(farX,farY);
  if (near>far) return;
  // Horizontal wall art depicts its south-facing surface. Reveal that surface
  // only from the south; from the north it belongs to the room behind the wall.
  // Vertical walls retain their side visibility, without lighting end-on rays.
  const broadFace = w>=h ? dy<0 && nearY>=nearX : nearX>=nearY;
  return {near,visible:showWallFaces && broadFace ? Math.max(near,far) : near};
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
