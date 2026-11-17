export type ContextKey = {key?:string;overflow?:'false'|'expanded'|'true'};
type ContextButton = {kind:'action'|'nearby'|'item'|'more';visible:boolean;enabled:boolean};
type ContextPlacement = 'primary'|'overflow'|'hidden';

export function contextActionKeys(buttons:readonly ContextButton[],expanded:boolean,nearbyOpen:boolean) {
  const primary = buttons.filter(button=>button.visible && button.kind!=='item' && button.kind!=='more');
  const nearby = primary.find(button=>button.kind==='nearby');
  const firstRow = primary.slice(0,3);
  if (nearbyOpen && nearby && !firstRow.includes(nearby)) firstRow[2] = nearby;
  const overflow = primary.filter(button=>!firstRow.includes(button));
  const hasMore = overflow.length>0;
  const showOverflow = hasMore && expanded && !nearbyOpen;
  const placement = new Map<ContextButton,ContextPlacement>();
  for (const button of firstRow) placement.set(button,'primary');
  for (const button of overflow) placement.set(button,showOverflow ? 'overflow' : 'hidden');

  const more = buttons.find(button=>button.kind==='more');
  const order = nearbyOpen ? [nearby,...buttons.filter(button=>button.kind==='item')]
    : [...firstRow,hasMore ? more : undefined,...(showOverflow ? overflow : [])];
  const keys = new Map<ContextButton,string>();
  for (const button of order) {
    if (!button?.enabled || (!button.visible && button!==more) || keys.size>=9) continue;
    keys.set(button,String(keys.size+1));
  }
  return {
    hasMore,showOverflow,
    buttons:buttons.map(button=>({key:keys.get(button),placement:placement.get(button)})),
  };
}
