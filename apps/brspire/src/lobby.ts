import { difficulties, MAX_MORAL, type Difficulty } from "./game";
import { glyph } from "./icons";
import { itemTooltip } from "./item-tooltip";
import { cards, type CardId } from "./catalog";
import { heroes, type HeroId, type Faction } from "./heroes";
import { consumables, consumableSlots, relics } from "./items";
import "./lobby.css";

export type LobbyStep = "faction" | "hero";

const difficultyIcons = { easy: glyph.guard, normal: glyph.attack, hard: glyph.energy };

const heroHealth = `<span class="lobby-hero-health" aria-label="${MAX_MORAL} de vida">${glyph.health} ${MAX_MORAL}</span>`;

export function lobbyScreen(
  step: LobbyStep,
  asset: (name: string) => string,
  selectedDifficulty: Difficulty,
  faction: Faction,
  { selectedHero, debug, ready, preview }: {
    selectedHero?: HeroId;
    debug: boolean;
    ready: boolean;
    preview?: { id: HeroId; renderCard: (id: CardId) => string };
  },
) {
  if (step === "hero" && preview) {
    const hero = heroes[preview.id];
    const startingItems = [
      ...hero.startingItems.map((id) => consumables[id]),
      ...hero.startingRelics.map((id) => relics[id]),
    ];
    return `
      ${backButton("back-heroes")}
      <div class="lobby-details">
        <section class="lobby-bio">
          <img src="${asset(`${preview.id}-portrait`)}" alt="">
          <div class="lobby-bio-copy">
            <h1 id="lobby-title" tabindex="-1">${hero.name}</h1>
            <p>${hero.description}</p>
            ${!debug && startingItems.length ? `
              <div class="lobby-starting-items">
                <small id="starting-items-label">Itens iniciais</small>
                <ul aria-labelledby="starting-items-label">
                  ${startingItems.map((item) => {
                    return `<li><button type="button" data-action="item-details" aria-haspopup="dialog" aria-label="${item.name}" ${itemTooltip(item)}>
                      <img src="${asset(item.image)}" alt="">
                    </button></li>`;
                  }).join("")}
                </ul>
              </div>` : ""}
          </div>
          ${heroHealth}
        </section>
        ${debug ? `
          <form id="debug-loadout" class="lobby-debug-loadout">
            <h2 id="debug-album-title">Álbum de cartas</h2>
            <div class="lobby-deck-scroll" role="region" aria-labelledby="debug-album-title" tabindex="0">
              <ul class="lobby-deck">
                ${(Object.keys(cards) as CardId[]).map((id) => `
                  <li class="lobby-debug-card">
                    ${preview.renderCard(id)}
                    <label><input type="checkbox" name="card" value="${id}" aria-label="${cards[id].name}"></label>
                  </li>`).join("")}
              </ul>
            </div>
            ${debugItems("Itens consumíveis", "consumable", consumables, asset, `Até ${consumableSlots}`)}
            ${debugItems("Relíquias", "relic", relics, asset)}
            <p class="lobby-debug-hint">Selecione pelo menos uma carta para começar.</p>
          </form>` : `
        <section aria-labelledby="starter-deck-title">
          <h2 id="starter-deck-title">Baralho inicial <small>${hero.deck.length} cartas</small></h2>
          <div class="lobby-deck-scroll" role="region" aria-labelledby="starter-deck-title" tabindex="0">
            <ul class="lobby-deck">
              ${hero.deck.map((id) => `<li>${preview.renderCard(id)}</li>`).join("")}
            </ul>
          </div>
        </section>`}
      </div>`;
  }
  const chooseFaction = step === "faction";
  return `
    ${chooseFaction ? "" : backButton("back-faction")}
    <div class="lobby-heading">
      <h1 id="lobby-title" tabindex="-1">${chooseFaction ? "Escolha sua facção" : "Escolha seu herói"}</h1>
    </div>
    ${chooseFaction ? `
      <div class="lobby-factions">
        <button type="button" class="lobby-faction faction-left" data-action="choose-faction" data-value="left">
          <img src="${asset("faction-left")}" alt="">
          <span class="lobby-faction-copy"><strong>Esquerda</strong><small>Escolher facção →</small></span>
        </button>
        <button type="button" class="lobby-faction faction-right" data-action="choose-faction" data-value="right">
          <img src="${asset("faction-right")}" alt="">
          <span class="lobby-faction-copy"><strong>Direita</strong><small>Escolher facção →</small></span>
        </button>
      </div>
    ` : `
      <div class="lobby-roster" data-faction="${faction}">
        ${Object.entries(heroes).filter(([, hero]) => hero.faction === faction).map(([id, hero]) => `
          <article class="lobby-hero">
            <button type="button" class="lobby-hero-select" aria-label="Selecionar ${hero.name}"
              ${hero.playable ? `data-action="select-hero" data-value="${id}" aria-pressed="${id === selectedHero}"` : "disabled"}>
              <span class="lobby-portrait">
                <img src="${asset(`${id}-portrait`)}" alt="">
                ${hero.playable ? '<span class="lobby-selected-badge" aria-hidden="true">✓ Selecionado</span>' : ""}
                <span class="lobby-hero-name"><small>${hero.title}</small><strong>${hero.name}</strong>${heroHealth}</span>
              </span>
            </button>
            ${hero.playable
              ? `<button type="button" class="lobby-cta" data-action="preview-hero" data-value="${id}" aria-label="Ver herói: ${hero.name}">Ver herói <i aria-hidden="true">→</i></button>`
              : '<span class="lobby-cta">🔒 Em breve</span>'}
          </article>
        `).join("")}
      </div>
      <div class="lobby-difficulty" role="group" aria-labelledby="lobby-difficulty-title">
        <span id="lobby-difficulty-title">Dificuldade</span>
        <div class="lobby-difficulty-options">
          ${(Object.keys(difficulties) as Difficulty[]).map((id) => `
            <button type="button" data-action="difficulty" data-value="${id}" aria-pressed="${id === selectedDifficulty}">
              <span aria-hidden="true">${difficultyIcons[id]}</span> ${difficulties[id].label}
            </button>`).join("")}
        </div>
      </div>
      <button type="button" class="primary lobby-start" data-action="start-hero" ${ready ? "" : "disabled"}>
        Conquistar o Brasil <span aria-hidden="true">→</span>
      </button>
      ${debug ? `<p class="lobby-debug-hint" data-debug-hint ${ready ? "hidden" : ""}>Abra os detalhes do herói e selecione pelo menos uma carta.</p>` : ""}
    `}
  `;
}

function backButton(action: "back-faction" | "back-heroes") {
  return `<button type="button" class="lobby-back" data-action="${action}"><span aria-hidden="true">←</span> Voltar</button>`;
}

function debugItems(
  title: string,
  kind: string,
  items: Record<string, { name: string; image: string; description: string }>,
  asset: (name: string) => string,
  hint?: string,
) {
  return `<fieldset class="lobby-debug-items">
    <legend>${title}${hint ? ` <small>${hint}</small>` : ""}</legend>
    ${Object.entries(items).map(([id, item]) => `<label ${itemTooltip(item)}>
      <input type="checkbox" name="${kind}" value="${id}" aria-label="${item.name}. ${item.description}">
      <img src="${asset(item.image)}" alt="">
      <span>${item.name}</span>
    </label>`).join("")}
  </fieldset>`;
}
