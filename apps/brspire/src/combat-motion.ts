import { glyph } from "./icons";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const easing = "cubic-bezier(.2,.75,.24,1)";

export async function presentCard(
  source: HTMLButtonElement,
  arena: HTMLElement,
  layer: HTMLElement,
) {
  const bounds = source.getBoundingClientRect();
  const field = arena.getBoundingClientRect();
  const card = source.cloneNode(true) as HTMLButtonElement;
  card.disabled = false;
  card.removeAttribute("aria-pressed");
  card.removeAttribute("data-action");
  card.style.visibility = "visible";
  card.tabIndex = -1;
  card.setAttribute("aria-hidden", "true");
  card.querySelector("kbd")?.remove();
  card.classList.add("played-card");
  const x = field.left + field.width / 2 - bounds.left - bounds.width / 2;
  const halfHeight = bounds.height * .54;
  const centerY = Math.min(innerHeight - halfHeight, Math.max(halfHeight, field.top + field.height / 2));
  const y = centerY - bounds.top - bounds.height / 2;
  Object.assign(card.style, {
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  });
  source.style.visibility = "hidden";
  layer.append(card);

  const destination = `translate(${x}px, ${y}px) scale(1.08)`;
  const flight = reducedMotion.matches
    ? [
        { transform: destination, opacity: 0 },
        { transform: destination, opacity: 1 },
      ]
    : [{ transform: "none" }, { transform: destination }];
  await card
    .animate(flight, {
      duration: reducedMotion.matches ? 110 : 285,
      easing,
      fill: "forwards",
    })
    .finished.catch(() => {});
  return async (exhaust = false) => {
    if (!card.isConnected) return;
    const burn = exhaust && !reducedMotion.matches;
    const duration = burn ? 640 : 170;
    const flame = document.createElement("span");

    if (burn) {
      const bounds = card.getBoundingClientRect();
      flame.className = "exhaust-flame";
      Object.assign(flame.style, {
        left: `${bounds.left - 12}px`,
        top: `${bounds.bottom - 42}px`,
        width: `${bounds.width + 24}px`,
      });
      flame.setAttribute("aria-hidden", "true");
      layer.append(flame);
      flame.animate([
        { transform: "translateY(0) scaleY(.45)", opacity: 0 },
        { transform: `translateY(-${bounds.height * .2}px) scaleY(1)`, opacity: 1, offset: .2 },
        { transform: `translateY(-${bounds.height}px) scaleY(.65)`, opacity: 0 },
      ], { duration, fill: "both" });
    }

    const frames = burn
      ? [
          { clipPath: "inset(0 0 0 0)", filter: "brightness(1)" },
          { clipPath: "inset(0 0 100% 0)", filter: "brightness(.45) sepia(1)" },
        ]
      : [{ opacity: 1 }, { opacity: 0 }];
    try {
      await card.animate(frames, {
        delay: exhaust ? 0 : reducedMotion.matches ? 40 : 120,
        duration,
        fill: "forwards",
      }).finished.catch(() => {});
    } finally {
      card.remove();
      flame.remove();
    }
  };
}

export async function animateDraw(
  hand: HTMLElement,
  pile: HTMLElement,
  layer: HTMLElement,
  count: number,
) {
  if (count <= 0 || reducedMotion.matches) return;
  const back = pile.querySelector<HTMLElement>(".card-back")!;
  const origin = back.getBoundingClientRect();
  const cards = Array.from(hand.querySelectorAll(".card")).slice(-count);
  await Promise.allSettled(cards.map((card, index) => {
    if (!card.getBoundingClientRect().width) return;
    const bounds = card.getBoundingClientRect();
    const visibleHand = hand.getBoundingClientRect();
    if (bounds.right <= visibleHand.left || bounds.left >= visibleHand.right)
      return;
    const ghost = back.cloneNode(true) as HTMLElement;
    ghost.classList.add("drawing-card");
    Object.assign(ghost.style, {
      left: `${origin.left}px`,
      top: `${origin.top}px`,
      width: `${origin.width}px`,
      height: `${origin.height}px`,
    });
    layer.append(ghost);

    const x = bounds.left + bounds.width / 2 - origin.left - origin.width / 2;
    const y = bounds.top + bounds.height / 2 - origin.top - origin.height / 2;
    const delay = index * 55;
    const flight = ghost.animate(
      [
        { opacity: 0, transform: "none" },
        { opacity: 1, offset: 0.18 },
        {
          opacity: 0,
          transform: `translate(${x}px, ${y}px) rotate(-7deg) scale(1.65)`,
        },
      ],
      { duration: 220, delay, easing, fill: "both" },
    );
    void flight.finished.then(
      () => ghost.remove(),
      () => ghost.remove(),
    );
    return card.animate(
      [
        { opacity: 0, transform: "translateY(10px) scale(.93)" },
        { opacity: 1, transform: getComputedStyle(card).transform },
      ],
      { duration: 190, delay: delay + 140, easing, fill: "backwards" },
    ).finished;
  }));
}

