import Phaser from 'phaser';
import { characterArt, characterSheets, combatSheets, downedArt } from './character-art';
import { drawMap } from './draw-map';
import { objects } from './gameplay';
import type { PhotoScene } from './photography';
import { isOfficeFurniture, officeFixtures, officeFurniture } from './private-offices';
import { spyRules } from './surveillance';

export function createSurveillanceViewport(parent:HTMLElement) {
  let latest:PhotoScene|undefined;
  const size = spyRules.range*2;
  const density = 4;

  class Viewport extends Phaser.Scene {
    private actors = new Map<string,Phaser.GameObjects.Sprite>();
    private items = new Map<string,Phaser.GameObjects.Image[]>();
    private scenery:Phaser.GameObjects.GameObject[] = [];
    private doors!:Phaser.GameObjects.Graphics;
    private rendered?:PhotoScene;

    preload() {
      const assets = import.meta.env.BASE_URL+'assets/';
      for (const {key,path} of [...characterSheets,...combatSheets]) {
        this.load.spritesheet(key,path,{frameWidth:128,frameHeight:128});
      }
      for (const [kind,item] of Object.entries(objects)) this.load.image(`item-${kind}`,assets+item.portrait);
      for (const [kind,item] of Object.entries(officeFurniture)) this.load.image(`furniture-${kind}`,assets+item.sprite);
      this.load.image(officeFixtures.safe.texture,assets+'gabinete-cofre.webp');
      this.load.image(officeFixtures.cabinet.texture,assets+'gabinete-armario.webp');
      this.load.image('infirmary-stretcher',assets+'maca-enfermaria.webp');
      this.load.image('infirmary-doctor',assets+'drauzio-varella.webp');
      this.load.image('coffee-maker',assets+'cafeteira.webp');
      this.load.spritesheet('office',assets+'office-hd.png',{frameWidth:192,frameHeight:112});
    }

    create() {
      drawMap(this);
      this.doors = this.add.graphics().setDepth(2);
      this.cameras.main.setZoom(density);
    }

    update(time:number,delta:number) {
      const frame = latest;
      if (!frame?.camera) return;
      if (frame!==this.rendered) {
        const {camera,ground,decorations} = frame;
        this.cameras.main.centerOn(camera.x,camera.y);
        this.doors.clear().fillStyle(0x334e42);
        for (const rect of camera.barriers ?? []) this.doors.fillRect(...rect);
        for (const object of this.scenery) object.destroy();
        this.scenery = ground.map(({x,y,kind})=>
          this.add.image(x,y,`item-${kind}`).setOrigin(.5,1).setDisplaySize(15,15).setDepth(y));
        for (const decoration of decorations) {
          const {x,y,kind} = decoration;
          const furniture = isOfficeFurniture(kind) ? officeFurniture[kind] : undefined;
          this.scenery.push(this.add.image(x,y,furniture ? `furniture-${kind}` : `item-${kind}`)
            .setOrigin(.5,furniture?.anchor ?? 1).setDisplaySize(furniture?.width ?? 19,furniture?.height ?? 19).setDepth(y));
        }
        const visible = new Set(frame.people.map(person=>person.id));
        for (const [id,sprite] of this.actors) if (!visible.has(id)) {
          sprite.destroy();
          this.actors.delete(id);
          for (const icon of this.items.get(id) ?? []) icon.destroy();
          this.items.delete(id);
        }
        this.rendered = frame;
      }
      for (const person of frame.people) {
        const {sheet,frame:base} = characterArt(person.character);
        const down = person.knockedOut || person.carried ? downedArt(person.character,person.direction) : undefined;
        const row = person.direction===3 ? 1 : person.direction;
        const step = person.moving && !down ? Math.floor(time/100)%4 : 0;
        const y = person.y-(person.carried ? 24 : 0);
        let sprite = this.actors.get(person.id);
        if (!sprite) {
          sprite = this.add.sprite(person.x,y,sheet.key,base).setScale(.295);
          this.actors.set(person.id,sprite);
        }
        const blend = Math.min(1,delta/55);
        sprite.setPosition(Phaser.Math.Linear(sprite.x,person.x,blend),Phaser.Math.Linear(sprite.y,y,blend))
          .setTexture(down?.key ?? sheet.key,down?.frame ?? base+row*4+step)
          .setOrigin(.5,down?.originY ?? 1).setRotation(down?.rotation ?? 0)
          .setFlipX(down?.flipX ?? person.direction===3).setDepth(person.y);
        const exposed = person.exposed ?? [];
        let icons = this.items.get(person.id);
        if (!icons) this.items.set(person.id,icons = []);
        while (icons.length>exposed.length) icons.pop()?.destroy();
        for (const [index,{kind}] of exposed.entries()) {
          const texture = `item-${kind}`;
          const icon = icons[index] ?? (icons[index] = this.add.image(0,0,texture).setDepth(1000));
          icon.setTexture(texture).setDisplaySize(10,10)
            .setPosition(sprite.x+(index-(exposed.length-1)/2)*12,sprite.y-39);
        }
      }
    }
  }

  const game = new Phaser.Game({
    type:Phaser.CANVAS,parent,width:size*density,height:size*density,scene:Viewport,
    backgroundColor:'#101d19',autoFocus:false,input:{keyboard:false,mouse:false,touch:false},
    audio:{noAudio:true},
  });
  return {
    receive(frame:PhotoScene) { latest = frame; },
    destroy() { game.destroy(true); },
  };
}
