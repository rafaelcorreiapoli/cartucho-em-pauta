import type { Intent } from "./catalog";
import { injunctionType } from "./game";
import { glyph } from "./icons";
import { itemTooltip } from "./item-tooltip";

export const intentLabels: Record<Intent["kind"], string> = {
  attack: "Ataque", guard: "Guarda", rally: "Força", stamp: "Bloqueio",
  counter: "Contra-ataque", predict: "Ação condicional", teamGuard: "Guarda em equipe",
  heal: "Cura", summon: "Reforço", doubleGuard: "Dobrar Guarda",
  injunction: "Liminar", jingle: "Força em equipe", research: "Pesquisa", wait: "Interrompido",
};

const icons = {
  attack: glyph.attack, guard: glyph.guard, rally: glyph.strength, stamp: glyph.draw,
  counter: glyph.attack, predict: glyph.attack, teamGuard: glyph.guard, heal: glyph.health,
  summon: glyph.rally, doubleGuard: glyph.guard, injunction: glyph.draw, jingle: glyph.strength,
  research: glyph.draw, wait: glyph.guard,
};

export function rivalIntentBadge(intent: Intent, step: number, predictedAttack: number, alive: boolean) {
  const { kind, value } = intent;
  const name = intent.label ?? intentLabels[kind];
  const predictedGuard = intent.guardValue ?? value;
  const descriptions = {
    attack: `Causa ${value} de dano no turno inimigo.`,
    guard: `Ganha ${value} de Guarda para si.`,
    rally: `Ganha ${value} de Força para os próximos ataques.`,
    stamp: "Bloqueia a primeira carta da sua mão no próximo turno.",
    counter: `Contra-ataca com ${value} de dano.`,
    predict: `Se você encerrar o turno com 0 de Guarda, o rival ataca por ${predictedAttack}. Com pelo menos 1 de Guarda, ele ganha ${predictedGuard} de Guarda para si.`,
    teamGuard: `Concede ${value} de Guarda a todos os rivais vivos, incluindo quem usa a habilidade.`,
    heal: `Recupera até ${value} de Moral do rival com mais Moral faltando.`,
    summon: "Convoca um Militante do MTST. O reforço só age no próximo turno inimigo.",
    doubleGuard: `A Guarda do rival passa a ${value}.`,
    injunction: `Bloqueia cartas de ${injunctionType(step) === "offensive" ? "Ataque" : "Defesa"} no seu próximo turno.`,
    jingle: `Concede ${value} de Força a todos os rivais vivos, incluindo quem canta o jingle.`,
    research: "Observa quantas cartas de Ataque e Defesa você jogou neste turno para decidir a próxima ação.",
    wait: "O rival fica sem agir neste turno.",
  };
  const description = descriptions[kind];
  const label = `${name}. ${description}`;
  const numeric = !["stamp", "summon", "injunction", "research", "wait"].includes(kind);
  const content = kind === "predict"
    ? `<i>${glyph.attack}</i><b>${predictedAttack}</b><span class="intent-divider">/</span><i>${glyph.guard}</i><b>${predictedGuard}</b>`
    : `<i>${icons[kind]}</i><span class="intent-label">${intentLabels[kind]}</span>${numeric ? `<b>${value}</b>` : ""}`;
  return {
    label,
    html: `<button type="button" class="intent ${kind}" data-action="item-details" aria-haspopup="dialog"
      aria-label="${label}" ${itemTooltip({ name, description })} ${alive ? "" : "disabled"}>${content}</button>`,
  };
}
