import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ElectionSummary} from './election-panel';

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
