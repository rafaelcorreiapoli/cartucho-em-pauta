import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {NearbyActions,NearbyItems} from './nearby-items';
import {objects} from '../gameplay';

test('nearby objects show their portrait, item name and distinct action labels',()=>{
  const markup = renderToStaticMarkup(<NearbyItems items={[
    {key:'supply-coffee',kind:'coffee',name:objects.coffee.name,verb:'Pegar',activate:()=>{}},
    {key:'stored-3',kind:'coffee',name:objects.coffee.name,verb:'Recuperar',activate:()=>{}},
  ]}/>);
  expect(markup).toContain(objects.coffee.portrait);
  expect(markup).toContain('aria-label="Pegar '+objects.coffee.name+'"');
  expect(markup).toContain('aria-label="Recuperar '+objects.coffee.name+'"');
  expect(markup.match(/class="item-caption"/g)).toHaveLength(2);
  expect(renderToStaticMarkup(<NearbyItems items={[]}/>)).toBe('');
});


test('the nearby control exposes a single accessible group and hides it until expanded',()=>{
  const items = [{key:'ground-1',kind:'coffee',name:'Café',verb:'Pegar',activate:()=>{}}] as const;
  const closed = renderToStaticMarkup(<NearbyActions items={items} expanded={false} toggle={()=>{}}/>);
  expect(closed).toContain('aria-controls="nearby-items" aria-expanded="false"');
  expect(closed).toContain('aria-label="Itens ao alcance" hidden=""');
  const open = renderToStaticMarkup(<NearbyActions items={items} expanded toggle={()=>{}}/>);
  expect(open).toContain('aria-expanded="true"');
  expect(open).not.toContain('aria-label="Itens ao alcance" hidden');
  expect(open).toContain('aria-label="Pegar Café"');
});
