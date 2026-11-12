export function itemTooltip(item: { name: string; description: string }) {
  return `data-item-name="${item.name}" data-item-effect="${item.description}"`;
}

export function installItemTooltip(app: HTMLElement) {
  const tooltip = document.createElement("div");
  tooltip.className = "item-tooltip";
  tooltip.hidden = true;
  tooltip.setAttribute("aria-hidden", "true");
  const name = document.createElement("strong");
  const effect = document.createElement("span");
  tooltip.append(name, effect);
  app.append(tooltip);

  let anchor: HTMLElement | null = null;
  function show(target: EventTarget | null) {
    anchor = target instanceof Element ? target.closest<HTMLElement>("[data-item-effect]") : null;
    tooltip.hidden = !anchor;
    if (!anchor) return;
    name.textContent = anchor.dataset.itemName ?? "";
    effect.textContent = anchor.dataset.itemEffect ?? "";
    const bounds = anchor.getBoundingClientRect();
    const { offsetWidth, offsetHeight } = tooltip;
    tooltip.style.left = `${Math.max(8, Math.min(bounds.left, innerWidth - offsetWidth - 8))}px`;
    tooltip.style.top = `${bounds.bottom + offsetHeight + 8 < innerHeight
      ? bounds.bottom + 8
      : Math.max(8, bounds.top - offsetHeight - 8)}px`;
  }

  app.addEventListener("pointerover", (event) => show(event.target));
  app.addEventListener("pointerout", (event) => {
    if (anchor && event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget)) return;
    show(null);
  });
  app.addEventListener("focusin", (event) => show(event.target));
  app.addEventListener("focusout", () => show(null));
  app.addEventListener("click", () => show(null), true);
  window.addEventListener("scroll", () => show(null), true);
  window.addEventListener("resize", () => show(null));
}
