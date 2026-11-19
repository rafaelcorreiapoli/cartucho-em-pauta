import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PhoneApps} from './phone-apps';
import {Gameplay} from '../../server/Gameplay';
import type {Player} from '../map';
import type {GameplayWorld} from '../../server/gameplay-world';

test('disabled games disappear while the other phone apps remain available',()=>{
  const html = renderToStaticMarkup(<PhoneApps gamesEnabled={false} select={()=>{}}/>);
  expect(html).not.toContain('Joguinhos');
  for (const name of ['Telefone','Câmera','Pix','Correio']) expect(html).toContain(name);
  expect(renderToStaticMarkup(<PhoneApps select={()=>{}}/>)).toContain('Joguinhos');
});

test('server rejects every minigame action before touching gameplay state',()=>{
  const gameplay = new Gameplay();
  gameplay.phoneGamesEnabled = false;
  for (const kind of ['game-start','game-turn','bets-spin','candy-start','candy-swap'] as const) {
    expect(gameplay.act({} as Player,{kind},{} as GameplayWorld)).toBe('Joguinhos desativados nesta partida.');
  }
});
