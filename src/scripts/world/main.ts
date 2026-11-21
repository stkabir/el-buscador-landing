import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World, ZONES } from './world';
import { spurFrame } from './factory/conveyor';
import { clamp01, currentTheme, palettes, range, smooth, type ThemeName } from './palette';

/** fracción de cada tramo en la que la cámara se queda en la zona (el resto es vuelo) */
const DWELL = 0.55;

type V = [number, number, number];
/** posición y mirada de llegada (A) y salida (B), relativas al centro de cada zona */
type Shot = { a: V; la: V; b: V; lb: V; abs?: boolean };

/**
 * Bahías: la cámara entra por el portón junto a la cinta y se queda a la altura de
 * los ojos frente a la estación del ramal (A llega, B se acerca en dolly).
 */
const station = (i: number, tune: Partial<Shot> = {}): Shot => {
  const x = spurFrame(i).mid;
  return {
    a: [x + 8, 7.5, 15],
    la: [x - 4, 2, -2],
    b: [x + 3.5, 5, 9.5],
    lb: [x - 3, 2.4, -1.5],
    ...tune,
  };
};

const SHOTS: Shot[] = [
  // patio: vista general y luego de frente al portón de la nave
  { a: [0, 30, 64], la: [0, 7, 0], b: [27, 11, -4], lb: [34, 4, -40] },
  station(1),
  station(2),
  station(3),
  station(4),
  station(5),
  station(6),
  { a: [60, 300, 40], la: [6, 0, -226], b: [40, 330, 20], lb: [6, 0, -230], abs: true },
];

function buildPath(mobile: boolean) {
  const pos: THREE.Vector3[] = [];
  const look: THREE.Vector3[] = [];
  SHOTS.forEach((s, i) => {
    const [cx, cz] = s.abs ? [0, 0] : ZONES[i];
    // en móvil (fov amplio, sujeto arriba) las estaciones se encuadran un poco más lejos
    const k = mobile && !s.abs && i > 0 ? 1.15 : 1;
    const ref = s.abs || i === 0 ? [0, 0, 0] : s.la;
    const far = (o: V): V => [ref[0] + (o[0] - ref[0]) * k, o[1] * k, ref[2] + (o[2] - ref[2]) * k];
    const v = (o: V) => new THREE.Vector3(o[0] + cx, o[1], o[2] + cz);
    pos.push(v(far(s.a)), v(far(s.b)));
    look.push(v(s.la), v(s.lb));
  });
  return {
    pos: new THREE.CatmullRomCurve3(pos, false, 'centripetal'),
    look: new THREE.CatmullRomCurve3(look, false, 'centripetal'),
    keys: pos.length,
  };
}

