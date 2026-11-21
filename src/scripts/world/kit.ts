import * as THREE from 'three';
import { Label, type LabelTone } from './labels';
import type { Palette } from './palette';
import { Models } from './models';

export { M } from './models';

/**
 * Una sola nave larga: el patio de entrada (hero) queda afuera y cada sección es
 * una bahía en línea a lo largo de -z. Una cinta continua corre por el costado +x.
 */
export const BAY_D = 62; // fondo de cada bahía
export const BAY_W = 84; // ancho de la nave
export const BAY_CX = 6; // la nave se corre a +x para dejar el pasillo de la cinta
export const HALL_Z0 = -40; // muro frontal de la nave
export const BELT_X = 34; // eje de la cinta principal
const bayZ = (i: number) => HALL_Z0 - BAY_D / 2 - (i - 1) * BAY_D;
export const HALL_Z1 = HALL_Z0 - 6 * BAY_D; // muro del fondo

/** Centros de cada zona (x, z). Mismo índice que sections.ts. */
export const ZONES: [number, number][] = [
  [0, 0], // inicio: patio de entrada, plato del disco
  [0, bayZ(1)], // bahía 1 · escaneo
  [0, bayZ(2)], // bahía 2 · clasificación
  [0, bayZ(3)], // bahía 3 · control de calidad
  [0, bayZ(4)], // bahía 4 · reciclaje dev
  [0, bayZ(5)], // bahía 5 · duplicados
  [0, bayZ(6)], // bahía 6 · despacho
  [0, (HALL_Z0 + HALL_Z1) / 2], // descarga: vista aérea de la nave entera
];

/** Zócalo (ancho, fondo) de cada zona: el área de trabajo del departamento. */
export const PLINTH: [number, number][] = [
  [48, 48], // el plato del hero (radio 24)
  [44, 44],
  [50, 50],
  [46, 46],
  [50, 44],
  [48, 40],
  [52, 44],
];

export type Role = keyof Pick<
  Palette,
  | 'ground' | 'accent' | 'accent2' | 'accent3' | 'safe' | 'review' | 'keep' | 'neutral' | 'lit'
  | 'wall' | 'roof' | 'steel' | 'belt' | 'skin'
>;

export type Zone = {
  update: (p: number, time: number) => void;
  theme?: (pal: Palette) => void;
};

export type WorkerAct = 'walk' | 'work' | 'stamp' | 'press';
export type WorkerSpec = {
  zone: number;
  /** altura del suelo, local a la zona */
  y?: number;
  /** recorrido cerrado (x, z) local a la zona; si falta, se queda en `at` */
  path?: [number, number][];
  at?: [number, number];
  /** hacia dónde mira (rad) cuando está quieto */
  face?: number;
  act?: WorkerAct;
  speed?: number;
  phase?: number;
  /** ventana de p en la que pulsa (act = 'press') */
  press?: [number, number];
};

/** Utilidades compartidas: materiales con rol de tema, etiquetas, cajas, zócalos. */
export class Kit {
  scene = new THREE.Scene();
  labels: Label[] = [];
  mats: { m: THREE.MeshStandardMaterial; role: Role; glow: number }[] = [];
  workers: WorkerSpec[] = [];
  /** 0→1 al entrar en la vista aérea final (abre todos los techos) */
  aerial = 0;
  /** 0→1 mientras la cámara se acerca a cada bahía (abre el techo antes de cruzar el portón) */
  approach: number[] = [];
  /** paso de tiempo del frame actual (s) */
  dt = 0;
  models = new Models();

  constructor(public mobile: boolean) {}

  mat(role: Role, glow = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02, ...extra });
    this.mats.push({ m, role, glow });
    return m;
  }

  label(text: string, opts: { sub?: string; tone?: LabelTone; height?: number } = {}) {
    const l = new Label(text, opts);
    this.labels.push(l);
    return l;
  }

  group(i: number) {
    const g = new THREE.Group();
    g.position.set(ZONES[i][0], 0, ZONES[i][1]);
    this.scene.add(g);
    return g;
  }

  box(w: number, h: number, d: number, m: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** zócalo bajo cada zona: el piso de la nave */
  plinth(g: THREE.Group, w: number, d: number, role: Role = 'neutral') {
    const p = this.box(w, 0.6, d, this.mat(role, 0, { roughness: 0.95 }));
    p.castShadow = false;
    g.add(p);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.12, d + 0.4).translate(0, 0.06, 0), this.mat('accent', 0.9));
    g.add(rim);
    return p;
  }
}
