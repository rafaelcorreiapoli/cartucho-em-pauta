import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {SurveillanceDialogContent} from './ui/surveillance-dialog';

test('surveillance hosts the channel list and monitor together with native dismissal',()=>{
  const html = renderToStaticMarkup(<SurveillanceDialogContent channels={<button>Câmera 1</button>} monitor={<h3>Visão ao vivo</h3>}/>);
  expect(html).toContain('id="surveillance-title"');
  expect(html).toContain('method="dialog"');
  expect(html).toContain('aria-label="Fechar vigilância"');
  expect(html).toContain('id="spy-channels"><button>Câmera 1</button>');
  expect(html).toContain('id="spy-monitor"><h3>Visão ao vivo</h3>');
});
