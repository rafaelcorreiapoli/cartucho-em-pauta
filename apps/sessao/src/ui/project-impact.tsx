import {createRoot} from 'react-dom/client';
import type {Impact} from '../plenary';

const metrics = [
  {key:'stability',label:'Estabilidade',icon:'shield'},
  {key:'budget',label:'Orçamento',icon:'wallet'},
] as const;

function Icon({name}:{name:string}) {
  return <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+name}/></svg>;
}

export function ProjectImpact({yes,no}:{yes:Impact;no:Impact}) {
  const decisions = [
    {key:'yes',label:'Se aprovar',icon:'check',impact:yes},
    {key:'no',label:'Se rejeitar',icon:'cross',impact:no},
  ];
  return decisions.map(({key,label,icon,impact})=><div className="impact-card" key={key}>
    <h3><Icon name={icon}/>{label}</h3>
    <div className="impact-values">
      {metrics.map(metric=>{
        const value = impact[metric.key];
        return <span title={metric.label} key={metric.key}>
          <Icon name={metric.icon}/>
          <strong id={key+'-'+metric.key} data-effect={value>0 ? 'gain' : value<0 ? 'loss' : 'neutral'}>
            {value>0 ? '+'+value : value}
          </strong>
          <span className="sr-only"> {metric.label.toLowerCase()}</span>
        </span>;
      })}
    </div>
  </div>);
}

export function mountProjectImpact(host:HTMLElement) {
  const root = createRoot(host);
  let key = '';
  return {
    render(yes:Impact,no:Impact,visible:boolean) {
      const next = visible ? JSON.stringify([yes,no]) : '';
      if (next===key) return;
      key = next;
      host.hidden = !visible;
      root.render(visible ? <ProjectImpact yes={yes} no={no}/> : null);
    },
    destroy() { root.unmount(); host.hidden = true; },
  };
}
