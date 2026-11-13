import { stations } from './plenary';

export const installationSites = {
  hall:{kind:'portrait',point:{x:465,y:414},label:'Gabinete de Luxo'},
  coffeeVip:{kind:'vip',point:{x:218,y:228},label:'Cadeira do Cafezinho'},
  lobbyVip:{kind:'vip',point:{x:240,y:79},label:'Antecâmara'},
  pizza:{kind:'pizza',point:stations.coffee,label:'Mesa do Cafezinho'},
} as const;
export type Installable = typeof installationSites[keyof typeof installationSites]['kind'];
export const shop = {portrait:2,vip:1} satisfies Partial<Record<Installable,number>>;
