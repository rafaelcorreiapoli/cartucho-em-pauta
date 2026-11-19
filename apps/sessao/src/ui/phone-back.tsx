import {createPortal} from 'react-dom';
import {ChevronLeft} from 'lucide';

export function PhoneBackIcon() {
  return <svg className="hud-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ChevronLeft.map(([tag,attributes],index)=>{
      const Tag = tag as 'path'|'polyline';
      return <Tag key={index} {...attributes}/>;
    })}
  </svg>;
}

export function PhoneBack({label,onBack,disabled}:{label:string;onBack:()=>void;disabled?:boolean}) {
  const host = typeof document==='undefined' ? null : document.querySelector('#phone-back-mount');
  return host ? createPortal(<button className="phone-internal-back" type="button" aria-label={label} title={label} disabled={disabled} onClick={onBack}>
    <PhoneBackIcon/>
  </button>,host) : null;
}
