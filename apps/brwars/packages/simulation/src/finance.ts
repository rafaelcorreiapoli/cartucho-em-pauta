import { employment } from './employment';
import { type Side } from './content';
import type { Command, GameState, Player } from './model';
import { clampPopularity, popularityCrisis, popularityRate, taxPopularityRate } from './popularity';
import { researchLevel } from './research-effects';
export const TAX_RULES = { min: 0, max: 30, step: 0.5, defaultRate: 10 } as const;
export function taxEffects(player: Player) {
  const rate = player.taxRate ?? TAX_RULES.defaultRate;
  return { income: rate / 10, production: 1, popularity: taxPopularityRate(player) };
}
export const LOAN_OFFERS = {
  bridge: { name: 'Ponte', principal: 200, rate: 0.12, duration: 30 },
  standard: { name: 'Capital de giro', principal: 300, rate: 0.2, duration: 60 },
  expansion: { name: 'Expansão', principal: 600, rate: 0.3, duration: 90 },
} as const;
export const INVESTMENT_OFFERS = {
  reserve: { name: 'Reserva', principal: 150, rate: 0.03, duration: 30 },
  treasury: { name: 'Renda fixa', principal: 300, rate: 0.06, duration: 60 },
  development: { name: 'Longo prazo', principal: 600, rate: 0.1, duration: 90 },
} as const;
export type LoanProduct = keyof typeof LOAN_OFFERS;
export type InvestmentProduct = keyof typeof INVESTMENT_OFFERS;
export interface LoanContract {
  id: number;
  product: LoanProduct;
  principal: number;
  total: number;
  remaining: number;
  duration: number;
  elapsed: number;
  rate: number;
}
export interface InvestmentContract {
  id: number;
  product: InvestmentProduct;
  principal: number;
  total: number;
  duration: number;
  elapsed: number;
}
export const FINANCE_CONTRACT_LIMIT = 6;
const cents = (amount: number) => Math.round(amount * 100) / 100;
export function bankLevel(player: Player) {
  return player.buildings.some(
    (building) => building.kind === 'bank' && (building.constructionProgress ?? 1) >= 1,
  )
    ? 1
    : 0;
}
export function sustainableIncome(player: Player) {
  return 8 + employment(player).employed * 3 * (1 + 0.1 * researchLevel(player, 'productivity'));
}
export function financeScale(player: Player) {
  return Math.max(1, Math.floor(sustainableIncome(player) / 25));
}
export function investmentQuote(player: Player, product: InvestmentProduct) {
  const offer = INVESTMENT_OFFERS[product];
  return { ...offer, principal: offer.principal * financeScale(player) };
}
export function workerIncome(player: Player) {
  return (
    3 *
    (1 + 0.1 * researchLevel(player, 'productivity')) *
    taxEffects(player).income *
    popularityCrisis(player).workerProductivity
  );
}
export function grossIncome(player: Player) {
  return 8 + employment(player).employed * workerIncome(player);
}
export function productionFactor(player: Player) {
  return popularityCrisis(player).production;
}
export function totalDebt(player: Player) {
  return (player.loans ?? []).reduce((sum, loan) => sum + loan.remaining, 0);
}
export function investedPrincipal(player: Player) {
  return (player.investments ?? []).reduce((sum, item) => sum + item.principal, 0);
}
// Sustainable, untaxed income determines credit, so a tax toggle cannot inflate it.
export function creditLimit(player: Player) {
  return sustainableIncome(player) * 40;
}
export function loanArrears(loan: LoanContract) {
  return Math.max(
    0,
    loan.total * Math.min(1, loan.elapsed / loan.duration) - (loan.total - loan.remaining),
  );
}
export function debtService(player: Player) {
  return (player.loans ?? []).reduce(
    (sum, loan) => sum + Math.min(loan.remaining, loan.total / loan.duration),
    0,
  );
}
export function payoffCost(loan: LoanContract) {
  return cents(
    Math.max(
      0,
      loan.remaining -
        (loan.total - loan.principal) * Math.max(0, 1 - loan.elapsed / loan.duration),
    ),
  );
}
export function loanQuote(player: Player, product: LoanProduct) {
  const offer = LOAN_OFFERS[product],
    exposure = totalDebt(player) / creditLimit(player),
    rate = offer.rate + (exposure >= 0.8 ? 0.1 : exposure >= 0.5 ? 0.05 : 0);
  const principal = offer.principal * financeScale(player);
  return { ...offer, principal, rate, total: cents(principal * (1 + rate)) };
}
export type FinanceCommand = Extract<
  Command,
  { type: 'loan' | 'invest' | 'repay' | 'redeem' | 'tax' }
