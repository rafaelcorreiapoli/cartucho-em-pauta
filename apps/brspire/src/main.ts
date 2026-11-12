import { glyph } from "./icons";
import { installItemTooltip, itemTooltip } from "./item-tooltip";
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow/latin-700.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import { gameAudio, type AudioChannel } from "./audio";
import { consumables, consumableSlots, relics, type ConsumableId, type RelicId } from "./items";
import { cards, cardDefinition, cardType, needsTarget, encounters, type CardId, type DeckCardId } from "./catalog";
import {
  buyShopCard,
  buyShopItem,
  canRemoveShopCard,
  removeShopCard,
  SHOP_REMOVAL_PRICE,
  cardBaseDamage,
  cardHitCount,
  useConsumable,
  canUseConsumable,
  canPlayCard,
  discardFromHand,
  chooseRoute,
  type Difficulty,
  availableDestinations,
  routeLength,
  leaveShop,
  chooseDestination,
  confirmDestination,
  claimReward,
  claimRelicReward,
  finishEvent,
  resolveEvent,
  resolveSpecialEvent,
  canResolveSpecialEvent,
  currentEvent,
  eventCardOptions,
  endTurn,
  finishRivals,
  rivalIntent,
  pendingAttackPenaltyTargets,
  MAX_MORAL,
  newRun,
  playCard,
  rivalAct,
  TURN_ENERGY,
  ELECTION_COINS_PER_ENERGY,
  DEBT_MORAL_LOSS,
} from "./game";
import {
  animateDraw,
  bloodBurst,
  floatHit,
  lungeAt,
  statusBurst,
  type CombatEffect,
  presentCard,
} from "./combat-motion";
import { heroStatuses, rivalStatuses } from "./combat-status";
import { intentLabels, rivalIntentBadge } from "./rival-intent";
import { HeroSprite } from "./sprite";
import { installHandPreview } from "./hand-preview";
import { heroes, isHeroId, type HeroId, type Faction } from "./heroes";
import { lobbyScreen, type LobbyStep } from "./lobby";
import { campaignHeroPosition, campaignMap } from "./campaign";
import { campaignEvent } from "./campaign-event";
import { loadGameAssets } from "./loading";
import { readAutosave, writeAutosave, type Autosave } from "./autosave";
import "./style.css";
import "./combat-hud.css";
import "./shop.css";
import "./compact-layout.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
const asset = (name: string) =>
  `${import.meta.env.BASE_URL}assets/${name}.webp`;
app.innerHTML = `
  <button class="settings-trigger hud-icon-button" type="button" data-action="settings" aria-label="Configurações" aria-haspopup="dialog">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round">
      <path d="m10 2-.6 3.1-2 .9-2.7-1.7-2 2 1.7 2.7-.9 2L.5 12l1 3 3 .3.9 2.1-1.6 2.6 2.2 1.9 2.6-1.6 2.1.8.5 2.9h2.9l.5-3 2.1-.9 2.6 1.6 2-2-1.6-2.7.9-2 3-.6v-2.9l-3-.5-.9-2 1.6-2.7-2-2-2.7 1.7-2.1-.9L13 2z" transform="translate(1 0) scale(.91)"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </button>
  <dialog class="settings-panel hud-panel" aria-labelledby="settings-title">
    <h2 id="settings-title" class="hud-title">Configurações</h2>
    <button class="settings-option hud-option audio-toggle" data-action="audio" data-value="music"><span>Música</span><b class="hud-option-value"></b></button>
    <button class="settings-option hud-option audio-toggle" data-action="audio" data-value="effects"><span>Efeitos sonoros</span><b class="hud-option-value"></b></button>
    <button class="settings-option hud-option" data-action="reset" hidden>Começar de novo</button>
    <button class="settings-option hud-option" data-action="open-album">Álbum de cartas</button>
    <button class="hud-button hud-button--secondary" data-action="close-settings">Fechar</button>
  </dialog>
  <dialog class="settings-panel hud-panel item-details" aria-labelledby="item-details-title"></dialog>
  <dialog class="card-album" aria-labelledby="album-title">
    <header><h2 id="album-title">Álbum de cartas</h2><button class="secondary" data-action="close-album">Voltar</button></header>
    <div class="album-cards"></div>
  </dialog>
  <dialog class="card-album shop-deck-dialog" aria-labelledby="shop-deck-title">
    <header>
      <h2 id="shop-deck-title" tabindex="-1" autofocus>Remover uma carta</h2>
      <button type="button" class="secondary" data-action="close-shop-deck">Voltar</button>
    </header>
    <div class="shop-deck-filter">
      <label for="shop-deck-search">Buscar no baralho</label>
      <input id="shop-deck-search" type="search" placeholder="Nome da carta" autocomplete="off">
    </div>
    <div class="shop-deck-grid" aria-label="Cartas do baralho"></div>
    <p class="shop-deck-empty" role="status" hidden>Nenhuma carta encontrada.</p>
    <footer>
      <span class="shop-deck-selection" role="status"></span>
      <button type="button" class="primary" data-action="confirm-shop-removal" disabled>
        Remover · ${glyph.gold} ${SHOP_REMOVAL_PRICE}
      </button>
    </footer>
  </dialog>
  <section class="combat-resources hud-strip" aria-label="Recursos da sessão" hidden></section>
  <main class="lobby" aria-labelledby="lobby-title"></main>
  <main class="campaign" aria-labelledby="campaign-title" hidden></main>
  <main class="shop" aria-labelledby="shop-title" hidden>
    <div class="shop-content"></div>
    <p class="shop-feedback" role="status"></p>
  </main>
  <main class="event-scene" aria-labelledby="event-title" hidden></main>
  <main class="game" hidden>
    <section class="arena" aria-label="Confronto">
      <div class="encounter"></div>
      <div class="fighters">
        <div class="hero">
          <div class="hero-stage"><img class="hero-sprite" alt="" /></div>
          <div class="hero-status"></div>
        </div>
        <div class="rivals"></div>
      </div>
      <p class="feedback" aria-live="polite"></p>
    </section>
    <section class="table" aria-label="Sua mão">
      <div class="player-tools"></div>
      <div class="hand" aria-label="Cartas na mão"></div>
      <div class="turn-tools"></div>
    </section>
    <dialog class="outcome" aria-label="Resultado"></dialog>
  </main>
  <div class="combat-fx" aria-hidden="true" inert></div>`;

const view = {
  shop: app.querySelector<HTMLElement>(".shop")!,
  shopContent: app.querySelector<HTMLElement>(".shop-content")!,
  shopFeedback: app.querySelector<HTMLElement>(".shop-feedback")!,
  shopDeck: app.querySelector<HTMLDialogElement>(".shop-deck-dialog")!,
  event: app.querySelector<HTMLElement>(".event-scene")!,
  resources: app.querySelector<HTMLElement>(".combat-resources")!,
  campaign: app.querySelector<HTMLElement>(".campaign")!,
  lobby: app.querySelector<HTMLElement>(".lobby")!,
  game: app.querySelector<HTMLElement>(".game")!,
  album: app.querySelector<HTMLDialogElement>(".card-album")!,
  settings: app.querySelector<HTMLDialogElement>(".settings-panel")!,
  itemDetails: app.querySelector<HTMLDialogElement>(".item-details")!,
  reset: app.querySelector<HTMLButtonElement>('[data-action="reset"]')!,
  arena: app.querySelector<HTMLElement>(".arena")!,
  heroStage: app.querySelector<HTMLElement>(".hero-stage")!,
  fx: app.querySelector<HTMLDivElement>(".combat-fx")!,
  encounter: app.querySelector<HTMLDivElement>(".encounter")!,
  hero: app.querySelector<HTMLDivElement>(".hero-status")!,
  rivals: app.querySelector<HTMLDivElement>(".rivals")!,
  feedback: app.querySelector<HTMLParagraphElement>(".feedback")!,
  outcome: app.querySelector<HTMLDialogElement>(".outcome")!,
  hand: app.querySelector<HTMLDivElement>(".hand")!,
  playerTools: app.querySelector<HTMLDivElement>(".player-tools")!,
  turnTools: app.querySelector<HTMLDivElement>(".turn-tools")!,
};
view.outcome.addEventListener("cancel", (event) => event.preventDefault());

