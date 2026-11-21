import * as THREE from 'three';
import { BAY_CX, BAY_W, HALL_Z0, HALL_Z1, Kit, ZONES, type Zone } from './kit';
import { clamp01, range, rng, smooth, type Palette } from './palette';
import { slice, type Rect } from './treemap';
import { Workers } from './factory/actors';
import { conveyors, routeSamples } from './factory/conveyor';
import { zoneHero } from './zones/hero';
import { zoneScan } from './zones/scan';
import { zoneMap } from './zones/map';
import { zoneTraffic } from './zones/traffic';
import { zoneDev } from './zones/dev';
import { zoneDupes } from './zones/dupes';
import { zoneClean } from './zones/clean';

export { ZONES };
export type { Zone };

/** El campus: patio de entrada, seis naves, cintas entre ellas y parque industrial alrededor. */
export class World {
  kit: Kit;
  scene: THREE.Scene;
  zones: Zone[] = [];
  /** sistemas que corren siempre, sin depender de una zona (cintas) */
  private systems: Zone[] = [];
  private workers!: Workers;
  private ps: number[] = [];
  private city!: THREE.InstancedMesh;
  private cityShade: Uint8Array = new Uint8Array(0);
  hemi = new THREE.HemisphereLight();
  sun = new THREE.DirectionalLight();
  /** luz de trabajo sobre la estación que mira la cámara (de cerca, los muros tapan el sol) */
  lamp = new THREE.PointLight(0xfff0dc, 0, 46, 1.2);
  private lampI = 0;
  dust?: THREE.Points;
  pal!: Palette;
  private tmpColor = new THREE.Color();

  constructor(private opts: { mobile: boolean; avoid: THREE.Vector3[] }) {
    this.kit = new Kit(opts.mobile);
    this.scene = this.kit.scene;
    this.scene.fog = new THREE.Fog(0x000000, 60, 260);
    this.scene.add(this.hemi);
    this.sun.position.set(40, 80, 30);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(opts.mobile ? 1024 : 2048, opts.mobile ? 1024 : 2048);
    s.camera.left = -90; s.camera.right = 90; s.camera.top = 90; s.camera.bottom = -90;
    s.camera.near = 1; s.camera.far = 260;
    s.bias = -0.0004;
    s.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target, this.lamp);

