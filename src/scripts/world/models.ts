import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Modelos low-poly de Polyfork (https://polyfork.dev), CC BY 4.0, optimizados con
 * scripts/fetch-models.mjs. Todo se carga en segundo plano: las funciones devuelven
 * un Group vacío al instante y lo rellenan cuando llega el GLB.
 */
const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/models/`;

/** unidades del mundo por metro (el operario procedural mide ~2,7 u) */
export const M = 1.5;

export type ClipName = 'Idle' | 'Walk' | 'Run' | 'Interact' | 'Fixing' | 'Pick up' | 'Pushing' | 'Agree';
/** clips CC0 (Quaternius, Universal Animation Library) que no vienen dentro del GLB */
const EXTRA: Partial<Record<ClipName, string>> = {
  Interact: 'interact',
  Fixing: 'fixing',
  'Pick up': 'pick-up',
  Pushing: 'pushing',
  Agree: 'agree',
};
type RawClip = { name: string; times: number[]; tracks: Record<string, number[]>; hips: number[] };
/** altura de cadera a la que se grabaron los clips */
const BAKED_HIP = 0.95;

export type Character = {
  obj: THREE.Group;
  /** cambia de clip con fundido (si ya está cargado) */
  play(name: ClipName, fade?: number): void;
};

type Live = { mixer: THREE.AnimationMixer; zone: number; actions: Map<string, THREE.AnimationAction>; current?: THREE.AnimationAction };

export class Models {
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private gltfs = new Map<string, Promise<GLTF>>();
  private raws = new Map<string, Promise<RawClip>>();
  private live: Live[] = [];

  gltf(file: string) {
    let p = this.gltfs.get(file);
    if (!p) {
      p = this.loader.loadAsync(`${BASE}${file}.glb`);
      this.gltfs.set(file, p);
    }
    return p;
  }

  private raw(file: string) {
    let p = this.raws.get(file);
    if (!p) {
      p = fetch(`${BASE}clips/${file}.json`).then((r) => r.json() as Promise<RawClip>);
      this.raws.set(file, p);
    }
    return p;
  }

  /** prop estático, escalado a metros·s (s = M por defecto) */
  prop(file: string, s = M, onReady?: (o: THREE.Object3D) => void) {
    const g = new THREE.Group();
    this.gltf(file)
      .then((gl) => {
        const o = gl.scene.clone(true);
        o.scale.setScalar(s);
        o.traverse((m) => {
          if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true;
        });
        g.add(o);
        onReady?.(o);
      })
      .catch((e) => console.warn(`[models] ${file}:`, e));
    return g;
  }

  /** personaje con esqueleto Mixamo; el primer clip arranca en bucle */
  character(file: string, zone: number, clips: ClipName[], opts: { offset?: number; speed?: number } = {}): Character {
    const g = new THREE.Group();
    let live: Live | undefined;
    let wanted: ClipName = clips[0];
    const start = (l: Live, name: ClipName, fade: number) => {
      const next = l.actions.get(name);
      if (!next || next === l.current) return;
      next.reset().play();
      if (l.current) l.current.crossFadeTo(next, fade, false);
      l.current = next;
    };
    Promise.all([this.gltf(file), ...clips.map((c) => (EXTRA[c] ? this.raw(EXTRA[c]!) : Promise.resolve(null)))])
      .then(([gl, ...raws]) => {
        const o = cloneSkinned(gl.scene);
        o.scale.setScalar(M);
        const bones: Record<string, THREE.Bone> = {};
        o.traverse((m) => {
          if ((m as THREE.Mesh).isMesh) {
            m.castShadow = true;
            m.frustumCulled = false;
          }
          if ((m as THREE.Bone).isBone && !bones[m.name]) bones[m.name] = m as THREE.Bone;
        });
        const mixer = new THREE.AnimationMixer(o);
        const actions = new Map<string, THREE.AnimationAction>();
        clips.forEach((name, i) => {
          const raw = raws[i] as RawClip | null;
          const clip = raw ? toClip(raw, name, bones) : gl.animations.find((a) => a.name === name);
          if (!clip) return;
          const a = mixer.clipAction(clip);
          a.timeScale = opts.speed ?? 1;
          actions.set(name, a);
        });
        mixer.setTime((opts.offset ?? 0) * 10);
        live = { mixer, zone, actions };
        this.live.push(live);
        start(live, wanted, 0);
        g.add(o);
      })
      .catch((e) => console.warn(`[models] ${file}:`, e));
    return {
      obj: g,
      play(name, fade = 0.3) {
        wanted = name;
        if (live) start(live, name, fade);
      },
    };
  }

  /**
   * Geometría unida del GLB, en flotantes, normalizada a una caja 1×1×1 con la base en y=0,
   * para un InstancedMesh (los colores vienen por vértice).
   */
  async unitGeometry(file: string) {
    const gl = await this.gltf(file);
    gl.scene.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    gl.scene.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.geometry;
      const geo = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'color'] as const) {
        const a = src.getAttribute(name);
        if (!a) continue;
        const n = name === 'color' ? 3 : a.itemSize;
        const arr = new Float32Array(a.count * n);
        for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) arr[i * n + c] = a.getComponent(i, c);
        geo.setAttribute(name, new THREE.BufferAttribute(arr, n));
      }
      if (src.index) geo.setIndex(Array.from(src.index.array));
      geo.applyMatrix4(mesh.matrixWorld);
      parts.push(geo);
    });
    const geo = mergeGeometries(parts)!;
    geo.computeBoundingBox();
    const b = geo.boundingBox!;
    const size = b.getSize(new THREE.Vector3());
    geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    geo.scale(1 / size.x, 1 / size.y, 1 / size.z);
    geo.computeVertexNormals();
    return geo;
  }

  /** avanza solo los personajes de las zonas activas */
  update(dt: number, active: (zone: number) => boolean) {
    for (const l of this.live) if (active(l.zone)) l.mixer.update(dt);
  }
}

/** clip de rotaciones por hueso + traslación de cadera (en el sitio), relativo a la pose de reposo */
function toClip(raw: RawClip, name: string, bones: Record<string, THREE.Bone>) {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [bone, values] of Object.entries(raw.tracks)) {
    const b = bones[bone];
    if (!b || !values.length) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b.uuid}.quaternion`, raw.times, values));
  }
  const hips = bones.Hips;
  if (hips && raw.hips?.length) {
    const rest = hips.position.clone();
    const ratio = (rest.y || BAKED_HIP) / BAKED_HIP;
    const pos = new Float32Array(raw.hips.length);
    for (let i = 0; i < raw.hips.length; i += 3) {
      pos[i] = rest.x;
      pos[i + 1] = rest.y + raw.hips[i + 1] * ratio;
      pos[i + 2] = rest.z;
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.uuid}.position`, raw.times, pos));
  }
  return new THREE.AnimationClip(name, -1, tracks);
}