const hero = new HeroSprite(
  app.querySelector<HTMLImageElement>(".hero-sprite")!,
);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const compactCombat = matchMedia("(max-width: 700px), (max-width: 1024px) and (max-height: 580px), (max-width: 1024px) and (pointer: coarse)");
const clearHandPreview = installHandPreview(view.hand, compactCombat);
let run = newRun();
let selectedDifficulty: Difficulty = "normal";
let choosingStage = false;
let lobbyStep: LobbyStep | undefined = "faction";
let selectedCard: number | undefined;
let message = "Escolha um personagem para começar.";
let busy = false;
let impact: string[] = [];
let acting: string | undefined;
let mapSelection: number | undefined;
let pickingEventCard = false;
let pendingEndTurn = false;
let shopRemoval: Autosave["shopRemoval"];

function checkpoint() {
  writeAutosave({
    run,
    lobby: lobbyStep ? { step: lobbyStep, faction: selectedFaction, selectedHero, previewHero } : undefined,
    mapSelection: choosingStage ? mapSelection : undefined,
    eventView: view.event.hidden ? undefined : { pickingCard: pickingEventCard },
    selectedCard,
    shopRemoval,
    pendingEndTurn,
    message,
  });
}

function meter(moral: number, max: number) {
  return `<div class="health-line">
    <div class="meter" role="meter" aria-label="Moral" aria-valuenow="${moral}" aria-valuemin="0" aria-valuemax="${max}">
      <span style="width:${(moral / max) * 100}%"></span><b>${moral}/${max}</b>
    </div>
  </div>`;
}

function hudDetails(name: string, description: string, value: string | number) {
  return `type="button" data-hud-help data-action="item-details" aria-haspopup="dialog"
    aria-label="${name}, ${value}" ${itemTooltip({ name, description })}`;
}

function renderResources() {
  const moneyHelp = run.money < 0
    ? `Use moedas na loja. Se o saldo continuar negativo após a recompensa da luta, a dívida é quitada e você perde ${DEBT_MORAL_LOSS} de Moral.`
    : "Use moedas na loja para comprar cartas e itens ou remover uma carta do baralho.";
  view.resources.innerHTML = `
    <img class="resource-portrait" src="${asset(`${run.hero}-portrait`)}" alt="${heroes[run.hero].name}">
    <button class="resource-health" ${hudDetails("Moral", "É a vida do herói. Se chegar a zero, a sessão acaba.", `${run.moral} de ${MAX_MORAL}`)}>
      <i aria-hidden="true">${glyph.health}</i><b>${run.moral}/${MAX_MORAL}</b>
    </button>
    <button class="resource-money" data-debt="${run.money < 0}" ${hudDetails("Moedas", moneyHelp, run.money)}>
      <i aria-hidden="true">${glyph.gold}</i><b>${run.money}</b>
    </button>
    ${run.temporaryCoins ? `<span class="resource-temporary-money" title="Moedas temporárias deste combate">+${run.temporaryCoins} temp.</span>` : ""}
    <span class="resource-items" aria-label="Consumíveis">
      ${Array.from({ length: consumableSlots }, (_, index) => {
        const id = run.consumables[index];
        if (!id) return '<i aria-hidden="true">◇</i>';
        const item = consumables[id];
        const disabled = busy || choosingStage || !canUseConsumable(run, index);
        return `<button class="resource-item" data-action="use-item" data-value="${index}" data-unavailable="${disabled}"
          aria-label="${item.name}. ${item.description}" ${itemTooltip(item)}><img class="item-art" src="${asset(item.image)}" alt=""></button>`;
      }).join("")}
    </span>
    ${run.relics.length ? `<span class="resource-relics" aria-label="Relíquias">${run.relics.map((id) => {
      const relic = relics[id];
      return `<button class="resource-item" type="button" data-action="item-details" aria-haspopup="dialog" aria-label="${relic.name}" ${itemTooltip(relic)}><img class="item-art" src="${asset(relic.image)}" alt=""></button>`;
    }).join("")}</span>` : ""}
    ${run.guard && !choosingStage && run.phase !== "shop" ? `<span class="resource-effect" title="Guarda"><i aria-hidden="true">${glyph.guard}</i><b>${run.guard}</b></span>` : ""}
  `;
}

function cardTile(
  id: DeckCardId,
  action: string | null,
  value: string | number,
  options: {
    selected?: boolean;
    disabled?: boolean;
    shortcut?: number;
    pending?: boolean;
    shopLabel?: string;
    electionPricing?: boolean;
    strength?: number;
    inCombat?: boolean;
  } = {},
) {
  const card = cardDefinition(id);
  const hits = options.inCombat ? cardHitCount(run, card) : card.hits ?? 1;
  const damage = (options.inCombat ? cardBaseDamage(run, card) : card.damage ?? 0) + (options.strength ?? 0);
  const stats = [
    card.guardDamage && !options.inCombat
      ? `<span class="damage">${glyph.attack} ½ da Guarda em dano (máx. 18)</span>`
      : card.damage || card.guardDamage
        ? `<span class="damage"><i aria-hidden="true">${glyph.attack}</i> ${damage}${hits > 1 ? ` × ${hits}` : ""} ${card.all ? "em todos" : "de dano"}</span>`
        : "",
    card.guard
      ? `<span class="guard"><i aria-hidden="true">${glyph.guard}</i> ${card.guard} de Guarda</span>`
      : "",
    card.retainGuard ? `<span>Retenha até ${card.retainGuard} de Guarda</span>` : "",
    card.guardAfterStrength ? `<span>+${card.guardAfterStrength} de Guarda se ganhou Força neste turno</span>` : "",
    card.extraHitAtStrength ? `<span>+1 golpe com ${card.extraHitAtStrength} de Força</span>` : "",
    card.discardBeforeDraw ? "<span>Descarte 1 carta</span>" : "",
    card.draw
      ? `<span><i aria-hidden="true">${glyph.draw}</i> Compre ${card.draw}</span>`
      : "",
    card.energy ? `<span>${glyph.energy} +${card.energy} Energia</span>` : "",
    card.doubleGuard ? `<span class="guard">${glyph.guard} Dobre sua Guarda</span>` : "",
    card.moralCost ? `<span class="damage">${glyph.health} −${card.moralCost} Moral</span>` : "",
    card.heal ? `<span class="guard">${glyph.health} +${card.heal} Moral</span>` : "",
    card.nextEnergy ? `<span>${glyph.energy} +${card.nextEnergy} Energia no próximo turno</span>` : "",
    card.coins ? `<span>${glyph.gold} +${card.coins} moedas</span>` : "",
    card.strength ? `<span>${glyph.strength} +${card.strength} de Força no combate</span>` : "",
    card.turnStrength ? `<span>${glyph.strength} +${card.turnStrength} de Força neste turno</span>` : "",
    card.strengthGrowthTurns ? `<span>${glyph.strength} +1 de Força no início dos próximos ${card.strengthGrowthTurns} turnos</span>` : "",
    card.election ? `<span>${glyph.energy} 0 Energia neste turno</span><span>${glyph.gold} ${ELECTION_COINS_PER_ENERGY} moedas por Energia</span>` : "",
    card.unplayable ? "<span>Injogável</span>" : "",
    card.addPayroll ? "<span>+1 Folha de Pagamento</span>" : "",
    card.guardAfterCoins ? `<span>+${card.guardAfterCoins} Guarda se ganhou moedas</span>` : "",
    card.guardBonus ? `<span>Compre ${card.guardBonus} se já tem Guarda</span>` : "",
    card.delayedDamage ? `<span>${card.delayedDamage} de dano no próximo turno</span>` : "",
    card.repeatTactic ? "<span>Repita a próxima Tática do turno</span>" : "",
    card.extraHitAfterTactic && !(options.inCombat && run.rightEffects.playedTactic) ? "<span>+1 golpe após uma Tática</span>" : "",
    card.moralWithoutDamage ? `<span>−${card.moralWithoutDamage} Moral se não ferir um rival</span>` : "",
    card.nextMoralCost ? `<span>−${card.nextMoralCost} Moral no próximo turno</span>` : "",
    card.weakenAttack ? `<span>−${card.weakenAttack} no próximo ataque inimigo</span>` : "",
    card.blockDebuff ? "<span>Bloqueie 1 efeito negativo</span>" : "",
    card.endTurn ? "<span>Encerre o turno</span>" : "",
    card.exhaust ? '<span title="Sai do baralho até o fim do combate">Exaure a carta</span>' : "",
  ].join("");
  const style = cardType(card);
  const type = { tactical: "Tática", offensive: "Ataque", defensive: "Defesa", status: "Status" }[style];
  const element = action ? "button" : "article";
  return `<${element} class="card ${style}" ${action ? `data-action="${action}" data-value="${value}"` : ""}
    ${options.pending ? 'style="visibility:hidden"' : ""} ${options.disabled ? "disabled" : ""} ${options.selected ? 'aria-pressed="true"' : ""}>
    <div class="card-art"><img src="${asset(card.image)}" alt="" draggable="false" /><span class="card-type">${type}</span></div>
    ${card.unplayable ? '<span class="card-cost" aria-hidden="true">—</span>' : options.electionPricing
      ? `<span class="card-cost card-cost-coins" aria-label="0 de Energia e ${card.cost * ELECTION_COINS_PER_ENERGY} moedas">${glyph.gold} ${card.cost * ELECTION_COINS_PER_ENERGY}</span>`
      : `<span class="card-cost" aria-label="${card.cost} de Energia">${card.cost}</span>`}
    ${options.shortcut ? `<kbd aria-hidden="true">${options.shortcut}</kbd>` : ""}
    <div class="card-copy"><strong title="${card.name}">${card.name}</strong><div class="card-stats">${stats}</div><em title="${card.line.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}">${card.line}</em></div>
    ${options.shopLabel ? `<span class="shop-price">${options.shopLabel}</span>` : ""}
  </${element}>`;
}

