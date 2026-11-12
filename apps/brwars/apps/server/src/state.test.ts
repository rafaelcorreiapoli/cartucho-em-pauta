import { createGame, createHeroRecord, execute, spawnUnit, step } from '@brwars/simulation';
import { Decoder, Encoder } from '@colyseus/schema';
import { expect, it } from 'vitest';
import { MatchState, syncState } from './state';
it('sincroniza pesquisas em progresso e concluídas pelo codec real do Colyseus', () => {
  const game = createGame();
  game.players.left.buildings = [
    {
      kind: 'academy',
      slot: 1,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    },
  ];
  game.players.right.buildings = [];
  game.players.left.cash = 10000;
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  execute(game, 'left', { type: 'research', slot: 1, kind: 'fortification' });
  execute(game, 'left', { type: 'research', slot: 1, kind: 'defense' });
  step(game, 0.05);
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.players.get('left')?.researchJobs.map(({ kind }) => kind)).toEqual([
    'fortification',
    'defense',
  ]);
  expect(copy.players.get('left')?.researchJobs[1].progress).toBe(0);
  encoder.discardChanges();
  for (let i = 0; i < 600; i++) step(game, 0.05);
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.players.get('left')?.research[0]).toBe('fortification');
  expect(copy.players.get('left')?.baseHp).toBe(5200);
  expect(copy.players.get('left')?.researchJobs).toHaveLength(1);
  expect(copy.players.get('left')?.researchJobs[0].kind).toBe('defense');
  expect(copy.players.get('left')?.researchJobs[0].progress).toBeCloseTo(0.05);
});

it('transmite reservas de população de fábricas e pedidos manuais', () => {
  const game = createGame();
  execute(game, 'left', { type: 'worker' });
  step(game, 0.05);
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.trainingQueue[0].populationReserved).toBe(true);
  expect(copy.players.get('left')?.buildings[0].populationReserved).toBe(true);
});

it('sincroniza progresso e conclusão de melhoria sem aplicar nível antecipado', () => {
  const game = createGame();
  game.players.right.buildings = [];
  game.players.left.buildings[0].autoPaused = true;
  execute(game, 'left', { type: 'upgrade', slot: 0 });
  step(game, 0.05);
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.buildings[0].upgrading).toBe(true);
  expect(copy.players.get('left')?.buildings[0].upgradeProgress).toBeGreaterThan(0);
  expect(copy.players.get('left')?.buildings[0].level).toBe(1);
  encoder.discardChanges();
  for (let i = 0; i < 200; i++) step(game, 0.05);
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.players.get('left')?.buildings[0].upgrading).toBe(false);
  expect(copy.players.get('left')?.buildings[0].level).toBe(2);
});

it('sincroniza posse de terrenos e mantém compra restrita à facção do cliente', () => {
  const game = createGame(),
    state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.ownedPlots).toHaveLength(6);
  encoder.discardChanges();
  execute(game, 'left', { type: 'buy-plot', slot: 47 });
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.players.get('left')?.ownedPlots.includes(47)).toBe(true);
  expect(copy.players.get('right')?.ownedPlots.includes(47)).toBe(false);
});

