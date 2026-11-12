type ActivityPanel = 'trade-dock' | 'election-dock' | 'legislative-dock' | 'politics-dock';

export const roomActivities = {
  cabinetA: {x:70,y:93, title:'Gabinete A', label:'Abrir negociação', icon:'wallet', panel:'trade-dock'},
  cabinet: {x:389,y:93, title:'Gabinete B', label:'Consultar orçamento', icon:'wallet'},
  secretary: {x:83,y:247, title:'Secretaria', label:'Ver pauta', icon:'document', panel:'legislative-dock'},
  coffee: {x:240,y:250, title:'Cafezinho', label:'Tomar cafezinho', icon:'coffee'},
  cabinetC: {x:366,y:244, title:'Gabinete C', label:'Revisar campanha', icon:'chart', panel:'election-dock'},
  archive: {x:549,y:90, title:'Arquivo', label:'Abrir registro público', icon:'document', panel:'politics-dock'},
  support: {x:631,y:243, title:'Apoio Técnico', label:'Revisar impacto', icon:'chart', panel:'legislative-dock'},
  library: {x:424,y:364, title:'Biblioteca', label:'Estudar o projeto', icon:'document'},
  committees: {x:790,y:363, title:'Comissões', label:'Consultar quórum', icon:'ballot'},
  credentials: {x:149,y:493, title:'Credenciamento', label:'Conferir credencial', icon:'check'},
  benches: {x:456,y:493, title:'Hall das Bancadas', label:'Consultar bancadas', icon:'ballot'},
  gallery: {x:748,y:495, title:'Galeria', label:'Ouvir a galeria', icon:'mic'},
} as const satisfies Record<string, {x:number; y:number; title:string; label:string; icon:string; panel?:ActivityPanel}>;

export type RoomActivity = keyof typeof roomActivities;
export type RoomActivityResult = {activity:RoomActivity; text?:string};
