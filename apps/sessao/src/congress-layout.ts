import source from './congresso.json';
import type { Rect } from './map';

type MapObject = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  point?: boolean;
  properties?: {name:string; value:unknown}[];
};

if (source.orientation!=='orthogonal' || source.infinite) throw Error('O mapa do Congresso deve ser ortogonal e finito');

export const WIDTH = source.width * source.tilewidth;
export const HEIGHT = source.height * source.tileheight;

function objects(layerName:string):MapObject[] {
  const layer = source.layers.find(({name})=>name===layerName);
  if (!layer || layer.type!=='objectgroup') throw Error(`Camada do mapa ausente: ${layerName}`);
  return layer.objects;
}

function bounds(object:MapObject):Rect {
  const {x,y,width,height,rotation,point,name} = object;
  if (point || rotation!==0 || width<=0 || height<=0) throw Error(`Retângulo inválido no mapa: ${name}`);
  return [x,y,width,height];
}

function position({x,y,point,name}:MapObject) {
  if (!point) throw Error(`Objeto deve ser um ponto no mapa: ${name}`);
  return {x,y};
}

function named(layer:string, name:string) {
  const matches = objects(layer).filter(object=>object.name===name);
  if (matches.length!==1) throw Error(`Esperado um objeto "${name}" em ${layer}`);
  return matches[0];
}

const property = (object:MapObject,name:string) => object.properties?.find(entry=>entry.name===name)?.value;
export const mapPoint = (name:string) => position(named('Pontos',name));
export const mapDoor = (name:string) => bounds(named('Portas',name));
export const roomBounds = (name:string) => bounds(named('Salas',name));
export const seats = objects('Pontos').filter(({name})=>name==='Assento').map(position);
export const doors = objects('Portas').map(object=>({name:object.name, area:bounds(object)}));
function color(object:MapObject, name:string) {
  const value = property(object,name);
  if (typeof value!=='string' || !/^#[0-9a-f]{6}$/i.test(value)) throw Error(`Cor inválida no mapa: ${object.name}`);
  return Number.parseInt(value.slice(1),16);
}

export const rooms = objects('Salas').map(object=>({
  name:object.name,bounds:bounds(object),color:color(object,'piso'),
}));

function floorDetails(layer:string) {
  return objects(layer).map(object=>{
    const area = bounds(object);
    if (object.name==='Tapete') return {kind:'rug' as const,area};
    const fill = color(object,'cor');
    if (object.name==='Piso') {
      const width = property(object,'larguraLadrilho'), height = property(object,'alturaLadrilho');
      if (typeof width!=='number' || width<=0 || typeof height!=='number' || height<=0) throw Error('Tamanho de ladrilho inválido');
      return {kind:'floor' as const,area,fill,width,height};
    }
    const opacity = property(object,'opacidade');
    return {kind:'fill' as const,area,fill,opacity:typeof opacity==='number' ? opacity : 1};
  });
}

export const corridorFloors = floorDetails('Pisos e corredores');
export const floorDecor = floorDetails('Detalhes do piso');
const terminal = mapPoint('Terminal de segurança');
export const desks = [
  ...objects('Mesas').map(object=>({name:object.name,...position(object)})),
  {name:'Balcão da tesouraria',...mapPoint('Balcão da tesouraria')},
  {name:'Terminal de segurança',x:terminal.x-22,y:terminal.y-20},
];
export const furnishings = objects('Móveis').map(object=>{
  const footprint = property(object,'footprint');
  const texture = property(object,'texture');
  const frame = property(object,'frame');
  const area = bounds(object);
  if (typeof footprint!=='number' || footprint<=0 || footprint>area[3]) throw Error('Base de móvel inválida no mapa');
  const furniture = {area,footprint,...(property(object,'fireTarget')===true ? {fireTarget:true as const} : {})};
  if (typeof texture==='string') return {...furniture,texture};
  if (typeof frame==='number') return {...furniture,frame};
  throw Error('Móvel sem textura ou frame no mapa');
});

function containsOpening(wall:Rect, door:Rect) {
  const [x,y,w,h] = wall;
  const [dx,dy,dw,dh] = door;
  return dw>dh
    ? dy===y && dh===h && dx>=x && dx+dw<=x+w
    : dx===x && dw===w && dy>=y && dy+dh<=y+h;
}

function splitWall(wall:Rect, door:Rect):Rect[] {
  const [x,y,w,h] = wall;
  const [dx,dy,dw,dh] = door;
  const segments:Rect[] = dw>dh
    ? [[x,y,dx-x,h],[dx+dw,y,x+w-dx-dw,h]]
    : [[x,y,w,dy-y],[x,dy+dh,w,y+h-dy-dh]];
  return segments.filter(([, ,width,height])=>width>0 && height>0);
}

// The editor stores solid walls. Cutting openings here keeps rendering,
// movement and sight on the same geometry when a door is moved.
export const walls = objects('Paredes').map(bounds);
for (const {name,area} of doors) {
  const hosts = walls.filter(wall=>containsOpening(wall,area));
  if (hosts.length!==1) throw Error(`A porta "${name}" deve estar alinhada dentro de uma parede`);
  const host = hosts[0];
  walls.splice(walls.indexOf(host),1,...splitWall(host,area));
}