export function floatHit(
  layer: HTMLElement,
  target: HTMLElement,
  { damage, absorbed }: { damage: number; absorbed: number },
) {
  if (!damage && !absorbed) return;
  const { left, top, width, height } = target.getBoundingClientRect();
  const label = document.createElement("span");
  label.className = "floating-hit";
  label.style.left = `${left + width / 2}px`;
  label.style.top = `${top + height * 0.23}px`;
  if (damage) {
    const number = document.createElement("b");
    number.textContent = `−${damage}`;
    label.append(number);
  }
  if (absorbed) {
    const shield = document.createElement("small");
    shield.textContent = `◆ ${absorbed}`;
    label.append(shield);
  }
  layer.append(label);
  const rise = reducedMotion.matches ? 0 : -48;
  const animation = label.animate(
    [
      { opacity: 0, transform: "translate(-50%, 0)" },
      {
        opacity: 1,
        transform: `translate(-50%, ${rise * 0.14}px)`,
        offset: 0.16,
      },
      { opacity: 1, offset: 0.48 },
      { opacity: 0, transform: `translate(-50%, ${rise}px) scale(1)` },
    ],
    { duration: 720, easing: "ease-out", fill: "forwards" },
  );
  void animation.finished.then(
    () => label.remove(),
    () => label.remove(),
  );
}

export function bloodBurst(layer: HTMLElement, target: HTMLElement) {
  if (reducedMotion.matches) return;

  const bounds = target.getBoundingClientRect();
  const burst = document.createElement("span");
  burst.className = "blood-burst";
  burst.style.left = `${bounds.left + bounds.width * 0.5}px`;
  burst.style.top = `${bounds.top + bounds.height * 0.5}px`;
  const droplets = Array.from({ length: 13 }, () => {
    const drop = document.createElement("i");
    drop.style.setProperty("--drop-size", `${3 + Math.random() * 5}px`);
    burst.append(drop);
    return drop;
  });
  layer.append(burst);

  const animations = droplets.map((drop) => {
    const x = (Math.random() - 0.5) * 138;
    const y = -18 - Math.random() * 38;
    const duration = 280 + Math.random() * 135;
    return drop.animate(
      [
        { transform: "translate(0, 0) scale(.8)", opacity: 1 },
        {
          transform: `translate(${x * 0.65}px, ${y}px)`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: `translate(${x}px, ${y + 45}px) scale(.55)`, opacity: 0 },
      ],
      { duration, easing: "ease-out", fill: "forwards" },
    ).finished;
  });
  void Promise.allSettled(animations).then(() => burst.remove());
}

export type CombatEffect = {
  kind: "guard" | "strength" | "health" | "energy" | "gold" | "draw";
  text: string;
};

export function statusBurst(layer: HTMLElement, target: HTMLElement, effects: readonly CombatEffect[]) {
  if (!effects.length) return;
  const { left, top, width, height } = target.getBoundingClientRect();
  const burst = document.createElement("span");
  burst.className = "status-burst";
  burst.style.left = `${left + width / 2}px`;
  burst.style.top = `${top + height * .46}px`;

  const labels = document.createElement("span");
  labels.className = "status-burst-labels";
  for (const effect of effects) {
    const label = document.createElement("span");
    label.dataset.effect = effect.kind;
    label.innerHTML = glyph[effect.kind];
    label.append(effect.text);
    labels.append(label);
  }
  burst.append(labels);
  layer.append(burst);

  const reduced = reducedMotion.matches;
  const labelMotion = labels.animate([
    { opacity: reduced ? 1 : 0, translate: reduced ? "none" : "0 8px" },
    { opacity: 1, offset: .22 },
    { opacity: 1, offset: .66 },
    { opacity: 0, translate: reduced ? "none" : "0 -34px" },
  ], { duration: 630, easing: "ease-out" });
  if (!reduced) {
    for (let index = 0; index < 9; index++) {
      const particle = document.createElement("i");
      particle.dataset.effect = effects[index % effects.length].kind;
      burst.append(particle);
      const angle = index * Math.PI * 2 / 9;
      const x = Math.cos(angle) * Math.min(width * .46, 54);
      const y = Math.sin(angle) * 30;
      particle.animate([
        { translate: `${x * .45}px ${y * .45}px`, opacity: .9, scale: .75 },
        { translate: `${x}px ${y - 20}px`, opacity: 0, scale: .25 },
      ], { duration: 440, easing: "ease-out", fill: "forwards" });
    }
  }
  void labelMotion.finished.then(() => burst.remove(), () => burst.remove());
}

export function lungeAt(attacker: HTMLElement, defender: HTMLElement, impactTime: number) {
  if (reducedMotion.matches) return;
  const from = attacker.getBoundingClientRect();
  const to = defender.getBoundingClientRect();
  const distance = (to.left + to.width / 2) - (from.left + from.width / 2);
  const advance = Math.sign(distance) * Math.min(Math.abs(distance) * .44, 96);
  const recoveryTime = 205;
  const peak = `${advance}px -3px`;
  const duration = impactTime + recoveryTime;
  attacker.animate([
    { translate: "0 0" },
    { translate: peak, offset: impactTime / duration, easing: "ease-out" },
    { translate: "0 0" },
  ], { duration, easing: "ease-in-out" });
  return (updatedSprite: HTMLElement) => updatedSprite.animate(
    [{ translate: peak }, { translate: "0 0" }],
    { duration: recoveryTime, easing: "ease-out" },
  );
}
