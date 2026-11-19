import {useId,useLayoutEffect,useState} from 'react';
import type {tutorialSteps} from '../tutorial';

type Highlight = NonNullable<(typeof tutorialSteps)[number]['highlight']>;
const targets:Record<Highlight,string> = {
  stats:'#profile-vitals, #profile-resources',
  energy:'.vital-row[data-tone="stamina"]',
  bag:'button[aria-label="Mochila"]',
  equipment:'.equipped-gear-slots',
  agenda:'.react-agenda',
  profile:'.deck-identity',
  apps:'button[aria-label="Aplicativos"], button[aria-label="Celular"], button[aria-label="Celular"] .congress-app-label',
  surveillance:'button[aria-label="Aplicativos"], button[aria-label="Vigilância"], button[aria-label="Vigilância"] .congress-app-label',
  polls:'#election-dock',fire:'#active-fire',power:'#active-outage',
};
type Opening = {x:number;y:number;width:number;height:number};

export function TutorialSpotlight({highlight}:{highlight:Highlight}) {
  const mask = useId();
  const [openings,setOpenings] = useState<Opening[]>([]);
  useLayoutEffect(()=>{
    let frame = 0;
    const resize = new ResizeObserver(schedule);
    const observed = new Set<Element>();
    function measure() {
      frame = 0;
      const nodes = [...document.querySelectorAll<HTMLElement>(targets[highlight])];
      for (const node of observed) if (!nodes.includes(node as HTMLElement)) {resize.unobserve(node);observed.delete(node);}
      const next:Opening[] = [];
      for (const node of nodes) {
        if (!observed.has(node)) {resize.observe(node);observed.add(node);}
        if (!node.checkVisibility()) continue;
        const box = node.getBoundingClientRect();
        if (!box.width || !box.height || box.bottom<=0 || box.top>=innerHeight || box.right<=0 || box.left>=innerWidth) continue;
        next.push({x:box.x-8,y:box.y-8,width:box.width+16,height:box.height+16});
      }
      setOpenings(previous=>JSON.stringify(previous)===JSON.stringify(next) ? previous : next);
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(measure); }
    // HUD sections mount independently; follow their layout without polling the game loop.
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',schedule);
    window.addEventListener('scroll',schedule,true);
    document.addEventListener('transitionend',schedule);
    measure();
    return ()=>{
      cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();
      window.removeEventListener('resize',schedule);
      window.removeEventListener('scroll',schedule,true);
      document.removeEventListener('transitionend',schedule);
    };
  },[highlight]);
  if (!openings.length) return null;
  return <svg className="tutorial-spotlight" aria-hidden="true" data-focus={highlight}>
    <defs><mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
      <rect width="100%" height="100%" fill="white"/>
      {openings.map((box,index)=><rect key={index} {...box} rx="10" fill="black" data-spotlight-opening=""/>)}
    </mask></defs>
    <rect width="100%" height="100%" fill="rgb(3 10 8 / .76)" mask={`url(#${mask})`}/>
    {openings.map((box,index)=><g key={index} fill="none">
      <rect {...box} rx="10" className="tutorial-focus-border"/>
      <rect {...box} rx="10" className="tutorial-focus-pulse"/>
    </g>)}
  </svg>;
}
