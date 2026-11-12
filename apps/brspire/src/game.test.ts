import { expect, test } from "bun:test";
import { cardDefinition, encounters, type Card, type CardId } from "./catalog";
import { eventCatalog } from "./event-catalog";
import { heroes, type HeroId } from "./heroes";
import {
  availableDestinations,
  buyShopCard,
  buyShopItem,
  cardBaseDamage,
  cardHitCount,
  removeShopCard,
  useConsumable,
  chooseRoute,
  routeForks,
  routeLength,
  leaveShop,
  chooseDestination,
  confirmDestination,
  claimReward,
  canPlayCard,
  claimRelicReward,
  endTurn,
  discardFromHand,
  currentEvent,
  type Difficulty,
  encounterRivals,
  campaignLineup,
  finishEvent,
  finishRivals,
  intentFor,
  newRun,
  playCard,
  pendingAttackPenaltyTargets,
  resolveEvent,
  resolveSpecialEvent,
  rivalAct,
  rivalIntent,
} from "./game";

function startedRun(seed: number, hero: HeroId = "lula", route = 0, difficulty: Difficulty = "normal") {
  const run = newRun(seed, hero, difficulty);
  expect(chooseRoute(run, route)).toBe(true);
  if (seed === 75 && route === 0) {
    const order = [...run.order];
    const saoPaulo = order.indexOf(encounters.findIndex(({ uf }) => uf === "sp"));
    [order[0], order[saoPaulo]] = [order[saoPaulo], order[0]];
    run.order = order;
    run.events = run.events.filter((stage) => stage !== order[0]);
  }
  expect(chooseDestination(run, run.order[0])).toBe(true);
  return run;
}

test("turns renew energy and draw five cards, recycling the discard pile", () => {
  const run = startedRun(75);
  expect(run.hand).toHaveLength(5);
  expect(run.energy).toBe(3);
  for (let turn = 1; turn <= 3; turn++) {
    endTurn(run);
    finishRivals(run);
    expect(run.turn).toBe(turn);
    expect(rivalAct(run, "pavanato")?.intent.kind).toBeDefined();
    expect(rivalAct(run, "pavanato")).toBeNull();
    finishRivals(run);
    expect(run.energy).toBe(3);
    expect(run.hand).toHaveLength(5);
    expect(run.hand.length + run.draw.length + run.discard.length).toBe(10);
  }
});

test("guard absorbs announced damage and clears on the next player turn", () => {
  const run = startedRun(75);
  run.hand = ["nurse"];
  const before = run.moral;
  expect(intentFor(run.rivals[0])).toEqual({ kind: "attack", value: 7 });
  expect(playCard(run, 0)?.card.guard).toBe(5);
  expect(run.guard).toBe(5);
  endTurn(run);
  expect(rivalAct(run, "pavanato")).toMatchObject({
    damage: 2,
    absorbed: 5,
    guardBroken: true,
  });
  finishRivals(run);
  expect(run.moral).toBe(before - 2);
  expect(run.guard).toBe(0);
});

test("an absorbed hit only breaks guard when the last point is spent", () => {
  const run = startedRun(75);
  run.guard = 9;
  endTurn(run);
  expect(rivalAct(run, "pavanato")).toMatchObject({
    damage: 0,
    absorbed: 7,
    guardBroken: false,
  });
  expect(run.guard).toBe(2);
});

test("rewards add one card and open the map without restoring Moral", () => {
  const run = startedRun(75);
  run.moral = 27;
  run.rivals[0].moral = 6;
  run.hand = ["militant"];
  expect(playCard(run, 0, "invalid")).toBeNull();
  expect(run.energy).toBe(3);
  expect(playCard(run, 0, "pavanato")?.damage[0].damage).toBe(6);
  expect(run.phase).toBe("reward");
  expect(run.money).toBe(25);
  expect(new Set(run.rewards).size).toBe(3);
  const choice = run.rewards[0];
  expect(claimReward(run, "militant")).toBe(false);
  expect(claimReward(run, choice)).toBe(true);
  expect(run.deck).toHaveLength(11);
  expect(run.deck.at(-1)).toBe(choice);
  expect(run.moral).toBe(27);
  expect(run.money).toBe(25);
  expect(run.phase).toBe("map");
  expect(run.conquered).toEqual([0]);
  expect(claimReward(run, choice)).toBe(false);
  expect(chooseDestination(run, 3)).toBe(false);
  expect(chooseDestination(run, availableDestinations(run)[0])).toBe(true);
});

test("losing Moral ends the session and prevents further turns", () => {
  const run = startedRun(75);
  run.moral = 1;
  endTurn(run);
  rivalAct(run, "pavanato");
  finishRivals(run);
  expect(run.phase).toBe("lost");
  expect(run.moral).toBe(0);
  expect(endTurn(run)).toBe(false);
});

