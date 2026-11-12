import type { UnitKind } from './content';
import { heroIdentity, type HeroKind } from './heroes';
import type { GameState, Unit } from './model';
export type AuraStat = 'damage' | 'range' | 'speed' | 'damageTaken' | 'attackSpeed' | 'healing';
export interface HeroAura {
  id: string;
  name: string;
  level: number;
  radius: number;
  target: 'ally' | 'enemy';
  unitKind: UnitKind | 'all';
  stat: AuraStat;
  amount: number;
}
const levels = [1, 3, 8, 35, 75];
type Skill = [string, HeroAura['target'], HeroAura['unitKind'], AuraStat, number];
function skills(hero: HeroKind, items: Skill[]): HeroAura[] {
  return items.map(([name, target, unitKind, stat, amount], index) => ({
    id: `${hero}-${index}`,
    name,
    target,
    unitKind,
    stat,
    amount,
    level: levels[index],
    radius: 140,
  }));
}
export const HERO_AURAS: Record<HeroKind, HeroAura[]> = {
  jones: skills('jones', [
    ['Linha organizada', 'ally', 'front', 'damage', 0.05],
    ['Debate interminável', 'enemy', 'ranged', 'range', -0.1],
    ['Passo coletivo', 'ally', 'all', 'speed', 0.05],
    ['Frente unida', 'ally', 'front', 'damageTaken', -0.07],
    ['Formação de base', 'ally', 'all', 'attackSpeed', 0.05],
  ]),
  mamaefalei: skills('mamaefalei', [
    ['Fiscalização de campo', 'ally', 'ranged', 'damage', 0.05],
    ['Câmera ligada', 'enemy', 'front', 'speed', -0.1],
    ['Vistoria expressa', 'ally', 'all', 'speed', 0.05],
    ['Colete de fiscal', 'ally', 'ranged', 'damageTaken', -0.07],
    ['Plantão da fiscalização', 'ally', 'all', 'attackSpeed', 0.05],
  ]),
  che: skills('che', [
    ['Vanguarda', 'ally', 'front', 'damage', 0.05],
    ['Terreno difícil', 'enemy', 'siege', 'speed', -0.1],
    ['Marcha ligeira', 'ally', 'all', 'speed', 0.05],
    ['Cobertura improvisada', 'ally', 'front', 'damageTaken', -0.07],
    ['Hasta o próximo nível', 'ally', 'all', 'attackSpeed', 0.05],
  ]),
  stalin: skills('stalin', [
    ['Plano de impacto', 'ally', 'siege', 'damage', 0.05],
    ['Burocracia pesada', 'enemy', 'ranged', 'range', -0.1],
    ['Meta de deslocamento', 'ally', 'all', 'speed', 0.05],
    ['Aço estatal', 'ally', 'siege', 'damageTaken', -0.07],
    ['Plano quinquenal', 'ally', 'all', 'attackSpeed', 0.05],
  ]),
  lulinha: skills('lulinha', [
    ['Companheirada', 'ally', 'front', 'damage', 0.05],
    ['Conversa comprida', 'enemy', 'front', 'attackSpeed', -0.1],
    ['Caravana', 'ally', 'all', 'speed', 0.05],
    ['Abraço coletivo', 'ally', 'front', 'damageTaken', -0.07],
    ['Nunca antes', 'ally', 'all', 'attackSpeed', 0.05],
  ]),
  marcal: skills('marcal', [
    ['Mentoria de choque', 'ally', 'siege', 'damage', 0.05],
    ['Virada de mesa', 'enemy', 'front', 'speed', -0.1],
    ['Subida do monte', 'ally', 'all', 'speed', 0.05],
    ['Cadeira cativa', 'ally', 'siege', 'damageTaken', -0.07],
    ['Protocolo do coach', 'ally', 'all', 'attackSpeed', 0.05],
  ]),
  trump: skills('trump', [
    ['Tarifa de impacto', 'ally', 'siege', 'damage', 0.05],
    ['Embargo do alcance', 'enemy', 'ranged', 'range', -0.1],
    ['Carreata dourada', 'ally', 'all', 'speed', 0.05],
    ['Paga o muro', 'ally', 'front', 'damageTaken', -0.07],
    ['Grande de novo', 'ally', 'all', 'attackSpeed', 0.05],
  ]),
  bolsonaro: skills('bolsonaro', [
    ['Formação de choque', 'ally', 'front', 'damage', 0.05],
    ['Live interrompida', 'enemy', 'ranged', 'attackSpeed', -0.1],
    ['Motociata', 'ally', 'all', 'speed', 0.05],
    ['Colete reforçado', 'ally', 'front', 'damageTaken', -0.07],
    ['Ordem de avanço', 'ally', 'all', 'attackSpeed', 0.05],
  ]),
};
export interface AuraSource {
  unit: Unit;
  hero?: HeroKind;
  skills: HeroAura[];
}
export interface ActiveAura extends HeroAura {
  sourceId: number;
  hero?: HeroKind;
}
export const HEALING_AURA: HeroAura = {
  id: 'medic-healing',
  name: 'Plantão solidário',
  level: 1,
  radius: 140,
  target: 'ally',
  unitKind: 'all',
  stat: 'healing',
  amount: 5,
};
const TROOP_AURAS = {
  soundCar: {
    id: 'troop-sound-car',
    name: 'Som no talo',
    level: 1,
    radius: 95,
    target: 'ally',
    unitKind: 'all',
    stat: 'speed',
    amount: 0.03,
  },
  marshal: {
    id: 'troop-marshal',
    name: 'Ordem de avanço',
    level: 1,
    radius: 95,
    target: 'ally',
    unitKind: 'front',
    stat: 'damage',
    amount: 0.03,
  },
  scout: {
    id: 'troop-scout',
    name: 'Olho no terreno',
    level: 1,
    radius: 95,
    target: 'ally',
    unitKind: 'ranged',
    stat: 'range',
    amount: 0.04,
  },
} satisfies Record<string, HeroAura>;

