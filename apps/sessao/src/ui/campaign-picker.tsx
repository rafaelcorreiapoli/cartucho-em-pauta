import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {advertisements,type Advertisement} from '../elections';
import {money} from '../politics';
import {DialogHeader} from './dialog-header';
import {PopularityReward} from './popularity-reward';
import {useDialogKeys} from './use-dialog-keys';

const formats = Object.keys(advertisements) as Advertisement[];

function CampaignPicker({wallet,buy,close}:{wallet:number;buy:(format:Advertisement)=>void;close:()=>void}) {
  const options = formats.map((format,index)=>{
    const offer = advertisements[format];
    const label = `${offer.name} · ${money(offer.cost)} · +${offer.popularity} de popularidade`;
    return {format,offer,label,shortcut:String(index+1),affordable:wallet>=offer.cost,activate:()=>buy(format)};
  });
  const keys = useDialogKeys<HTMLDivElement>(
    key=>options.find(option=>option.shortcut===key && option.affordable)?.activate,
    [{name:'Fechar propaganda',activate:close},...options.filter(option=>option.affordable).map(option=>({
      id:option.format,name:option.label,shortcut:option.shortcut,activate:option.activate,
    }))],
  );
  return <div ref={keys} className="campaign-picker">
    <DialogHeader id="campaign-picker-title" title="Veicular propaganda" dismissLabel="Fechar propaganda" onDismiss={close}/>
    <p>Na carteira <strong>{money(wallet)}</strong></p>
    {options.map(({format,offer,shortcut,affordable,activate})=><button key={format} type="button"
      className="hud-button hud-button--secondary" disabled={!affordable} aria-keyshortcuts={affordable ? shortcut : undefined}
      onClick={activate}>
      <img className="item-portrait" src={`${import.meta.env.BASE_URL}assets/campaign-${format}.webp`} width="48" height="48" alt=""/>
      <span className="campaign-option-info">
        <strong>{offer.name}</strong>
        <span className="campaign-option-details">{money(offer.cost)}
          <span className="react-mission-rewards"><PopularityReward amount={offer.popularity}/></span>
        </span>
      </span>
      <kbd className="action-key" aria-hidden="true">{shortcut}</kbd>
    </button>)}
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
