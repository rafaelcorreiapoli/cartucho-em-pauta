import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ElectionIndicator,ElectionPolls,ElectionSummary} from './election-panel';

test('the election summary renders the header and a ranked portrait for each visible player',()=>{
  const markup = renderToStaticMarkup(<ElectionSummary atRisk remaining={256}
    leader={{name:'Bia',character:1,rank:1}} personal={{name:'Rafa',character:0,rank:3}}/>);
  expect(markup).toContain('Pesquisa Eleitoral');
  expect(markup).toContain('4:16');
  expect(markup).toContain('data-skin="1"');
  expect(markup).toContain('data-rank="1">1º');
  expect(markup).toContain('>Bia</bdi>');
  expect(markup).toContain('data-skin="0"');
  expect(markup).toContain('data-rank="3">3º');
  expect(markup).toContain('>Rafa</bdi>');
  expect(markup).toContain('Em risco');
});

test('the election summary displays only the leader when there is no separate personal standing',()=>{
  const markup = renderToStaticMarkup(<ElectionSummary leader={{name:'Rafa',character:0,rank:1}}
    atRisk={false} remaining={0}/>);
  expect(markup).toContain('class="election-clock" dir="ltr" hidden=""');
  expect(markup).toContain('>Rafa</bdi>');
  expect(markup.match(/data-rank=/g)).toHaveLength(1);
  expect(markup).not.toContain('election-personal');
});

test('the polls dialog presents the current candidate and uses the shared native close',()=>{
  const candidate = {id:'a',name:'Rafa',character:0,race:'deputy' as const,estimate:73.12,trend:1.23};
  const markup = renderToStaticMarkup(<ElectionPolls id="a" election={{
    cycle:2,remaining:85,offices:[],polls:[candidate],result:{cycle:1,offices:[]},canObject:false,canCampaign:true,canInterview:false,
  }}/>);
  expect(markup).toContain('id="election-poll-title"');
  expect(markup).toContain('aria-label="Fechar pesquisa eleitoral"');
  expect(markup).toContain('method="dialog"');
  expect(markup).not.toContain('Renovação 1');
  expect(markup.match(/<section\b/g)).toHaveLength(1);
  expect(markup).toContain('Rafa (você)');
  expect(markup).toContain('Pesquisa Eleitoral');
  expect(markup).not.toContain('Classificação projetada');
  expect(markup).not.toContain('Os percentuais');
  expect(markup).toContain('73,12%');
  expect(markup).toContain('Ninguém corre risco');
  expect(markup).toContain('+1,23 pp');
  expect(markup).toContain('aria-valuenow="73.12"');
});


test('the polls give candidates with the same displayed percentage a shared position',()=>{
  const polls = [18,17,17,16,16,16].map((estimate,index)=>({
    id:String(index),name:'Candidato '+index,character:index,race:'deputy' as const,estimate,trend:0,
  }));
  const markup = renderToStaticMarkup(<ElectionPolls id="5" election={{
    cycle:1,remaining:85,offices:[],polls,canObject:false,canCampaign:true,canInterview:false,
  }}/>);
  expect([...markup.matchAll(/data-rank="(\d+)"/g)].map(match=>match[1])).toEqual(['1','2','2','3','3','3']);
  expect(markup.match(/class="poll-tie"> \(Empate\)</g)).toHaveLength(5);
  expect(markup).not.toContain('Apoio público');
  expect(markup.match(/Em risco de perder o mandato/g)).toHaveLength(3);
});

test('the election indicator owns the dial and its keyboard shortcut',()=>{
  const markup = renderToStaticMarkup(<ElectionIndicator urgency="high" open={()=>true}
    summary={{atRisk:false,remaining:29}}/>);
  expect(markup).toContain('id="election-dock"');
  expect(markup).toContain('data-urgency="high"');
  expect(markup).toContain('aria-keyshortcuts="L"');
  expect(markup).not.toContain('<kbd');
  expect(renderToStaticMarkup(<ElectionIndicator open={()=>false}/>)).not.toContain('<button');
});

test('only the electoral risk state marks the dock for the red glow',()=>{
  const indicator = (atRisk:boolean)=>renderToStaticMarkup(<ElectionIndicator urgency="high" open={()=>true}
    summary={{atRisk,remaining:29}}/>);
  expect(indicator(true)).toContain('data-at-risk="true"');
  expect(indicator(false)).not.toContain('data-at-risk=');
});
