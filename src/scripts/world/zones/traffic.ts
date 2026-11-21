import * as THREE from 'three';
import type { Kit, Zone } from '../kit';
import { range, rng, smooth } from '../palette';
import { squarify } from '../treemap';
import { department } from '../factory/department';
import { spurFrame } from '../factory/conveyor';
import { BOX, BOX_H, station } from '../factory/station';

// ---------- 3 · control de calidad: inspectores sellan Seguro / Revisar / No tocar ----------
export function zoneTraffic(k: Kit): Zone {
  const dep = department(k, 3, 'Nave 3 · Control de calidad', 'cada caja, con su motivo');
  const { g } = dep;
  const S = 42;
  const rand = rng(31);
  const vals = Array.from({ length: 22 }, () => 2 + Math.pow(rand(), 1.8) * 30);
  const rects = squarify(vals, { x: -S / 2, y: -S / 2, w: S, h: S });
  const statuses: ('safe' | 'review' | 'keep')[] = ['safe', 'review', 'safe', 'keep', 'safe', 'review', 'keep', 'safe', 'review'];
  const sym = { safe: '✓ Seguro', review: '! Revisar', keep: '✕ No tocar' } as const;
  const why = { safe: 'se regenera', review: 'sin script de build', keep: 'rastreado por git' } as const;
  const cells = rects.map((r, i) => {
    const st = statuses[i % statuses.length];
    const h = 1 + Math.sqrt(vals[i]) * 1.1;
    const neutral = k.mat('neutral');
    const col = k.mat(st, 0.35);
    // material propio: se mezcla entre las dos referencias de tema en cada frame
    const own = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02 });
    const b = k.box(Math.max(r.w - 0.6, 0.3), h, Math.max(r.h - 0.6, 0.3), own);
    b.position.set(r.x + r.w / 2, 0.6, r.y + r.h / 2);
    g.add(b);
    return { b, st, neutral, col, h, area: r.w * r.h, order: (r.x + r.y + S) / (2 * S) };
  });
  const tagged = cells
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.area - a.c.area)
    .slice(0, 6);
  const labels = tagged.map(({ c }) => {
    const l = k.label(sym[c.st], { sub: why[c.st], tone: c.st, height: 2.4 });
    l.sprite.position.set(c.b.position.x, c.h + 1.6, c.b.position.z);
    g.add(l.sprite);
    return { l, c };
  });

  // torre de señales: tres lámparas que se encienden por turnos
  const tower = new THREE.Group();
  const pole = k.box(0.5, 9, 0.5, k.mat('steel', 0, { roughness: 0.4, metalness: 0.5 }));
  tower.add(pole);
  const lamps = (['keep', 'review', 'safe'] as const).map((st, i) => {
    const m = k.mat(st, 0.2, { roughness: 0.3 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 20), m);
    lamp.position.y = 9.6 + i * 1.3;
    lamp.castShadow = true;
    tower.add(lamp);
    return { lamp, m };
  });
  tower.position.set(-dep.hw - 0.2, 0.6, -dep.hd + 1);
  g.add(tower);

  // inspectores con sello a lo largo del borde
  for (const [z, ph] of [[-10, 0], [2, 1.3], [14, 2.6]] as const) {
    dep.worker({ at: [-dep.hw - 0.6, z], face: Math.PI / 2, act: 'stamp', phase: ph });
  }
  dep.worker({ path: [[-12, dep.hd], [18, dep.hd]], speed: 1.4, phase: 4 });

  // ---------- estación de primer plano: báscula, inspector y etiqueta por caja ----------
  const T = 3.6;
  const sx = spurFrame(3).mid;
  const st = station(k, g, 3, { T, hold: 1.8, out: 2.4, stop: sx });
  const order: ('safe' | 'review' | 'keep')[] = ['safe', 'review', 'safe', 'keep', 'safe', 'review'];
  const tagMats = { safe: k.mat('safe', 0.8), review: k.mat('review', 0.8), keep: k.mat('keep', 0.8) };
  const tagGeo = new THREE.PlaneGeometry(0.75, 0.4);
  const tags = st.boxes.map((b) => {
    const m = new THREE.Mesh(tagGeo, tagMats.safe);
    // cara +z de la caja (0,45 m de fondo × BOX)
    m.position.set(0, BOX_H * 0.55, (0.45 * BOX) / 2 + 0.02);
    m.visible = false;
    b.add(m);
    return m;
  });
  const scale = k.models.prop('scale', 1.5);
  scale.position.set(sx + 0.2, 0, -1.9);
  const printer = k.models.prop('printer', 2.4);
  printer.position.set(sx + 2.2, 1.6, -1.5);
  const stand = k.box(1.1, 1.6, 1, k.mat('steel', 0, { roughness: 0.4, metalness: 0.4 }));
  stand.position.set(sx + 2.2, 0, -1.6);
  g.add(scale, printer, stand);
  // baliza sobre la parada
  const beacon = new THREE.Group();
  beacon.add(k.box(0.14, 4.2, 0.14, k.mat('steel', 0, { roughness: 0.4, metalness: 0.5 })));
  const bulbs = (['keep', 'review', 'safe'] as const).map((s, i) => {
    const m = k.mat(s, 0.2, { roughness: 0.3 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.42, 16), m);
    b.position.y = 4.4 + i * 0.46;
    beacon.add(b);
    return { s, m };
  });
  beacon.position.set(sx - 1.8, 0, -1.6);
  g.add(beacon);
  const insp = k.models.character('worker', 3, ['Interact'], { offset: 0.3 });
  insp.obj.position.set(sx + 0.6, 0, -3.1);
  const board = k.models.prop('clipboard', 2);
  board.position.set(sx - 3.3, 1.55, -2.6);
  board.rotation.set(-0.3, 0.6, 0);
  const boss = k.models.character('manager', 3, ['Agree'], { offset: 0.1 });
  boss.obj.position.set(sx - 3.6, 0, -3.2);
  boss.obj.rotation.y = 0.7;
  g.add(insp.obj, board, boss.obj);
  const lit = { safe: 0, review: 0, keep: 0 };

  const mix = new THREE.Color();
  return {
    update: (p, t) => {
      dep.update(p, t);
      lit.safe = lit.review = lit.keep = 0;
      st.update(t, (b, s) => {
        const tag = tags[st.boxes.indexOf(b)];
        const status = order[((s.k % order.length) + order.length) % order.length];
        // la etiqueta sale de la impresora a mitad de la parada
        tag.visible = s.phase === 'out' || (s.phase === 'hold' && s.f > 0.45);
        tag.material = tagMats[status];
        if (s.phase === 'hold' && s.f > 0.45) lit[status] = 1;
        // la báscula baja un poco con la caja encima
        if (s.phase === 'hold') b.position.y -= Math.sin(Math.PI * Math.min(s.f * 4, 1)) * 0.04;
      });
      for (const bl of bulbs) bl.m.emissiveIntensity = lit[bl.s] ? 2.4 : 0.05;
      for (const c of cells) {
        const kk = smooth(range(p, 0.12 + c.order * 0.45, 0.25 + c.order * 0.45));
        // mezcla del color neutro al del estado, sin cambiar de material
        mix.copy(c.neutral.color).lerp(c.col.color, kk);
        const m = c.b.material as THREE.MeshStandardMaterial;
        m.color.copy(mix);
        m.emissive.copy(c.col.emissive).multiplyScalar(kk);
        m.emissiveIntensity = c.col.emissiveIntensity;
        c.b.position.y = 0.6 + Math.sin(Math.PI * kk) * 0.8;
      }
      for (const { l, c } of labels) l.opacity = smooth(range(p, 0.3 + c.order * 0.45, 0.4 + c.order * 0.45));
      const on = Math.floor(t * 0.9) % 3;
      lamps.forEach((L, i) => (L.m.emissiveIntensity = i === on ? 2.2 : 0.04));
    },
  };
}
