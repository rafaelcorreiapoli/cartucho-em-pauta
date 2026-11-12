import {
  automaticProductionSpeed,
  currentProduction,
  logisticsMultiplier,
  baseWeaponStats,
  civicPopularityRate,
  constructionMultiplier,
  effectiveBuildingPopularityRate,
  heroIdentity,
  heroRecord,
  housingCapacity,
  isBuildingReady,
  isPopularityBuilding,
  isResearchBuilding,
  productionBlockers,
  productionFactor,
  unitTrainingMultiplier,
  workerCapacity,
  workerIncome,
  employment,
  buildingJobs,
  MEDIC,
  type GameState,
} from '@brwars/simulation';
import { Sword } from '@phosphor-icons/react';
import { BankSummary } from '../FinanceHUD';
import { HeroExperience } from '../HeroExperience';
import { BaseActivity, ProductionReadout } from '../ProductionReadout';
import { PromotionActivity } from '../PromotionHUD';
import { ResearchActivity } from '../ResearchHUD';
import { UnitEffects } from '../UnitEffects';
import { UnitStats } from '../UnitStats';
import type { SelectionContext } from './context';
import { money } from './format';
import { ConstructionReadout, HealthReadout } from './readouts';

export function SelectionDetails({
  game,
  context,
}: {
  game: GameState;
  context: SelectionContext;
}) {
  const { entity, owned } = context;
  const production =
    entity.kind === 'plot' && entity.building ? currentProduction(entity.building) : null;
  let detail;
  if (entity.kind === 'empty')
    detail = (
      <>
        <p>Clique em um terreno, prédio, base ou unidade.</p>
        <small>As informações e ações aparecem aqui conforme sua seleção.</small>
      </>
    );
  else if (entity.kind === 'hero') {
    const job = game.players[entity.side].heroRevivals?.find(
      (job) => job.hero === entity.record.hero,
    );
    detail = (
      <>
        {job ? (
          <ProductionReadout
            side={entity.side}
            kind="hero"
            hero={job.hero}
            progress={job.progress}
            duration={job.duration}
            speed={
              productionFactor(game.players[entity.side]) *
              unitTrainingMultiplier(game.players[entity.side], 'hero')
            }
            waiting={!job.populationReserved}
            label="RECUPERAÇÃO NO HOSPITAL"
            cost={job.cost}
          />
        ) : (
          <>
            <p>{entity.record.status === 'training' ? 'Em treinamento na base' : 'Herói morto'}</p>
            <small>Nível e experiência preservados. Recuperação em um Hospital disponível.</small>
          </>
        )}
        <HeroExperience record={entity.record} />
      </>
    );
  } else if (entity.kind === 'worker')
    detail = (
      <>
        <p>
          Trabalhador da base ·{' '}
          <b>
            +
            {money(
              entity.index < employment(game.players[entity.side]).employed
                ? workerIncome(game.players[entity.side])
                : 0,
            )}
            /s
          </b>
        </p>
        <small>
          Circula atrás da base e sustenta a economia. Não participa dos combates. Ocupa 1 de
          população.
        </small>
      </>
    );
  else if (entity.kind === 'unit') {
    detail = (
      <>
        <HealthReadout value={entity.unit.hp} max={entity.unit.maxHp} />
        <UnitStats game={game} unit={entity.unit} />
        <UnitEffects game={game} unit={entity.unit} />
        {entity.unit.kind === 'hero' && (
          <HeroExperience
            record={heroRecord(game.players[entity.side], heroIdentity(entity.unit))}
          />
        )}
      </>
    );
  } else if (entity.kind === 'base')
    detail = (
      <>
        <div className="base-weapon-stats">
          <Sword /> Ataque {baseWeaponStats(entity.player).damage} · Alcance{' '}
          {baseWeaponStats(entity.player).range} · N{entity.player.baseAttackLevel ?? 1}
        </div>
        <BaseActivity player={entity.player} side={entity.side} />
      </>
    );
  else if (entity.building && !isBuildingReady(entity.building))
    detail = (
      <>
        <ConstructionReadout
          building={entity.building}
          speed={constructionMultiplier(game.players[entity.side])}
        />
        <small>Ações e efeitos serão liberados ao concluir a obra.</small>
      </>
    );
  else if (entity.building && isResearchBuilding(entity.building.kind))
    detail = (
      <>
        <p>
          Popularidade:{' '}
          <b>
            +
            {effectiveBuildingPopularityRate(
              game.players[entity.side],
              entity.building,
            ).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
            /s
          </b>
        </p>
        <ResearchActivity player={game.players[entity.side]} slot={entity.slot} />
      </>
    );
  else if (entity.building?.kind === 'workplace')
    detail = (
      <p data-hud-tooltip="Cada vaga emprega um trabalhador. Sem trabalhadores disponíveis, vagas não geram renda. +4 vagas por nível adicional, disponíveis enquanto o prédio existir.">
        Empregos <b>+{buildingJobs(entity.building, game.players[entity.side])}</b> · Empregados{' '}
        <b>
          {employment(game.players[entity.side]).employed}/
          {employment(game.players[entity.side]).jobs}
        </b>
      </p>
    );
  else if (entity.building?.kind === 'bank')
    detail = <BankSummary player={game.players[entity.side]} />;
  else if (entity.building?.kind === 'housing')
    detail = (
      <>
        <p>
          Moradia para <b>+{housingCapacity(entity.building)} de população</b>.
        </p>
        <div className="selected-stats">
          <span>
            Capacidade total <b>{workerCapacity(game.players[entity.side])}</b>
          </span>
        </div>
        <small>
          6 vagas iniciais e +2 por nível adicional. Trabalhadores e exército compartilham essas
          vagas.
        </small>
      </>
    );
  else if (entity.building && isPopularityBuilding(entity.building.kind))
    detail = (
      <>
        <p>
          Popularidade:{' '}
          <b>
            +
            {effectiveBuildingPopularityRate(
              game.players[entity.side],
              entity.building,
            ).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
            /s
          </b>
        </p>
        <small>
          Geração-base: +
          {civicPopularityRate(entity.building).toLocaleString('pt-BR', {
            maximumFractionDigits: 3,
          })}
          /s. Cópias ativas do mesmo tipo: 100%, 35%, 12,25%…
        </small>
      </>
    );
  else if (entity.building?.kind === 'depot')
    detail = (
      <p>
        Velocidade das fábricas{' '}
        <b>+{Math.round((logisticsMultiplier(game.players[entity.side]) - 1) * 100)}%</b>
      </p>
    );
  else if (entity.building) detail = null;
  else
    detail = (
      <>
        <p>
          {owned
            ? 'Escolha ao lado a estrutura que deseja construir neste terreno.'
            : 'Área de construção da civilização inimiga.'}
        </p>
        <small>
          {owned
            ? 'A estrutura será construída exatamente nesta área selecionada.'
            : 'Você pode inspecionar, mas não construir neste território.'}
        </small>
      </>
    );

  if (
    entity.kind === 'plot' &&
    entity.building?.kind === 'hospital' &&
    isBuildingReady(entity.building)
  ) {
    const job = game.players[entity.side].heroRevivals?.find((job) => job.slot === entity.slot);
    const medic = entity.building.medicQueue?.[0];
    if (medic)
      detail = (
        <ProductionReadout
          side={entity.side}
          kind="medic"
          progress={medic.progress}
          duration={MEDIC.duration}
          queue={entity.building.medicQueue}
          cost={MEDIC.cost}
          speed={
            productionFactor(game.players[entity.side]) *
            unitTrainingMultiplier(game.players[entity.side], 'medic')
          }
          waiting={!medic.populationReserved}
        />
      );
    if (job)
      detail = (
        <ProductionReadout
          side={entity.side}
          kind="hero"
          hero={job.hero}
          progress={job.progress}
          duration={job.duration}
          speed={
            productionFactor(game.players[entity.side]) *
            unitTrainingMultiplier(game.players[entity.side], 'hero')
          }
          waiting={!job.populationReserved}
          label="RECUPERAÇÃO NO HOSPITAL"
          cost={job.cost}
        />
      );
  }
  if (entity.kind === 'plot' && entity.building && isBuildingReady(entity.building) && production)
    detail = (
      <ProductionReadout
        side={entity.side}
        kind={production.kind}
        tier={production.tier}
        cost={production.cost}
        progress={entity.building.progress}
        duration={production.duration}
        speed={automaticProductionSpeed(game.players[entity.side], production.kind)}
        waiting={!entity.building.populationReserved}
        blockers={productionBlockers(game, entity.side, entity.building)}
        paused={!!entity.building.autoPaused}
      />
    );
  if (entity.kind === 'plot' && entity.building?.promotionQueue?.length)
    detail = <PromotionActivity building={entity.building} player={game.players[entity.side]} />;

  return detail;
}
