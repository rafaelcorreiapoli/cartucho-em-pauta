import { HotkeyLabel } from '../HotkeyLabel';
import { hotkeyAttributes } from '../command-hotkeys';
import {
  BUILDINGS,
  BUILDING_HOTKEYS,
  PLOT_COST,
  constructionMultiplier,
  missingBuildingRequirements,
  ownsPlot,
  type BuildingKind,
  type Command,
} from '@brwars/simulation';
import { Buildings, Coins, Hammer, LockSimple, Timer } from '@phosphor-icons/react';
import { ActionCategories } from './ActionCategories';
import type { SelectionContext } from './context';
import { money } from './format';
import { BuildingPortrait } from './portraits';
import { detailAttributes } from '../DetailTooltip';
import { constructionTooltip } from './construction-tooltip';

const CONSTRUCTION_CATEGORIES = [
  {
    id: 'basic',
    label: 'Básicas',
    Icon: Hammer,
    kinds: ['housing', 'workplace', 'barracks', 'media', 'bank', 'civic', 'school'],
  },
  {
    id: 'advanced',
    label: 'Avançadas',
    Icon: Buildings,
    kinds: ['park', 'garage', 'depot', 'hospital', 'academy'],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  Icon: typeof Hammer;
  kinds: readonly BuildingKind[];
}[];

export function ConstructionCommands({
  context,
  send,
}: {
  context: SelectionContext;
  send: (command: Command) => void;
}) {
  const { entity, selectedSide, faction, own, playing } = context;
  if (entity.kind !== 'plot' || entity.building) return null;
  if (!ownsPlot(own, entity.slot)) {
    return (
      <div className="command-grid plot-commands">
        <button
          className="command-button"
          data-low-cash={own.cash < PLOT_COST}
          data-resource-shortage={playing && own.cash < PLOT_COST}
          disabled={!playing || own.cash < PLOT_COST}
          {...hotkeyAttributes('a')}
          onClick={() => send({ type: 'buy-plot', slot: entity.slot })}
          data-hud-tooltip="Adquira este terreno para liberar o catálogo de construções. O prédio é pago separadamente."
        >
          <LockSimple size={28} />
          <strong>
            <HotkeyLabel label="Adquirir terreno" hotkey="a" />
          </strong>
          <small>Libera construções</small>
          <span>
            <Coins size={12} /> {money(PLOT_COST)}
          </span>
        </button>
      </div>
    );
  }

  const categories = CONSTRUCTION_CATEGORIES.map(({ id, label, Icon, kinds }) => ({
    id,
    label,
    portrait: <Icon className="construction-category-icon" weight="duotone" />,
    actions: kinds.map((kind) => {
      const spec = BUILDINGS[kind];
      const missing = missingBuildingRequirements(own, kind);
      const seconds = Math.ceil(spec.constructionTime / constructionMultiplier(own));
      return (
        <button
          key={kind}
          {...hotkeyAttributes(BUILDING_HOTKEYS[selectedSide][kind])}
          className={`command-button construction-card ${missing.length ? 'requirement-locked' : ''}`}
          data-low-cash={own.cash < spec.cost}
          data-resource-shortage={playing && missing.length === 0 && own.cash < spec.cost}
          disabled={!playing || own.cash < spec.cost || missing.length > 0}
          onClick={() => send({ type: 'build', kind, slot: entity.slot })}
          {...detailAttributes(constructionTooltip(kind, selectedSide, own, seconds, missing))}
        >
          <em className="construction-time">
            <Timer />
            {seconds}s
          </em>
          <BuildingPortrait kind={kind} side={selectedSide} />
          <strong>
            <HotkeyLabel
              label={faction.buildings[kind]}
              hotkey={BUILDING_HOTKEYS[selectedSide][kind]}
            />
          </strong>
          <span>
            <Coins size={12} />
            {spec.cost}
          </span>
        </button>
      );
    }),
  }));
  return <ActionCategories categories={categories} className="command-grid plot-commands" />;
}
