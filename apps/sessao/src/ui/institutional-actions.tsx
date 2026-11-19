import {DialogDismiss} from './dialog-dismiss';
import {useState} from 'react';
import {useDialogKeys} from './use-dialog-keys';
import type {Player} from '../map';
import {canReachStation,type PlenaryView} from '../plenary';
import {money,type PoliticsAction} from '../politics';
import {diversionPercentages,investmentAmounts,investmentAreas,investmentImpact,investmentRules,
  type DiversionPercentage,type InvestmentAmount,type InvestmentArea} from '../public-investments';

export function institutionalActions(view?:PlenaryView,player?:Player) {
  const politics = view?.politics;
  if (!politics || view.phase!=='negotiation' || !player) return {};
  const grant = canReachStation(player,'cabinet') && view.mandate && !politics.suspended && view.ballotCountdown===undefined
    ? {budget:view.budget,cooldown:politics.grantCooldown} : undefined;
  return {grant,stabilityEnabled:view.gameMode!=='calote'};
}

export function InstitutionalActions({model,send,close}:{close?:()=>void;model:ReturnType<typeof institutionalActions>;send:(action:PoliticsAction)=>void}) {
  const [area,setArea] = useState<InvestmentArea>('health');
  const [amount,setAmount] = useState<InvestmentAmount>(investmentAmounts[0]);
  const [diversion,setDiversion] = useState<DiversionPercentage>(0);
  const {grant} = model;
  const canApply = !!grant && !grant.cooldown && grant.budget>=amount;
  const applyGrant = ()=>{
    if (!canApply) return;
    send({kind:'grant',area,amount,diversion});
    setDiversion(0);
  };
  const impact = investmentImpact(amount,diversion);
  const duration = (impact.duration/1000).toLocaleString('pt-BR')+' s';
  const effects = {
    health:`Até +${impact.hp} PV por jogador em pé`,
    safety:`Próximo incêndio adiado em ${duration}`,
    supplies:`${investmentRules.suppliesDiscount}% de desconto na Lanchonete por ${duration}`,
    transport:`+${investmentRules.transportSpeedBonus}% na caminhada por ${duration}`,
  };
  const areaChoices = (Object.keys(investmentAreas) as InvestmentArea[]).map(value=>({
    label:investmentAreas[value],selected:value===area,activate:()=>setArea(value),
  }));
  const amountChoices = investmentAmounts.map(value=>({
    label:money(value),selected:value===amount,activate:()=>setAmount(value),
  }));
  const diversionChoices = diversionPercentages.map(value=>({
    label:`Desviar ${value}%`,selected:value===diversion,activate:()=>setDiversion(value),
  }));
  const grantLabel = 'Aplicar verba de '+money(amount);
  const actions = useDialogKeys<HTMLDivElement>(()=>undefined,[
    ...(close ? [{name:'Fechar ações institucionais',activate:close}] : []),
    ...(grant ? [...areaChoices,...amountChoices,...diversionChoices].map(({label,activate})=>({name:label,activate})) : []),
    ...(canApply ? [{name:grantLabel,activate:applyGrant}] : []),
  ]);
  return <div id="politics-actions" ref={actions}>
    <header className="social-header">
      <h2 id="institutional-title">Ações institucionais</h2>
      {close && <DialogDismiss label="Fechar ações institucionais" onDismiss={close}/>}
    </header>
    {grant && <form id="cabinet-form" onSubmit={event=>{
      event.preventDefault();
      applyGrant();
    }}>
      <h3>Aplicar verba</h3>
      <p>Orçamento disponível <strong>{money(grant.budget)}</strong></p>
      <InvestmentChoices title="Área" choices={areaChoices}/>
      <InvestmentChoices title="Verba retirada do caixa" choices={amountChoices}/>
      <InvestmentChoices title="Desvio para sua carteira" choices={diversionChoices}/>
      <div className="investment-preview" aria-label="Prévia privada">
        <span>{money(impact.invested)} para {investmentAreas[area]}</span>
        <span>+{money(impact.diverted)} na sua carteira</span>
        <span hidden={model.stabilityEnabled===false}>{model.stabilityEnabled!==false && <>+{impact.stability} de estabilidade</>}</span>
        <strong>{effects[area]}</strong>
      </div>
      {grant.cooldown>0 ? <p role="status">Disponível em {grant.cooldown} s</p> :
        grant.budget<amount && <p role="status">Orçamento insuficiente</p>}
      <button className="hud-button" type="submit" disabled={!canApply}>{grantLabel}</button>
    </form>}
  </div>;
}

function InvestmentChoices({title,choices}:{title:string;choices:{label:string;selected:boolean;activate:()=>void}[]}) {
  return <>
    <div className="section-label">{title}</div>
    <div className="choice-grid" role="group" aria-label={title}>
      {choices.map(({label,selected,activate})=><button key={label} type="button"
        className="hud-button hud-button--secondary game-choice" aria-pressed={selected} onClick={activate}>{label}</button>)}
    </div>
  </>;
}