const cardTitleMeasure = document.createElement("canvas").getContext("2d")!;

function fitCardTitles() {
  const titles = [...app.querySelectorAll<HTMLElement>(".game:not([hidden]) .card-copy strong, .shop:not([hidden]) .card-copy strong, .card-album[open] .card-copy strong, .event-card-picker .card-copy strong, .lobby:not([hidden]) .card-copy strong")];
  for (const title of titles) title.style.removeProperty("--fitted-title-size");
  const fittedSizes = titles.map((title) => {
    const { fontWeight, fontSize, fontFamily } = getComputedStyle(title);
    cardTitleMeasure.font = `${fontWeight} ${fontSize} ${fontFamily}`;
    const width = cardTitleMeasure.measureText(title.textContent ?? "").width;
    return width > title.clientWidth ? Math.max(10, parseFloat(fontSize) * (title.clientWidth - 1) / width) : undefined;
  });
  titles.forEach((title, index) => {
    const fitted = fittedSizes[index];
    if (fitted !== undefined) title.style.setProperty("--fitted-title-size", `${fitted}px`);
  });
}

window.addEventListener("resize", fitCardTitles);
void document.fonts.ready.then(fitCardTitles);

function render(pendingDraw = 0) {
  checkpoint();
  clearHandPreview();
  const encounter = encounters[run.stage];
  const activeHero = heroes[run.hero];
  const targetMode = selectedCard !== undefined;
  view.game.style.setProperty("--arena-image", `url('${asset(encounter.arena)}')`);
  renderResources();
  view.encounter.innerHTML = `<span>${encounter.subtitle}</span><h1 tabindex="-1">${encounter.name}</h1>`;
  const penaltyTargets = pendingAttackPenaltyTargets(run);
  view.hero.innerHTML = `<strong class="fighter-name">${activeHero.name}</strong>
    ${meter(run.moral, MAX_MORAL)}
    ${heroStatuses(run, Boolean(run.rightEffects.weakenAttack && !penaltyTargets.length))}`;
  view.rivals.innerHTML = run.rivals
    .map((rival) => {
      const penalty = penaltyTargets.find(({ id }) => id === rival.id);
      const intent = rivalIntent(run, rival, run.phase === "rivals" && rival.step < run.turn);
      if (penalty && !penalty.conditional) intent.value = Math.max(0, intent.value - run.rightEffects.weakenAttack);
      const hit = impact.includes(rival.id);
      const active = acting === rival.id;
      const pose = !rival.moral
        ? "defeat"
        : hit
          ? "hit"
          : active
            ? "attack"
            : "idle";
      const predictedPenalty = penaltyTargets[0]?.id === rival.id ? run.rightEffects.weakenAttack : 0;
      const badge = rivalIntentBadge(intent, rival.step, Math.max(0, intent.value + rival.bonus - predictedPenalty), Boolean(rival.moral));
      const sprite = rival.sprite
        ? `<img class="rival-hero-frame rival-unique-frame" data-pose="${pose}" ${hit && !rival.moral ? "data-falling" : ""} src="${asset(`${rival.sprite}-${pose}`)}" alt="">`
        : heroes[run.hero].faction === "right"
        ? `<img class="rival-hero-frame" src="${asset(`${rival.id}-${{ idle: "idle", attack: "5", hit: "9", defeat: "15" }[pose]}`)}" alt="">`
        : `<span class="rival-sprite rival-sheet" data-pose="${pose}" ${hit && !rival.moral ? "data-falling" : ""} style="--idle-image:url('${asset(`rival-${rival.id}-idle`)}');--rival-atlas:url('${asset(`rival-${rival.id}-sheet`)}')"></span>`;
      return `<div class="rival ${rival.moral ? "" : "defeated"} ${hit ? "impact" : ""}" data-rival="${rival.id}">
      ${badge.html}
      <button class="rival-target" data-action="target" data-value="${rival.id}" ${!rival.moral || !targetMode ? "disabled" : ""} aria-label="${rival.name}. Moral ${rival.moral}. ${rival.moral ? badge.label : "Derrotado"}">
      <span class="rival-stage">${sprite}</span>
      <strong class="fighter-name">${rival.name}</strong>
      ${meter(rival.moral, rival.maxMoral)}
      </button>
      ${rivalStatuses(run, rival, penalty)}
    </div>`;
    })
    .join("");
  const discarding = run.rightEffects.pendingDiscards > 0;
  view.hand.toggleAttribute("data-discarding", discarding);
  view.feedback.textContent = discarding ? "Escolha uma carta para descartar." : message;
  view.hand.style.setProperty("--hand-count", String(run.hand.length));
  const handCenter = (run.hand.length - 1) / 2;
  const handScroll = view.hand.scrollLeft;
  view.hand.innerHTML = run.hand.map((id, index) => {
    const rotation = Math.max(-13, Math.min(13, (index - handCenter) * 5));
    return `<div class="hand-slot" style="--fan-angle:${rotation}deg">${cardTile(id, "card", index, {
      disabled: busy || (!discarding && !canPlayCard(run, index)),
      inCombat: true,
      selected: selectedCard === index,
      shortcut: index + 1,
      electionPricing: run.electionActive,
      strength: run.strength + run.turnStrength,
      pending: index >= run.hand.length - pendingDraw,
    })}</div>`;
  }).join("");
  view.hand.scrollLeft = handScroll;
  view.playerTools.innerHTML = `
    <button class="energy" data-faction="${activeHero.faction}"
      ${hudDetails("Energia", `Use Energia para jogar cartas. Você começa cada turno com ${TURN_ENERGY}, mais os bônus ativos.`, `${run.energy} de ${TURN_ENERGY}`)}>
      <span class="energy-emblem" aria-hidden="true"></span>
      <b>${run.energy}/${TURN_ENERGY}</b>
    </button>
    <button class="draw-pile" data-empty="${run.draw.length === 0}"
      ${hudDetails("Pilha de compra", "Mostra quantas cartas ainda podem ser compradas. Ao esvaziar, o descarte é embaralhado para repor a pilha.", `${run.draw.length} cartas`)}>
      <span class="card-back" aria-hidden="true"><span>${heroes[run.hero].faction === "right" ? "◆" : "☭"}</span></span>
      <b aria-hidden="true">${run.draw.length}</b>
    </button>`;
  const canEndTurn = !busy && !discarding && run.phase === "player";
  const onlyEndTurn = canEndTurn &&
    !run.hand.some((_, index) => canPlayCard(run, index)) &&
    !run.consumables.some((_, index) => canUseConsumable(run, index));
  view.turnTools.innerHTML = `
    <button class="primary" data-action="end" data-only-action="${onlyEndTurn}" ${canEndTurn ? "" : "disabled"}
      ${itemTooltip({ name: "Encerrar turno", description: "Descarta as cartas restantes da mão e passa a vez aos rivais." })}>Encerrar turno <span>${run.turn}</span></button>
    <button class="discard-pile"
      ${hudDetails("Pilha de descarte", "Recebe cartas usadas ou descartadas. Elas voltam à pilha de compra quando ela esvazia. Cartas exauridas ficam fora até o fim da luta.", `${run.discard.length} cartas`)}>
      <span aria-hidden="true">▱</span><b aria-hidden="true">${run.discard.length}</b>
    </button>`;
  view.rivals.classList.toggle("targeting", targetMode);
  const showingOutcome = !busy && ["reward", "won", "lost"].includes(run.phase);
  const choosingRelic = run.phase === "reward" && run.bosses.includes(run.stage);
  view.outcome.innerHTML = !showingOutcome
    ? ""
    : choosingRelic
      ? `
    <div class="result-heading"><small>Chefe derrotado</small><h2>${run.relicRewards.length ? "Escolha uma relíquia" : "Coleção completa"}</h2></div>
    <div class="relic-rewards">${run.relicRewards.map((id) => {
      const item = relics[id];
      return `<button class="relic-choice" data-action="reward-relic" data-value="${id}">
        <img class="item-art" src="${asset(item.image)}" alt=""><strong>${item.name}</strong><small>${item.description}</small>
      </button>`;
    }).join("")}</div>
    <button class="secondary" data-action="skip">${run.relicRewards.length ? "Seguir sem relíquia" : "Continuar"} →</button>`
    : run.phase === "reward"
      ? `
    <div class="result-heading"><small>Confronto vencido</small><h2>Reforce seu elenco</h2><p>Escolha um personagem para o baralho.</p></div>
    <div class="reward-cards">${run.rewards.map((id) => `
      <div class="reward-flip">
        <span class="card-back" aria-hidden="true"><span>${heroes[run.hero].faction === "right" ? "◆" : "☭"}</span></span>
        <div class="reward-front">${cardTile(id, "reward", id)}</div>
      </div>`).join("")}</div>
    <button class="secondary" data-action="skip">Seguir sem carta →</button>`
      : `
    <div class="result-heading final"><small>${run.phase === "won" ? `${run.conquered.length} territórios conquistados` : `Etapa ${run.conquered.length + 1} de ${routeLength}`}</small>
    <h2>${run.phase === "won" ? "Sessão encerrada. Você venceu!" : "Sua Moral chegou a zero"}</h2>
    <p>${run.phase === "won" ? `${activeHero.name} saiu do plenário com ${run.moral} de Moral.` : "A sessão termina aqui. Um novo baralho pode mudar a próxima luta."}</p></div>
    <button class="primary" data-action="reset">Jogar outra sessão →</button>`;
  setOutcomeOpen(showingOutcome);
  fitCardTitles();
}

