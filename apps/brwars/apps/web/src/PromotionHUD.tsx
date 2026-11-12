import {
  BASE_QUEUE_LIMIT,
  POPULARITY_CAP,
  productionFactor,
  PROMOTION_OFFERS,
  type Building,
  type Command,
  type Player,
  type PromotionKind,
} from '@brwars/simulation';
import { Clock, Coins, Star } from '@phosphor-icons/react';
import { detailAttributes } from './DetailTooltip';
export function PromotionPortrait({ kind }: { kind: PromotionKind }) {
  return <img className="command-portrait-image" src={`/assets/promotion-${kind}.webp`} alt="" />;
}
export function PromotionActions({
  building,
  player,
  playing,
  send,
}: {
  building: Building;
  player: Player;
  playing: boolean;
  send: (command: Command) => void;
}) {
  const full = (building.promotionQueue?.length ?? 0) >= BASE_QUEUE_LIMIT;
  return (
    <>
      {(Object.keys(PROMOTION_OFFERS) as PromotionKind[]).map((kind) => {
        const offer = PROMOTION_OFFERS[kind],
          capped = player.popularity + offer.popularity > POPULARITY_CAP,
          blocked = !playing || full || capped;
        return (
          <button
            key={kind}
            className="command-button economy-command recruitment-card promotion-card"
            data-low-cash={player.cash < offer.cash}
            data-resource-shortage={!blocked && player.cash < offer.cash}
            disabled={blocked || player.cash < offer.cash}
            onClick={() => send({ type: 'promote', slot: building.slot, kind })}
            data-hud-tooltip={`${offer.name}\n+${offer.popularity} POP ao concluir. ${Math.ceil(offer.duration / productionFactor(player))}s · R$ ${offer.cash}. Fila de até ${BASE_QUEUE_LIMIT} eventos.\n${full ? 'Fila cheia' : capped ? 'Popularidade perto do limite' : 'Pago ao pedir; sem população. Crise reduz a velocidade.'}`}
          >
            <PromotionPortrait kind={kind} />
            <em className="recruitment-badge recruitment-time">
              <Clock />
              {Math.ceil(offer.duration / productionFactor(player))}s
            </em>
            <em className="recruitment-badge recruitment-population">
              <Star weight="fill" />+{offer.popularity} POP
            </em>
            <strong>{offer.name}</strong>
            <span>
              <Coins />
              R$ {offer.cash}
            </span>
          </button>
        );
      })}
    </>
  );
}
export function PromotionActivity({ building, player }: { building: Building; player: Player }) {
  const queue = building.promotionQueue ?? [],
    order = queue[0];
  if (!order) return null;
  const offer = PROMOTION_OFFERS[order.kind],
    percent = Math.min(100, (order.progress / offer.duration) * 100);
  return (
    <div
      className="production-readout"
      tabIndex={0}
      {...detailAttributes({
        title: offer.name,
        subtitle: 'Evento em preparação',
        stats: [
          {
            label: 'TEMPO RESTANTE',
            value: `${Math.ceil((offer.duration - order.progress) / productionFactor(player))}s`,
            icon: 'clock',
          },
          { label: 'AO CONCLUIR', value: `+${offer.popularity} POP`, icon: 'star' },
        ],
      })}
    >
      <div className="production-portrait">
        <PromotionPortrait kind={order.kind} />
      </div>
      <div className="production-info">
        <strong>{offer.name}</strong>
        <div
          className="production-progress"
          role="progressbar"
          aria-label={`Preparação de ${offer.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(percent)}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="training-queue" aria-label="Fila de eventos">
          {queue.map((item, index) => (
            <div
              key={index}
              data-hud-tooltip={`${PROMOTION_OFFERS[item.kind].name} · +${PROMOTION_OFFERS[item.kind].popularity} POP`}
            >
              <PromotionPortrait kind={item.kind} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
