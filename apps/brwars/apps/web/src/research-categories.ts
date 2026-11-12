import type { CommandPortraitKind } from './CommandPortrait';
import { RESEARCHES, researchCategory, type ResearchKind } from '@brwars/simulation';

export const RESEARCH_CATEGORIES = [
  { name: 'Poderes globais', portrait: 'spell_cooldown' },
  { name: 'Exército', portrait: 'category_army' },
  { name: 'Econômico', portrait: 'category_economy' },
  { name: 'Estrutural', portrait: 'fortification' },
] as const satisfies readonly {
  name: ReturnType<typeof researchCategory>;
  portrait: CommandPortraitKind;
}[];

export const researchGroups = RESEARCH_CATEGORIES.map((category) => ({
  ...category,
  kinds: (Object.keys(RESEARCHES) as ResearchKind[]).filter(
    (kind) => researchCategory(kind) === category.name,
  ),
}));