function setOutcomeOpen(open: boolean) {
  view.game.toggleAttribute("data-outcome", open);
  if (!open) {
    if (view.outcome.open) view.outcome.close();
    return;
  }
  if (view.itemDetails.open) view.itemDetails.close();
  const heading = view.outcome.querySelector("h2");
  if (heading) {
    heading.tabIndex = -1;
    heading.autofocus = true;
  }
  if (!view.outcome.open) view.outcome.showModal();
  view.outcome.scrollTop = 0;
  heading?.focus({ preventScroll: true });
}

function refreshAudioControls() {
  const names = { music: "Música", effects: "Efeitos sonoros" };
  for (const button of app.querySelectorAll<HTMLButtonElement>(
    ".audio-toggle",
  )) {
    const channel = button.dataset.value as AudioChannel;
    const enabled = gameAudio.enabled(channel);
    button.querySelector("b")!.textContent = enabled ? "Ligado" : "Desligado";
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute("aria-label", names[channel]);
    button.title = `${enabled ? "Silenciar" : "Ativar"} ${names[channel].toLowerCase()}`;
  }
}

const ATTACK_WINDUP_MS = 125;

function showImpact(
  target: HTMLElement,
  impact: { damage: number; absorbed: number; guardBroken: boolean },
) {
  if (impact.absorbed) gameAudio.play(impact.guardBroken ? "break" : "block");
  if (impact.damage) {
    gameAudio.play("hit", { gain: impact.absorbed ? 0.78 : 1 });
    bloodBurst(view.fx, target);
  }
  floatHit(view.fx, target, impact);
}

function playerCombatStats(state: typeof run) {
  return {
    guard: state.guard,
    strength: state.strength + state.turnStrength,
    health: state.moral,
    energy: state.energy,
    gold: state.money + state.temporaryCoins,
  };
}

function showPlayerGains(before: ReturnType<typeof playerCombatStats>) {
  const after = playerCombatStats(run);
  const kinds = ["guard", "strength", "health", "energy", "gold"] as const;
  const gains = kinds.flatMap((kind) => {
    const amount = after[kind] - before[kind];
    return amount > 0 ? [{ kind, text: `+${amount}` }] : [];
  });
  if (after.guard > before.guard) gameAudio.play("guard");
  statusBurst(view.fx, view.heroStage, gains);
}

function rivalStage(id: string) {
  return view.rivals.querySelector<HTMLElement>(`[data-rival="${id}"] .rival-stage`);
}

function showDraw(count = run.hand.length) {
  const pile = view.playerTools.querySelector<HTMLElement>(".draw-pile")!;
  gameAudio.draw(count);
  return animateDraw(view.hand, pile, view.fx, count);
}

