async (page) => {
  const browser = page.context().browser();
  const base = page.url();
  const context = await browser.newContext({viewport: {width: 1280, height: 800}});
  const qaPage = await context.newPage();
  const errors = [];
  qaPage.on('pageerror', error => errors.push(error.message));
  await qaPage.goto(new URL('/dev/world-rendering-qa.html', base).href);
  await qaPage.waitForFunction(() => window.qa?.ready);
  const samples = await qaPage.evaluate(async () => {
    const {updateWorldArt, worldArtKey} = await import('/src/adaptive-world-art.ts');
    const {updateSafeArt} = await import('/src/draw-map.ts');
    const {adaptivePoseArt, adaptiveWalkArt} = await import('/src/adaptive-character-art.ts');
    const {worldAssets} = await import('/src/world-assets.ts');
    const {visitorRoster} = await import('/src/visitors.ts');
    const qa = window.qa, scene = qa.scene;
    const terminal = scene.add.image(140,146,'security-terminal').setDisplaySize(45,34);
    const desk = scene.add.image(145,146,'office',1).setDisplaySize(45,23);
    const npc = scene.add.image(150,146,'npc-vendor').setDisplaySize(38,38);
    const trump = scene.add.image(155,146,'npc-credentialsVendor').setDisplaySize(38,38);
    const safe = scene.add.image(160,146,'office-safe').setDisplaySize(19,24);
    const viewport = {x:100,y:100,width:100,height:100};
    const wait = () => new Promise(resolve => setTimeout(resolve,30));
    async function settle() {
      for (let n=0;n<500;n++) { await wait(); if (scene.game.scene.scenes.every(scene=>!scene.load.isLoading())) return; }
      throw new Error('Optional art loading did not settle');
    }
    const sample = () => [terminal,desk,npc,trump].map(image=>({key:image.texture.key,frame:image.frame.name,width:image.displayWidth,height:image.displayHeight,x:image.x,y:image.y}));
    updateWorldArt(scene,2,viewport);
    const low = sample();
    updateWorldArt(scene,4.65,viewport); await settle(); updateWorldArt(scene,4.65,viewport);
    const medium = sample();
    if (medium[0].key !== 'hires:terminal-seguranca:256' || medium[1].key !== 'hires:office:384') throw new Error('Wrong 1440p object tier: '+JSON.stringify(medium));
    updateWorldArt(scene,9.3,viewport); await settle(); updateWorldArt(scene,9.3,viewport);
    const high = sample();
    if (high[0].key !== 'hires:terminal-seguranca:512' || high[1].key !== 'hires:office:768' || high[2].key !== 'hires:daniel-vorcaro:512') throw new Error('Wrong dense-screen object tier: '+JSON.stringify(high));
    if (high[3].key !== 'npc-credentialsVendor') throw new Error('Trump was changed');
    for (const samples of [medium,high]) samples.forEach((sample,n)=>{
      for (const field of ['frame','width','height','x','y']) if (Math.abs(Number(sample[field])-Number(low[n][field]))>1e-8 || field==='frame' && sample[field]!==low[n][field]) throw new Error(`Detail switch moved or reframed an object: ${field}`);
    });
    if (worldArtKey(safe)!=='office-safe') throw new Error('Closed safe lost its logical state');
    updateSafeArt(safe,true); updateWorldArt(scene,9.3,viewport); await settle(); updateWorldArt(scene,9.3,viewport);
    const openKey = safe.texture.key;
    updateSafeArt(safe,true);
    if (safe.texture.key!==openKey || worldArtKey(safe)!=='office-safe-open' || safe.displayWidth!==33.25) throw new Error('Open safe reverted or changed size');
    updateSafeArt(safe,false); updateWorldArt(scene,9.3,viewport);
    if (worldArtKey(safe)!=='office-safe') throw new Error('Safe did not close');
    updateWorldArt(scene,2,viewport);
    if (terminal.texture.key!=='security-terminal' || desk.texture.key!=='office' || npc.texture.key!=='npc-vendor') throw new Error('Small render did not return to base textures');
    const animations=Object.values(worldAssets).filter(asset=>asset.kind==='animation');
    for (const asset of animations) adaptivePoseArt(scene,{key:asset.id,frame:0},9.3);
    await settle();
    for (const asset of animations) {
      const art=adaptivePoseArt(scene,{key:asset.id,frame:0},9.3);
      if (art.key!==`${asset.id}-512`) throw new Error(`Animation did not upgrade: ${asset.id}`);
      const expected=asset.id.endsWith('door-breach') ? 16 : 12;
      if (scene.textures.get(art.key).frameTotal!==expected+1) throw new Error(`Incomplete frame grid: ${asset.id}`);
    }
    for (const {id} of visitorRoster) {
      const art=adaptiveWalkArt(scene,0,id,9.3);
      if (!scene.anims.exists(`${art.animation}-2`)) throw new Error(`Missing walk directions: ${id}`);
    }
    return {low,medium,high,animationSheets:animations.length,safeState:true,trump:'unchanged'};
  });
  await context.close();
  const ui=[];
  for (const [width,density,expected] of [[48,1,128],[48,2,128],[155,1,256],[155,2,512]]) {
    const context=await browser.newContext({deviceScaleFactor:density});
    try {
      const uiPage=await context.newPage();
      await uiPage.goto(new URL('/',base).href);
      const source=await uiPage.evaluate(async width=>{
        const {assetImageSources}=await import('/src/world-assets.ts');
        const image=new Image();const sources=assetImageSources('retrato-primeiros-socorros.webp',`${width}px`);
        image.sizes=sources.sizes;image.srcset=sources.srcSet;image.src=sources.src;
        image.style.width=`${width}px`;document.body.append(image);await image.decode();return image.currentSrc;
      },width);
      if (!source.endsWith(`retrato-primeiros-socorros-${expected}.webp`)) throw new Error(`Incorrect native srcset selection: ${width}/${density}: ${source}`);
      ui.push({width,density,tier:expected});
    } finally { await context.close(); }
  }
  if(errors.length) throw new Error(errors.join('\n'));
  return {...samples,ui};
}
