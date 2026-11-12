import { glyph } from "./icons";
import { encounters } from "./catalog";
import { heroes } from "./heroes";
import { campaignCopy } from "./campaign-copy";
import { availableDestinations, campaignLineup, routeForks, routeLength, type Run } from "./game";

export function campaignHeroPosition(run: Run) {
  const destinations = availableDestinations(run);
  return destinations.length === 1 ? destinations[0] : run.conquered.at(-1);
}

function campaignPreview(run: Run, index: number, asset: (name: string) => string, choosingBranch: boolean) {
  const { name, uf, state, subtitle, arena } = encounters[index];
  const event = run.events.includes(index);
  const shop = run.shops.includes(index);
  return `
    <img class="campaign-scene" src="${asset(arena)}" alt="${subtitle}">
    <div class="campaign-destination-title">
      <small>${uf.toUpperCase()} · ${subtitle}</small>
      <h2>${state}</h2>
    </div>
    ${shop ? "<p>O mascate vende cartas para o seu baralho.</p>" : event ? "<p>Um encontro com escolhas e consequências.</p>" : `
    <p><strong>${name}.</strong> ${campaignCopy[uf]}</p>
    <div class="campaign-opponents">
      <small>Rivais</small>
      <ul>
        ${campaignLineup(run, index).map(({ id, name, moral, sprite }) => `<li>
          <span class="campaign-rival-art" data-portrait="${heroes[run.hero].faction === "right"}" style="background-image:url('${asset(sprite ? `${sprite}-idle` : heroes[run.hero].faction === "right" ? `${id}-portrait` : `rival-${id}-sheet`)}')" aria-hidden="true"></span>
          <span class="campaign-rival-name">${name}</span><b aria-label="${moral} de Moral"><span aria-hidden="true">${glyph.health}</span> ${moral}</b>
        </li>`).join("")}
      </ul>
    </div>`}
    ${choosingBranch ? '<p class="campaign-branch-hint">A escolha é definitiva.</p>' : ""}
    <button type="button" class="primary campaign-enter" data-action="${choosingBranch ? "confirm-destination" : "enter-stage"}" data-value="${index}">
      <span>${choosingBranch ? `Seguir para ${state}` : shop ? "Visitar a loja" : event ? "Abrir evento" : "Entrar no confronto"}</span><span aria-hidden="true">→</span>
    </button>`;
}