it('remove edifício demolido no codec e limpa campos opcionais ao deslocar os restantes', () => {
  const game = createGame(),
    p = game.players.left;
  p.buildings[0].upgrading = true;
  p.buildings[0].autoPaused = true;
  p.buildings[0].populationReserved = true;
  p.buildings.push({
    kind: 'housing',
    slot: 1,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  encoder.discardChanges();
  execute(game, 'left', { type: 'demolish', slot: 0 });
  syncState(state, game);
  decoder.decode(encoder.encode());
  const buildings = copy.players.get('left')!.buildings;
  expect(buildings).toHaveLength(1);
  expect(buildings[0].kind).toBe('housing');
  expect(buildings[0].upgrading).toBe(false);
  expect(buildings[0].autoPaused).toBe(false);
  expect(buildings[0].populationReserved).toBe(false);
});

it('sincroniza arma da base, melhoria em progresso e origem de projéteis', () => {
  const game = createGame();
  game.players.left.buildings = [];
  game.players.right.buildings = [];
  game.players.left.buildings.push({
    kind: 'school',
    slot: 1,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  expect(execute(game, 'left', { type: 'research', slot: 1, kind: 'base_artillery' })).toBeNull();
  game.units.push({
    id: 999,
    side: 'right',
    kind: 'front',
    x: 180,
    hp: 125,
    maxHp: 125,
    level: 1,
    cooldown: 1,
    attacking: false,
    row: 0,
    silencedUntil: 0,
    strengthUntil: 0,
  });
  step(game, 0.05);
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  const research = copy.players.get('left')?.researchJobs[0];
  expect(research?.kind).toBe('base_artillery');
  expect(research?.progress).toBeGreaterThan(0);
  expect(copy.players.get('left')?.baseAttackLevel).toBe(1);
  expect(copy.hits.find((h) => h.sourceType === 'base')).toMatchObject({
    sourceId: -1,
    targetId: 999,
    damage: 65,
  });
});

it('sincroniza impostos percentuais com passo de meio ponto e sem cooldown', () => {
  const game = createGame();
  execute(game, 'left', { type: 'tax', delta: 0.5 });
  execute(game, 'left', { type: 'tax', delta: 0.5 });
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.taxRate).toBe(11);
  expect(copy.players.get('right')?.taxRate).toBe(10);
});

it('sincroniza recargas individuais e atualizações pelo codec sem bloquear outras magias', () => {
  const game = createGame(),
    state = new MatchState(),
    copy = new MatchState();
  game.players.left.powerCooldowns.strength = 40;
  game.players.left.powerCooldowns.recall = 45;
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.powerCooldowns.toJSON()).toEqual({
    bills: 0,
    recall: 45,
    silence: 0,
    strength: 40,
    sabotage: 0,
  });
  expect(copy.players.get('right')?.powerCooldowns.get('strength')).toBe(0);
  encoder.discardChanges();
  step(game, 0.05);
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.players.get('left')?.powerCooldowns.get('strength')).toBeCloseTo(39.95);
  expect(copy.toJSON().players.left.powerCooldowns.recall).toBeCloseTo(44.95);
});

it('transmite popularidade negativa sem truncar e preserva recuperação no snapshot', () => {
  const game = createGame(),
    state = new MatchState(),
    copy = new MatchState();
  game.players.left.popularity = -150;
  game.players.left.taxRate = 0;
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.popularity).toBe(-150);
  encoder.discardChanges();
  step(game, 0.05);
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.toJSON().players.left.popularity).toBeCloseTo(-149.975);
});

it('transmite identidade dos heróis, fila, recargas individuais e serial de nascimento', () => {
  const game = createGame(),
    p = game.players.left;
  game.players.left.buildings = [];
  game.players.right.buildings = [];
  p.cash = 10000;
  p.buildings.push({
    kind: 'academy',
    slot: 46,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
    autoPaused: true,
  });
  p.buildings.push({
    kind: 'civic',
    slot: 47,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
    autoPaused: true,
  });
  execute(game, 'left', { type: 'hero', hero: 'che' });
  execute(game, 'left', { type: 'hero', hero: 'stalin' });
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.trainingQueue[0].hero).toBe('che');
  expect(copy.players.get('left')?.trainingQueue[1].hero).toBe('stalin');
  encoder.discardChanges();
  for (let i = 0; i < 240; i++) step(game, 0.05);
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.units[0].hero).toBe('che');
  expect(copy.players.get('left')?.heroBirthSerial).toBe(1);
  expect(copy.players.get('left')?.heroCooldowns.get('che')).toBeGreaterThan(59);
  expect(copy.toJSON().players.left.trainingQueue[0].hero).toBe('stalin');
});

it('preserva XP/nível após morte e sincroniza recuperação no Hospital pelo codec real', () => {
  const game = createGame(),
    p = game.players.left;
  p.buildings = [
    {
      kind: 'hospital',
      slot: 1,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
      autoPaused: true,
    },
  ];
  game.players.right.buildings = [];
  p.cash = 10000;
  p.heroes = [createHeroRecord('che', 3, 'dead')];
  p.heroes[0].xp = 270;
  execute(game, 'left', { type: 'hero-revive', hero: 'che', slot: 1 });
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.heroes[0]).toMatchObject({
    hero: 'che',
    level: 3,
    xp: 270,
    status: 'reviving',
  });
  expect(copy.players.get('left')?.heroRevivals[0]).toMatchObject({
    hero: 'che',
    slot: 1,
    cost: 360,
    populationReserved: true,
  });
  encoder.discardChanges();
  for (let i = 0; i < 160; i++) step(game, 0.05);
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.players.get('left')?.heroRevivals).toHaveLength(0);
  expect(copy.players.get('left')?.heroes[0]).toMatchObject({
    level: 3,
    xp: 270,
    revivals: 1,
    status: 'alive',
  });
  expect(copy.units.find((unit) => unit.hero === 'che')?.level).toBe(3);
});

