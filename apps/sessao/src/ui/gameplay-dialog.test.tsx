import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import type {Decoration} from '../photography';
import {DecorationCard,GameplayDialogHeader} from './gameplay-dialog';

test('an app offers back while the inventory and phone home can close the native dialog',()=>{
  const phone = renderToStaticMarkup(<GameplayDialogHeader title="Celular"/>);
  const bag = renderToStaticMarkup(<GameplayDialogHeader title="Inventário" bag/>);
  const app = renderToStaticMarkup(<GameplayDialogHeader title="Pix" back={()=>{}}/>);
  expect(phone).toContain('method="dialog"');
  expect(bag).toContain('bag-title-icon');
  expect(app).toContain('aria-label="Fechar aplicativo" aria-keyshortcuts="Escape"');
  expect(app).not.toContain('method="dialog"');
});

test('the decoration card distinguishes public actions from protected cabinet fixtures',()=>{
  const portrait:Decoration = {id:1,x:10,y:20,kind:'portrait',owner:{id:'host',name:'Rafa'},character:1};
  const render = (decoration:Decoration,ownId='visitor',exploring=true)=>
    renderToStaticMarkup(<DecorationCard decoration={decoration} ownId={ownId} exploring={exploring} send={()=>{}}/>);
  expect(render(portrait)).toContain('>Rabiscar</button>');
  expect(render(portrait,'host')).not.toContain('>Rabiscar</button>');
  expect(render(portrait,'visitor',false)).not.toContain('>Retirar</button>');
  expect(render({...portrait,marked:true})).toContain('Retrato rabiscado');
  expect(render({...portrait,kind:'pizza'})).toContain('Pegar uma fatia');
  expect(render({...portrait,kind:'officeTv',privateOffice:'office-01'})).not.toContain('<button');
});
