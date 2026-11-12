import { expect, it } from 'vitest';
import {
  createGame,
  creditLimit,
  execute,
  financeScale,
  investmentQuote,
  loanQuote,
  type Building,
} from './index';
it('renda formal amplia limite e ofertas, sem depender de nível bancário, imposto ou caixa', () => {
  const p = createGame().players.left;
  p.buildings = [
    { kind: 'bank', slot: 0, level: 1, progress: 0, constructionProgress: 1, completedCycles: 0 },
  ];
  expect(financeScale(p)).toBe(1);
  expect(loanQuote(p, 'bridge').principal).toBe(200);
  for (let slot = 1; slot <= 3; slot++)
    p.buildings.push({ ...p.buildings[0], kind: 'workplace', slot } as Building);
  p.workers = 30;
  expect(creditLimit(p)).toBe(3920);
  expect(financeScale(p)).toBe(3);
  expect(loanQuote(p, 'bridge').principal).toBe(600);
  expect(investmentQuote(p, 'treasury').principal).toBe(900);
  p.cash = 1000000;
  p.taxRate = 30;
  p.buildings[0].level = 15;
  expect(creditLimit(p)).toBe(3920);
  expect(financeScale(p)).toBe(3);
  p.research = ['productivity', 'productivity', 'productivity'];
  expect(financeScale(p)).toBe(5);
  expect(creditLimit(p)).toBe(5000);
});
it('crescimento da economia não reprecifica contratos já assinados nem aceita valores forjados', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 10000;
  p.buildings = [
    { kind: 'bank', slot: 0, level: 1, progress: 0, constructionProgress: 1, completedCycles: 0 },
  ];
  expect(execute(g, 'left', { type: 'loan', product: 'bridge', principal: 999999 })).toBeNull();
  expect(execute(g, 'left', { type: 'invest', product: 'reserve', principal: 1 })).toBeNull();
  const loan = { ...p.loans[0] },
    investment = { ...p.investments[0] };
  for (let slot = 1; slot <= 3; slot++)
    p.buildings.push({ ...p.buildings[0], kind: 'workplace', slot });
  p.workers = 30;
  expect(loanQuote(p, 'bridge').principal).toBe(600);
  expect(investmentQuote(p, 'reserve').principal).toBe(450);
  expect(p.loans[0]).toEqual(loan);
  expect(p.investments[0]).toEqual(investment);
});
