import * as THREE from 'three';
import type { Kit, Zone } from '../kit';
import { lerp, range, smooth } from '../palette';
import { department } from '../factory/department';
import { spurFrame } from '../factory/conveyor';
import { arc, station } from '../factory/station';

// ---------- 5 · duplicados: pares unidos por arcos que se funden ----------
export function zoneDupes(k: Kit): Zone {
  const dep = department(k, 5, 'Nave 5 · Duplicados', 'comparación BLAKE3');
  const { g } = dep;
  const pairs: [number, number, number, number, number, number][] = [
    // ax, az, bx, bz, size, height
    [-16, -8, 2, -12, 5, 9],
    [-12, 9, 14, 6, 4, 6],
    [-2, 0, 17, -4, 3.2, 12],
    [6, 13, -18, 14, 3.6, 5],
    [16, -13, -6, -14, 2.8, 7],
  ];
  const keepMat = k.mat('accent', 0.35, { roughness: 0.5 });
  const twinMat = k.mat('neutral', 0, { roughness: 0.5 });
  const items = pairs.map(([ax, az, bx, bz, s, h], i) => {
    const a = k.box(s, h, s, keepMat);
    a.position.set(ax, 0.6, az);
    const b = k.box(s, h, s, twinMat);
    b.position.set(bx, 0.6, bz);
    const mid = new THREE.Vector3((ax + bx) / 2, h + 9, (az + bz) / 2);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(bx, h + 0.6, bz), mid, new THREE.Vector3(ax, h + 0.6, az));
    const arcMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, fog: false });
    const arc = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.12, 6), arcMat);
    arc.geometry.setDrawRange(0, 0);
    g.add(a, b, arc);
    return { a, b, arc, arcMat, h, from: new THREE.Vector3(bx, 0.6, bz), to: new THREE.Vector3(ax, 0.6, az), d: i * 0.06 };
  });
  const total = items[0].arc.geometry.index!.count;
  const l = k.label('foto_2024.jpg ×2', { sub: 'mismo BLAKE3', height: 2.6 });
  l.sprite.position.set(items[0].a.position.x, items[0].h + 2, items[0].a.position.z);
  g.add(l.sprite);

  dep.worker({ path: dep.rim(), speed: 1.5, phase: 0.5 });
  dep.worker({ path: dep.rim(), speed: 1.5, phase: 6 });
  dep.worker({ at: [-dep.hw + 0.4, -2], face: Math.PI / 2, act: 'work', phase: 1 });

  // ---------- estación de primer plano: balanza con dos cajas gemelas ----------
  const T = 5;
  const sx = spurFrame(5).mid;
  const st = station(k, g, 5, { T: 3, hold: 0.6, out: 2.4, stop: sx });
  const steel = k.mat('steel', 0, { roughness: 0.35, metalness: 0.6 });
  const brass = k.mat('review', 0.15, { roughness: 0.3, metalness: 0.7 });
  const bal = new THREE.Group();
  bal.position.set(sx - 0.4, 0, -4);
  const post = k.box(0.35, 3.6, 0.35, steel);
  const foot = k.box(2, 0.25, 1.2, steel);
  const beamG = new THREE.Group();
  beamG.position.y = 3.7;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 0.3), brass);
  beam.castShadow = true;
  beamG.add(beam);
  const pans = [-2.1, 2.1].map((x) => {
    const pan = new THREE.Group();
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.75, 0.16, 24), brass);
    dish.castShadow = true;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6).translate(0, 0.8, 0), steel);
    pan.add(dish, rod);
    const box = k.models.prop('box', 1.8);
    box.position.y = 0.08;
    pan.add(box);
    g.add(pan);
    return { pan, box, x };
  });
  bal.add(post, foot, beamG);
  g.add(bal);
  const pivot = new THREE.Vector3();
  // láser que compara los dos contenidos
  const laserMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const laser = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.04, 0.04), laserMat);
  g.add(laser);
  const hashTag = k.label('BLAKE3 idéntico', { sub: 'una copia sobra', height: 1.4, tone: 'review' });
  g.add(hashTag.sprite);
  const bin = k.models.prop('wheelie-bin', 1.8);
  const binPos = new THREE.Vector3(sx + 3.4, 0, -4.6);
  bin.position.copy(binPos);
  bin.rotation.y = -0.4;
  g.add(bin);
  const fly = new THREE.Vector3();
  const binTop = binPos.clone().setY(2.2);
  const op = k.models.character('worker', 5, ['Interact'], { offset: 0.6 });
  op.obj.position.set(sx - 4.9, 0, -2.2);
  op.obj.rotation.y = 1.9;
  const boss = k.models.character('manager', 5, ['Agree'], { offset: 0.2 });
  boss.obj.position.set(sx + 1.6, 0, -1.9);
  boss.obj.rotation.y = -2.2;
  g.add(op.obj, boss.obj);

  return {
    theme: (pal) => {
      items.forEach((it) => it.arcMat.color.setHex(pal.accent));
      laserMat.color.setHex(pal.accent);
    },
    update: (p, t) => {
      dep.update(p, t);
      st.update(t);
      // ciclo: oscila y se equilibra → láser compara → la copia salta al cubo → llega otra
      const c = (t / T) % 1;
      const settle = range(c, 0, 0.35);
      const tilt = Math.sin(settle * 16) * 0.22 * (1 - settle) * (c < 0.35 ? 1 : 0);
      beamG.rotation.z = tilt;
      bal.updateMatrixWorld();
      pans.forEach(({ pan, box, x }, j) => {
        pivot.set(x * Math.cos(tilt), 3.7 + x * Math.sin(tilt) - 1.75, 0);
        pan.position.copy(pivot).applyMatrix4(bal.matrix);
        if (j === 1) {
          // la copia: salta al cubo y vuelve a aparecer en el plato
          const jump = range(c, 0.62, 0.82);
          const back = range(c, 0.9, 1);
          if (jump > 0 && back === 0) {
            const start = pan.position.clone().setY(pan.position.y + 0.08);
            arc(start, binTop, 1.8, jump, fly);
            box.position.copy(fly).sub(pan.position);
            box.scale.setScalar(jump < 0.999 ? 1 : 0.001);
          } else {
            box.position.set(0, 0.08 + (1 - smooth(back)) * (back > 0 ? 3 : 0), 0);
            box.scale.setScalar(back > 0 || c < 0.62 ? 1 : 0.001);
          }
        }
      });
      const scan = range(c, 0.38, 0.6);
      laserMat.opacity = Math.sin(Math.PI * scan) * 0.9;
      laser.position.set(bal.position.x, 2.3 + 0.9 * Math.sin(scan * Math.PI * 3) * 0.5 + 0.4, bal.position.z);
      hashTag.sprite.position.set(bal.position.x, 6.2, bal.position.z);
      hashTag.opacity = smooth(range(c, 0.45, 0.55)) * (1 - smooth(range(c, 0.85, 0.95))) * smooth(range(p, 0.2, 0.3));
      for (const it of items) {
        const draw = smooth(range(p, 0.1 + it.d, 0.4 + it.d));
        it.arc.geometry.setDrawRange(0, Math.floor((total * draw) / 6) * 6);
        const merge = smooth(range(p, 0.5 + it.d, 0.78 + it.d));
        it.b.position.lerpVectors(it.from, it.to, merge);
        it.b.position.y = 0.6 + Math.sin(Math.PI * merge) * 8;
        it.b.scale.setScalar(lerp(1, 0.6, merge));
        it.b.visible = merge < 0.995;
        it.arcMat.opacity = 0.9 * (1 - merge);
        it.a.scale.y = 1 + Math.sin(Math.PI * range(merge, 0.8, 1)) * 0.12;
      }
      l.opacity = smooth(range(p, 0.3, 0.42)) * (1 - smooth(range(p, 0.6, 0.7)));
    },
  };
}
