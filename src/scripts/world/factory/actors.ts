import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ZONES, type Kit, type WorkerSpec } from '../kit';
import { range } from '../palette';

// ---------- trabajadores: 5 InstancedMesh para todo el campus ----------

const SCALE = 1.5;
const HIP = 0.85;
const SHOULDER = 1.48;

type Live = {
  s: WorkerSpec;
  path?: THREE.CurvePath<THREE.Vector3>;
  len: number;
  base: THREE.Vector3;
};

export class Workers {
  private live: Live[];
  private legs: THREE.InstancedMesh;
  private arms: THREE.InstancedMesh;
  private torso: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private helmet: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private part = new THREE.Matrix4();
  private rot = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private sc = new THREE.Vector3(SCALE, SCALE, SCALE);
  private pos = new THREE.Vector3();
  private tan = new THREE.Vector3();

  constructor(k: Kit, specs: WorkerSpec[]) {
    this.live = specs.map((s) => {
      const [zx, zz] = ZONES[s.zone];
      const y = s.y ?? 0.6;
      const base = new THREE.Vector3(zx + (s.at?.[0] ?? 0), y, zz + (s.at?.[1] ?? 0));
      if (!s.path) return { s, len: 0, base };
      const path = new THREE.CurvePath<THREE.Vector3>();
      const pts = s.path.map(([x, z]) => new THREE.Vector3(zx + x, y, zz + z));
      pts.forEach((a, i) => path.add(new THREE.LineCurve3(a, pts[(i + 1) % pts.length])));
      return { s, path, len: path.getLength(), base };
    });
    const n = this.live.length;
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number) => {
      const im = new THREE.InstancedMesh(geo, mat, count);
      im.castShadow = true;
      im.frustumCulled = false;
      k.scene.add(im);
      return im;
    };
    const uniform = k.mat('accent3', 0.15, { roughness: 0.7 });
    this.legs = mk(new THREE.BoxGeometry(0.22, 0.82, 0.26).translate(0, -0.41, 0), k.mat('belt', 0, { roughness: 0.8 }), n * 2);
    this.arms = mk(new THREE.BoxGeometry(0.16, 0.64, 0.18).translate(0, -0.3, 0), uniform, n * 2);
    this.torso = mk(new THREE.BoxGeometry(0.56, 0.68, 0.32).translate(0, 0.34, 0), uniform, n);
    this.head = mk(new THREE.SphereGeometry(0.19, 12, 10), k.mat('skin', 0, { roughness: 0.6 }), n);
    this.helmet = mk(
      new THREE.SphereGeometry(0.23, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1.1),
      k.mat('review', 0.35, { roughness: 0.4 }),
      n,
    );
  }

  private put(im: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ax = 0) {
    this.part.makeTranslation(x, y, z);
    if (ax) this.part.multiply(this.rot.makeRotationX(ax));
    im.setMatrixAt(i, this.part.premultiply(this.m));
  }

  update(t: number, ps: number[]) {
    this.live.forEach((w, i) => {
      const { s } = w;
      const act = s.act ?? (w.path ? 'walk' : 'work');
      const ph = s.phase ?? i * 1.7;
      let yaw = s.face ?? 0;
      let legA = 0, armL = 0, armR = 0, bob = 0;
      if (w.path) {
        const speed = s.speed ?? 1.6;
        const u = (((t * speed + ph * 7) / w.len) % 1 + 1) % 1;
        w.path.getPointAt(u, this.pos);
        w.path.getTangentAt(u, this.tan);
        yaw = Math.atan2(this.tan.x, this.tan.z);
        const step = t * speed * 2.6 + ph;
        legA = Math.sin(step) * 0.55;
        armL = Math.sin(step) * 0.45;
        armR = -armL;
        bob = Math.abs(Math.cos(step)) * 0.05;
      } else {
        this.pos.copy(w.base);
        if (act === 'work') {
          armL = -0.9 + Math.sin(t * 3 + ph) * 0.45;
          armR = -0.9 + Math.sin(t * 3 + ph + 0.6) * 0.45;
          bob = Math.max(0, Math.sin(t * 3 + ph)) * 0.04;
        } else if (act === 'stamp') {
          const hit = Math.pow(Math.abs(Math.sin(t * 2.1 + ph)), 3);
          armR = -0.5 - hit * 1.6;
          armL = -0.4;
        } else if (act === 'press') {
          const [a, b] = s.press ?? [0.2, 0.3];
          armR = -0.25 - Math.sin(Math.PI * range(ps[s.zone] ?? 0, a, b)) * 1.35;
        }
      }
      this.q.setFromAxisAngle(this.up, yaw);
      this.m.compose(this.pos, this.q, this.sc);
      this.put(this.legs, i * 2, -0.13, HIP + bob, 0, legA);
      this.put(this.legs, i * 2 + 1, 0.13, HIP + bob, 0, -legA);
      this.put(this.torso, i, 0, HIP + bob, 0);
      this.put(this.arms, i * 2, -0.37, SHOULDER + bob, 0, armL);
      this.put(this.arms, i * 2 + 1, 0.37, SHOULDER + bob, 0, armR);
      this.put(this.head, i, 0, 1.75 + bob, 0);
      this.put(this.helmet, i, 0, 1.8 + bob, 0);
    });
    for (const im of [this.legs, this.arms, this.torso, this.head, this.helmet]) im.instanceMatrix.needsUpdate = true;
  }
}

