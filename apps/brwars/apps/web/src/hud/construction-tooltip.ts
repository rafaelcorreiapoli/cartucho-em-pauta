import {
  BUILDINGS,
  BUILDING_HOTKEYS,
  BUILDING_REQUIREMENTS,
  FACTIONS,
  PRODUCTION_TIERS,
  buildingJobCapacity,
  housingCapacity,
  logisticsMultiplier,
  nextPopularityBuildingRate,
  troopName,
  type Building,
  type BuildingKind,
  type Player,
  type Side,
} from '@brwars/simulation';
import type { DetailTip } from '../DetailTooltip';
import { money } from './format';

const constructionDescriptions = {
  housing: 'Amplia a população disponível para trabalhadores e tropas.',
  workplace: 'Abre vagas permanentes. Trabalhadores empregados geram renda.',
  barracks: 'Treina tropas resistentes para a linha de frente.',
  media: 'Treina tropas que atacam de longe.',
  garage: 'Fabrica unidades de cerco, eficazes contra bases.',
  bank: 'Libera crédito e aplicações. As ofertas crescem com a renda.',
  civic: 'Organiza eventos pagos para ganhar popularidade.',
  park: 'Aumenta a popularidade do governo continuamente.',
  school: 'Pesquisa formação profissional, mobilidade e obras mais rápidas.',
  depot: 'Acelera a produção automática de tropas.',
  hospital: 'Treina médicos que curam aliados e revive heróis.',
  academy: 'Pesquisa táticas, defesas e melhorias para poderes globais.',
} satisfies Record<BuildingKind, string>;

function formatGain(amount: number, digits: number) {
  return amount < 10 ** -digits
    ? `< ${(10 ** -digits).toLocaleString('pt-BR')}`
    : `+${amount.toLocaleString('pt-BR', { maximumFractionDigits: digits })}`;
}

export function constructionTooltip(
  kind: BuildingKind,
  side: Side,
  player: Player,
  seconds: number,
  missing: readonly BuildingKind[],
): DetailTip {
  const spec = BUILDINGS[kind];
  const building: Building = {
    kind,
    slot: 0,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  };
  const stats: DetailTip['stats'] = [
    { label: 'Custo', value: money(spec.cost), icon: 'coins' },
    { label: 'Obra', value: `${seconds}s`, icon: 'clock' },
  ];
  const jobs = buildingJobCapacity(building);
  if (jobs > 0)
    stats.push({
      label: kind === 'workplace' ? 'Vagas permanentes' : 'Vagas em atividade',
      value: `+${jobs}`,
      icon: 'jobs',
    });
  if (kind === 'housing')
    stats.push({
      label: 'Limite populacional',
      value: `+${housingCapacity(building)}`,
      icon: 'population',
    });
  if (kind === 'depot') {
    const bonus = Math.round(
      100 *
        (logisticsMultiplier({ ...player, buildings: [...player.buildings, building] }) -
          logisticsMultiplier(player)),
    );
    stats.push({ label: 'Bônus adicional', value: `+${bonus}%`, icon: 'factory' });
  }
  const rate = nextPopularityBuildingRate(player, kind);
  if (spec.popularityRate) {
    stats.push(
      {
        label: 'POP na inauguração',
        value: formatGain((spec.popularityYield * rate) / spec.popularityRate, 2),
        icon: 'star',
      },
      { label: 'POP por segundo', value: formatGain(rate, 3), icon: 'star' },
    );
  }
  const unit = spec.unit;
  const production = unit
    ? PRODUCTION_TIERS.map((tier) => ({
        side,
        kind: unit,
        name: troopName(side, unit, tier),
        tier,
      }))
    : kind === 'hospital'
      ? [{ side, kind: 'medic' as const, name: troopName(side, 'medic') }]
      : undefined;
  return {
    title: FACTIONS[side].buildings[kind],
    hotkey: BUILDING_HOTKEYS[side][kind],
    building: { kind, side },
    subtitle: constructionDescriptions[kind],
    stats,
    production,
    requirements: (BUILDING_REQUIREMENTS[kind] ?? []).map((required) => ({
      kind: required,
      side,
      name: FACTIONS[side].buildings[required],
      met: !missing.includes(required),
    })),
    footnote: spec.popularityRate ? 'Prédios do mesmo tipo rendem menos POP.' : undefined,
  };
}
