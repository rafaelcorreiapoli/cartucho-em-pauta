import {renderToStaticMarkup} from 'react-dom/server';
import {expect,test} from 'bun:test';
import {ParliamentarianDealPanel,refreshVoteOffer} from './parliamentarian-panel';

test('a refreshed NPC vote quote respects the new minimum and clears payment for free votes',()=>{
  expect(refreshVoteOffer(2,4)).toBe(4);
  expect(refreshVoteOffer(5,3)).toBe(5);
  expect(refreshVoteOffer(5,0)).toBe(0);
});

test('the React negotiation modal shows private quotes and disables unaffordable signatures',()=>{
  const deal = {id:'npc1',name:'Sarney',wallet:2,project:'Auxílio Churrasco',projectIndex:0,expiresIn:20,
    documents:[{id:1,title:'Pedido de assinatura',price:3}],minimum:{yes:0,no:4}};
  const markup = renderToStaticMarkup(<ParliamentarianDealPanel deal={deal} round={1} send={()=>{}}/>);
  expect(markup).toContain('<h2 id="parliamentarian-title">Sarney</h2>');
  expect(markup).toContain('Auxílio Churrasco');
  expect(markup).toMatch(/disabled="" aria-keyshortcuts="1">Pedido de assinatura/);
  expect(markup).toContain('aria-keyshortcuts="2">Negociar voto a favor');
  expect(markup).toContain('aria-keyshortcuts="3">Negociar voto contra');
});
