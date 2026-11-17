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

test('only a selected camera renders a live viewport in the monitor',()=>{
  const render = (camera?:{name:string;attach:null})=>renderToStaticMarkup(
    <SurveillanceDialogContent channels={null} monitor={<button>Silenciar alertas</button>} camera={camera}/>,
  );
  expect(render()).not.toContain('spy-viewport');
  expect(render({name:'Câmera do Arquivo',attach:null})).toContain(
    '<h3>Câmera do Arquivo</h3><div class="spy-viewport" aria-label="Visão ao vivo da câmera"></div>',
  );
});
