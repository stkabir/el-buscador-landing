import * as THREE from 'three';
import type { Kit, Role, Zone } from '../kit';
import { easeOut, range, rng, smooth } from '../palette';
import { squarify } from '../treemap';
import { department } from '../factory/department';
import { robotArm } from '../factory/actors';
import { CRATE_Y, spurFrame } from '../factory/conveyor';
import { BOX, BOX_H, ik2, station } from '../factory/station';

// ---------- 2 · nave de clasificación: brazos robot apilan torres por peso ----------
export function zoneMap(k: Kit): Zone {
  const dep = department(k, 2, 'Nave 2 · Clasificación', 'lo pesado, a la vista');
  const { g } = dep;
  const S = 46;
  const named: [string, string, number][] = [
    ['Juegos', '64,1 GB', 64],
    ['Videos', '38,6 GB', 38],
    ['AppData', '21,3 GB', 21],
    ['node_modules', '14,2 GB', 14],
  ];
  const rand = rng(21);
  const vals = [...named.map((n) => n[2]), ...Array.from({ length: 34 }, () => 0.4 + Math.pow(rand(), 2.6) * 9)];
  const rects = squarify(vals, { x: -S / 2, y: -S / 2, w: S, h: S });
  const ramp: Role[] = ['accent', 'accent2', 'accent3'];
  const cells = rects.map((r, i) => {
    const role: Role = i < 4 ? ramp[Math.min(i, 2)] : i < 10 ? 'accent3' : 'neutral';
    const h = 1 + Math.sqrt(vals[i]) * 1.5;
    const b = k.box(Math.max(r.w - 0.6, 0.3), 1, Math.max(r.h - 0.6, 0.3), k.mat(role, i < 4 ? 0.3 : i < 10 ? 0.12 : 0));
    b.position.set(r.x + r.w / 2, 0.6, r.y + r.h / 2);
    g.add(b);
    return { b, h, delay: i / rects.length };
  });
  const labels = named.map(([name, size], i) => {
    const l = k.label(name, { sub: size, height: 2.6 });
    const c = cells[i];
    l.sprite.position.set(c.b.position.x, c.h + 1.8, c.b.position.z);
    g.add(l.sprite);
    return l;
  });

  // brazos robot grandes del lado del fondo, alcanzando las torres
  const arms = [
    { x: -dep.hw - 2.2, z: -10, yaw: Math.PI / 2, ph: 0 },
    { x: -dep.hw - 2.2, z: 10, yaw: Math.PI / 2, ph: 4.2 },
  ].map((a) => {
    const arm = robotArm(k);
    arm.root.position.set(a.x, 0, a.z);
    g.add(arm.root);
    return { ...a, arm };
  });

  dep.worker({ path: dep.rim(), speed: 1.3, phase: 1 });
  dep.worker({ path: [[-8, dep.hd], [8, dep.hd]], speed: 1.1, phase: 3 });

  // ---------- estación de primer plano: brazo que clasifica la caja en su pallet ----------
  const T = 4.2;
  const sx = spurFrame(2).mid;
  const st = station(k, g, 2, { T, hold: 0.45 * T, out: 0.01, stop: sx });
  const AS = 0.6; // escala del brazo
  const L1 = 7 * AS, L2 = 6 * AS, PIV = 2.6 * AS;
  const arm = robotArm(k);
  const base = new THREE.Vector3(sx, 0, -3.8);
  arm.root.position.copy(base);
  arm.root.scale.setScalar(AS);
  arm.crate.scale.setScalar(1.5);
  g.add(arm.root);
  /** del pivote del hombro a la base de la caja que cuelga */
  const HANG = (0.5 + 1.2 * 1.5) * AS;
  const pallet = new THREE.Vector3(sx - 1.2, 0, -7.6);
  const pal = k.models.prop('pallet', 1.5);
  pal.position.copy(pallet);
  g.add(pal);
  const stack = Array.from({ length: 5 }, (_, j) => {
    const b = k.models.prop('box', BOX);
    b.position.set(pallet.x, 0.21 + j * BOX_H, pallet.z);
    b.visible = false;
    g.add(b);
    return b;
  });
  const sign = k.models.prop('aisle-sign', 2.2);
  sign.position.set(pallet.x, 7.4, pallet.z - 0.6);
  g.add(sign);
  const tag = k.label('Juegos', { sub: '64,1 GB', height: 1.6 });
  tag.sprite.position.set(pallet.x, 9.6, pallet.z - 0.6);
  g.add(tag.sprite);
  const fixer = k.models.character('worker', 2, ['Fixing'], { offset: 0.2 });
  fixer.obj.position.set(sx + 2.4, 0, -5.4);
  fixer.obj.rotation.y = -1.9;
  const boss = k.models.character('manager', 2, ['Agree'], { offset: 0.7 });
  boss.obj.position.set(sx - 3.6, 0, -2.2);
  boss.obj.rotation.y = 2.4;
  g.add(fixer.obj, boss.obj);

  const tgt = new THREE.Vector3();
  const keys = (top: number) => {
    const pick = new THREE.Vector3(sx, CRATE_Y + HANG, 0);
    const place = new THREE.Vector3(pallet.x, top + HANG, pallet.z);
    const up = (v: THREE.Vector3) => v.clone().setY(Math.max(v.y + 2.2, 6));
    const home = new THREE.Vector3(sx + 1.6, 6.4, -2.4);
    // [fase final, punto]
    return [
      [0, home], [0.2, up(pick)], [0.4, pick], [0.47, pick], [0.62, up(pick)],
      [0.78, up(place)], [0.86, place], [0.9, place], [1, home],
    ] as [number, THREE.Vector3][];
  };
  const reach = (c: number, top: number) => {
    const ks = keys(top);
    let j = 1;
    while (j < ks.length - 1 && c > ks[j][0]) j++;
    const [a0, pa] = ks[j - 1], [a1, pb] = ks[j];
    tgt.lerpVectors(pa, pb, smooth((c - a0) / Math.max(a1 - a0, 1e-3)));
    const dx = tgt.x - base.x, dz = tgt.z - base.z;
    const { sh, el } = ik2(Math.hypot(dx, dz), tgt.y - PIV, L1, L2);
    arm.pose(Math.atan2(dx, dz), sh, el);
  };

  return {
    update: (p, t) => {
      dep.update(p, t);
      // la caja llega al tope; el brazo la toma en c≈0.45 y la deja en el pallet en c≈0.88
      const c = (t / T) % 1;
      const done = Math.floor(t / T);
      const n = done % 6;
      reach(c, 0.21 + Math.min(n, 5) * BOX_H);
      st.update(t, (b, s) => {
        if (s.phase === 'hold' && s.f > 0.98) b.visible = false;
        if (s.phase === 'out') b.visible = false;
      });
      arm.crate.visible = c > 0.45 && c < 0.88;
      const onPallet = Math.min(n + (c >= 0.88 ? 1 : 0), 5);
      stack.forEach((b, j) => (b.visible = j < onPallet));
      tag.opacity = smooth(range(p, 0.2, 0.35));
      for (const c of cells) c.b.scale.y = Math.max(0.01, c.h * easeOut(range(p, 0.02 + c.delay * 0.4, 0.3 + c.delay * 0.4)));
      labels.forEach((l, i) => (l.opacity = smooth(range(p, 0.35 + i * 0.07, 0.48 + i * 0.07))));
      for (const a of arms) {
        // ciclo: toma en el pasillo (atrás), gira y deja sobre la torre (adelante)
        const c = t * 0.7 + a.ph;
        const swing = Math.sin(c);
        a.arm.pose(a.yaw + swing * 0.9, 0.25 + Math.cos(c * 2) * 0.1, 1.0 + Math.sin(c * 2) * 0.2);
        a.arm.crate.visible = Math.cos(c) > -0.2;
      }
    },
  };
}
