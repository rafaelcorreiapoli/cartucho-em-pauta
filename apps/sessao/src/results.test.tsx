import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ElectionResult} from './results';

test('the result shows a single renewal, vote shares and the mandate lost',()=>{
  const html = renderToStaticMarkup(<ElectionResult result={{cycle:1,salary:3,eliminated:'b',offices:[
    {id:'a',name:'Alice',office:'deputy',race:'deputy',character:0,percentage:65},
    {id:'b',name:'Bia',office:'deputy',race:'deputy',character:1,percentage:35},
  ]}}/>);
  expect(html).toContain('Renovação de Mandato 1');
  expect(html).toContain('Alice');
  expect(html).toContain('65%');
  expect(html).toContain('Bia<small>Mandato perdido');
  expect(html).toContain('35%');
  expect(html).not.toMatch(/Presidente|Senador|Deputado/);
});