// ---------- vehículos sobre un circuito cerrado ----------

export class Vehicle {
  obj = new THREE.Group();
  private p = new THREE.Vector3();
  private look = new THREE.Vector3();
  private len: number;
  constructor(private curve: THREE.Curve<THREE.Vector3>, private speed: number, private offset = 0) {
    this.len = curve.getLength();
  }
  update(t: number) {
    const u = (((t * this.speed) / this.len + this.offset) % 1 + 1) % 1;
    this.curve.getPointAt(u, this.p);
    this.curve.getPointAt((u + 0.002) % 1, this.look);
    this.obj.position.copy(this.p);
    this.obj.lookAt(this.look);
  }
}

/** camión de reparto (3 mallas) */
export function truck(k: Kit) {
  const g = new THREE.Group();
  const cab = k.box(2.6, 2.6, 2.4, k.mat('accent', 0.25, { roughness: 0.45 }));
  cab.position.set(0, 0.7, 3.6);
  const box = k.box(2.8, 3.2, 7, k.mat('wall', 0, { roughness: 0.8 }));
  box.position.set(0, 0.8, -1.4);
  const chassis = mergeGeometries([
    new THREE.BoxGeometry(2.2, 0.5, 10).translate(0, 0.65, 0.3),
    ...[-3.6, -2.2, 3.6].map((z) => new THREE.CylinderGeometry(0.55, 0.55, 2.7, 14).rotateZ(Math.PI / 2).translate(0, 0.55, z)),
  ]);
  const ch = new THREE.Mesh(chassis, k.mat('belt', 0, { roughness: 0.6 }));
  ch.castShadow = true;
  g.add(cab, box, ch);
  return g;
}

/** brazo robot de 2 segmentos con pinza y caja; se anima con angles(t) */
export function robotArm(k: Kit) {
  const steel = k.mat('steel', 0, { roughness: 0.4, metalness: 0.5 });
  const paint = k.mat('accent', 0.3, { roughness: 0.4 });
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 1.2, 20).translate(0, 0.6, 0), steel);
  base.castShadow = true;
  const turret = new THREE.Group();
  turret.position.y = 1.2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 16).translate(0, 0.7, 0), paint);
  hub.castShadow = true;
  const shoulder = new THREE.Group();
  shoulder.position.y = 1.4;
  const upper = k.box(0.8, 7, 0.8, paint);
  const elbow = new THREE.Group();
  elbow.position.y = 7;
  const fore = k.box(0.6, 6, 0.6, steel);
  const wrist = new THREE.Group();
  wrist.position.y = 6;
  const claw = k.box(1.6, 0.5, 1.6, paint);
  const crate = k.box(1.4, 1.2, 1.4, k.mat('accent2', 0.25, { roughness: 0.6 }));
  crate.position.y = 0.5;
  wrist.add(claw, crate);
  elbow.add(fore, wrist);
  shoulder.add(upper, elbow);
  turret.add(hub, shoulder);
  root.add(base, turret);
  return {
    root,
    crate,
    pose(yaw: number, sh: number, el: number) {
      turret.rotation.y = yaw;
      shoulder.rotation.x = sh;
      elbow.rotation.x = el;
      // la pinza siempre mira al suelo
      wrist.rotation.x = Math.PI - sh - el;
    },
  };
}
