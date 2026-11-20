async (page) => {
 await page.goto(new URL('/dev/world-rendering-qa.html',page.url()).href);
 await page.waitForFunction(()=>window.qa?.ready);
 return page.evaluate(async()=>{
 const {createActorView,updateActorView}=await import('/src/world-art.ts');
 const q=window.qa;
 const person={...q.frame.people[0],nick:'Nome secreto',cloaked:true,exposed:[{id:1,kind:'briefcase'}]};
 const view=createActorView(q.scene,person);
 q.testView=view;
 const cases=[['walk',{moving:true}],['attack',{swing:{weapon:'baton',startedAt:0,angle:0}}],['hit',{},'hitAt'],['fall',{knockedOut:true},'fallAt'],['phone',{phone:'open'}],['safe-breach',{breachingSafe:true}],['safe-deposit',{pocketing:true}],['npc-robbery',{robberyTarget:{x:160,y:146,direction:1}}]];
 const results=[];
 for(const [action,extra,clock] of cases){
   for(const character of [0,3,7]){
    view.hitAt=undefined;view.fallAt=undefined;
    if(clock)view[clock]=0;
    const actor={...person,character,moving:false,...extra};
    const draw=(pixelScale)=>updateActorView(q.scene,view,actor,140,146,!!actor.moving,120,{frozen:true,pixelScale});
    draw(2);
    if(view.sprite.texture.key!==`collant-${action}`)throw Error(`${action}: ${view.sprite.texture.key}`);
    if(view.label.text||view.label.alpha!==0)throw Error('Identity leaked');
    const size=view.sprite.displayWidth;
    draw(10);
    for(let n=0;n<200&&!q.scene.textures.exists(`collant-${action}-512`);n++)await new Promise(r=>setTimeout(r,20));
    draw(10);
    if(view.sprite.texture.key!==`collant-${action}-512`)throw Error(`Missing HD ${action}: ${view.sprite.texture.key}`);
    if(Math.abs(view.sprite.displayWidth-size)>1e-6)throw Error('HD changed world size');
    if(action==='walk'&&!view.briefcase?.visible)throw Error('Missing briefcase');
   }
   results.push(action);
 }
 return results;
 });
}
