export const MINIGAME_FRUIT_XP = 1;

export const levelThresholds = [0,100,240,420,650,950] as const;
export const attributeUpgrades = {
  agility:{label:'Agilidade',resource:'Velocidade de interação',bonus:25},
  stamina:{label:'Fôlego',resource:'Stamina',bonus:50},
} as const;

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
