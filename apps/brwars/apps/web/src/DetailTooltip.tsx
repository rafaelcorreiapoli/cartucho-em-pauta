import {
  BUILDINGS,
  PRODUCTION_TIERS,
  TIER_LEVEL,
  UNITS,
  type BuildingKind,
  type ProductionTier,
  type Side,
  type UnitKind,
} from '@brwars/simulation';
import { BuildingPortrait } from './hud/portraits';
import { HotkeyLabel } from './HotkeyLabel';
import {
  Briefcase,
  Clock,
  Coins,
  Factory,
  LockSimple,
  Star,
  UsersThree,
} from '@phosphor-icons/react';
import { UnitPortrait } from './UnitPortrait';

type ProductionPortrait = { kind: UnitKind; side: Side; name: string; tier?: ProductionTier };
export interface DetailTip {
  title: string;
  hotkey?: string;
  subtitle?: string;
  building?: { kind: BuildingKind; side: Side };
  stats: { label: string; value: string; icon?: keyof typeof icons }[];
  production?: ProductionPortrait[];
  requirements?: { kind: BuildingKind; side: Side; name: string; met: boolean }[];
  footnote?: string;
}
export function detailAttributes(tip: DetailTip) {
  return { 'data-hud-tooltip': tip.title, 'data-hud-detail': JSON.stringify(tip) };
}
function isBuildingPortrait(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const { kind, side } = item as Record<string, unknown>;
  return (
    typeof kind === 'string' &&
    Object.hasOwn(BUILDINGS, kind) &&
    (side === 'left' || side === 'right')
  );
}
export function readDetailTip(element: Pick<HTMLElement, 'dataset'>): DetailTip | undefined {
  try {
    const tip = JSON.parse(element.dataset.hudDetail ?? 'null');
    if (
      tip &&
      typeof tip.title === 'string' &&
      (tip.hotkey === undefined || typeof tip.hotkey === 'string') &&
      (tip.subtitle === undefined || typeof tip.subtitle === 'string') &&
      (tip.building === undefined || isBuildingPortrait(tip.building)) &&
      (tip.production === undefined ||
        (Array.isArray(tip.production) &&
          tip.production.every(
            (item: ProductionPortrait) =>
              item &&
              typeof item.name === 'string' &&
              (item.side === 'left' || item.side === 'right') &&
              Object.hasOwn(UNITS, item.kind) &&
              (item.tier === undefined || PRODUCTION_TIERS.includes(item.tier)),
          ))) &&
      (tip.footnote === undefined || typeof tip.footnote === 'string') &&
      (tip.requirements === undefined ||
        (Array.isArray(tip.requirements) &&
          tip.requirements.every(
            (item: Record<string, unknown>) =>
              isBuildingPortrait(item) &&
              typeof item.name === 'string' &&
              typeof item.met === 'boolean',
          ))) &&
      Array.isArray(tip.stats) &&
      tip.stats.every((stat: unknown) => {
        if (!stat || typeof stat !== 'object') return false;
        const item = stat as Record<string, unknown>;
        return (
          typeof item.label === 'string' &&
          typeof item.value === 'string' &&
          (item.icon === undefined ||
            (typeof item.icon === 'string' && Object.hasOwn(icons, item.icon)))
        );
      })
    )
      return tip;
  } catch {}
  return undefined;
}
const icons = {
  clock: Clock,
  coins: Coins,
  population: UsersThree,
  star: Star,
  jobs: Briefcase,
  factory: Factory,
};
export function DetailTooltip({ tip }: { tip: DetailTip }) {
  return (
    <div className={`detail-tip${tip.building ? ' detail-tip-construction' : ''}`}>
      {tip.building ? (
        <header className="detail-tip-building">
          <BuildingPortrait {...tip.building} />
          <div>
            <strong>
              <HotkeyLabel label={tip.title} hotkey={tip.hotkey} />
            </strong>
            {tip.subtitle && <small>{tip.subtitle}</small>}
          </div>
        </header>
      ) : (
        <>
          <strong>
            <HotkeyLabel label={tip.title} hotkey={tip.hotkey} />
          </strong>
          {tip.subtitle && <small>{tip.subtitle}</small>}
        </>
      )}
      <div className="detail-tip-stats">
        {tip.stats.map((stat, index) => {
          const Icon = stat.icon ? icons[stat.icon] : undefined;
          return (
            <section key={index}>
              <small>{stat.label}</small>
              <b>
                {Icon && <Icon />}
                {stat.value}
              </b>
            </section>
          );
        })}
      </div>
      {tip.production?.length ? (
        <section className="detail-tip-production">
          <small>
            <Factory /> Produz
          </small>
          <div className="detail-tip-units">
            {tip.production.map(({ kind, side, name, tier }) => (
              <div key={`${kind}-${tier ?? 0}`} className="detail-tip-unit">
                <div>
                  <UnitPortrait kind={kind} side={side} tier={tier} />
                  {tier !== undefined && <b>NV. {TIER_LEVEL[tier]}</b>}
                </div>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {tip.requirements?.length ? (
        <section className="detail-tip-requirements-section">
          <small>{tip.building && <LockSimple />} Requisitos</small>
          <div className="detail-tip-requirements" role="group" aria-label="Requisitos">
            {tip.requirements.map((requirement) => (
              <div key={requirement.kind} className="detail-tip-requirement">
                <div
                  className="requirement-portrait"
                  data-met={requirement.met}
                  title={requirement.name}
                  aria-label={`${requirement.name}${requirement.met ? '' : ' — falta construir'}`}
                >
                  <BuildingPortrait kind={requirement.kind} side={requirement.side} />
                </div>
                {tip.building && <span>{requirement.name}</span>}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {tip.footnote && <p>{tip.footnote}</p>}
    </div>
  );
}
