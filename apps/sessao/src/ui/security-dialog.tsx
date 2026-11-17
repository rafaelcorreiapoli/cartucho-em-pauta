import {securityCameras, type SecurityAction, type SecurityCameraId} from '../security';
import {DialogDismiss} from './dialog-dismiss';

export function SecurityDialogContent({camera,ready,send}:{
  camera?:SecurityCameraId; ready:boolean; send:(action:SecurityAction)=>void;
}) {
  return <>
    <header>
      <h2 id="security-title">Sala de Segurança</h2>
      <DialogDismiss label="Fechar terminal" className="hud-button hud-button--secondary"/>
    </header>
    <div className="security-console">
      <div className="security-channels" role="group" aria-label="Câmeras">
        {securityCameras.map(({id,label},index)=><button key={id} type="button" className="hud-button hud-button--secondary spy-channel"
          aria-pressed={id===camera} aria-keyshortcuts={String(index+1)} onClick={()=>send({kind:'select',camera:id})}>
          <span className="flex-1">{label}</span><kbd className="action-key" aria-hidden="true">{index+1}</kbd>
        </button>)}
      </div>
      <section aria-label="Imagem da câmera">
        <div className={ready ? 'spy-viewport' : 'spy-viewport waiting-for-feed'}/>
        <small role="status">{ready ? 'Ao vivo' : 'Conectando à câmera…'}</small>
      </section>
    </div>
  </>;
}
