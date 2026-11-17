import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {advertisements,type Advertisement} from '../elections';
import {money} from '../politics';
import {DialogHeader} from './dialog-header';
import {useDialogKeys} from './use-dialog-keys';

const formats = Object.keys(advertisements) as Advertisement[];

function CampaignPicker({wallet,buy,close}:{wallet:number;buy:(format:Advertisement)=>void;close:()=>void}) {
  const options = formats.map(format=>{
    const offer = advertisements[format];
    const label = `${offer.name} · ${money(offer.cost)} · +${offer.popularity} de popularidade`;
    return {format,label,affordable:wallet>=offer.cost,activate:()=>buy(format)};
  });
  const keys = useDialogKeys<HTMLDivElement>(
    key=>options[Number(key)-1]?.affordable ? options[Number(key)-1].activate : undefined,
    [{name:'Fechar propaganda',activate:close},...options.filter(option=>option.affordable).map(option=>({
      id:option.format,name:option.label,activate:option.activate,
    }))],
  );
  return <div ref={keys} className="campaign-picker">
    <DialogHeader id="campaign-picker-title" title="Veicular propaganda" dismissLabel="Fechar propaganda" onDismiss={close}/>
    <p>Na carteira <strong>{money(wallet)}</strong></p>
    {options.map(({format,label,affordable,activate},index)=><button key={format} type="button"
      className="hud-button hud-button--secondary" disabled={!affordable} aria-keyshortcuts={affordable ? String(index+1) : undefined}
      onClick={activate}>{label}</button>)}
  </div>;
}

export function mountCampaignPicker(send:(format:Advertisement)=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#campaign-picker')!;
  const root = createRoot(dialog);
  let wallet:number|undefined;
  const close = ()=>dialog.close();
  const buy = (format:Advertisement)=>{
    if (!dialog.open || wallet===undefined || wallet<advertisements[format].cost) return;
    close();
    send(format);
  };
  function render(balance:number) {
    root.render(<CampaignPicker wallet={balance} buy={buy} close={close}/>);
  }
  return {
    update(balance:number|undefined) {
      if (balance===wallet) return;
      wallet = balance;
      if (balance===undefined) close();
      else if (dialog.open) render(balance);
    },
    open() {
      if (wallet===undefined || dialog.open) return;
      const balance = wallet;
      flushSync(()=>render(balance));
      dialog.showModal();
    },
    destroy() { close(); root.unmount(); },
  };
}