export function campaignMap(run: Run, selected: number, asset: (name: string) => string) {
  const destinations = availableDestinations(run);
  const trail = run.conquered;
  const previewing = run.routeNumber === null;
  const route = previewing ? run.routes[selected] : run;
  const heroStage = previewing ? route.order[0] : campaignHeroPosition(run);
  const choosingBranch = destinations.length > 1;
  const icons = { Chefe: "★", Loja: glyph.shop, Evento: "?", Batalha: glyph.attack };
  const nodes = route.order.map((stage) => ({
    ...encounters[stage], stage,
    type: route.bosses.includes(stage) ? "Chefe" as const : route.shops.includes(stage) ? "Loja" as const : route.events.includes(stage) ? "Evento" as const : "Batalha" as const,
  }));
  const forks = routeForks.filter((stop) => stop >= trail.length &&
    (stop !== trail.length || run.confirmedDestination === undefined));
  const alternateIndices = forks.map((stop, pending) => stop + pending + 1);
  const paper = `
    <div class="campaign-paper">
      <img class="campaign-brazil" src="${import.meta.env.BASE_URL}assets/brasil.svg" alt="">
      <svg class="campaign-route" viewBox="0 0 496 496" aria-hidden="true">
        ${route.order.slice(1).map((to, index) => {
          if (alternateIndices.includes(index + 1)) return "";
          const from = route.order[alternateIndices.includes(index) ? index - 1 : index];
          return routeLine(from, to);
        }).join("")}
        ${alternateIndices.map((index) =>
          routeLine(route.order[index - 2], route.order[index]) +
          routeLine(route.order[index], route.order[index + 1])).join("")}
      </svg>
      ${nodes.map(({ state, marker: [x, y], stage, type }) => {
        const won = trail.includes(stage);
        const ready = destinations.includes(stage);
        const startHere = previewing && stage === heroStage;
        const heroHere = !previewing && stage === heroStage;
        const iconClass = type === "Batalha" ? "campaign-battle-icon" : "";
        return `
          <${ready && choosingBranch ? "button" : "span"} class="campaign-node" style="--x:${x / 4.96}%;--y:${y / 4.96}%"
            ${startHere ? "data-route-start" : ""}
            ${heroHere ? 'data-current-stop' : ""}
            data-state="${won ? "won" : ready ? "ready" : "locked"}"
            ${choosingBranch && stage === selected ? "data-destination-preview" : ""}
            ${ready && choosingBranch ? `type="button" data-action="preview-stage" data-value="${stage}" aria-pressed="${stage === selected}"` : 'role="img"'}
            title="${state} · ${type}" aria-label="${state} · ${type}${startHere ? " · Ponto inicial" : ""}${won ? " · Conquistado" : ""}${heroHere ? ` · ${heroes[run.hero].name} está aqui` : ""}">
            <span class="${iconClass}" aria-hidden="true">${startHere ? "◆" : icons[type]}</span>
          </${ready && choosingBranch ? "button" : "span"}>`;
      }).join("")}
      ${!previewing && heroStage !== undefined ? heroMarker(run, heroStage, asset) : ""}
      ${previewing ? "" : `<span class="campaign-map-progress">${trail.length}/${routeLength} conquistados</span>`}
      <ul class="campaign-map-legend" aria-label="Legenda do mapa">
        ${(["Batalha", "Evento", "Loja", "Chefe"] as const).map((type) =>
          `<li><span aria-hidden="true">${icons[type]}</span>${type}</li>`).join("")}
      </ul>
    </div>`;

  if (previewing) return `
    <div class="campaign-route-picker">
      <h1 id="campaign-title" class="campaign-route-title">Escolha sua rota</h1>
      <div class="campaign-route-options" role="group" aria-labelledby="campaign-title">
        ${run.routes.map((_, index) => `<button type="button" data-action="preview-route" data-value="${index}" aria-pressed="${selected === index}">ROTA ${index + 1}</button>`).join("")}
      </div>
      ${paper}
      <button type="button" class="primary campaign-start" data-action="choose-route" data-value="${selected}">COMEÇAR</button>
    </div>`;

  return `${paper}
    <div class="campaign-detail">
      <h1 id="campaign-title" tabindex="-1">${destinations.length > 1 ? "Escolha a próxima parada" : "Próxima parada"}</h1>
      ${destinations.length > 1 ? `<div class="campaign-destinations" role="group" aria-label="Destinos disponíveis">
        ${destinations.map((stage) => `<button type="button" class="secondary" data-action="preview-stage" data-value="${stage}"
          aria-pressed="${selected === stage}">${encounters[stage].state}</button>`).join("")}
      </div>` : ""}
      <div class="campaign-preview">${campaignPreview(run, selected, asset, choosingBranch)}</div>
    </div>`;
}


function heroMarker(run: Run, stage: number, asset: (name: string) => string) {
  const { marker: [x, y], state } = encounters[stage];
  return `
    <span class="campaign-location">Você está em <strong>${state}</strong></span>
    <span class="campaign-hero-marker" data-hero-position style="--x:${x / 4.96}%;--y:${y / 4.96}%"
      aria-hidden="true"><img class="campaign-hero-portrait" src="${asset(`${run.hero}-portrait`)}" alt=""></span>`;
}

function routeLine(from: number, to: number) {
  return `<polyline points="${encounters[from].marker.join(",")} ${encounters[to].marker.join(",")}"/>`;
}
