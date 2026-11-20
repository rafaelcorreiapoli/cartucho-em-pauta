export const ghostAdviserRules = {price:8, tick:6000, expense:1, speed:55} as const;
export const ghostAdviser = {
  name:'Assessor fantasma', price:ghostAdviserRules.price, portrait:'retrato-roberto-justus.webp',
  description:'Exclusivo do infiltrado. Contrata um assessor que surge em um local aleatório e cobra R$ 1 mil a cada 6 s até ser morto com porrete. Contratações ilimitadas.',
} as const;
export type GhostAdviserIncident = {count:number; paused:boolean};
