import {
  FACTIONS,
  HEROES,
  POPULATION_COST,
  productionFactor,
  trainingCost,
  trainingDuration,
  UNIT_PRODUCTION_COST,
  unitTrainingMultiplier,
  troopName,
  troopPopulation,
  type ProductionTier,
  type HeroKind,
  type Player,
  type Side,
  type UnitKind,
} from '@brwars/simulation';
import { detailAttributes } from './DetailTooltip';
import { UnitPortrait } from './UnitPortrait';
export function ProductionReadout({
  side,
  kind,
  hero,
  tier,
  progress,
  duration,
  queue,
  label,
  cost,
  queueSpeeds,
  speed = 1,
  waiting = false,
  paused = false,
  blockers = [],
}: {
  side: Side;
  kind: UnitKind | 'worker';
  hero?: HeroKind;
  tier?: ProductionTier;
  progress: number;
  duration: number;
  queue?: Player['trainingQueue'];
  label?: string;
  cost?: number;
  queueSpeeds?: Record<'hero' | 'worker' | 'medic', number>;
  speed?: number;
  waiting?: boolean;
  paused?: boolean;
  blockers?: ('cash' | 'population')[];
}) {
  const name = hero
    ? HEROES[hero].name
    : kind === 'worker'
      ? FACTIONS[side].worker
      : troopName(side, kind, tier);
  const percent = Math.max(0, Math.min(100, (progress / duration) * 100));
  const status =
    paused && waiting
      ? 'Produção pausada'
      : waiting
        ? `Aguardando ${blockers.length ? blockers.map((reason) => (reason === 'cash' ? 'R$' : 'população')).join(' e ') : 'população'}`
        : paused
          ? 'Pausa após este pedido'
          : label === 'RECUPERAÇÃO NO HOSPITAL'
            ? 'Recuperação no Hospital'
            : 'Em produção';
  const details = detailAttributes({
    title: name,
    subtitle: status,
    stats: [
      {
        label: 'TEMPO RESTANTE',
        value: `${Math.ceil(Math.max(0, duration - progress) / speed)}s`,
        icon: 'clock',
      },
      {
        label: 'CUSTO',
        value: `R$ ${cost ?? (kind === 'hero' && hero ? HEROES[hero].cost : UNIT_PRODUCTION_COST[kind])}`,
        icon: 'coins',
      },
      {
        label: 'POPULAÇÃO',
        value: String(kind === 'worker' ? POPULATION_COST.worker : troopPopulation(kind, tier)),
        icon: 'population',
      },
    ],
  });
  return (
    <div className="production-readout" tabIndex={0} {...details}>
      <div className="production-portrait">
        <UnitPortrait side={side} kind={kind} hero={hero} tier={tier} />
      </div>
      <div className="production-info">
        <strong>{name}</strong>
        {(waiting || paused) && <i className="production-status-dot" aria-label={status} />}
        <div
          className="production-progress"
          role="progressbar"
          aria-label={`Produção de ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(percent)}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        {queue && (
          <div className="training-queue" aria-label="Fila de produção">
            {queue.map((order, index) => {
              const orderName =
                order.kind === 'worker'
                  ? FACTIONS[side].worker
                  : order.kind === 'medic'
                    ? FACTIONS[side].units.medic
                    : HEROES[order.hero ?? (side === 'left' ? 'jones' : 'mamaefalei')].name;
              return (
                <div
                  key={index}
                  tabIndex={0}
                  {...detailAttributes({
                    title: orderName,
                    subtitle: index === 0 ? status : 'Na fila',
                    stats: [
                      {
                        label: index === 0 ? 'TEMPO RESTANTE' : 'TREINAMENTO',
                        value: `${Math.ceil((trainingDuration(order) - order.progress) / (queueSpeeds?.[order.kind] ?? speed))}s`,
                        icon: 'clock',
                      },
                      { label: 'CUSTO PAGO', value: `R$ ${trainingCost(order)}`, icon: 'coins' },
                      {
                        label: 'POPULAÇÃO',
                        value: String(POPULATION_COST[order.kind]),
                        icon: 'population',
                      },
                    ],
                  })}
                >
                  <UnitPortrait side={side} kind={order.kind} hero={order.hero} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export function BaseActivity({ player, side }: { player: Player; side: Side }) {
  const order = player.trainingQueue?.[0];
  return order ? (
    <ProductionReadout
      side={side}
      kind={order.kind}
      hero={order.hero}
      progress={order.progress}
      cost={trainingCost(order)}
      duration={trainingDuration(order)}
      queue={player.trainingQueue}
      queueSpeeds={{
        medic: productionFactor(player) * unitTrainingMultiplier(player, 'medic'),
        worker: productionFactor(player) * unitTrainingMultiplier(player, 'worker'),
        hero: productionFactor(player) * unitTrainingMultiplier(player, 'hero'),
      }}
      speed={productionFactor(player) * unitTrainingMultiplier(player, order.kind)}
      waiting={!order.populationReserved}
    />
  ) : (
    <div className="activity-idle">
      <strong>Aguardando pedido</strong>
      <small>Recrute um trabalhador ou herói no painel de ações.</small>
    </div>
  );
}
