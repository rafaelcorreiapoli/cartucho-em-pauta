export type ContextKey = {key?:string;overflow?:'false'|'expanded'|'true'};
type ContextButton = {kind:'action'|'nearby'|'item'|'more';visible:boolean;enabled:boolean;group?:string};
type ContextPlacement = 'primary'|'overflow'|'hidden';

export function contextActionKeys(buttons:readonly ContextButton[],expanded:boolean,nearbyOpen:boolean) {
  const primary = buttons.filter(button=>button.visible && button.kind!=='item' && button.kind!=='more');
  const nearby = primary.find(button=>button.kind==='nearby');
  const grouped = new Map<string,ContextButton[]>();
  const units:ContextButton[][] = [];
  for (const button of primary) {
    const unit = button.group===undefined ? undefined : grouped.get(button.group);
    if (unit) unit.push(button);
    else {
      const next = [button];
      units.push(next);
      if (button.group!==undefined) grouped.set(button.group,next);
    }
  }
  const firstUnits = units.slice(0,3);
  if (nearbyOpen && nearby && !firstUnits.some(unit=>unit.includes(nearby))) firstUnits[2] = [nearby];
  const firstRow = firstUnits.flat();
  const overflow = units.flat().filter(button=>!firstRow.includes(button));
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
