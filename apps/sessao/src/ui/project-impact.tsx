import {HudIcon} from './hud-icon';
import type {Impact} from '../plenary';

const metrics = [
  {key:'stability',label:'Estabilidade',icon:'shield'},
  {key:'budget',label:'Orçamento',icon:'wallet'},
] as const;

export function ProjectImpact({yes,no}:{yes:Impact;no:Impact}) {
  const decisions = [
    {key:'yes',label:'Se aprovar',icon:'check',impact:yes},
    {key:'no',label:'Se rejeitar',icon:'cross',impact:no},
  ];
  return decisions.map(({key,label,icon,impact})=><div className="impact-card" key={key}>
    <h3><HudIcon name={icon}/>{label}</h3>
    <div className="impact-values">
      {metrics.map(metric=>{
        const value = impact[metric.key];
        return <span title={metric.label} key={metric.key}>
          <HudIcon name={metric.icon}/>
          <strong id={key+'-'+metric.key} data-effect={value>0 ? 'gain' : value<0 ? 'loss' : 'neutral'}>
            {value>0 ? '+'+value : value}
          </strong>
          <span className="sr-only"> {metric.label.toLowerCase()}</span>
        </span>;
      })}
    </div>
  </div>);
}