const heroIds: readonly HeroId[] = ["lula", "che", "stalin"];
test("three reproducible routes cover Brazil and lock on confirmation", () => {
  const run = newRun(42);
  expect(run.routes).toEqual(newRun(42).routes);
  expect(new Set(run.routes.map(({ order }) => order.join(","))).size).toBe(3);
  expect(availableDestinations(run)).toEqual([]);
  for (const { order, events, shops, bosses } of run.routes) {
    expect(new Set(order).size).toBe(routeLength + routeForks.length);
    expect(encounters[order.at(-1)!].uf).toBe("df");
    expect(bosses).toHaveLength(4);
    expect(bosses.at(-1)).toBe(order.at(-1));
    expect(bosses.some((stage) => events.includes(stage) || shops.includes(stage))).toBe(false);
    expect(events).toHaveLength(4);
    expect(events).not.toContain(order[0]);
    expect(shops).not.toContain(order[0]);
    expect(shops).toEqual([order[11], order.at(-2)!]);
    expect(events.some((stage) => shops.includes(stage))).toBe(false);
  }
  expect(chooseRoute(run, 2)).toBe(true);
  expect(run.routes).toHaveLength(0);
  expect(chooseRoute(run, 0)).toBe(false);
  run.conquered = run.order.slice(0, 4);
  const [first, second] = availableDestinations(run);
  expect(chooseDestination(run, second)).toBe(true);
  expect(run.order[4]).toBe(second);
  expect(run.order).not.toContain(first);
});

test("confirming a fork locks the route before entering the chosen state", () => {
  const run = newRun(42);
  expect(chooseRoute(run, 0)).toBe(true);
  run.conquered = run.order.slice(0, routeForks[0]);
  const [first, second] = availableDestinations(run);
  const oldStage = run.stage;

  expect(confirmDestination(run, second)).toBe(true);
  expect(run.phase).toBe("map");
  expect(run.stage).toBe(oldStage);
  expect(availableDestinations(run)).toEqual([second]);
  expect(confirmDestination(run, first)).toBe(false);
  expect(chooseDestination(run, first)).toBe(false);
  expect(chooseDestination(run, second)).toBe(true);
  expect(run.stage).toBe(second);
  expect(run.order).not.toContain(first);
  expect(run.confirmedDestination).toBeUndefined();
});

function startFirstEvent() {
  const run = startedRun(6);
  run.conquered.push(run.stage);
  run.phase = "map";
  expect(chooseDestination(run, run.order[1])).toBe(true);
  return run;
}

test("special events award a relic or modify only the chosen deck copy", () => {
  const start = (id: string) => {
    const run = startFirstEvent();
    run.eventIds = [eventCatalog.findIndex((event) => event.id === id)];
    return run;
  };

  const upgrade = start("cpi-da-pandemia");
  const card = "militant";
  upgrade.deck = [card, card];
  expect(resolveSpecialEvent(upgrade, 2)).toBe(false);
  expect(resolveSpecialEvent(upgrade, 1)).toBe(true);
  expect(upgrade.deck).toEqual([card, `${card}+`]);
  expect(resolveSpecialEvent(upgrade, 0)).toBe(false);

  const remove = start("arquivo-do-mensalao");
  remove.deck = [...upgrade.deck];
  expect(resolveSpecialEvent(remove, 0)).toBe(true);
  expect(remove.deck).toEqual([upgrade.deck[1]]);

  const artifact = start("mala-da-jbs");
  expect(resolveSpecialEvent(artifact)).toBe(true);
  expect(artifact.relics).toHaveLength(1);
  expect(resolveSpecialEvent(artifact)).toBe(false);
});

test("events award money or cost Moral only once, and lethal failure ends the run", () => {
  const success = startFirstEvent();
  success.seed = 6;
  expect(resolveEvent(success, "risk")).toBe(true);
  expect(success.money).toBe(20);
  expect(success.conquered).toEqual(success.order.slice(0, 2));
  expect(resolveEvent(success, "risk")).toBe(false);
  expect(finishEvent(success)).toBe(true);
  const failure = startFirstEvent();
  failure.seed = 1200;
  failure.moral = 4;
  expect(resolveEvent(failure, "risk")).toBe(true);
  expect(failure.moral).toBe(0);
  expect(failure.phase).toBe("lost");
  expect(failure.conquered).toEqual(failure.order.slice(0, 1));
});

