import type { GameplayEvent } from '../src/gameplay';
import { privateOffices } from '../src/private-offices';
import { securityRoom, roomAt } from '../src/map';
import type { Photo } from '../src/photography';
import type { Agenda } from '../src/politics';

type Fact = {value:string; group?:string};
type Rule = {target:number; players:number; facts:(event:GameplayEvent)=>Fact[]};
const fact = (value:string|number, group?:string):Fact[] => [{value:String(value),group}];
const people = (photo:Photo,actor:string) => photo.people.filter(person=>person.id!==actor);
const ownPortrait = (photo:Photo,actor:string) => photo.decorations.some(item=>
  item.kind==='portrait' && item.owner.id===actor && Math.hypot(item.x-photo.center.x,item.y-photo.center.y)<=28);
const privateRooms = new Set(['Antecâmara',...privateOffices.map(office=>office.name)]);
const capture = (test:(photo:Photo,actor:string)=>Fact[]) => (event:GameplayEvent) =>
  event.type==='photo' && event.photo ? test(event.photo,event.actor) : [];

export const photoMissions = {
  fotografia:{target:1,players:2,facts:capture((photo,actor)=>people(photo,actor).length ? fact(photo.id) : [])},
  flagra:{target:1,players:2,facts:capture((photo,actor)=>
    people(photo,actor).some(person=>person.exposed?.some(item=>item.kind==='briefcase')) ? fact(photo.id) : [])},
  selfie:{target:3,players:4,facts:capture((photo,actor)=>
    photo.selfie ? people(photo,actor).map(person=>({value:person.id})) : [])},
  presidenteFoto:{target:1,players:2,facts:capture((photo,actor)=>
    photo.selfie && people(photo,actor).some(person=>person.office==='president') ? fact(photo.id) : [])},
  celularFoto:{target:1,players:2,facts:capture((photo,actor)=>
    people(photo,actor).some(person=>person.phone==='game' && [securityRoom.name,'Antecâmara'].includes(roomAt(person))) ? fact(photo.id) : [])},
  reuniaoFoto:{target:1,players:3,facts:capture((photo,actor)=>{
    const guests = people(photo,actor);
    return guests.some(person=>privateRooms.has(roomAt(person)) &&
      guests.some(other=>other.id!==person.id && roomAt(other)===roomAt(person))) ? fact(photo.id) : [];
  })},
  dossieFoto:{target:3,players:2,facts:capture((photo,actor)=>
    people(photo,actor).map(person=>({value:roomAt(person),group:person.id})))},
  apresentarFoto:{target:1,players:2,facts:event=>
    event.type==='photo-shown' && event.photo && people(event.photo,event.actor).some(person=>person.exposed?.length) ? fact(event.photo.id) : []},
  entregaFoto:{target:1,players:3,facts:capture((photo,actor)=>
    photo.transfers.some(event=>event.from!==actor && event.to!==actor) ? fact(photo.id) : [])},
  publicouSelfie:{target:1,players:3,facts:event=>
    event.type==='photo-published' && event.photo?.selfie && event.photo.author.id===event.actor &&
      people(event.photo,event.actor).length>=2 ? fact(event.photo.id) : []},
  retrato:{target:1,players:1,facts:event=>event.type==='installed' && event.kind==='portrait' ? fact(event.item!) : []},
  autorretrato:{target:1,players:1,facts:capture((photo,actor)=>photo.selfie && ownPortrait(photo,actor) ? fact(photo.id) : [])},
  reforma:{target:1,players:2,facts:event=>
    event.type==='installed' && event.kind==='portrait' && event.replaced && !privateOffices.some(office=>office.id===event.place) ? fact(event.item!) : []},
  reserva:{target:1,players:1,facts:event=>
    event.type==='installed' && event.kind==='vip' && event.place==='coffeeVip' ? fact(event.item!) : []},
  fiscalVip:{target:1,players:3,facts:capture((photo,actor)=>
    photo.decorations.some(item=>item.kind==='vip' && item.owner.id!==actor && people(photo,actor).some(person=>
      person.id!==item.owner.id && Math.hypot(person.x-item.x,person.y-item.y)<=12)) ? fact(photo.id) : [])},
  mandaVip:{target:1,players:2,facts:event=>
    event.type==='installed' && event.kind==='vip' && event.replaced ? fact(event.item!) : []},
  fatias:{target:2,players:3,facts:event=>event.type==='slice' && event.target ? fact(event.target) : []},
  pizzada:{target:3,players:4,facts:event=>event.type==='slice' && event.target ? fact(event.target,String(event.item)) : []},
} satisfies Partial<Record<Agenda,Rule>>;

export function applyFacts(groups:Map<string,Set<string>>,facts:Fact[]) {
  for (const {value,group=''} of facts) {
    let seen = groups.get(group);
    if (!seen) groups.set(group,seen=new Set());
    seen.add(value);
  }
  return Math.max(0,...[...groups.values()].map(group=>group.size));
}
