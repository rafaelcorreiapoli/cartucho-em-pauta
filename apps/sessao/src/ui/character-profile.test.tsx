import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Gameplay} from '../../server/Gameplay';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import {stations} from '../plenary';
import type {Player} from '../map';
import {CharacterProfile} from './hud';
import {createHudModel} from './hud-model';

test('the player profile draws the private role and assigned office from server state',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((id,character)=>({
    id,nick:id,character,direction:0,moving:false,...stations.coffee,
  }));
  const match = new PlenaryMatch(1);
  const gameplay = new Gameplay();
  expect(match.start(players[0].id,players,0,()=>.9)).toBe(true);
  gameplay.reset(0,()=>.9,players);
  const model = createHudModel();
  const ids = players.map(({id})=>id);
  const render = (player:Player)=>{
    const world = match.gameplayWorld(players,1,()=>false);
    model.player(player);
    model.render({...match.view(player.id,ids,1),gameplay:gameplay.view(player,world)});
    return renderToStaticMarkup(<CharacterProfile model={model}/>);
  };
  const parliamentary = render(players[0]);
  expect(parliamentary).toMatch(/id="hud-nick"[^>]*>Rafa/);
  expect(parliamentary).toContain('data-skin="0"');
  expect(parliamentary).toMatch(/Gabinete 0[1-6]/);
  expect(parliamentary).not.toContain('id="profile-role"');
  model.profileReward.update('+20 XP');
  const infiltrator = render(players[2]);
  expect(infiltrator).toMatch(/id="hud-nick"[^>]*>Caio/);
  expect(infiltrator).toContain('data-skin="2"');
  expect(infiltrator).toContain('aria-label="Infiltrado"');
  expect(infiltrator).toContain('id="profile-xp-reward" role="status">+20 XP');
  const snapshot = model.character.get();
  model.player({...players[2],stamina:70});
  expect(model.character.get()).toBe(snapshot);
});