test("the same state scales with progress and the event pause restores Moral once", () => {
  const early = encounterRivals(1, 0);
  const middle = encounterRivals(1, 9);
  const late = encounterRivals(1, 18);
  const total = (rivals: typeof early) => rivals.reduce((sum, rival) => sum + rival.moral, 0);
  expect(total(encounterRivals(1, 1))).toBeGreaterThan(total(early));
  expect(middle.every(({ name }) => name.endsWith("Nv. 2"))).toBe(true);
  expect(late.every(({ name }) => name.endsWith("Nv. 4"))).toBe(true);
  expect(total(encounterRivals(1, 18, true))).toBeGreaterThan(total(late));
  expect(total(middle)).toBeGreaterThan(total(early));
  expect(total(late)).toBeGreaterThan(total(middle));
  const peakAttack = (rivals: typeof early) => rivals.reduce((sum, rival) =>
    sum + Math.max(0, ...rival.intents.filter(({ kind }) => kind === "attack").map(({ value }) => value)), 0);
  expect(peakAttack(late)).toBeGreaterThan(peakAttack(middle));
  expect(peakAttack(middle)).toBeGreaterThan(peakAttack(early));
  const run = startFirstEvent();
  run.moral = 55;
  expect(resolveEvent(run, "rest")).toBe(true);
  expect(run.moral).toBe(62);
  expect(run.money).toBe(0);
  expect(resolveEvent(run, "rest")).toBe(false);
});

test("late encounters field more distinct rivals and difficulty scales preview and combat alike", () => {
  const early = encounterRivals(0, 0);
  const middle = encounterRivals(0, 8);
  const late = encounterRivals(0, 17);
  expect(early).toHaveLength(1);
  expect(middle).toHaveLength(2);
  expect(late).toHaveLength(3);
  expect(new Set(late.map(({ id }) => id)).size).toBe(late.length);

  const easy = startedRun(75, "lula", 0, "easy");
  const normal = startedRun(75);
  const hard = startedRun(75, "lula", 0, "hard");
  const rival = normal.rivals[0];
  expect(easy.rivals[0].moral).toBe(Math.round(rival.moral * 0.75));
  expect(hard.rivals[0].moral).toBe(Math.round(rival.moral * 1.5));
  expect(intentFor(easy.rivals[0]).value).toBe(Math.round(intentFor(rival).value * 0.9));
  expect(intentFor(hard.rivals[0]).value).toBe(Math.round(intentFor(rival).value * 1.2));
  expect(hard.rivals[0].intents[1]).toEqual(rival.intents[1]);
  expect(hard.rivals[0].moral).toBe(encounterRivals(hard.stage, 0, false, hard.difficulty)[0].moral);
});