async function chooseCard(index: number) {
  if (busy || run.phase !== "player") return;
  if (run.rightEffects.pendingDiscards) {
    const active = run;
    const result = discardFromHand(active, index);
    if (!result) return;
    gameAudio.play("click");
    message = result.drawn ? `Carta descartada · +${result.drawn} na mão.` : "Carta descartada.";
    busy = result.drawn > 0;
    render();
    if (busy) {
      await showDraw(result.drawn);
      if (run !== active) return;
      busy = false;
      render();
    }
    return;
  }
  const id = run.hand[index];
  if (!id || !canPlayCard(run, index)) return;
  gameAudio.play("click");
  const card = cardDefinition(id);
  const living = run.rivals.filter(({ moral }) => moral > 0);
  if (needsTarget(card) && living.length > 1) {
    selectedCard = selectedCard === index ? undefined : index;
    message =
      selectedCard === undefined
        ? "Escolha um personagem."
        : `${card.name}: escolha um rival.`;
    render();
    if (selectedCard !== undefined && compactCombat.matches) {
      const { top, bottom } = view.rivals.getBoundingClientRect();
      if (top < 0 || bottom > innerHeight) view.rivals.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  void useCard(index, living[0]?.id);
}

function wait(ms: number) {
  return new Promise<void>((resolve) =>
    setTimeout(resolve, reducedMotion.matches ? 0 : ms),
  );
}

async function showDebtSettlement(coins: number, moralLost: number, moral: number) {
  view.outcome.innerHTML = `
    <div class="debt-settlement">
      <h2>Dívida quitada</h2>
      <div class="debt-totals" aria-hidden="true">
        <span class="resource-money" data-debt="true">${glyph.gold} <b>${-coins}</b></span>
        <span class="resource-health">${glyph.health} <b>${moral + moralLost}/${MAX_MORAL}</b></span>
      </div>
      <p role="status">${coins} moedas de dívida quitadas. −${moralLost} de Moral.</p>
    </div>`;
  setOutcomeOpen(true);
  const money = view.outcome.querySelector<HTMLElement>(".resource-money")!;
  const balance = money.querySelector("b")!;
  const health = view.outcome.querySelector(".resource-health b")!;
  if (!reducedMotion.matches) {
    await new Promise<void>((resolve) => {
      const started = performance.now();
      function tick(now: number) {
        const progress = Math.min(1, (now - started) / 950);
        balance.textContent = String(-Math.ceil(coins * (1 - progress)));
        health.textContent = `${moral + Math.ceil(moralLost * (1 - progress))}/${MAX_MORAL}`;
        if (progress < 1 && view.outcome.contains(balance)) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }
  balance.textContent = "0";
  money.dataset.debt = "false";
  health.textContent = `${moral}/${MAX_MORAL}`;
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));
}

async function useCard(index: number, target?: string) {
  if (busy) return;
  clearHandPreview();
  const active = run;
  const source = view.hand.querySelectorAll<HTMLButtonElement>(".card")[index];
  const playedId = active.hand[index];
  const previousHand = active.hand.length;
  const before = playerCombatStats(active);
  const usedEnergy = !active.electionActive;
  const result = playCard(active, index, target);
  if (!result) return;
  const { card, damage, relicCoins, bombonCoins, coinsSpent, debtDamage, debtPaid, guardGained } = result;
  if (usedEnergy) before.energy -= card.cost;
  before.gold -= coinsSpent;
  const drawn = active.hand.length - previousHand + 1;
  selectedCard = undefined;
  busy = true;
  pendingEndTurn = Boolean(card.endTurn && active.phase === "player");
  message = `${card.name}. ${[
    damage.length
      ? `${damage.reduce((sum, hit) => sum + hit.damage, 0)} de dano à Moral`
      : "",
    guardGained ? `+${guardGained} de Guarda` : "",
    card.strength || card.turnStrength ? `+${card.strength ?? card.turnStrength} de Força` : "",
    card.strengthGrowthTurns ? `+1 de Força nos próximos ${card.strengthGrowthTurns} turnos` : "",
    card.election ? "Cartas custam moedas neste turno" : "",
    coinsSpent ? `−${coinsSpent} moedas` : "",
    debtDamage ? `Dívida · −${debtDamage} de Moral` : "",
    card.doubleGuard ? "Guarda dobrada" : "",
    card.moralCost ? `−${card.moralCost} de Moral` : "",
    drawn ? `+${drawn} na mão` : "",
    card.energy ? `+${card.energy} de Energia` : "",
    card.heal ? "Recuperou Moral" : "",
    card.coins ? `+${card.coins} moedas` : "",
    bombonCoins ? `Caixa de Bombons · +${bombonCoins} moedas` : "",
    relicCoins ? `Cueca de Dinheiro · +${relicCoins} moedas` : "",
  ]
    .filter(Boolean)
    .join(" · ")}.`;
  checkpoint();
  const dismiss = await presentCard(source, view.arena, view.fx);
  if (run !== active) return;

  if (damage.length) {
    hero.play("attack");
    const defender = !card.all && damage.length === 1 ? rivalStage(damage[0].id) : null;
    if (defender) lungeAt(view.heroStage.querySelector(".hero-sprite")!, defender, ATTACK_WINDUP_MS);
    gameAudio.play("attack");
    await wait(ATTACK_WINDUP_MS);
    if (run !== active) return;
  }
  if (playedId === "entrarOGrosso" || playedId === "entrarOGrosso+") gameAudio.playHeroVoice("lula", "entrar-o-grosso");
  if (card.exhaust) gameAudio.play("exhaust");
  const cardExit = dismiss(card.exhaust);
  impact = damage.map(({ id }) => id);
  render(drawn);
  showPlayerGains(before);
  if (card.election) statusBurst(view.fx, view.heroStage, [{ kind: "gold", text: "Ano de Eleição" }]);
  for (const hit of damage) {
    const stage = view.rivals.querySelector<HTMLElement>(
      `[data-rival="${hit.id}"] .rival-stage`,
    );
    if (stage) showImpact(stage, hit);
  }
  const defeated = damage.some(({ id }) =>
    active.rivals.some((rival) => rival.id === id && !rival.moral),
  );
  await Promise.all([cardExit, wait(damage.length ? (defeated ? 450 : 260) : 150)]);
  if (run !== active) return;
  if (debtPaid) {
    await showDebtSettlement(debtPaid, debtDamage, active.moral);
    if (run !== active) return;
  }
  busy = false;
  impact = [];
  render();
  if (active.phase === "reward" || active.phase === "won") {
    gameAudio.stopHeroVoice();
    gameAudio.play("eventSuccess");
  }
  if (pendingEndTurn) await endPlayerTurn();
  else showDraw(drawn);
}

async function endPlayerTurn() {
  if (busy || !endTurn(run)) return;
  pendingEndTurn = false;
  gameAudio.play("click");
  const active = run;
  selectedCard = undefined;
  busy = true;
  if (active.phase === "lost") {
    hero.play("death");
    message = "Imbrochável · Moral esgotada.";
    busy = false;
    render();
    return;
  }
  message = "Turno dos rivais.";
  render();
  await resolveRivalTurn(active);
}

async function resolveRivalTurn(active: typeof run) {
  await wait(250);
  if (run !== active) return;
  for (const rival of active.rivals) {
    if (!rival.moral || rival.step >= active.turn) continue;
    let recoverAttack: ReturnType<typeof lungeAt>;
    if (rivalIntent(active, rival, true).kind === "attack") {
      acting = rival.id;
      render();
      const attacker = rivalStage(rival.id)?.querySelector<HTMLElement>(".rival-sprite, .rival-hero-frame");
      if (attacker) recoverAttack = lungeAt(attacker, view.heroStage, ATTACK_WINDUP_MS);
      gameAudio.play("attack", { gain: 0.8 });
      await wait(ATTACK_WINDUP_MS);
      if (run !== active) return;
      acting = undefined;
    }
    const before = active.rivals.map(({ id, moral, bonus }) => ({ id, moral, bonus }));
    const result = rivalAct(active, rival.id);
    if (!result) continue;
    const { intent, damage } = result;
    if (["guard", "doubleGuard", "teamGuard"].includes(intent.kind)) gameAudio.play("guard");
    message = result.blocked ? "Chapéu de Alumínio bloqueou o efeito." :
      intent.kind === "attack"
        ? `${rival.name} atacou por ${intent.value}. ${damage ? `−${damage} de Moral.` : "Guarda segurou o golpe."}`
        : intent.kind === "stamp"
          ? `${rival.name} bloqueou a primeira carta do próximo turno.`
          : `${rival.name} · ${intent.label ?? intentLabels[intent.kind]}.`;
    if (!active.moral) hero.play("death");
    else if (damage) hero.play("hit");
    render();
    if (intent.kind === "attack") {
      const attacker = rivalStage(rival.id)?.querySelector<HTMLElement>(".rival-sprite, .rival-hero-frame");
      if (attacker) recoverAttack?.(attacker);
      showImpact(view.heroStage, result);
    }
    for (const [index, other] of active.rivals.entries()) {
      if (!other.moral) continue;
      const effects: CombatEffect[] = [];
      if (intent.kind === "teamGuard" ||
        (other.id === rival.id && (intent.kind === "guard" || intent.kind === "doubleGuard"))) {
        effects.push({ kind: "guard", text: `+${other.id === rival.id ? other.guard : intent.value}` });
      }
      const previous = before[index];
      if (!previous) effects.push({ kind: "draw", text: "Reforço" });
      else {
        if (other.moral > previous.moral) effects.push({ kind: "health", text: `+${other.moral - previous.moral}` });
        if (other.bonus > previous.bonus) effects.push({ kind: "strength", text: `+${other.bonus - previous.bonus}` });
      }
      if (effects.length) {
        const stage = rivalStage(other.id);
        if (stage) statusBurst(view.fx, stage, effects);
      }
    }
    if (result.blocked || intent.kind === "stamp" || intent.kind === "injunction") {
      statusBurst(view.fx, view.heroStage, [{ kind: result.blocked ? "guard" : "draw", text: result.blocked ? "Bloqueado" : "Restrição" }]);
    }
    await wait(!active.moral ? 620 : 430);
    if (run !== active) return;
    if (!active.moral) break;
  }
  acting = undefined;
  const before = { ...playerCombatStats(active), energy: TURN_ENERGY };
  const turnStart = finishRivals(active);
  if (active.phase === "player")
    message = active.lockedCardType ? `${active.lockedCardType === "offensive" ? "Ataques bloqueados" : "Defesas bloqueadas"} neste turno.` : active.firstCardLocked ? "A primeira carta está bloqueada neste turno." : `Turno ${active.turn}. Escolha seus personagens.`;
  if (turnStart?.moralCost) message = `Cloroquina · −${turnStart.moralCost} de Moral.`;
  if (turnStart?.damage.length) message = "Patriota do Caminhão · O caminhão chegou.";
  checkpoint();
  if (turnStart?.moralCost) hero.play(!active.moral ? "death" : "hit");
  if (turnStart?.debtPaid) {
    await showDebtSettlement(turnStart.debtPaid, turnStart.debtDamage, active.moral);
    if (run !== active) return;
  }
  if (turnStart?.damage.length) {
    impact = turnStart.damage.map(({ id }) => id);
    render();
    for (const hit of turnStart.damage) {
      const stage = view.rivals.querySelector<HTMLElement>(`[data-rival="${hit.id}"] .rival-stage`);
      if (stage) showImpact(stage, hit);
    }
    await wait(430);
    if (run !== active) return;
    impact = [];
  }
  busy = false;
  render();
  if (active.phase === "player") {
    showPlayerGains(before);
    showDraw();
  }
  if (active.phase === "reward") gameAudio.play("eventSuccess");
}

let selectedFaction: Faction = "left";
let selectedHero: HeroId | undefined;
let previewHero: HeroId | undefined;
const debugMode = new URLSearchParams(window.location.search).get("debug") === "1";

let debugLoadouts: Partial<Record<HeroId, FormData>> = {};

function canStartSelectedHero() {
  return selectedHero !== undefined && (!debugMode || Boolean(debugLoadouts[selectedHero]?.has("card")));
}

view.lobby.addEventListener("change", () => {
  const form = view.lobby.querySelector<HTMLFormElement>("#debug-loadout");
  if (form && previewHero) debugLoadouts[previewHero] = new FormData(form);
});

function showLobby(step: LobbyStep, focus = true, heroId?: HeroId) {
  clearHandPreview();
  setOutcomeOpen(false);
  window.scrollTo(0, 0);
  previewHero = heroId;
  lobbyStep = step;
  choosingStage = false;
  view.campaign.hidden = true;
  view.event.hidden = true;
  view.shop.hidden = true;
  view.resources.hidden = true;
  view.game.hidden = true;
  view.reset.hidden = true;
  view.lobby.hidden = false;
  view.lobby.innerHTML = lobbyScreen(step, asset, selectedDifficulty, selectedFaction, {
    selectedHero,
    debug: debugMode,
    ready: canStartSelectedHero(),
    preview: heroId ? { id: heroId, renderCard: (id) => cardTile(id, null, id) } : undefined,
  });
  const loadout = heroId && debugLoadouts[heroId];
  if (loadout) {
    for (const checkbox of view.lobby.querySelectorAll<HTMLInputElement>("#debug-loadout input")) {
      checkbox.checked = loadout.getAll(checkbox.name).includes(checkbox.value);
    }
  }
  fitCardTitles();
  if (focus) view.lobby.querySelector("h1")?.focus({ preventScroll: true });
  checkpoint();
}

function startSession(heroId: HeroId) {
  const loadout = debugLoadouts[heroId];
  if (debugMode && !loadout?.has("card")) return;
  view.fx.replaceChildren();
  run = newRun(undefined, heroId, selectedDifficulty);
  if (debugMode && loadout) {
    run.deck = loadout.getAll("card") as CardId[];
    run.consumables = (loadout.getAll("consumable") as ConsumableId[]).slice(0, consumableSlots);
    run.relics = loadout.getAll("relic") as RelicId[];
  }
  selectedCard = undefined;
  pendingEndTurn = false;
  busy = false;
  impact = [];
  acting = undefined;
  message = "Escolha uma carta para começar.";
  hero.select(heroId);
  lobbyStep = undefined;
  view.lobby.hidden = true;
  view.reset.hidden = false;
  showCampaign();
}

function showCampaign(selection?: number, previousPaper?: DOMRect) {
  clearHandPreview();
  setOutcomeOpen(false);
  if (selection === undefined) window.scrollTo(0, 0);
  if (run.conquered.length) gameAudio.stopHeroVoice();
  const selected = selection ?? availableDestinations(run)[0] ?? 0;
  mapSelection = selected;
  choosingStage = true;
  view.event.hidden = true;
  view.shop.hidden = true;
  view.game.hidden = true;
  view.campaign.hidden = false;
  view.resources.hidden = run.routeNumber === null;
  view.campaign.innerHTML = campaignMap(run, selected, asset);
  if (!reducedMotion.matches) {
    if (previousPaper) animateCampaignOpening(previousPaper);
    const from = selection === undefined ? run.conquered.at(-1) : undefined;
    const to = campaignHeroPosition(run);
    if (from !== undefined && to !== undefined && from !== to) animateCampaignTravel(from, to);
  }
  renderResources();
  view.campaign.querySelector("h1")?.focus({ preventScroll: true });
  checkpoint();
}

function animateCampaignOpening(previous: DOMRect) {
  const paper = view.campaign.querySelector<HTMLElement>(".campaign-paper")!;
  const next = paper.getBoundingClientRect();
  paper.animate([
    {
      transformOrigin: "top left",
      transform: `translate(${previous.left - next.left}px, ${previous.top - next.top}px) scale(${previous.width / next.width}, ${previous.height / next.height})`,
    },
    { transformOrigin: "top left", transform: "none" },
  ], { duration: 470, easing: "cubic-bezier(.22,.7,.26,1)" });
  view.campaign.querySelector(".campaign-detail")?.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 320, delay: 140, fill: "backwards", easing: "ease-out" },
  );
}

function animateCampaignTravel(from: number, to: number) {
  const portrait = view.campaign.querySelector<HTMLElement>("[data-hero-position]")!;
  const { width, height } = portrait.parentElement!.getBoundingClientRect();
  const [fromX, fromY] = encounters[from].marker;
  const [toX, toY] = encounters[to].marker;
  const travel = portrait.animate([
    { translate: `${(fromX - toX) * width / 496}px ${(fromY - toY) * height / 496}px` },
    { translate: "0px 0px" },
  ], { duration: 540, easing: "ease-in-out" });
  const enter = view.campaign.querySelector<HTMLButtonElement>('[data-action="enter-stage"]');
  if (enter) {
    enter.disabled = true;
    const enableEntry = () => { enter.disabled = false; };
    travel.finished.then(enableEntry, enableEntry);
  }
}

function enterStage() {
  window.scrollTo(0, 0);
  view.hand.scrollLeft = 0;
  choosingStage = false;
  view.campaign.hidden = true;
  if (run.phase === "event") {
    showEvent();
    return;
  }
  view.game.hidden = false;
  render();
  view.encounter.querySelector("h1")?.focus({ preventScroll: true });
  gameAudio.stopHeroVoice();
  showPlayerGains({ guard: 0, strength: 0, health: run.moral, energy: TURN_ENERGY, gold: run.money });
  showDraw();
}

function showEvent(pickCard = false) {
  view.event.hidden = false;
  view.event.style.setProperty("--arena-image", `url('${asset(encounters[run.stage].arena)}')`);
  pickingEventCard = pickCard;
  checkpoint();
  const previousHeight = run.eventResult
    ? view.event.querySelector(".event-panel")?.getBoundingClientRect().height
    : undefined;
  renderResources();
  const cardPicker = pickCard ? eventCardOptions(run).map((index) => {
    const id = run.deck[index];
    const preview = currentEvent(run).special?.kind === "upgrade" ? `${id as CardId}+` as const : id;
    return cardTile(preview, "event-card", index);
  }).join("") : "";
  view.event.innerHTML = campaignEvent(run, asset, cardPicker);
  if (previousHeight) view.event.querySelector<HTMLElement>(".event-panel")!.style.minBlockSize = `${previousHeight}px`;
  if (cardPicker) fitCardTitles();
  view.event.querySelector("h1")?.focus({ preventScroll: Boolean(run.eventResult) });
}

let shopFeedbackTimer: number | undefined;

function showShop(purchased?: string) {
  choosingStage = false;
  view.campaign.hidden = true;
  view.shop.hidden = false;
  checkpoint();
  if (!purchased) window.scrollTo(0, 0);
  renderResources();
  const focusedOffer = purchased && view.shop.contains(document.activeElement)
    ? document.activeElement?.closest<HTMLButtonElement>("button[data-action]")
    : null;
  view.shopContent.innerHTML = `
    <header class="shop-header">
      <img src="${asset("shop-merchant")}" alt="">
      <div class="shop-header-caption">
        <h1 id="shop-title" tabindex="-1">Banca do Mascate</h1>
        <button type="button" class="secondary" data-action="leave-shop">Voltar ao mapa →</button>
      </div>
    </header>
    <div class="shop-shelves">
      <div class="shop-shelf shop-card-shelf">
        <section class="shop-section" aria-labelledby="shop-cards-title">
          <h2 id="shop-cards-title" tabindex="-1">Cartas</h2>
          <div class="shop-stock">
            ${run.shopOffers.map(({ card, price, sold }) => cardTile(card, "buy-shop-card", card, {
              disabled: sold || run.money < price,
              shopLabel: sold ? "Vendida" : `<span aria-hidden="true">${glyph.gold}</span> ${price} <small>moedas</small>`,
            })).join("")}
          </div>
        </section>
        <section class="shop-removal" aria-labelledby="shop-remove-title">
          <div>
            <h2 id="shop-remove-title" tabindex="-1">Remover uma carta</h2>
            <p>Uma remoção por visita</p>
          </div>
          <button type="button" class="secondary" data-action="open-shop-deck" aria-haspopup="dialog"
            ${canRemoveShopCard(run) ? "" : "disabled"}>
            ${run.shopRemovedCard ? "Remoção usada" : `Remover · ${glyph.gold} ${SHOP_REMOVAL_PRICE}`}
          </button>
        </section>
      </div>
      ${(["relic", "consumable"] as const).map((kind) => {
        const offers = run.itemOffers.map((offer, index) => {
          if (offer.kind !== kind) return "";
          const item = offer.kind === "relic" ? relics[offer.id] : consumables[offer.id];
          const full = offer.kind === "consumable" && run.consumables.length >= consumableSlots;
          return `<button type="button" class="shop-item" data-action="buy-shop-item" data-value="${index}"
            ${offer.sold || full || run.money < item.price ? "disabled" : ""}>
            <img class="item-art" src="${asset(item.image)}" alt="">
            <strong>${item.name}</strong>
            <small>${item.description}</small>
            <b class="shop-price">${offer.sold ? "Vendido" : full ? "Sem vaga" : `${glyph.gold} ${item.price} <small>moedas</small>`}</b>
          </button>`;
        }).join("");
        return `<section class="shop-section shop-${kind}-shelf" aria-labelledby="shop-${kind}-title">
          <h2 id="shop-${kind}-title" tabindex="-1">${kind === "consumable" ? "Consumíveis" : "Relíquias"}</h2>
          ${offers ? `<div class="shop-items">${offers}</div>` : '<p class="shop-empty">Sem ofertas nesta visita.</p>'}
        </section>`;
      }).join("")}
    </div>`;
  window.clearTimeout(shopFeedbackTimer);
  view.shopFeedback.textContent = purchased ?? "";
  if (purchased) {
    shopFeedbackTimer = window.setTimeout(() => { view.shopFeedback.textContent = ""; }, 3500);
  }
  fitCardTitles();
  if (!purchased) {
    view.shop.querySelector("h1")?.focus({ preventScroll: true });
  } else if (focusedOffer) {
    const section = focusedOffer.closest("section");
    const sectionTitle = section?.getAttribute("aria-labelledby");
    if (sectionTitle) document.getElementById(sectionTitle)?.focus({ preventScroll: true });
  }
}

view.album.addEventListener("close", () => {
  view.settings.showModal();
  view.settings.querySelector<HTMLElement>('[data-action="open-album"]')?.focus();
});

const shopSearch = view.shopDeck.querySelector<HTMLInputElement>("input")!;
const shopDeckGrid = view.shopDeck.querySelector<HTMLElement>(".shop-deck-grid")!;
const shopDeckEmpty = view.shopDeck.querySelector<HTMLElement>(".shop-deck-empty")!;
const shopDeckSelection = view.shopDeck.querySelector<HTMLElement>(".shop-deck-selection")!;
const confirmRemoval = view.shopDeck.querySelector<HTMLButtonElement>('[data-action="confirm-shop-removal"]')!;
const searchKey = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();

function updateShopDeck() {
  if (!shopRemoval) return;
  const query = searchKey(shopRemoval.query);
  let visibleCards = 0;
  for (const tile of shopDeckGrid.querySelectorAll<HTMLButtonElement>(".card")) {
    const index = Number(tile.dataset.value);
    const match = searchKey(cardDefinition(run.deck[index]).name).includes(query);
    tile.hidden = !match;
    if (match) visibleCards++;
    else if (shopRemoval.selected === index) shopRemoval.selected = undefined;
    tile.setAttribute("aria-pressed", String(shopRemoval.selected === index));
  }
  const selected = shopRemoval.selected !== undefined ? run.deck[shopRemoval.selected] : undefined;
  shopDeckSelection.textContent = selected ? cardDefinition(selected).name : "Escolha uma carta";
  confirmRemoval.disabled = !selected;
  shopDeckEmpty.hidden = visibleCards > 0;
  fitCardTitles();
  checkpoint();
}

function openShopDeck(state: NonNullable<Autosave["shopRemoval"]> = { query: "" }) {
  if (!canRemoveShopCard(run)) return;
  shopRemoval = state;
  shopSearch.value = state.query;
  shopDeckGrid.innerHTML = run.deck.map((id, index) => cardTile(id, "select-shop-removal", index)).join("");
  view.shopDeck.showModal();
  shopDeckGrid.scrollTop = 0;
  updateShopDeck();
}

shopSearch.addEventListener("input", () => {
  if (!shopRemoval) return;
  shopRemoval.query = shopSearch.value;
  updateShopDeck();
  shopDeckGrid.scrollTop = 0;
});

view.shopDeck.addEventListener("close", () => {
  if (!shopRemoval) return;
  shopRemoval = undefined;
  checkpoint();
});

function showItemDetails(button: HTMLButtonElement, index?: number) {
  if (busy && !view.game.hidden && !button.matches(".fighter-effect, .intent, [data-hud-help]")) return;
  const usable = index !== undefined && !busy && !choosingStage && canUseConsumable(run, index);
  view.itemDetails.innerHTML = `
    <h2 id="item-details-title"></h2>
    <p></p>
    <div class="item-details-actions">
      <button type="button" class="secondary" data-action="close-item-details" autofocus>Fechar</button>
      ${usable ? `<button type="button" class="primary" data-action="confirm-item" data-value="${index}">Usar item</button>` : ""}
    </div>`;
  view.itemDetails.querySelector("h2")!.textContent = button.dataset.itemName ?? "";
  view.itemDetails.querySelector("p")!.textContent = button.dataset.itemEffect ?? "";
  view.itemDetails.showModal();
}

async function useItem(index: number) {
  if (busy || choosingStage) return;
  const active = run;
  const previousHand = active.hand.length;
  const before = playerCombatStats(active);
  if (!useConsumable(active, index)) return;
  const drawn = active.hand.length - previousHand;
  busy = drawn > 0;
  render(drawn);
  showPlayerGains(before);
  if (drawn) {
    await showDraw(drawn);
    if (run !== active) return;
    busy = false;
    render();
  }
  (view.resources.querySelector<HTMLButtonElement>(".resource-item") ??
    view.turnTools.querySelector<HTMLButtonElement>("button"))?.focus();
}

app.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>(
    "button[data-action]",
  );
  if (!button || button.disabled) return;
  const { action, value } = button.dataset;
  if (action === "settings") {
    view.settings.showModal();
  } else if (action === "close-settings") {
    view.settings.close();
  } else if (action === "open-album") {
    view.settings.close();
    const grid = view.album.querySelector(".album-cards")!;
    if (!grid.childElementCount) {
      grid.innerHTML = (Object.keys(cards) as CardId[]).map((id) => cardTile(id, null, id)).join("");
    }
    view.album.showModal();
    fitCardTitles();
  } else if (action === "close-album") {
    view.album.close();
  } else if (action === "audio" && (value === "music" || value === "effects")) {
    gameAudio.toggle(value);
    refreshAudioControls();
  } else if (action === "choose-faction" && lobbyStep === "faction" && (value === "left" || value === "right")) {
    selectedFaction = value;
    selectedHero = (Object.keys(heroes) as HeroId[]).find((id) => heroes[id].faction === value && heroes[id].playable);
    gameAudio.play("click");
    showLobby("hero");
  } else if (action === "back-faction" && lobbyStep === "hero") {
    gameAudio.play("click");
    showLobby("faction");
  } else if (action === "difficulty" && lobbyStep === "hero" && !previewHero &&
    (value === "easy" || value === "normal" || value === "hard")) {
    selectedDifficulty = value;
    run.difficulty = value;
    checkpoint();
    gameAudio.play("click");
    for (const button of view.lobby.querySelectorAll<HTMLButtonElement>('[data-action="difficulty"]')) {
      button.setAttribute("aria-pressed", String(button.dataset.value === value));
    }
  } else if ((action === "select-hero" || action === "preview-hero") && lobbyStep === "hero" && !previewHero &&
    isHeroId(value) && heroes[value].playable && heroes[value].faction === selectedFaction) {
    if (action === "preview-hero") {
      showLobby("hero", true, value);
      gameAudio.playHeroVoice(value, "selection");
    } else {
      selectedHero = value;
      checkpoint();
      gameAudio.play("click");
      for (const choice of view.lobby.querySelectorAll<HTMLButtonElement>('[data-action="select-hero"]')) {
        choice.setAttribute("aria-pressed", String(choice.dataset.value === value));
      }
      const ready = canStartSelectedHero();
      view.lobby.querySelector<HTMLButtonElement>(".lobby-start")!.disabled = !ready;
      view.lobby.querySelector<HTMLElement>("[data-debug-hint]")?.toggleAttribute("hidden", ready);
    }
  } else if (action === "back-heroes" && lobbyStep === "hero" && previewHero) {
    gameAudio.stopHeroVoice();
    showLobby("hero");
  } else if (action === "start-hero" && lobbyStep === "hero" && !previewHero && selectedHero && canStartSelectedHero()) {
    gameAudio.play("click");
    startSession(selectedHero);
  } else if (action === "reset") {
    gameAudio.stopHeroVoice();
    view.settings.close();
    view.fx.replaceChildren();
    run = newRun(undefined, "lula", selectedDifficulty);
    selectedCard = undefined;
    pendingEndTurn = false;
    busy = false;
    impact = [];
    acting = undefined;
    debugLoadouts = {};
    showLobby("faction");
  } else if (action === "preview-route" && choosingStage && run.routes[Number(value)]) {
    gameAudio.play("click");
    showCampaign(Number(value));
    view.campaign.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
  } else if (action === "choose-route" && choosingStage) {
    const paper = view.campaign.querySelector(".campaign-paper")?.getBoundingClientRect();
    if (!chooseRoute(run, Number(value))) return;
    gameAudio.play("click");
    showCampaign(undefined, paper);
  } else if (action === "confirm-destination" && choosingStage && confirmDestination(run, Number(value))) {
    gameAudio.play("click");
    showCampaign();
  } else if (action === "preview-stage" && choosingStage && availableDestinations(run).includes(Number(value))) {
    gameAudio.play("click");
    showCampaign(Number(value));
    const selected = button.closest(".campaign-destinations") ? ".campaign-destinations" : ".campaign-paper";
    view.campaign.querySelector<HTMLElement>(`${selected} [aria-pressed="true"]`)?.focus({ preventScroll: true });
  } else if (action === "enter-stage" && choosingStage && chooseDestination(run, Number(value))) {
    gameAudio.play("click");
    choosingStage = false;
    if (run.phase === "shop") showShop();
    else enterStage();
  } else if (action === "open-shop-deck") {
    gameAudio.play("click");
    openShopDeck();
  } else if (action === "close-shop-deck") {
    view.shopDeck.close();
  } else if (action === "select-shop-removal" && shopRemoval) {
    gameAudio.play("click");
    const index = Number(value);
    shopRemoval.selected = shopRemoval.selected === index ? undefined : index;
    updateShopDeck();
  } else if (action === "confirm-shop-removal" && shopRemoval?.selected !== undefined) {
    const index = shopRemoval.selected;
    const card = run.deck[index];
    if (!card || !removeShopCard(run, index)) return;
    shopRemoval = undefined;
    view.shopDeck.close();
    gameAudio.play("click");
    showShop(`${cardDefinition(card).name} saiu do baralho.`);
  } else if (action === "buy-shop-card" && value && buyShopCard(run, value as CardId)) {
    gameAudio.play("click");
    showShop(`${cards[value as CardId].name} entrou no baralho.`);
  } else if (action === "buy-shop-item" && buyShopItem(run, Number(value))) {
    gameAudio.play("click");
    const offer = run.itemOffers[Number(value)];
    const item = offer.kind === "relic" ? relics[offer.id] : consumables[offer.id];
    showShop(`${item.name} entrou no inventário.`);
  } else if (action === "item-details" || (action === "use-item" && (event.pointerType === "touch" || matchMedia("(hover: none)").matches))) {
    showItemDetails(button, action === "use-item" ? Number(value) : undefined);
  } else if (action === "close-item-details") {
    view.itemDetails.close();
  } else if (action === "confirm-item") {
    view.itemDetails.close();
    void useItem(Number(value));
  } else if (action === "use-item") {
    void useItem(Number(value));
  } else if (action === "leave-shop" && leaveShop(run)) {
    gameAudio.play("click");
    showCampaign();
  } else if (lobbyStep || choosingStage) {
    return;
  } else if (action === "event-special" && canResolveSpecialEvent(run)) {
    gameAudio.play("click");
    if (resolveSpecialEvent(run)) {
      gameAudio.play("eventSuccess", { delay: reducedMotion.matches ? 0 : .34 });
      showEvent();
    } else {
      showEvent(true);
    }
  } else if (action === "cancel-event-cards" && run.phase === "event") {
    gameAudio.play("click");
    showEvent();
  } else if (action === "event-card" && resolveSpecialEvent(run, Number(value))) {
    gameAudio.play("eventSuccess", { delay: reducedMotion.matches ? 0 : .34 });
    showEvent();
  } else if (action === "event-choice" && (value === "risk" || value === "rest") && resolveEvent(run, value)) {
    gameAudio.play("click");
    gameAudio.play(run.eventResult === "injury" ? "eventFailure" : "eventSuccess", {
      delay: reducedMotion.matches ? 0 : .34,
    });
    showEvent();
  } else if (action === "finish-event" && finishEvent(run)) {
    gameAudio.play("click");
    showCampaign();
  } else if (action === "card") {
    chooseCard(Number(value));
  } else if (action === "target" && selectedCard !== undefined) {
    gameAudio.play("click");
    void useCard(selectedCard, value);
  } else if (action === "end") {
    void endPlayerTurn();
  } else if (
    action === "reward-relic" ? claimRelicReward(run, value as RelicId) :
      (action === "reward" || action === "skip") &&
      claimReward(run, action === "reward" ? (value as CardId) : undefined)
  ) {
    message = "A Moral restante passou para este confronto.";
    if (run.phase === "won") render();
    else showCampaign();
  }
});

