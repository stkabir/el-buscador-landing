import * as THREE from 'three';
import type { Kit, Zone } from '../kit';
import { lerp, range, rng, smooth } from '../palette';
import { squarify } from '../treemap';
import { department } from '../factory/department';
import { CRATE_Y, spurFrame } from '../factory/conveyor';
import { arc, station } from '../factory/station';

// ---------- 6 · despacho: el operario confirma y las cajas van al contenedor ----------
export function zoneClean(k: Kit): Zone {
  const dep = department(k, 6, 'Nave 6 · Despacho', 'tú confirmas');
  const { g } = dep;
  // contenedor-papelera
  const bin = new THREE.Group();
  const binMat = k.mat('neutral', 0, { roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 5.2, 10, 40, 1, true).translate(0, 5, 0), binMat);
  body.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.4, 40).translate(0, 0.2, 0), binMat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(6.4, 0.3, 10, 64), k.mat('accent', 1));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 10;
  bin.add(body, base, rim);
  bin.position.set(14, 0.6, -6);
  g.add(bin);

  // terreno liberado
  const freed = new THREE.Mesh(new THREE.PlaneGeometry(22, 18), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, fog: false }));
  freed.rotation.x = -Math.PI / 2;
  freed.position.set(-9, 0.65, 4);
  g.add(freed);
  const freedLabel = k.label('Seguro · seleccionado', { sub: '23,4 GB', tone: 'safe', height: 2.6 });
  freedLabel.sprite.position.set(-9, 13, 4);
  g.add(freedLabel.sprite);

  // ---------- estación de primer plano: puesto de despacho con el botón Confirmar ----------
  const sf = spurFrame(6);
  const sx = sf.mid;
  const st = station(k, g, 6, { T: 2.6, hold: 0.01, out: 2.6, stop: sx });
  const bench = k.models.prop('bench', 1.5);
  bench.position.set(sx - 0.6, 0, -3.6);
  g.add(bench);
  const desk = k.box(1.1, 1.6, 1, k.mat('steel', 0, { roughness: 0.4, metalness: 0.4 }));
  desk.position.set(sx + 2.6, 0, -1.7);
  const btnMat = k.mat('safe', 0.6, { roughness: 0.3 });
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.22, 20), btnMat);
  btn.position.set(sx + 2.6, 1.7, -1.7);
  g.add(desk, btn);
  const btnLabel = k.label('Confirmar', { sub: 'nada se borra solo', tone: 'safe', height: 1.5 });
  btnLabel.sprite.position.set(sx + 2.6, 3.6, -1.7);
  g.add(btnLabel.sprite);
  const op = k.models.character('worker', 6, ['Idle', 'Interact']);
  op.obj.position.set(sx + 2.6, 0, -2.9);
  const boss = k.models.character('manager', 6, ['Agree'], { offset: 0.5 });
  boss.obj.position.set(sx - 1.4, 0, -5.4);
  boss.obj.rotation.y = 0.5;
  g.add(op.obj, boss.obj);
  // cubos al final del ramal
  [-1.1, 1.1].forEach((z) => {
    const b = k.models.prop('wheelie-bin', 1.7);
    b.position.set(sf.x0 - 1.2, 0.6, z);
    b.rotation.y = Math.PI / 2;
    g.add(b);
  });
  const edge = new THREE.Vector3(sf.x0 + 0.2, CRATE_Y, 0);
  const fly = new THREE.Vector3();
  const binTop = new THREE.Vector3(sf.x0 - 1.2, 0.6 + 1.9, 0);
  // la línea está parada hasta confirmar: su reloj solo corre después
  let lineT = 0;
  dep.worker({ path: dep.rim(), speed: 1.4, phase: 2 });

  const rand = rng(61);
  const rects = squarify(Array.from({ length: 18 }, () => 1 + rand() * 6), { x: -20, y: -5, w: 22, h: 18 });
  const mat = k.mat('safe', 0.35, { roughness: 0.55 });
  const flyers = rects.map((r, i) => {
    const h = 1.5 + rand() * 6;
    const b = k.box(Math.max(r.w - 0.5, 0.3), h, Math.max(r.h - 0.5, 0.3), mat);
    const from = new THREE.Vector3(r.x + r.w / 2, 0.6, r.y + r.h / 2);
    b.position.copy(from);
    g.add(b);
    const to = new THREE.Vector3(bin.position.x + (rand() - 0.5) * 3, 4, bin.position.z + (rand() - 0.5) * 3);
    const ctrl = new THREE.Vector3((from.x + to.x) / 2, 22 + rand() * 6, (from.z + to.z) / 2);
    return { b, from, to, ctrl, d: (i / rects.length) * 0.4 };
  });
  const q = new THREE.QuadraticBezierCurve3();
  const counter = document.querySelector<HTMLElement>('[data-counter]');
  const target = counter ? parseFloat(counter.dataset.counter!) : 0;
  const fmt = new Intl.NumberFormat('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  let lastShown = -1;
  return {
    theme: (pal) => (freed.material as THREE.MeshBasicMaterial).color.setHex(pal.accent),
    update: (p, t) => {
      dep.update(p, t);
      // el botón se hunde cuando el operario lo pulsa; entonces arranca la línea
      const press = range(p, 0.2, 0.3);
      btn.position.y = 1.7 - Math.sin(Math.PI * press) * 0.12;
      const open = p > 0.26;
      op.play(p > 0.14 && p < 0.34 ? 'Interact' : 'Idle');
      if (open) lineT += k.dt;
      st.update(lineT + 1.3, (b, s) => {
        if (s.phase !== 'out' || s.f < 0.6) return;
        const jump = range(s.f, 0.6, 1);
        const target = binTop.clone().setZ(s.k % 2 ? -1.1 : 1.1);
        arc(edge, target, 1.2, jump, fly);
        b.position.copy(fly);
        b.rotation.z = jump;
        b.scale.setScalar(Math.max(0.01, 1 - smooth(range(jump, 0.8, 1))));
      });
      btnLabel.opacity = smooth(range(p, 0.08, 0.16)) * (1 - smooth(range(p, 0.3, 0.38)));
      let done = 0;
      for (const f of flyers) {
        const kk = range(p, 0.28 + f.d, 0.48 + f.d);
        q.v0.copy(f.from); q.v1.copy(f.ctrl); q.v2.copy(f.to);
        q.getPoint(smooth(kk), f.b.position);
        f.b.scale.setScalar(lerp(1, 0.15, smooth(range(kk, 0.6, 1))));
        f.b.rotation.set(kk * 2.4, kk * 3.1, 0);
        f.b.visible = kk < 0.999;
        done += kk >= 0.999 ? 1 : kk * 0.6;
      }
      (freed.material as THREE.MeshBasicMaterial).opacity = 0.14 * smooth(range(p, 0.55, 0.85)) * (0.8 + Math.sin(t * 2) * 0.2);
      freedLabel.opacity = smooth(range(p, 0.12, 0.24)) * (1 - smooth(range(p, 0.3, 0.38)));
      bin.rotation.y = Math.sin(t * 0.5) * 0.05;
      rim.scale.setScalar(1 + Math.sin(Math.PI * range(p, 0.3, 0.9)) * 0.04);
      if (counter) {
        const v = Math.round(target * (done / flyers.length) * 10) / 10;
        if (v !== lastShown) {
          counter.textContent = fmt.format(v);
          lastShown = v;
        }
      }
    },
  };
}