/** u ∈ [0, N-1+DWELL] → índice de keyframe (A_i=2i, B_i=2i+1) */
function keyIndex(u: number) {
  const i = Math.floor(u);
  const s = u - i;
  // mezcla lineal + suave: frena en las zonas sin detenerse del todo
  const e = (x: number) => 0.45 * x + 0.55 * smooth(x);
  return s < DWELL ? 2 * i + e(s / DWELL) : 2 * i + 1 + e((s - DWELL) / (1 - DWELL));
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function boot() {
  const root = document.documentElement;
  const steps = [...document.querySelectorAll<HTMLElement>('.step')];
  const railLinks = [...document.querySelectorAll<HTMLElement>('#rail [data-goto]')];
  const track = document.getElementById('track')!;
  const progressBar = document.getElementById('progress');
  const N = steps.length;
  const U_MAX = N - 1 + DWELL;

  let themeHook = () => {};
  setupThemeToggle(() => themeHook());

  if (!hasWebGL()) {
    root.classList.add('no-webgl');
    steps.forEach((s) => s.classList.add('is-on'));
    return;
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mobile = coarse || innerWidth < 860;

  const canvas = document.getElementById('world') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const path = buildPath(mobile);
  const world = new World({ mobile, avoid: path.pos.getPoints(600) });
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1400);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(world.scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.62);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let useBloom = false;

  function onTheme() {
    const t: ThemeName = currentTheme();
    world.applyTheme(palettes[t]);
    useBloom = t === 'dark' && !mobile;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0f1115' : '#e8ecf0');
    render();
  }

  // ---------- tamaño ----------
  let W = 0, H = 0;
  function resize(force = false) {
    const w = innerWidth, h = innerHeight;
    // en táctil, ignorar cambios solo de alto (barra de URL)
    if (!force && coarse && w === W) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 64 : aspect < 1.2 ? 52 : 40;
    // corre el sujeto para dejar sitio al texto: a la derecha en escritorio, arriba en móvil
    if (w >= 640) camera.setViewOffset(w, h, -w * 0.13, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.17, w, h);
    camera.updateProjectionMatrix();
    measure();
  }

  let scrollable = 1;
  function measure() {
    scrollable = Math.max(1, track.offsetHeight - innerHeight);
  }

  // ---------- scroll ----------
  let target = 0;
  let u = 0;
  const readScroll = () => (target = clamp01(scrollY / scrollable) * U_MAX);

  document.querySelectorAll<HTMLElement>('[data-goto]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const i = Number(a.dataset.goto);
      const top = i === 0 ? 0 : ((i + DWELL * 0.4) / U_MAX) * scrollable;
      scrollTo({ top, behavior: reduced.matches ? 'auto' : 'smooth' });
      history.replaceState(null, '', `#${steps[i].id}`);
    });
  });
  // llegar con #hash
  const hashIdx = steps.findIndex((s) => `#${s.id}` === location.hash);

  // ---------- copy ----------
  let activeStep = -1;
  function updateCopy(uu: number) {
    let best = 0, bestO = -1;
    steps.forEach((el, i) => {
      const s = uu - i;
      const fin = i === 0 ? 1 : smooth(range(s, -0.32, -0.04));
      const fout = i === N - 1 ? 1 : 1 - smooth(range(s, DWELL + 0.04, DWELL + 0.3));
      const o = Math.min(fin, fout);
      const y = (1 - fin) * 28 - (1 - fout) * 28;
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      const on = o > 0.02;
      el.classList.toggle('is-on', on);
      el.style.pointerEvents = o > 0.6 ? '' : 'none';
      if (o > bestO) { bestO = o; best = i; }
    });
    if (best !== activeStep) {
      activeStep = best;
      railLinks.forEach((l, i) => (l.dataset.on = String(i === best)));
    }
    if (progressBar) progressBar.style.transform = `scaleX(${(uu / U_MAX).toFixed(4)})`;
  }

  // ---------- cámara ----------
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  function placeCamera(uu: number) {
    let cu = uu;
    if (reduced.matches) {
      // sin vuelo: salta a la zona más cercana
      const k = Math.min(N - 1, Math.floor(uu + (1 - DWELL) / 2));
      cu = k + DWELL * 0.5;
    }
    const t = keyIndex(Math.min(cu, U_MAX - 1e-4)) / (path.keys - 1);
    path.pos.getPoint(t, camPos);
    path.look.getPoint(t, camLook);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    world.aimSun(camLook);
    // niebla: más lejos cuanto más alta la cámara (vista aérea final)
    const fog = world.scene.fog as THREE.Fog;
    fog.far = Math.max(230, camPos.y * 2.6);
    fog.near = fog.far * 0.32;
    return cu;
  }

  // ---------- loop ----------
  const clock = new THREE.Timer();
  let time = 0;
  function render() {
    const cu = placeCamera(u);
    world.update(cu, time);
    if (useBloom) composer.render();
    else renderer.render(world.scene, camera);
  }

  function frame() {
    clock.update();
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!reduced.matches) time += dt;
    readScroll();
    u = reduced.matches ? target : u + (target - u) * (1 - Math.exp(-dt * 5.5));
    if (Math.abs(target - u) < 1e-4) u = target;
    updateCopy(u);
    render();
  }

  addEventListener('resize', () => resize());
  addEventListener('orientationchange', () => setTimeout(() => resize(true), 200));
  addEventListener('load', measure);

  resize(true);
  themeHook = onTheme;
  onTheme();
  if (hashIdx > 0) scrollTo({ top: ((hashIdx + DWELL * 0.4) / U_MAX) * scrollable });
  readScroll();
  u = target;
  renderer.setAnimationLoop(() => {
    if (!document.hidden) frame();
  });
}

function setupThemeToggle(onChange: () => void) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const switchTheme = () => {
      const dark = !document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', dark);
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
      onChange();
    };
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) switchTheme();
    else document.startViewTransition(switchTheme);
  });
}
