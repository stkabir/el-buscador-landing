import * as THREE from 'three';
import { BELT_X, HALL_Z0, HALL_Z1, PLINTH, ZONES, type Kit, type Role, type Zone } from '../kit';
import { rng } from '../palette';

/** altura de la cinta: a la cintura de los operarios (≈1 m) */
export const BELT_Y = 1.5;
/** las cajas se apoyan sobre los rodillos */
export const CRATE_Y = BELT_Y + 0.12;
const BELT_W = 2.6;
const SPUR_W = 1.8;
const SPEED = 2.6;
const GAP = 6.5; // separación entre cajas
const PITCH = 0.75; // separación entre rodillos

/**
 * Cinta principal: nace en el muelle de carga del patio, entra por el portón
 * frontal y recorre la nave entera por el costado +x hasta salir por el fondo.
 */
function mainLine() {
  const y = BELT_Y;
  const v = (x: number, z: number) => new THREE.Vector3(x, y, z);
  return new THREE.CatmullRomCurve3(
    [v(50, 10), v(46, -14), v(BELT_X, -32), v(BELT_X, HALL_Z0 - 10), v(BELT_X, HALL_Z1 + 10), v(BELT_X, HALL_Z1 - 14)],
    false,
    'centripetal',
  );
}

/** extremo del ramal de la estación i, en coordenadas locales de la zona */
export function spurFrame(i: number) {
  const x0 = PLINTH[i][0] / 2 - 0.5; // borde del zócalo
  const x1 = BELT_X - BELT_W / 2; // borde de la cinta principal
  return { x0, x1, mid: (x0 + x1) / 2, y: CRATE_Y, w: SPUR_W };
}

/** Ramales: en cada estación una cinta corta lleva cajas de la principal al departamento. */
function spurs() {
  return [1, 2, 3, 4, 5, 6].map((i) => {
    const [, zz] = ZONES[i];
    const { x0, x1 } = spurFrame(i);
    return new THREE.LineCurve3(new THREE.Vector3(x1, BELT_Y, zz), new THREE.Vector3(x0, BELT_Y, zz));
  });
}

/** muestras de la cinta para que el parque industrial deje paso */
export function routeSamples() {
  const c = mainLine();
  return c.getSpacedPoints(Math.ceil(c.getLength() / 3));
}

