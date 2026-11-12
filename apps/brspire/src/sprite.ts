import { heroes, type HeroId } from "./heroes";

type Animation = "idle" | "attack" | "hit" | "death";

const animations = {
  idle: { row: 0, frames: [0], ms: 1000 },
  attack: { row: 1, frames: [0, 1, 2, 3], ms: 85 },
  hit: { row: 2, frames: [0, 1, 2, 3], ms: 85 },
  death: { row: 3, frames: [0, 1, 2, 3], ms: 105 },
} satisfies Record<Animation, { row: number; frames: number[]; ms: number }>;

const heroFrameCount = 16;
const flavioPoses = ["idle", "attack", "hit", "death"] as const;

export function heroFrameAssets(hero: HeroId): string[] {
  if (hero === "flavio") return flavioPoses.map((pose) => `flavio-${pose}`);
  return Array.from({ length: heroFrameCount }, (_, index) => `${hero}-${index}`);
}

export class HeroSprite {
  private singlePose = false;
  private images: HTMLImageElement[] = [];
  private idleImage = new Image();
  private animation: Animation = "idle";
  private started = performance.now();
  private reduced = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(private element: HTMLImageElement) {
    requestAnimationFrame(this.tick);
  }

  select(hero: HeroId) {
    const prefix = `${import.meta.env.BASE_URL}assets/`;
    this.singlePose = hero === "flavio";
    this.element.removeAttribute("src");
    this.element.alt = `${heroes[hero].name} em campo`;
    this.images = heroFrameAssets(hero).map((asset) => {
      const image = new Image();
      image.src = `${prefix}${asset}.webp`;
      return image;
    });
    this.idleImage.src = `${prefix}${hero}-idle.webp`;
    this.play("idle");
  }

  play(animation: Animation) {
    this.animation = animation;
    this.element.dataset.pose = animation;
    this.started = performance.now();
  }

  private tick = (time: number) => {
    const { row, frames, ms } = animations[this.animation];
    const elapsed = Math.max(0, Math.floor((time - this.started) / ms));
    if (
      this.animation !== "idle" &&
      this.animation !== "death" &&
      elapsed >= frames.length
    ) {
      this.play("idle");
    } else {
      const position = this.reduced.matches
        ? this.animation === "death"
          ? frames.length - 1
          : 0
        : this.animation === "idle"
          ? elapsed % frames.length
          : Math.min(elapsed, frames.length - 1);
      const next = this.singlePose ? row : row * 4 + frames[position];
      const image = this.animation === "idle" && !this.reduced.matches && this.idleImage.naturalWidth
        ? this.idleImage
        : this.images[next];
      if (image?.naturalWidth && image.src !== this.element.src) {
        this.element.src = image.src;
      }
    }
    requestAnimationFrame(this.tick);
  };
}
