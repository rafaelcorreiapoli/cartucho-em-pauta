import { expect, it } from 'vitest';
import {
  auraModifiers,
  createGame,
  execute,
  heroCount,
  MEDIC,
  medicDestination,
  populationCapacity,
  populationUsed,
  spawnUnit,
  step,
  stepHealing,
  unitAuras,
} from './index';
function setup() {
  const g = createGame();
  for (const p of Object.values(g.players)) {
    p.buildings = [
      {
        kind: 'hospital',
        slot: 1,
        level: 1,
        progress: 0,
        constructionProgress: 1,
        completedCycles: 0,
      },
    ];
    p.cash = 10000;
    p.baseAttackCooldown = 100000;
  }
  return g;
}
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
it('recruta no Hospital da Esquerda em fila normal, cobra e reserva população sem ocupar um herói', () => {
  const g = setup(),
    p = g.players.left;
  expect(execute(g, 'left', { type: 'medic', slot: 1, cost: 0, duration: 0 })).toBeNull();
  expect(p.cash).toBe(10000 - MEDIC.cost);
  expect(populationUsed(g, 'left')).toBe(5);
  expect(p.buildings[0].medicQueue![0]).toMatchObject({
    kind: 'medic',
    cost: 220,
    populationReserved: true,
  });
  advance(g, 9.95);
  expect(g.units).toHaveLength(0);
  advance(g, 0.05);
  expect(g.units[0].kind).toBe('medic');
  expect(heroCount(g, 'left')).toBe(0);
  expect(p.heroBirthSerial).toBe(0);
  expect(p.buildings[0].medicQueue!).toHaveLength(0);
  expect(execute(g, 'right', { type: 'medic', slot: 1 })).toBeNull();
});
it('aguarda vaga, respeita pesquisa de treinamento e não aceita fila cheia nem falta de R$', () => {
  const g = setup(),
    p = g.players.left;
  p.workers = 12;
  p.research = ['production', 'production', 'production'];
  execute(g, 'left', { type: 'medic', slot: 1 });
  advance(g, 10);
  expect(p.buildings[0].medicQueue![0].progress).toBe(0);
  p.workers = 10;
  advance(g, 6.95);
  expect(g.units).toHaveLength(0);
  advance(g, 0.05);
  expect(g.units[0].kind).toBe('medic');
  expect(populationUsed(g, 'left')).toBe(populationCapacity(p));
  const h = setup();
  h.players.left.cash = 0;
  expect(execute(h, 'left', { type: 'medic', slot: 1 })).toMatch(/insuficientes/);
  h.players.left.cash = 10000;
  for (let i = 0; i < 5; i++) execute(h, 'left', { type: 'medic', slot: 1 });
  const cash = h.players.left.cash;
  expect(execute(h, 'left', { type: 'medic', slot: 1 })).toMatch(/cheia/);
  expect(h.players.left.cash).toBe(cash);
});
it('cura apenas um aliado por ciclo, priorizando menor porcentagem de vida, sem afetar inimigos ou Base', () => {
  const g = setup();
  spawnUnit(g, 'left', 'medic');
  spawnUnit(g, 'left', 'front');
  spawnUnit(g, 'left', 'hero');
  spawnUnit(g, 'right', 'front');
  for (const u of g.units) {
    u.x = 500;
    u.row = 0;
    u.hp = 50;
    u.cooldown = 10000;
  }
  g.players.left.baseHp = 100;
  g.time = 1;
  stepHealing(g, 1);
  expect(g.units.map((u) => u.hp)).toEqual([50, 50, 55, 50]);
  expect(g.units[0].healingTargetId).toBe(g.units[2].id);
  expect(g.players.left.baseHp).toBe(100);
  g.time = 1.5;
  stepHealing(g, 0.5);
  expect(g.units.map((u) => u.hp)).toEqual([50, 50, 55, 50]);
  g.units[2].hp = g.units[2].maxHp;
  g.time = 2;
  stepHealing(g, 0.5);
  expect(g.units[1].hp).toBe(55);
});
it('escolhe um único alvo em alcance, não acumula médicos e remove o indicador ao sair da área', () => {
  const g = setup();
  spawnUnit(g, 'left', 'medic');
  spawnUnit(g, 'left', 'medic');
  spawnUnit(g, 'left', 'front');
  for (const unit of g.units) {
    unit.x = 500;
    unit.row = 0;
  }
  const target = g.units[2];
  target.hp = 50;
  g.time = 1;
  stepHealing(g, 1);
  expect(target.hp).toBe(55);
  expect(auraModifiers(unitAuras(g, target)).healing).toBe(5);
  target.x = 641;
  expect(auraModifiers(unitAuras(g, target)).healing).toBe(0);
  target.x = 640;
  target.row = 1;
  expect(auraModifiers(unitAuras(g, target)).healing).toBe(0);
  target.row = 0;
  expect(auraModifiers(unitAuras(g, target)).healing).toBe(5);
  g.units[0].hp = 0;
  g.units[1].hp = 0;
  g.time = 2;
  stepHealing(g, 1);
  expect(target.hp).toBe(55);
});
it('pode curar a si mesmo e não ultrapassa a vida máxima do alvo', () => {
  const g = setup();
  spawnUnit(g, 'left', 'medic');
  const medic = g.units[0];
  medic.hp = medic.maxHp - 1;
  g.time = 1;
  stepHealing(g, 1);
  expect(medic.hp).toBe(medic.maxHp);
  expect(medic.healingTargetId).toBe(medic.id);
});
it('não ressuscita mortos e não causa dano; acompanha a retaguarda', () => {
  const g = setup();
  spawnUnit(g, 'left', 'medic');
  spawnUnit(g, 'left', 'front');
  spawnUnit(g, 'right', 'front');
  const [medic, front, enemy] = g.units;
  medic.x = 500;
  front.x = 600;
  enemy.x = 900;
  for (const u of g.units) u.cooldown = 10000;
  expect(medicDestination(g, medic)).toBe(540);
  const hp = enemy.hp;
  advance(g, 1);
  expect(medic.x).toBeGreaterThan(500);
  expect(enemy.hp).toBe(hp);
  expect(g.hits.some((hit) => hit.sourceId === medic.id)).toBe(false);
  front.hp = 0;
  stepHealing(g, 1);
  expect(front.hp).toBe(0);
  expect(unitAuras(g, front)).toHaveLength(0);
});
it('passo completo remove baixas antes da cura, impedindo salvar unidade que recebeu dano letal', () => {
  const g = setup();
  spawnUnit(g, 'left', 'medic');
  spawnUnit(g, 'left', 'front');
  spawnUnit(g, 'right', 'front');
  const [medic, front, enemy] = g.units;
  for (const u of g.units) {
    u.x = 500;
    u.row = 0;
    u.cooldown = 10000;
  }
  medic.x = 450;
  front.hp = 1;
  enemy.cooldown = 0;
  step(g, 0.05);
  expect(g.units.some((u) => u.id === front.id)).toBe(false);
});

it('médico da Direita usa custo, fila, população e cura equivalentes', () => {
  const g = setup(),
    p = g.players.right;
  expect(execute(g, 'right', { type: 'medic', slot: 1 })).toBeNull();
  expect(p.cash).toBe(10000 - MEDIC.cost);
  advance(g, MEDIC.duration);
  const medic = g.units.find((unit) => unit.kind === 'medic' && unit.side === 'right')!;
  expect(medic.maxHp).toBe(100);
  expect(heroCount(g, 'right')).toBe(0);
  spawnUnit(g, 'right', 'front', 1, true);
  const ally = g.units.at(-1)!;
  ally.x = medic.x;
  ally.hp = 20;
  medic.healingCooldown = 0;
  stepHealing(g, 1);
  expect(ally.hp).toBe(25);
});
