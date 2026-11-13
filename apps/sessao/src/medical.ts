export const infirmary = {
  x:913,y:486,
  door:[806,468,6,35],
  doctor:{name:'Drauzio Varella',x:928,y:475},
  name:'Enfermaria',
  bounds:[812,403,138,127],
  price:1,
  healing:35,
} as const;

export const aidRadius = 20;
export const carrySpeedFactor = .65;

export const firstAidKit = {
  name:'Kit de primeiros socorros',
  description:'Recupera até 35 PV de quem usar.',
  portrait:'retrato-primeiros-socorros.webp',
  price:1.5,
  healing:35,
  use:'consume',
} as const;
