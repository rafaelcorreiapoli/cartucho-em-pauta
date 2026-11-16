import { roomActivities } from './room-activities';

export const vipAreaRadius = 12;

export const installationSites = {
  hall:{kind:'portrait',point:{x:240,y:21},label:'Antecâmara'},
  archivePortrait:{kind:'portrait',point:{x:608,y:21},label:'Arquivo'},
  protocolPortrait:{kind:'portrait',point:{x:220,y:281},label:'Protocolo'},
  libraryPortrait:{kind:'portrait',point:{x:404,y:281},label:'Biblioteca'},
  coffeeVip:{kind:'vip',point:{x:213,y:244},label:'Cafezinho'},
  lobbyVip:{kind:'vip',point:{x:240,y:79},label:'Antecâmara'},
  libraryVip:{kind:'vip',point:{x:455,y:373},label:'Biblioteca'},
  pressVip:{kind:'vip',point:{x:898,y:240},label:'Sala de Imprensa'},
  pizza:{kind:'pizza',point:roomActivities.coffee,label:'Mesa do Cafezinho'},
} as const;
export type Installable = typeof installationSites[keyof typeof installationSites]['kind'];
export const credentialGoods = {portrait:{price:2},vip:{price:1}} as const;
export const installationArt = {
  portrait:{texture:'portrait-mount',sprite:'moldura-congresso.webp',width:26,height:31,centerY:0},
  vip:{texture:'reservation-chair',sprite:'cadeira-reserva.webp',width:27,height:31,centerY:-9},
} as const;
