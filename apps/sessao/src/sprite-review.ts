import {spriteCatalog, spriteFrame, type SpriteClip} from './sprite-catalog';
import {spriteImage, paintFrame} from './sprite-review-renderer';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const pose = element<HTMLSelectElement>('pose');
const direction = element<HTMLSelectElement>('direction');
const frameInput = element<HTMLInputElement>('frame');
const size = element<HTMLInputElement>('size');
const speed = element<HTMLSelectElement>('speed');
const background = element<HTMLSelectElement>('background');
const onion = element<HTMLInputElement>('onion');
const repeat = element<HTMLInputElement>('repeat');
const verdict = element<HTMLSelectElement>('verdict');
const note = element<HTMLTextAreaElement>('note');
const play = element<HTMLButtonElement>('play');
const error = element<HTMLParagraphElement>('error');
const params = new URLSearchParams(location.hash.slice(1));
let subject = spriteCatalog.find(subject => subject.id === params.get('subject')) ?? spriteCatalog[0];
let clip = subject.clips.find(clip => clip.id === params.get('pose')) ?? subject.clips[0];
let facing = Math.max(0, Math.min(clip.directions.length - 1, Math.floor(Number(params.get('direction'))) || 0));
let frame = Math.max(0, Math.min(clip.count - 1, Math.floor(Number(params.get('frame'))) || 0));
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let image: HTMLImageElement | undefined;
let generation = 0;
let elapsed = 0;
let previousTime = 0;
type Review = {status: string; note: string};
const storageKey = 'infiltrados-sprite-review-v1';
const reviews: Record<string, Review> = {};
try {
  const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (stored && typeof stored === 'object') for (const [key, value] of Object.entries(stored)) {
    if (value && typeof value === 'object' && 'status' in value && 'note' in value && typeof value.status === 'string' && typeof value.note === 'string') {
      reviews[key] = {status: value.status, note: value.note};
    }
  }
} catch { /* A blocked or malformed local store must not block sprite inspection. */ }
const reviewKey = () => `${subject.id}/${clip.id}`;
function options(select: HTMLSelectElement, items: {value: string; text: string}[]) {
  select.replaceChildren(...items.map(({value, text}) => new Option(text, value)));
}
function shareLocation() {
  const values = new URLSearchParams({subject: subject.id, pose: clip.id, direction: String(facing), frame: String(frame)});
  history.replaceState(null, '', `#${values}`);
}
function progress() {
  const reviewed = subject.clips.filter(clip => reviews[`${subject.id}/${clip.id}`]?.status === 'approved').length;
  element('progress').textContent = `${reviewed} de ${subject.clips.length} poses aprovadas`;
}
function subjectList() {
  const search = element<HTMLInputElement>('search').value.toLocaleLowerCase('pt-BR');
  const found = spriteCatalog.filter(subject => subject.name.toLocaleLowerCase('pt-BR').includes(search));
  element('total').textContent = `${found.length} de ${spriteCatalog.length} entradas`;
  const container = element('subjects');
  container.replaceChildren();
  for (const group of [...new Set(found.map(subject => subject.group))]) {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = group;
    section.append(heading);
    for (const entry of found.filter(subject => subject.group === group)) {
      const button = document.createElement('button');
      button.textContent = entry.name;
      button.setAttribute('aria-current', String(subject.id === entry.id));
      button.onclick = () => {
        const poseId = clip.id;
        subject = entry;
        clip = entry.clips.find(clip => clip.id === poseId) ?? entry.clips[0];
        facing = Math.min(facing, clip.directions.length - 1);
        frame = 0;
        void showSubject();
      };
      section.append(button);
    }
    container.append(section);
  }
  if (!found.length) container.textContent = 'Nenhum personagem encontrado.';
}
function setError(message: string) {
  error.textContent = message;
  error.hidden = !message;
}
function controls() {
  options(pose, subject.clips.map(clip => ({value: clip.id, text: clip.name})));
  pose.value = clip.id;
  options(direction, clip.directions.map((direction, index) => ({value: String(index), text: direction.label})));
  direction.value = String(facing);
  frameInput.max = String(clip.count - 1);
  frameInput.disabled = clip.count === 1;
  play.disabled = clip.count === 1;
  verdict.value = reviews[reviewKey()]?.status ?? 'pending';
  note.value = reviews[reviewKey()]?.note ?? '';
  elapsed = 0;
  progress();
  shareLocation();
}
async function loadPose() {
  controls();
  image = undefined;
  const activeClip = clip;
  const current = generation;
  element('asset').textContent = `Carregando ${clip.path}…`;
  try {
    const loaded = await spriteImage(clip.path);
    if (generation !== current || clip !== activeClip) return;
    image = loaded;
  } catch (reason) {
    if (generation === current && clip === activeClip) setError(String(reason));
  }
}
async function showSubject() {
  const current = ++generation;
  setError('');
  subjectList();
  element('name').textContent = subject.name;
  element('group').textContent = subject.group;
  document.querySelector<HTMLParagraphElement>('.intro')!.textContent = subject.group === 'Experimento de nitidez'
    ? 'Variante experimental do Tiririca: ganho de nitidez validado. O master tem 362 px por quadro, normalizados para 256/512. Pintura, contornos e proporções entre quadros ainda precisam de revisão. Não é a arte usada na partida.'
    : 'Compare contornos, pintura, sombras e proporções entre os quadros. Estas são as artes usadas no jogo. Direções espelhadas estão identificadas; parado usa o primeiro quadro da caminhada.';
  element('sheets').replaceChildren();
  void loadPose();
  const tasks = subject.clips.map(async entry => {
    const section = document.createElement('article');
    section.className = 'pose-sheet';
    section.dataset.pose = entry.id;
    const title = document.createElement('h3');
    title.textContent = entry.name;
    const metadata = document.createElement('small');
    metadata.textContent = `${entry.count} quadro${entry.count === 1 ? '' : 's'} · ${entry.directions.length} direç${entry.directions.length === 1 ? 'ão' : 'ões'}${entry.loop ? '' : ' · ação pontual (prévia pode repetir)'}`;
    section.append(title, metadata);
    element('sheets').append(section);
    try {
      const loaded = await spriteImage(entry.path);
      if (generation !== current) return;
      entry.directions.forEach((dir, index) => {
        const label = document.createElement('p');
        label.className = 'strip-label'; label.textContent = dir.label;
        const strip = document.createElement('div'); strip.className = 'filmstrip';
        for (let step = 0; step < entry.count; step++) {
          const button = document.createElement('button'); button.className = 'frame-button';
          button.dataset.pose = entry.id; button.dataset.direction = String(index); button.dataset.frame = String(step);
          button.setAttribute('aria-label', `${entry.name}, ${dir.label}, quadro ${step + 1}`);
          const canvas = document.createElement('canvas');
          canvas.className = 'surface'; canvas.dataset.background = background.value;
          paintFrame(canvas, loaded, entry, index, step, 112);
          const caption = document.createElement('span'); caption.textContent = `Quadro ${step + 1}`;
          button.append(canvas, caption);
          button.onclick = () => {
            clip = entry; facing = index; frame = step; paused = true;
            void loadPose();
          };
          strip.append(button);
        }
        section.append(label, strip);
      });
    } catch (reason) {
      if (generation !== current) return;
      const warning = document.createElement('p'); warning.textContent = String(reason); section.append(warning);
      setError(String(reason));
    }
  });
  element('sheets').setAttribute('aria-busy', 'true');
  await Promise.all(tasks);
  if (generation === current) element('sheets').setAttribute('aria-busy', 'false');
}
pose.onchange = () => {
  clip = subject.clips.find(entry => entry.id === pose.value)!;
  facing = Math.min(facing, clip.directions.length - 1); frame = 0;
  setError(''); void loadPose();
};
direction.onchange = () => { facing = Number(direction.value); elapsed = 0; shareLocation(); };
size.oninput = () => { element<HTMLOutputElement>('size-label').value = `${size.value} px`; };
speed.onchange = () => { elapsed = 0; };
background.onchange = () => {
  document.querySelectorAll<HTMLElement>('.surface').forEach(surface => { surface.dataset.background = background.value; });
};
function step(delta: number) { paused = true; frame = (frame + delta + clip.count) % clip.count; elapsed = 0; shareLocation(); }
element('previous').onclick = () => step(-1);
element('next').onclick = () => step(1);
frameInput.oninput = () => { paused = true; frame = Number(frameInput.value); elapsed = 0; shareLocation(); };
play.onclick = () => {
  paused = !paused; elapsed = 0;
  if (!paused && frame === clip.count - 1 && !repeat.checked) frame = 0;
};
function saveReview() {
  reviews[reviewKey()] = {status: verdict.value, note: note.value};
  try { localStorage.setItem(storageKey, JSON.stringify(reviews)); }
  catch { element('save-status').textContent = 'Armazenamento indisponível. Exporte a revisão antes de fechar a página.'; }
  progress();
}
verdict.onchange = saveReview;
note.oninput = saveReview;
element('export').onclick = () => {
  const blob = new Blob([JSON.stringify({game: 'Infiltrados', version: 1, reviews}, null, 2)], {type: 'application/json'});
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'infiltrados-revisao-sprites.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
element('search').oninput = subjectList;
let previousSelection = '';
function render(time: number) {
  const delta = previousTime ? Math.min(250, time - previousTime) : 0;
  previousTime = time;
  if (!paused && image && !document.hidden && clip.count > 1) {
    elapsed += delta * Number(speed.value);
    const duration = 1000 / clip.fps;
    while (elapsed >= duration) {
      elapsed -= duration;
      if (frame === clip.count - 1 && !repeat.checked) { paused = true; break; }
      frame = (frame + 1) % clip.count;
    }
  }
  play.textContent = clip.count === 1 ? 'Pose estática' : paused ? 'Reproduzir' : 'Pausar';
  frameInput.value = String(frame);
  element<HTMLOutputElement>('frame-label').value = `${frame + 1} / ${clip.count}`;
  const canvas = element<HTMLCanvasElement>('player');
  if (image) {
    paintFrame(canvas, image, clip, facing, frame, Number(size.value), onion.checked, true);
    const frameSize = clip.size ? `${clip.size}×${clip.size}` : `${image.naturalWidth}×${image.naturalHeight}`;
    element('asset').textContent = `${clip.path} · ${frameSize} px · índice ${spriteFrame(clip, facing, frame)} · ${clip.count === 1 ? 'pose estática' : `${clip.fps.toFixed(1)} quadros/s`}`;
  } else canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  const selection = `${clip.id}/${facing}/${frame}`;
  if (selection !== previousSelection) {
    previousSelection = selection;
    document.querySelectorAll<HTMLButtonElement>('.frame-button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.pose === clip.id && button.dataset.direction === String(facing) && button.dataset.frame === String(frame)));
    });
  }
  requestAnimationFrame(render);
}
void showSubject();
requestAnimationFrame(render);
