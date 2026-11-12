import { ELECTION_COINS_PER_ENERGY, type Run } from "./game";
import { glyph } from "./icons";
import { itemTooltip } from "./item-tooltip";

type Status = {
  icon: keyof typeof glyph;
  name: string;
  description: string;
  value?: string | number;
  debuff?: boolean;
};

function guardStatus(guard: number): Status {
  return { icon: "guard", name: "Guarda", value: guard, description: "Absorve dano antes de perder Moral." };
}

function strengthStatus(strength: number, temporary = 0): Status {
  return {
    icon: "strength", name: "Força", value: strength,
    description: `+${strength} de dano por golpe.${temporary ? ` ${temporary} de Força expira ao encerrar o turno.` : ""}`,
  };
}

function attackPenalty(amount: number, conditional: boolean, awaitingAttacker = false): Status {
  return {
    icon: "attack", name: "Ataque reduzido", value: `−${amount}${conditional ? "?" : ""}`, debuff: !awaitingAttacker,
    description: awaitingAttacker
      ? `O próximo ataque inimigo perde ${amount} de dano. A redução aguarda um rival atacar.`
      : conditional
        ? `Se este rival fizer o próximo ataque inimigo, ele causa ${amount} a menos de dano.`
        : `O próximo ataque deste rival causa ${amount} a menos de dano.`,
  };
}

export function heroStatuses(run: Run, awaitingAttacker: boolean) {
  const effects = run.rightEffects;
  const statuses: Status[] = [];
  if (run.guard) statuses.push(guardStatus(run.guard));
  if (run.strength + run.turnStrength) statuses.push(strengthStatus(run.strength + run.turnStrength, run.turnStrength));
  if (run.nextEnergy) statuses.push({ icon: "energy", name: "Energia reservada", value: `+${run.nextEnergy}`, description: "Energia extra no início do próximo turno." });
  if (run.retainGuard) statuses.push({ icon: "guard", name: "Guarda retida", value: run.retainGuard, description: "Limite de Guarda restante que passa para o próximo turno." });
  if (run.strengthByUpcomingTurn.length) statuses.push({
    icon: "strength", name: "Força crescente", value: `+${run.strengthByUpcomingTurn[0]}`,
    description: `Força nos próximos turnos, em ordem: ${run.strengthByUpcomingTurn.map(amount => `+${amount}`).join(", ")}.`,
  });
  if (effects.blockDebuff) statuses.push({ icon: "guard", name: "Proteção contra restrição", value: 1, description: "Bloqueia a próxima restrição de carta neste turno." });
  if (effects.repeatTactic) statuses.push({ icon: "draw", name: "Tática dobrada", value: "×2", description: "Repete o efeito da próxima Tática deste turno." });
  if (run.electionActive) statuses.push({ icon: "gold", name: "Ano de Eleição", description: `Cartas custam ${ELECTION_COINS_PER_ENERGY} moedas por ponto de Energia neste turno.` });
  if (run.firstCardLocked) statuses.push({ icon: "draw", name: "Primeira carta bloqueada", value: 1, description: "A primeira carta da mão está bloqueada neste turno.", debuff: true });
  if (run.lockedCardType) statuses.push({ icon: run.lockedCardType === "offensive" ? "attack" : "guard", name: "Restrição de cartas", description: `Cartas de ${run.lockedCardType === "offensive" ? "Ataque" : "Defesa"} estão bloqueadas neste turno.`, debuff: true });
  if (effects.nextMoralCost) statuses.push({ icon: "health", name: "Perda de Moral pendente", value: `−${effects.nextMoralCost}`, description: "Perde Moral no início do próximo turno.", debuff: true });
  if (effects.moralWithoutDamage && !effects.damagedRival && run.phase === "player") statuses.push({
    icon: "health", name: "Perda de Moral condicional", value: `−${effects.moralWithoutDamage}?`,
    description: "Perde Moral ao encerrar o turno se nenhum rival for ferido.", debuff: true,
  });
  if (awaitingAttacker) statuses.push(attackPenalty(effects.weakenAttack, false, true));
  return renderStatuses(statuses);
}

export function rivalStatuses(run: Run, rival: Run["rivals"][number], attackPenaltyTarget?: { conditional: boolean }) {
  const statuses: Status[] = [];
  if (rival.moral) {
    if (rival.guard) statuses.push(guardStatus(rival.guard));
    if (rival.bonus) statuses.push(strengthStatus(rival.bonus));
    if (attackPenaltyTarget) statuses.push(attackPenalty(run.rightEffects.weakenAttack, attackPenaltyTarget.conditional));
    const delayedDamage = run.rightEffects.delayed.reduce((total, hit) => total + (hit.id === rival.id ? hit.damage : 0), 0);
    if (delayedDamage) statuses.push({ icon: "health", name: "Dano pendente", value: `−${delayedDamage}`, description: "Recebe este dano no início do seu próximo turno. A Guarda pode absorvê-lo.", debuff: true });
  }
  return renderStatuses(statuses);
}

function renderStatuses(statuses: Status[]) {
  return `<div class="fighter-effects">${statuses.map((status) => `
    <button type="button" class="fighter-effect" data-action="item-details" data-icon="${status.icon}"
      data-debuff="${Boolean(status.debuff)}" aria-haspopup="dialog"
      aria-label="${status.name}${status.value === undefined ? "" : ` ${status.value}`}" ${itemTooltip(status)}>
      ${glyph[status.icon]}${status.value === undefined ? "" : `<b>${status.value}</b>`}
    </button>`).join("")}</div>`;
}
