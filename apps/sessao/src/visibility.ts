import {walls,type Motion,type Rect} from './map';

type Point = {x:number;y:number};

function visionRays(origin:Motion,radius:number) {
  const nearby = [...walls,...(origin.barriers ?? [])].filter(([x,y,w,h])=>
    x<=origin.x+radius && x+w>=origin.x-radius && y<=origin.y+radius && y+h>=origin.y-radius);
  const angles = Array.from({length:48},(_,index)=>index*Math.PI/24-Math.PI);
  const corners = nearby.map(([x,y,w,h])=>[x,y,x+w,y+h]);
  // Overlapping wall rectangles create exposed corners at their intersections,
  // not just at their original endpoints (for example, the Cafezinho junction).
  for (let i=0;i<nearby.length;i++) for (let j=i+1;j<nearby.length;j++) {
    const [ax,ay,aw,ah] = nearby[i], [bx,by,bw,bh] = nearby[j];
    const left=Math.max(ax,bx), top=Math.max(ay,by);
    const right=Math.min(ax+aw,bx+bw), bottom=Math.min(ay+ah,by+bh);
    if (left<=right && top<=bottom) corners.push([left,top,right,bottom]);
  }
  for (const [left,top,right,bottom] of corners) for (const [cx,cy] of [[left,top],[right,top],[right,bottom],[left,bottom]]) {
    const angle = Math.atan2(cy-origin.y,cx-origin.x);
    for (const offset of [-.0001,0,.0001]) angles.push(Math.atan2(Math.sin(angle+offset),Math.cos(angle+offset)));
  }
  return angles.sort((a,b)=>a-b).map(angle=>{
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let distance = radius, surface:Rect|undefined, face=false;
    for (const wall of nearby) {
      const [x,y,w,h] = wall;
      const [nearX,farX] = slab(origin.x,dx,x,x+w);
      const [nearY,farY] = slab(origin.y,dy,y,y+h);
      const near = Math.max(nearX,nearY,0);
      if (near>Math.min(farX,farY)) continue;
      // Horizontal artwork faces south. Vertical artwork can be seen from either side.
      const visibleFace = w>=h ? dy<0 && nearY>=nearX : nearX>=nearY;
      if (near<distance || near===distance && visibleFace && !face) {
        distance=near; surface=wall; face=visibleFace;
      }
    }
    return {x:dx*distance,y:dy*distance,dx,dy,surface,face};
  });
}

export function wallVision(origin:Motion,radius:number) {
  return visionRays(origin,radius).map(({x,y,dx,dy})=>({x,y,dx,dy}));
}

// Keep floor occlusion at the physical edge. Illuminate wall artwork separately
// by carrying only its visible surface span straight across the wall thickness.
export function wallLight(origin:Motion,radius:number):Point[][] {
  const rays = visionRays(origin,radius);
  const polygons:Point[][] = [rays.map(({x,y})=>({x,y}))];
  for (let index=0;index<rays.length;index++) {
    const a = rays[index], b = rays[(index+1)%rays.length];
    if (!a.face || !b.face || !a.surface || a.surface!==b.surface) continue;
    const [,,w,h] = a.surface;
    const offset = w>=h ? {x:0,y:-h} : {x:Math.sign(a.dx)*w,y:0};
    const polygon = [a,b,{x:b.x+offset.x,y:b.y+offset.y},{x:a.x+offset.x,y:a.y+offset.y}];
    const area = polygon.reduce((sum,p,i)=>{
      const next = polygon[(i+1)%polygon.length];
      return sum+p.x*next.y-next.x*p.y;
    },0);
    // Matching winding makes a single nonzero fill form the union of the shapes.
    polygons.push(area<0 ? polygon.reverse() : polygon);
  }
  return polygons;
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