const routes = heroIds.flatMap((hero) => [[hero, 0, "easy"], [hero, 1, "easy"], [hero, 2, "easy"]] as const);
test.each([...routes, ["lula", 0, "normal"], ["flavio", 0, "easy"]] as const)("%s can finish route %i on %s with an ordinary draft", (hero, branch, difficulty) => {
  const run = startedRun(37, hero, branch, difficulty);
  expect(run.hero).toBe(hero);
  expect(run.deck).toEqual([...heroes[hero].deck]);
  const priority: CardId[] = hero === "flavio"
    ? ["jacarePfizer", "beachTennis", "niobio", "patriotaCaminhao", "hinoProPneu", "bolsominion"]
    : [
    "greveDoAbc",
    "assembleiaGeral",
    "bolsaFamilia",
    "estoqueRegulador",
    "piquete",
    "mensalao",
    "lavaJato",
    "subidaJuros",
    "quedaBolsa",
    "megaphone",
    "delegate",
    "saudacaoMandioca",
    "mulherSapiens",
    "minhaCasa",
  ];
  const path = [run.stage];
  const rivalIds = new Set<string>();
  let battleStreak = 0;
  for (
    let turn = 0;
    turn < 240 && run.phase !== "won" && run.phase !== "lost";
    turn++
  ) {
    if (run.phase === "reward") {
      battleStreak++;
      expect(battleStreak).toBeLessThanOrEqual(4);
      if (run.bosses.includes(run.stage)) {
        expect(run.rewards).toEqual([]);
        const relic = hero === "lula"
          ? (["carteiraSindicato", "poteVento", "carteiraBandejao", "carimbo", "faixa"] as const)
              .find((id) => run.relicRewards.includes(id)) ?? run.relicRewards[0]
          : run.relicRewards[0];
        expect(run.relics).not.toContain(relic);
        expect(claimRelicReward(run, relic)).toBe(true);
      } else {
        claimReward(run, priority.find((card) => run.rewards.includes(card)));
      }
    }
    if (run.phase === "event") {
      battleStreak = 0;
      expect(resolveEvent(run, "rest")).toBe(true);
      expect(finishEvent(run)).toBe(true);
    }
    if (run.phase === "shop") {
      const card = priority.find((id) => run.shopOffers.some((offer) => offer.card === id));
      if (card) buyShopCard(run, card);
      const heal = run.itemOffers.findIndex((offer) => offer.id === "marmita");
      if (hero !== "flavio") {
        if (run.moral < 58) buyShopItem(run, heal);
        removeShopCard(run, run.deck.indexOf("militant"));
      }
      expect(leaveShop(run)).toBe(true);
    }
    if (run.phase === "map") {
      const options = availableDestinations(run);
      expect(options).toHaveLength(routeForks.includes(run.conquered.length) ? 2 : 1);
      expect(options.every((stage) => !run.conquered.includes(stage))).toBe(true);
      expect(options.some((stage) => encounters[stage].uf === "df")).toBe(run.conquered.length === routeLength - 1);
      const destination = options[(path.length + branch) % options.length];
      const preview = campaignLineup(run, destination);
      expect(chooseDestination(run, destination)).toBe(true);
      if (!run.shops.includes(destination) && !run.events.includes(destination)) expect(run.rivals).toMatchObject(preview);
      path.push(run.stage);
      continue;
    }
    for (const rival of run.rivals) rivalIds.add(rival.id);
    if (run.moral <= 54) useConsumable(run, run.consumables.indexOf("picanha"));
    if (run.moral <= 52) useConsumable(run, run.consumables.indexOf("marmita"));
    for (let move = 0; move < 10 && run.phase === "player"; move++) {
      if (discardFromHand(run, 0)) continue;
      const living = run.rivals.filter(({ moral }) => moral > 0);
      const incoming = living.reduce((sum, rival) => {
        const intent = intentFor(rival);
        return sum + (intent.kind === "attack" ? intent.value : 0);
      }, 0);
      const target = living.sort(
        (a, b) => a.moral + a.guard - b.moral - b.guard,
      )[0];
      const options = run.hand
        .flatMap((id, index) => {
          const card: Card = cardDefinition(id);
          if (!canPlayCard(run, index)) return [];
          const blocks = Math.min(
            (card.guard ?? 0) + (run.gainedStrength ? card.guardAfterStrength ?? 0 : 0) + (card.doubleGuard ? run.guard : 0),
            Math.max(0, incoming - run.guard),
          );
          const damage = card.damage || card.guardDamage
            ? (cardBaseDamage(run, card) + run.strength + run.turnStrength) * cardHitCount(run, card)
            : 0;
          const kills = damage >= target.moral + target.guard ? 8 : 0;
          const score =
            (damage * (card.all ? living.length : 1) +
              (card.strength ?? 0) * 8 + (card.turnStrength ?? 0) * 3 +
              (card.strengthGrowthTurns ?? 0) * 4 + (card.delayedDamage ?? 0) * 0.8 +
              blocks * 2 + Math.min(62 - run.moral, card.heal ?? 0) * 2 +
              kills + (card.retainGuard ?? 0) * 0.4 + (card.draw ?? 0) + (card.coins ?? 0) * 0.15) /
            Math.max(0.3, card.cost);
          return [{ index, score }];
        })
        .sort((a, b) => b.score - a.score);
      if (!options[0]?.score) break;
      playCard(run, options[0].index, target.id);
    }
    if (endTurn(run)) {
      for (const rival of run.rivals) rivalAct(run, rival.id);
      finishRivals(run);
    }
  }

  expect(run.phase).toBe("won");
  expect(run.relics).toHaveLength(hero === "flavio" ? 5 : 4);
  const expectedRivals = hero === "flavio" ? ["jones", "boulos", "suplicy", "dilma", "gotinha", "mandioca", "moraes", "zanin", "duda", "santana", "che", "stalin", "lula"] : ["havan", "moro", "olavo", "jefferson"];
  for (const id of expectedRivals) expect(rivalIds.has(id)).toBe(true);
  const formations = run.encounterHistory.map((ids) => [...ids].sort().join(","));
  expect(new Set(formations).size).toBe(formations.length);
  expect(run.conquered).toEqual(path);
  expect(new Set(run.conquered).size).toBe(routeLength);
});

test("featured rivals apply their announced combat mechanics", () => {
  const run = startedRun(75);
  const prepare = (progress: number, boss: boolean, step = 0) => {
    const rival = encounterRivals(1, progress, boss)[0];
    run.rivals = [{ ...rival, guard: 0, bonus: 0, maxMoral: rival.moral, step }];
    run.phase = "player";
    run.turn = step + 1;
    run.guard = 0;
    return run.rivals[0];
  };

  const havan = prepare(6, true);
  expect(havan.id).toBe("havan");
  expect(endTurn(run)).toBe(true);
  expect(rivalAct(run, havan.id)?.intent.label).toBe("Parcela em 12x");
  expect(intentFor(havan).label).toBe("Segunda parcela");

  const moro = prepare(12, true);
  expect(endTurn(run)).toBe(true);
  expect(rivalAct(run, moro.id)?.intent.kind).toBe("stamp");
  finishRivals(run);
  run.hand = ["militant", "militant"];
  expect(canPlayCard(run, 0)).toBe(false);
  expect(canPlayCard(run, 1)).toBe(true);
  expect(endTurn(run)).toBe(true);
  expect(run.firstCardLocked).toBe(false);

  const olavo = prepare(14, false);
  expect(olavo.id).toBe("olavo");
  expect(intentFor(olavo, 0).kind).toBe("attack");
  expect(intentFor(olavo, 1).kind).toBe("guard");

  const jefferson = prepare(17, true, 1);
  const weakened = intentFor(jefferson).value;
  jefferson.guard = 1;
  expect(intentFor(jefferson).value).toBeGreaterThan(weakened);
});

