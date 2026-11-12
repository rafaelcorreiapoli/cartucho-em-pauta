import { rankingUrl } from './ranking-api.js';

const filters = [...document.querySelectorAll('[data-category]')];
const cards = [...document.querySelectorAll('[data-game]')];
const scoreList = document.querySelector('#scores');
const emptyRanking = document.querySelector('#empty-ranking');
const numberFormat = new Intl.NumberFormat('pt-BR');
const openings = {};
let hasRanking = false;

function updateRanking(counts) {
  for (const card of cards) {
    const id = card.dataset.game;
    const count = counts[id];
    if (Number.isSafeInteger(count) && count >= 0) {
      openings[id] = Math.max(countFor(id), count);
    }
  }
  hasRanking = true;
  emptyRanking.textContent = 'O ranking começa com a primeira abertura.';
  renderRanking();
}

async function loadRanking() {
  try {
    const response = await fetch(rankingUrl);
    if (!response.ok) throw new Error('Ranking indisponível');
    updateRanking(await response.json());
  } catch {
    if (!hasRanking) emptyRanking.textContent = 'Ranking indisponível no momento.';
  }
}

function countFor(id) {
  const count = openings[id];
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

function renderRanking() {
  const rankedGames = cards.map(card => ({
    name: card.querySelector('h3').textContent,
    count: countFor(card.dataset.game),
  })).filter(game => game.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));

  scoreList.replaceChildren();
  for (const [index, game] of rankedGames.entries()) {
    const row = document.createElement('li');
    const position = document.createElement('span');
    position.className = 'score-position';
    position.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('strong');
    name.textContent = game.name;
    const count = document.createElement('span');
    count.className = 'score-count';
    count.textContent = numberFormat.format(game.count);
    row.append(position, name, count);
    scoreList.append(row);
  }
  scoreList.hidden = rankedGames.length === 0;
  emptyRanking.hidden = !scoreList.hidden;
}

for (const filter of filters) {
  filter.addEventListener('click', () => {
    const category = filter.dataset.category;
    for (const button of filters) {
      button.setAttribute('aria-pressed', String(button === filter));
    }
    let visible = 0;
    for (const card of cards) {
      card.hidden = category !== 'todos' && !card.dataset.categories.split(' ').includes(category);
      if (!card.hidden) visible += 1;
    }
    document.querySelector('#filter-status').textContent =
      visible === 1 ? '1 jogo encontrado.' : visible + ' jogos encontrados.';
  });
}

window.addEventListener('pageshow', loadRanking);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void loadRanking();
});
