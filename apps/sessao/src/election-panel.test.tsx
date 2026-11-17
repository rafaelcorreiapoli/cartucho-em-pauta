import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ElectionIndicator,ElectionPolls,ElectionSummary} from './election-panel';

test('the election summary renders the position, trend and remaining time',()=>{
  const markup = renderToStaticMarkup(<ElectionSummary rank={2} atRisk remaining={256}
    candidate={{id:'a',name:'Rafa',character:0,race:'deputy',estimate:20,trend:-2}}/>);
  expect(markup).toContain('3º · 20% · Em risco · -2 pp');
  expect(markup).toContain('4:16');
});

test('the election summary hides the countdown after the match ends',()=>{
  const markup = renderToStaticMarkup(<ElectionSummary rank={-1} atRisk={false} remaining={0}/>);
  expect(markup).toContain('class="election-clock" hidden=""');
});

test('the polls dialog presents the current candidate and uses the shared native close',()=>{
  const candidate = {id:'a',name:'Rafa',character:0,race:'deputy' as const,estimate:73,trend:1};
  const markup = renderToStaticMarkup(<ElectionPolls id="a" onSupport={()=>{}} election={{
    cycle:1,remaining:85,offices:[],polls:[candidate],canObject:false,canCampaign:true,canInterview:false,
  }}/>);
  expect(markup).toContain('id="election-poll-title"');
  expect(markup).toContain('aria-label="Fechar pesquisa eleitoral"');
  expect(markup).toContain('method="dialog"');
  expect(markup).toContain('Rafa (você)');
  expect(markup).toContain('aria-valuenow="73"');
});


test('the election indicator owns the dial and its keyboard shortcut',()=>{
  const markup = renderToStaticMarkup(<ElectionIndicator urgency="high" open={()=>true}
    summary={{rank:0,atRisk:false,remaining:29}}/>);
  expect(markup).toContain('id="election-dock"');
  expect(markup).toContain('data-urgency="high"');
  expect(markup).toContain('aria-keyshortcuts="L"');
  expect(renderToStaticMarkup(<ElectionIndicator open={()=>false}/>)).not.toContain('<button');
});
