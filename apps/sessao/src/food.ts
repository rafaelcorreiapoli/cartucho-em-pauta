type TimedModifier = {factor:number; durationMs:number};
export type FoodEffect = {hp?:number|'full'; stamina?:number; speed?:TimedModifier; staminaRegen?:TimedModifier};

type Food = {
  name:string; description:string; portrait:string; price:number; use:'consume';
  category:'Comum'|'Especial'|'Luxo'; effect:FoodEffect; exposable?:true;
};

export const foods = {
  pizza:{name:'Pizza',description:'Recupera vida.',portrait:'retrato-pizza.webp',price:2,use:'consume',category:'Comum',effect:{hp:35},exposable:true},
  chocolates:{name:'Caixa de Bombom',description:'Um agrado doce e revigorante.',portrait:'retrato-bombom.webp',price:2,use:'consume',category:'Especial',effect:{hp:40}},
  condensedMilk:{name:'Leite condensado',description:'Muito eficaz. Pesado nas pernas.',portrait:'retrato-leite-condensado.webp',price:2.5,use:'consume',category:'Especial',effect:{hp:60,speed:{factor:.75,durationMs:10_000}}},
  coxinha:{name:'Coxinha',description:'Lanche rápido.',portrait:'retrato-coxinha.webp',price:.5,use:'consume',category:'Comum',effect:{hp:20}},
  coffee:{name:'Café',description:'Recupera energia rapidamente.',portrait:'retrato-cafe.webp',price:.5,use:'consume',category:'Comum',effect:{stamina:30},exposable:true},
  energyDrink:{name:'Energético',description:'Acelera sua recuperação de energia.',portrait:'retrato-energetico.webp',price:1.5,use:'consume',category:'Especial',effect:{staminaRegen:{factor:1.5,durationMs:20_000}}},
  mortadellaRoll:{name:'Pão com mortadela',description:'Mata a fome e devolve um pouco de energia.',portrait:'retrato-pao-mortadela.webp',price:1,use:'consume',category:'Comum',effect:{hp:25,stamina:10}},
  lobster:{name:'Lagosta',description:'Luxo absoluto.',portrait:'retrato-lagosta.webp',price:6,use:'consume',category:'Luxo',effect:{hp:'full'}},
  picanha:{name:'Picanha',description:'Uma refeição de respeito.',portrait:'retrato-picanha.webp',price:4,use:'consume',category:'Luxo',effect:{hp:70}},
} as const satisfies Record<string,Food>;

export type FoodKind = keyof typeof foods;
export const foodKinds = Object.keys(foods) as FoodKind[];
export const isFood = (kind:unknown):kind is FoodKind => typeof kind==='string' && Object.hasOwn(foods,kind);

export function describeFood({hp,stamina,speed,staminaRegen}:FoodEffect) {
  return [
    hp==='full' ? 'Cura total' : hp && `+${hp} PV`,
    stamina && `+${stamina} stamina`,
    speed && `−${Math.round((1-speed.factor)*100)}% velocidade por ${speed.durationMs/1000} s`,
    staminaRegen && `+${Math.round((staminaRegen.factor-1)*100)}% regeneração por ${staminaRegen.durationMs/1000} s`,
  ].filter(Boolean).join(' · ');
}
