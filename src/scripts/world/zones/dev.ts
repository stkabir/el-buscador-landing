import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Kit, Role, Zone } from '../kit';
import { easeOut, lerp, range, rng, smooth } from '../palette';
import { department } from '../factory/department';
import { CRATE_Y, spurFrame } from '../factory/conveyor';
import { arc, station } from '../factory/station';

// ---------- 4 · reciclaje dev: montañas de basura y una compactadora ----------
export function zoneDev(k: Kit): Zone {
  const dep = department(k, 4, 'Nave 4 · Reciclaje dev', 'lo que se regenera');
  const { g } = dep;
  const rand = rng(41);
  const piles: { name: string; sub: string; x: number; z: number; r: number; n: number; role: Role }[] = [
    { name: 'node_modules', sub: '312 carpetas · 41,8 GB', x: -9, z: 4, r: 11, n: 1100, role: 'accent' },
    { name: '.next', sub: '18 carpetas · 6,2 GB', x: 12, z: -8, r: 6.5, n: 380, role: 'accent2' },
    { name: 'cachés', sub: 'pnpm, npm, pip · 9,4 GB', x: 13, z: 11, r: 7, n: 460, role: 'accent3' },
  ];
  const cube = new THREE.BoxGeometry(0.85, 0.85, 0.85);
  const dummy = new THREE.Object3D();
  const all = piles.map((pile, pi) => {
    const n = k.mobile ? Math.round(pile.n * 0.6) : pile.n;
    const mesh = new THREE.InstancedMesh(cube, k.mat(pile.role, 0.3, { roughness: 0.6 }), n);
    mesh.frustumCulled = false; // las instancias se mueven: el bounding sphere inicial no sirve
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const items = Array.from({ length: n }, () => {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * pile.r;
      const y = 0.9 + Math.max(0, 1 - rr / pile.r) * pile.r * 0.9 * (0.7 + rand() * 0.3);
      return { x: pile.x + Math.cos(a) * rr, y, z: pile.z + Math.sin(a) * rr, rot: rand() * 6, delay: rand() * 0.5, spin: rand() };
    });
    items.sort((a, b) => a.y - b.y);
    items.forEach((it, i) => (it.delay = (i / items.length) * 0.45 + rand() * 0.08));
    g.add(mesh);
    const l = k.label(pile.name, { sub: pile.sub, height: 2.8, tone: pi === 0 ? 'safe' : 'accent' });
    l.sprite.position.set(pile.x, pile.r * 0.9 + 2.6, pile.z);
    g.add(l.sprite);
    return { mesh, items, l };
  });

  // compactadora: bancada, pórtico y pistón que aplasta un bloque
  const press = new THREE.Group();
  const steel = k.mat('steel', 0, { roughness: 0.4, metalness: 0.5 });
  const frame = new THREE.Mesh(
    mergeGeometries([
      new THREE.BoxGeometry(7, 1, 6).translate(0, 0.5, 0),
      new THREE.BoxGeometry(0.9, 10, 0.9).translate(-3, 5, -2.4),
      new THREE.BoxGeometry(0.9, 10, 0.9).translate(3, 5, -2.4),
      new THREE.BoxGeometry(0.9, 10, 0.9).translate(-3, 5, 2.4),
      new THREE.BoxGeometry(0.9, 10, 0.9).translate(3, 5, 2.4),
      new THREE.BoxGeometry(7.4, 1.2, 6).translate(0, 10.4, 0),
    ]),
    steel,
  );
  frame.castShadow = true;
  const ram = k.box(5, 1.2, 4.2, k.mat('review', 0.25, { roughness: 0.4 }));
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1, 12).translate(0, 0.5, 0), steel);
  const block = k.box(3.6, 3, 3.2, k.mat('accent', 0.35, { roughness: 0.6 }));
  block.position.y = 1;
  press.add(frame, ram, rod, block);
  press.position.set(-14, 0.6, -14);
  g.add(press);
  const pl = k.label('Compactadora', { sub: 'se regenera con pnpm i', height: 2.4, tone: 'safe' });
  pl.sprite.position.set(-14, 13.5, -14);
  g.add(pl.sprite);

  dep.worker({ at: [-22.4, 4], face: Math.PI / 2, act: 'work', phase: 0 });
  dep.worker({ at: [20.3, -8], face: -Math.PI / 2, act: 'work', phase: 1.2 });
  dep.worker({ at: [21.6, 11], face: -Math.PI / 2, act: 'work', phase: 2.4 });
  dep.worker({ at: [-14, -9.6], face: Math.PI, act: 'work', phase: 0.7 });

  // ---------- estación de primer plano: la caja node_modules va a la trituradora ----------
  const T = 3.2;
  const sf = spurFrame(4);
  const st = station(k, g, 4, { T, hold: 0.01, out: 2.6, stop: sf.mid + 2 });
  const shredder = k.models.prop('shredder', 5);
  const mouth = new THREE.Vector3(sf.x0 - 1.6, 0.6, 0);
  shredder.position.copy(mouth);
  shredder.rotation.y = Math.PI / 2;
  const dumpster = k.models.prop('dumpster', 1.4);
  dumpster.position.set(sf.x0 - 2.2, 0.6, -4.6);
  g.add(shredder, dumpster);
  const mouthTop = new THREE.Vector3(mouth.x, 0.6 + 0.7 * 5 - 0.2, 0);
  // tiras de papel que caen al contenedor
  const STRIPS = 36;
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.5, 0.03), k.mat('neutral', 0.2, { roughness: 0.8 }), STRIPS);
  strips.frustumCulled = false;
  strips.castShadow = true;
  g.add(strips);
  const tmp = new THREE.Object3D();
  const from = new THREE.Vector3(mouth.x, 1.6, -0.9);
  const to = new THREE.Vector3(sf.x0 - 2.2, 1.8, -4.4);
  const pt = new THREE.Vector3();
  const edge = new THREE.Vector3(sf.x0 - 0.1, CRATE_Y, 0);
  const fixer = k.models.character('worker', 4, ['Pushing'], { offset: 0.5 });
  fixer.obj.position.set(sf.mid + 0.4, 0, -1.9);
  fixer.obj.rotation.y = -Math.PI / 2;
  const boss = k.models.character('manager', 4, ['Agree'], { offset: 0.3 });
  boss.obj.position.set(sf.x0 + 1.2, 0, -4.2);
  boss.obj.rotation.y = -0.6;
  g.add(fixer.obj, boss.obj);

  return {
    update: (p, t) => {
      dep.update(p, t);
      // al final del ramal la caja salta a la boca y se encoge dentro
      st.update(t, (b, s) => {
        if (s.phase !== 'out') return;
        if (s.f < 0.62) {
          b.position.x = lerp(sf.mid + 2, edge.x, s.f / 0.62);
          return;
        }
        const jump = range(s.f, 0.62, 1);
        arc(edge, mouthTop, 1.6, jump, pt);
        b.position.copy(pt);
        b.rotation.z = jump * 1.2;
        b.scale.setScalar(Math.max(0.01, 1 - smooth(range(jump, 0.75, 1))));
      });
      const cs = (t / T) % 1;
      for (let i = 0; i < STRIPS; i++) {
        const f = (cs + i / STRIPS) % 1;
        arc(from, to, 0.8, f, pt);
        tmp.position.copy(pt);
        tmp.position.y -= f * 0.6;
        tmp.rotation.set(f * 9 + i, i * 0.7, f * 5);
        tmp.scale.setScalar(f < 0.98 ? 1 : 0);
        tmp.updateMatrix();
        strips.setMatrixAt(i, tmp.matrix);
      }
      strips.instanceMatrix.needsUpdate = true;
      for (const { mesh, items, l } of all) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const kk = easeOut(range(p, it.delay, it.delay + 0.25));
          dummy.position.set(it.x, it.y + (1 - kk) * 34, it.z);
          dummy.rotation.set(it.rot + (1 - kk) * 4, it.rot * 0.7 + (1 - kk) * 3 + Math.sin(t + it.spin * 6) * 0.04, 0);
          dummy.scale.setScalar(kk > 0.001 ? 1 : 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        l.opacity = smooth(range(p, 0.55, 0.7));
      }
      // ciclo de 4 s: baja, aplasta, sube y entra un bloque nuevo
      const c = (t * 0.25) % 1;
      const down = smooth(range(c, 0.1, 0.35)) * (1 - smooth(range(c, 0.55, 0.8)));
      const squash = smooth(range(c, 0.25, 0.35)) * (1 - smooth(range(c, 0.85, 1)));
      const top = 1 + 3 * (1 - 0.75 * squash);
      ram.position.y = 9.8 - 1.2 - (9.8 - 1.2 - top) * down;
      rod.position.y = ram.position.y + 1.2;
      rod.scale.y = Math.max(0.01, 9.8 - rod.position.y);
      block.scale.y = 1 - 0.75 * squash;
      pl.opacity = smooth(range(p, 0.3, 0.45));
    },
  };
}
