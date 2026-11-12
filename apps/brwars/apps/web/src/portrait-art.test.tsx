import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { HEROES, type HeroKind } from '@brwars/simulation';
import sharp from 'sharp';
import { portraitArt, UNIT_PORTRAIT_FILES } from './portrait-art';
import { UnitPortrait } from './UnitPortrait';
it('cada herói tem portrait próprio sem recorrer a frames de animação', () => {
  const cells = new Set<string>();
  for (const hero of Object.keys(HEROES) as HeroKind[]) {
    const art = portraitArt(HEROES[hero].side, 'hero', hero);
    cells.add(`${art.file}:${art.frame}`);
    const html = renderToStaticMarkup(
      <UnitPortrait side={HEROES[hero].side} kind="hero" hero={hero} />,
    );
    expect(html).toContain(`/assets/${art.file}`);
    expect(html).not.toContain(`/hero-${hero}.png`);
    expect(html).toContain('viewBox=');
  }
  expect(cells.size).toBe(8);
});
it('suporte e tropas têm células distintas e enquadramento quadrado', () => {
  const cells = new Set<string>();
  for (const side of ['left', 'right'] as const)
    for (const kind of ['worker', 'medic', 'front', 'ranged', 'siege'] as const) {
      const art = portraitArt(side, kind);
      cells.add(`${art.file}:${art.frame}`);
      const html = renderToStaticMarkup(<UnitPortrait side={side} kind={kind} />);
      expect(html).toContain('512 512');
      expect(html).not.toContain('animation');
      expect(html).not.toContain('medic-cubano.png');
    }
  expect(cells.size).toBe(10);
});
it('atlas têm proporção exata para evitar recorte de personagem vizinho', async () => {
  for (const file of UNIT_PORTRAIT_FILES) {
    const meta = await sharp(
      new URL(`../public/assets/${file}`, import.meta.url).pathname,
    ).metadata();
    const ratio = meta.width! / meta.height!;
    if (file.startsWith('portraits-variants-')) expect(ratio).toBeCloseTo(1, 1);
    else expect(ratio).toBe(file === 'portraits-troops.png' ? 1.5 : 1);
  }
});
