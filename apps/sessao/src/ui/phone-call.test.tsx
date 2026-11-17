import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {PhoneCalls} from './phone-call';

const peer = {id:'bia',name:'Bia',character:3};
const props = {contacts:[peer],available:true,send:()=>{}};

test('phone contacts show their portrait and a shortcut',()=>{
  const markup = renderToStaticMarkup(<PhoneCalls {...props}/>);
  expect(markup).toContain('aria-label="Ligar para Bia" aria-keyshortcuts="1"');
  expect(markup).toContain('data-skin="3"');
});

test('only an incoming call offers the answer and decline actions',()=>{
  const incoming = renderToStaticMarkup(<PhoneCalls {...props} call={{state:'incoming',peer}}/>);
  expect(incoming).toContain('Chamada recebida');
  expect(incoming).toContain('Atender');
  expect(incoming).toContain('Recusar');
  expect([...incoming.matchAll(/aria-keyshortcuts="(\d)"/g)].map(match=>match[1])).toEqual(['1','2']);
  const connected = renderToStaticMarkup(<PhoneCalls {...props} call={{state:'connected',peer}}/>);
  expect(connected).toContain('Em ligação');
  expect(connected).toContain('Encerrar');
  expect(connected).not.toContain('Atender');
});
