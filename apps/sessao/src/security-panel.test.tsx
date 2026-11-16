import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {SecurityDialogContent} from './ui/security-dialog';
import {securityCameras} from './security';

test('the security dialog shows the selected camera and leaves the viewport mounted while it connects',()=>{
  const render = (ready:boolean)=>renderToStaticMarkup(<SecurityDialogContent camera="coffee" ready={ready} send={()=>{}}/>);
  const waiting = render(false);
  for (const {label} of securityCameras) expect(waiting).toContain(label);
  expect(waiting).toContain('aria-pressed="true">Cafezinho');
  expect(waiting).toContain('spy-viewport waiting-for-feed');
  expect(waiting).toContain('role="status">Conectando à câmera…');
  expect(waiting).toContain('method="dialog"');
  expect(render(true)).toContain('spy-viewport');
  expect(render(true)).toContain('role="status">Ao vivo');
  expect(render(true)).not.toContain('waiting-for-feed');
});