export function troopAura(unit: Pick<Unit, 'kind' | 'productionTier'>): HeroAura | undefined {
  const tier = unit.productionTier ?? 0;
  if (unit.kind === 'siege' && tier === 0) return TROOP_AURAS.soundCar;
  if (unit.kind === 'front' && tier === 3) return TROOP_AURAS.marshal;
  if (unit.kind === 'ranged' && tier === 2) return TROOP_AURAS.scout;
  return undefined;
}

export function unitAuraSources(game: GameState): AuraSource[] {
  const sources: AuraSource[] = [];
  for (const unit of game.units) {
    if (unit.hp <= 0) continue;
    if (unit.kind === 'hero') {
      const hero = heroIdentity(unit);
      sources.push({
        unit,
        hero,
        skills: HERO_AURAS[hero].filter((skill) => unit.level >= skill.level),
      });
    } else {
      const skill = unit.kind === 'medic' ? HEALING_AURA : troopAura(unit);
      if (skill) sources.push({ unit, skills: [skill] });
    }
  }
  return sources;
}
export function unitAuras(
  game: GameState,
  unit: Unit,
  sources = unitAuraSources(game),
): ActiveAura[] {
  if (unit.hp <= 0) return [];
  return sources.flatMap((source) =>
    source.skills
      .filter(
        (skill) =>
          (skill.stat !== 'healing' || source.unit.healingTargetId === unit.id) &&
          Math.hypot(source.unit.x - unit.x, (source.unit.row - unit.row) * 7.5) <= skill.radius &&
          (skill.target === 'ally'
            ? source.unit.side === unit.side
            : source.unit.side !== unit.side) &&
          (skill.unitKind === 'all' || skill.unitKind === unit.kind),
      )
      .map((skill) => ({ ...skill, sourceId: source.unit.id, hero: source.hero })),
  );
}
/** Different passives add their bonuses; duplicate sources of the same passive never stack. */
export function auraModifiers(effects: ActiveAura[]) {
  const result = { damage: 1, range: 1, speed: 1, damageTaken: 1, attackSpeed: 1, healing: 0 },
    seen = new Set<string>();
  for (const effect of effects)
    if (!seen.has(effect.id)) {
      result[effect.stat] += effect.amount;
      seen.add(effect.id);
    }
  for (const key of Object.keys(result) as AuraStat[])
    if (key !== 'healing') result[key] = Math.max(0.5, Math.min(1.5, result[key]));
  return result;
}
export function isAuraBuff(aura: Pick<HeroAura, 'stat' | 'amount'>) {
  return aura.stat === 'damageTaken' ? aura.amount < 0 : aura.amount > 0;
}
export const AURA_STAT_NAMES: Record<AuraStat, string> = {
  damage: 'dano',
  range: 'alcance',
  speed: 'movimento',
  damageTaken: 'dano recebido',
  attackSpeed: 'velocidade de ataque',
  healing: 'cura por segundo',
};
export function auraTargetLabel(aura: HeroAura) {
  const target = aura.target === 'ally' ? 'aliados' : 'inimigos',
    kind = {
      all: 'todas as unidades',
      front: 'infantaria',
      ranged: 'atiradores',
      siege: 'cerco',
      hero: 'heróis',
      medic: 'médicos',
    }[aura.unitKind];
  return `${kind} ${target}`;
}
export function auraDescription(aura: HeroAura) {
  return `${aura.amount > 0 ? '+' : '−'}${aura.stat === 'healing' ? aura.amount + ' PV/s' : Math.round(Math.abs(aura.amount) * 100) + '%'} ${AURA_STAT_NAMES[aura.stat]} · ${auraTargetLabel(aura)}`;
}
