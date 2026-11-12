import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stageCharacters } from '../../packages/personagens/stage.mjs';

const output = new URL('./dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await cp(new URL('./public/', import.meta.url), output, { recursive: true });
await stageCharacters('cartucho', fileURLToPath(new URL('assets/', output)));
