export const visitorRoster = [
  {id:'nestor-cervero',name:'Nestor Cerveró',wallet:7},
  {id:'pablo-marcal',name:'Pablo Marçal',wallet:9},
  {id:'joesley-batista',name:'Joesley Batista',wallet:18},
  {id:'marcos-valerio',name:'Marcos Valério',wallet:12},
  {id:'marcelo-odebrecht',name:'Marcelo Odebrecht',wallet:20},
  {id:'joao-santana',name:'João Santana',wallet:10},
  {id:'alexandre-de-moraes',name:'Alexandre de Moraes',wallet:6},
  {id:'delcidio-do-amaral',name:'Delcídio do Amaral',wallet:8},
  {id:'luciano-hang',name:'Véio da Havan',wallet:16},
] as const;
export type VisitorId = typeof visitorRoster[number]['id'] | 'japones-federal';

export const npcRules = {
  count:2,maxCount:visitorRoster.length,pauseMs:2500,speed:68,
  robberyMs:3000,robberyRange:21,spawnMs:25_000,lifetimeMs:90_000,
} as const;

export type VisitorAction = {kind:'rob';target:string} | {kind:'cancel-robbery'};

export const visitorSheets = visitorRoster.flatMap(({id})=>
  (['walk','hit','fall'] as const).map(action=>({key:`${id}-${action}`,path:`assets/world-hd/${id}-${action}-128.webp`})),
);
