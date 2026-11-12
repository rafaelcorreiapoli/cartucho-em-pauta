import { expect, it } from 'vitest';
import {
  HEROES,
  createGame,
  createHeroRecord,
  execute,
  heroLevelHealthMultiplier,
  heroRecord,
  heroRevivalQuote,
  heroXpThreshold,
  populationUsed,
  spawnUnit,
  step,
  unitLevelDamageMultiplier,
  type HeroKind,
} from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
function setup() {
  const g = createGame();
  for (const player of Object.values(g.players))
    player.unlockedPowers = ['bills', 'recall', 'silence', 'strength'];
  for (const p of Object.values(g.players)) {
    p.buildings = [];
    p.baseAttackCooldown = 100000;
    p.cash = 10000;
  }
  return g;
}
function hospital(g: ReturnType<typeof createGame>, slot = 1) {
  g.players.left.buildings.push({
    kind: 'hospital',
    slot,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
    autoPaused: true,
  });
}
function fallen(g: ReturnType<typeof createGame>, hero: HeroKind = 'che', level = 1, xp = 0) {
  const record = createHeroRecord(hero, level, 'dead');
  record.xp = xp;
  g.players.left.heroes.push(record);
  return record;
}
function kill(g: ReturnType<typeof createGame>, hero: HeroKind = 'che') {
  g.units.find((u) => u.side === 'left' && u.hero === hero)!.hp = 0;
  step(g, 0.05);
}
it('abates dão XP e níveis reais de vida/dano, preservando percentual de ferimento', () => {
  const g = setup();
  spawnUnit(g, 'left', 'hero', 1, false, 'che');
  const hero = g.units[0];
  hero.x = 500;
  hero.hp = hero.maxHp / 2;
  for (let i = 0; i < 4; i++) {
    spawnUnit(g, 'right', 'front');
    const enemy = g.units.at(-1)!;
    enemy.x = 500;
    enemy.hp = 1;
    enemy.cooldown = 100;
    hero.cooldown = 0;
    step(g, 0.05);
  }
  const record = heroRecord(g.players.left, 'che')!;
  expect(record.xp).toBe(100);
  expect(record.level).toBe(2);
  expect(hero.level).toBe(2);
  expect(hero.maxHp).toBeCloseTo(HEROES.che.hp * 1.12);
  expect(hero.hp / hero.maxHp).toBeCloseTo(0.5);
  expect(unitLevelDamageMultiplier('hero', 2)).toBeCloseTo(1.1);
  hero.x = 920;
  hero.cooldown = 0;
  step(g, 0.05);
  expect(g.hits.filter((h) => h.sourceId === hero.id).at(-1)?.damage).toBeCloseTo(
    HEROES.che.damage * 1.1,
  );
});
it('divide XP entre heróis vivos próximos e não dá XP a mortos ou distantes', () => {
  const g = setup();
  for (const hero of ['che', 'stalin', 'jones'] as HeroKind[]) {
    spawnUnit(g, 'left', 'hero', 1, false, hero);
    g.units.at(-1)!.x = 500;
    g.units.at(-1)!.cooldown = 100;
  }
  spawnUnit(g, 'right', 'siege');
  const enemy = g.units.at(-1)!;
  enemy.x = 500;
  enemy.hp = 1;
  enemy.cooldown = 100;
  g.players.left.popularity = 200;
  execute(g, 'left', { type: 'power', kind: 'bills' });
  for (const record of g.players.left.heroes) expect(record.xp).toBe(20);
  g.units.find((u) => u.hero === 'jones')!.x = 80;
  g.players.left.powerCooldowns.bills = 0;
  spawnUnit(g, 'right', 'ranged');
  const next = g.units.at(-1)!;
  next.x = 500;
  next.hp = 1;
  execute(g, 'left', { type: 'power', kind: 'bills' });
  expect(heroRecord(g.players.left, 'che')!.xp).toBe(35);
  expect(heroRecord(g.players.left, 'jones')!.xp).toBe(20);
  const duel = setup();
  spawnUnit(duel, 'left', 'hero', 1, false, 'che');
  spawnUnit(duel, 'right', 'front');
  for (const u of duel.units) {
    u.x = 500;
    u.hp = 1;
    u.cooldown = 0;
  }
  step(duel, 0.05);
  expect(heroRecord(duel.players.left, 'che')).toMatchObject({ status: 'dead', xp: 0 });
});
it('nível e XP têm teto 100 sem alterar a progressão de tropas normais', () => {
  const g = setup();
  spawnUnit(g, 'left', 'hero', 99, false, 'che');
  heroRecord(g.players.left, 'che')!.xp = heroXpThreshold(100) - 50;
  const hero = g.units[0];
  hero.x = 500;
  for (let i = 0; i < 30; i++) {
    spawnUnit(g, 'right', 'siege', 15);
    const enemy = g.units.at(-1)!;
    enemy.x = 500;
    enemy.hp = 1;
    enemy.cooldown = 100;
    hero.cooldown = 0;
    step(g, 0.05);
  }
  expect(hero.level).toBe(100);
  expect(heroRecord(g.players.left, 'che')!.xp).toBe(heroXpThreshold(100));
  expect(hero.maxHp).toBeCloseTo(HEROES.che.hp * heroLevelHealthMultiplier(100));
  expect(unitLevelDamageMultiplier('front', 15)).toBeCloseTo(1.7);
});
it('Hospital recupera rapidamente mantendo XP/nível e cobra pelo nível, sem penalidade por mortes anteriores', () => {
  const g = setup(),
    p = g.players.left;
  hospital(g);
  const record = fallen(g, 'che', 2, 160);
  const cash = p.cash;
  expect(execute(g, 'left', { type: 'hero', hero: 'che' })).toMatch(/já adquirido/);
  expect(heroRevivalQuote(p, 'che')).toEqual({ cost: 300, duration: 8 });
  expect(
    execute(g, 'left', {
      type: 'hero-revive',
      hero: 'che',
      slot: 1,
      cost: 0,
      duration: 0,
      level: 10,
    }),
  ).toBeNull();
  expect(p.cash).toBe(cash - 300);
  expect(populationUsed(g, 'left')).toBe(6);
  expect(execute(g, 'left', { type: 'hero-revive', hero: 'che', slot: 1 })).toMatch(/indisponível/);
  advance(g, 7.95);
  expect(g.units).toHaveLength(0);
  advance(g, 0.05);
  expect(g.units[0]).toMatchObject({ hero: 'che', level: 2 });
  expect(g.units[0].hp).toBeCloseTo(HEROES.che.hp * 1.12);
  expect(record).toMatchObject({ xp: 160, status: 'alive', revivals: 1 });
  expect(p.heroRevivals).toHaveLength(0);
  expect(heroRevivalQuote(p, 'che').cost).toBe(300);
  kill(g);
  expect(record.status).toBe('dead');
  execute(g, 'left', { type: 'hero-revive', hero: 'che', slot: 1 });
  advance(g, 8);
  expect(record.revivals).toBe(2);
  expect(heroRevivalQuote(p, 'che').cost).toBe(300);
  expect(record.xp).toBe(160);
});
it('valida aquisição, facção, Hospital concluído, fila e dinheiro sem cobrar ações inválidas', () => {
  const g = setup(),
    p = g.players.left;
  hospital(g);
  fallen(g);
  fallen(g, 'stalin');
  for (const command of [
    { type: 'hero-revive', hero: '__proto__', slot: 1 },
    { type: 'hero-revive', hero: 'marcal', slot: 1 },
    { type: 'hero-revive', hero: 'che', slot: 2 },
  ]) {
    const cash = p.cash;
    expect(execute(g, 'left', command)).toBeTruthy();
    expect(p.cash).toBe(cash);
  }
  p.buildings[0].constructionProgress = 0.5;
  expect(execute(g, 'left', { type: 'hero-revive', hero: 'che', slot: 1 })).toMatch(
    /Hospital concluído/,
  );
  p.buildings[0].constructionProgress = 1;
  p.cash = 0;
  expect(execute(g, 'left', { type: 'hero-revive', hero: 'che', slot: 1 })).toMatch(
    /insuficientes/,
  );
  p.cash = 10000;
  execute(g, 'left', { type: 'hero-revive', hero: 'che', slot: 1 });
  expect(execute(g, 'left', { type: 'hero-revive', hero: 'stalin', slot: 1 })).toMatch(/já está/);
  p.heroes.push(createHeroRecord('jones', 1, 'dead'));
  expect(execute(g, 'left', { type: 'hero', hero: 'lulinha' })).toMatch(/três/);
});
it('reserva população, aguarda vagas e demolir hospital cancela recuperação sem perder o herói', () => {
  const g = setup(),
    p = g.players.left;
  hospital(g);
  const record = fallen(g);
  p.workers = 12;
  execute(g, 'left', { type: 'hero-revive', hero: 'che', slot: 1 });
  advance(g, 10);
  expect(p.heroRevivals[0]).toMatchObject({ progress: 0, populationReserved: false });
  p.workers = 9;
  advance(g, 0.05);
  expect(populationUsed(g, 'left')).toBe(12);
  expect(p.heroRevivals[0].progress).toBeGreaterThan(0);
  g.status = 'waiting';
  const progress = p.heroRevivals[0].progress;
  advance(g, 5);
  expect(p.heroRevivals[0].progress).toBe(progress);
  g.status = 'playing';
  execute(g, 'left', { type: 'demolish', slot: 1 });
  expect(p.heroRevivals).toHaveLength(0);
  expect(populationUsed(g, 'left')).toBe(9);
  expect(record).toMatchObject({ status: 'dead', revivals: 0 });
});

it('recuperação usa bônus de treinamento e hospitais diferentes operam em paralelo sem duplicar reservas', () => {
  const g = setup(),
    p = g.players.left;
  hospital(g, 1);
  hospital(g, 2);
  fallen(g, 'che');
  fallen(g, 'stalin');
  p.research = ['production', 'production', 'production'];
  execute(g, 'left', { type: 'hero-revive', hero: 'che', slot: 1 });
  execute(g, 'left', { type: 'hero-revive', hero: 'stalin', slot: 2 });
  expect(populationUsed(g, 'left')).toBe(9);
  advance(g, 5.55);
  expect(g.units).toHaveLength(0);
  advance(g, 0.05);
  expect(g.units).toHaveLength(2);
  expect(populationUsed(g, 'left')).toBe(9);
  expect(p.heroRevivals).toHaveLength(0);
});
