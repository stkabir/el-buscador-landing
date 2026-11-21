import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BAY_CX, BAY_D, BAY_W, BELT_X, type Kit } from '../kit';
import { lerp, range, smooth } from '../palette';

export const NAVE_H = 12;
const T = 0.6; // grosor de muro
const DOOR = 8; // portón por donde pasa la cinta
const RISE = 3; // altura del diente de sierra

/**
 * Una bahía de la nave larga, local al centro de su estación. Muros laterales,
 * tabique trasero (y frontal en la primera) con portón para la cinta, y techo en
 * diente de sierra. Al llegar la cámara, el techo se enrolla y los muros bajan.
 */
export function bay(k: Kit, g: THREE.Group, opts: { front: boolean; name: string; sub?: string }) {
  const W = BAY_W, D = BAY_D, H = NAVE_H;
  const x0 = BAY_CX - W / 2, x1 = BAY_CX + W / 2;
  const door = BELT_X;

  const walls: THREE.BufferGeometry[] = [];
  const stripes: THREE.BufferGeometry[] = [];
  const cols: THREE.BufferGeometry[] = [];
  const seg = (ax: number, bx: number, az: number, bz: number) => {
    const w = Math.max(bx - ax, T), d = Math.max(bz - az, T);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    walls.push(new THREE.BoxGeometry(w, H, d).translate(cx, H / 2, cz));
    stripes.push(new THREE.BoxGeometry(w + 0.02, 0.55, d + 0.12).translate(cx, H - 1.6, cz));
  };
  const col = (x: number, z: number, s = 1) => cols.push(new THREE.BoxGeometry(s, H + 0.8, s).translate(x, (H + 0.8) / 2, z));
  // tabique transversal con portón en el eje de la cinta
  const cross = (z: number) => {
    seg(x0, door - DOOR / 2, z, z);
    seg(door + DOOR / 2, x1, z, z);
    col(door - DOOR / 2, z);
    col(door + DOOR / 2, z);
  };
  cross(-D / 2);
  if (opts.front) cross(D / 2);
  // muros laterales
  seg(x0, x0, -D / 2, D / 2);
  seg(x1, x1, -D / 2, D / 2);
  for (const x of [x0, x1]) for (const z of [-D / 2, 0]) col(x, z, 1.1);
  if (opts.front) for (const x of [x0, x1]) col(x, D / 2, 1.1);

  const shell = new THREE.Group();
  const wallMesh = new THREE.Mesh(mergeGeometries(walls), k.mat('wall', 0, { roughness: 0.9 }));
  wallMesh.castShadow = wallMesh.receiveShadow = true;
  shell.add(wallMesh, new THREE.Mesh(mergeGeometries(stripes), k.mat('accent', 0.7)));
  g.add(shell);
  const colMesh = new THREE.Mesh(mergeGeometries(cols), k.mat('steel', 0, { roughness: 0.5, metalness: 0.4 }));
  colMesh.castShadow = true;
  g.add(colMesh);

  // techo en diente de sierra: losas inclinadas + lucernario que brilla
  const N = Math.max(3, Math.round(D / 9));
  const td = D / N;
  const slabGeo = new THREE.BoxGeometry(W, 0.35, Math.hypot(td, RISE)).rotateX(-Math.atan2(RISE, td)).translate(0, RISE / 2, 0);
  const glassGeo = new THREE.BoxGeometry(W, RISE, 0.25).translate(0, RISE / 2, td / 2);
  const slabs = new THREE.InstancedMesh(slabGeo, k.mat('roof', 0, { roughness: 0.85 }), N);
  const glass = new THREE.InstancedMesh(glassGeo, k.mat('lit', 1, { roughness: 0.3 }), N);
  slabs.castShadow = true;
  slabs.receiveShadow = true;
  g.add(slabs, glass);

  const m4 = new THREE.Matrix4();
  const setRoof = (open: number) => {
    for (let i = 0; i < N; i++) {
      // se enrolla diente a diente hacia el muro del fondo (-x), lejos de la cinta
      const a = (i / N) * 0.5;
      const s = Math.max(1 - smooth(range(open, a, a + 0.5)), 1e-4);
      m4.makeScale(s, 1, 1).setPosition(x0 + (W / 2) * s, H, D / 2 - td * (i + 0.5));
      slabs.setMatrixAt(i, m4);
      glass.setMatrixAt(i, m4);
    }
    slabs.instanceMatrix.needsUpdate = true;
    glass.instanceMatrix.needsUpdate = true;
    slabs.visible = glass.visible = open < 0.999;
  };
  setRoof(0);

  const sign = k.label(opts.name, { sub: opts.sub, height: 3.4 });
  sign.sprite.position.set(BAY_CX, H + RISE + 2.5, 0);
  g.add(sign.sprite);

  let last = -1;
  return {
    update(p: number, approach: number) {
      // el techo se enrolla antes de que la cámara cruce el portón (entra luz) y queda abierto;
      // los muros siguen en pie: la cámara está dentro de la bahía
      const roof = Math.max(approach, k.aerial);
      sign.opacity = smooth(range(p, 0, 0.04)) * (1 - smooth(range(p, 0.12, 0.22)));
      const key = roof + k.aerial * 2;
      if (key === last) return;
      last = key;
      // en la vista aérea final se abre toda la nave
      shell.scale.y = lerp(1, 0.2, k.aerial);
      setRoof(roof);
    },
  };
}
