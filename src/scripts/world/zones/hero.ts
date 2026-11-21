import * as THREE from 'three';
import { BAY_CX, HALL_Z0, type Kit, type Role, type Zone } from '../kit';
import { lerp, range, smooth } from '../palette';
import { truck, Vehicle } from '../factory/actors';

// ---------- 0 · inicio: patio de la fábrica, el plato del disco y el logo ----------
export function zoneHero(k: Kit): Zone {
  const g = k.group(0);
  const platter = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(24, 24, 1.2, 96), k.mat('neutral', 0, { roughness: 0.35, metalness: 0.4 }));
  disc.position.y = 0.6;
  disc.receiveShadow = true;
  platter.add(disc);
  for (const [r, role] of [[23.6, 'accent'], [16, 'accent3'], [9, 'accent3']] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 8, 128), k.mat(role, 1));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.25;
    platter.add(ring);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.6, 48), k.mat('accent3', 0.4));
  hub.position.y = 0.8;
  platter.add(hub);
  g.add(platter);

  // logo "Mapa del disco": 44×72, 22×42, 22×24 (en unidades/4.4)
  const logo = new THREE.Group();
  const s = 0.2;
  const parts: [number, number, number, number, number, Role][] = [
    // x, z, w, d, h, rol  (coordenadas del SVG 100×100, centro en 50,50)
    [36, 50, 44, 72, 17, 'accent'],
    [75, 35, 22, 42, 11, 'accent2'],
    [75, 74, 22, 24, 6.5, 'accent3'],
  ];
  const blocks = parts.map(([x, z, w, d, h, role]) => {
    const b = k.box(w * s, h, d * s, k.mat(role, 0.35, { roughness: 0.5 }));
    b.position.set((x - 50) * s, 1.2, (z - 50) * s);
    logo.add(b);
    return { b, h, base: b.position.y };
  });
  logo.rotation.y = -0.5;
  g.add(logo);

  // anillo de reparto: los camiones traen discos a la fábrica
  const road = new THREE.Mesh(new THREE.RingGeometry(30.5, 37.5, 120), k.mat('belt', 0, { roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.03;
  road.receiveShadow = true;
  const lane = new THREE.Mesh(new THREE.RingGeometry(33.85, 34.15, 120), k.mat('review', 0.4));
  lane.rotation.x = -Math.PI / 2;
  lane.position.y = 0.05;
  g.add(road, lane);
  const ringPath = new THREE.EllipseCurve(0, 0, 34, 34, 0, Math.PI * 2, true);
  const ring3 = new THREE.CatmullRomCurve3(
    ringPath.getSpacedPoints(64).slice(0, -1).map((v) => new THREE.Vector3(v.x, 0, v.y)),
    true,
  );
  const trucks = [0, 0.5].map((o) => {
    const v = new Vehicle(ring3, 4.5, o);
    v.obj.add(truck(k));
    g.add(v.obj);
    return v;
  });

  // operarios de visita sobre el plato
  const r = 20;
  const loop: [number, number][] = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  for (let i = 0; i < 4; i++) k.workers.push({ zone: 0, y: 1.2, path: loop, speed: 1.4, phase: i * 2.4 });

  // letrero sobre el portón de la nave, visto desde el patio
  const sign = k.label('El Buscador · Fábrica', { sub: 'de espacio libre', height: 4 });
  sign.sprite.position.set(BAY_CX, 19, HALL_Z0 + 1);
  g.add(sign.sprite);

  return {
    update: (p, t) => {
      sign.opacity = 1 - smooth(range(p, 0.55, 0.8));
      platter.rotation.y = t * 0.05;
      // al irse la cámara, el logo se "asienta" (escala de alturas)
      const leave = range(p, 0.55, 1);
      blocks.forEach(({ b, base }, i) => {
        b.position.y = base + Math.sin(t * 0.8 + i * 1.3) * 0.35 * (1 - leave);
        b.scale.y = lerp(1, 0.55, smooth(leave));
      });
      for (const v of trucks) v.update(t);
    },
  };
}
