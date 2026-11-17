import {renderToStaticMarkup} from 'react-dom/server';
import {expect,test} from 'bun:test';
import {ParliamentarianDealPanel,refreshVoteOffer} from './parliamentarian-panel';

test('a refreshed NPC vote quote respects the new minimum and clears payment for free votes',()=>{
  expect(refreshVoteOffer(2,4)).toBe(4);
  expect(refreshVoteOffer(5,3)).toBe(5);
  expect(refreshVoteOffer(5,0)).toBe(0);
});

test('the React negotiation modal shows private quotes and disables unaffordable signatures',()=>{
  const deal = {session:1,id:'npc1',name:'Sarney',wallet:2,paymentsLeft:1,project:'Auxílio Churrasco',projectIndex:0,expiresIn:20,
    documents:[{id:1,title:'Pedido de assinatura',price:3}],minimum:{yes:0,no:4}};
  const markup = renderToStaticMarkup(<ParliamentarianDealPanel deal={deal} round={1} send={()=>{}}/>);
  expect(markup).toContain('<h2 id="parliamentarian-title">Sarney</h2>');
  expect(markup).toContain('Auxílio Churrasco');
  expect(markup).toMatch(/disabled="" aria-keyshortcuts="1">Pedido de assinatura/);
  expect(markup).toContain('aria-keyshortcuts="2">Negociar voto a favor');
  expect(markup).toMatch(/disabled="" aria-keyshortcuts="3">Negociar voto contra/);
});

test('exhausted payment quota only disables paid offers even with money in the wallet',()=>{
  const deal = {session:1,id:'npc1',name:'Sarney',wallet:8,paymentsLeft:0,project:'Auxílio Churrasco',projectIndex:0,expiresIn:20,
    documents:[{id:1,title:'Pedido pago',price:2},{id:2,title:'Pedido gratuito',price:0}],minimum:{yes:0,no:4}};
  const markup = renderToStaticMarkup(<ParliamentarianDealPanel deal={deal} round={1} send={()=>{}}/>);
  expect(markup).toContain('Limite de pagamentos atingido');
  expect(markup).toMatch(/disabled="" aria-keyshortcuts="1">Pedido pago/);
  expect(markup).toMatch(/aria-keyshortcuts="2">Pedido gratuito/);
  expect(markup).not.toMatch(/disabled="" aria-keyshortcuts="[23]"/);
  expect(markup).toMatch(/disabled="" aria-keyshortcuts="4">Negociar voto contra/);
});