test("shop purchases debit the balance once and add the card to the next encounter deck", () => {
  const run = startedRun(75);
  run.phase = "map";
  const shop = run.shops[0];
  run.conquered = run.order.slice(0, run.order.indexOf(shop));
  expect(chooseDestination(run, shop)).toBe(true);
  expect(String(run.phase)).toBe("shop");
  expect(run.shopOffers).toHaveLength(3);
  expect(new Set(run.shopOffers.map(({ card }) => card)).size).toBe(3);
  expect(run.itemOffers.filter(({ kind }) => kind === "relic")).toHaveLength(3);
  const offer = run.shopOffers[0];
  expect(buyShopCard(run, offer.card)).toBe(false);
  run.money = offer.price;
  expect(buyShopCard(run, offer.card)).toBe(true);
  expect(run.money).toBe(0);
  expect(run.deck.at(-1)).toBe(offer.card);
  expect(buyShopCard(run, offer.card)).toBe(false);
  expect(leaveShop(run)).toBe(true);
  expect(chooseDestination(run, shop)).toBe(false);
  while (run.events.includes(run.order[run.conquered.length])) {
    expect(chooseDestination(run, run.order[run.conquered.length])).toBe(true);
    expect(resolveEvent(run, "rest")).toBe(true);
    expect(finishEvent(run)).toBe(true);
  }
  expect(chooseDestination(run, run.order[run.conquered.length])).toBe(true);
  expect([...run.hand, ...run.draw]).toContain(offer.card);
});

test("shared cards can grant energy, exhaust and land multiple hits", () => {
  const run = startedRun(75);
  const target = run.rivals[0];
  target.guard = 5;
  run.hand = ["comunistaIphone", "mulherSapiens", "fazOL"];
  expect(playCard(run, 0)).not.toBeNull();
  expect(run.energy).toBe(4);
  expect(run.discard).not.toContain("comunistaIphone");
  expect(playCard(run, 0, target.id)?.damage[0]).toMatchObject({
    absorbed: 5,
    damage: 7,
    guardBroken: true,
  });
  expect(playCard(run, 0)).not.toBeNull();
  expect(run.guard).toBe(8);
  expect(run.deck).not.toContain("comunistaIphone");
});

test("Dobra a Meta doubles existing guard and lethal Moral loss ends the run", () => {
  const run = startedRun(75);
  run.guard = 7;
  run.moral = 3;
  run.rivals[0].moral = 9;
  run.hand = ["dobraMeta", "monstroCoronavirus"];

  expect(playCard(run, 0)).not.toBeNull();
  expect(run.guard).toBe(14);
  expect(playCard(run, 0)?.damage[0].damage).toBe(9);
  expect(run.moral).toBe(0);
  expect(run.phase).toBe("lost");
  expect(run.conquered).toHaveLength(0);
});

test("shop items persist into combat and consumables are spent only when used", () => {
  const run = startedRun(75);
  expect(run.consumables).toEqual(["picanha"]);
  run.phase = "shop";
  run.itemOffers = [
    { kind: "relic", id: "faixa", sold: false },
    { kind: "consumable", id: "cafe", sold: false },
  ];
  run.money = 128;
  expect(buyShopItem(run, 0)).toBe(true);
  expect(buyShopItem(run, 0)).toBe(false);
  expect(buyShopItem(run, 1)).toBe(true);
  expect(run.money).toBe(0);
  expect(useConsumable(run, 1)).toBe(false);
  run.phase = "map";
  expect(chooseDestination(run, run.order[0])).toBe(true);
  expect(run.guard).toBe(6);
  expect(useConsumable(run, 1)).toBe(true);
  expect(run.energy).toBe(4);
  expect(run.consumables).toEqual(["picanha"]);
  expect(useConsumable(run, 1)).toBe(false);
  expect(endTurn(run)).toBe(true);
  for (const rival of run.rivals) rivalAct(run, rival.id);
  finishRivals(run);
  expect(run.guard).toBe(0);
  expect(run.energy).toBe(3);
});

test("Cueca de Dinheiro rewards only the first exhaust in each combat", () => {
  const run = startedRun(75);
  run.relics.push("cueca");
  run.hand = ["comunistaIphone", "mensalao"];
  expect(playCard(run, 0)?.relicCoins).toBe(5);
  expect(playCard(run, 0)?.relicCoins).toBe(0);
  expect(run.money).toBe(5);
  run.phase = "map";
  expect(chooseDestination(run, run.order[0])).toBe(true);
  run.hand = ["comunistaIphone"];
  expect(playCard(run, 0)?.relicCoins).toBe(5);
});

