import * as THREE from 'three';
import type { Kit } from '../kit';
import { easeOut, lerp } from '../palette';
import { spurFrame } from './conveyor';

/** tamaño de la caja de cartón Polyfork escalada (0,57 × 0,43 × 0,45 m) */
export const BOX = 2.3;
export const BOX_W = 0.57 * BOX;
export const BOX_H = 0.43 * BOX;

export type Slot = { k: number; phase: 'in' | 'hold' | 'out'; f: number };

/**
 * Cola de un ramal: llega una caja cada T s, viaja hasta la máquina, se detiene
 * `hold` s y sigue hasta el zócalo en `out` s. Devuelve las cajas visibles.
 */
export function queue(t: number, T: number, hold: number, out: number, max = 4): Slot[] {
  const total = T + hold + out;
  const res: Slot[] = [];
  const last = Math.floor(t / T);
  for (let k = last; k > last - max && k >= last - Math.ceil(total / T); k--) {
    const tau = t - k * T;
    if (tau < 0 || tau >= total) continue;
    if (tau < T) res.push({ k, phase: 'in', f: tau / T });
    else if (tau < T + hold) res.push({ k, phase: 'hold', f: (tau - T) / hold });
    else res.push({ k, phase: 'out', f: (tau - T - hold) / out });
  }
  return res;
}

/**
 * Estación de primer plano al pie del ramal i: aquí la cámara se acerca y se ve el
 * proceso. Las cajas del ramal son props Polyfork que se mueven por la cola.
 */
export function station(k: Kit, g: THREE.Group, i: number, opts: { T: number; hold: number; out: number; stop: number }) {
  const f = spurFrame(i);
  const root = new THREE.Group();
  g.add(root);
  const n = 4;
  const boxes = Array.from({ length: n }, () => {
    const b = k.models.prop('box', BOX);
    b.visible = false;
    root.add(b);
    return b;
  });
  /** x de la caja en cada fase: belt → stop → zócalo */
  const xAt = (s: Slot) =>
    s.phase === 'in' ? lerp(f.x1, opts.stop, easeOut(s.f)) : s.phase === 'hold' ? opts.stop : lerp(opts.stop, f.x0 - 0.2, s.f);
  return {
    f,
    root,
    boxes,
    xAt,
    /** mueve las cajas; `each` permite al zona decorar cada una (rotar, ocultar, escalar) */
    update(t: number, each?: (b: THREE.Group, s: Slot) => void) {
      const slots = queue(t, opts.T, opts.hold, opts.out, n);
      boxes.forEach((b) => (b.visible = false));
      for (const s of slots) {
        const b = boxes[((s.k % n) + n) % n];
        b.visible = true;
        b.position.set(xAt(s), f.y, 0);
        b.rotation.set(0, 0, 0);
        b.scale.setScalar(1);
        each?.(b, s);
      }
      return slots;
    },
  };
}

/** IK de dos segmentos en el plano del brazo: devuelve (hombro, codo) desde la vertical */
export function ik2(fwd: number, up: number, L1: number, L2: number) {
  const d = Math.min(Math.hypot(fwd, up), L1 + L2 - 1e-3);
  const el = Math.acos(THREE.MathUtils.clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1));
  const sh = Math.atan2(fwd, up) - Math.atan2(L2 * Math.sin(el), L1 + L2 * Math.cos(el));
  return { sh, el };
}

/** placa con texto dibujado en canvas (monitores, etiquetas de caja) */
export function screen(w: number, h: number, px = 256) {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = Math.round((px * h) / w);
  const ctx = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return { mesh, ctx, c, tex };
}

/** punto en una parábola de a a b con altura extra h sobre la recta (f ∈ 0..1) */
export function arc(a: THREE.Vector3, b: THREE.Vector3, h: number, f: number, out: THREE.Vector3) {
  out.lerpVectors(a, b, f);
  out.y += Math.sin(Math.PI * f) * h;
  return out;
}

/** a qué color de la paleta apunta cada rol (para canvas y materiales propios) */
export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
