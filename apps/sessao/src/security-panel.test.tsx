import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {SecurityDialogContent} from './ui/security-dialog';
import {securityCameras} from './security';

test('the security dialog shows the selected camera and leaves the viewport mounted while it connects',()=>{
  const render = (ready:boolean)=>renderToStaticMarkup(<SecurityDialogContent camera="coffee" ready={ready} send={()=>{}} close={()=>{}}/>);
  const waiting = render(false);
  securityCameras.forEach(({id,label},index)=>{
    const key = index+1;
    expect(waiting).toContain(
      `aria-pressed="${id==='coffee'}" aria-keyshortcuts="${key}"><span class="flex-1">${label}</span><kbd class="action-key" aria-hidden="true">${key}</kbd>`,
    );
  });
  expect(waiting).toContain('spy-viewport waiting-for-feed');
  expect(waiting).toContain('role="status">Conectando à câmera…');
  expect(waiting).toContain('type="button" class="hud-button hud-button--secondary" aria-label="Fechar terminal"');
  expect(render(true)).toContain('spy-viewport');
  expect(render(true)).toContain('role="status">Ao vivo');
  expect(render(true)).not.toContain('waiting-for-feed');
});