test("Ano de Eleição converts card costs for one turn and negative combat balances cost Moral", () => {
  const run = startedRun(75);
  const rival = run.rivals[0];
  run.hand = ["anoEleicao", "nurse", "subidaJuros", "pixMei"];
  run.energy = 2;
  expect(playCard(run, 0)).toBeNull();
  run.energy = 3;
  expect(playCard(run, 0)?.coinsSpent).toBe(0);
  expect(run.energy).toBe(0);
  expect(playCard(run, 0)?.coinsSpent).toBe(10);
  expect(run.money).toBe(-10);
  expect(playCard(run, 0, rival.id)?.coinsSpent).toBe(20);
  expect(playCard(run, 0)?.coinsSpent).toBe(0);
  run.money = -35;
  expect(endTurn(run)).toBe(true);
  expect(run.electionActive).toBe(false);
  rivalAct(run, rival.id);
  finishRivals(run);

  run.hand = ["militant"];
  rival.moral = 1;
  rival.guard = 0;
  const moral = run.moral;
  expect(playCard(run, 0, rival.id)).toMatchObject({ debtDamage: 10, debtPaid: 10 });
  expect(run.money).toBe(0);
  expect(run.moral).toBe(moral - 10);
  expect(run.phase).toBe("reward");
});

test("Força adds damage to every hit and respects each card's duration", () => {
  const run = startedRun(75);
  const rival = run.rivals[0];
  rival.moral = 200;

  run.hand = ["triplexGuaruja", "entrarOGrosso", "subidaJuros"];
  expect(playCard(run, 0)).toBeTruthy();
  expect(playCard(run, 0)).toBeTruthy();
  expect(playCard(run, 0, rival.id)?.damage[0].damage).toBe(27);
  expect(run.strength).toBe(2);

  const advanceTurn = () => {
    expect(endTurn(run)).toBe(true);
    rivalAct(run, rival.id);
    finishRivals(run);
  };
  advanceTurn();
  expect(run.turnStrength).toBe(0);
  run.hand = ["greveDoAbc"];
  expect(playCard(run, 0)).toBeTruthy();
  expect(run.strength).toBe(2);
  for (const strength of [3, 4, 5, 5]) {
    advanceTurn();
    expect(run.strength).toBe(strength);
  }
  run.hand = ["lavaJato"];
  rival.guard = 0;
  expect(playCard(run, 0, rival.id)?.damage[0].damage).toBe(15);
  expect(run.guard).toBe(7);
});

test("Flávio starts with Bombons and earns coins once per effect while copying Rachadinha", () => {
  const run = startedRun(48, "flavio");
  expect(run.deck).toEqual([...heroes.flavio.deck]);
  expect(run.relics).toEqual(["bombons"]);
  expect(run.rivals.map(({ id }) => id)).toEqual(
    encounterRivals(run.stage, 0, false, "normal", "right").map(({ id }) => id),
  );
  expect(currentEvent(run, run.events[0]).id).toBe("cpi-da-pandemia");
  run.hand = ["gabineteOdio", "rachadinha", "niobio"];
  expect(playCard(run, 0)).toBeTruthy();
  expect(playCard(run, 0)?.bombonCoins).toBe(5);
  expect(run.money).toBe(29);
  expect(run.discard).toEqual(["folhaPagamento", "folhaPagamento"]);
  expect(playCard(run, 0)?.guardGained).toBe(12);
});

test("Flávio's draw and discard requires a choice before combat continues", () => {
  const run = startedRun(48, "flavio");
  run.hand = ["tiozaoZap", "folhaPagamento"];
  run.draw = ["fariaLimer"];
  expect(playCard(run, 0)).toBeTruthy();
  expect(endTurn(run)).toBe(false);
  expect(canPlayCard(run, 0)).toBe(false);
  expect(run.hand).toEqual(["folhaPagamento"]);
  expect(discardFromHand(run, 0)).toEqual({ drawn: 1 });
  expect(run.discard).toContain("folhaPagamento");
  expect(run.hand).toEqual(["fariaLimer"]);
  expect(playCard(run, 0, run.rivals[0].id)?.damage[0].damage).toBe(6);
  expect(run.energy).toBe(2);
});

test("Patriota can win the fight at the next turn and Cloroquina charges Moral then", () => {
  const run = startedRun(48, "flavio");
  const [rival] = run.rivals;
  rival.moral = 8;
  rival.intents = [{ kind: "attack", value: 1 }];
  run.hand = ["cloroquina", "patriotaCaminhao"];
  expect(playCard(run, 0)).toBeTruthy();
  expect(playCard(run, 0, rival.id)).toBeTruthy();
  expect(rival.moral).toBe(8);
  expect(run.moral).toBe(62);
  expect(endTurn(run)).toBe(true);
  rivalAct(run, rival.id);
  expect(finishRivals(run)?.damage[0].damage).toBe(8);
  expect(run.moral).toBe(59);
  expect(run.phase).toBe("reward");
});

