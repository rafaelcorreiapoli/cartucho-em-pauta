import { expect, it } from 'vitest';
import { createHeroRecord } from '@brwars/simulation';
import { trackHeroDeploymentAudio } from './heroDeploymentAudio';
it('espera o treino, toca ao entrar e repete a fala em cada revive, sem repetir snapshots', () => {
  const track = trackHeroDeploymentAudio([]);
  const record = createHeroRecord('lulinha', 1, 'training');
  expect(track([record])).toEqual([]);
  record.status = 'alive';
  expect(track([record])).toEqual(['lulaEntry']);
  expect(track([record])).toEqual([]);
  for (let revival = 1; revival <= 3; revival++) {
    record.status = 'dead';
    expect(track([record])).toEqual(['heroDeath']);
    record.status = 'reviving';
    expect(track([record])).toEqual([]);
    record.revivals = revival;
    record.status = 'alive';
    expect(track([record])).toEqual(['lulaEntry']);
    expect(track([record])).toEqual([]);
  }
});
it('reconectar não repete uma entrada anterior, mas ainda permite a próxima ressurreição', () => {
  const record = createHeroRecord('lulinha', 3, 'alive');
  record.revivals = 2;
  const track = trackHeroDeploymentAudio([record]);
  expect(track([record])).toEqual([]);
  record.status = 'reviving';
  expect(track([record])).toEqual([]);
  record.revivals++;
  record.status = 'alive';
  expect(track([record])).toEqual(['lulaEntry']);
});
it('reconectar durante treino ou recuperação espera a entrada e não toca fala de outro herói', () => {
  for (const status of ['training', 'reviving'] as const) {
    const record = createHeroRecord('lulinha', 1, status);
    const track = trackHeroDeploymentAudio([record]);
    expect(track([record])).toEqual([]);
    if (status === 'reviving') record.revivals++;
    record.status = 'alive';
    expect(track([record])).toEqual(['lulaEntry']);
  }
});

it.each([
  ['jones', 'jonesEntry'],
  ['stalin', 'stalinEntry'],
  ['trump', 'trumpEntry'],
  ['bolsonaro', 'bolsonaroEntry'],
  ['che', 'cheEntry'],
  ['mamaefalei', 'mamaefaleiEntry'],
  ['marcal', 'marcalEntry'],
] as const)(
  '%s toca a fala própria em nascimento e revive, sem repetição por snapshot',
  (hero, sound) => {
    const record = createHeroRecord(hero, 1, 'training');
    const track = trackHeroDeploymentAudio([]);
    expect(track([record])).toEqual([]);
    record.status = 'alive';
    expect(track([record])).toEqual([sound]);
    expect(track([record])).toEqual([]);
    record.status = 'dead';
    expect(track([record])).toEqual(['heroDeath']);
    record.status = 'reviving';
    expect(track([record])).toEqual([]);
    record.revivals++;
    record.status = 'alive';
    expect(track([record])).toEqual([sound]);
    expect(trackHeroDeploymentAudio([record])([record])).toEqual([]);
  },
);

it('morte confirmada toca uma vez, sem repetir reconexão ou recuperação cancelada', () => {
  const record = createHeroRecord('jones', 1, 'alive');
  const track = trackHeroDeploymentAudio([record]);
  expect(track([record])).toEqual([]);
  record.status = 'dead';
  expect(track([record])).toEqual(['heroDeath']);
  expect(track([record])).toEqual([]);
  expect(trackHeroDeploymentAudio([record])([record])).toEqual([]);
  record.status = 'reviving';
  expect(track([record])).toEqual([]);
  record.status = 'dead';
  expect(track([record])).toEqual([]);
});

it('herói inimigo toca morte dramática, mas não a fala de entrada', () => {
  const record = createHeroRecord('stalin', 1, 'training');
  const track = trackHeroDeploymentAudio([], { entryQuotes: false });
  expect(track([record])).toEqual([]);
  record.status = 'alive';
  expect(track([record])).toEqual([]);
  record.status = 'dead';
  expect(track([record])).toEqual(['heroDeath']);
  expect(track([record])).toEqual([]);
});
