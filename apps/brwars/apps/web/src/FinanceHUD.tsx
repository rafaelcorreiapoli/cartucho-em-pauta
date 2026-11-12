import { detailAttributes } from './DetailTooltip';
import { HotkeyLabel } from './HotkeyLabel';
import { assignHotkeys, hotkeyAttributes } from './command-hotkeys';
import { ActionCategories } from './hud/ActionCategories';
import {
  bankLevel,
  creditLimit,
  FINANCE_CONTRACT_LIMIT,
  investedPrincipal,
  INVESTMENT_OFFERS,
  investmentQuote,
  LOAN_OFFERS,
  loanArrears,
  loanQuote,
  payoffCost,
  popularityCrisis,
  TAX_RULES,
  taxEffects,
  totalDebt,
  type Command,
  type InvestmentProduct,
  type LoanProduct,
  type Player,
} from '@brwars/simulation';
import {
  Bank,
  ChartLineUp,
  Clock,
  Percent,
  Minus,
  Plus,
  Scales,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CommandPortrait } from './CommandPortrait';
import './finance.css';
const money = (value: number) =>
  `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}`;
const seconds = (duration: number, elapsed: number) =>
  `${Math.max(0, Math.ceil(duration - elapsed))}s`;
const remaining = (duration: number, elapsed: number) =>
  Math.max(0, Math.min(1, 1 - elapsed / duration));
