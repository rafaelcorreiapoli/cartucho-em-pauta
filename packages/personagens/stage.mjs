import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function stageCharacters(variant, destination) {
  const catalog = JSON.parse(await readFile(new URL('./characters.json', import.meta.url)));
  const files = Object.values(catalog).flatMap(character => character[variant] ?? []);
  if (files.length === 0 || !destination) {
    throw new Error('Informe uma variante do catálogo e um diretório de destino.');
  }

  await mkdir(destination, { recursive: true });
  await Promise.all(files.map(file => copyFile(
    new URL(`./assets/${variant}/${file}`, import.meta.url),
    join(destination, file),
  )));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await stageCharacters(process.argv[2], process.argv[3]);
}
