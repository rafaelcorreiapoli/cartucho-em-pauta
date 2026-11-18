import {createRoot} from 'react-dom/client';
import type {PlenaryView} from '../plenary';
import {money} from '../politics';

type RewardKind = 'income' | 'expense' | 'xp' | 'popularity';
type ScreenPoint = {x:number;y:number};
type RewardEffect = {kind:RewardKind;amount:number;sequence:number;head?:ScreenPoint};

export function rewardGains(previous:PlenaryView|undefined, current:PlenaryView, suppressXp:boolean) {
  const before = previous?.politics;
  const after = current.politics;
  if (!before || !after || before.progression.matchId!==after.progression.matchId) return {income:0,xp:0,popularity:0};
  return {
    popularity:suppressXp ? 0 : Math.max(0,after.popularity-before.popularity),
    income:Math.max(0,after.walletIncome-before.walletIncome),
    xp:suppressXp ? 0 : Math.max(0,after.progression.xp-before.progression.xp),
  };
}

export function RewardEffects({effects,finish}:{effects:RewardEffect[];finish:(effect:RewardEffect)=>void}) {
  return effects.map(effect=>{
    const {kind,amount,head,sequence} = effect;
    const style = head && {left:head.x,top:head.y};
    const onAnimationEnd = ()=>finish(effect);
    if (kind==='popularity') {
      return <strong key={sequence} className="wallet-gain popularity-gain" style={style}
        onAnimationEnd={onAnimationEnd}>+{amount} Popularidade</strong>;
    }
    if (kind==='xp') {
      return <strong key={sequence} className="wallet-gain xp-gain" aria-hidden="true" style={style}
        onAnimationEnd={onAnimationEnd}>+{amount} XP</strong>;
    }
    const expense = kind==='expense';
    return <div key={sequence} className={expense ? 'wallet-gain wallet-loss' : 'wallet-gain'} style={style} onAnimationEnd={onAnimationEnd}>
      <svg className="hud-glyph" aria-hidden="true"><use href="#icon-wallet"/></svg>
      <strong>{expense ? '−' : '+'}{money(amount)}</strong>
    </div>;
  });
}

export function mountRewardEffects(host:HTMLElement) {
  const root = createRoot(host);
  const effects = new Map<RewardKind,RewardEffect>();
  let sequence = 0;

  function render() {
    root.render(<RewardEffects effects={[...effects.values()]} finish={effect=>{
      if (effects.get(effect.kind)!==effect) return;
      effects.delete(effect.kind);
      render();
    }}/>);
  }

  return {
    show(kind:RewardKind,amount:number,head?:ScreenPoint) {
      if (kind!=='income' && !head) return;
      const total = kind==='income' || kind==='expense' ? amount+(effects.get(kind)?.amount ?? 0) : amount;
      effects.set(kind,{kind,amount:total,sequence:++sequence,head});
      render();
    },
    destroy() {
      effects.clear();
      root.unmount();
    },
  };
}