document.addEventListener("keydown", (event) => {
  if (view.settings.open || view.album.open || view.outcome.open || view.itemDetails.open || view.shopDeck.open) return;
  if (lobbyStep) {
    if (lobbyStep === "hero" && event.key === "Escape") {
      gameAudio.stopHeroVoice();
      showLobby(previewHero ? "hero" : "faction");
    }
    return;
  }
  if (
    choosingStage ||
    event.repeat ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    run.phase !== "player" ||
    busy
  )
    return;
  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    chooseCard(Number(event.key) - 1);
  } else if (event.key === "Escape" && selectedCard !== undefined) {
    selectedCard = undefined;
    message = "Escolha um personagem.";
    render();
  }
});

const loading = document.querySelector<HTMLElement>("#loading")!;
const progress = loading.querySelector<HTMLProgressElement>("progress")!;
const percent = loading.querySelector<HTMLElement>(".hud-progress-value")!;
await loadGameAssets(asset, (value) => {
  progress.value = value;
  percent.textContent = `${value}%`;
});
loading.remove();
app.hidden = false;
document.addEventListener("pointerdown", () => gameAudio.unlock(), {
  capture: true,
  passive: true,
});
document.addEventListener("keydown", () => gameAudio.unlock(), {
  capture: true,
  passive: true,
});
refreshAudioControls();
installItemTooltip(app);
restoreSession();

