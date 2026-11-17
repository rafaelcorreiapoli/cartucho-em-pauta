import { mapDoor, roomBounds } from './congress-layout';
export const infirmary = {
  x:913,y:486,
  door:mapDoor('Enfermaria'),
  doctor:{name:'Drauzio Varella',x:928,y:475},
  name:'Enfermaria',
  bounds:roomBounds('Enfermaria'),
  price:1,
  healing:35,
} as const;

export const recoveryRules = {
  knockoutMs:8_000,
  protectionMs:4_000,
  healthFraction:.45,
  hitStunMs:250,
} as const;

export const aidRadius = 20;

export const carrySpeedFactor = .65;

const firstAidHealing = 35;

export const firstAidKit = {
  name:'Kit de primeiros socorros',
  description:`Recupera até ${firstAidHealing} PV de quem usar.`,
  portrait:'retrato-primeiros-socorros.webp',
  price:1.5,
  healing:firstAidHealing,
  use:'consume',
} as const;