test("Gripezinha reduces the next attack and Chapéu prevents a rival's card lock", () => {
  const run = startedRun(48, "flavio");
  const [rival] = run.rivals;
  rival.intents = [{ kind: "stamp", value: 1 }, { kind: "attack", value: 10 }];
  run.hand = ["chapeuAluminio", "gripezinha"];
  expect(playCard(run, 0)).toBeTruthy();
  expect(playCard(run, 0)).toBeTruthy();
  endTurn(run);
  expect(rivalAct(run, rival.id)?.blocked).toBe(true);
  finishRivals(run);
  expect(run.firstCardLocked).toBe(false);
  endTurn(run);
  expect(rivalAct(run, rival.id)?.damage).toBe(3);
  expect(run.rightEffects.weakenAttack).toBe(0);
});

test("the attack penalty preview follows the next eligible attack", () => {
  const run = startedRun(48, "flavio");
  const [base] = run.rivals;
  run.rivals = [
    { ...base, id: "olavo", intents: [{ kind: "predict", value: 10 }] },
    { ...base, id: "pavanato", intents: [{ kind: "attack", value: 10 }] },
  ];
  run.hand = ["gripezinha"];
  expect(playCard(run, 0)).toBeTruthy();
  expect(pendingAttackPenaltyTargets(run)).toEqual([
    { id: "olavo", conditional: true },
    { id: "pavanato", conditional: true },
  ]);

  run.guard = 1;
  endTurn(run);
  expect(pendingAttackPenaltyTargets(run)).toEqual([{ id: "pavanato", conditional: false }]);
  rivalAct(run, "olavo");
  expect(rivalAct(run, "pavanato")?.intent.value).toBe(3);
  expect(pendingAttackPenaltyTargets(run)).toEqual([]);
});

test("Boulos depends on the truck and summoned reinforcements wait until the next turn", () => {
  const run = startedRun(48, "flavio");
  const lineup = encounterRivals(0, 3, false, "normal", "right");
  run.rivals = lineup.map((rival) => ({ ...rival, maxMoral: rival.moral, guard: 0, bonus: 0, step: 0 }));
  const [boulos, truck] = run.rivals;
  truck.moral = 0;
  expect(rivalIntent(run, boulos).kind).toBe("attack");
  truck.moral = truck.maxMoral;
  expect(rivalIntent(run, boulos).kind).toBe("summon");
  endTurn(run);
  rivalAct(run, boulos.id);
  const reinforcement = run.rivals[2];
  expect(reinforcement.id).toBe("militante-mtst");
  expect(rivalAct(run, reinforcement.id)).toBeNull();
  rivalAct(run, truck.id);
  finishRivals(run);
  endTurn(run);
  expect(rivalAct(run, reinforcement.id)?.intent.kind).toBe("attack");
});

test("Dilma's second phase and Moraes's next-turn restriction are resolved in combat", () => {
  const run = startedRun(48, "flavio");
  const [dilma] = encounterRivals(0, 6, true, "normal", "right");
  run.rivals = [{ ...dilma, maxMoral: dilma.moral, moral: Math.floor(dilma.moral / 2), guard: 5, bonus: 0, step: 0 }];
  expect(rivalIntent(run, run.rivals[0]).kind).toBe("doubleGuard");
  endTurn(run);
  rivalAct(run, dilma.id);
  expect(run.rivals[0].guard).toBe(10);
  expect(rivalIntent(run, run.rivals[0]).label).toBe("Vento Estocado");

  const [moraes] = encounterRivals(0, 18, false, "normal", "right");
  run.rivals = [{ ...moraes, maxMoral: moraes.moral, guard: 0, bonus: 0, step: 0 }];
  rivalAct(run, moraes.id);
  finishRivals(run);
  run.hand = ["fariaLimer", "cidadaoDeBem"];
  expect(canPlayCard(run, 0)).toBe(false);
  expect(canPlayCard(run, 1)).toBe(true);
});


test("Flávio starts against Zé Gotinha or Boulos and meets Che, Stalin and Lula as bosses", () => {
  for (const [stage, encounter] of encounters.entries()) {
    if (encounter.uf === "df") {
      expect(encounterRivals(stage, 20, true, "normal", "right").map(({ id }) => id)).toEqual(["lula"]);
      continue;
    }
    for (let progress = 0; progress < 20; progress++) {
      const isBoss = [6, 12, 17].includes(progress);
      const ids = encounterRivals(stage, progress, isBoss, "normal", "right").map(({ id }) => id);
      expect(ids).not.toContain("lula");
      if (progress === 0) expect(["gotinha", "boulos"]).toContain(ids[0]);
      if (progress === 12) expect(ids).toEqual(["che"]);
      else expect(ids).not.toContain("che");
      if (progress === 17) expect(ids).toEqual(["stalin"]);
      else expect(ids).not.toContain("stalin");
    }
  }
});