    this.buildGround();
    this.buildPark();
    const k = this.kit;
    this.zones.push(zoneHero(k), zoneScan(k), zoneMap(k), zoneTraffic(k), zoneDev(k), zoneDupes(k), zoneClean(k), { update: () => {} });
    this.systems.push(conveyors(k));
    this.workers = new Workers(k, k.workers);
    this.ps = this.zones.map(() => 0);
    if (!opts.mobile) this.buildDust();
  }

  applyTheme(pal: Palette) {
    this.pal = pal;
    this.scene.background = new THREE.Color(pal.bg);
    (this.scene.fog as THREE.Fog).color.setHex(pal.bg);
    this.hemi.color.setHex(pal.hemiSky);
    this.hemi.groundColor.setHex(pal.hemiGround);
    this.hemi.intensity = pal.hemiI;
    this.sun.intensity = pal.dirI;
    this.lampI = pal.bg < 0x808080 ? 80 : 50;
    for (const { m, role, glow } of this.kit.mats) {
      m.color.setHex(pal[role]);
      m.emissive.setHex(glow ? pal[role] : 0x000000);
      m.emissiveIntensity = glow * pal.emissive * 2;
    }
    for (let i = 0; i < this.city.count; i++) {
      const sh = this.cityShade[i];
      this.tmpColor.setHex(sh === 3 ? pal.lit : sh === 4 ? pal.steel : pal.blocks[sh]);
      this.city.setColorAt(i, this.tmpColor);
    }
    this.city.instanceColor!.needsUpdate = true;
    for (const l of this.kit.labels) l.draw(pal);
    for (const z of [...this.zones, ...this.systems]) z.theme?.(pal);
    if (this.dust) (this.dust.material as THREE.PointsMaterial).color.setHex(pal.accent);
  }

  private lastTime = 0;

  update(u: number, time: number) {
    const k = this.kit;
    k.dt = Math.min(Math.max(time - this.lastTime, 0), 0.1);
    this.lastTime = time;
    k.aerial = smooth(range(u, ZONES.length - 1.45, ZONES.length - 1.05));
    for (let i = 0; i < this.zones.length; i++) {
      // la animación de cada zona corre mientras la cámara llega y se queda
      const p = clamp01((u - i + 0.4) / 1.0);
      this.ps[i] = p;
      // el techo de la bahía i se abre durante el vuelo desde la anterior, antes del portón
      k.approach[i] = smooth(range(u, i - 0.8, i - 0.4));
      this.zones[i].update(p, time);
    }
    for (const s of this.systems) s.update(0, time);
    this.workers.update(time, this.ps);
    // personajes Polyfork: solo los de las zonas cercanas a la cámara
    k.models.update(k.dt, (z) => Math.abs(u - z) < 1.1);
    if (this.dust) this.dust.rotation.y = time * 0.004;
  }

  /** sigue a la cámara para que la sombra cubra lo que se ve */
  aimSun(target: THREE.Vector3) {
    this.sun.position.set(target.x + 45, target.y + 90, target.z + 35);
    this.sun.target.position.copy(target);
    this.lamp.position.set(target.x + 3, 20, target.z + 4);
    // solo dentro de la nave
    const inside = smooth(range(-target.z, 30, 50)) * (1 - this.kit.aerial);
    this.lamp.intensity = this.lampI * inside;
  }

  // ---------- base ----------
  private buildGround() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1600), this.kit.mat('ground', 0, { roughness: 1 }));
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, -0.02, -250);
    g.receiveShadow = true;
    this.scene.add(g);
  }

  /** parque industrial: galpones bajos, silos y chimeneas, despejando patios, cintas y cámara */
  private buildPark() {
    const rand = rng(7);
    const tiles = slice({ x: -220, y: -640, w: 440, h: 800 }, rand, this.opts.mobile ? 70 : 46);
    const belts = routeSamples();
    const keep: { r: Rect; h: number; shade: number }[] = [];
    const silos: { x: number; z: number; r: number; h: number }[] = [];
    for (const r of tiles) {
      const cx = r.x + r.w / 2, cz = r.y + r.h / 2;
      const half = Math.max(r.w, r.h) * 0.5;
      // patio de entrada (círculo) y nave (rectángulo con margen)
      const yard = 46;
      const near = Math.min(
        Math.hypot(cx, cz),
        Math.max(Math.abs(cx - BAY_CX) - BAY_W / 2, Math.abs(cz - (HALL_Z0 + HALL_Z1) / 2) - (HALL_Z0 - HALL_Z1) / 2, 0) + yard,
      );
      const inside =
        Math.hypot(cx, cz) < yard + half ||
        (Math.abs(cx - BAY_CX) < BAY_W / 2 + 10 + half && cz < HALL_Z0 + 8 + half && cz > HALL_Z1 - 8 - half);
      if (inside) continue;
      let belt = Infinity;
      for (const v of belts) belt = Math.min(belt, Math.hypot(cx - v.x, cz - v.z) - half);
      if (belt < 4) continue;
      // distancia (en planta) al recorrido de la cámara: despeja el camino y baja el parque cerca
      let cam = Infinity;
      for (const v of this.opts.avoid) {
        if (v.y > 120) continue;
        cam = Math.min(cam, Math.hypot(cx - v.x, cz - v.z) - half);
      }
      if (cam < 6) continue;
      const open = smooth(range(Math.min(cam, near - yard), 4, 70));
      const small = Math.min(r.w, r.h);
      // algunos lotes son silos o chimeneas en vez de galpones
      if (open > 0.3 && small > 5 && rand() < 0.09) {
        const n = small > 9 ? 3 : 1;
        for (let j = 0; j < n; j++) {
          const rr = (small / (n > 1 ? 4.4 : 2.6)) * 0.9;
          const ox = n > 1 ? (j - 1) * rr * 2.1 : 0;
          silos.push({ x: cx + (r.w > r.h ? ox : 0), z: cz + (r.w > r.h ? 0 : ox), r: rr, h: 5 + rand() * 7 * open });
        }
        keep.push({ r, h: 0.3, shade: 0 });
        continue;
      }
      if (open > 0.4 && small > 3 && rand() < 0.012) {
        silos.push({ x: cx, z: cz, r: 1.1, h: 14 + rand() * 10 * open });
        keep.push({ r, h: 2 + rand() * 2, shade: 4 });
        continue;
      }
      const h = (0.5 + rand() * rand() * 3 + Math.pow(rand(), 5) * 8 * open) * (0.3 + 0.7 * open) + Math.min(near / 80, 1.5) * open;
      const shade = rand() < 0.04 ? 3 : Math.floor(rand() * 3);
      keep.push({ r, h, shade });
    }
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.02 });
    const mesh = new THREE.InstancedMesh(geo, mat, keep.length);
    const m4 = new THREE.Matrix4();
    const gap = 0.7;
    this.cityShade = new Uint8Array(keep.length);
    keep.forEach(({ r, h, shade }, i) => {
      m4.makeScale(Math.max(r.w - gap, 0.3), h, Math.max(r.h - gap, 0.3));
      m4.setPosition(r.x + r.w / 2, 0, r.y + r.h / 2);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, this.tmpColor.setHex(0xffffff));
      this.cityShade[i] = shade;
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.city = mesh;
    this.scene.add(mesh);

    if (!silos.length) return;
    const cyl = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1, 1, 18).translate(0, 0.5, 0),
      this.kit.mat('steel', 0, { roughness: 0.45, metalness: 0.35 }),
      silos.length,
    );
    silos.forEach(({ x, z, r, h }, i) => cyl.setMatrixAt(i, m4.makeScale(r, h, r).setPosition(x, 0, z)));
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    this.scene.add(cyl);
  }

  private buildDust() {
    const rand = rng(3);
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * 260;
      pos[i * 3 + 1] = 4 + rand() * 70;
      pos[i * 3 + 2] = 40 - rand() * 580;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ size: 0.35, transparent: true, opacity: 0.55, depthWrite: false });
    this.dust = new THREE.Points(geo, m);
    this.scene.add(this.dust);
  }
}
