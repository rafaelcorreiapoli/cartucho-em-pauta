export function installHudHelp(root:HTMLElement) {
  const popover = document.createElement('div');
  popover.id = 'hud-help-popover';
  popover.className = 'hud-panel hud-help-popover';
  popover.setAttribute('role','tooltip');
  popover.hidden = true;
  document.body.append(popover);
  let anchor:HTMLElement | undefined;
  let pinned = false;
  const source = (target:EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>('[data-help]') : null;

  function close() {
    anchor?.removeAttribute('aria-describedby');
    anchor = undefined;
    pinned = false;
    popover.hidden = true;
  }

  function move() {
    if (!anchor || !anchor.getClientRects().length) return close();
    const bounds = anchor.getBoundingClientRect();
    const x = Math.min(Math.max(8,bounds.left),innerWidth-popover.offsetWidth-8);
    const below = bounds.bottom+7;
    const y = below+popover.offsetHeight<=innerHeight-8 ? below : Math.max(8,bounds.top-popover.offsetHeight-7);
    popover.style.left = `${x}px`;
    popover.style.top = `${y}px`;
  }

  function open(next:HTMLElement, pin=false) {
    if (!next.dataset.help) return;
    if (anchor!==next) anchor?.removeAttribute('aria-describedby');
    anchor = next;
    pinned = pin;
    anchor.setAttribute('aria-describedby',popover.id);
    popover.textContent = next.dataset.help;
    popover.hidden = false;
    move();
  }

  root.addEventListener('pointerover',event => {
    const next = source(event.target);
    if (event.pointerType!=='touch' && next && !pinned) open(next);
  });
  root.addEventListener('pointerout',event => {
    if (!pinned && anchor && source(event.target)===anchor &&
        source(event.relatedTarget)!==anchor && document.activeElement!==anchor) close();
  });
  root.addEventListener('focusin',event => {
    const next = source(event.target);
    if (next && !pinned) open(next);
  });
  root.addEventListener('focusout',event => {
    if (source(event.target)===anchor && !pinned) close();
  });
  document.addEventListener('click',event => {
    const next = source(event.target);
    if (!next || !root.contains(next)) return close();
    if (anchor===next && pinned) close();
    else open(next,true);
  });
  document.addEventListener('keydown',event => { if (event.key==='Escape') close(); });
  window.addEventListener('resize',move);
  root.addEventListener('scroll',move,true);
}