>;
export function executeFinance(
  game: GameState,
  side: Side,
  command: Record<string, unknown>,
): string | null {
  const p = game.players[side];
  normalizeFinance(game, p);
  if (command.type === 'tax') {
    if (
      command.delta !== undefined &&
      (command.rate !== undefined ||
        (command.delta !== TAX_RULES.step && command.delta !== -TAX_RULES.step))
    )
      return 'Imposto inválido.';
    const rate =
      command.delta !== undefined
        ? Math.max(
            TAX_RULES.min,
            Math.min(
              TAX_RULES.max,
              (p.taxRate ?? TAX_RULES.defaultRate) + (command.delta as number),
            ),
          )
        : command.rate;
    if (
      typeof rate !== 'number' ||
      !Number.isFinite(rate) ||
      rate < TAX_RULES.min ||
      rate > TAX_RULES.max ||
      !Number.isInteger(rate / TAX_RULES.step)
    )
      return 'Imposto inválido. Use passos de 0,5% entre 0% e 30%.';
    p.taxRate = rate;
    return null;
  }
  if (command.type === 'repay') {
    const loan = p.loans.find((item) => item.id === command.id);
    if (!loan) return 'Empréstimo não encontrado.';
    const cost = payoffCost(loan);
    if (p.cash < cost) return 'R$ insuficientes para quitar.';
    p.cash -= cost;
    p.loans = p.loans.filter((item) => item.id !== loan.id);
    return null;
  }
  if (command.type === 'redeem') {
    const investment = p.investments.find((item) => item.id === command.id);
    if (!investment) return 'Aplicação não encontrada.';
    p.cash += investment.principal;
    p.investments = p.investments.filter((item) => item.id !== investment.id);
    return null;
  }
  if (!bankLevel(p)) return 'Construa um Banco e aguarde a conclusão da obra.';
  if (command.type === 'loan') {
    const product = command.product ?? 'standard';
    if (typeof product !== 'string' || !Object.hasOwn(LOAN_OFFERS, product))
      return 'Empréstimo inválido.';
    if (p.loans.length >= FINANCE_CONTRACT_LIMIT) return 'Limite de 6 empréstimos ativos.';
    if (p.loans.some((loan) => loanArrears(loan) > 0.01))
      return 'Regularize as parcelas em atraso antes de contratar novo crédito.';
    const quote = loanQuote(p, product as LoanProduct);
    if (totalDebt(p) + quote.total > creditLimit(p) + 1e-8)
      return 'Limite de crédito insuficiente. Amplie a renda sustentável.';
    p.cash += quote.principal;
    p.loans.push({
      id: game.nextId++,
      product: product as LoanProduct,
      principal: quote.principal,
      total: quote.total,
      remaining: quote.total,
      rate: quote.rate,
      duration: quote.duration,
      elapsed: 0,
    });
    return null;
  }
  const product = command.product ?? 'treasury';
  if (typeof product !== 'string' || !Object.hasOwn(INVESTMENT_OFFERS, product))
    return 'Aplicação inválida.';
  if (p.investments.length >= FINANCE_CONTRACT_LIMIT) return 'Limite de 6 aplicações ativas.';
  const offer = investmentQuote(p, product as InvestmentProduct);
  if (p.cash < offer.principal) return 'R$ insuficientes.';
  p.cash -= offer.principal;
  p.investments.push({
    id: game.nextId++,
    product: product as InvestmentProduct,
    principal: offer.principal,
    total: cents(offer.principal * (1 + offer.rate)),
    duration: offer.duration,
    elapsed: 0,
  });
  return null;
}
export function normalizeFinance(game: GameState, p: Player) {
  // Preserve an already-running local match through the schema upgrade.
  const old = p as unknown as {
    debt?: number;
    savings?: number;
    savingsTime?: number;
    taxPolicy?: string;
    taxCooldown?: number;
  };
  if (!p.loans) {
    p.loans = [];
    if ((old.debt ?? 0) > 0)
      p.loans.push({
        id: game.nextId++,
        product: 'standard',
        principal: 300,
        total: 360,
        remaining: old.debt!,
        duration: 60,
        elapsed: 60 - old.debt! / 6,
        rate: 0.2,
      });
  }
  if (!p.investments) {
    p.investments = [];
    if ((old.savings ?? 0) > 0)
      p.investments.push({
        id: game.nextId++,
        product: 'treasury',
        principal: 200,
        total: old.savings!,
        duration: 30,
        elapsed: 30 - (old.savingsTime ?? 30),
      });
  }
  p.taxRate ??=
    old.taxPolicy === 'low' ? 7.5 : old.taxPolicy === 'high' ? 12.5 : TAX_RULES.defaultRate;
  delete old.taxPolicy;
  delete old.taxCooldown;
  delete old.debt;
  delete old.savings;
  delete old.savingsTime;
}
export function stepFinance(game: GameState, p: Player, dt: number) {
  normalizeFinance(game, p);
  p.cash += grossIncome(p) * dt;
  p.popularity = clampPopularity(p.popularity + popularityRate(p) * dt);
  // Maturing investments become liquid before this tick's installments are paid.
  for (const investment of p.investments) {
    investment.elapsed = Math.min(investment.duration, investment.elapsed + dt);
    if (investment.elapsed + 1e-8 >= investment.duration) p.cash += investment.total;
  }
  p.investments = p.investments.filter(
    (investment) => investment.elapsed + 1e-8 < investment.duration,
  );
  for (const loan of p.loans) {
    loan.elapsed = Math.min(loan.duration, loan.elapsed + dt);
    const due = loanArrears(loan),
      payment = Math.min(Math.max(0, p.cash), due);
    p.cash -= payment;
    loan.remaining = Math.max(0, loan.remaining - payment);
  }
  p.loans = p.loans.filter((loan) => loan.remaining > 1e-6);
}
