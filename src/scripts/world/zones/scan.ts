import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Kit, Role, Zone } from '../kit';
import { easeOut, lerp, range, rng, smooth } from '../palette';
import { squarify } from '../treemap';
import { department } from '../factory/department';
import { spurFrame } from '../factory/conveyor';
import { screen as makeScreen, station } from '../factory/station';

// ---------- 1 · nave de escaneo: un pórtico recorre y el treemap de cajas crece ----------
export function zoneScan(k: Kit): Zone {
  const dep = department(k, 1, 'Nave 1 · Escaneo', 'recepción del disco');
  const { g } = dep;
  const S = 40;
  const rand = rng(11);
  const vals = Array.from({ length: 46 }, () => Math.pow(rand(), 2.2) * 100 + 4);
  const rects = squarify(vals, { x: -S / 2, y: -S / 2, w: S, h: S });
  const roles: Role[] = ['neutral', 'neutral', 'accent3'];
  const cells = rects.map((r, i) => {
    const role = i < 3 ? 'accent2' : roles[i % 3];
    // bajos: desde la cámara a la altura de los ojos no deben tapar la estación
    const h = 0.6 + Math.sqrt(vals[i]) * 0.45;
    const b = k.box(Math.max(r.w - 0.5, 0.3), 1, Math.max(r.h - 0.5, 0.3), k.mat(role, role === 'neutral' ? 0 : 0.25));
    b.position.set(r.x + r.w / 2, 0.6, r.y + r.h / 2);
    b.scale.y = 0.01;
    g.add(b);
    return { b, h, x: r.x + r.w / 2 };
  });

  // pórtico escáner: dos patas, viga y haz
  const span = S + 4;
  const GH = 14;
  const beamMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(span, GH - 1).translate(0, (GH - 1) / 2, 0), beamMat);
  beam.rotation.y = Math.PI / 2;
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, span), k.mat('accent', 1.4));
  line.position.y = 0.75;
  const frame = new THREE.Mesh(
    mergeGeometries([
      new THREE.BoxGeometry(1.2, GH, 1.2).translate(0, GH / 2, span / 2),
      new THREE.BoxGeometry(1.2, GH, 1.2).translate(0, GH / 2, -span / 2),
      new THREE.BoxGeometry(1.6, 1.2, span + 1.2).translate(0, GH, 0),
    ]),
    k.mat('steel', 0, { roughness: 0.4, metalness: 0.5 }),
  );
  frame.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, span).translate(0, GH - 0.9, 0), k.mat('accent', 0.8));
  const beamG = new THREE.Group();
  beamG.add(beam, line, frame, head);
  g.add(beamG);

  const lbl = k.label('Escaneando C:\\', { sub: '1.284.330 archivos', height: 3 });
  lbl.sprite.position.set(0, 18, 0);
  g.add(lbl.sprite);

  // operario en consola + dos recorriendo el borde
  const consoleBox = k.box(2.4, 1.6, 1.4, k.mat('steel', 0, { roughness: 0.4, metalness: 0.4 }));
  consoleBox.position.set(-dep.hw + 0.4, 0.6, dep.hd - 5);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 0.1), k.mat('accent', 1.2));
  screen.position.set(-dep.hw + 0.4, 2.7, dep.hd - 5.6);
  g.add(consoleBox, screen);
  dep.worker({ at: [-dep.hw + 0.4, dep.hd - 3.6], face: Math.PI, act: 'work' });
  dep.worker({ path: dep.rim(), speed: 1.5, phase: 0 });
  dep.worker({ path: dep.rim(), speed: 1.5, phase: 5 });

  // ---------- estación de primer plano: túnel de rayos X en el ramal ----------
  // la parada es el centro del túnel
  const sx = spurFrame(1).mid;
  const stopX = sx;
  const st = station(k, g, 1, { T: 3.4, hold: 1.4, out: 2.2, stop: sx });
  const xray = k.models.prop('xray', 1.45);
  xray.position.set(sx, 0.32, 0);
  const plinthX = k.box(10.8, 0.32, 1.9, k.mat('steel', 0, { roughness: 0.5, metalness: 0.4 }));
  plinthX.position.set(sx, 0, 0);
  g.add(xray, plinthX);
  // luz del escáner dentro del túnel
  const scanMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const scanSheet = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), scanMat);
  scanSheet.rotation.y = Math.PI / 2;
  scanSheet.position.set(sx, st.f.y + 0.9, 0);
  g.add(scanSheet);

  // pantalla grande con el treemap que se va llenando
  const disp = makeScreen(3.2, 2, 320);
  const dispPole = k.box(0.18, 3.2, 0.18, k.mat('steel', 0, { roughness: 0.4, metalness: 0.5 }));
  dispPole.position.set(sx - 3.2, 0, -3.2);
  const dispFrame = k.box(3.4, 2.2, 0.16, k.mat('belt', 0, { roughness: 0.5 }));
  dispFrame.position.set(0, -1.1, -0.1);
  const dispG = new THREE.Group();
  dispG.position.set(sx - 3.2, 4.3, -3.2);
  dispG.rotation.y = 0.55;
  dispG.add(dispFrame, disp.mesh);
  g.add(dispPole, dispG);
  const mini = squarify(vals.slice(0, 30), { x: 0, y: 0, w: disp.c.width, h: disp.c.height - 34 });
  let drawn = -1;
  let pal = { a: '#34d399', b: '#177a5a', n: '#3a4350', bg: '#0f1115', ink: '#e8ecf0' };
  const drawScreen = (fill: number) => {
    const q = Math.round(fill * 40);
    if (q === drawn) return;
    drawn = q;
    const { ctx, c } = disp;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = pal.ink;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(`Escaneando C:\\  ${Math.round(fill * 100)}%`, 12, 24);
    const n = Math.round(mini.length * fill);
    mini.slice(0, n).forEach((r, i) => {
      ctx.fillStyle = i < 3 ? pal.a : i % 3 ? pal.n : pal.b;
      ctx.fillRect(r.x + 2, r.y + 36, Math.max(r.w - 4, 1), Math.max(r.h - 4, 1));
    });
    disp.tex.needsUpdate = true;
  };

  // operario en el mando del túnel y supervisora mirando la pantalla
  const op = k.models.character('worker', 1, ['Interact']);
  op.obj.position.set(sx + 3.6, 0, -1.7);
  const boss = k.models.character('manager', 1, ['Agree'], { offset: 0.4 });
  boss.obj.position.set(sx - 4.6, 0, -1.6);
  boss.obj.rotation.y = 2.3;
  const ctrl = k.models.prop('monitor', 1.6);
  ctrl.position.set(sx + 3.6, 1.6, -0.85);
  ctrl.rotation.y = Math.PI;
  const ctrlDesk = k.box(1.4, 1.6, 0.8, k.mat('steel', 0, { roughness: 0.4, metalness: 0.4 }));
  ctrlDesk.position.set(sx + 3.6, 0, -0.85);
  g.add(op.obj, boss.obj, ctrl, ctrlDesk);

  return {
    theme: (p) => {
      beamMat.color.setHex(p.accent);
      scanMat.color.setHex(p.accent);
      const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
      pal = { a: hex(p.accent), b: hex(p.accent3), n: hex(p.neutral), bg: hex(p.bg), ink: p.ink };
      drawn = -1;
    },
    update: (p, t) => {
      dep.update(p, t);
      // cajas por el túnel: brillan mientras las atraviesa el haz
      let glow = 0;
      st.update(t, (_b, s) => {
        if (s.phase === 'hold') glow = Math.max(glow, Math.sin(Math.PI * s.f));
      });
      scanMat.opacity = 0.55 * glow;
      scanSheet.position.x = stopX + Math.sin(t * 6) * 0.5;
      drawScreen(range(p, 0.2, 0.85));
      const sweep = range(p, 0.2, 0.85);
      // barre desde la estación hacia el fondo, para no tapar el primer plano
      const bx = lerp(S / 2 + 3, -S / 2 - 3, sweep);
      beamG.position.x = bx;
      beamG.visible = p > 0.05;
      beamMat.opacity = 0.22 * Math.sin(Math.PI * sweep);
      for (const c of cells) c.b.scale.y = Math.max(0.01, c.h * easeOut((c.x - bx + 2) / 9));
      lbl.opacity = smooth(range(p, 0.15, 0.3)) * (1 - smooth(range(p, 0.9, 1)));
    },
  };
}
