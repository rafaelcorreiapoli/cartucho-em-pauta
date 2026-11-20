import {spriteFrame, type SpriteClip} from './sprite-catalog';

const images = new Map<string, Promise<HTMLImageElement>>();
export function spriteImage(path: string): Promise<HTMLImageElement> {
  let image = images.get(path);
  if (!image) {
    const element = new Image();
    element.src = import.meta.env.BASE_URL + path;
    image = element.decode().then(() => element).catch(() => {
      images.delete(path);
      throw new Error(`Não foi possível carregar ${path}. Recarregue a página para tentar novamente.`);
    });
    images.set(path, image);
  }
  return image;
}
export function paintFrame(canvas: HTMLCanvasElement, image: HTMLImageElement, clip: SpriteClip, direction: number, frame: number, size: number, onion = false, guide = false) {
  const density = window.devicePixelRatio || 1;
  const pixels = Math.round(size * density);
  if (canvas.width !== pixels || canvas.height !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
  }
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  function draw(index: number, alpha: number) {
    const cell = clip.size;
    const absolute = spriteFrame(clip, direction, index);
    const columns = cell ? Math.floor(image.naturalWidth / cell) : 1;
    const sx = cell ? absolute % columns * cell : 0;
    const sy = cell ? Math.floor(absolute / columns) * cell : 0;
    const sw = cell || image.naturalWidth;
    const sh = cell || image.naturalHeight;
    const scale = size / Math.max(sw, sh);
    const width = sw * scale, height = sh * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (clip.directions[direction].flip) {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(image, sx, sy, sw, sh, (size - width) / 2, size - height, width, height);
    ctx.restore();
  }
  if (onion && clip.count > 1) draw((frame + clip.count - 1) % clip.count, .25);
  draw(frame, 1);
  if (guide) {
    ctx.strokeStyle = '#d7e9ab66';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size - 1); ctx.lineTo(size, size - 1);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
