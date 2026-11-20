async (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(new URL('/dev/world-rendering-qa.html', page.url()).href);
  await page.waitForFunction(() => window.qa?.ready && window.qa.liveReady && document.querySelector('#photo').width === 608);
  const result = await page.evaluate(async () => {
    const qa = window.qa;
    const photo = document.querySelector('#photo');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    async function compare(frame) {
      qa.render(structuredClone(frame));
      await wait(180);
      const reference = await qa.referencePixels();
      const actual = await qa.pixels(photo);
      let changed = 0,
        total = 0;
      for (let i = 0; i < reference.length; i++) {
        const delta = Math.abs(reference[i] - actual[i]);
        if (delta > 3) changed++;
        total += delta;
      }
      const fraction = changed / reference.length;
      if (fraction > 0.002) throw new Error(`Map/photo differ: ${fraction}, average delta ${total / reference.length}`);
      return fraction;
    }
    const base = structuredClone(qa.frame);
    const comparisons = [await compare(base)];
    for (const person of [
      { ...base.people[0], phone: 'open', cashInHand: false },
      {...base.people[0],speedModifier:{factor:1.3,remainingMs:5000}},
      { ...base.people[0], character: 4, knockedOut: true, direction: 3 },
      { ...base.people[0], character: 0, visitor: 'joesley-batista', direction: 2 },
      { ...base.people[0], character: 0, visitor: 'japones-federal', direction: 1 },
      ...[0, 1, 2, 3].map(direction => ({...base.people[0], character: 0, visitor: 'japones-federal', direction, moving: true})),
      { ...base.people[0], pocketing: true },
    ])
      comparisons.push(await compare({ ...base, people: [person] }));
    const safeFrame={...base,center:{x:qa.safe.safe.x,y:qa.safe.safe.y+19},camera:{...qa.safe.safe},people:[],ground:[],openSafes:[qa.safe.id]};
    comparisons.push(await compare(safeFrame));
    const openSafe=photo.toDataURL();
    comparisons.push(await compare({...safeFrame,openSafes:[]}));
    if(photo.toDataURL()===openSafe) throw new Error('The captured safe state was ignored');
    const furnished = {
      ...base,
      decorations: [
        { id: 1, kind: 'officeRug', x: 140, y: 146, character: 0, owner: { id: 'a', name: 'A' } },
        { id: 2, kind: 'portrait', x: 165, y: 133, character: 4, marked: true, owner: { id: 'a', name: 'A' } },
        { id: 3, kind: 'vip', x: 160, y: 155, character: 0, owner: { id: 'a', name: 'A' } },
      ],
    };
    comparisons.push(await compare(furnished));
    for (const area of [[824,270,126,122],[480,172,223,87],[326,270,266,122]]) {
      const [x,y,w,h]=area;
      const rectangle={...base,center:{x:x+w/2,y:y+h/2+19},camera:{x:x+w/2,y:y+h/2,area},people:[],ground:[]};
      comparisons.push(await compare(rectangle));
      const live=document.querySelector('#surveillance canvas');
      if(live.width!==w*4 || live.height!==h*4 || photo.width!==w*4 || photo.height!==h*4) throw new Error('Camera region was cropped or padded');
    }
    const frozen = structuredClone({ ...base, people: [{ ...base.people[0], moving: true }] });
    qa.renderer.draw(photo, frozen);
    await wait(180);
    const saved = photo.toDataURL();
    // Changes to source objects, live world and elapsed render time must not alter this capture.
    frozen.people[0].x += 40;
    frozen.ground.length = 0;
    qa.world.render(frozen, 9000, false);
    await wait(180);
    if (photo.toDataURL() !== saved) throw new Error('Saved photo followed live world state');
    qa.renderer.draw(photo, structuredClone({ ...base, people: [{ ...base.people[0], moving: true }] }));
    await wait(180);
    if (photo.toDataURL() !== saved) throw new Error('Reopening a photo changed its animation frame');
    return { comparisons, frozen: true };
  });
  if (errors.length) throw new Error(errors.join('\n'));
  return result;
}
