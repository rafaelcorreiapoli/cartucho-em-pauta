/** Stable public facade shared by browser and authoritative server. */
export * from './battlefields';
export { botAct } from './bot';
export * from './buildings';
export { execute } from './commands';
export * from './content';
export { automaticProductionSpeed, productionBlockers } from './engine/production';
export { step } from './engine/step';
export * from './finance';
export { grossIncome as income } from './finance';
export * from './game-state';
export * from './healing';
export * from './hero-auras';
export * from './hero-progression';
export * from './heroes';
export * from './model';
export * from './popularity';
export * from './population';
export * from './production-catalog';
export * from './recruitment';
export * from './research';
export * from './spell-rules';
export * from './structure-combat';
export * from './units';

export * from './employment';
