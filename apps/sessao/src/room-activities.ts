export const roomActivities = {
  cabinet: {x:376,y:457, title:'Mesa de Verbas', label:'Consultar orçamento', icon:'wallet'},
  secretary: {x:83,y:247, title:'Secretaria', label:'Ver pauta', icon:'document'},
  coffee: {x:240,y:250, title:'Cafezinho', label:'Tomar um cafezinho', icon:'coffee'},
  archive: {x:549,y:90, title:'Arquivo', label:'Abrir registro público', icon:'document'},
  library: {x:424,y:364, title:'Biblioteca', label:'Estudar o projeto', icon:'document'},
  committees: {x:790,y:363, title:'Comissões', label:'Consultar quórum', icon:'ballot'},
  credentials: {x:149,y:493, title:'Credenciamento', label:'Conferir credencial', icon:'check'},
  benches: {x:456,y:493, title:'Bancadas', label:'Consultar bancadas', icon:'ballot'},
} as const satisfies Record<string, {x:number; y:number; title:string; label:string; icon:string}>;

export type RoomActivity = keyof typeof roomActivities;
export type RoomActivityResult = {activity:RoomActivity; text?:string};

export const reprography = {x:748,y:495,title:'Sala de Reprografia'} as const;
