import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {NearbyItems} from './nearby-items';
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
