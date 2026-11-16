import {securityCameras, type SecurityAction, type SecurityCameraId} from '../security';
import {DialogDismiss} from './dialog-dismiss';

export function SecurityDialogContent({camera,ready,send}:{
  camera?:SecurityCameraId; ready:boolean; send:(action:SecurityAction)=>void;
}) {
  return <>
    <header>
      <h2 id="security-title">Sala de Segurança</h2>
      <DialogDismiss label="Fechar terminal" className="hud-button hud-button--secondary">✕</DialogDismiss>
    </header>
    <div className="security-console">
      <div className="security-channels" role="group" aria-label="Câmeras">
        {securityCameras.map(({id,label})=><button key={id} type="button" className="hud-button hud-button--secondary spy-channel"
          aria-pressed={id===camera} onClick={()=>send({kind:'select',camera:id})}>{label}</button>)}
      </div>
      <section aria-label="Imagem da câmera">
        <div className={ready ? 'spy-viewport' : 'spy-viewport waiting-for-feed'}/>
        <small role="status">{ready ? 'Ao vivo' : 'Conectando à câmera…'}</small>
      </section>
    </div>
  </>;
}
