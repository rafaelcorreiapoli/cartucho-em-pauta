import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {RoomEntrance} from './room-entrance';

const render = (invited:boolean,roomCode='room-123')=>renderToStaticMarkup(<RoomEntrance initialNick="Rafa" roomCode={roomCode}
  invited={invited} busy={false} message="" onConnect={()=>{}} nickRef={null}/>);

test('a room invitation offers only a primary join action',()=>{
  const html = render(true);
  expect(html).not.toContain('Criar sala');
  expect(html).not.toContain('Aprender a jogar');
  expect(html).toContain('class="hud-button" id="join"');
  expect(html).toContain('value="room-123"');
});
test('returning from a created room keeps create and tutorial even with a remembered room code',()=>{
  const html = render(false);
  expect(html).toContain('Criar sala');
  expect(html).toContain('Aprender a jogar');
  expect(html).toContain('class="hud-button hud-button--secondary" id="join"');
});
