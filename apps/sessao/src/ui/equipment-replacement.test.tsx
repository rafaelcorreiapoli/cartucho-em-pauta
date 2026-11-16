import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {EquipmentReplacement} from './equipment-replacement';

test('the replacement prompt names both items and exposes separate keyboard actions',()=>{
  const html = renderToStaticMarkup(<EquipmentReplacement equipped="Binóculo" purchased="Modulador de voz" confirm={()=>{}} cancel={()=>{}}/>);
  expect(html).toContain('Binóculo → Modulador de voz');
  expect(html).toMatch(/id="equip-purchase-yes" aria-keyshortcuts="1">Sim/);
  expect(html).toMatch(/id="equip-purchase-no" aria-keyshortcuts="2">Não/);
});
