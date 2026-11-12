import {
  BASE_HP,
  GLOBAL_POWERS,
  type BuildingKind,
  type GlobalPowerKind,
  type Side,
} from './content';
import type { GameState, Player, Unit } from './model';
import { popularityCrisis } from './popularity';
import { BASE_ARTILLERY_DAMAGE_PER_LEVEL, researchLevel } from './research-effects';
export const MAX_RESEARCH_LEVEL = 3;
export const RESEARCHES = {
  spell_cooldown: {
    name: 'Estado de exceção',
    category: 'Poderes globais',
    cost: 240,
    duration: 25,
    description:
      '−10% de recarga de todas as magias por nível. Também reduz recargas em andamento.',
  },
  spell_threshold: {
    name: 'Propaganda eficiente',
    category: 'Poderes globais',
    cost: 200,
    duration: 25,
    description:
      '−10% no custo de popularidade das magias por nível. Não altera requisitos de desbloqueio.',
  },
  mobility: {
    name: 'Mobilização geral',
    cost: 200,
    duration: 25,
    description: '+10% de movimento de todas as tropas por nível, inclusive heróis.',
  },
  production: {
    name: 'Treinamento eficiente',
    cost: 220,
    duration: 25,
    description:
      '−10% no tempo de produção de todas as unidades por nível, inclusive trabalhadores e heróis.',
  },
  productivity: {
    name: 'Produtividade do trabalho',
    cost: 200,
    duration: 25,
    description: '+10% de renda por trabalhador por nível.',
  },
  worker_training: {
    name: 'Formação profissional',
    cost: 180,
    duration: 20,
    description:
      '−10% no tempo de treinamento de trabalhadores por nível. Acumula com Treinamento eficiente.',
  },
  construction: {
    name: 'Obras aceleradas',
    cost: 240,
    duration: 25,
    description: '+15% de velocidade de construção e melhoria de prédios por nível.',
  },
  infantry: {
    name: 'Tática de linha de frente',
    cost: 180,
    duration: 20,
    description: '+5% de ataque da linha de frente por nível.',
  },
  marksmanship: {
    name: 'Treino à distância',
    cost: 180,
    duration: 20,
    description: '+5% de ataque dos atiradores por nível.',
  },
  siege: {
    name: 'Engenharia de cerco',
    cost: 240,
    duration: 25,
    description: '+5% de ataque do cerco por nível, inclusive contra bases.',
  },
  vitality: {
    name: 'Saúde coletiva',
    cost: 220,
    duration: 25,
    description: '+2% de vida máxima para todas as unidades por nível, inclusive heróis.',
  },
  base_artillery: {
    name: 'Artilharia da base',
    cost: 250,
    duration: 15,
    description: `+${BASE_ARTILLERY_DAMAGE_PER_LEVEL} de dano da base por nível.`,
  },
  fortification: {
    name: 'Engenharia estrutural',
    cost: 260,
    duration: 30,
    description: '+200 de vida máxima e atual da base por nível.',
  },
  defense: {
    name: 'Defesa territorial',
    cost: 300,
    duration: 30,
    description: 'A base recebe 15% menos dano de ataques por nível.',
  },
} as const;
export type ResearchKind = keyof typeof RESEARCHES;
export function researchCategory(kind: ResearchKind) {
  return kind === 'spell_cooldown' || kind === 'spell_threshold'
    ? 'Poderes globais'
    : ['construction', 'fortification', 'defense', 'base_artillery'].includes(kind)
      ? 'Estrutural'
      : ['production', 'productivity', 'worker_training'].includes(kind)
        ? 'Econômico'
        : 'Exército';
}
export function researchBuilding(kind: ResearchKind): 'school' | 'academy' {
  return [
    'spell_cooldown',
    'spell_threshold',
    'productivity',
    'production',
    'vitality',
    'marksmanship',
    'siege',
    'fortification',
    'defense',
  ].includes(kind)
    ? 'academy'
    : 'school';
}
export function isResearchBuilding(kind: BuildingKind) {
  return kind === 'school' || kind === 'academy';
}
export function availableResearches(building: 'school' | 'academy') {
  return (Object.keys(RESEARCHES) as ResearchKind[]).filter(
    (kind) => researchBuilding(kind) === building,
  );
}
export interface ResearchJob {
  kind: ResearchKind;
  slot: number;
  progress: number;
  level: number;
  duration: number;
}
// Repeated identifiers represent completed levels and preserve existing level-one saves.
export { hasResearch, researchLevel } from './research-effects';
export function researchQuote(
  player: Player,
  kind: ResearchKind,
  level = Math.min(MAX_RESEARCH_LEVEL, researchLevel(player, kind) + 1),
) {
  const spec = RESEARCHES[kind];
  if (kind === 'base_artillery')
    return { level, cost: spec.cost * level, duration: spec.duration + 5 * (level - 1) };
  return {
    level,
    cost: spec.cost * 3 ** (level - 1),
    duration: Math.round(spec.duration * (1 + (level - 1) * 0.5)),
  };
}
export function researchOrderQuote(player: Player, kind: ResearchKind, slot: number) {
  const nextLevel = researchLevel(player, kind) + 1;
  const pending = (player.researchJobs ?? []).filter((job) => job.kind === kind);
  const level = Math.max(nextLevel, ...pending.map((job) => (job.level ?? nextLevel) + 1));
  const blocked =
    (kind === 'base_artillery' && !!player.baseAttackUpgrading) ||
    pending.some((job) => job.slot !== slot);
  return { ...researchQuote(player, kind, level), blocked };
}
export function researchBonusText(kind: ResearchKind, level: number) {
  if (kind === 'base_artillery') return `+${level * BASE_ARTILLERY_DAMAGE_PER_LEVEL} dano da base`;
  return kind === 'spell_cooldown'
    ? `−${level * 10}% recarga das magias`
    : kind === 'spell_threshold'
      ? `−${level * 10}% custo de popularidade`
      : kind === 'construction'
        ? `+${level * 15}% velocidade de obras`
        : kind === 'mobility'
          ? `+${level * 10}% movimento das tropas`
          : kind === 'production'
            ? `−${level * 10}% tempo de treinamento`
            : kind === 'productivity'
              ? `+${level * 10}% renda dos trabalhadores`
              : kind === 'worker_training'
                ? `−${level * 10}% tempo de treinar trabalhadores`
                : kind === 'infantry'
                  ? `+${level * 5}% linha de frente`
                  : kind === 'marksmanship'
                    ? `+${level * 5}% atiradores`
                    : kind === 'siege'
                      ? `+${level * 5}% cerco`
                      : kind === 'vitality'
                        ? `+${level * 2}% vida das unidades`
                        : kind === 'fortification'
                          ? `+${level * 200} vida da base`
                          : `−${level * 15}% dano na base`;
}
export function maxBaseHp(player: Player) {
  return BASE_HP + researchLevel(player, 'fortification') * 200;
}
export function unitAttackMultiplier(player: Player, kind: Unit['kind']) {
  return kind === 'hero' || kind === 'medic'
    ? 1
    : 1 +
        researchLevel(
          player,
          kind === 'front' ? 'infantry' : kind === 'ranged' ? 'marksmanship' : 'siege',
        ) *
          0.05;
}
export function unitHealthMultiplier(player: Player) {
  return 1 + researchLevel(player, 'vitality') * 0.02;
}
export function baseDamageMultiplier(player: Player) {
  return 1 - researchLevel(player, 'defense') * 0.15;
}
function normalizeResearch(player: Player) {
  player.research ??= [];
  player.researchJobs ??= [];
  const legacy = ['front_mobility', 'ranged_mobility', 'siege_mobility'];
  if (player.research.some((kind) => legacy.includes(String(kind)))) {
    const level = researchLevel(player, 'mobility');
    player.research = player.research.filter(
      (kind) => kind !== 'mobility' && !legacy.includes(String(kind)),
    );
    for (let i = 0; i < level; i++) player.research.push('mobility');
  }
  for (const job of player.researchJobs)
    if (legacy.includes(String(job.kind))) job.kind = 'mobility';
}
export function executeResearch(game: GameState, side: Side, command: Record<string, unknown>) {
  const player = game.players[side];
  normalizeResearch(player);
  if (typeof command.kind !== 'string' || !Object.hasOwn(RESEARCHES, command.kind))
    return 'Pesquisa inválida.';
  const kind = command.kind as ResearchKind;
  const academy = player.buildings.find(
    (building) =>
      building.slot === command.slot &&
      building.kind === researchBuilding(kind) &&
      (building.constructionProgress ?? 1) >= 1,
  );
  if (!academy)
    return researchBuilding(kind) === 'school'
      ? 'Selecione uma escola concluída.'
      : 'Selecione uma universidade concluída.';
  if (researchLevel(player, kind) >= MAX_RESEARCH_LEVEL) return 'Pesquisa no nível máximo.';
  const quote = researchOrderQuote(player, kind, academy.slot);
  if (quote.blocked) return 'Essa pesquisa já está em andamento em outra estrutura.';
  if (quote.level > MAX_RESEARCH_LEVEL) return 'Todos os níveis já foram encomendados.';
  if (player.cash < quote.cost) return 'R$ insuficientes.';
  player.cash -= quote.cost;
  player.researchJobs.push({
    kind,
    slot: academy.slot,
    progress: 0,
    level: quote.level,
    duration: quote.duration,
  });
  return null;
}
export function stepResearch(game: GameState, side: Side, dt: number) {
  const player = game.players[side];
  normalizeResearch(player);
  const timeLeft = new Map<number, number>();
  for (const job of player.researchJobs) {
    job.level ??= researchLevel(player, job.kind) + 1;
    job.duration ??= researchQuote(player, job.kind).duration;
    const available = timeLeft.get(job.slot) ?? dt;
    const elapsed = Math.min(available, Math.max(0, job.duration - job.progress));
    job.progress += elapsed;
    timeLeft.set(job.slot, available - elapsed);
    if (job.progress + 1e-8 < job.duration) continue;
    if (researchLevel(player, job.kind) < job.level) {
      const previousHealth = unitHealthMultiplier(player);
      player.research.push(job.kind);
      if (job.kind === 'base_artillery') player.baseAttackLevel = job.level + 1;
      if (job.kind === 'spell_cooldown') {
        const level = researchLevel(player, 'spell_cooldown'),
          ratio = (1 - 0.1 * level) / (1 - 0.1 * (level - 1));
        for (const kind of Object.keys(GLOBAL_POWERS) as GlobalPowerKind[])
          if (player.powerCooldowns?.[kind] > 0) player.powerCooldowns[kind] *= ratio;
      }
      if (job.kind === 'fortification') player.baseHp += 200;
      if (job.kind === 'vitality')
        for (const unit of game.units)
          if (unit.side === side) {
            const fraction = unit.hp / unit.maxHp;
            unit.maxHp = (unit.maxHp / previousHealth) * unitHealthMultiplier(player);
            unit.hp = fraction * unit.maxHp;
          }
      const academy = player.buildings.find((building) => building.slot === job.slot);
      if (academy) {
        academy.completedCycles = (academy.completedCycles ?? 0) + 1;
        academy.lastYield = 0;
      }
      game.log.unshift({
        id: game.nextId++,
        text: `${RESEARCHES[job.kind].name} nível ${job.level} concluído. Bônus global ativo.`,
      });
      game.log.length = Math.min(game.log.length, 6);
    }
  }
  player.researchJobs = player.researchJobs.filter((job) => job.progress + 1e-8 < job.duration);
}

export function movementMultiplier(player: Player, _kind: Unit['kind']) {
  return 1 + 0.1 * researchLevel(player, 'mobility');
}
export function unitTrainingMultiplier(player: Player, kind: Unit['kind'] | 'worker') {
  return (
    1 /
    ((1 - 0.1 * researchLevel(player, 'production')) *
      (kind === 'worker' ? 1 - 0.1 * researchLevel(player, 'worker_training') : 1))
  );
}
export function constructionMultiplier(player: Player) {
  return (1 + 0.15 * researchLevel(player, 'construction')) * popularityCrisis(player).production;
}
