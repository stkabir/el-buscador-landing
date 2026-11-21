import * as THREE from 'three';
import type { Palette } from './palette';

export type LabelTone = 'default' | 'safe' | 'review' | 'keep' | 'accent';

type LabelSpec = { text: string; sub?: string; tone: LabelTone; height: number };

const toneColor = (p: Palette, tone: LabelTone) => {
  const hex = { default: p.accent, accent: p.accent, safe: p.safe, review: p.review, keep: p.keep }[tone];
  return '#' + hex.toString(16).padStart(6, '0');
};

/** Etiqueta en sprite con canvas. Se redibuja al cambiar el tema. */
export class Label {
  sprite: THREE.Sprite;
  private canvas = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  private spec: LabelSpec;

  constructor(text: string, opts: { sub?: string; tone?: LabelTone; height?: number } = {}) {
    this.spec = { text, sub: opts.sub, tone: opts.tone ?? 'default', height: opts.height ?? 2.4 };
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, fog: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.renderOrder = 10;
  }

  set opacity(v: number) {
    (this.sprite.material as THREE.SpriteMaterial).opacity = v;
    this.sprite.visible = v > 0.01;
  }

  draw(p: Palette) {
    const { text, sub, tone, height } = this.spec;
    const dpr = 2;
    const c = this.canvas;
    const ctx = c.getContext('2d')!;
    const font = '600 30px "Segoe UI Variable", "Segoe UI", system-ui, sans-serif';
    const subFont = '500 22px ui-monospace, "Cascadia Code", Consolas, monospace';
    ctx.font = font;
    const tw = ctx.measureText(text).width;
    ctx.font = subFont;
    const sw = sub ? ctx.measureText(sub).width : 0;
    const padX = 22;
    const w = Math.ceil(Math.max(tw, sw) + padX * 2 + 18);
    const h = sub ? 96 : 62;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const r = 16;
    ctx.beginPath();
    ctx.roundRect(1.5, 1.5, w - 3, h - 3, r);
    ctx.fillStyle = p.labelBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = tone === 'default' ? p.labelLine : toneColor(p, tone);
    ctx.stroke();

    // punto de color
    ctx.beginPath();
    ctx.arc(padX + 4, sub ? 32 : h / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = toneColor(p, tone);
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.font = font;
    ctx.fillStyle = p.ink;
    ctx.fillText(text, padX + 18, sub ? 33 : h / 2 + 1);
    if (sub) {
      ctx.font = subFont;
      ctx.fillStyle = p.muted;
      ctx.fillText(sub, padX + 18, 68);
    }
    this.tex.needsUpdate = true;
    this.sprite.scale.set((height * w) / h, height, 1);
    this.sprite.center.set(0.5, 0);
  }
}
