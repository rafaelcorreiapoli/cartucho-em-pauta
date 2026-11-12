import { Clock, Coins } from '@phosphor-icons/react';
export interface ResearchTip {
  title: string;
  category: string;
  level: string;
  current: string;
  next: string;
  cost: string;
  seconds: string;
  status: string;
}
export function readResearchTip(element: HTMLElement): ResearchTip | undefined {
  const d = element.dataset;
  if (!d.hudResearchTitle) return;
  return {
    title: d.hudResearchTitle,
    category: d.hudResearchCategory ?? '',
    level: d.hudResearchLevel ?? '',
    current: d.hudResearchCurrent ?? '',
    next: d.hudResearchNext ?? '',
    cost: d.hudResearchCost ?? '',
    seconds: d.hudResearchSeconds ?? '',
    status: d.hudResearchStatus ?? '',
  };
}
function Effect({ text }: { text: string }) {
  const match = text.match(/^([+−-]?\d+(?:[,.]\d+)?%?)\s+(.*)$/);
  return match ? (
    <>
      <b>{match[1]}</b>
      <span>{match[2]}</span>
    </>
  ) : (
    <span>{text}</span>
  );
}
export function ResearchTooltip({ tip }: { tip: ResearchTip }) {
  return (
    <div className="research-tip">
      <small className="research-tip-category">{tip.category}</small>
      <header>
        <strong>{tip.title}</strong>
        <span>{tip.level}/3</span>
      </header>
      <div className={`research-tip-effects ${tip.next ? '' : 'maxed'}`}>
        <section>
          <small>ATUAL</small>
          <div>
            <Effect text={tip.current} />
          </div>
        </section>
        {tip.next && (
          <section className="research-tip-next">
            <small>PRÓXIMO NÍVEL</small>
            <div>
              <Effect text={tip.next} />
            </div>
          </section>
        )}
      </div>
      {tip.cost && (
        <footer>
          <span>
            <Coins />
            <b>R$ {Number(tip.cost).toLocaleString('pt-BR')}</b>
          </span>
          <span>
            <Clock />
            {tip.seconds}s
          </span>
        </footer>
      )}
      {tip.status && <p>{tip.status}</p>}
    </div>
  );
}
