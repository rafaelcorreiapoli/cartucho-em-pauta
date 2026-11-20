export const MINIGAME_FRUIT_XP = 1;

export const levelThresholds = [0,70,168,294,455,665] as const;
export const attributeUpgrades = {
  burglary:{label:'Arrombamento',description:'Arrombe portas, armários e cofres mais rápido.',bonus:25},
  concealment:{label:'Esconder dinheiro',description:'Guarde dinheiro no seu cofre mais rápido.',bonus:25},
  mobility:{label:'Movimentação',description:'Corra por mais tempo e mova-se mais rápido.',bonus:5,staminaBonus:50},
  vision:{label:'Visão',description:'Enxergue mais longe pelo mapa.',bonus:10},
} as const;

export function attributeEffect(attribute:Attribute,points:number) {
  const bonus = points*attributeUpgrades[attribute].bonus;
  return attribute==='mobility'
    ? `${baseStamina+points*attributeUpgrades.mobility.staminaBonus} stamina · +${bonus}% velocidade`
    : attribute==='vision' ? `+${bonus}% alcance` : `+${bonus}% velocidade`;
}

export type Attribute = keyof typeof attributeUpgrades;
export type AttributePoints = Record<Attribute,number>;
export type Progression = {
  xp:number;
  level:number;
  levelStart:number;
  nextLevelXp?:number;
  available:number;
  invested:AttributePoints;
  revision:number;
  matchId:number;
};
export type AttributeRequest = {attribute:Attribute; revision:number; matchId:number};

export const baseStamina = 100;

export function readAttributeRequest(raw:unknown):AttributeRequest|undefined {
  if (!raw || typeof raw!=='object' || !('attribute' in raw) || !('revision' in raw) || !('matchId' in raw)) return;
  const {attribute,revision,matchId} = raw;
  if (typeof attribute!=='string' || !Object.hasOwn(attributeUpgrades,attribute) ||
      typeof revision!=='number' || !Number.isSafeInteger(revision) || revision<0 ||
      typeof matchId!=='number' || !Number.isSafeInteger(matchId) || matchId<1) return;
  return {attribute:attribute as Attribute,revision,matchId};
}
