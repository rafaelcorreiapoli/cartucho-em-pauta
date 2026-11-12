export function installHandPreview(hand: HTMLElement, compact: MediaQueryList) {
  let source: HTMLButtonElement | undefined;
  let preview: HTMLElement | undefined;

  function clear() {
    preview?.remove();
    preview = undefined;
    source = undefined;
  }

  function show(target: EventTarget | null) {
    const card = target instanceof Element
      ? target.closest<HTMLButtonElement>("button.card:enabled")
      : null;
    if (!compact.matches || !card || !hand.contains(card) || card.style.visibility === "hidden") {
      clear();
      return;
    }
    if (card === source) return;
    clear();

    const bounds = card.getBoundingClientRect();
    const handBounds = hand.getBoundingClientRect();
    if (bounds.right <= handBounds.left || bounds.left >= handBounds.right) return;

    const scale = Math.min(1.24, (innerHeight - 16) / bounds.height, (innerWidth - 16) / bounds.width);
    const width = bounds.width * scale;
    const height = bounds.height * scale;
    const left = Math.max(8, Math.min(bounds.left + (bounds.width - width) / 2, innerWidth - width - 8));
    const top = Math.max(8, Math.min(bounds.bottom - height - 8, innerHeight - height - 8));

    source = card;
    preview = card.cloneNode(true) as HTMLElement;
    preview.classList.add("hand-card-preview");
    preview.toggleAttribute("data-discarding", hand.hasAttribute("data-discarding"));
    preview.removeAttribute("data-action");
    preview.setAttribute("aria-hidden", "true");
    preview.inert = true;
    Object.assign(preview.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      transform: `scale(${scale})`,
    });
    document.body.append(preview);
  }

  hand.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "touch") show(event.target);
  });
  hand.addEventListener("pointerleave", clear);
  hand.addEventListener("pointerdown", clear);
  hand.addEventListener("focusin", (event) => {
    if (event.target instanceof Element && event.target.matches(":focus-visible")) show(event.target);
  });
  hand.addEventListener("focusout", clear);
  window.addEventListener("scroll", clear, { capture: true, passive: true });
  window.addEventListener("resize", clear);
  compact.addEventListener("change", clear);

  return clear;
}
