import {spriteFrame, type SpriteClip} from './sprite-catalog';
import {spriteFrameOffsetX} from './sprite-alignment';

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
const edges = new Map<string, string[]>();
export function frameEdges(image: HTMLImageElement, clip: SpriteClip, direction: number, frame: number) {
  const index = spriteFrame(clip, direction, frame);
  const key = `${clip.path}/${index}`;
  let result = edges.get(key);
  if (!result) {
    const width = clip.size || image.naturalWidth, height = clip.size || image.naturalHeight;
    const columns = clip.size ? image.naturalWidth / clip.size : 1;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, index % columns * width, Math.floor(index / columns) * height, width, height, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const opaque = (x: number, y: number) => pixels[(y * width + x) * 4 + 3] > 32;
    result = [];
    if (Array.from({length: width}, (_, x) => opaque(x, 0)).some(Boolean)) result.push('superior');
    if (Array.from({length: width}, (_, x) => opaque(x, height - 1)).some(Boolean)) result.push('inferior');
    if (Array.from({length: height}, (_, y) => opaque(0, y)).some(Boolean)) result.push('esquerda');
    if (Array.from({length: height}, (_, y) => opaque(width - 1, y)).some(Boolean)) result.push('direita');
    edges.set(key, result);
  }
  return clip.directions[direction].flip ? result.map(edge => edge === 'esquerda' ? 'direita' : edge === 'direita' ? 'esquerda' : edge) : result;
}
export function paintFrame(canvas: HTMLCanvasElement, image: HTMLImageElement, clip: SpriteClip, direction: number, frame: number, size: number, onion = false, guide = false, bounds = true) {
  const density = window.devicePixelRatio || 1;
  const padding = bounds ? Math.round(size / 8) : 0;
  const extent = size + padding * 2;
  const pixels = Math.round(extent * density);
  if (canvas.width !== pixels || canvas.height !== pixels) { canvas.width = pixels; canvas.height = pixels; }
  canvas.style.width = `${extent}px`; canvas.style.height = `${extent}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(density, 0, 0, density, 0, 0);
  ctx.clearRect(0, 0, extent, extent);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const cell = clip.size;
  const absolute = spriteFrame(clip, direction, frame);
  const columns = cell ? Math.floor(image.naturalWidth / cell) : 1;
  const sw = cell || image.naturalWidth, sh = cell || image.naturalHeight;
  const scale = size / Math.max(sw, sh);
  const width = sw * scale, height = sh * scale;
  const baseLeft = padding + (size - width) / 2, top = padding + size - height;
  const left = baseLeft + spriteFrameOffsetX(clip.path, absolute) * scale;
  const boundaryLeft = clip.directions[direction].flip ? extent - left - width : left;
  function mirrored(draw: () => void) {
    ctx.save();
    if (clip.directions[direction].flip) { ctx.translate(extent, 0); ctx.scale(-1, 1); }
    draw(); ctx.restore();
  }
  if (bounds) {
    ctx.fillStyle = '#dd71542c'; ctx.fillRect(0, 0, extent, extent); ctx.clearRect(boundaryLeft, top, width, height);
    // Raw neighboring atlas pixels are context, not proof that this character crosses its cell.
    if (cell) mirrored(() => {
      ctx.beginPath(); ctx.rect(0, 0, extent, extent); ctx.rect(left, top, width, height); ctx.clip('evenodd');
      ctx.globalAlpha = .55;
      const margin = padding / scale;
      ctx.drawImage(image, absolute % columns * cell - margin, Math.floor(absolute / columns) * cell - margin, cell + margin * 2, cell + margin * 2, left - padding, top - padding, width + padding * 2, height + padding * 2);
    });
  }
  function draw(index: number, alpha: number) {
    const absolute = spriteFrame(clip, direction, index);
    const drawLeft = baseLeft + spriteFrameOffsetX(clip.path, absolute) * scale;
    mirrored(() => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(image, cell ? absolute % columns * cell : 0, cell ? Math.floor(absolute / columns) * cell : 0, sw, sh, drawLeft, top, width, height);
    });
  }
  if (onion && clip.count > 1) draw((frame + clip.count - 1) % clip.count, .25);
  draw(frame, 1);
  if (bounds) {
    const touches = frameEdges(image, clip, direction, frame);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#d7e9ab'; ctx.strokeRect(boundaryLeft + .5, top + .5, width - 1, height - 1);
    ctx.strokeStyle = '#ff9476'; ctx.lineWidth = 2;
    for (const edge of touches) {
      ctx.beginPath();
      if (edge === 'superior') { ctx.moveTo(boundaryLeft, top + 1); ctx.lineTo(boundaryLeft + width, top + 1); }
      if (edge === 'inferior') { ctx.moveTo(boundaryLeft, top + height - 1); ctx.lineTo(boundaryLeft + width, top + height - 1); }
      if (edge === 'esquerda') { ctx.moveTo(boundaryLeft + 1, top); ctx.lineTo(boundaryLeft + 1, top + height); }
      if (edge === 'direita') { ctx.moveTo(boundaryLeft + width - 1, top); ctx.lineTo(boundaryLeft + width - 1, top + height); }
      ctx.stroke();
    }
  }
  if (guide) {
    ctx.strokeStyle = '#d7e9ab66'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath();
    ctx.moveTo(extent / 2, top); ctx.lineTo(extent / 2, top + height);
    ctx.stroke(); ctx.setLineDash([]);
  }
}
