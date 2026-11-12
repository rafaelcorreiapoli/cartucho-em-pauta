import { foods } from './food';
import { stations } from './plenary';

export const installationSites = {
  hall:{kind:'portrait',point:{x:465,y:414},label:'Hall das Bancadas'},
  cabinet:{kind:'portrait',point:stations.cabinet,label:'Gabinete B'},
  coffeeVip:{kind:'vip',point:{x:218,y:228},label:'Cadeira do Cafezinho'},
  cabinetVip:{kind:'vip',point:{x:409,y:91},label:'Gabinete B'},
  pizza:{kind:'pizza',point:stations.coffee,label:'Mesa do Cafezinho'},
} as const;
export type Installable = typeof installationSites[keyof typeof installationSites]['kind'];
export const shop = {pizza:foods.pizza.price,portrait:2,vip:1} satisfies Record<Installable,number>;
