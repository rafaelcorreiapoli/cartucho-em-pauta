import { expect, it } from 'vitest';
import {
  HEROES,
  createGame,
  execute,
  heroAlive,
  heroCount,
  heroQueued,
  heroRecruitmentCooldown,
  heroRoster,
  populationCapacity,
  populationUsed,
  spawnUnit,
  step,
  unitStats,
  type HeroKind,
} from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
function setup() {
  const g = createGame();
  for (const p of Object.values(g.players)) {
    p.buildings = [
      {
        kind: 'civic',
        slot: 47,
        level: 1,
        progress: 0,
        constructionProgress: 1,
        completedCycles: 0,
        autoPaused: true,
      },
    ];
    p.buildings.push({
      kind: 'academy',
      slot: 46,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
      autoPaused: true,
    });
    p.baseAttackCooldown = 100000;
    p.cash = 10000;
  }
  return g;
}
it('oferece o elenco atualizado na facção correta e rejeita personagem inválido ou inimigo sem cobrar', () => {
  const g = setup(),
    p = g.players.left;
  expect(heroRoster('left')).toEqual(['jones', 'che', 'stalin', 'lulinha']);
  expect(heroRoster('right')).toEqual(['mamaefalei', 'trump', 'bolsonaro', 'marcal']);
  for (const hero of [
    '__proto__',
    'constructor',
    'jorginho',
    'marcal',
    'trump',
    'dilma',
    'pavanato',
  ]) {
    const cash = p.cash;
    expect(execute(g, 'left', { type: 'hero', hero })).toMatch(/inválido|adversária/);
    expect(p.cash).toBe(cash);
  }
});
it('limita a três heróis distintos incluindo fila, sem permitir duplicar personagem ou falsificar custo/tempo', () => {
  const g = setup(),
    p = g.players.left;
  for (let slot = 30; slot < 45; slot++)
    p.buildings.push({
      kind: 'housing',
      slot,
      level: 15,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    });
  for (const hero of ['che', 'stalin', 'jones'] as HeroKind[]) {
    const cash = p.cash;
    expect(execute(g, 'left', { type: 'hero', hero, cost: 0, duration: 0 })).toBeNull();
    expect(p.cash).toBe(cash - (hero === 'che' ? 0 : HEROES[hero].cost));
  }
  expect(heroCount(g, 'left')).toBe(3);
  const cash = p.cash;
  expect(execute(g, 'left', { type: 'hero', hero: 'lulinha' })).toMatch(/três/);
  expect(execute(g, 'left', { type: 'hero', hero: 'che' })).toMatch(/indisponível/);
  expect(p.cash).toBe(cash);
  advance(g, 11.95);
  expect(g.units).toHaveLength(0);
  advance(g, 0.05);
  expect(g.units[0].hero).toBe('che');
  expect(g.units[0].maxHp).toBe(HEROES.che.hp);
  expect(heroAlive(g, 'left', 'che')).toBe(true);
  expect(heroQueued(p, 'stalin')).toBe(true);
  expect(p.heroBirthSerial).toBe(1);
  expect(heroCount(g, 'left')).toBe(3);
});
it('aquisição é única mesmo após morte e antigas recargas; outras identidades continuam disponíveis', () => {
  const g = setup(),
    p = g.players.left;
  execute(g, 'left', { type: 'hero', hero: 'che' });
  advance(g, 12);
  g.units = [];
  expect(heroRecruitmentCooldown(p, 'left', 'che')).toBeGreaterThan(59);
  expect(execute(g, 'left', { type: 'hero', hero: 'che' })).toMatch(/indisponível/);
  expect(execute(g, 'left', { type: 'hero', hero: 'jones' })).toBeNull();
  advance(g, 60);
  g.units = [];
  expect(execute(g, 'left', { type: 'hero', hero: 'che' })).toMatch(/já adquirido/);
});
it('três heróis cabem na população com reserva por pedido; sem vaga o treinamento aguarda', () => {
  const g = setup(),
    p = g.players.left;
  p.workers = 12;
  execute(g, 'left', { type: 'hero', hero: 'che' });
  expect(p.trainingQueue[0].populationReserved).not.toBe(true);
  advance(g, 15);
  expect(p.trainingQueue[0].progress).toBe(0);
  p.workers = 3;
  advance(g, 0.05);
  expect(populationUsed(g, 'left')).toBe(6);
  expect(populationCapacity(p)).toBe(12);
});
it('perfis individuais realmente afetam vida, dano e movimento sem empilhar auras', () => {
  const g = setup();
  spawnUnit(g, 'left', 'hero', 1, false, 'stalin');
  const tank = g.units[0];
  expect(unitStats(tank).speed).toBe(15);
  expect(tank.maxHp).toBe(HEROES.stalin.hp);
  tank.x = 920;
  tank.cooldown = 0;
  step(g, 0.05);
  expect(g.hits.find((h) => h.sourceId === tank.id)?.damage).toBe(HEROES.stalin.damage);
  spawnUnit(g, 'left', 'hero', 1, false, 'che');
  expect(g.units.at(-1)!.maxHp).toBe(HEROES.che.hp);
});

