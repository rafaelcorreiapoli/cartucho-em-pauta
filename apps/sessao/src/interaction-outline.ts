import type Phaser from 'phaser';

type Art = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Text;

export function createInteractionOutline(scene:Phaser.Scene, art:Art) {
  const frame = art.frame;
  const padding = Math.max(1,Math.round(1.25*frame.cutWidth/art.displayWidth));
  const key = `interaction-outline:${art.texture.key}:${frame.name}:${padding}`;
  const width = frame.cutWidth+padding*2;
  const height = frame.cutHeight+padding*2;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key,width,height)!;
    const ctx = texture.context;
    const source = frame.source.image as CanvasImageSource;
    const draw = (x:number,y:number)=>ctx.drawImage(source,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,x,y,frame.cutWidth,frame.cutHeight);
    for (let step=0;step<12;step++) {
      const angle = step*Math.PI/6;
      draw(padding+Math.round(Math.cos(angle)*padding),padding+Math.round(Math.sin(angle)*padding));
    }
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffdc73';
    ctx.fillRect(0,0,width,height);
    ctx.globalCompositeOperation = 'destination-out';
    draw(padding,padding);
    ctx.globalCompositeOperation = 'source-over';
    texture.refresh();
  }

  const outline = scene.add.image(art.x,art.y,key).setVisible(false);
  outline.setOrigin((art.originX*frame.cutWidth+padding)/width,(art.originY*frame.cutHeight+padding)/height)
    .setDisplaySize(art.displayWidth*width/frame.cutWidth,art.displayHeight*height/frame.cutHeight);
  return outline;
}

export function hitInteractionArt(art:Art,x:number,y:number) {
  const matrix = art.getWorldTransformMatrix();
  const point = matrix.applyInverse(x,y);
  const px = Math.floor(point.x+art.displayOriginX);
  const py = Math.floor(point.y+art.displayOriginY);
  return (art.scene.textures.getPixelAlpha(px,py,art.texture.key,art.frame.name) ?? 0)>32;
}
