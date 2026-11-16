import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {CharacterPicker} from './character-picker';

test('the confirmed skin shows both nicknames when players pick the same portrait',()=>{
  const render = (character:number)=>renderToStaticMarkup(<CharacterPicker ownId="a" select={()=>{}} players={[
    {id:'a',nick:'Rafa',character},{id:'b',nick:'Bia <3',character:2},
  ]}/>);
  const before = render(0);
  expect(before).toMatch(/aria-pressed="true"[^>]*><span class="portrait" data-skin="0"/);
  expect(before).toContain('<span title="Rafa">Rafa</span>');
  const after = render(2);
  expect(after).toMatch(/aria-pressed="true"[^>]*><span class="portrait" data-skin="2"/);
  expect(after).toContain('<span title="Rafa">Rafa</span><span title="Bia &lt;3">Bia &lt;3</span>');
  expect(after.match(/aria-pressed="true"/g)).toHaveLength(1);
});
