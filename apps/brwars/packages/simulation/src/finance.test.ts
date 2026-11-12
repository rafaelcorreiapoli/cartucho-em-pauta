import { describe, expect, it } from 'vitest';
import {
  createGame,
  creditLimit,
  execute,
  FINANCE_CONTRACT_LIMIT,
  grossIncome,
  INVESTMENT_OFFERS,
  LOAN_OFFERS,
  loanArrears,
  loanQuote,
  payoffCost,
  step,
} from './index';
const advance = (game: ReturnType<typeof createGame>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 20); i++) step(game, 0.05);
};
function setup() {
  const game = createGame();
  for (const p of Object.values(game.players)) p.buildings = [];
  game.players.left.buildings.push({
    kind: 'bank',
    slot: 0,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  return game;
}
describe('Banco e contratos', () => {
  it('exige Banco concluído e não permite manipular ofertas', () => {
    const game = createGame();
    expect(execute(game, 'left', { type: 'loan' })).toMatch(/Banco/);
    execute(game, 'left', { type: 'build', kind: 'bank', slot: 1 });
    expect(execute(game, 'left', { type: 'invest' })).toMatch(/Banco/);
    advance(game, 12);
    expect(execute(game, 'left', { type: 'loan', product: '__proto__' })).toMatch(/inválido/);
    const p = game.players.left,
      cash = p.cash;
    execute(game, 'left', { type: 'loan', product: 'bridge', principal: 100000, rate: 0 });
    expect(p.cash).toBe(cash + 200);
    expect(p.loans[0].total).toBe(224);
  });
  it('mantém dois empréstimos independentes e paga cada um exatamente uma vez', () => {
    const game = setup(),
      p = game.players.left;
    expect(execute(game, 'left', { type: 'loan', product: 'bridge' })).toBeNull();
    expect(execute(game, 'left', { type: 'loan', product: 'standard' })).toBeNull();
    expect(p.loans).toHaveLength(2);
    expect(p.loans[0].id).not.toBe(p.loans[1].id);
    advance(game, 30);
    expect(p.loans).toHaveLength(1);
    expect(p.loans[0].product).toBe('standard');
    advance(game, 30);
    expect(p.loans).toHaveLength(0);
    expect(p.cash).toBeCloseTo(600 + 500 + 60 * 17 - 224 - 360);
    advance(game, 1);
    expect(p.cash).toBeCloseTo(600 + 500 + 61 * 17 - 584);
  });
  it('aplicações têm prazos próprios e resgate antecipado perde somente o rendimento', () => {
    const game = setup(),
      p = game.players.left;
    p.cash = 1000;
    execute(game, 'left', { type: 'invest', product: 'reserve' });
    execute(game, 'left', { type: 'invest', product: 'treasury' });
    const id = p.investments[1].id;
    advance(game, 15);
    const cash = p.cash;
    expect(execute(game, 'left', { type: 'redeem', id })).toBeNull();
    expect(p.cash).toBe(cash + 300);
    expect(execute(game, 'left', { type: 'redeem', id })).toMatch(/não encontrada/);
    advance(game, 15);
    expect(p.investments).toHaveLength(0);
    expect(p.cash).toBeCloseTo(1000 - 150 + 30 * 17 + 154.5);
  });
  it('quitação economiza apenas juros futuros e não resgata dívida do adversário', () => {
    const game = setup(),
      p = game.players.left;
    execute(game, 'left', { type: 'loan', product: 'standard' });
    advance(game, 30);
    const loan = p.loans[0];
    expect(payoffCost(loan)).toBeCloseTo(150);
    const cash = p.cash;
    expect(execute(game, 'right', { type: 'repay', id: loan.id })).toMatch(/não encontrado/);
    execute(game, 'left', { type: 'repay', id: loan.id });
    expect(p.cash).toBeCloseTo(cash - 150);
    expect(p.loans).toHaveLength(0);
  });
  it('limita exposição e contratos; políticas não fabricam crédito nem alteram contratos existentes', () => {
    const game = setup(),
      p = game.players.left;
    const limit = creditLimit(p);
    execute(game, 'left', { type: 'tax', rate: 15 });
    expect(creditLimit(p)).toBe(limit);
    execute(game, 'left', { type: 'loan', product: 'standard' });
    const rate = p.loans[0].rate;
    expect(loanQuote(p, 'bridge').rate).toBeGreaterThan(LOAN_OFFERS.bridge.rate);
    expect(p.loans[0].rate).toBe(rate);
    expect(execute(game, 'left', { type: 'loan', product: 'expansion' })).toMatch(
      /crédito insuficiente/,
    );
    p.cash = 10000;
    for (let i = 0; i < FINANCE_CONTRACT_LIMIT; i++)
      execute(game, 'left', { type: 'invest', product: 'reserve' });
    expect(execute(game, 'left', { type: 'invest', product: 'reserve' })).toMatch(/Limite/);
  });
  it('déficit não cria caixa negativo; parcelas em atraso continuam sendo cobradas', () => {
    const game = setup(),
      p = game.players.left;
    p.workers = 48;
    p.buildings.push({
      kind: 'workplace',
      slot: 1,
      level: 12,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    });
    p.cash = 10000;
    for (let i = 0; i < 1; i++)
      expect(execute(game, 'left', { type: 'loan', product: 'expansion' })).toBeNull();
    p.workers = 0;
    p.cash = 0;
    advance(game, 10);
    expect(p.cash).toBeGreaterThanOrEqual(0);
    expect(p.loans.some((loan) => loanArrears(loan) > 1)).toBe(true);
    expect(execute(game, 'left', { type: 'loan', product: 'bridge' })).toMatch(/Limite|Regularize/);
    advance(game, 90);
    expect(p.loans.some((loan) => loan.elapsed === loan.duration && loan.remaining > 0)).toBe(true);
    p.cash = 10000;
    advance(game, 0.05);
    expect(p.loans).toHaveLength(0);
  });
  it('todos os empréstimos custam mais que aplicar o principal pelo mesmo horizonte', () => {
    for (const loan of Object.values(LOAN_OFFERS))
      for (const investment of Object.values(INVESTMENT_OFFERS))
        expect(Math.pow(1 + loan.rate, investment.duration / loan.duration)).toBeGreaterThan(
          1 + investment.rate,
        );
  });
});
describe('impostos', () => {
  it('aplica impostos contínuos sem cooldown e rejeita valores fora dos passos e limites', () => {
    const game = setup(),
      p = game.players.left;
    const normal = grossIncome(p);
    expect(execute(game, 'left', { type: 'tax', rate: 15 })).toBeNull();
    expect(grossIncome(p)).toBeGreaterThan(normal);
    execute(game, 'left', { type: 'worker' });
    advance(game, 4.95);
    expect(p.workers).toBe(3);
    advance(game, 0.05);
    expect(p.workers).toBe(4);
    expect(execute(game, 'left', { type: 'tax', rate: 7.5 })).toBeNull();
    expect(execute(game, 'left', { type: 'tax', rate: 8 })).toBeNull();
    expect(p.taxRate).toBe(8);
    for (const rate of [-0.5, 30.5, 7.25, NaN, Infinity, '10'])
      expect(execute(game, 'left', { type: 'tax', rate })).toMatch(/inválido/);
    const pop = p.popularity;
    advance(game, 1);
    expect(p.popularity).toBeGreaterThan(pop);
    expect(execute(game, 'left', { type: 'tax', rate: 0 })).toBeNull();
    expect(grossIncome(p)).toBe(8);
    expect(execute(game, 'left', { type: 'tax', rate: 30 })).toBeNull();
  });
  it('congela economia e vencimentos fora da partida em andamento', () => {
    const game = setup();
    execute(game, 'left', { type: 'loan', product: 'bridge' });
    game.status = 'waiting';
    const cash = game.players.left.cash;
    advance(game, 20);
    expect(game.players.left.cash).toBe(cash);
    expect(game.players.left.loans[0].elapsed).toBe(0);
  });
});

it('preserva dívidas e aplicações de uma partida local já iniciada na versão anterior', () => {
  const game = setup(),
    p = game.players.left;
  const legacy = p as unknown as Record<string, unknown>;
  delete legacy.loans;
  delete legacy.investments;
  legacy.debt = 180;
  legacy.savings = 230;
  legacy.savingsTime = 10;
  step(game, 0.05);
  expect(p.loans).toHaveLength(1);
  expect(p.loans[0].remaining).toBeCloseTo(179.7);
  expect(p.investments[0].total).toBe(230);
  expect(legacy.debt).toBeUndefined();
  step(game, 0.05);
  expect(p.loans).toHaveLength(1);
  expect(p.investments).toHaveLength(1);
});

it('ajustes relativos de 0,5% acumulam sem depender de snapshot do cliente e respeitam os limites', () => {
  const game = setup(),
    p = game.players.left;
  for (let i = 0; i < 3; i++) expect(execute(game, 'left', { type: 'tax', delta: 0.5 })).toBeNull();
  expect(p.taxRate).toBe(11.5);
  expect(execute(game, 'left', { type: 'tax', delta: -0.5 })).toBeNull();
  expect(p.taxRate).toBe(11);
  expect(execute(game, 'left', { type: 'tax', delta: 2 })).toMatch(/inválido/);
  execute(game, 'left', { type: 'tax', rate: 30 });
  execute(game, 'left', { type: 'tax', delta: 0.5 });
  expect(p.taxRate).toBe(30);
  execute(game, 'left', { type: 'tax', rate: 0 });
  execute(game, 'left', { type: 'tax', delta: -0.5 });
  expect(p.taxRate).toBe(0);
});
