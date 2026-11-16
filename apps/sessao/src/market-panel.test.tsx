import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {MarketDialogContent} from './market-panel';

test('the market dialog keeps its accessible heading, body and native dismissal',()=>{
  const markup = renderToStaticMarkup(<MarketDialogContent title="Apoio Técnico"><p>Catálogo</p></MarketDialogContent>);
  expect(markup).toContain('id="market-title">Apoio Técnico');
  expect(markup).toContain('id="market-body"><p>Catálogo');
  expect(markup).toContain('method="dialog"');
  expect(markup).toContain('aria-label="Fechar"');
});
