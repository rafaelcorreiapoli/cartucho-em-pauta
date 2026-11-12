import { expect, it } from 'vitest';
import {
  buildingJobCapacity,
  createGame,
  employment,
  execute,
  grossIncome,
  creditLimit,
  step,
} from './index';
it('apenas trabalhadores empregados geram renda e lastro de crédito', () => {
  const p = createGame().players.left;
  p.buildings = [];
  p.workers = 6;
  const income = grossIncome(p),
    credit = creditLimit(p);
  p.workers = 10;
  expect(employment(p)).toEqual({ jobs: 6, employed: 6, unemployed: 4, vacancies: 0 });
  expect(grossIncome(p)).toBe(income);
  expect(creditLimit(p)).toBe(credit);
  p.workers = 2;
  expect(employment(p).vacancies).toBe(4);
  expect(grossIncome(p)).toBe(14);
});
it.each(['left', 'right'] as const)(
  '%s ganha empregos apenas após inauguração e perde ao demolir',
  (side) => {
    const g = createGame(),
      p = g.players[side];
    p.cash = 10000;
    p.buildings = [];
    p.workers = 20;
    expect(execute(g, side, { type: 'build', slot: 1, kind: 'workplace' })).toBeNull();
    expect(employment(p).jobs).toBe(6);
    for (let i = 0; i < 360; i++) step(g, 0.05);
    expect(employment(p).jobs).toBe(18);
    expect(employment(p).employed).toBe(18);
    const building = p.buildings[0];
    const cash = p.cash;
    expect(execute(g, side, { type: 'upgrade', slot: 1 })).toBeNull();
    expect(p.cash).toBe(cash - 160);
    expect(buildingJobCapacity(building)).toBe(12);
    for (let i = 0; i < 199; i++) step(g, 0.05);
    expect(buildingJobCapacity(building)).toBe(12);
    step(g, 0.05);
    expect(buildingJobCapacity(building)).toBe(16);
    expect(employment(p).jobs).toBe(22);
    expect(execute(g, side, { type: 'demolish', slot: 1 })).toBeNull();
    expect(employment(p).jobs).toBe(6);
    expect(p.workers).toBe(20);
  },
);
it('empregos marginais não substituem a construção especializada', () => {
  const building = {
    kind: 'school' as const,
    slot: 0,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  };
  expect(buildingJobCapacity(building)).toBe(1);
  expect(buildingJobCapacity({ ...building, kind: 'hospital' })).toBe(1);
  expect(buildingJobCapacity({ ...building, kind: 'barracks' })).toBe(0);
  expect(buildingJobCapacity({ ...building, kind: 'housing' })).toBe(0);
});

it('desemprego penaliza POP/s proporcionalmente, sem penalizar vagas ociosas', async () => {
  const { unemploymentRate, unemploymentPopularityRate, popularityRate } = await import('./index');
  const p = createGame().players.left;
  p.buildings = [];
  for (const [workers, rate, loss] of [
    [0, 0, 0],
    [3, 0, 0],
    [6, 0, 0],
    [8, 0.25, -0.75],
    [12, 0.5, -1.5],
  ]) {
    p.workers = workers;
    expect(unemploymentRate(p)).toBe(rate);
    expect(unemploymentPopularityRate(p)).toBeCloseTo(loss);
    expect(popularityRate(p)).toBeCloseTo(loss);
  }
});
it('novos empregos eliminam a penalidade e desemprego acumula com impostos', async () => {
  const { popularityRate } = await import('./index');
  const g = createGame(),
    p = g.players.left;
  p.buildings = [];
  p.workers = 12;
  p.taxRate = 20;
  expect(popularityRate(p)).toBe(-3);
  const previous = p.popularity;
  for (let i = 0; i < 20; i++) step(g, 0.05);
  expect(p.popularity).toBeCloseTo(previous - 3);
  p.buildings.push({
    kind: 'workplace',
    slot: 1,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  expect(popularityRate(p)).toBe(-1.5);
});

it('escola e universidade só oferecem vagas enquanto pesquisam naquele terreno', async () => {
  const { buildingJobs } = await import('./index');
  const p = createGame().players.left;
  const school = { ...p.buildings[0], kind: 'school' as const, slot: 1 };
  const academy = { ...school, kind: 'academy' as const, slot: 2 };
  p.buildings = [school, academy];
  expect(employment(p).jobs).toBe(6);
  p.researchJobs = [{ kind: 'mobility', slot: 1, level: 1, progress: 0, duration: 25 }];
  expect(buildingJobs(school, p)).toBe(1);
  expect(buildingJobs(academy, p)).toBe(0);
  expect(employment(p).jobs).toBe(7);
  p.researchJobs.push({ kind: 'siege', slot: 2, level: 1, progress: 0, duration: 25 });
  expect(employment(p).jobs).toBe(8);
  p.researchJobs = [];
  expect(employment(p).jobs).toBe(6);
  school.upgrading = true;
  expect(buildingJobs(school, p)).toBe(0);
});
it('serviços seguem eventos e recuperação ativa; moradia e obras não criam vagas', async () => {
  const { buildingJobs, isBuildingWorking } = await import('./index');
  const p = createGame().players.left;
  const civic = { ...p.buildings[0], kind: 'civic' as const };
  const hospital = { ...civic, kind: 'hospital' as const, slot: 1 };
  expect(buildingJobs(civic, p)).toBe(0);
  civic.promotionQueue = [{ kind: 'local', progress: 0 }];
  expect(buildingJobs(civic, p)).toBe(1);
  civic.promotionQueue = [];
  expect(buildingJobs(civic, p)).toBe(0);
  p.heroRevivals = [
    { hero: 'jones', slot: 1, progress: 0, duration: 8, cost: 240, populationReserved: false },
  ];
  expect(buildingJobs(hospital, p)).toBe(0);
  p.heroRevivals[0].populationReserved = true;
  expect(buildingJobs(hospital, p)).toBe(1);
  p.heroRevivals = [];
  expect(buildingJobs(hospital, p)).toBe(0);
  const producer = {
    ...civic,
    kind: 'barracks' as const,
    populationReserved: true,
    autoPaused: true,
  };
  expect(isBuildingWorking(producer, p)).toBe(true);
  producer.populationReserved = false;
  expect(isBuildingWorking(producer, p)).toBe(false);
  producer.autoPaused = false;
  expect(isBuildingWorking(producer, p)).toBe(false);
  expect(
    buildingJobs(
      { ...civic, constructionProgress: 0.9, promotionQueue: [{ kind: 'local', progress: 0 }] },
      p,
    ),
  ).toBe(0);
});
it('Startup mantém vagas pronta e o Banco só serve contratos em uma construção', async () => {
  const { buildingJobs } = await import('./index');
  const p = createGame().players.left;
  const bank = { ...p.buildings[0], kind: 'bank' as const, slot: 1 };
  const other = { ...bank, slot: 2, level: 2 };
  p.buildings = [bank, other];
  expect(buildingJobs(bank, p)).toBe(0);
  p.investments = [
    { id: 1, product: 'reserve', principal: 150, total: 154.5, duration: 30, elapsed: 0 },
  ];
  expect(buildingJobs(bank, p)).toBe(0);
  expect(buildingJobs(other, p)).toBe(1);
  expect(employment(p).jobs).toBe(7);
  p.investments = [];
  expect(employment(p).jobs).toBe(6);
  const workplace = { ...bank, kind: 'workplace' as const, level: 2, upgrading: true };
  expect(buildingJobs(workplace, p)).toBe(16);
  expect(buildingJobs({ ...workplace, constructionProgress: 0.5 }, p)).toBe(0);
});
