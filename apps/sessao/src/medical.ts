import { mapDoor, mapPoint, roomBounds } from './congress-layout';
export const infirmary = {
  ...mapPoint('Atendimento da Enfermaria'),
  stretcher:mapPoint('Maca da Enfermaria'),
  door:mapDoor('Enfermaria'),
  doctor:{name:'Drauzio Varella',...mapPoint('Médico da Enfermaria')},
  name:'Enfermaria',
  bounds:roomBounds('Enfermaria'),
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