it('qualquer herói exige a cultura da própria facção concluída; Escola não depende dela', () => {
  for (const side of ['left', 'right'] as const) {
    const g = createGame(),
      p = g.players[side],
      enemy = g.players[side === 'left' ? 'right' : 'left'];
    p.cash = 10000;
    p.buildings = [];
    enemy.buildings = [
      {
        kind: 'civic',
        slot: 2,
        level: 1,
        progress: 0,
        constructionProgress: 1,
        completedCycles: 0,
      },
    ];
    expect(execute(g, side, { type: 'build', kind: 'school', slot: 1 })).toBeNull();
    for (const hero of heroRoster(side))
      expect(execute(g, side, { type: 'hero', hero })).toMatch(/Requer/);
    p.buildings.push({
      kind: 'civic',
      slot: 2,
      level: 1,
      progress: 0,
      constructionProgress: 0.5,
      completedCycles: 0,
    });
    expect(execute(g, side, { type: 'hero' })).toMatch(/Requer/);
    p.buildings[1].constructionProgress = 1;
    expect(execute(g, side, { type: 'hero' })).toBeNull();
  }
});

it('primeiro herói é grátis em ambas as facções e os próximos usam preço normal, inclusive durante a primeira fila', () => {
  for (const side of ['left', 'right'] as const) {
    const g = setup(),
      p = g.players[side],
      [first, second] = heroRoster(side);
    p.cash = 0;
    expect(execute(g, side, { type: 'hero', hero: first, cost: -999 })).toBeNull();
    expect(p.cash).toBe(0);
    expect(p.trainingQueue[0].cost).toBe(0);
    expect(execute(g, side, { type: 'hero', hero: second })).toMatch(/insuficientes/);
    p.cash = 10000;
    expect(execute(g, side, { type: 'hero', hero: second })).toBeNull();
    expect(p.cash).toBe(10000 - HEROES[second].cost);
    expect(p.trainingQueue[1].cost).toBe(HEROES[second].cost);
  }
});

it('Trump pode ser recrutado pela Direita e Dilma foi removida', () => {
  const g = setup();
  expect(execute(g, 'right', { type: 'hero', hero: 'trump' })).toBeNull();
  advance(g, 12);
  expect(g.units.some((unit) => unit.hero === 'trump' && unit.side === 'right')).toBe(true);
  expect(execute(g, 'left', { type: 'hero', hero: 'dilma' })).toMatch(/inválido/);
});

it('Bolsonaro usa recrutamento e progressão comuns e Jorginho não é recrutável como herói', () => {
  const g = setup();
  expect(execute(g, 'right', { type: 'hero', hero: 'jorginho' })).toMatch(/inválido/);
  expect(execute(g, 'right', { type: 'hero', hero: 'bolsonaro' })).toBeNull();
  advance(g, 12);
  expect(g.units.some((unit) => unit.hero === 'bolsonaro' && unit.side === 'right')).toBe(true);
});

it('heróis têm resistência ampliada sem aumentar o dano-base', () => {
  const g = setup();
  spawnUnit(g, 'left', 'hero', 1, true, 'jones');
  expect(g.units.at(-1)!.maxHp).toBe(1560);
  expect(HEROES.jones.damage).toBe(35);
  expect(HEROES.che.hp).toBe(1200);
  expect(HEROES.stalin.hp).toBe(2220);
  expect(HEROES.bolsonaro.hp).toBe(2100);
});

it('Marçal substitui Pavanato no recrutamento da Direita', () => {
  const g = setup();
  expect(execute(g, 'right', { type: 'hero', hero: 'pavanato' })).toMatch(/inválido/);
  expect(execute(g, 'right', { type: 'hero', hero: 'marcal' })).toBeNull();
  advance(g, 12);
  expect(g.units.some((unit) => unit.hero === 'marcal' && unit.side === 'right')).toBe(true);
  expect(HEROES.marcal.name).toBe('Pablo Marçal');
});
