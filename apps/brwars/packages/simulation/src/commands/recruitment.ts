import { startHospitalOrder } from '../engine/hospital';
import { isBuildingReady } from '../buildings';
import { BASE_QUEUE_LIMIT, WORKER_COST, type Side } from '../content';
import { startOrder } from '../engine/production';
import { MEDIC } from '../healing';
import { createHeroRecord, heroRecord, heroRevivalQuote } from '../hero-progression';
import { DEFAULT_HERO, HEROES, MAX_HEROES, heroRecruitmentCost, type HeroKind } from '../heroes';
import type { GameState } from '../model';
import { canStartProduction } from '../population';
import { heroAlive, heroCount, heroQueued, heroRecruitmentRequirements } from '../recruitment';

export function executeRecruitmentCommand(
  game: GameState,
  side: Side,
  command: Record<string, unknown>,
): string | null {
  const p = game.players[side];
  switch (command.type) {
    case 'worker':
      if (p.cash < WORKER_COST) return 'R$ insuficientes.';
      if (p.trainingQueue.length >= BASE_QUEUE_LIMIT) return 'Fila da base cheia.';
      p.cash -= WORKER_COST;
      p.trainingQueue.push({ kind: 'worker', progress: 0, cost: WORKER_COST });
      startOrder(game, side);
      return null;
    case 'medic': {
      const hospital = p.buildings.find(
        (b) => b.slot === command.slot && b.kind === 'hospital' && isBuildingReady(b),
      );
      if (!Number.isInteger(command.slot) || !hospital) return 'Selecione um Hospital concluído.';
      if (p.cash < MEDIC.cost) return 'R$ insuficientes.';
      if ((hospital.medicQueue?.length ?? 0) >= BASE_QUEUE_LIMIT) return 'Fila do Hospital cheia.';
      p.cash -= MEDIC.cost;
      (hospital.medicQueue ??= []).push({ kind: 'medic', cost: MEDIC.cost, progress: 0 });
      startHospitalOrder(game, side, hospital);
      return null;
    }
    case 'hero': {
      const candidate = command.hero ?? DEFAULT_HERO[side];
      if (typeof candidate !== 'string' || !Object.hasOwn(HEROES, candidate))
        return 'Herói inválido.';
      const hero = candidate as HeroKind,
        spec = HEROES[hero];
      if (spec.side !== side) return 'Este herói pertence à civilização adversária.';
      if (heroRecord(p, hero))
        return 'Herói indisponível: já adquirido. Se morreu, reviva no Hospital.';
      if (heroCount(game, side) >= MAX_HEROES)
        return 'Limite de três heróis adquiridos por jogador.';
      const requirements = heroRecruitmentRequirements(p, side);
      if (requirements.length) return `Requer ${requirements.join(' e ')} para recrutar heróis.`;
      const cost = heroRecruitmentCost(p, hero);
      if (p.cash < cost) return 'R$ insuficientes.';
      if (p.trainingQueue.length >= BASE_QUEUE_LIMIT) return 'Fila da base cheia.';
      p.cash -= cost;
      p.heroes.push(createHeroRecord(hero, 1, 'training'));
      p.trainingQueue.push({ kind: 'hero', hero, progress: 0, cost });
      startOrder(game, side);
      return null;
    }
    case 'hero-revive': {
      if (
        typeof command.hero !== 'string' ||
        !Object.hasOwn(HEROES, command.hero) ||
        !Number.isInteger(command.slot)
      )
        return 'Recuperação de herói inválida.';
      const hero = command.hero as HeroKind,
        record = heroRecord(p, hero);
      if (HEROES[hero].side !== side || !record) return 'Este herói não foi adquirido por você.';
      if (
        record.status !== 'dead' ||
        heroAlive(game, side, hero) ||
        heroQueued(p, hero, side) ||
        p.heroRevivals.some((job) => job.hero === hero)
      )
        return 'Herói indisponível para recuperação.';
      if (
        !p.buildings.some(
          (b) => b.kind === 'hospital' && b.slot === command.slot && isBuildingReady(b),
        )
      )
        return 'Selecione um Hospital concluído.';
      if (
        p.heroRevivals.some((job) => job.slot === command.slot) ||
        p.buildings.find((b) => b.slot === command.slot)?.medicQueue?.length
      )
        return 'O Hospital já está recuperando um herói.';
      const quote = heroRevivalQuote(p, hero);
      if (p.cash < quote.cost) return 'R$ insuficientes.';
      p.cash -= quote.cost;
      p.heroRevivals.push({
        hero,
        slot: command.slot as number,
        progress: 0,
        ...quote,
        populationReserved: canStartProduction(game, side, 'hero'),
      });
      record.status = 'reviving';
      return null;
    }
    default:
      return 'Comando desconhecido.';
  }
}