export function conveyors(k: Kit): Zone {
  const lines: { c: THREE.Curve<THREE.Vector3>; w: number; crates: boolean }[] = [
    { c: mainLine(), w: BELT_W, crates: true },
    // las cajas de los ramales las mueve cada estación (se detienen en su máquina)
    ...spurs().map((c) => ({ c, w: SPUR_W, crates: false })),
  ];
  const pos: number[] = [];
  const legs: THREE.Vector3[] = [];
  const rollers: THREE.Matrix4[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) =>
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  const q = new THREE.Quaternion();
  const xAxis = new THREE.Vector3(1, 0, 0);

  for (const { c, w } of lines) {
    const len = c.getLength();
    const n = Math.max(2, Math.ceil(len / 1.5));
    const pts = c.getSpacedPoints(n);
    const sides = pts.map((_, i) => new THREE.Vector3().crossVectors(up, c.getTangentAt(i / n)).normalize());
    const off = (p: THREE.Vector3, s: THREE.Vector3, k: number, dy: number) => p.clone().addScaledVector(s, k).setY(p.y + dy);
    const h = w / 2;
    for (let i = 0; i < n; i++) {
      const [p0, p1, s0, s1] = [pts[i], pts[i + 1], sides[i], sides[i + 1]];
      // bancada bajo los rodillos y laterales
      quad(off(p0, s0, -h, -0.16), off(p0, s0, h, -0.16), off(p1, s1, h, -0.16), off(p1, s1, -h, -0.16));
      for (const sg of [-1, 1]) {
        quad(off(p0, s0, sg * h, -0.4), off(p1, s1, sg * h, -0.4), off(p1, s1, sg * h, 0.28), off(p0, s0, sg * h, 0.28));
      }
    }
    for (let i = 0; i <= n; i += 2) for (const sg of [-1, 1]) legs.push(pts[i].clone().addScaledVector(sides[i], sg * (h - 0.15)));
    // rodillos transversales
    const nr = Math.floor(len / PITCH);
    for (let i = 0; i <= nr; i++) {
      const u = i / nr;
      const p = c.getPointAt(u);
      const side = new THREE.Vector3().crossVectors(up, c.getTangentAt(u)).normalize();
      q.setFromUnitVectors(xAxis, side);
      rollers.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(w - 0.3, 1, 1)));
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const belt = new THREE.Mesh(geo, k.mat('belt', 0, { roughness: 0.6, side: THREE.DoubleSide }));
  belt.castShadow = belt.receiveShadow = true;
  k.scene.add(belt);

  const rollerMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.11, 0.11, 1, 8).rotateZ(Math.PI / 2),
    k.mat('steel', 0, { roughness: 0.35, metalness: 0.6 }),
    rollers.length,
  );
  rollers.forEach((m, i) => rollerMesh.setMatrixAt(i, m));
  rollerMesh.receiveShadow = true;
  k.scene.add(rollerMesh);

  const legMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.2, BELT_Y, 0.2).translate(0, -BELT_Y / 2, 0),
    k.mat('steel', 0, { roughness: 0.5, metalness: 0.4 }),
    legs.length,
  );
  const m4 = new THREE.Matrix4();
  legs.forEach((p, i) => legMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y - 0.16, p.z)));
  legMesh.castShadow = true;
  k.scene.add(legMesh);

  // cajas de cartón que viajan (Polyfork); hasta que carga, cubos
  const rand = rng(77);
  const crates = lines
    .filter((l) => l.crates)
    .flatMap(({ c }) => {
      const len = c.getLength();
      const gap = k.mobile ? GAP * 2 : GAP;
      const n = Math.max(1, Math.floor(len / gap));
      return Array.from({ length: n }, (_, j) => ({
        c,
        len,
        s0: (j / n) * len + rand() * 1.2,
        w: 1.2 + rand() * 0.5,
        h: 0.8 + rand() * 0.5,
        d: 1 + rand() * 0.4,
      }));
    });
  const crateMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
  const crateMesh = new THREE.InstancedMesh<THREE.BufferGeometry>(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), crateMat, crates.length);
  crateMesh.castShadow = true;
  crateMesh.receiveShadow = true;
  crateMesh.frustumCulled = false;
  k.models.unitGeometry('box').then((g) => {
    crateMesh.geometry.dispose();
    crateMesh.geometry = g;
    crateMat.vertexColors = true;
    crateMat.needsUpdate = true;
  });
  // una de cada tantas lleva una franja de color de su categoría
  const roles: Role[] = ['accent', 'accent2', 'accent3', 'review'];
  const crateRole = crates.map(() => (rand() < 0.35 ? roles[Math.floor(rand() * roles.length)] : null));
  const col = new THREE.Color();
  const white = new THREE.Color(0xffffff);
  k.scene.add(crateMesh);

  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  return {
    theme: (pal) => {
      crates.forEach((_, i) => {
        const r = crateRole[i];
        col.copy(white);
        if (r) col.lerp(new THREE.Color(pal[r]), 0.35);
        crateMesh.setColorAt(i, col);
      });
      crateMesh.instanceColor!.needsUpdate = true;
    },
    update: (_p, t) => {
      crates.forEach((cr, i) => {
        const u = ((((cr.s0 + t * SPEED) % cr.len) + cr.len) % cr.len) / cr.len;
        cr.c.getPointAt(u, p);
        cr.c.getTangentAt(u, tan);
        q.setFromAxisAngle(yAxis, Math.atan2(tan.x, tan.z));
        // aparecen y desaparecen en los extremos
        const kk = Math.min(1, (Math.min(u, 1 - u) * cr.len) / 1.5);
        p.y = CRATE_Y;
        sc.set(cr.w * kk, cr.h * kk, cr.d * kk);
        crateMesh.setMatrixAt(i, m4.compose(p, q, sc));
      });
      crateMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
