export const levelThresholds = [0,100,240,420,650,950] as const;
export const attributeUpgrades = {
  hp:{label:'PV',bonus:10},
  stamina:{label:'Stamina',bonus:10},
  attack:{label:'ATK',bonus:1},
  defense:{label:'DEF',bonus:1},
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
export const baseDefense = 0;

export function readAttributeRequest(raw:unknown):AttributeRequest|undefined {
  if (!raw || typeof raw!=='object' || !('attribute' in raw) || !('revision' in raw) || !('matchId' in raw)) return;
  const {attribute,revision,matchId} = raw;
  if (typeof attribute!=='string' || !Object.hasOwn(attributeUpgrades,attribute) ||
      typeof revision!=='number' || !Number.isSafeInteger(revision) || revision<0 ||
      typeof matchId!=='number' || !Number.isSafeInteger(matchId) || matchId<1) return;
  return {attribute:attribute as Attribute,revision,matchId};
}
