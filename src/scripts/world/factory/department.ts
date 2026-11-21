import * as THREE from 'three';
import { BAY_CX, BAY_D, BAY_W, BELT_X, PLINTH, type Kit, type WorkerSpec } from '../kit';
import { Vehicle } from './actors';
import { M } from '../models';
import { bay } from './shell';

/** zócalo + bahía de la nave + montacargas yendo y viniendo por el pasillo junto a la cinta */
export function department(k: Kit, i: number, name: string, sub: string) {
  const g = k.group(i);
  const [w, d] = PLINTH[i];
  k.plinth(g, w, d);
  const shell = bay(k, g, { front: i === 1, name, sub });

  // pasillo entre la cinta y el muro +x
  const lx = (BELT_X + 1.6 + BAY_CX + BAY_W / 2) / 2;
  const lz = BAY_D / 2 - 5;
  const lane = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(lx - 1.6, 0, lz),
      new THREE.Vector3(lx - 1.6, 0, -lz),
      new THREE.Vector3(lx, 0, -lz - 2),
      new THREE.Vector3(lx + 1.6, 0, -lz),
      new THREE.Vector3(lx + 1.6, 0, lz),
      new THREE.Vector3(lx, 0, lz + 2),
    ],
    true,
    'centripetal',
  );
  const lift = new Vehicle(lane, 3.2, i * 0.37);
  lift.obj.add(k.models.prop('forklift', M));
  g.add(lift.obj);

  return {
    g,
    /** medio ancho/fondo útil del zócalo (borde por donde caminan los operarios) */
    hw: w / 2 - 1.2,
    hd: d / 2 - 1.2,
    /** agrega un operario a esta zona */
    worker(s: Omit<WorkerSpec, 'zone'>) {
      k.workers.push({ zone: i, ...s });
    },
    /** recorrido rectangular por el borde del zócalo */
    rim(): [number, number][] {
      const x = w / 2 - 1.2, z = d / 2 - 1.2;
      return [[-x, z], [x, z], [x, -z], [-x, -z]];
    },
    update(p: number, t: number) {
      shell.update(p, k.approach[i] ?? 0);
      lift.update(t);
    },
  };
}

export type Dept = ReturnType<typeof department>;
