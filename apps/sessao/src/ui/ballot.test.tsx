import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {Ballot} from './ballot';

const state = {eligible:true,mandate:true,voted:2,electorate:5,quorum:3,cast:()=>{}};

test('the ballot renders the quorum, participation and selected vote',()=>{
  const html = renderToStaticMarkup(<Ballot {...state} hearing={false} vote="yes"/>);
  expect(html).toContain('2/5 votaram · 3 votos a favor para aprovar');
  expect(html).toContain('data-vote="yes" aria-pressed="true"');
  expect(html).toContain('--meter-ratio:0.4');
});

test('the hearing ballot disables voting for a suspended player',()=>{
  const html = renderToStaticMarkup(<Ballot {...state} hearing eligible={false}/>);
  expect(html).toContain('Você está afastado da votação.');
  expect(html).toContain('Não afastar');
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});
