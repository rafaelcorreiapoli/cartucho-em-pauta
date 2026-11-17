import { npcs, treasurer } from './npcs';

export const roomActivities = {
  cabinet: {...treasurer.interaction, title:treasurer.label, label:'Consultar orçamento', icon:'wallet'},
  secretary: {...npcs.secretary.interaction, title:'Secretaria', label:'Ver pauta', icon:'document'},
  coffee: {x:240,y:250, title:'Cafezinho', label:'Tomar um cafezinho', icon:'coffee'},
  archive: {x:549,y:90, title:'Arquivo', label:'Abrir registro público', icon:'document'},
  library: {x:424,y:364, title:'Biblioteca', label:'Estudar o projeto', icon:'document'},
  quorum: {x:481,y:364, title:'Biblioteca', label:'Consultar quórum', icon:'ballot'},
  benches: {x:210,y:489, title:'Credenciamento', label:'Consultar bancadas', icon:'ballot'},
} as const satisfies Record<string, {x:number; y:number; title:string; label:string; icon:string}>;

export type RoomActivity = keyof typeof roomActivities;
export type RoomActivityResult = {activity:RoomActivity; text?:string; unavailable?:true};

export const reprography = {x:748,y:495,title:'Sala de Reprografia'} as const;
