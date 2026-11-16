import { stations } from './plenary';

export const vipAreaRadius = 12;

export const installationSites = {
  hall:{kind:'portrait',point:{x:240,y:21},label:'Antecâmara'},
  archivePortrait:{kind:'portrait',point:{x:608,y:21},label:'Arquivo'},
  protocolPortrait:{kind:'portrait',point:{x:220,y:281},label:'Protocolo'},
  libraryPortrait:{kind:'portrait',point:{x:404,y:281},label:'Biblioteca'},
  coffeeVip:{kind:'vip',point:{x:213,y:244},label:'Cafezinho'},
  lobbyVip:{kind:'vip',point:{x:240,y:79},label:'Antecâmara'},
  libraryVip:{kind:'vip',point:{x:470,y:355},label:'Biblioteca'},
  pressVip:{kind:'vip',point:{x:875,y:239},label:'Sala de Imprensa'},
  pizza:{kind:'pizza',point:stations.coffee,label:'Mesa do Cafezinho'},
} as const;
export type Installable = typeof installationSites[keyof typeof installationSites]['kind'];
export const shop = {portrait:2,vip:1} satisfies Partial<Record<Installable,number>>;