function restoreSession() {
  const saved = readAutosave();
  if (!saved) {
    showLobby("faction", false);
    return;
  }

  run = saved.run;
  selectedDifficulty = run.difficulty;
  message = saved.message;
  if (saved.lobby) {
    selectedFaction = saved.lobby.faction;
    selectedHero = saved.lobby.selectedHero;
    showLobby(saved.lobby.step, false, saved.lobby.previewHero);
    return;
  }

  lobbyStep = undefined;
  hero.select(run.hero);
  view.lobby.hidden = true;
  view.reset.hidden = false;
  view.resources.hidden = false;
  if (run.phase === "map") {
    const selections = run.routeNumber === null ? run.routes.map((_, index) => index) : availableDestinations(run);
    showCampaign(selections.includes(saved.mapSelection ?? -1) ? saved.mapSelection : (selections[0] ?? 0));
  } else if (run.phase === "shop") {
    showShop();
    if (saved.shopRemoval) openShopDeck(saved.shopRemoval);
  } else if (run.phase === "event" || (run.phase === "lost" && saved.eventView && run.eventResult)) {
    showEvent(Boolean(saved.eventView?.pickingCard && canResolveSpecialEvent(run)));
  } else {
    view.game.hidden = false;
    pendingEndTurn = saved.pendingEndTurn && run.phase === "player";
    if (run.phase === "player" && saved.selectedCard !== undefined && canPlayCard(run, saved.selectedCard)) {
      selectedCard = saved.selectedCard;
    }
    busy = run.phase === "rivals";
    if (run.phase === "lost") hero.play("death");
    render();
    if (busy) void resolveRivalTurn(run);
    else if (pendingEndTurn) void endPlayerTurn();
  }
}