export function TaxControl({
  player,
  playing,
  send,
}: {
  player: Player;
  playing: boolean;
  send: (command: Command) => void;
}) {
  const rate = player.taxRate ?? TAX_RULES.defaultRate,
    effects = taxEffects(player);
  return (
    <div
      className="tax-control"
      role="group"
      aria-label="Impostos"
      data-hud-tooltip={`Arrecadação por impostos: ${Math.round(effects.income * 100)}% da base. Produtividade dos trabalhadores: ${Math.round(popularityCrisis(player).workerProductivity * 100)}%. Produção atual por estabilidade: ${Math.round(popularityCrisis(player).production * 100)}%. Popularidade por impostos: ${effects.popularity >= 0 ? '+' : ''}${effects.popularity.toFixed(2)} por segundo.`}
    >
      <Scales />
      <div>
        <small>IMPOSTOS</small>
        <div className="tax-stepper">
          <button
            aria-label="Diminuir impostos em 0,5%"
            disabled={!playing || rate <= TAX_RULES.min}
            onClick={() => send({ type: 'tax', delta: -TAX_RULES.step })}
          >
            <Minus />
          </button>
          <output aria-label="Alíquota de impostos">
            {rate.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </output>
          <button
            aria-label="Aumentar impostos em 0,5%"
            disabled={!playing || rate >= TAX_RULES.max}
            onClick={() => send({ type: 'tax', delta: TAX_RULES.step })}
          >
            <Plus />
          </button>
        </div>
      </div>
    </div>
  );
}
export function FinanceHUD({
  player,
  playing,
  send,
  onBank,
}: {
  player: Player;
  playing: boolean;
  send: (command: Command) => void;
  onBank: () => void;
}) {
  const loans = player.loans ?? [],
    investments = player.investments ?? [];
  const [selected, setSelected] = useState<{
      type: 'loan' | 'investment';
      id: number;
      left: number;
      top: number;
    } | null>(null),
    popup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(event: PointerEvent) {
      if (
        popup.current &&
        !popup.current.contains(event.target as Node) &&
        !(event.target as Element).closest('.contract-chip')
      )
        setSelected(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelected(null);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  function inspect(event: MouseEvent<HTMLButtonElement>, type: 'loan' | 'investment', id: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    setSelected((previous) =>
      previous?.type === type && previous.id === id
        ? null
        : {
            type,
            id,
            left: Math.max(8, Math.min(window.innerWidth - 268, rect.left)),
            top: rect.bottom + 6,
          },
    );
  }
  const loan =
      selected?.type === 'loan' ? loans.find((item) => item.id === selected.id) : undefined,
    investment =
      selected?.type === 'investment'
        ? investments.find((item) => item.id === selected.id)
        : undefined;
  if (!loans.length && !investments.length) return null;
  return (
    <section className="finance-ribbon" aria-label="Economia e contratos ativos">
      <div className="contract-ledger">
        {loans.length > 0 && (
          <div
            className="contract-lane"
            aria-label="Dívidas ativas"
            onScroll={() => setSelected(null)}
          >
            <button
              className="ledger-label"
              onClick={onBank}
              data-hud-tooltip={`Banco · dívida total ${money(totalDebt(player))}`}
            >
              <Bank />
              <span>DÍVIDAS</span>
            </button>
            {loans.length ? (
              loans.map((item) => {
                const overdue = loanArrears(item) > 0.01;
                return (
                  <button
                    key={item.id}
                    className={`contract-chip loan ${overdue ? 'overdue' : ''}`}
                    aria-expanded={selected?.type === 'loan' && selected.id === item.id}
                    aria-label={`${LOAN_OFFERS[item.product].name}: menos ${money(Math.min(item.remaining, item.total / item.duration))} por segundo. ${seconds(item.duration, item.elapsed)} restantes${overdue ? '. Parcelas em atraso' : ''}`}
                    data-hud-tooltip={`${LOAN_OFFERS[item.product].name} · restam ${seconds(item.duration, item.elapsed)} · saldo ${money(item.remaining)}. Clique para detalhes e quitação.`}
                    onClick={(event) => inspect(event, 'loan', item.id)}
                  >
                    <CommandPortrait kind={item.product} />
                    <div>
                      <strong>
                        −{money(Math.min(item.remaining, item.total / item.duration))}
                        <small>/s</small>
                      </strong>
                      <span>{LOAN_OFFERS[item.product].name}</span>
                    </div>
                    {overdue && <WarningCircle className="contract-warning" />}
                    <i
                      role="progressbar"
                      aria-label="Prazo restante do empréstimo"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(remaining(item.duration, item.elapsed) * 100)}
                    >
                      <em style={{ width: `${remaining(item.duration, item.elapsed) * 100}%` }} />
                    </i>
                  </button>
                );
              })
            ) : (
              <button className="empty-contract" onClick={onBank}>
                <Plus />
                Contratar empréstimo
              </button>
            )}
          </div>
        )}
        {investments.length > 0 && (
          <div
            className="contract-lane"
            aria-label="Investimentos ativos"
            onScroll={() => setSelected(null)}
          >
            <button
              className="ledger-label"
              onClick={onBank}
              data-hud-tooltip={`Banco · principal aplicado ${money(investedPrincipal(player))}`}
            >
              <ChartLineUp />
              <span>APLICAÇÕES</span>
            </button>
            {investments.length ? (
              investments.map((item) => (
                <button
                  key={item.id}
                  className="contract-chip investment"
                  aria-expanded={selected?.type === 'investment' && selected.id === item.id}
                  aria-label={`${INVESTMENT_OFFERS[item.product].name}: rendimento equivalente a mais ${money((item.total - item.principal) / item.duration)} por segundo, pago no vencimento. ${seconds(item.duration, item.elapsed)} restantes`}
                  data-hud-tooltip={`${INVESTMENT_OFFERS[item.product].name} · rendimento acumulado, pago no vencimento · ${seconds(item.duration, item.elapsed)} restantes. Clique para detalhes e resgate.`}
                  onClick={(event) => inspect(event, 'investment', item.id)}
                >
                  <CommandPortrait kind={item.product} />
                  <div>
                    <strong>
                      +{money((item.total - item.principal) / item.duration)}
                      <small>/s</small>
                    </strong>
                    <span>{INVESTMENT_OFFERS[item.product].name}</span>
                  </div>
                  <i
                    role="progressbar"
                    aria-label="Prazo restante da aplicação"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(remaining(item.duration, item.elapsed) * 100)}
                  >
                    <em style={{ width: `${remaining(item.duration, item.elapsed) * 100}%` }} />
                  </i>
                </button>
              ))
            ) : (
              <button className="empty-contract" onClick={onBank}>
                <Plus />
                Fazer aplicação
              </button>
            )}
          </div>
        )}
      </div>
      {selected &&
        (loan || investment) &&
        createPortal(
          <div
            ref={popup}
            className="contract-popover"
            role="dialog"
            aria-label="Detalhes do contrato"
            style={{ left: selected.left, top: selected.top }}
          >
            <button
              className="contract-popover-close"
              aria-label="Fechar detalhes"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            {loan ? (
              <>
                <strong>{LOAN_OFFERS[loan.product].name}</strong>
                <span>Saldo: {money(loan.remaining)}</span>
                <span>
                  Recebido: {money(loan.principal)} · total: {money(loan.total)}
                </span>
                <span>Prazo restante: {seconds(loan.duration, loan.elapsed)}</span>
                {loanArrears(loan) > 0.01 && (
                  <span className="negative">Em atraso: {money(loanArrears(loan))}</span>
                )}
                <button
                  disabled={!playing || player.cash < payoffCost(loan)}
                  onClick={() => {
                    send({ type: 'repay', id: loan.id });
                    setSelected(null);
                  }}
                >
                  Quitar · {money(payoffCost(loan))}
                </button>
              </>
            ) : investment ? (
              <>
                <strong>{INVESTMENT_OFFERS[investment.product].name}</strong>
                <span>Aplicado: {money(investment.principal)}</span>
                <span className="positive">No vencimento: {money(investment.total)}</span>
                <span>Prazo restante: {seconds(investment.duration, investment.elapsed)}</span>
                <small>
                  O rendimento verde é equivalente por segundo; o crédito ocorre no vencimento.
                  Resgate antecipado devolve somente o principal.
                </small>
                <button
                  disabled={!playing}
                  onClick={() => {
                    send({ type: 'redeem', id: investment.id });
                    setSelected(null);
                  }}
                >
                  Resgatar principal · {money(investment.principal)}
                </button>
              </>
            ) : null}
          </div>,
          document.body,
        )}
    </section>
  );
}
export function BankSummary({ player }: { player: Player }) {
  return (
    <div className="bank-summary">
      <strong>
        Crédito disponível {money(Math.max(0, creditLimit(player) - totalDebt(player)))}
      </strong>
      <span>
        Limite {money(creditLimit(player))} · dívida {money(totalDebt(player))}
      </span>
      <span>
        {money(investedPrincipal(player))} aplicado · {player.loans?.length ?? 0}/6 empréstimos ·{' '}
        {player.investments?.length ?? 0}/6 aplicações
      </span>
      <small>Juros definidos pelo Banco. Contratos mantêm as condições até o vencimento.</small>
    </div>
  );
}
export function BankActions({
  player,
  playing,
  send,
  extra,
}: {
  player: Player;
  playing: boolean;
  send: (command: Command) => void;
  extra?: ReactNode;
}) {
  return (
    <ActionCategories
      className="bank-offers"
      categories={[
        {
          id: 'credit',
          label: 'Crédito',
          portrait: <CommandPortrait kind="bridge" />,
          actions: (Object.keys(LOAN_OFFERS) as LoanProduct[]).map((product, index) => {
            const offer = loanQuote(player, product),
              disabled =
                !playing ||
                !bankLevel(player) ||
                (player.loans?.length ?? 0) >= FINANCE_CONTRACT_LIMIT ||
                totalDebt(player) + offer.total > creditLimit(player) ||
                player.loans?.some((loan) => loanArrears(loan) > 0.01);
            return (
              <button
                className="finance-portrait-option"
                key={product}
                {...hotkeyAttributes(
                  assignHotkeys(
                    Object.values(LOAN_OFFERS).map((offer) => offer.name),
                    ['v'],
                  )[index],
                )}
                disabled={disabled}
                {...detailAttributes({
                  title: offer.name,
                  stats: [
                    { label: 'Recebe agora', value: money(offer.principal), icon: 'coins' },
                    { label: 'Total a pagar', value: money(offer.total), icon: 'coins' },
                    { label: 'Por segundo', value: `−${money(offer.total / offer.duration)}` },
                    { label: 'Prazo', value: `${offer.duration}s`, icon: 'clock' },
                    { label: 'Juros fixos', value: `${(offer.rate * 100).toFixed(0)}%` },
                  ],
                  footnote: 'Sujeito ao limite de crédito.',
                })}
                onClick={() => send({ type: 'loan', product })}
              >
                <CommandPortrait kind={product} />
                <strong>
                  <HotkeyLabel
                    label={offer.name}
                    hotkey={
                      assignHotkeys(
                        Object.values(LOAN_OFFERS).map((offer) => offer.name),
                        ['v'],
                      )[index]
                    }
                  />
                </strong>
                <em
                  className="recruitment-badge recruitment-time"
                  aria-label={`Prazo: ${offer.duration} segundos`}
                >
                  <Clock />
                  {offer.duration}s
                </em>
                <em
                  className="recruitment-badge recruitment-population"
                  aria-label={`Taxa: ${offer.rate * 100}%`}
                >
                  <Percent />
                  {(offer.rate * 100).toFixed(0)}
                </em>
                <span className="resource-price">+{money(offer.principal)}</span>
              </button>
            );
          }),
        },
        {
          id: 'investments',
          label: 'Aplicações',
          portrait: <CommandPortrait kind="treasury" />,
          actions: (Object.keys(INVESTMENT_OFFERS) as InvestmentProduct[]).map((product, index) => {
            const offer = investmentQuote(player, product);
            return (
              <button
                className="finance-portrait-option"
                key={product}
                {...hotkeyAttributes(
                  assignHotkeys(
                    Object.values(INVESTMENT_OFFERS).map((offer) => offer.name),
                    ['v'],
                  )[index],
                )}
                disabled={
                  !playing ||
                  player.cash < offer.principal ||
                  (player.investments?.length ?? 0) >= FINANCE_CONTRACT_LIMIT
                }
                onClick={() => send({ type: 'invest', product })}
                {...detailAttributes({
                  title: offer.name,
                  stats: [
                    { label: 'Aplicação', value: money(offer.principal), icon: 'coins' },
                    {
                      label: 'No vencimento',
                      value: money(offer.principal * (1 + offer.rate)),
                      icon: 'coins',
                    },
                    { label: 'Rendimento', value: `+${offer.rate * 100}%` },
                    { label: 'Prazo', value: `${offer.duration}s`, icon: 'clock' },
                  ],
                  footnote: 'Resgate antecipado devolve apenas o principal.',
                })}
              >
                <CommandPortrait kind={product} />
                <strong>
                  <HotkeyLabel
                    label={offer.name}
                    hotkey={
                      assignHotkeys(
                        Object.values(INVESTMENT_OFFERS).map((offer) => offer.name),
                        ['v'],
                      )[index]
                    }
                  />
                </strong>
                <em
                  className="recruitment-badge recruitment-time"
                  aria-label={`Prazo: ${offer.duration} segundos`}
                >
                  <Clock />
                  {offer.duration}s
                </em>
                <em
                  className="recruitment-badge recruitment-population"
                  aria-label={`Taxa: ${offer.rate * 100}%`}
                >
                  <Percent />
                  {(offer.rate * 100).toFixed(0)}
                </em>
                <span className="resource-price">−{money(offer.principal)}</span>
              </button>
            );
          }),
        },
      ]}
      extra={<>{extra}</>}
    />
  );
}
