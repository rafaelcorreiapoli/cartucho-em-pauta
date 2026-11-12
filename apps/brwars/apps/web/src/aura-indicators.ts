import { isAuraBuff, type ActiveAura, type AuraStat } from '@brwars/simulation';
import type Phaser from 'phaser';
/** Tiny vector glyphs stay crisp at any camera zoom; colors indicate beneficial/harmful effects. */
export function drawAuraIndicators(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  effects: Pick<ActiveAura, 'stat' | 'amount'>[],
) {
  const groups = new Map<string, Pick<ActiveAura, 'stat' | 'amount'>>();
  for (const effect of effects) groups.set(`${effect.stat}-${isAuraBuff(effect)}`, effect);
  const icons = [...groups.values()];
  icons.forEach((effect, index) => {
    const row = Math.floor(index / 5),
      columns = Math.min(5, icons.length - row * 5),
      cx = x + ((index % 5) - (columns - 1) / 2) * 11,
      cy = y - row * 11,
      color = isAuraBuff(effect) ? 0x9cde8b : 0xf18b81;
    graphics.fillStyle(0x142114, 0.95).fillRoundedRect(cx - 4.5, cy - 4.5, 9, 9, 1);
    graphics.lineStyle(0.8, color).strokeRoundedRect(cx - 4.5, cy - 4.5, 9, 9, 1);
    glyph(graphics, cx, cy, effect.stat, color);
  });
}
function glyph(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  stat: AuraStat,
  color: number,
) {
  g.lineStyle(1, color);
  g.fillStyle(color);
  if (stat === 'healing') {
    g.fillRect(x - 1, y - 3, 2, 6);
    g.fillRect(x - 3, y - 1, 6, 2);
  } else if (stat === 'damage') {
    g.lineBetween(x - 2, y + 2, x + 2, y - 2);
    g.lineBetween(x - 3, y, x, y + 3);
    g.fillTriangle(x + 1, y - 3, x + 3, y - 3, x + 3, y - 1);
  } else if (stat === 'damageTaken') {
    g.beginPath();
    g.moveTo(x - 2.5, y - 2);
    g.lineTo(x + 2.5, y - 2);
    g.lineTo(x + 2, y + 1);
    g.lineTo(x, y + 3);
    g.lineTo(x - 2, y + 1);
    g.closePath();
    g.strokePath();
  } else if (stat === 'range') {
    g.strokeCircle(x, y, 2);
    g.lineBetween(x - 3.5, y, x + 3.5, y);
    g.lineBetween(x, y - 3.5, x, y + 3.5);
  } else if (stat === 'speed') {
    g.lineBetween(x - 3, y - 2, x, y);
    g.lineBetween(x, y, x - 3, y + 2);
    g.lineBetween(x, y - 2, x + 3, y);
    g.lineBetween(x + 3, y, x, y + 2);
  } else {
    g.lineBetween(x + 1, y - 3, x - 2, y);
    g.lineBetween(x - 2, y, x + 2, y);
    g.lineBetween(x + 2, y, x - 1, y + 3);
  }
}