it('transmite fila de eventos, progresso e conclusão sem manter pedidos fantasmas', () => {
  const game = createGame(),
    p = game.players.left;
  p.buildings = [
    {
      kind: 'civic',
      slot: 1,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
      autoPaused: true,
    },
  ];
  p.cash = 1000;
  p.taxRate = 14;
  execute(game, 'left', { type: 'promote', slot: 1, kind: 'local' });
  execute(game, 'left', { type: 'promote', slot: 1, kind: 'event' });
  step(game, 0.05);
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.buildings[0].promotionQueue).toHaveLength(2);
  expect(copy.players.get('left')?.buildings[0].promotionQueue[0].progress).toBeGreaterThan(0);
  encoder.discardChanges();
  for (let i = 0; i < 120; i++) step(game, 0.05);
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.players.get('left')?.buildings[0].promotionQueue).toHaveLength(1);
  expect(copy.players.get('left')?.buildings[0].promotionQueue[0].kind).toBe('event');
  expect(copy.players.get('left')?.popularity).toBe(15);
});

it('transmite recrutamento do médico, nascimento e HP curado pelo codec real', () => {
  const game = createGame(),
    p = game.players.left;
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
  game.players.right.buildings = [];
  p.cash = 10000;
  p.baseAttackCooldown = 10000;
  game.players.right.baseAttackCooldown = 10000;
  execute(game, 'left', { type: 'medic', slot: 1 });
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  expect(copy.players.get('left')?.buildings[0].medicQueue[0]).toMatchObject({
    kind: 'medic',
    cost: 220,
    populationReserved: true,
  });
  encoder.discardChanges();
  for (let i = 0; i < 200; i++) step(game, 0.05);
  spawnUnit(game, 'left', 'front');
  const medic = game.units.find((unit) => unit.kind === 'medic')!,
    front = game.units.find((unit) => unit.kind === 'front')!;
  medic.x = 500;
  front.x = 510;
  front.hp = 50;
  medic.healingCooldown = 0;
  step(game, 0.05);
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.units.find((unit) => unit.kind === 'medic')?.attacking).toBe(true);
  expect(copy.units.find((unit) => unit.id === front.id)?.hp).toBeCloseTo(55);
  expect(copy.players.get('left')?.heroes).toHaveLength(0);
});

it('sincroniza desbloqueios permanentes e o saldo após pagar uma magia pelo codec', () => {
  const game = createGame(),
    p = game.players.left;
  p.unlockedPowers = ['bills'];
  p.popularity = 100;
  spawnUnit(game, 'right', 'front');
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state),
    decoder = new Decoder(copy);
  decoder.decode(encoder.encodeAll());
  encoder.discardChanges();
  expect(copy.players.get('left')?.unlockedPowers.toArray()).toEqual(['bills']);
  expect(execute(game, 'left', { type: 'power', kind: 'bills' })).toBeNull();
  syncState(state, game);
  decoder.decode(encoder.encode());
  expect(copy.players.get('left')?.popularity).toBe(40);
  expect(copy.players.get('left')?.unlockedPowers.toArray()).toEqual(['bills']);
  expect(copy.players.get('right')?.unlockedPowers).toHaveLength(0);
});

it('sincroniza a variante ativa, a escolhida para o próximo ciclo e as tropas variantes', () => {
  const game = createGame();
  const factory = game.players.left.buildings[0];
  factory.level = 10;
  factory.productionTier = 2;
  factory.activeTier = 1;
  factory.populationReserved = true;
  spawnUnit(game, 'left', 'front', 10, true, undefined, 1);
  const state = new MatchState(),
    copy = new MatchState();
  syncState(state, game);
  const encoder = new Encoder(state);
  new Decoder(copy).decode(encoder.encodeAll());
  expect(copy.players.get('left')?.buildings[0]).toMatchObject({
    productionTier: 2,
    activeTier: 1,
  });
  expect(copy.units[0].productionTier).toBe(1);
});

it('sincroniza as baixas de trabalhadores e o efeito da sabotagem', () => {
  const game = createGame();
  game.players.right.workers = 6;
  game.powers.push({ id: 2, time: 0, kind: 'sabotage', side: 'left', workerLoss: 4, targets: [] });
  const state = new MatchState();
  syncState(state, game);
  const copy = new MatchState();
  new Decoder(copy).decode(new Encoder(state).encodeAll());
  expect(copy.players.get('right')?.workers).toBe(6);
  expect(copy.powers[0].workerLoss).toBe(4);
});
