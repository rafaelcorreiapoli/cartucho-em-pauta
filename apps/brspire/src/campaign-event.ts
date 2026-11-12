import { glyph } from "./icons";
import { encounters } from "./catalog";
import { canResolveSpecialEvent, currentEvent, EVENT_PRIZE, type Run } from "./game";

function resource(kind: "money" | "health", amount: string) {
  const money = kind === "money";
  return `<span class="resource-${kind} event-resource">
    <i aria-hidden="true">${money ? glyph.gold : glyph.health}</i><b>${amount}</b>
    <span>${money ? "moedas" : "Moral"}</span>
  </span>`;
}

export function campaignEvent(run: Run, asset: (name: string) => string, cardPicker = "") {
  const { state } = encounters[run.stage];
  const event = currentEvent(run);
  const special = event.special;
  const result = run.eventResult === "special" ? special?.result : run.eventResult && event.outcomes[run.eventResult][1];
  const resultResource = run.eventResult === "special" ? run.eventReward : run.eventResult === "profit"
    ? resource("money", `+${EVENT_PRIZE}`)
    : resource("health", `${run.eventMoralDelta < 0 ? "−" : "+"}${Math.abs(run.eventMoralDelta)}`);
  return `
    <section class="event-panel" aria-labelledby="event-title">
      <div class="event-cover">
        <img src="${asset(`event-${event.id}`)}" alt="${event.imageAlt}">
      </div>
      <div class="event-body">
        ${result ? `
          <div class="event-resolution">
            <h1 class="event-result" id="event-title" tabindex="-1">
              ${run.eventItemImage ? `<img class="event-item-reward" src="${asset(run.eventItemImage)}" alt="">` : ""}
              ${run.eventResult === "rest" && run.eventMoralDelta === 0 ? "Moral cheia" : resultResource}
            </h1>
            <p>${result}</p>
          </div>
          <button class="primary event-continue" data-action="${run.moral ? "finish-event" : "reset"}">
            ${run.moral ? "Voltar ao mapa →" : "Jogar outra sessão →"}
          </button>
        ` : `
          <header class="event-heading">
            <small>${state} · Evento</small>
            <h1 id="event-title" tabindex="-1">${event.title}</h1>
          </header>
          ${cardPicker ? `
            <p>${special?.hint}</p>
            <div class="event-card-picker">${cardPicker}</div>
            <button class="secondary" data-action="cancel-event-cards">Voltar</button>
          ` : `
            <p>${event.intro}</p>
            ${special && canResolveSpecialEvent(run) ? `
              <button class="event-choice event-risk" data-action="event-special">
                <strong>${special.label}</strong><small>${special.hint}</small>
              </button>
            ` : ""}
            <button class="event-choice event-risk" data-action="event-choice" data-value="risk">
              <strong>${event.risk[0]}</strong><small>${event.risk[1]}</small>
            </button>
            <button class="event-choice event-rest" data-action="event-choice" data-value="rest">
              <strong>${event.rest[0]}</strong><small>${event.rest[1]}</small>
            </button>
          `}
        `}
      </div>
    </section>`;
}