test("a shop removes the selected copy for 35 coins once per visit", () => {
  const run = startedRun(75);
  run.phase = "shop";
  run.deck = ["militant", "militant+", "militant"];
  run.money = 34;
  expect(removeShopCard(run, 1)).toBe(false);
  run.money = 70;
  expect(removeShopCard(run, -1)).toBe(false);
  expect(removeShopCard(run, 1)).toBe(true);
  expect(run.deck).toEqual(["militant", "militant"]);
  expect(run.money).toBe(35);
  expect(removeShopCard(run, 0)).toBe(false);
  expect(run.money).toBe(35);
  run.shopRemovedCard = false;
  run.deck = ["militant"];
  expect(removeShopCard(run, 0)).toBe(false);
});

test("Estoque Regulador retains remaining guard for Pedalada Fiscal", () => {
  const run = startedRun(75);
  run.hand = ["estoqueRegulador"];
  run.guard = 8;
  expect(playCard(run, 0)?.guardGained).toBe(6);
  expect(endTurn(run)).toBe(true);
  rivalAct(run, "pavanato");
  finishRivals(run);
  expect(run.guard).toBe(6);
  run.hand = ["pedaladaFiscal"];
  expect(playCard(run, 0, "pavanato")?.damage[0].damage).toBe(3);
  expect(run.guard).toBe(6);
});

test("Megafone activates the Sindicato relic and enables the strength payoff", () => {
  const run = startedRun(75);
  run.relics = ["carteiraSindicato"];
  run.consumables = ["megafone", "megafone"];
  run.hand = ["piquete", "assembleiaGeral"];
  run.strength = 1;
  expect(useConsumable(run, 0)).toBe(true);
  expect(run.guard).toBe(7);
  expect(run.hand).toHaveLength(3);
  expect(useConsumable(run, 0)).toBe(true);
  expect(run.guard).toBe(7);
  expect(playCard(run, 0)?.guardGained).toBe(9);
  expect(cardHitCount(run, cardDefinition("assembleiaGeral"))).toBe(3);
});

test("Verba pays election prices before Carimbo do TCU covers a shortfall", () => {
  const run = startedRun(75);
  run.relics = ["carimboTcu"];
  run.consumables = ["verba"];
  run.hand = ["anoEleicao", "nurse", "nurse", "nurse"];
  run.money = 3;
  expect(useConsumable(run, 0)).toBe(true);
  expect(playCard(run, 0)).not.toBeNull();
  expect(playCard(run, 0)?.coinsSpent).toBe(10);
  expect(run.money).toBe(3);
  expect(run.temporaryCoins).toBe(5);
  expect(playCard(run, 0)?.coinsSpent).toBe(8);
  expect(run.money).toBe(0);
  expect(run.temporaryCoins).toBe(0);
  expect(playCard(run, 0)?.coinsSpent).toBe(10);
  expect(run.money).toBe(-10);
});

test("early left rewards include a standalone card and favor a drafted synergy", () => {
  const run = startedRun(75);
  run.deck.push("dobraMeta+");
  run.rivals[0].moral = 6;
  run.hand = ["militant"];
  expect(playCard(run, 0, "pavanato")).not.toBeNull();
  expect(["fazOL", "piquete", "creditoSuplementar", "estatizar", "lavaJato"]).toContain(run.rewards[0]);
  expect(["estoqueRegulador", "pedaladaFiscal", "estatizar", "estocarVento"]).toContain(run.rewards[1]);
  expect(new Set(run.rewards).size).toBe(3);
});

test("lineups avoid reusing a formation and favor rivals absent from recent fights", () => {
  for (const faction of ["left", "right"] as const) {
    const first = encounterRivals(0, 13, false, "normal", faction).map(({ id }) => id);
    const second = encounterRivals(0, 13, false, "normal", faction, [first]).map(({ id }) => id);
    expect(second.some((id) => first.includes(id))).toBe(false);
    expect(encounterRivals(0, 13, false, "normal", faction, [first]).map(({ id }) => id)).toEqual(second);
  }
});

test("both final bosses announce a new pattern when they cross half Moral", () => {
  const stage = encounters.findIndex(({ uf }) => uf === "df");
  for (const [hero, faction, id, opening, followup] of [
    ["lula", "left", "bolsonaro", "Imbrochável", "Motociata"],
    ["flavio", "right", "lula", "Ano de Eleição", "Vai Entrar o Grosso"],
  ] as const) {
    const run = startedRun(75, hero);
    const [boss] = encounterRivals(stage, 20, true, "normal", faction);
    const rival = { ...boss, maxMoral: boss.moral, moral: Math.floor(boss.moral / 2) + 2, guard: 0, bonus: 0, step: 2 };
    run.rivals = [rival];
    run.turn = 3;
    run.hand = [faction === "left" ? "militant" : "fariaLimer"];

    expect(intentFor(rival).label).not.toBe(opening);
    expect(playCard(run, 0, id)?.damage[0].damage).toBeGreaterThan(2);
    expect(rivalIntent(run, rival)).toMatchObject({ kind: "rally", label: opening });
    endTurn(run);
    expect(rivalAct(run, id)?.intent.label).toBe(opening);
    expect(rivalIntent(run, rival)).toMatchObject({ kind: "attack", label: followup });
  }
});
