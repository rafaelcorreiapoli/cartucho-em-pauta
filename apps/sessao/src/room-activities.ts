export const roomActivities = {
  coffee: {x:240,y:250, title:'Cafezinho', label:'Beber café', icon:'coffee'},
  library: {x:370,y:488, title:'Biblioteca', label:'Estudar o projeto', icon:'document'},
} as const satisfies Record<string, {x:number; y:number; title:string; label:string; icon:string}>;

export type RoomActivity = keyof typeof roomActivities;
export type RoomActivityResult = {activity:RoomActivity; text?:string};

export const reprography = {x:748,y:495,title:'Copiadora da Central de Expediente'} as const;
